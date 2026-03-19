// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IXcm.sol";

/**
 * @title MockIXcm
 * @notice Mock XCM precompile for Hardhat unit tests.
 * @dev Deploy this at the XCM precompile address in Hardhat tests using hardhat_setCode.
 *
 * Records all calls for assertion in tests:
 *   - executeCallCount: number of execute() calls
 *   - sendCallCount: number of send() calls
 *   - lastExecuteMessage: last message passed to execute()
 *   - lastSendDestination: last destination passed to send()
 *   - lastSendMessage: last message passed to send()
 *
 * Test failure simulation:
 *   - setFailExecute(true): next execute() call reverts
 *   - setFailSend(true): next send() call reverts
 */
contract MockIXcm {
    // ── Recorded call data ────────────────────────────────────────────────────

    uint256 public executeCallCount;
    uint256 public sendCallCount;

    bytes   public lastExecuteMessage;
    IXcm.Weight public lastExecuteWeight;

    bytes   public lastSendDestination;
    bytes   public lastSendMessage;

    // Store all send() destinations for multi-call assertions
    bytes[] public sendDestinations;
    bytes[] public sendMessages;

    // ── Test control flags ────────────────────────────────────────────────────

    bool public failNextExecute;
    bool public failNextSend;

    // Configurable weighMessage return value
    IXcm.Weight public mockWeight;

    constructor() {
        // Default weight — non-zero so PayrollVault passes weight validation
        mockWeight = IXcm.Weight({ refTime: 1_000_000_000, proofSize: 65536 });
    }

    // ── IXcm interface ────────────────────────────────────────────────────────

    function execute(bytes calldata message, IXcm.Weight calldata weight) external {
        if (failNextExecute) {
            failNextExecute = false;
            revert("MockIXcm: forced execute failure");
        }
        executeCallCount++;
        lastExecuteMessage = message;
        lastExecuteWeight  = weight;
    }

    function send(bytes calldata destination, bytes calldata message) external {
        if (failNextSend) {
            failNextSend = false;
            revert("MockIXcm: forced send failure");
        }
        sendCallCount++;
        lastSendDestination = destination;
        lastSendMessage     = message;
        sendDestinations.push(destination);
        sendMessages.push(message);
    }

    function weighMessage(bytes calldata /*message*/) external view returns (IXcm.Weight memory) {
        return mockWeight;
    }

    // ── Test helpers ──────────────────────────────────────────────────────────

    function setFailExecute(bool fail) external { failNextExecute = fail; }
    function setFailSend(bool fail)    external { failNextSend    = fail; }
    function setMockWeight(uint64 refTime, uint64 proofSize) external {
        mockWeight = IXcm.Weight({ refTime: refTime, proofSize: proofSize });
    }
    function resetCounts() external {
        executeCallCount = 0;
        sendCallCount    = 0;
        delete sendDestinations;
        delete sendMessages;
    }
    function getSendCount() external view returns (uint256) { return sendCallCount; }
    function getSendDestination(uint256 i) external view returns (bytes memory) { return sendDestinations[i]; }
}
