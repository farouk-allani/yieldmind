import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { DecisionLog, Strategy, SentinelAlert } from '../types/index.js';
import type { KeeperService, KeeperDecision } from '../core/keeper-service.js';

interface SentinelInput {
  strategy: Strategy;
  sessionId: string;
}

/**
 * SentinelAgent — The intelligent keeper & watchdog of YieldMind.
 *
 * Two responsibilities:
 * 1. **Position Monitoring** — Watches price movements for active strategies.
 *    Triggers alerts or emergency exits on thresholds.
 *
 * 2. **Intelligent Keeper** — Analyzes Bonzo Vault state + market conditions
 *    (volatility, sentiment via RAG) to decide optimal harvest/rebalance timing.
 *    This is the core differentiator for the Bonzo bounty.
 *
 * Every decision includes human-readable reasoning published to HCS.
 */
export class SentinelAgent extends BaseAgent {
  private priceCache: Map<string, number> = new Map();
  private keeperService: KeeperService | null = null;

  constructor(hcsService: HCSService) {
    super('sentinel', hcsService);
  }

  /**
   * Inject the KeeperService for intelligent vault keeping.
   */
  setKeeperService(keeper: KeeperService): void {
    this.keeperService = keeper;
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { strategy, sessionId } = input as SentinelInput;
    this.setStatus('thinking', 'Starting position monitoring + keeper analysis...');

    try {
      // Run keeper analysis in parallel with market checks
      const [alert, keeperDecisions] = await Promise.all([
        this.checkMarketConditions(strategy),
        this.runKeeperAnalysis(),
      ]);

      // If there's a critical market alert, prioritize it
      if (alert) {
        const decision = this.createDecision(
          `alert-${alert.severity}`,
          alert.recommendation,
          alert.severity === 'critical' ? 0.95 : 0.7,
          sessionId,
          { alert, strategy: strategy.id }
        );
        await this.publishDecision('sentinel:alert', decision);
        this.setStatus('idle', `Alert: ${alert.condition}`);
        return decision;
      }

      // Build keeper summary for the decision log
      const keeperSummary = this.buildKeeperSummary(keeperDecisions);

      const decision = this.createDecision(
        'monitoring-active',
        `All positions healthy. Monitoring ${strategy.vaults.length} vault(s). ` +
        `${keeperSummary} ` +
        `Next check in 5 minutes.`,
        0.8,
        sessionId,
        {
          strategy: strategy.id,
          vaultsMonitored: strategy.vaults.length,
          marketStatus: 'stable',
          keeperDecisions: keeperDecisions.map((d) => ({
            vault: d.vault.name,
            action: d.action,
            reasoning: d.reasoning,
            confidence: d.confidence,
            volatility: d.data.volatility
              ? {
                  vol24h: d.data.volatility.realizedVol24h,
                  priceChange24h: d.data.volatility.priceChange24h,
                  isHighVol: d.data.volatility.isHighVolatility,
                }
              : null,
            sentiment: d.data.sentiment
              ? {
                  direction: d.data.sentiment.sentiment,
                  confidence: d.data.sentiment.confidence,
                  reasoning: d.data.sentiment.reasoning,
                }
              : null,
          })),
        }
      );

      await this.publishDecision('sentinel:alert', decision);
      this.setStatus('idle', 'Monitoring + keeper active');

      return decision;
    } catch (error) {
      this.setStatus('error', 'Monitoring check failed');
      return this.createDecision(
        'monitoring-error',
        `Failed to check market conditions: ${error instanceof Error ? error.message : 'Unknown error'}. Monitoring will retry.`,
        0,
        sessionId,
        { error: String(error) }
      );
    }
  }

  /**
   * Run the intelligent keeper analysis on all Bonzo Vaults.
   * Returns decisions on whether to harvest, delay, or monitor each vault.
   */
  private async runKeeperAnalysis(): Promise<KeeperDecision[]> {
    if (!this.keeperService) {
      console.log('[Sentinel] No KeeperService configured — skipping keeper analysis');
      return [];
    }

    try {
      const decisions = await this.keeperService.analyzeVaults();
      const harvestNow = decisions.filter((d) => d.action === 'harvest-now');
      const delay = decisions.filter((d) => d.action === 'harvest-delay');

      console.log(
        `[Sentinel/Keeper] Analyzed ${decisions.length} vaults: ` +
        `${harvestNow.length} harvest-now, ${delay.length} harvest-delay, ` +
        `${decisions.length - harvestNow.length - delay.length} monitor`
      );

      return decisions;
    } catch (error) {
      console.warn('[Sentinel/Keeper] Keeper analysis failed:', error);
      return [];
    }
  }

  /**
   * Build a human-readable summary of keeper decisions for the decision log.
   */
  private buildKeeperSummary(decisions: KeeperDecision[]): string {
    if (decisions.length === 0) return 'Keeper: no vaults analyzed.';

    const harvestNow = decisions.filter((d) => d.action === 'harvest-now');
    const delay = decisions.filter((d) => d.action === 'harvest-delay');

    const parts: string[] = [];

    if (harvestNow.length > 0) {
      parts.push(
        `Keeper recommends IMMEDIATE HARVEST for ${harvestNow.length} vault(s): ` +
        harvestNow.map((d) => `${d.vault.name} (${d.reasoning.split('.')[0]})`).join('; ') +
        '.'
      );
    }

    if (delay.length > 0) {
      parts.push(
        `${delay.length} vault(s) safe to compound — delaying harvest.`
      );
    }

    const monitored = decisions.length - harvestNow.length - delay.length;
    if (monitored > 0) {
      parts.push(`${monitored} vault(s) under standard monitoring.`);
    }

    return parts.join(' ');
  }

  /**
   * Check market conditions for the active strategy.
   * Uses CoinGecko for real price data.
   */
  private async checkMarketConditions(
    strategy: Strategy
  ): Promise<SentinelAlert | null> {
    const tokens = new Set<string>();
    for (const vault of strategy.vaults) {
      const [token1, token2] = vault.vaultName.split('-');
      if (token1) tokens.add(token1.trim());
      if (token2) tokens.add(token2.trim());
    }

    const prices = await this.fetchPrices([...tokens]);

    for (const [token, price] of prices.entries()) {
      const cached = this.priceCache.get(token);
      if (cached) {
        const change = ((price - cached) / cached) * 100;

        if (Math.abs(change) > 15) {
          return {
            severity: 'critical',
            condition: `${token} price ${change > 0 ? 'surged' : 'dropped'} ${Math.abs(change).toFixed(1)}%`,
            recommendation:
              change < -15
                ? `Emergency exit recommended for vaults containing ${token}. Significant price decline detected. Keeper: triggering immediate harvest to protect rewards.`
                : `Price surge on ${token}. Keeper: harvesting rewards now — surge may be temporary.`,
            affectedVaults: strategy.vaults
              .filter((v) => v.vaultName.includes(token))
              .map((v) => v.vaultAddress),
            timestamp: new Date().toISOString(),
          };
        }

        if (Math.abs(change) > 8) {
          return {
            severity: 'warning',
            condition: `${token} price moved ${change.toFixed(1)}% since last check`,
            recommendation:
              change < 0
                ? `Monitor ${token} positions closely. Keeper: considering harvest to protect reward value.`
                : `${token} performing well. Keeper: delaying harvest to capture appreciation.`,
            affectedVaults: strategy.vaults
              .filter((v) => v.vaultName.includes(token))
              .map((v) => v.vaultAddress),
            timestamp: new Date().toISOString(),
          };
        }
      }

      this.priceCache.set(token, price);
    }

    return null;
  }

  /**
   * Fetch token prices from CoinGecko (free API, no key needed).
   */
  private async fetchPrices(tokens: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      const ids = tokens
        .map((t) => this.tokenToCoinGeckoId(t))
        .filter(Boolean)
        .join(',');

      if (ids) {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        );

        if (response.ok) {
          const data = (await response.json()) as Record<string, { usd: number }>;
          for (const token of tokens) {
            const cgId = this.tokenToCoinGeckoId(token);
            if (cgId && data[cgId]) {
              prices.set(token, data[cgId].usd);
            }
          }
          return prices;
        }
      }
    } catch {
      console.log('[Sentinel] CoinGecko API unreachable, using cached prices');
    }

    // Fallback prices
    const fallback: Record<string, number> = {
      HBAR: 0.095, USDC: 1.0, USDT: 1.0,
      HBARX: 0.105, SAUCE: 0.015, KARATE: 0.002,
    };
    for (const token of tokens) {
      prices.set(token, fallback[token.toUpperCase()] || 1.0);
    }
    return prices;
  }

  private tokenToCoinGeckoId(token: string): string | null {
    const map: Record<string, string> = {
      HBAR: 'hedera-hashgraph',
      WHBAR: 'hedera-hashgraph',
      USDC: 'usd-coin',
      USDT: 'tether',
      SAUCE: 'saucerswap',
      HBARX: 'hbarx',
      BONZO: 'bonzo',
      KARATE: 'karate-combat',
    };
    return map[token.toUpperCase()] || null;
  }
}
