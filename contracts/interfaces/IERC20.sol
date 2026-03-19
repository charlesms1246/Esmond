// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC20
 * @notice Interface for the Polkadot Asset Hub ERC-20 precompile.
 * @dev Each Asset Hub asset is accessible at a deterministic address:
 *      address = 0xFFFFFFFF + assetId (right-aligned to 20 bytes)
 *
 *      Known addresses (Paseo testnet):
 *      Mock USDC (id 1984): 0xFFFFFFFF00000000000000000000000000000007C0
 *      Mock USDT (id 1337): 0xFFFFFFFF0000000000000000000000000000000539
 *
 * @dev The precompile always reverts on failure — it never returns false.
 *      SafeERC20 is NOT needed. Standard bool returns are always true on success.
 *
 * @dev Source: https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/assets/precompiles/src/lib.rs
 */
interface IERC20 {
    // ─────────────────────────────── Events ──────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ─────────────────────────────── View ────────────────────────────────────

    /// @notice Total supply of this asset
    function totalSupply() external view returns (uint256);

    /// @notice Token balance of `account`
    function balanceOf(address account) external view returns (uint256);

    /// @notice Remaining amount `spender` is allowed to spend on behalf of `owner`
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Number of decimal places for display (not enforced on-chain)
    function decimals() external view returns (uint8);

    // ─────────────────────────────── Mutating ────────────────────────────────

    /// @notice Transfer `amount` tokens to `to`
    /// @return Always true. Reverts on failure.
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Approve `spender` to transfer up to `amount` on your behalf
    /// @return Always true. Reverts on failure.
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Transfer `amount` from `from` to `to` (requires prior approval)
    /// @return Always true. Reverts on failure.
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
