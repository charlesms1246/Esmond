// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrantScheduler
 * @notice Scheduler mock that attempts to reenter PayrollVault.runPayroll()
 *         when computePayroll() is called.
 * @dev Used exclusively to test that ReentrancyGuard blocks reentrant calls.
 *      Deploy first with no vault, then deploy vault, then call setVault().
 */
contract ReentrantScheduler {
    address public vault;

    constructor() {}

    /// @dev Call after vault is deployed to complete the circular reference
    function setVault(address _vault) external {
        vault = _vault;
    }

    function computePayroll(
        address[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        uint256
    ) external returns (
        address[] memory dueEmployees,
        uint256[] memory amounts
    ) {
        // Attempt reentrancy — ReentrancyGuard will block the inner call
        (bool success,) = vault.call(abi.encodeWithSignature("runPayroll()"));

        // If reentrancy was blocked (success == false), propagate as a revert
        // so the outer runPayroll() also reverts — proving the guard is active
        if (!success) {
            revert("ReentrancyGuard: reentrant call blocked");
        }

        return (new address[](0), new uint256[](0));
    }
}
