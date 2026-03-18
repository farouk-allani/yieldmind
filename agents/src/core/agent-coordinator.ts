import type {
  UserIntent,
  Strategy,
  DecisionLog,
  AgentState,
  ChatResponse,
  ExecutionConfirmation,
} from '../types/index.js';
import type { HCSService } from '../hedera/hcs.js';
import type { HederaClient } from '../hedera/client.js';
import { getNetworkConfig } from '../config/index.js';
import type { ScoutAgent } from '../agents/scout.js';
import type { StrategistAgent } from '../agents/strategist.js';
import type { ExecutorAgent } from '../agents/executor.js';
import type { SentinelAgent } from '../agents/sentinel.js';

interface CoordinatorDeps {
  hcsService: HCSService;
  hederaClient: HederaClient;
  scout: ScoutAgent;
  strategist: StrategistAgent;
  executor: ExecutorAgent;
  sentinel: SentinelAgent;
}

/**
 * AgentCoordinator — Orchestrates the agent network for a user session.
 *
 * Flow:
 * 1. User sends intent → Coordinator parses it
 * 2. Scout scans available vaults
 * 3. Strategist builds an optimal strategy
 * 4. User approves → Executor performs on-chain actions
 * 5. Sentinel monitors ongoing positions
 *
 * All coordination happens via HCS topics, creating a permanent
 * on-chain audit trail of every decision.
 */
export class AgentCoordinator {
  private hcsService: HCSService;
  private hederaClient: HederaClient;
  private scout: ScoutAgent;
  private strategist: StrategistAgent;
  private executor: ExecutorAgent;
  private sentinel: SentinelAgent;
  private sessions: Map<string, string> = new Map(); // sessionId -> topicId
  /** Per-session decision logs. Prevents cross-user data leakage. */
  private sessionDecisions: Map<string, DecisionLog[]> = new Map();
  /** Per-session last proposed strategy. */
  private sessionStrategies: Map<string, Strategy> = new Map();

  constructor(deps: CoordinatorDeps) {
    this.hcsService = deps.hcsService;
    this.hederaClient = deps.hederaClient;
    this.scout = deps.scout;
    this.strategist = deps.strategist;
    this.executor = deps.executor;
    this.sentinel = deps.sentinel;
  }

  /**
   * Initialize a new session — creates HCS topic and configures agents.
   * Reuses existing topic if session was already initialized.
   */
  async initSession(sessionId: string): Promise<string> {
    // Reuse existing session topic
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.setAgentTopics(existing);
      return existing;
    }

    const topicId = await this.hcsService.createSessionTopic(sessionId);
    this.sessions.set(sessionId, topicId);
    this.setAgentTopics(topicId);

    console.log(
      `[Coordinator] Session ${sessionId} initialized with HCS topic: ${topicId}`
    );
    return topicId;
  }

  private setAgentTopics(topicId: string) {
    this.scout.setTopic(topicId);
    this.strategist.setTopic(topicId);
    this.executor.setTopic(topicId);
    this.sentinel.setTopic(topicId);
  }

  /**
   * Process a user's yield intent through the full agent pipeline.
   *
   * Phase 1: Scout + Strategist (propose a strategy)
   * Phase 2: Executor (requires explicit user approval)
   */
  async processIntent(intent: UserIntent): Promise<ChatResponse> {
    const { sessionId } = intent;
    if (!this.sessions.has(sessionId)) {
      await this.initSession(sessionId);
    }

    const decisions = this.getOrCreateSessionDecisions(sessionId);

    // Phase 1: Scout scans vaults
    const scoutDecision = await this.scout.execute({
      riskTolerance: intent.riskTolerance,
      tokenSymbol: intent.tokenSymbol,
    });
    decisions.push(scoutDecision);

    // Phase 2: Strategist builds strategy from scout data + user intent
    const strategistDecision = await this.strategist.execute({
      intent,
      vaultScanResults: scoutDecision.data,
    });
    decisions.push(strategistDecision);

    const strategy = strategistDecision.data.strategy as Strategy | undefined;
    if (strategy) {
      this.sessionStrategies.set(sessionId, strategy);
    }

    return {
      message: this.formatStrategyMessage(strategistDecision, strategy),
      agentStates: this.getAgentStates(),
      strategy: strategy,
      decisions: decisions.slice(-5),
    };
  }

  /**
   * Queue an approved strategy for user-signed on-chain execution.
   * Logs the approval intent to HCS; actual deposit happens via MetaMask.
   */
  async executeStrategy(
    strategy: Strategy,
    sessionId: string
  ): Promise<ChatResponse> {
    const decisions = this.getOrCreateSessionDecisions(sessionId);

    const executorDecision = await this.executor.execute({
      strategy,
      sessionId,
    });
    decisions.push(executorDecision);

    // Start sentinel monitoring in background
    this.sentinel.execute({ strategy, sessionId })
      .then((sentinelDecision: DecisionLog) => {
        decisions.push(sentinelDecision);
      })
      .catch(() => {/* non-critical */});

    return {
      message: this.formatExecutionMessage(executorDecision),
      agentStates: this.getAgentStates(),
      strategy: { ...strategy, status: 'proposed' },
      decisions: decisions.slice(-5),
    };
  }

  /**
   * Confirm a user-signed deposit from MetaMask.
   * Verifies the transaction, publishes to HCS, starts sentinel monitoring.
   */
  async confirmExecution(
    confirmation: ExecutionConfirmation
  ): Promise<ChatResponse> {
    const { sessionId } = confirmation;
    if (!this.sessions.has(sessionId)) {
      await this.initSession(sessionId);
    }

    const decisions = this.getOrCreateSessionDecisions(sessionId);

    // Step 1: Verify the transaction via Mirror Node.
    // Use the mirror node that matches the EVM network MetaMask signed on.
    const evmMirrorUrl = confirmation.evmNetwork === 'testnet'
      ? 'https://testnet.mirrornode.hedera.com'
      : 'https://mainnet.mirrornode.hedera.com';
    const verification = await this.hederaClient.verifyEvmTransaction(
      confirmation.txHash,
      evmMirrorUrl
    );

    // Step 2: Executor confirms and publishes to HCS
    const executorDecision = await this.executor.confirmDeposit(
      confirmation,
      verification.verified
    );
    decisions.push(executorDecision);

    // Step 3: Start sentinel monitoring if we have a strategy for this session
    const strategy = this.sessionStrategies.get(sessionId) ?? null;
    if (strategy && verification.verified) {
      this.sentinel
        .execute({ strategy, sessionId })
        .then((sentinelDecision) => {
          decisions.push(sentinelDecision);
        })
        .catch(() => {/* non-critical */});
    }

    // Use the EVM network the MetaMask tx was signed on (testnet or mainnet).
    // Falls back to the HCS/Hedera network if not provided.
    const evmHashscanBase = confirmation.evmNetwork
      ? `https://hashscan.io/${confirmation.evmNetwork}`
      : getNetworkConfig().hashscanBaseUrl;
    const hashscanUrl = `${evmHashscanBase}/transaction/${confirmation.txHash}`;

    const message = verification.verified
      ? [
          'Deposit confirmed on-chain!',
          '',
          `**Amount:** ${confirmation.depositAmount} ${confirmation.tokenSymbol || 'HBAR'}`,
          `**From:** ${confirmation.userAddress}`,
          `**To:** YieldMindVault contract`,
          `**Transaction:** ${hashscanUrl}`,
          '',
          `**Agent reasoning:** ${executorDecision.reasoning}`,
          '',
          'The Sentinel agent is now monitoring your position for market changes.',
        ].join('\n')
      : [
          'Deposit transaction submitted. Verification pending.',
          '',
          `**Transaction:** ${hashscanUrl}`,
          '',
          'Mirror Node may take a few seconds to index the transaction. ' +
            'Your deposit has been recorded and the Sentinel agent will begin monitoring once confirmed.',
        ].join('\n');

    return {
      message,
      agentStates: this.getAgentStates(),
      strategy: strategy
        ? { ...strategy, status: verification.verified ? 'active' : 'executing' }
        : undefined,
      decisions: decisions.slice(-5),
    };
  }

  /**
   * Get all agent states for dashboard display
   */
  getAgentStates(): AgentState[] {
    return [
      this.scout.getState(),
      this.strategist.getState(),
      this.executor.getState(),
      this.sentinel.getState(),
    ];
  }

  /**
   * Get the last proposed strategy for a specific session.
   */
  getLastStrategy(sessionId: string): Strategy | null {
    return this.sessionStrategies.get(sessionId) ?? null;
  }

  /**
   * Get decision history for a specific session.
   * If no sessionId given, returns all decisions across all sessions (for the dashboard).
   */
  getDecisionHistory(sessionId?: string): DecisionLog[] {
    if (sessionId) {
      return [...(this.sessionDecisions.get(sessionId) ?? [])];
    }
    // Flatten all sessions — used by /api/decisions which is session-agnostic
    const all: DecisionLog[] = [];
    for (const decisions of this.sessionDecisions.values()) {
      all.push(...decisions);
    }
    return all;
  }

  private getOrCreateSessionDecisions(sessionId: string): DecisionLog[] {
    if (!this.sessionDecisions.has(sessionId)) {
      this.sessionDecisions.set(sessionId, []);
    }
    return this.sessionDecisions.get(sessionId)!;
  }

  private formatStrategyMessage(
    decision: DecisionLog,
    strategy?: Strategy
  ): string {
    if (!strategy) {
      return `I analyzed the available vaults but couldn't find a suitable strategy for your intent. ${decision.reasoning}`;
    }

    const executable = strategy.vaults.filter(
      (v: { allocation: number }) => v.allocation > 0
    );
    const recommendations = strategy.vaults.filter(
      (v: { allocation: number }) => v.allocation === 0
    );

    const execSummaries = executable
      .map(
        (v: { vaultName: string; allocation: number; expectedApy: number; riskLevel: string }) =>
          `• ${v.vaultName}: ${v.allocation}% allocation, ~${v.expectedApy.toFixed(1)}% APY (${v.riskLevel} risk)`
      )
      .join('\n');

    const recSummaries = recommendations
      .map(
        (v: { vaultName: string; expectedApy: number; riskLevel: string }) =>
          `• ${v.vaultName}: ${v.expectedApy.toFixed(1)}% APY (${v.riskLevel} risk) — deposit at app.bonzo.finance/vaults`
      )
      .join('\n');

    const lines = [
      `Here's my recommended strategy (confidence: ${(decision.confidence * 100).toFixed(0)}%):`,
      '',
      execSummaries,
    ];

    if (recSummaries) {
      lines.push('', '**Higher APY vault opportunities** (require both tokens):', recSummaries);
    }

    lines.push(
      '',
      `Overall expected APY: ~${strategy.totalExpectedApy.toFixed(1)}%`,
      `Risk level: ${strategy.overallRisk}`,
      '',
      `**Agent reasoning:** ${decision.reasoning}`,
      '',
      'Shall I execute this strategy? All decisions will be logged on-chain via Hedera Consensus Service.',
    );

    return lines.join('\n');
  }

  private formatExecutionMessage(decision: DecisionLog): string {
    if (decision.data.awaitingSignature) {
      return [
        'Strategy queued for execution. Waiting for your wallet signature.',
        '',
        `**Agent reasoning:** ${decision.reasoning}`,
        '',
        'Please sign the transaction in your wallet (MetaMask) to deposit into Bonzo Finance.',
        'The Executor agent will verify and log the transaction once confirmed on-chain.',
      ].join('\n');
    }

    return `❌ Execution error: ${decision.data.error}\n\n**Agent reasoning:** ${decision.reasoning}`;
  }
}
