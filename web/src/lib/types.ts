// ============================================================
// YieldMind Web — Frontend Types
// Mirrors agents/src/types/index.ts for the web layer
// ============================================================

export type AgentRole = 'scout' | 'strategist' | 'executor' | 'sentinel';

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting'
  | 'error';

export interface AgentState {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  lastAction: string | null;
  lastUpdate: string;
}

export interface DecisionLog {
  agentId: string;
  agentRole: AgentRole;
  action: string;
  reasoning: string;
  confidence: number;
  timestamp: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface VaultInfo {
  address: string; // HTS address (0.0.xxxxx)
  evmAddress: string; // EVM address (0x...) — for LendingPool deposits
  symbol: string; // Token symbol (e.g., 'WHBAR', 'USDC')
  decimals: number; // Token decimals (e.g., 8 for HBAR, 6 for USDC)
  name: string;
  tokenPair: string;
  apy: number;
  tvl: number;
  riskLevel: RiskTolerance;
  liquidityDepth: number;
  lastHarvest: string;
  rewardToken: string;
}

export interface VaultStrategy {
  vaultAddress: string; // HTS address (0.0.xxxxx)
  assetEvmAddress: string; // EVM address (0x...) — for on-chain deposits
  symbol: string; // Token symbol — determines HBAR vs ERC-20 deposit flow
  decimals: number; // Token decimals for correct amount formatting
  vaultName: string;
  allocation: number;
  expectedApy: number;
  riskLevel: RiskTolerance;
  reasoning: string;
  productType?: 'bonzo-lend' | 'bonzo-vault';
  vaultType?: string;
}

export interface UserIntent {
  rawMessage: string;
  riskTolerance: RiskTolerance;
  targetAmount: number;
  tokenSymbol: string;
  preferences: string[];
  sessionId: string;
}

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

export interface ChatResponse {
  message: string;
  agentStates: AgentState[];
  strategy?: Strategy;
  decisions: DecisionLog[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentStates?: AgentState[];
  strategy?: Strategy;
  decisions?: DecisionLog[];
}
