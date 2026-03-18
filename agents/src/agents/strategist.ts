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
   * Executable products (auto-deposited via wallet):
   * - Bonzo Lend: LendingPool.deposit / WETHGateway (HBAR, USDC, etc.)
   * - Single-asset Bonzo Vaults: vault.deposit(amount) with one token
   * - Dual-asset Bonzo Vaults: when user has BOTH tokens (secondaryToken set)
   *   Uses deposit(uint256,uint256,uint256) = (amount0, amount1, minShares)
   *
   * Recommended products (shown with link to Bonzo UI):
   * - Dual-asset Bonzo Vaults: when user has only one token.
   *   These are shown with allocation=0 as yield opportunities.
   */
  private buildCombinedStrategy(
    intent: UserIntent,
    lendReserves: (VaultInfo & { score: number })[],
    bonzoVaults: (BonzoVaultInfo & { score: number })[]
  ): Strategy {
    const vaultStrategies: VaultStrategy[] = [];

    // ── Dual-token intent: user has both tokens → direct vault deposit ──
    if (intent.secondaryToken) {
      return this.buildDualTokenStrategy(intent, bonzoVaults, lendReserves);
    }
    const bestLend = lendReserves[0] || null;

    // Separate single-asset vs dual-asset vaults
    const userToken = intent.tokenSymbol.toUpperCase();
    const matchTokens = userToken === 'HBAR' ? ['HBAR', 'WHBAR'] : [userToken];

    const singleAssetVaults = bonzoVaults.filter((v) => {
      if (v.type === 'dual-asset-dex') return false;
      const deposit = v.depositToken.toUpperCase();
      return matchTokens.some((t) => deposit.includes(t));
    });

    const dualAssetVaults = bonzoVaults.filter((v) => {
      if (v.type !== 'dual-asset-dex') return false;
      const deposit = v.depositToken.toUpperCase();
      const paired = v.pairedToken?.toUpperCase() || '';
      return matchTokens.some((t) => deposit.includes(t) || paired.includes(t));
    });

    singleAssetVaults.sort((a, b) => b.apy - a.apy);
    dualAssetVaults.sort((a, b) => b.apy - a.apy);

    const bestSingleVault = singleAssetVaults[0] || null;

    // ── Executable allocations ──
    if (bestLend && bestSingleVault) {
      // Split between Lend + single-asset vault
      const { lendPct, vaultPct } = this.getAllocationSplit(intent.riskTolerance);
      vaultStrategies.push({
        vaultAddress: bestLend.address,
        assetEvmAddress: bestLend.evmAddress,
        symbol: bestLend.symbol,
        decimals: bestLend.decimals,
        vaultName: bestLend.name,
        allocation: lendPct,
        expectedApy: bestLend.apy,
        riskLevel: bestLend.riskLevel,
        reasoning: `Allocated ${lendPct}% to Bonzo Lend — ${bestLend.tokenPair} at ${bestLend.apy.toFixed(2)}% supply APY.`,
        productType: 'bonzo-lend',
      });
      vaultStrategies.push({
        vaultAddress: bestSingleVault.vaultAddress,
        assetEvmAddress: bestSingleVault.vaultAddress,
        symbol: bestSingleVault.depositToken,
        decimals: bestSingleVault.depositDecimals,
        vaultName: bestSingleVault.name,
        allocation: vaultPct,
        expectedApy: bestSingleVault.apy,
        riskLevel: bestSingleVault.riskLevel,
        reasoning: `Allocated ${vaultPct}% to Bonzo Vault — ${bestSingleVault.depositToken} at ${bestSingleVault.apy.toFixed(1)}% APY. Auto-compounding single-asset vault.`,
        productType: 'bonzo-vault',
        vaultType: bestSingleVault.type,
      });
    } else if (bestLend) {
      // 100% to Lend (most common case — no single-asset vaults available)
      vaultStrategies.push({
        vaultAddress: bestLend.address,
        assetEvmAddress: bestLend.evmAddress,
        symbol: bestLend.symbol,
        decimals: bestLend.decimals,
        vaultName: bestLend.name,
        allocation: 100,
        expectedApy: bestLend.apy,
        riskLevel: bestLend.riskLevel,
        reasoning: `100% to Bonzo Lend — ${bestLend.tokenPair} at ${bestLend.apy.toFixed(2)}% supply APY. Auto-deposited via your wallet.`,
        productType: 'bonzo-lend',
      });
    } else if (bestSingleVault) {
      vaultStrategies.push({
        vaultAddress: bestSingleVault.vaultAddress,
        assetEvmAddress: bestSingleVault.vaultAddress,
        symbol: bestSingleVault.depositToken,
        decimals: bestSingleVault.depositDecimals,
        vaultName: bestSingleVault.name,
        allocation: 100,
        expectedApy: bestSingleVault.apy,
        riskLevel: bestSingleVault.riskLevel,
        reasoning: `100% to Bonzo Vault — ${bestSingleVault.depositToken} at ${bestSingleVault.apy.toFixed(1)}% APY.`,
        productType: 'bonzo-vault',
        vaultType: bestSingleVault.type,
      });
    }

    // ── Dual-asset vault recommendations (allocation=0, not auto-deposited) ──
    // These are shown as higher-APY yield opportunities with a link to Bonzo Vaults UI
    for (const dv of dualAssetVaults.slice(0, 2)) {
      vaultStrategies.push({
        vaultAddress: dv.vaultAddress,
        assetEvmAddress: dv.vaultAddress,
        symbol: dv.depositToken,
        decimals: dv.depositDecimals,
        vaultName: dv.name,
        allocation: 0, // recommendation only — requires both tokens
        expectedApy: dv.apy,
        riskLevel: dv.riskLevel,
        reasoning: `Bonzo Vault — ${dv.depositToken}${dv.pairedToken ? '/' + dv.pairedToken : ''} at ${dv.apy.toFixed(1)}% APY. Requires both tokens. Deposit at app.bonzo.finance/vaults.`,
        productType: 'bonzo-vault',
        vaultType: dv.type,
      });
    }

    // Calculate blended APY (only from executable allocations)
    const totalApy = vaultStrategies.reduce(
      (sum, v) => sum + (v.expectedApy * v.allocation / 100), 0
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
   * Build a strategy for dual-token intent (user has both tokens).
   * Routes 100% to the matching dual-asset vault.
   */
  private buildDualTokenStrategy(
    intent: UserIntent,
    bonzoVaults: (BonzoVaultInfo & { score: number })[],
    lendReserves: (VaultInfo & { score: number })[],
  ): Strategy {
    const vaultStrategies: VaultStrategy[] = [];

    // Find matching dual-asset vault (e.g., USDC-HBAR)
    const tokens = [intent.tokenSymbol.toUpperCase(), (intent.secondaryToken || '').toUpperCase()];
    // Normalize HBAR → WHBAR for matching
    const normalize = (t: string) => t === 'HBAR' ? 'WHBAR' : t;
    const normalizedTokens = tokens.map(normalize);

    const matchingVault = bonzoVaults.find((v) => {
      if (v.type !== 'dual-asset-dex') return false;
      const deposit = v.depositToken.toUpperCase();
      const parts = deposit.split('-');
      // Check if vault contains both user tokens
      const vaultTokens = parts.map(normalize);
      return normalizedTokens.every((t) =>
        vaultTokens.some((vt) => vt.includes(t) || t.includes(vt))
      );
    });

    if (matchingVault) {
      // Get vault asset info from API data
      // USDC-HBAR vault: asset0=USDC (6 dec), asset1=HBAR (8 dec)
      const asset0Symbol = matchingVault.depositToken.split('-')[0]; // USDC
      const asset1Symbol = matchingVault.pairedToken || matchingVault.depositToken.split('-')[1]; // HBAR

      // Determine which user token maps to asset0/asset1
      const isToken0Primary = asset0Symbol.toUpperCase() === intent.tokenSymbol.toUpperCase();
      const token0Amount = isToken0Primary ? intent.targetAmount : (intent.secondaryAmount || 0);
      const token1Amount = isToken0Primary ? (intent.secondaryAmount || 0) : intent.targetAmount;

      // Known addresses from Bonzo API
      const ASSET_INFO: Record<string, { address: string; decimals: number }> = {
        'USDC': { address: '0x000000000000000000000000000000000006f89a', decimals: 6 },
        'HBAR': { address: '0x0000000000000000000000000000000000163b5a', decimals: 8 },
        'WHBAR': { address: '0x0000000000000000000000000000000000163b5a', decimals: 8 },
        'SAUCE': { address: '0x00000000000000000000000000000000000b15c6', decimals: 6 },
        'BONZO': { address: '0x000000000000000000000000000000000083cef0', decimals: 8 },
      };

      // Known vault contract IDs
      const VAULT_IDS: Record<string, string> = {
        '0x724F19f52A3E0e9D2881587C997db93f9613B2C7': '0.0.10164469',  // USDC-HBAR
        '0xcfba07324bd207C3ED41416a9a36f8184F9a2134': '0.0.10164550',  // BONZO-XBONZO
        '0x8AEE31dFF6264074a1a3929432070E1605F6b783': '0.0.10164569',  // SAUCE-XSAUCE
        '0x0171baa37fC9f56c98bD56FEB32bC28342944C6e': '0.0.10164765',  // USDC-SAUCE
      };

      const a0 = ASSET_INFO[asset0Symbol.toUpperCase()] || { address: '', decimals: 8 };
      const a1 = ASSET_INFO[asset1Symbol.toUpperCase()] || { address: '', decimals: 8 };

      vaultStrategies.push({
        vaultAddress: matchingVault.vaultAddress,
        assetEvmAddress: matchingVault.vaultAddress,
        symbol: matchingVault.depositToken,
        decimals: matchingVault.depositDecimals,
        vaultName: matchingVault.name,
        allocation: 100,
        expectedApy: matchingVault.apy,
        riskLevel: matchingVault.riskLevel,
        reasoning: `100% to Bonzo Vault — ${matchingVault.name} at ${matchingVault.apy.toFixed(1)}% APY. Dual-token deposit: ${token0Amount} ${asset0Symbol} + ${token1Amount} ${asset1Symbol}. Auto-compounding concentrated liquidity on SaucerSwap.`,
        productType: 'bonzo-vault',
        vaultType: matchingVault.type,
        dualTokenDeposit: {
          token0Symbol: asset0Symbol,
          token0Address: a0.address,
          token0Decimals: a0.decimals,
          token0Amount,
          token1Symbol: asset1Symbol,
          token1Address: a1.address,
          token1Decimals: a1.decimals,
          token1Amount,
          depositSelector: '0x00aeef8a',
          vaultContractId: VAULT_IDS[matchingVault.vaultAddress] || '',
        },
      });
    } else {
      // No matching dual-asset vault — fall back to Lend
      const bestLend = lendReserves[0];
      if (bestLend) {
        vaultStrategies.push({
          vaultAddress: bestLend.address,
          assetEvmAddress: bestLend.evmAddress,
          symbol: bestLend.symbol,
          decimals: bestLend.decimals,
          vaultName: bestLend.name,
          allocation: 100,
          expectedApy: bestLend.apy,
          riskLevel: bestLend.riskLevel,
          reasoning: `No matching dual-asset vault found for ${tokens.join('+')}. Falling back to Bonzo Lend.`,
          productType: 'bonzo-lend',
        });
      }
    }

    const totalApy = vaultStrategies.reduce(
      (sum, v) => sum + (v.expectedApy * v.allocation / 100), 0
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
   * Get Lend/Vault allocation split based on risk tolerance.
   */
  private getAllocationSplit(risk: string): { lendPct: number; vaultPct: number } {
    switch (risk) {
      case 'conservative': return { lendPct: 70, vaultPct: 30 };
      case 'moderate':     return { lendPct: 40, vaultPct: 60 };
      case 'aggressive':   return { lendPct: 20, vaultPct: 80 };
      default:             return { lendPct: 50, vaultPct: 50 };
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
