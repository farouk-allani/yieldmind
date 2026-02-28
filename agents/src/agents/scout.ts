import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { BonzoVaultClient } from '../bonzo/vault-client.js';
import { normalizeTokenSymbol } from '../bonzo/vault-client.js';
import type { DecisionLog, VaultInfo, RiskTolerance } from '../types/index.js';

interface ScoutInput {
  riskTolerance: RiskTolerance;
  tokenSymbol: string;
}

/**
 * ScoutAgent — Scans Bonzo Finance lending reserves on Hedera.
 *
 * Fetches REAL data from Bonzo's mainnet API + on-chain contract reads.
 * Evaluates supply APY, risk metrics (LTV), and liquidity depth.
 * Publishes vault scan findings to HCS for other agents to consume.
 */
export class ScoutAgent extends BaseAgent {
  private bonzoClient: BonzoVaultClient;

  constructor(hcsService: HCSService, bonzoClient: BonzoVaultClient) {
    super('scout', hcsService);
    this.bonzoClient = bonzoClient;
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { riskTolerance, tokenSymbol } = input as ScoutInput;
    this.setStatus('thinking', 'Scanning Bonzo lending reserves...');

    try {
      // Fetch real vault data from Bonzo API + on-chain
      const vaults = await this.bonzoClient.getVaults();

      if (vaults.length === 0) {
        this.setStatus('error', 'No vault data available');
        return this.createDecision(
          'vault-scan-empty',
          'Could not fetch Bonzo reserve data. The Bonzo API or Hedera Mirror Node may be unreachable.',
          0.1,
          '',
          { vaultsScanned: 0, vaultsMatched: 0, topVaults: [] }
        );
      }

      // Score and filter vaults based on user's risk tolerance
      const scored = this.scoreVaults(vaults, riskTolerance, tokenSymbol);

      // Build decision with reasoning
      const topVaults = scored.slice(0, 5);
      const reasoning = this.buildReasoning(topVaults, riskTolerance);

      const decision = this.createDecision(
        'vault-scan-complete',
        reasoning,
        topVaults.length > 0 ? 0.85 : 0.3,
        '',
        {
          vaultsScanned: vaults.length,
          vaultsMatched: topVaults.length,
          topVaults,
          filterCriteria: { riskTolerance, tokenSymbol },
          dataSource: 'bonzo-mainnet-live',
        }
      );

      await this.publishDecision('scout:vault-scan', decision);
      this.setStatus('idle', `Found ${topVaults.length} matching vaults`);

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
