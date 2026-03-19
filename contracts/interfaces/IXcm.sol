// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IXcm
 * @notice Interface for the Polkadot XCM precompile.
 * @dev Deployed at: 0x00000000000000000000000000000000000A0000
 *
 * @dev IMPORTANT: The spec document incorrectly names these functions xcmExecute/xcmSend.
 *      The real precompile uses execute() and send(). This file is authoritative.
 *
 * @dev Source: https://github.com/paritytech/polkadot-sdk/blob/master/polkadot/xcm/pallet-xcm/precompiles/src/interface/IXcm.sol
 */

/// @dev Confirmed precompile address — do not change
address constant XCM_PRECOMPILE_ADDRESS = 0x00000000000000000000000000000000000A0000;

interface IXcm {
    /// @notice Weight struct for XCM execution cost (Weight V2)
    struct Weight {
        /// @dev Computational time in picoseconds on reference hardware
        uint64 refTime;
        /// @dev Proof size in bytes
        uint64 proofSize;
    }

    /**
     * @notice Execute an XCM message locally on this chain (Hub-local payroll path)
     * @dev Calls pallet_xcm::execute internally.
     *      Use for employees with parachainId == 0.
     *      Always call weighMessage() first to get the correct weight.
     * @param message SCALE-encoded Versioned XCM message (see docs/XCM_ENCODING_GUIDE.md)
     * @param weight Maximum Weight for execution. Use weighMessage() result + 20% buffer.
     */
    function execute(bytes calldata message, Weight calldata weight) external;

    /**
     * @notice Send an XCM message to another parachain (cross-chain payroll path)
     * @dev Calls pallet_xcm::send internally.
     *      Use for employees with parachainId > 0.
     *      destination must be SCALE-encoded Versioned MultiLocation bytes (NOT bytes32).
     * @param destination SCALE-encoded MultiLocation. See _encodeParachainDestination() in PayrollVault.
     * @param message SCALE-encoded Versioned XCM message
     */
    function send(bytes calldata destination, bytes calldata message) external;

    /**
     * @notice Estimate the Weight required to execute a given XCM message
     * @dev Always call this before execute() to obtain a safe weight value.
     * @param message SCALE-encoded Versioned XCM message
     * @return weight Estimated Weight struct
     */
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}
