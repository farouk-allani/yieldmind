import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { BonzoVaultClient } from '../bonzo/vault-client.js';
import type { BonzoVaultsClient } from '../bonzo/bonzo-vaults-client.js';
import { normalizeTokenSymbol } from '../bonzo/vault-client.js';
import type { DecisionLog, VaultInfo, BonzoVaultInfo, RiskTolerance } from '../types/index.js';

interface ScoutInput {
  riskTolerance: RiskTolerance;
  tokenSymbol: string;
}

/**
 * ScoutAgent — Scans Bonzo Finance products on Hedera.
 *
 * Scans both:
 * - Bonzo Lend: lending/borrowing reserves (supply APY)
 * - Bonzo Vaults: auto-compounding concentrated liquidity vaults (Single/Dual Asset DEX, Leveraged LST)
 *
 * Publishes findings to HCS for other agents to consume.
 */
export class ScoutAgent extends BaseAgent {
  private bonzoClient: BonzoVaultClient;
  private bonzoVaultsClient: BonzoVaultsClient | null;

  constructor(
    hcsService: HCSService,
    bonzoClient: BonzoVaultClient,
    bonzoVaultsClient?: BonzoVaultsClient
  ) {
    super('scout', hcsService);
    this.bonzoClient = bonzoClient;
    this.bonzoVaultsClient = bonzoVaultsClient || null;
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { riskTolerance, tokenSymbol } = input as ScoutInput;
    this.setStatus('thinking', 'Scanning Bonzo Lend reserves and Bonzo Vaults...');

    try {
      // Fetch data from both Bonzo Lend and Bonzo Vaults in parallel
      const [lendReserves, vaults] = await Promise.all([
        this.bonzoClient.getVaults(),
        this.bonzoVaultsClient?.getVaults() ?? Promise.resolve([]),
      ]);

      if (lendReserves.length === 0 && vaults.length === 0) {
        this.setStatus('error', 'No data available');
        return this.createDecision(
          'vault-scan-empty',
          'Could not fetch Bonzo data. The Bonzo API or Hedera Mirror Node may be unreachable.',
          0.1,
          '',
          { lendScanned: 0, vaultsScanned: 0, topResults: [] }
        );
      }

      // Score Bonzo Lend reserves
      const scoredLend = this.scoreVaults(lendReserves, riskTolerance, tokenSymbol);

      // Score Bonzo Vaults
      const scoredVaults = this.scoreBonzoVaults(vaults, riskTolerance, tokenSymbol);

      // Combine and rank all options
      // Ensure dual-asset vaults always get passed to the strategist
      // (they may score lower on risk match but have much higher APY)
      const topLend = scoredLend.slice(0, 3);
      const dualAssetAlways = scoredVaults.filter((v) => v.type === 'dual-asset-dex');
      const rest = scoredVaults.filter((v) => v.type !== 'dual-asset-dex').slice(0, 5);
      const topVaults = [...dualAssetAlways, ...rest.filter(
        (v) => !dualAssetAlways.some((d) => d.vaultAddress === v.vaultAddress)
      )];
      const reasoning = this.buildCombinedReasoning(topLend, topVaults, riskTolerance);

      const decision = this.createDecision(
        'vault-scan-complete',
        reasoning,
        (topLend.length > 0 || topVaults.length > 0) ? 0.85 : 0.3,
        '',
        {
          lendScanned: lendReserves.length,
          vaultsScanned: vaults.length,
          topLendReserves: topLend,
          topBonzoVaults: topVaults,
          filterCriteria: { riskTolerance, tokenSymbol },
          dataSource: 'bonzo-mainnet-live',
        }
      );

      await this.publishDecision('scout:vault-scan', decision);
      this.setStatus(
        'idle',
        `Found ${topLend.length} lending reserves + ${topVaults.length} vaults`
      );

      return decision;
    } catch (error) {
      this.setStatus('error', 'Vault scan failed');
      return this.createDecision(
        'vault-scan-failed',
        `Failed to scan vaults: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        '',
        { error: String(error) }
      );
    }
  }

  /**
   * Score vaults based on risk tolerance alignment, APY, and liquidity.
   * Higher score = better match for the user's intent.
   */
  private scoreVaults(
    vaults: VaultInfo[],
    riskTolerance: RiskTolerance,
    tokenSymbol: string
  ): (VaultInfo & { score: number })[] {
    const riskWeights: Record<RiskTolerance, Record<RiskTolerance, number>> = {
      conservative: { conservative: 1.0, moderate: 0.5, aggressive: 0.1 },
      moderate: { conservative: 0.6, moderate: 1.0, aggressive: 0.6 },
      aggressive: { conservative: 0.2, moderate: 0.6, aggressive: 1.0 },
    };

    // In Bonzo (Aave v2), each lending pool only accepts its own token.
    // USDC pool only accepts USDC, KARATE pool only accepts KARATE, etc.
    // HBAR → WHBAR: Bonzo wraps native HBAR to WHBAR for lending.
    const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
    const tokenMatched = vaults.filter(
      (v) => v.symbol.toUpperCase() === normalizedSymbol
    );

    // If no exact match, fall back to all vaults (strategist will explain)
    const candidates = tokenMatched.length > 0 ? tokenMatched : vaults;

    return candidates
      .map((vault) => {
        const riskScore = riskWeights[riskTolerance][vault.riskLevel] || 0.5;
        const apyScore = Math.min(vault.apy / 10, 1); // normalize (10% = max for lending)
        const liquidityScore = Math.min(vault.tvl / 1_000_000, 1);

        const score =
          riskScore * 0.4 + apyScore * 0.3 + liquidityScore * 0.2;

        return { ...vault, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Score Bonzo Vaults based on risk tolerance, deposit token match.
   */
  private scoreBonzoVaults(
    vaults: BonzoVaultInfo[],
    riskTolerance: RiskTolerance,
    tokenSymbol: string
  ): (BonzoVaultInfo & { score: number })[] {
    const riskWeights: Record<RiskTolerance, Record<RiskTolerance, number>> = {
      conservative: { conservative: 1.0, moderate: 0.5, aggressive: 0.1 },
      moderate: { conservative: 0.6, moderate: 1.0, aggressive: 0.6 },
      aggressive: { conservative: 0.2, moderate: 0.6, aggressive: 1.0 },
    };

    const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
    const displayNorm = normalizedSymbol === 'WHBAR' ? 'HBAR' : normalizedSymbol;

    return vaults
      .map((vault) => {
        const riskScore = riskWeights[riskTolerance][vault.riskLevel] || 0.5;
        // Boost score if user's token appears in the vault pair
        const depositUp = vault.depositToken.toUpperCase();
        const pairedUp = vault.pairedToken?.toUpperCase() || '';
        const tokenMatch =
          depositUp === displayNorm || depositUp === normalizedSymbol ||
          pairedUp === displayNorm || pairedUp === normalizedSymbol ||
          depositUp.includes(displayNorm) || depositUp.includes(normalizedSymbol)
            ? 1.0
            : 0.3;
        const score = riskScore * 0.4 + tokenMatch * 0.4 + 0.2;
        return { ...vault, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Build combined reasoning covering both Bonzo Lend and Bonzo Vaults.
   */
  private buildCombinedReasoning(
    topLend: (VaultInfo & { score: number })[],
    topVaults: (BonzoVaultInfo & { score: number })[],
    risk: RiskTolerance
  ): string {
    const parts: string[] = [];

    if (topLend.length > 0) {
      const best = topLend[0];
      const tvlStr =
        best.tvl >= 1_000_000
          ? `$${(best.tvl / 1_000_000).toFixed(2)}M`
          : `$${(best.tvl / 1000).toFixed(0)}K`;
      parts.push(
        `Bonzo Lend: Best lending reserve for ${risk} risk is ${best.name} ` +
        `at ${best.apy.toFixed(2)}% supply APY with ${tvlStr} TVL (score ${best.score.toFixed(2)}).`
      );
    }

    if (topVaults.length > 0) {
      const best = topVaults[0];
      const strategyLabel =
        best.type === 'single-asset-dex' ? 'Single Asset DEX' :
        best.type === 'dual-asset-dex' ? 'Dual Asset DEX' :
        'Leveraged LST';
      parts.push(
        `Bonzo Vaults: Best vault match is ${best.name} ` +
        `(${strategyLabel}, ${best.volatility} volatility). ` +
        `Deposit ${best.depositToken}${best.pairedToken ? ` paired with ${best.pairedToken}` : ''}. ` +
        `${topVaults.length > 1 ? `${topVaults.length - 1} other vaults also available.` : ''}`
      );
    }

    if (parts.length === 0) {
      return `Scanned Bonzo products but found no matches for ${risk} risk tolerance.`;
    }

    return `Scanned Bonzo Lend (${topLend.length} reserves) + Bonzo Vaults (${topVaults.length} vaults). ` +
      parts.join(' ');
  }

  /**
   * Build human-readable reasoning for the vault scan decision.
   * This gets published to HCS — it's what makes the AI transparent.
   */
  private buildReasoning(
    topVaults: (VaultInfo & { score: number })[],
    risk: RiskTolerance
  ): string {
    if (topVaults.length === 0) {
      return `Scanned Bonzo lending reserves but found no matches for ${risk} risk tolerance.`;
    }

    const best = topVaults[0];
    const tvlStr =
      best.tvl >= 1_000_000
        ? `$${(best.tvl / 1_000_000).toFixed(2)}M`
        : `$${(best.tvl / 1000).toFixed(0)}K`;

    return (
      `Scanned ${topVaults.length} Bonzo lending reserves (live mainnet data). ` +
      `Best match for ${risk} risk: ${best.name} ` +
      `at ${best.apy.toFixed(2)}% supply APY with ${tvlStr} TVL. ` +
      `Score: ${best.score.toFixed(2)}/1.0. ` +
      `${topVaults.length > 1 ? `${topVaults.length - 1} alternative reserves also viable.` : 'Only match found.'}`
    );
  }
}
