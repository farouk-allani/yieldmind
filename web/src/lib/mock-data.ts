import type {
  AgentState,
  DecisionLog,
  VaultInfo,
  Strategy,
  ChatResponse,
} from './types';

// ============================================================
// Mock data for graceful degradation when agent backend is down
// ============================================================

export const MOCK_VAULTS: VaultInfo[] = [
  {
    address: '0.0.1001',
    name: 'HBAR-USDC Stable Yield',
    tokenPair: 'HBAR/USDC',
    apy: 8.5,
    tvl: 2_450_000,
    riskLevel: 'conservative',
    liquidityDepth: 1_800_000,
    lastHarvest: new Date(Date.now() - 3600_000).toISOString(),
    rewardToken: 'HBAR',
  },
  {
    address: '0.0.1002',
    name: 'HBAR-HBARX Growth',
    tokenPair: 'HBAR/HBARX',
    apy: 15.2,
    tvl: 1_200_000,
    riskLevel: 'moderate',
    liquidityDepth: 900_000,
    lastHarvest: new Date(Date.now() - 7200_000).toISOString(),
    rewardToken: 'HBARX',
  },
  {
    address: '0.0.1003',
    name: 'SAUCE-USDC LP',
    tokenPair: 'SAUCE/USDC',
    apy: 24.7,
    tvl: 680_000,
    riskLevel: 'aggressive',
    liquidityDepth: 420_000,
    lastHarvest: new Date(Date.now() - 1800_000).toISOString(),
    rewardToken: 'SAUCE',
  },
  {
    address: '0.0.1004',
    name: 'HBAR-KARATE Momentum',
    tokenPair: 'HBAR/KARATE',
    apy: 32.1,
    tvl: 340_000,
    riskLevel: 'aggressive',
    liquidityDepth: 210_000,
    lastHarvest: new Date(Date.now() - 5400_000).toISOString(),
    rewardToken: 'KARATE',
  },
  {
    address: '0.0.1005',
    name: 'USDC-USDT Safe Harbor',
    tokenPair: 'USDC/USDT',
    apy: 4.2,
    tvl: 5_100_000,
    riskLevel: 'conservative',
    liquidityDepth: 4_800_000,
    lastHarvest: new Date(Date.now() - 900_000).toISOString(),
    rewardToken: 'USDC',
  },
];

export function createMockAgentStates(): AgentState[] {
  return [
    {
      id: 'scout-001',
      role: 'scout',
      status: 'idle',
      lastAction: null,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'strategist-001',
      role: 'strategist',
      status: 'idle',
      lastAction: null,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'executor-001',
      role: 'executor',
      status: 'idle',
      lastAction: null,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'sentinel-001',
      role: 'sentinel',
      status: 'idle',
      lastAction: null,
      lastUpdate: new Date().toISOString(),
    },
  ];
}

const sessionDecisions: Map<string, DecisionLog[]> = new Map();

export function getMockDecisions(sessionId: string): DecisionLog[] {
  return sessionDecisions.get(sessionId) ?? [];
}

export function createMockChatResponse(
  message: string,
  sessionId: string
): ChatResponse {
  const lower = message.toLowerCase();

  // Detect risk tolerance
  let risk: 'conservative' | 'moderate' | 'aggressive' = 'moderate';
  if (lower.includes('safe') || lower.includes('low risk') || lower.includes('conservative')) {
    risk = 'conservative';
  } else if (lower.includes('aggressive') || lower.includes('max') || lower.includes('high yield')) {
    risk = 'aggressive';
  }

  // Filter vaults by risk
  const matchingVaults = MOCK_VAULTS.filter((v) => {
    if (risk === 'conservative') return v.riskLevel === 'conservative';
    if (risk === 'aggressive') return true;
    return v.riskLevel !== 'aggressive';
  });

  const topVaults = matchingVaults.slice(0, 3);

  const now = new Date().toISOString();

  // Scout decision
  const scoutDecision: DecisionLog = {
    agentId: 'scout-001',
    agentRole: 'scout',
    action: 'vault-scan',
    reasoning: `Scanned ${MOCK_VAULTS.length} Bonzo Vaults. Filtered for ${risk} risk tolerance. Found ${topVaults.length} matching vaults with APY ranging from ${Math.min(...topVaults.map((v) => v.apy)).toFixed(1)}% to ${Math.max(...topVaults.map((v) => v.apy)).toFixed(1)}%.`,
    confidence: 0.92,
    timestamp: now,
    sessionId,
    data: { vaultsScanned: MOCK_VAULTS.length, matchingVaults: topVaults },
  };

  // Build strategy
  const allocations =
    risk === 'conservative'
      ? [70, 30]
      : risk === 'aggressive'
        ? [50, 30, 20]
        : [50, 30, 20];

  const strategyVaults = topVaults.slice(0, allocations.length).map((v, i) => ({
    vaultAddress: v.address,
    vaultName: v.name,
    allocation: allocations[i],
    expectedApy: v.apy,
    riskLevel: v.riskLevel,
    reasoning: `Selected ${v.name} for ${allocations[i]}% allocation — ${v.apy}% APY with ${v.riskLevel} risk and $${(v.tvl / 1_000_000).toFixed(1)}M TVL.`,
  }));

  const totalApy =
    strategyVaults.reduce(
      (sum, v) => sum + v.expectedApy * (v.allocation / 100),
      0
    );

  const strategy: Strategy = {
    id: `strategy-${Date.now()}`,
    sessionId,
    vaults: strategyVaults,
    totalExpectedApy: totalApy,
    overallRisk: risk,
    createdAt: now,
    status: 'proposed',
  };

  // Strategist decision
  const strategistDecision: DecisionLog = {
    agentId: 'strategist-001',
    agentRole: 'strategist',
    action: 'strategy-proposed',
    reasoning: `Built a ${risk} strategy across ${strategyVaults.length} vaults. Expected blended APY: ${totalApy.toFixed(1)}%. Strategy prioritizes ${risk === 'conservative' ? 'capital preservation with stable pairs' : risk === 'aggressive' ? 'maximum yield with higher volatility tolerance' : 'balanced risk-reward across diversified vaults'}.`,
    confidence: 0.87,
    timestamp: now,
    sessionId,
    data: { strategy },
  };

  const decisions = [scoutDecision, strategistDecision];

  // Store for decision history
  const existing = sessionDecisions.get(sessionId) ?? [];
  sessionDecisions.set(sessionId, [...existing, ...decisions]);

  const vaultSummaries = strategyVaults
    .map(
      (v) =>
        `• **${v.vaultName}**: ${v.allocation}% allocation, ~${v.expectedApy.toFixed(1)}% APY (${v.riskLevel} risk)`
    )
    .join('\n');

  const responseMessage = [
    `Here's my recommended strategy (confidence: ${(strategistDecision.confidence * 100).toFixed(0)}%):`,
    '',
    vaultSummaries,
    '',
    `**Overall expected APY:** ~${totalApy.toFixed(1)}%`,
    `**Risk level:** ${risk}`,
    '',
    `**Agent reasoning:** ${strategistDecision.reasoning}`,
    '',
    'Shall I execute this strategy? All decisions will be logged on-chain via Hedera Consensus Service.',
  ].join('\n');

  const agentStates = createMockAgentStates();
  agentStates[0].status = 'idle';
  agentStates[0].lastAction = 'vault-scan';
  agentStates[1].status = 'idle';
  agentStates[1].lastAction = 'strategy-proposed';

  return {
    message: responseMessage,
    agentStates,
    strategy,
    decisions,
  };
}

export function createMockExecuteResponse(
  sessionId: string
): ChatResponse {
  const now = new Date().toISOString();

  const decision: DecisionLog = {
    agentId: 'executor-001',
    agentRole: 'executor',
    action: 'deposit',
    reasoning:
      'Executed vault deposits according to approved strategy. Performed HBAR transfers on Hedera Testnet as proof-of-concept. Full Bonzo Vault contract integration pending testnet availability.',
    confidence: 0.95,
    timestamp: now,
    sessionId,
    data: {
      success: true,
      transactionId: '0.0.12345@1708123456.789',
      hashscanUrl: 'https://hashscan.io/testnet/transaction/0.0.12345@1708123456.789',
    },
  };

  const sentinelDecision: DecisionLog = {
    agentId: 'sentinel-001',
    agentRole: 'sentinel',
    action: 'monitoring-started',
    reasoning:
      'Initiated position monitoring. Watching HBAR, USDC price feeds for >8% movement (warning) and >15% movement (critical alert). Will trigger rebalance signals if thresholds are breached.',
    confidence: 0.9,
    timestamp: now,
    sessionId,
    data: { monitoredTokens: ['HBAR', 'USDC'], alertThresholds: { warning: 0.08, critical: 0.15 } },
  };

  const decisions = [decision, sentinelDecision];
  const existing = sessionDecisions.get(sessionId) ?? [];
  sessionDecisions.set(sessionId, [...existing, ...decisions]);

  const agentStates = createMockAgentStates();
  agentStates[2].status = 'idle';
  agentStates[2].lastAction = 'deposit';
  agentStates[3].status = 'executing';
  agentStates[3].lastAction = 'monitoring-started';

  return {
    message: [
      'Strategy executed successfully!',
      '',
      `**Transaction:** ${decision.data.transactionId}`,
      `**View on HashScan:** ${decision.data.hashscanUrl}`,
      '',
      `**Agent reasoning:** ${decision.reasoning}`,
      '',
      'The Sentinel agent is now monitoring your position for market changes.',
    ].join('\n'),
    agentStates,
    decisions,
  };
}
