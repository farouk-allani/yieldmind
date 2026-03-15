/**
 * KeeperService — Intelligent Vault Keeper for Bonzo Finance
 *
 * The core differentiator for the Bonzo bounty: an AI-driven keeper
 * that makes harvest/rebalance decisions based on:
 *   1. Market volatility (realized vol from CoinGecko price history)
 *   2. News sentiment (RAG via CoinGecko news + LLM analysis)
 *   3. Vault state (last harvest time, pending rewards, APY trends)
 *
 * Every decision is logged to HCS with human-readable reasoning.
 */

import type { LLMClient } from './llm-client.js';
import type { BonzoVaultsClient } from '../bonzo/bonzo-vaults-client.js';
import type { BonzoVaultInfo } from '../types/index.js';

// ── CoinGecko Free API (no key needed) ──────────────────────────

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const TOKEN_COINGECKO_IDS: Record<string, string> = {
  HBAR: 'hedera-hashgraph',
  WHBAR: 'hedera-hashgraph',
  USDC: 'usd-coin',
  SAUCE: 'saucerswap',
  HBARX: 'hbarx',
  BONZO: 'bonzo',
  XBONZO: 'bonzo',
  XSAUCE: 'xsauce',
  KARATE: 'karate-combat',
  DOVU: 'dovu',
};

// ── Types ────────────────────────────────────────────────────────

export interface VolatilityData {
  token: string;
  realizedVol24h: number;   // annualized realized volatility (%)
  realizedVol7d: number;
  priceChange24h: number;   // % change
  currentPrice: number;
  isHighVolatility: boolean; // > 80% annualized vol
}

export interface SentimentData {
  token: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;      // 0-1
  reasoning: string;       // LLM explanation
  headlines: string[];     // news headlines used
}

export interface KeeperDecision {
  vault: BonzoVaultInfo;
  action: 'harvest-now' | 'harvest-delay' | 'monitor' | 'alert';
  reasoning: string;
  confidence: number;
  data: {
    volatility?: VolatilityData;
    sentiment?: SentimentData;
    hoursSinceLastHarvest?: number;
    estimatedRewards?: number;
  };
}

// ── KeeperService ────────────────────────────────────────────────

export class KeeperService {
  private llmClient: LLMClient | null;
  private vaultsClient: BonzoVaultsClient;
  private volatilityCache: Map<string, { data: VolatilityData; expiry: number }> = new Map();
  private sentimentCache: Map<string, { data: SentimentData; expiry: number }> = new Map();

  constructor(llmClient: LLMClient | null, vaultsClient: BonzoVaultsClient) {
    this.llmClient = llmClient;
    this.vaultsClient = vaultsClient;
  }

  /**
   * Analyze all Bonzo Vaults and return keeper decisions.
   * This is the main entry point called by the Sentinel agent.
   */
  async analyzeVaults(): Promise<KeeperDecision[]> {
    const vaults = await this.vaultsClient.getVaults();
    const decisions: KeeperDecision[] = [];

    // Collect unique tokens across all vaults
    const tokens = new Set<string>();
    for (const vault of vaults) {
      tokens.add(vault.depositToken.split('-')[0]);
      if (vault.pairedToken) tokens.add(vault.pairedToken);
    }

    // Fetch volatility for all tokens in parallel
    const volPromises = [...tokens].map((t) => this.getVolatility(t));
    const volResults = await Promise.allSettled(volPromises);
    const volMap = new Map<string, VolatilityData>();
    for (const result of volResults) {
      if (result.status === 'fulfilled' && result.value) {
        volMap.set(result.value.token, result.value);
      }
    }

    // Fetch sentiment for key tokens (limit API calls)
    const keyTokens = ['HBAR', 'SAUCE', 'BONZO'].filter((t) => tokens.has(t));
    const sentMap = new Map<string, SentimentData>();
    for (const token of keyTokens) {
      try {
        const sentiment = await this.getSentiment(token);
        if (sentiment) sentMap.set(token, sentiment);
      } catch {
        // Sentiment is optional — don't block on failure
      }
    }

    // Make decisions for each vault
    for (const vault of vaults) {
      const primaryToken = vault.depositToken.split('-')[0];
      const vol = volMap.get(primaryToken);
      const sent = sentMap.get(primaryToken);

      const decision = this.makeKeeperDecision(vault, vol, sent);
      decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Get realized volatility for a token using CoinGecko price history.
   * Calculates annualized standard deviation of hourly returns.
   */
  async getVolatility(token: string): Promise<VolatilityData | null> {
    const cached = this.volatilityCache.get(token);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const cgId = TOKEN_COINGECKO_IDS[token.toUpperCase()];
    if (!cgId) return null;

    try {
      // Fetch 7 days of hourly prices
      const response = await fetch(
        `${COINGECKO_BASE}/coins/${cgId}/market_chart?vs_currency=usd&days=7`
      );

      if (!response.ok) {
        console.warn(`[Keeper] CoinGecko ${response.status} for ${token}`);
        return null;
      }

      const data = (await response.json()) as {
        prices: Array<[number, number]>;
      };

      if (!data.prices || data.prices.length < 24) return null;

      const prices = data.prices.map((p) => p[1]);
      const currentPrice = prices[prices.length - 1];
      const price24hAgo = prices[Math.max(0, prices.length - 24)];
      const priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;

      // Calculate hourly returns
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push(Math.log(prices[i] / prices[i - 1]));
      }

      // Standard deviation of returns
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
        (returns.length - 1);
      const hourlyStdDev = Math.sqrt(variance);

      // Annualize: hourly vol * sqrt(hours in year)
      const annualizedVol = hourlyStdDev * Math.sqrt(8760) * 100;

      // 24h vol: use last 24 hours of data
      const returns24h = returns.slice(-24);
      const mean24h = returns24h.reduce((a, b) => a + b, 0) / returns24h.length;
      const var24h =
        returns24h.reduce((sum, r) => sum + Math.pow(r - mean24h, 2), 0) /
        (returns24h.length - 1);
      const vol24h = Math.sqrt(var24h) * Math.sqrt(8760) * 100;

      const result: VolatilityData = {
        token: token.toUpperCase(),
        realizedVol24h: Math.round(vol24h * 10) / 10,
        realizedVol7d: Math.round(annualizedVol * 10) / 10,
        priceChange24h: Math.round(priceChange24h * 100) / 100,
        currentPrice,
        isHighVolatility: annualizedVol > 80,
      };

      // Cache for 10 minutes
      this.volatilityCache.set(token, { data: result, expiry: Date.now() + 600_000 });
      console.log(
        `[Keeper] ${token} volatility: 24h=${result.realizedVol24h}%, 7d=${result.realizedVol7d}%, ` +
        `price=${currentPrice.toFixed(4)}, change24h=${priceChange24h.toFixed(1)}%`
      );

      return result;
    } catch (error) {
      console.warn(`[Keeper] Failed to fetch volatility for ${token}:`, error);
      return null;
    }
  }

  /**
   * Get market sentiment for a token using CoinGecko status updates + LLM analysis.
   * This is the RAG component — retrieves external data, then reasons over it.
   */
  async getSentiment(token: string): Promise<SentimentData | null> {
    const cached = this.sentimentCache.get(token);
    if (cached && Date.now() < cached.expiry) return cached.data;

    if (!this.llmClient) {
      return { token, sentiment: 'neutral', confidence: 0.3, reasoning: 'No LLM available for sentiment analysis', headlines: [] };
    }

    const cgId = TOKEN_COINGECKO_IDS[token.toUpperCase()];
    if (!cgId) return null;

    try {
      // Fetch coin data with market info (includes community data, sentiment)
      const response = await fetch(
        `${COINGECKO_BASE}/coins/${cgId}?localization=false&tickers=false&community_data=true&developer_data=false`
      );

      let headlines: string[] = [];
      let marketContext = '';

      if (response.ok) {
        const coinData = (await response.json()) as {
          market_data?: {
            price_change_percentage_24h?: number;
            price_change_percentage_7d?: number;
            price_change_percentage_30d?: number;
            total_volume?: { usd?: number };
            market_cap?: { usd?: number };
          };
          sentiment_votes_up_percentage?: number;
          sentiment_votes_down_percentage?: number;
          description?: { en?: string };
        };

        const md = coinData.market_data;
        if (md) {
          marketContext = [
            `${token} price change: 24h=${md.price_change_percentage_24h?.toFixed(1)}%, ` +
            `7d=${md.price_change_percentage_7d?.toFixed(1)}%, 30d=${md.price_change_percentage_30d?.toFixed(1)}%`,
            `Volume 24h: $${((md.total_volume?.usd || 0) / 1e6).toFixed(1)}M`,
            `Market cap: $${((md.market_cap?.usd || 0) / 1e6).toFixed(1)}M`,
            `Community sentiment: ${coinData.sentiment_votes_up_percentage?.toFixed(0)}% bullish`,
          ].join('\n');

          headlines = [
            `${token} ${(md.price_change_percentage_24h || 0) > 0 ? 'up' : 'down'} ${Math.abs(md.price_change_percentage_24h || 0).toFixed(1)}% in 24h`,
            `7-day trend: ${(md.price_change_percentage_7d || 0) > 0 ? 'positive' : 'negative'} (${md.price_change_percentage_7d?.toFixed(1)}%)`,
            `Community sentiment: ${coinData.sentiment_votes_up_percentage?.toFixed(0)}% positive`,
          ];
        }
      }

      if (!marketContext) {
        return { token, sentiment: 'neutral', confidence: 0.3, reasoning: 'No market data available', headlines: [] };
      }

      // RAG: Feed market data to LLM for sentiment analysis
      const llmResponse = await this.llmClient.chat([
        {
          role: 'system',
          content: `You are a DeFi market sentiment analyzer for an intelligent keeper agent.
Analyze the market data and determine if the keeper should harvest vault rewards NOW or WAIT.
Respond with ONLY valid JSON:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explanation for the harvest decision"
}`,
        },
        {
          role: 'user',
          content: `Analyze the market sentiment for ${token} to decide harvest timing:\n\n${marketContext}`,
        },
      ]);

      let parsed: { sentiment: string; confidence: number; reasoning: string };
      try {
        let content = llmResponse.content.trim();
        if (content.startsWith('```')) {
          content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(content);
      } catch {
        parsed = { sentiment: 'neutral', confidence: 0.5, reasoning: 'Could not parse LLM response' };
      }

      const result: SentimentData = {
        token,
        sentiment: (['bullish', 'bearish', 'neutral'].includes(parsed.sentiment)
          ? parsed.sentiment
          : 'neutral') as SentimentData['sentiment'],
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        headlines,
      };

      // Cache for 30 minutes
      this.sentimentCache.set(token, { data: result, expiry: Date.now() + 1_800_000 });
      console.log(`[Keeper] ${token} sentiment: ${result.sentiment} (${(result.confidence * 100).toFixed(0)}%) — ${result.reasoning}`);

      return result;
    } catch (error) {
      console.warn(`[Keeper] Failed to get sentiment for ${token}:`, error);
      return null;
    }
  }

  /**
   * Make an intelligent keeper decision for a vault based on
   * volatility data, sentiment analysis, and vault state.
   */
  private makeKeeperDecision(
    vault: BonzoVaultInfo,
    volatility: VolatilityData | undefined,
    sentiment: SentimentData | undefined,
  ): KeeperDecision {
    const reasons: string[] = [];
    let action: KeeperDecision['action'] = 'monitor';
    let confidence = 0.5;

    // Factor 1: Volatility-based decision
    if (volatility) {
      if (volatility.isHighVolatility) {
        // High volatility → harvest immediately to lock in rewards
        reasons.push(
          `High volatility detected for ${volatility.token}: ` +
          `${volatility.realizedVol24h}% annualized (24h). ` +
          `Price ${volatility.priceChange24h > 0 ? 'up' : 'down'} ${Math.abs(volatility.priceChange24h).toFixed(1)}% in 24h. ` +
          `Harvesting now to protect accrued rewards from adverse price movement.`
        );
        action = 'harvest-now';
        confidence = 0.85;
      } else if (volatility.realizedVol24h > 50) {
        // Medium-high volatility → consider harvesting
        reasons.push(
          `Moderate volatility for ${volatility.token}: ` +
          `${volatility.realizedVol24h}% annualized. Monitoring closely.`
        );
        action = 'monitor';
        confidence = 0.6;
      } else {
        // Low volatility → safe to let rewards compound
        reasons.push(
          `Low volatility for ${volatility.token}: ` +
          `${volatility.realizedVol24h}% annualized. ` +
          `Safe to let rewards compound — no immediate harvest needed.`
        );
        action = 'harvest-delay';
        confidence = 0.75;
      }
    }

    // Factor 2: Sentiment-based adjustment
    if (sentiment) {
      if (sentiment.sentiment === 'bearish' && sentiment.confidence > 0.6) {
        // Bearish sentiment → harvest NOW to swap before price drops
        reasons.push(
          `Bearish sentiment on ${sentiment.token} (${(sentiment.confidence * 100).toFixed(0)}% confidence): ` +
          `${sentiment.reasoning}. Triggering immediate harvest to protect reward value.`
        );
        action = 'harvest-now';
        confidence = Math.max(confidence, 0.8);
      } else if (sentiment.sentiment === 'bullish' && sentiment.confidence > 0.6) {
        // Bullish sentiment → delay harvest, let rewards appreciate
        if (action !== 'harvest-now') {
          reasons.push(
            `Bullish sentiment on ${sentiment.token} (${(sentiment.confidence * 100).toFixed(0)}% confidence): ` +
            `${sentiment.reasoning}. Delaying harvest to capture reward token appreciation.`
          );
          action = 'harvest-delay';
          confidence = Math.max(confidence, 0.7);
        }
      } else {
        reasons.push(
          `Neutral sentiment on ${sentiment.token}: ${sentiment.reasoning}`
        );
      }
    }

    // Factor 3: Vault APY trend
    if (vault.apy > 50) {
      reasons.push(
        `Vault "${vault.name}" has high APY (${vault.apy.toFixed(1)}%) — ` +
        `rewards accumulating quickly, harvest timing is material.`
      );
    }

    // Default reasoning if no data
    if (reasons.length === 0) {
      reasons.push(
        `Vault "${vault.name}" is operating normally. ` +
        `APY: ${vault.apy.toFixed(1)}%, TVL: $${vault.tvl.toFixed(0)}. ` +
        `No external signals warrant action.`
      );
    }

    return {
      vault,
      action,
      reasoning: reasons.join(' '),
      confidence,
      data: {
        volatility: volatility || undefined,
        sentiment: sentiment || undefined,
      },
    };
  }
}
