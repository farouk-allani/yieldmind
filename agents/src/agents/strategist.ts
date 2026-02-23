import { BaseAgent } from '../core/base-agent';
import type { HCSService } from '../hedera/hcs';
import type {
  DecisionLog,
  UserIntent,
  VaultInfo,
  Strategy,
  VaultStrategy,
  RiskTolerance,
} from '../types';

interface StrategistInput {
  intent: UserIntent;
  vaultScanResults: Record<string, unknown>;
}

/**
 * StrategistAgent — The brain of YieldMind.
 *
 * Takes user intent + scout's vault scan data, and produces an
 * optimal multi-vault strategy with allocation percentages.
 *
 * In production: uses LLM (Claude) for nuanced intent interpretation.
 * For MVP: rule-based strategy builder with clear reasoning.
 */
export class StrategistAgent extends BaseAgent {
  constructor(hcsService: HCSService) {
    super('strategist', hcsService);
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

      // Build strategy based on risk tolerance
      const strategy = this.buildStrategy(intent, topVaults);
      const reasoning = this.buildReasoning(intent, strategy);

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
   */
  private calculateAllocations(
    risk: RiskTolerance,
    vaults: (VaultInfo & { score: number })[]
  ): { vault: VaultInfo & { score: number }; allocation: number }[] {
    switch (risk) {
      case 'conservative': {
        // Single best conservative vault or split 70/30 with top 2
        const safe = vaults.filter((v) => v.riskLevel === 'conservative');
        const picks = safe.length > 0 ? safe.slice(0, 2) : vaults.slice(0, 1);
        if (picks.length === 1) return [{ vault: picks[0], allocation: 100 }];
        return [
          { vault: picks[0], allocation: 70 },
          { vault: picks[1], allocation: 30 },
        ];
      }

      case 'moderate': {
        // Spread across 2-3 vaults
        const picks = vaults.slice(0, 3);
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
        // Weight toward highest APY vaults
        const picks = vaults.slice(0, 3);
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

  private buildReasoning(intent: UserIntent, strategy: Strategy): string {
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
