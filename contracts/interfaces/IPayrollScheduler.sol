// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPayrollScheduler
 * @notice Solidity interface for the Rust/PVM PayrollScheduler contract.
 * @dev The contract is deployed via pallet_revive to the PVM (PolkaVM).
 *      From Solidity's perspective this is a standard external call.
 *      The Dual VM Stack routes it to PVM transparently.
 *
 *      The deployed address is set as an immutable in PayrollVault constructor.
 *      If pallet_revive is unavailable, use PayrollSchedulerFallback.sol at the same address.
 *
 * @dev Contract is stateless: no storage, no token access, no admin key.
 *      Attack surface is zero — it is a pure computation module.
 */
interface IPayrollScheduler {
    /**
     * @notice Compute due employees and their payment amounts
     * @dev Filters employees where nextPaymentDue <= currentTimestamp AND salary <= approvedCap.
     *      Returns parallel arrays of equal length.
     *      Pure computation — does not read storage, does not transfer tokens.
     *
     * @param employees    Array of employee wallet addresses (indexed 0..N-1)
     * @param salaries     Amount per cycle in token base units (parallel to employees)
     * @param nextPaymentDue Unix timestamps for next payment due (parallel to employees)
     * @param approvedCaps Per-employee maximum total payment allowed (parallel to employees)
     * @param currentTimestamp Current block.timestamp — pass block.timestamp from caller
     *
     * @return dueEmployees Subset of employees who are due AND within cap
     * @return amounts      Payment amount for each due employee (equals their salary)
     *
     * Invariants:
     *   - dueEmployees.length == amounts.length always
     *   - Every address in dueEmployees is present in employees input
     *   - Every amount in amounts equals the corresponding salary (not cap)
     */
    function computePayroll(
        address[] calldata employees,
        uint256[] calldata salaries,
        uint256[] calldata nextPaymentDue,
        uint256[] calldata approvedCaps,
        uint256 currentTimestamp
    ) external returns (
        address[] memory dueEmployees,
        uint256[] memory amounts
    );
}
