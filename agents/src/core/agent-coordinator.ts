import { v4 as uuidv4 } from 'uuid';
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
  private decisions: DecisionLog[] = [];
  private lastStrategy: Strategy | null = null;

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
    if (!this.sessions.has(intent.sessionId)) {
      await this.initSession(intent.sessionId);
    }

    // Phase 1: Scout scans vaults
    const scoutDecision = await this.scout.execute({
      riskTolerance: intent.riskTolerance,
      tokenSymbol: intent.tokenSymbol,
    });
    this.decisions.push(scoutDecision);

    // Phase 2: Strategist builds strategy from scout data + user intent
    const strategistDecision = await this.strategist.execute({
      intent,
      vaultScanResults: scoutDecision.data,
    });
    this.decisions.push(strategistDecision);

    const strategy = strategistDecision.data.strategy as Strategy | undefined;
    if (strategy) {
      this.lastStrategy = strategy;
    }

    return {
      message: this.formatStrategyMessage(strategistDecision, strategy),
      agentStates: this.getAgentStates(),
      strategy: strategy,
      decisions: this.decisions.slice(-5), // Return last 5 decisions
    };
  }

  /**
   * Execute an approved strategy — deposits into vaults
   */
  async executeStrategy(
    strategy: Strategy,
    sessionId: string
  ): Promise<ChatResponse> {
    const executorDecision = await this.executor.execute({
      strategy,
      sessionId,
    });
    this.decisions.push(executorDecision);

    // Start sentinel monitoring after execution
    this.sentinel.execute({
      strategy,
      sessionId,
    }).then((sentinelDecision: DecisionLog) => {
      this.decisions.push(sentinelDecision);
    });

    return {
      message: this.formatExecutionMessage(executorDecision),
      agentStates: this.getAgentStates(),
      strategy: {
        ...strategy,
        status: executorDecision.data.success ? 'active' : 'proposed',
      },
      decisions: this.decisions.slice(-5),
    };
  }

  /**
   * Confirm a user-signed deposit from MetaMask.
   * Verifies the transaction, publishes to HCS, starts sentinel monitoring.
   */
  async confirmExecution(
    confirmation: ExecutionConfirmation
  ): Promise<ChatResponse> {
    if (!this.sessions.has(confirmation.sessionId)) {
      await this.initSession(confirmation.sessionId);
    }

    // Step 1: Verify the transaction via Mirror Node
    const verification = await this.hederaClient.verifyEvmTransaction(
      confirmation.txHash
    );

    // Step 2: Executor confirms and publishes to HCS
    const executorDecision = await this.executor.confirmDeposit(
      confirmation,
      verification.verified
    );
    this.decisions.push(executorDecision);

    // Step 3: Start sentinel monitoring if we have a strategy
    const strategy = this.lastStrategy;
    if (strategy && verification.verified) {
      this.sentinel
        .execute({ strategy, sessionId: confirmation.sessionId })
        .then((sentinelDecision) => {
          this.decisions.push(sentinelDecision);
        });
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
      decisions: this.decisions.slice(-5),
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
   * Get the last proposed strategy (for execute flow)
   */
  getLastStrategy(): Strategy | null {
    return this.lastStrategy;
  }

  /**
   * Get full decision history for the session
   */
  getDecisionHistory(): DecisionLog[] {
    return [...this.decisions];
  }

  private formatStrategyMessage(
    decision: DecisionLog,
    strategy?: Strategy
  ): string {
    if (!strategy) {
      return `I analyzed the available vaults but couldn't find a suitable strategy for your intent. ${decision.reasoning}`;
    }

    const vaultSummaries = strategy.vaults
      .map(
        (v: { vaultName: string; allocation: number; expectedApy: number; riskLevel: string }) =>
          `• ${v.vaultName}: ${v.allocation}% allocation, ~${v.expectedApy.toFixed(1)}% APY (${v.riskLevel} risk)`
      )
      .join('\n');

    return [
      `Here's my recommended strategy (confidence: ${(decision.confidence * 100).toFixed(0)}%):`,
      '',
      vaultSummaries,
      '',
      `Overall expected APY: ~${strategy.totalExpectedApy.toFixed(1)}%`,
      `Risk level: ${strategy.overallRisk}`,
      '',
      `**Agent reasoning:** ${decision.reasoning}`,
      '',
      'Shall I execute this strategy? All decisions will be logged on-chain via Hedera Consensus Service.',
    ].join('\n');
  }

  private formatExecutionMessage(decision: DecisionLog): string {
    if (decision.data.success) {
      return [
        '✅ Strategy executed successfully!',
        '',
        `Transaction: ${decision.data.transactionId}`,
        `View on HashScan: ${decision.data.hashscanUrl}`,
        '',
        `**Agent reasoning:** ${decision.reasoning}`,
        '',
        'The Sentinel agent is now monitoring your position for market changes.',
      ].join('\n');
    }

    return `❌ Execution failed: ${decision.data.error}\n\n**Agent reasoning:** ${decision.reasoning}`;
  }
}
