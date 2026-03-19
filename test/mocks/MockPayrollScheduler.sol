// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockPayrollScheduler
 * @notice Mock for the Rust PayrollScheduler. Fully configurable for unit tests.
 * @dev Allows tests to:
 *   - Return a pre-configured (dueEmployees, amounts) pair
 *   - Verify the exact inputs PayrollVault passes
 *   - Simulate empty return (no one due)
 *   - Simulate revert (cross-VM failure scenario)
 */
contract MockPayrollScheduler {
    // ── Recorded call inputs ──────────────────────────────────────────────────

    address[] public lastEmployees;
    uint256[] public lastSalaries;
    uint256[] public lastNextDue;
    uint256[] public lastCaps;
    uint256   public lastTimestamp;
    uint256   public callCount;

    // ── Configured return values ──────────────────────────────────────────────

    address[] private _returnDue;
    uint256[] private _returnAmounts;
    bool      private _shouldRevert;
    string    private _revertMessage;

    // ── Configuration ─────────────────────────────────────────────────────────

    /// @dev Set what computePayroll() will return
    function setReturnValues(
        address[] calldata due,
        uint256[] calldata amounts
    ) external {
        require(due.length == amounts.length, "Arrays must match");
        delete _returnDue;
        delete _returnAmounts;
        for (uint i = 0; i < due.length; i++) {
            _returnDue.push(due[i]);
            _returnAmounts.push(amounts[i]);
        }
        _shouldRevert = false;
    }

    /// @dev Make computePayroll() revert on next call
    function setRevert(bool shouldRevert, string calldata message) external {
        _shouldRevert   = shouldRevert;
        _revertMessage  = message;
    }

    /// @dev Reset to empty return (no employees due)
    function setEmpty() external {
        delete _returnDue;
        delete _returnAmounts;
        _shouldRevert = false;
    }

    // ── Array length helpers (public arrays only expose element getter) ────────

    function getLastEmployeesLength() external view returns (uint256) { return lastEmployees.length; }
    function getLastSalariesLength()  external view returns (uint256) { return lastSalaries.length; }
    function getReturnDueLength()     external view returns (uint256) { return _returnDue.length; }

    // ── IPayrollScheduler interface ───────────────────────────────────────────

    function computePayroll(
        address[] calldata employees,
        uint256[] calldata salaries,
        uint256[] calldata nextPaymentDue,
        uint256[] calldata approvedCaps,
        uint256 currentTimestamp
    ) external returns (
        address[] memory dueEmployees,
        uint256[] memory amounts
    ) {
        if (_shouldRevert) revert(_revertMessage);

        // Record inputs for assertions
        callCount++;
        delete lastEmployees;
        delete lastSalaries;
        delete lastNextDue;
        delete lastCaps;
        for (uint i = 0; i < employees.length; i++) {
            lastEmployees.push(employees[i]);
            lastSalaries.push(salaries[i]);
            lastNextDue.push(nextPaymentDue[i]);
            lastCaps.push(approvedCaps[i]);
        }
        lastTimestamp = currentTimestamp;

        return (_returnDue, _returnAmounts);
    }
}
