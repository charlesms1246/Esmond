// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockERC20
 * @notice Configurable ERC-20 mock for Hardhat tests.
 * @dev Simulates the Asset Hub ERC-20 precompile behaviour:
 *      - Always reverts on failure (never returns false)
 *      - Standard bool-returning interface
 *
 * Additional test controls:
 *   - mint() and burn() for test setup
 *   - forceFailTransfer() to simulate vault insufficient balance scenarios
 */
contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Test control flags
    bool public failNextTransfer;
    bool public failNextTransferFrom;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    // ── Test helpers ─────────────────────────────────────────────────────────

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "Burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    /// @dev Call this in tests to make the NEXT transfer() call revert
    function setFailNextTransfer(bool fail) external {
        failNextTransfer = fail;
    }

    /// @dev Call this in tests to make the NEXT transferFrom() call revert
    function setFailNextTransferFrom(bool fail) external {
        failNextTransferFrom = fail;
    }

    // ── Standard ERC-20 interface ────────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        if (failNextTransfer) {
            failNextTransfer = false;
            revert("MockERC20: forced failure");
        }
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (failNextTransferFrom) {
            failNextTransferFrom = false;
            revert("MockERC20: forced failure");
        }
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
