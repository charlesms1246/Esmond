// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrantScheduler
 * @notice Scheduler mock that attempts to reenter PayrollVault.runPayroll()
 *         when computePayroll() is called.
 * @dev Used exclusively to test that ReentrancyGuard blocks reentrant calls.
 */
contract ReentrantScheduler {
    address public immutable vault;

    constructor(address _vault) {
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
        // Attempt reentrancy — should be blocked by ReentrancyGuard
        (bool success, bytes memory returnData) = vault.call(
            abi.encodeWithSignature("runPayroll()")
        );

        // The reentrant call must have failed
        require(!success, "Reentrancy was NOT blocked");
        // Silence unused variable warning
        (returnData);

        return (new address[](0), new uint256[](0));
    }
}
