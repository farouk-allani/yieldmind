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
  preferences: string[]; // extracted preferences like "stable", "high yield", etc.
  sessionId: string;
}

// --- Vault Types (Bonzo) ---

export interface VaultInfo {
  address: string;
  name: string;
  tokenPair: string; // e.g., "HBAR/USDC"
  apy: number; // annualized percentage yield
  tvl: number; // total value locked in USD
  riskLevel: RiskTolerance;
  liquidityDepth: number;
  lastHarvest: string; // ISO 8601
  rewardToken: string;
}

export interface VaultStrategy {
  vaultAddress: string;
  vaultName: string;
  allocation: number; // percentage of user's total deposit (0-100)
  expectedApy: number;
  riskLevel: RiskTolerance;
  reasoning: string;
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
  | 'strategist:strategy-proposed'
  | 'strategist:strategy-approved'
  | 'executor:deposit'
  | 'executor:deposit-confirmed'
  | 'executor:harvest'
  | 'executor:withdraw'
  | 'executor:rebalance'
  | 'sentinel:alert'
  | 'sentinel:emergency-exit';

export interface ExecutionConfirmation {
  txHash: string;
  userAddress: string;
  depositAmount: number;
  sessionId: string;
  strategyId?: string;
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
