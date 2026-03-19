// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPayrollScheduler.sol";

/**
 * @title PayrollSchedulerFallback
 * @notice Pure-Solidity fallback implementation of IPayrollScheduler.
 * @dev Use this when pallet_revive cross-VM calls are unavailable on testnet.
 *      Deploy it and pass its address as schedulerContract in PayrollVault constructor.
 *      Functionally identical to the Rust implementation.
 *      Stateless: no storage, no token access, no admin key.
 */
contract PayrollSchedulerFallback {
    /**
     * @notice Compute due employees and amounts — identical logic to Rust contract
     * @dev Filters: nextPaymentDue[i] <= currentTimestamp AND salaries[i] <= approvedCaps[i]
     */
    function computePayroll(
        address[] calldata employees,
        uint256[] calldata salaries,
        uint256[] calldata nextPaymentDue,
        uint256[] calldata approvedCaps,
        uint256 currentTimestamp
    ) external pure returns (
        address[] memory dueEmployees,
        uint256[] memory amounts
    ) {
        uint256 len = employees.length;
        address[] memory tempAddr = new address[](len);
        uint256[] memory tempAmt  = new uint256[](len);
        uint256 count = 0;

        for (uint256 i = 0; i < len; i++) {
            // Filter 1: is this employee due?
            if (nextPaymentDue[i] > currentTimestamp) continue;
            // Filter 2: does salary fit within cap?
            if (salaries[i] > approvedCaps[i]) continue;
            // Include in output
            tempAddr[count] = employees[i];
            tempAmt[count]  = salaries[i];
            count++;
        }

        // Trim output arrays to exact length
        dueEmployees = new address[](count);
        amounts      = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            dueEmployees[i] = tempAddr[i];
            amounts[i]      = tempAmt[i];
        }
    }
}
