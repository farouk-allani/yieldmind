/**
 * Bonzo LendingPool ABI (Aave v2 fork) for direct deposits via MetaMask.
 *
 * Users deposit directly into Bonzo's LendingPool — no middleman contract.
 * Strategy tracking is handled off-chain via HCS decision logs.
 */

export const BONZO_LENDING_POOL_ABI = [
  'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// Bonzo LendingPool address from env (network-specific)
export const BONZO_LENDING_POOL_ADDRESS =
  process.env.NEXT_PUBLIC_BONZO_LENDING_POOL_ADDRESS || '';

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

// Legacy YieldMindVault address (testnet deployment)
export const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS ||
  '0x29d115707bEe4adAa159Fe757B7dA4ffF8cc432A';
