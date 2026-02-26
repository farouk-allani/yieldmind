import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { LLMClient } from '../core/llm-client.js';
import type {
  DecisionLog,
  UserIntent,
  VaultInfo,
  Strategy,
  VaultStrategy,
  RiskTolerance,
} from '../types/index.js';

interface StrategistInput {
  intent: UserIntent;
  vaultScanResults: Record<string, unknown>;
}

const STRATEGIST_PROMPT = `You are YieldMind's DeFi Strategist AI running on Hedera. You analyze vault data from Bonzo Finance and build optimal yield strategies.

Given the user's intent and available vault data, explain your strategy reasoning in 2-3 sentences. Be specific about WHY you chose these vaults and allocations. Mention concrete data: APY rates, TVL, risk levels. Your reasoning will be published on-chain via Hedera Consensus Service for full transparency.

Respond with ONLY the reasoning text (no JSON, no markdown). Keep it under 200 words. Sound like a professional financial advisor, not an AI chatbot.`;

/**
 * StrategistAgent — The brain of YieldMind.
 *
 * Takes user intent + scout's vault scan data, and produces an
 * optimal multi-vault strategy with allocation percentages.
 *
 * Uses LLM (via OpenRouter) for nuanced strategy reasoning.
 * Rule-based allocation logic ensures deterministic, correct strategies.
 * LLM generates the human-readable reasoning published to HCS.
 */
export class StrategistAgent extends BaseAgent {
  private llmClient: LLMClient | null;

  constructor(hcsService: HCSService, llmClient: LLMClient | null = null) {
    super('strategist', hcsService);
    this.llmClient = llmClient;
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { intent, vaultScanResults } = input as StrategistInput;
    this.setStatus('thinking', 'Building optimal strategy...');

    try {
      const topVaults = (vaultScanResults.topVaults || []) as (VaultInfo & {
        score: number;
      })[];

      if (topVaults.length === 0) {
        this.setStatus('idle', 'No vaults available');
        return this.createDecision(
          'no-strategy',
          'Unable to build a strategy — no suitable vaults found by Scout. The user may need to adjust their risk tolerance or token preference.',
          0.1,
          intent.sessionId,
          { strategy: null }
        );
      }

      // Rule-based allocation (deterministic, always correct)
      const strategy = this.buildStrategy(intent, topVaults);

      // LLM-powered reasoning (transparent AI differentiator)
      const reasoning = await this.generateReasoning(
        intent,
        strategy,
        topVaults
      );

      const decision = this.createDecision(
        'strategy-proposed',
        reasoning,
        this.calculateConfidence(strategy),
        intent.sessionId,
        { strategy }
      );

      await this.publishDecision('strategist:strategy-proposed', decision);
      this.setStatus('idle', 'Strategy proposed');

      return decision;
    } catch (error) {
      this.setStatus('error', 'Strategy building failed');
      return this.createDecision(
        'strategy-failed',
        `Failed to build strategy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        intent.sessionId,
        { error: String(error) }
      );
    }
  }

  /**
   * Build a multi-vault allocation strategy based on user intent.
   *
   * Conservative: 1-2 vaults, heavily weighted to lowest risk
   * Moderate: 2-3 vaults, balanced allocation
   * Aggressive: 2-4 vaults, weighted toward highest APY
   */
  private buildStrategy(
    intent: UserIntent,
    vaults: (VaultInfo & { score: number })[]
  ): Strategy {
    const allocations = this.calculateAllocations(
      intent.riskTolerance,
      vaults
    );

    const vaultStrategies: VaultStrategy[] = allocations.map(
      ({ vault, allocation }) => ({
        vaultAddress: vault.address,
        assetEvmAddress: vault.evmAddress,
        symbol: vault.symbol,
        decimals: vault.decimals,
        vaultName: vault.name,
        allocation,
        expectedApy: vault.apy * (allocation / 100),
        riskLevel: vault.riskLevel,
        reasoning: `Allocated ${allocation}% — ${vault.tokenPair} at ${vault.apy.toFixed(1)}% APY, ${vault.riskLevel} risk, $${(vault.tvl / 1000).toFixed(0)}K TVL`,
      })
    );

    const totalApy = vaultStrategies.reduce(
      (sum, v) => sum + v.expectedApy,
      0
    );

    return {
      id: `strategy-${Date.now()}`,
      sessionId: intent.sessionId,
      userIntent: intent,
      vaults: vaultStrategies,
      totalExpectedApy: totalApy,
      overallRisk: intent.riskTolerance,
      createdAt: new Date().toISOString(),
      status: 'proposed',
    };
  }

  /**
   * Calculate vault allocations based on risk tolerance.
   * Returns empty array if no vaults available (caller handles this).
   */
  private calculateAllocations(
    risk: RiskTolerance,
    vaults: (VaultInfo & { score: number })[]
  ): { vault: VaultInfo & { score: number }; allocation: number }[] {
    if (vaults.length === 0) return [];

    switch (risk) {
      case 'conservative': {
        const safe = vaults.filter((v) => v.riskLevel === 'conservative');
        const picks = safe.length > 0 ? safe.slice(0, 2) : vaults.slice(0, 1);
        if (picks.length === 0) return [{ vault: vaults[0], allocation: 100 }];
        if (picks.length === 1) return [{ vault: picks[0], allocation: 100 }];
        return [
          { vault: picks[0], allocation: 70 },
          { vault: picks[1], allocation: 30 },
        ];
      }

      case 'moderate': {
        const picks = vaults.slice(0, 3);
        if (picks.length === 0) return [];
        if (picks.length === 1) return [{ vault: picks[0], allocation: 100 }];
        if (picks.length === 2) {
          return [
            { vault: picks[0], allocation: 60 },
            { vault: picks[1], allocation: 40 },
          ];
        }
        return [
          { vault: picks[0], allocation: 50 },
          { vault: picks[1], allocation: 30 },
          { vault: picks[2], allocation: 20 },
        ];
      }

      case 'aggressive': {
        const picks = vaults.slice(0, 3);
        if (picks.length === 0) return [];
        const sorted = [...picks].sort((a, b) => b.apy - a.apy);
        if (sorted.length === 1) return [{ vault: sorted[0], allocation: 100 }];
        if (sorted.length === 2) {
          return [
            { vault: sorted[0], allocation: 65 },
            { vault: sorted[1], allocation: 35 },
          ];
        }
        return [
          { vault: sorted[0], allocation: 50 },
          { vault: sorted[1], allocation: 30 },
          { vault: sorted[2], allocation: 20 },
        ];
      }
    }
  }

  private calculateConfidence(strategy: Strategy): number {
    const vaultCount = strategy.vaults.length;
    const apyReasonable = strategy.totalExpectedApy < 40; // >40% APY is suspicious
    const diversified = vaultCount >= 2;

    let confidence = 0.7;
    if (apyReasonable) confidence += 0.1;
    if (diversified) confidence += 0.1;
    if (vaultCount >= 3) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  /**
   * Generate strategy reasoning using LLM, with rule-based fallback.
   * The reasoning is published to HCS — this is the "transparent AI" value.
   */
  private async generateReasoning(
    intent: UserIntent,
    strategy: Strategy,
    vaults: (VaultInfo & { score: number })[]
  ): Promise<string> {
    if (this.llmClient) {
      try {
        const vaultSummary = strategy.vaults
          .map(
            (v) =>
              `${v.vaultName}: ${v.allocation}% allocation, ${v.expectedApy.toFixed(2)}% weighted APY, ${v.riskLevel} risk`
          )
          .join('\n');

        const availableVaults = vaults
          .slice(0, 5)
          .map(
            (v) =>
              `${v.name}: ${v.apy.toFixed(2)}% APY, $${(v.tvl / 1_000_000).toFixed(2)}M TVL, ${v.riskLevel} risk, score ${v.score.toFixed(2)}`
          )
          .join('\n');

        const userContext = `User request: "${intent.rawMessage}"
Risk tolerance: ${intent.riskTolerance}
Amount: ${intent.targetAmount} ${intent.tokenSymbol}

Available vaults (from Bonzo Finance, live mainnet data):
${availableVaults}

Chosen strategy (${strategy.vaults.length} vaults, ${strategy.totalExpectedApy.toFixed(2)}% blended APY):
${vaultSummary}`;

        const response = await this.llmClient.chat([
          { role: 'system', content: STRATEGIST_PROMPT },
          { role: 'user', content: userContext },
        ]);

        const reasoning = response.content.trim();
        if (reasoning.length > 20) {
          console.log('[Strategist] LLM reasoning generated successfully');
          return reasoning;
        }
      } catch (error) {
        console.log(
          '[Strategist] LLM reasoning failed, using rule-based:',
          error instanceof Error ? error.message : error
        );
      }
    }

    return this.buildFallbackReasoning(intent, strategy);
  }

  private buildFallbackReasoning(
    intent: UserIntent,
    strategy: Strategy
  ): string {
    const vaultNames = strategy.vaults
      .map((v) => `${v.vaultName} (${v.allocation}%)`)
      .join(', ');

    return (
      `User wants ${intent.riskTolerance} yield on ${intent.targetAmount} ${intent.tokenSymbol}. ` +
      `Proposed ${strategy.vaults.length}-vault strategy: ${vaultNames}. ` +
      `Expected blended APY: ${strategy.totalExpectedApy.toFixed(1)}%. ` +
      `Strategy prioritizes ${intent.riskTolerance === 'conservative' ? 'capital preservation with stable pairs' : intent.riskTolerance === 'moderate' ? 'balanced risk-reward across diversified positions' : 'maximum yield with higher volatility tolerance'}.`
    );
  }
}
