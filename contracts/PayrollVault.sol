// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IXcm.sol";
import "./interfaces/IPayrollScheduler.sol";

/**
 * @title PayrollVault
 * @notice On-chain payroll vault with XCM-based payment routing.
 * @dev Supports Hub-local payroll (execute) and cross-chain payroll (send).
 *      Uses a Rust/PVM PayrollScheduler contract for due-date filtering.
 */
contract PayrollVault is Ownable, ReentrancyGuard {
    // ─────────────────────────────── Constants ────────────────────────────────

    /// @dev XCM precompile — verified address, do not modify
    address public constant XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

    /// @dev Weight buffer multiplier numerator (1.2x = 12/10)
    uint64 private constant WEIGHT_BUFFER_NUM = 12;
    uint64 private constant WEIGHT_BUFFER_DEN = 10;

    // ─────────────────────────────── Storage ──────────────────────────────────

    struct Employee {
        address wallet;          // Recipient address (H160)
        uint256 salaryAmount;    // Amount per cycle in token base units
        address payToken;        // Asset Hub ERC-20 precompile address for this employee
        uint256 payInterval;     // Seconds between payments (e.g. 2592000 = 30 days)
        uint256 nextPaymentDue;  // Unix timestamp — updated after each payment
        uint256 approvedCap;     // Max total this employee can be paid (enforced in Rust)
        uint32  parachainId;     // 0 = Hub (execute), >0 = cross-chain (send)
        bool    active;
    }

    mapping(uint256 => Employee) public employees;
    uint256 public employeeCount;
    address public immutable schedulerContract;   // pallet_revive PayrollScheduler address

    // ─────────────────────────────── Events ───────────────────────────────────

    event VaultDeposited(address indexed token, uint256 amount);
    event EmployeeRegistered(uint256 indexed id, address indexed wallet, uint256 salary, uint32 parachainId);
    event EmployeeDeactivated(uint256 indexed id);
    event PayrollExecuted(uint256 employeeCount, uint256 totalPayout);

    // ─────────────────────────────── Constructor ──────────────────────────────

    constructor(address _schedulerContract) Ownable(msg.sender) {
        require(_schedulerContract != address(0), "Invalid scheduler address");
        schedulerContract = _schedulerContract;
    }

    // ─────────────────────────────── Admin Functions ──────────────────────────

    /**
     * @notice Deposit stablecoins into the vault for payroll
     * @dev Caller must approve this contract on the ERC-20 precompile first.
     * @param token  Asset Hub ERC-20 precompile address (e.g. mock USDC precompile)
     * @param amount Amount in token base units
     */
    function deposit(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        emit VaultDeposited(token, amount);
    }

    /**
     * @notice Register a new employee for recurring payroll
     * @param wallet      Employee wallet address
     * @param salary      Amount per pay cycle in token base units
     * @param token       Asset Hub ERC-20 precompile address for this employee's pay token
     * @param interval    Pay cycle in seconds (e.g. 2592000 = 30 days)
     * @param cap         Maximum total this employee is authorised to receive
     * @param parachainId 0 = Polkadot Hub, >0 = destination parachain ID
     * @return id         The new employee ID
     */
    function registerEmployee(
        address wallet,
        uint256 salary,
        address token,
        uint256 interval,
        uint256 cap,
        uint32 parachainId
    ) external onlyOwner returns (uint256 id) {
        require(wallet != address(0), "Invalid wallet");
        require(salary > 0, "Salary must be > 0");
        require(token != address(0), "Invalid token");
        require(interval > 0, "Interval must be > 0");
        require(cap >= salary, "Cap must be >= salary");

        id = employeeCount++;
        employees[id] = Employee({
            wallet:         wallet,
            salaryAmount:   salary,
            payToken:       token,
            payInterval:    interval,
            nextPaymentDue: block.timestamp,   // First payment immediately eligible
            approvedCap:    cap,
            parachainId:    parachainId,
            active:         true
        });
        emit EmployeeRegistered(id, wallet, salary, parachainId);
    }

    /**
     * @notice Deactivate an employee, stopping future payroll
     */
    function deactivateEmployee(uint256 id) external onlyOwner {
        require(employees[id].active, "Already inactive");
        employees[id].active = false;
        emit EmployeeDeactivated(id);
    }

    // ─────────────────────────────── Core: runPayroll ─────────────────────────

    /**
     * @notice Execute payroll for all due employees
     * @dev Steps:
     *   1. Build input arrays from active employees
     *   2. Call Rust/PVM scheduler via cross-VM call → get (dueEmployees, amounts)
     *   3. Preflight: verify vault balance covers total payout
     *   4. Segment due employees by parachainId (Hub vs cross-chain)
     *   5a. Hub employees: encode XCM + weighMessage + execute()
     *   5b. Cross-chain employees: encode dest + XCM + send()
     *   6. Update nextPaymentDue for all paid employees
     *
     * @dev Reverts if vault balance is insufficient.
     * @dev Reverts (atomically) if any XCM call fails.
     * @dev Can be called by anyone (keeper-friendly) — does not require onlyOwner.
     */
    function runPayroll() external nonReentrant {
        // ── Step 1: Build input arrays from all active employees ──────────────
        uint256 count = employeeCount;
        address[] memory wallets    = new address[](count);
        uint256[] memory salaries   = new uint256[](count);
        uint256[] memory nextDue    = new uint256[](count);
        uint256[] memory caps       = new uint256[](count);
        uint256   activeCount       = 0;

        for (uint256 i = 0; i < count; i++) {
            if (employees[i].active) {
                wallets[activeCount]  = employees[i].wallet;
                salaries[activeCount] = employees[i].salaryAmount;
                nextDue[activeCount]  = employees[i].nextPaymentDue;
                caps[activeCount]     = employees[i].approvedCap;
                activeCount++;
            }
        }

        // Trim arrays to activeCount
        assembly {
            mstore(wallets,  activeCount)
            mstore(salaries, activeCount)
            mstore(nextDue,  activeCount)
            mstore(caps,     activeCount)
        }

        if (activeCount == 0) return;  // No active employees — exit cleanly

        // ── Step 2: Cross-VM call to Rust scheduler ───────────────────────────
        (address[] memory dueEmployees, uint256[] memory amounts) =
            IPayrollScheduler(schedulerContract).computePayroll(
                wallets, salaries, nextDue, caps, block.timestamp
            );

        if (dueEmployees.length == 0) return;  // No one is due — exit cleanly

        // ── Step 3: Preflight balance check ──────────────────────────────────
        // NOTE: This simplified version uses the first active employee's token.
        // MVP scope: single-token payroll (per spec §11.2 — multi-token is Phase 2)
        address payToken = employees[0].payToken;
        uint256 totalPayout = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalPayout += amounts[i];
        }
        require(
            IERC20(payToken).balanceOf(address(this)) >= totalPayout,
            "Insufficient vault balance"
        );

        // ── Step 4: Segment by parachainId ───────────────────────────────────
        // Build a lookup: dueEmployee address → its employee struct index
        // Then separate Hub vs cross-chain
        uint256 dueLen  = dueEmployees.length;
        address[] memory hubWallets  = new address[](dueLen);
        uint256[] memory hubAmounts  = new uint256[](dueLen);
        address[] memory xcmWallets  = new address[](dueLen);
        uint256[] memory xcmAmounts  = new uint256[](dueLen);
        uint32[]  memory xcmChains   = new uint32[](dueLen);
        uint256   hubCount = 0;
        uint256   xcmCount = 0;

        for (uint256 i = 0; i < dueLen; i++) {
            uint32 pid = _getParachainId(dueEmployees[i]);
            if (pid == 0) {
                hubWallets[hubCount] = dueEmployees[i];
                hubAmounts[hubCount] = amounts[i];
                hubCount++;
            } else {
                xcmWallets[xcmCount] = dueEmployees[i];
                xcmAmounts[xcmCount] = amounts[i];
                xcmChains[xcmCount]  = pid;
                xcmCount++;
            }
        }

        // ── Step 5a: Hub employees — execute() (local, same-block settlement) ─
        if (hubCount > 0) {
            for (uint256 i = 0; i < hubCount; i++) {
                bytes memory xcmMsg = _encodeHubTransfer(
                    hubWallets[i],
                    hubAmounts[i],
                    payToken
                );
                IXcm.Weight memory w = IXcm(XCM_PRECOMPILE).weighMessage(xcmMsg);
                // Apply 20% weight buffer
                w.refTime   = w.refTime   * WEIGHT_BUFFER_NUM / WEIGHT_BUFFER_DEN;
                w.proofSize = w.proofSize * WEIGHT_BUFFER_NUM / WEIGHT_BUFFER_DEN;
                IXcm(XCM_PRECOMPILE).execute(xcmMsg, w);
            }
        }

        // ── Step 5b: Cross-chain employees — send() per destination chain ─────
        if (xcmCount > 0) {
            for (uint256 i = 0; i < xcmCount; i++) {
                bytes memory dest   = _encodeParachainDest(xcmChains[i]);
                bytes memory xcmMsg = _encodeCrossChainTransfer(
                    xcmWallets[i],
                    xcmAmounts[i],
                    payToken
                );
                IXcm(XCM_PRECOMPILE).send(dest, xcmMsg);
            }
        }

        // ── Step 6: Update nextPaymentDue for all paid employees ──────────────
        _updateDueDates(dueEmployees);

        emit PayrollExecuted(dueEmployees.length, totalPayout);
    }

    // ─────────────────────────────── View Functions ───────────────────────────

    /// @notice Get all fields of an employee by ID
    function getEmployee(uint256 id) external view returns (Employee memory) {
        return employees[id];
    }

    /// @notice Get current vault balance for a token
    function vaultBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ─────────────────────────────── Internal Helpers ─────────────────────────

    /// @dev Look up parachainId for a wallet address
    function _getParachainId(address wallet) internal view returns (uint32) {
        for (uint256 i = 0; i < employeeCount; i++) {
            if (employees[i].wallet == wallet && employees[i].active) {
                return employees[i].parachainId;
            }
        }
        return 0;
    }

    /// @dev Update nextPaymentDue for each paid employee
    function _updateDueDates(address[] memory paid) internal {
        for (uint256 i = 0; i < paid.length; i++) {
            for (uint256 j = 0; j < employeeCount; j++) {
                if (employees[j].wallet == paid[i] && employees[j].active) {
                    employees[j].nextPaymentDue += employees[j].payInterval;
                    break;
                }
            }
        }
    }

    /**
     * @dev Encode a V4 XCM TransferAsset message for Hub-local payroll.
     *      Uses a simplified TransferAsset instruction (single-instruction message).
     *      token parameter determines the AssetId for the XCM asset encoding.
     *
     * NOTE: The exact XCM bytes depend on the on-chain asset encoding.
     * This function provides the structure — use XCM_ENCODING_GUIDE.md §5.1 for
     * the precise byte layout. The implementation below uses a simplified placeholder
     * that must be validated via weighMessage() during testnet testing.
     *
     * For a robust implementation, consider using a TypeScript-generated bytes constant
     * (pre-computed off-chain and passed as a parameter) to avoid on-chain encoding errors.
     */
    function _encodeHubTransfer(
        address recipient,
        uint256 amount,
        address token
    ) internal pure returns (bytes memory) {
        // V4 XCM: TransferAsset { assets: [asset], beneficiary: AccountId20(recipient) }
        // See XCM_ENCODING_GUIDE.md for full byte breakdown
        // This is the structure; the precise SCALE encoding of the asset and amount
        // must be validated against the precompile via weighMessage().
        uint32 assetId = _assetIdFromToken(token);
        return abi.encodePacked(
            bytes1(0x04),                           // XCM V4 version tag
            bytes1(0x04),                           // Compact(1): 1 instruction
            bytes1(0x07),                           // TransferAsset discriminant
            _encodeXcmAsset(assetId, amount),       // Asset (id + fungibility)
            _encodeAccountId20(recipient)           // Beneficiary
        );
    }

    /// @dev Encode a V4 XCM message for cross-chain transfer (used with send())
    function _encodeCrossChainTransfer(
        address recipient,
        uint256 amount,
        address token
    ) internal pure returns (bytes memory) {
        // For MVP: same structure as hub transfer — destination parachain decodes it
        // In production: may need ReserveAssetDeposited + BuyExecution sequence
        uint32 assetId = _assetIdFromToken(token);
        return abi.encodePacked(
            bytes1(0x04),
            bytes1(0x04),
            bytes1(0x07),
            _encodeXcmAsset(assetId, amount),
            _encodeAccountId20(recipient)
        );
    }

    /// @dev Encode V4 XCM Asset: { id: X2(PalletInstance(50), GeneralIndex(assetId)), fun: Fungible(amount) }
    function _encodeXcmAsset(uint32 assetId, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x00),                    // parents = 0
            bytes1(0x02),                    // X2 (2 junctions)
            bytes1(0x04),                    // PalletInstance junction
            bytes1(0x32),                    // pallet index 50 (Assets pallet)
            bytes1(0x05),                    // GeneralIndex junction
            _scaleCompactU32(assetId),       // asset ID
            bytes1(0x00),                    // Fungible discriminant
            _scaleCompactU128(amount)        // amount
        );
    }

    /// @dev Encode V4 XCM Beneficiary: AccountId20 (H160 Ethereum address)
    function _encodeAccountId20(address account) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x00),    // parents = 0
            bytes1(0x01),    // X1 (1 junction)
            bytes1(0x03),    // AccountId20 junction discriminant
            bytes1(0x00),    // Network: None
            bytes20(account)
        );
    }

    /// @dev Encode V4 SCALE Versioned MultiLocation for a parachain destination
    function _encodeParachainDest(uint32 parachainId) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x04),                    // XCM V4 version tag
            bytes1(0x01),                    // parents = 1 (up to relay chain)
            bytes1(0x01),                    // X1 (1 junction)
            bytes1(0x00),                    // Junction::Parachain discriminant
            _encodeU32LE(parachainId)        // parachain ID as LE u32
        );
    }

    /// @dev Derive Asset Hub asset ID from ERC-20 precompile address
    /// Address pattern: 0xFFFFFFFF + 000...000 + assetId (4 bytes)
    function _assetIdFromToken(address token) internal pure returns (uint32) {
        return uint32(uint160(token) & 0xFFFFFFFF);
    }

    /// @dev SCALE compact encode uint32 (handles values up to ~1 billion)
    function _scaleCompactU32(uint32 value) internal pure returns (bytes memory) {
        if (value <= 63) {
            return abi.encodePacked(bytes1(uint8(value << 2)));
        } else if (value <= 16383) {
            uint16 v = uint16((uint256(value) << 2) | 1);
            return abi.encodePacked(bytes1(uint8(v)), bytes1(uint8(v >> 8)));
        } else if (value <= 1073741823) {
            uint32 v = (uint32(value) << 2) | 2;
            return abi.encodePacked(_encodeU32LE(v));
        } else {
            // 4-byte big-integer mode for values > 1073741823
            return abi.encodePacked(bytes1(0x03), _encodeU32LE(value));
        }
    }

    /// @dev SCALE compact encode uint128 (for token amounts)
    function _scaleCompactU128(uint256 value) internal pure returns (bytes memory) {
        if (value <= 63) {
            return abi.encodePacked(bytes1(uint8(value << 2)));
        } else if (value <= 16383) {
            uint16 v = uint16((value << 2) | 1);
            return abi.encodePacked(bytes1(uint8(v)), bytes1(uint8(v >> 8)));
        } else if (value <= 1073741823) {
            uint32 v = uint32((value << 2) | 2);
            return abi.encodePacked(_encodeU32LE(v));
        } else {
            // Big-integer mode — compute minimum byte count
            uint256 temp = value;
            uint8 byteLen = 0;
            while (temp > 0) { temp >>= 8; byteLen++; }
            bytes memory encoded = new bytes(byteLen);
            temp = value;
            for (uint8 i = 0; i < byteLen; i++) {
                encoded[i] = bytes1(uint8(temp & 0xFF));
                temp >>= 8;
            }
            uint8 prefix = uint8(((byteLen - 4) << 2) | 3);
            return abi.encodePacked(bytes1(prefix), encoded);
        }
    }

    /// @dev Encode uint32 as 4 little-endian bytes
    function _encodeU32LE(uint32 value) internal pure returns (bytes4) {
        return bytes4(
            uint32(uint8(value))            |
            (uint32(uint8(value >>  8)) <<  8) |
            (uint32(uint8(value >> 16)) << 16) |
            (uint32(uint8(value >> 24)) << 24)
        );
    }
}
