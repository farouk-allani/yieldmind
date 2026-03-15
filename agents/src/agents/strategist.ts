import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { LLMClient } from '../core/llm-client.js';
import type {
  DecisionLog,
  UserIntent,
  VaultInfo,
  BonzoVaultInfo,
  Strategy,
  VaultStrategy,
  RiskTolerance,
} from '../types/index.js';

interface StrategistInput {
  intent: UserIntent;
  vaultScanResults: Record<string, unknown>;
}

const STRATEGIST_PROMPT = `You are YieldMind's DeFi Strategist AI running on Hedera. You analyze data from Bonzo Finance (both Bonzo Lend lending pools AND Bonzo Vaults auto-compounding concentrated liquidity vaults) to build optimal yield strategies.

Given the user's intent and available options, explain your strategy reasoning in 2-3 sentences. Be specific about WHY you chose these allocations across Bonzo Lend and Bonzo Vaults. Mention concrete data: APY rates, strategy types (Single Asset DEX, Dual Asset DEX), risk levels. Explain the benefit of combining lending yield with vault auto-compounding. Your reasoning will be published on-chain via Hedera Consensus Service for full transparency.

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
      // Support both old format (topVaults) and new format (topLendReserves + topBonzoVaults)
      const lendReserves = (vaultScanResults.topLendReserves || []) as (VaultInfo & { score: number })[];
      const bonzoVaults = (vaultScanResults.topBonzoVaults || []) as (BonzoVaultInfo & { score: number })[];

      // Fall back to old format if neither new field exists
      const legacyVaults = (vaultScanResults.topVaults || []) as (VaultInfo & { score: number })[];

      const hasNewData = lendReserves.length > 0 || bonzoVaults.length > 0;
      const topVaults = hasNewData ? lendReserves : legacyVaults;

      if (topVaults.length === 0 && bonzoVaults.length === 0) {
        this.setStatus('idle', 'No vaults available');
        return this.createDecision(
          'no-strategy',
          'Unable to build a strategy — no suitable vaults found by Scout. The user may need to adjust their risk tolerance or token preference.',
          0.1,
          intent.sessionId,
          { strategy: null }
        );
      }

      // Build strategy that combines Bonzo Lend + Bonzo Vaults
      const strategy = this.buildCombinedStrategy(intent, topVaults, bonzoVaults);

      // LLM-powered reasoning (transparent AI differentiator)
      const reasoning = await this.generateReasoning(
        intent,
        strategy,
        [...lendReserves, ...bonzoVaults.map((v) => ({
          address: v.vaultAddress,
          evmAddress: v.vaultAddress,
          symbol: v.depositToken,
          decimals: v.depositDecimals,
          name: v.name,
          tokenPair: v.pairedToken ? `${v.depositToken}/${v.pairedToken}` : v.depositToken,
          apy: v.apy,
          tvl: v.tvl,
          riskLevel: v.riskLevel,
          liquidityDepth: 0,
          lastHarvest: new Date().toISOString(),
          rewardToken: v.depositToken,
          score: v.score,
        }))] as (VaultInfo & { score: number })[]
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
   * Build a combined strategy from Bonzo Lend reserves + Bonzo Vaults.
   *
   * The strategy always tries to include BOTH product types:
   * - Bonzo Lend: base yield layer (lending APY, lower risk)
   * - Bonzo Vaults: enhanced yield layer (auto-compounding concentrated liquidity)
   *
   * Allocation split depends on risk tolerance:
   * - Conservative: 70% Lend + 30% Vault (or 100% Lend if no vault match)
   * - Moderate: 40% Lend + 60% Vault
   * - Aggressive: 20% Lend + 80% Vault (or 100% Vault)
   */
  private buildCombinedStrategy(
    intent: UserIntent,
    lendReserves: (VaultInfo & { score: number })[],
    bonzoVaults: (BonzoVaultInfo & { score: number })[]
  ): Strategy {
    const vaultStrategies: VaultStrategy[] = [];
    const bestLend = lendReserves[0] || null;
    const bestVault = bonzoVaults[0] || null;

    // Determine allocation split based on risk tolerance
    if (bestLend && bestVault) {
      const { lendPct, vaultPct } = this.getAllocationSplit(intent.riskTolerance);

      vaultStrategies.push({
        vaultAddress: bestLend.address,
        assetEvmAddress: bestLend.evmAddress,
        symbol: bestLend.symbol,
        decimals: bestLend.decimals,
        vaultName: bestLend.name,
        allocation: lendPct,
        expectedApy: bestLend.apy * (lendPct / 100),
        riskLevel: bestLend.riskLevel,
        reasoning: `Allocated ${lendPct}% to Bonzo Lend — ${bestLend.tokenPair} at ${bestLend.apy.toFixed(1)}% supply APY, ${bestLend.riskLevel} risk`,
        productType: 'bonzo-lend',
      });

      vaultStrategies.push({
        vaultAddress: bestVault.vaultAddress,
        assetEvmAddress: bestVault.vaultAddress,
        symbol: bestVault.depositToken,
        decimals: bestVault.depositDecimals,
        vaultName: bestVault.name,
        allocation: vaultPct,
        expectedApy: bestVault.apy * (vaultPct / 100),
        riskLevel: bestVault.riskLevel,
        reasoning: `Allocated ${vaultPct}% to Bonzo Vault — ${bestVault.depositToken}${bestVault.pairedToken ? '/' + bestVault.pairedToken : ''} (${bestVault.type}) at ${bestVault.apy.toFixed(1)}% APY, auto-compounding concentrated liquidity on SaucerSwap`,
        productType: 'bonzo-vault',
        vaultType: bestVault.type,
      });

      // Add a second vault option for moderate/aggressive
      if (intent.riskTolerance !== 'conservative' && bonzoVaults.length > 1) {
        const secondVault = bonzoVaults[1];
        // Split the vault allocation: 60/40 between first and second vault
        const firstVaultPct = Math.round(vaultPct * 0.6);
        const secondVaultPct = vaultPct - firstVaultPct;
        vaultStrategies[1].allocation = firstVaultPct;
        vaultStrategies[1].expectedApy = bestVault.apy * (firstVaultPct / 100);
        vaultStrategies[1].reasoning = `Allocated ${firstVaultPct}% to Bonzo Vault — ${bestVault.depositToken}${bestVault.pairedToken ? '/' + bestVault.pairedToken : ''} (${bestVault.type}) at ${bestVault.apy.toFixed(1)}% APY, auto-compounding concentrated liquidity`;

        vaultStrategies.push({
          vaultAddress: secondVault.vaultAddress,
          assetEvmAddress: secondVault.vaultAddress,
          symbol: secondVault.depositToken,
          decimals: secondVault.depositDecimals,
          vaultName: secondVault.name,
          allocation: secondVaultPct,
          expectedApy: secondVault.apy * (secondVaultPct / 100),
          riskLevel: secondVault.riskLevel,
          reasoning: `Allocated ${secondVaultPct}% to Bonzo Vault — ${secondVault.depositToken}${secondVault.pairedToken ? '/' + secondVault.pairedToken : ''} (${secondVault.type}) at ${secondVault.apy.toFixed(1)}% APY, diversified vault position`,
          productType: 'bonzo-vault',
          vaultType: secondVault.type,
        });
      }
    } else if (bestLend) {
      // Only Lend available
      vaultStrategies.push({
        vaultAddress: bestLend.address,
        assetEvmAddress: bestLend.evmAddress,
        symbol: bestLend.symbol,
        decimals: bestLend.decimals,
        vaultName: bestLend.name,
        allocation: 100,
        expectedApy: bestLend.apy,
        riskLevel: bestLend.riskLevel,
        reasoning: `Allocated 100% to Bonzo Lend — ${bestLend.tokenPair} at ${bestLend.apy.toFixed(1)}% supply APY`,
        productType: 'bonzo-lend',
      });
    } else if (bestVault) {
      // Only Vault available
      vaultStrategies.push({
        vaultAddress: bestVault.vaultAddress,
        assetEvmAddress: bestVault.vaultAddress,
        symbol: bestVault.depositToken,
        decimals: bestVault.depositDecimals,
        vaultName: bestVault.name,
        allocation: 100,
        expectedApy: bestVault.apy,
        riskLevel: bestVault.riskLevel,
        reasoning: `Allocated 100% to Bonzo Vault — ${bestVault.depositToken}${bestVault.pairedToken ? '/' + bestVault.pairedToken : ''} at ${bestVault.apy.toFixed(1)}% APY, auto-compounding concentrated liquidity`,
        productType: 'bonzo-vault',
        vaultType: bestVault.type,
      });
    }

    const totalApy = vaultStrategies.reduce((sum, v) => sum + v.expectedApy, 0);

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
   * Get Lend/Vault allocation split based on risk tolerance.
   */
  private getAllocationSplit(risk: RiskTolerance): { lendPct: number; vaultPct: number } {
    switch (risk) {
      case 'conservative': return { lendPct: 70, vaultPct: 30 };
      case 'moderate':     return { lendPct: 40, vaultPct: 60 };
      case 'aggressive':   return { lendPct: 20, vaultPct: 80 };
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
