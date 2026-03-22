// ============================================================
// YieldMind Protocol — Core Types
// ============================================================

// --- Agent Types ---

export type AgentRole = 'scout' | 'strategist' | 'executor' | 'sentinel';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';

export interface AgentState {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  lastAction: string | null;
  lastUpdate: string; // ISO 8601
}

// --- Decision Logging (Published to HCS) ---

export interface DecisionLog {
  agentId: string;
  agentRole: AgentRole;
  action: string;
  reasoning: string; // Human-readable explanation — the core differentiator
  confidence: number; // 0-1
  timestamp: string; // ISO 8601
  sessionId: string;
  data: Record<string, unknown>;
}

// --- User Intent ---

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface UserIntent {
  rawMessage: string;
  riskTolerance: RiskTolerance;
  targetAmount: number; // in HBAR or token units
  tokenSymbol: string; // e.g., 'HBAR', 'USDC'
  /** Secondary token for dual-asset vault deposits (e.g., user has both USDC + HBAR) */
  secondaryToken?: string;
  /** Amount of secondary token */
  secondaryAmount?: number;
  preferences: string[]; // extracted preferences like "stable", "high yield", etc.
  sessionId: string;
}

// --- Vault Types (Bonzo Lend) ---

export interface VaultInfo {
  address: string; // HTS address (0.0.xxxxx)
  evmAddress: string; // EVM address (0x...) — needed for LendingPool deposits
  symbol: string; // Token symbol (e.g., 'WHBAR', 'USDC')
  decimals: number; // Token decimals (e.g., 8 for HBAR, 6 for USDC)
  name: string;
  tokenPair: string; // e.g., "HBAR/USDC"
  apy: number; // annualized percentage yield
  tvl: number; // total value locked in USD
  riskLevel: RiskTolerance;
  liquidityDepth: number;
  lastHarvest: string; // ISO 8601
  rewardToken: string;
}

// --- Bonzo Vaults Types (Single/Dual Asset DEX, Leveraged LST) ---

export type BonzoVaultType = 'single-asset-dex' | 'dual-asset-dex' | 'leveraged-lst';

export interface BonzoVaultInfo {
  /** Vault (LP token) EVM address — users deposit/withdraw here */
  vaultAddress: string;
  /** Strategy contract EVM address */
  strategyAddress: string;
  /** Vault type */
  type: BonzoVaultType;
  /** Human-readable name */
  name: string;
  /** Primary deposit token symbol */
  depositToken: string;
  /** Paired token symbol (for single/dual asset vaults) */
  pairedToken?: string;
  /** Token decimals for deposit token */
  depositDecimals: number;
  /** Current APY (if available from on-chain data) */
  apy: number;
  /** Total value locked in USD */
  tvl: number;
  /** Risk level based on volatility classification */
  riskLevel: RiskTolerance;
  /** Volatility classification */
  volatility: string;
  /** Price per full share (vault token → underlying) */
  pricePerShare?: number;
  /** Last harvest timestamp (ISO 8601) */
  lastHarvest?: string;
  /** Safety score from Bonzo API (0-10) */
  safetyScore?: number;
  /** Token0 EVM address (for dual-asset vault deposits) */
  token0Address?: string;
  /** Token1 EVM address (for dual-asset vault deposits) */
  token1Address?: string;
}

export interface VaultStrategy {
  vaultAddress: string; // HTS address (0.0.xxxxx) for Lend, or EVM address for Vaults
  assetEvmAddress: string; // EVM address (0x...) — for on-chain deposits
  symbol: string; // Token symbol — determines HBAR vs ERC-20 deposit flow
  decimals: number; // Token decimals for correct amount formatting
  vaultName: string;
  allocation: number; // percentage of user's total deposit (0-100)
  expectedApy: number;
  riskLevel: RiskTolerance;
  reasoning: string;
  /** Whether this is a Bonzo Vault or Bonzo Lend pool */
  productType?: 'bonzo-lend' | 'bonzo-vault';
  /** Vault type (only for bonzo-vault) */
  vaultType?: BonzoVaultType;
  /** Dual-token deposit data — present when both tokens are provided */
  dualTokenDeposit?: {
    token0Symbol: string;     // e.g., 'USDC'
    token0Address: string;    // EVM address
    token0Decimals: number;
    token0Amount: number;     // human-readable amount
    token1Symbol: string;     // e.g., 'HBAR'
    token1Address: string;    // EVM address
    token1Decimals: number;
    token1Amount: number;     // human-readable amount
    /** deposit(uint256,uint256,uint256) selector: 0x00aeef8a */
    depositSelector: string;
    /** Vault Hedera contract ID (0.0.xxx) for WalletConnect */
    vaultContractId: string;
  };
}

// --- Strategy Types ---

export interface Strategy {
  id: string;
  sessionId: string;
  userIntent: UserIntent;
  vaults: VaultStrategy[];
  totalExpectedApy: number;
  overallRisk: RiskTolerance;
  createdAt: string;
  status: 'proposed' | 'approved' | 'executing' | 'active' | 'exited';
}

// --- HCS Message Types ---

export type HCSMessageType =
  | 'scout:vault-scan'
  | 'scout:bonzo-vault-scan'
  | 'strategist:strategy-proposed'
  | 'strategist:strategy-approved'
  | 'executor:deposit'
  | 'executor:deposit-confirmed'
  | 'executor:vault-deposit'
  | 'executor:vault-deposit-confirmed'
  | 'executor:harvest'
  | 'executor:withdraw'
  | 'executor:rebalance'
  | 'sentinel:alert'
  | 'sentinel:emergency-exit';

export interface ExecutionConfirmation {
  txHash: string;
  userAddress: string;
  depositAmount: number;
  tokenSymbol: string;
  sessionId: string;
  strategyId?: string;
  /** EVM network the MetaMask tx happened on ('testnet' | 'mainnet') */
  evmNetwork?: string;
}

export interface HCSMessage {
  type: HCSMessageType;
  payload: DecisionLog;
  sequenceNumber?: number;
  consensusTimestamp?: string;
}

// --- Sentinel Alert Types ---

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SentinelAlert {
  severity: AlertSeverity;
  condition: string; // e.g., "HBAR price dropped 15% in 1h"
  recommendation: string; // e.g., "Emergency exit from volatile vaults"
  affectedVaults: string[]; // vault addresses
  timestamp: string;
}

// --- Transaction Types ---

export interface TransactionResult {
  success: boolean;
  transactionId: string | null;
  hashscanUrl: string | null;
  error: string | null;
  timestamp: string;
}

// --- API Response Types ---

export interface ChatResponse {
  message: string;
  agentStates: AgentState[];
  strategy?: Strategy;
  decisions: DecisionLog[];
}

export interface VaultsResponse {
  vaults: VaultInfo[];
  lastUpdated: string;
}
