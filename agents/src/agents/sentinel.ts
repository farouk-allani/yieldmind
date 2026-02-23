import { BaseAgent } from '../core/base-agent';
import type { HCSService } from '../hedera/hcs';
import type { DecisionLog, Strategy, SentinelAlert } from '../types';

interface SentinelInput {
  strategy: Strategy;
  sessionId: string;
}

/**
 * SentinelAgent — The watchdog of YieldMind.
 *
 * Monitors market conditions and active positions. When thresholds
 * are breached (price drops, volatility spikes, liquidity crises),
 * the Sentinel publishes alerts to HCS and can trigger emergency exits.
 *
 * Runs continuously after a strategy is executed.
 */
export class SentinelAgent extends BaseAgent {
  private priceCache: Map<string, number> = new Map();

  constructor(hcsService: HCSService) {
    super('sentinel', hcsService);
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { strategy, sessionId } = input as SentinelInput;
    this.setStatus('thinking', 'Starting position monitoring...');

    try {
      // Perform initial market check
      const alert = await this.checkMarketConditions(strategy);

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

      // No issues found — normal monitoring
      const decision = this.createDecision(
        'monitoring-active',
        `All positions healthy. Monitoring ${strategy.vaults.length} vault(s). No market anomalies detected. Next check in 5 minutes.`,
        0.8,
        sessionId,
        {
          strategy: strategy.id,
          vaultsMonitored: strategy.vaults.length,
          marketStatus: 'stable',
        }
      );

      await this.publishDecision('sentinel:alert', decision);
      this.setStatus('idle', 'Monitoring active — no alerts');

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
   * Check market conditions for the active strategy.
   *
   * In production: uses Supra/Pyth oracles + CoinGecko for real data.
   * For MVP: demonstrates the monitoring logic with simulated checks.
   */
  private async checkMarketConditions(
    strategy: Strategy
  ): Promise<SentinelAlert | null> {
    // Fetch current prices for tokens in the strategy
    const tokens = new Set<string>();
    for (const vault of strategy.vaults) {
      const [token1, token2] = vault.vaultName.split('-');
      if (token1) tokens.add(token1.trim());
      if (token2) tokens.add(token2.trim());
    }

    const prices = await this.fetchPrices([...tokens]);

    // Check for significant price movements
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
                ? `Emergency exit recommended for vaults containing ${token}. Significant price decline detected.`
                : `Consider harvesting ${token} rewards now — price surge may be temporary.`,
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
                ? `Monitor ${token} positions closely. Consider tightening stop-loss.`
                : `${token} performing well. Consider harvesting partial rewards.`,
            affectedVaults: strategy.vaults
              .filter((v) => v.vaultName.includes(token))
              .map((v) => v.vaultAddress),
            timestamp: new Date().toISOString(),
          };
        }
      }

      this.priceCache.set(token, price);
    }

    return null; // All clear
  }

  /**
   * Fetch token prices.
   * Production: Supra/Pyth oracle on Hedera + CoinGecko API
   * MVP: Simulated stable prices for demo
   */
  private async fetchPrices(
    tokens: string[]
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    // Try CoinGecko for real prices
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
          const data = (await response.json()) as Record<
            string,
            { usd: number }
          >;
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

    // Fallback mock prices
    const mockPrices: Record<string, number> = {
      HBAR: 0.28,
      USDC: 1.0,
      USDT: 1.0,
      HBARX: 0.31,
      SAUCE: 0.015,
      KARATE: 0.002,
    };

    for (const token of tokens) {
      prices.set(token, mockPrices[token.toUpperCase()] || 1.0);
    }

    return prices;
  }

  private tokenToCoinGeckoId(token: string): string | null {
    const map: Record<string, string> = {
      HBAR: 'hedera-hashgraph',
      USDC: 'usd-coin',
      USDT: 'tether',
    };
    return map[token.toUpperCase()] || null;
  }
}
