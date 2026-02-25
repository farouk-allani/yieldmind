/**
 * YieldMindVault contract ABI (human-readable format for ethers.js v6)
 * and deployed address from environment.
 */

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

// Deployed address with env override. Hardcoded fallback ensures
// reads work even if the dev server wasn't restarted after adding the env var.
export const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS ||
  '0x29d115707bEe4adAa159Fe757B7dA4ffF8cc432A';
