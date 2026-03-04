/**
 * Bonzo LendingPool ABI (Aave v2 fork) for direct deposits via MetaMask.
 *
 * Users deposit directly into Bonzo's LendingPool — no middleman contract.
 * Strategy tracking is handled off-chain via HCS decision logs.
 */

import { getNetworkConfig, getVaultAddress, getCurrentNetwork } from './network-config';

export const BONZO_LENDING_POOL_ABI = [
  'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

/**
 * Minimal ERC-20 ABI for token approval before Bonzo LendingPool deposits.
 * HTS tokens on Hedera expose the standard ERC-20 interface via their EVM address.
 */
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

/**
 * Bonzo WETHGateway ABI — wraps native HBAR → WHBAR and deposits into LendingPool.
 * On Hedera, native HBAR deposits MUST go through WETHGateway, not LendingPool.deposit() directly.
 */
export const WETH_GATEWAY_ABI = [
  'function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) external payable',
  'function withdrawETH(address lendingPool, uint256 amount, address to) external',
];

// ---------------------------------------------------------------------------
// Dynamic address getters — read from network-config at call time
// ---------------------------------------------------------------------------

/** Bonzo LendingPool address for the current network */
export function getBonzoLendingPoolAddress(): string {
  return getNetworkConfig().bonzoLendingPoolAddress;
}

/**
 * Return the lendingPool address to pass to WETHGateway.depositETH().
 *
 * Hedera's WETHGateway validates the lendingPool parameter against an
 * internal whitelist that was populated using Hedera long-zero format
 * addresses (0x000...00<accountId_hex>). Passing the full EVM alias
 * (0x236897c5...) causes a storage-mapping miss → revert at ~3,159 gas.
 *
 * Long-zero = 0x + 34 zero hex chars + 6-char Hedera account ID in hex.
 * Mainnet LendingPool account 0.0.7308459 → hex 6F84AB → long-zero below.
 */
export function getWETHGatewayLendingPoolArg(): string {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    return '0x00000000000000000000000000000000006F84AB'; // 0.0.7308459 long-zero
  }
  // Testnet — non-functional but return the configured address so errors are clear
  return getNetworkConfig().bonzoLendingPoolAddress;
}

// Re-export for convenience
export { getVaultAddress } from './network-config';

// ---------------------------------------------------------------------------
// Legacy YieldMindVault ABI — kept for backward compatibility with portfolio
// reads on the already-deployed testnet contract.
// ---------------------------------------------------------------------------

export const VAULT_ABI = [
  'function deposit(bytes32 strategyId, string calldata vaultName) external payable',
  'function withdraw(bytes32 strategyId, uint256 amount) external',
  'function emergencyWithdraw() external',
  'function getDeposit(bytes32 strategyId, address user) external view returns (uint256)',
  'function userTotals(address) external view returns (uint256)',
  'function totalValueLocked() external view returns (uint256)',
  'event Deposited(address indexed user, bytes32 indexed strategyId, uint256 amount, string vaultName)',
  'event Withdrawn(address indexed user, bytes32 indexed strategyId, uint256 amount)',
  'event EmergencyWithdrawn(address indexed user, uint256 amount)',
];
