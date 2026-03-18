/**
 * GET /api/keeper — Run intelligent keeper analysis on all Bonzo Vaults
 *
 * Returns keeper decisions for each vault: harvest-now, harvest-delay, or monitor.
 * Each decision includes:
 * - Market volatility data (realized vol from CoinGecko price history)
 * - Sentiment analysis (RAG: CoinGecko market data → LLM reasoning)
 * - Human-readable reasoning explaining the decision
 *
 * This endpoint demonstrates the Intelligent Keeper Agent for the Bonzo bounty.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { agentRuntime } from '@/lib/runtime';

export async function GET() {
  if (!agentRuntime) {
    return NextResponse.json(
      { error: 'Agent runtime not initialized' },
      { status: 503 }
    );
  }

  try {
    const { keeperService } = agentRuntime;

    if (!keeperService) {
      return NextResponse.json(
        { error: 'Keeper service not available' },
        { status: 503 }
      );
    }

    const decisions = await keeperService.analyzeVaults();

    // Separate by action type for easy consumption
    const harvestNow = decisions.filter((d) => d.action === 'harvest-now');
    const harvestDelay = decisions.filter((d) => d.action === 'harvest-delay');
    const monitoring = decisions.filter((d) => d.action === 'monitor' || d.action === 'alert');

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalVaults: decisions.length,
        harvestNow: harvestNow.length,
        harvestDelay: harvestDelay.length,
        monitoring: monitoring.length,
      },
      decisions: decisions.map((d) => ({
        vault: d.vault.name,
        vaultAddress: d.vault.vaultAddress,
        strategyAddress: d.vault.strategyAddress,
        apy: d.vault.apy,
        tvl: d.vault.tvl,
        action: d.action,
        confidence: d.confidence,
        reasoning: d.reasoning,
        harvestCalldata: d.harvestCalldata || null,
        volatility: d.data.volatility
          ? {
              token: d.data.volatility.token,
              realizedVol24h: d.data.volatility.realizedVol24h,
              realizedVol7d: d.data.volatility.realizedVol7d,
              priceChange24h: d.data.volatility.priceChange24h,
              currentPrice: d.data.volatility.currentPrice,
              isHighVolatility: d.data.volatility.isHighVolatility,
            }
          : null,
        sentiment: d.data.sentiment
          ? {
              direction: d.data.sentiment.sentiment,
              confidence: d.data.sentiment.confidence,
              reasoning: d.data.sentiment.reasoning,
              headlines: d.data.sentiment.headlines,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('[API/keeper] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Keeper analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/keeper — Get harvest recommendations with calldata for a connected wallet.
 *
 * Body: { walletAddress: string } — the user's EVM address
 *
 * Returns the same analysis as GET but with harvestCalldata attached to
 * harvest-now decisions, ready for the user's wallet to sign.
 */
export async function POST(request: NextRequest) {
  if (!agentRuntime?.keeperService) {
    return NextResponse.json(
      { error: 'Keeper service not available' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress;
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const decisions = await agentRuntime.keeperService.getHarvestRecommendations(walletAddress);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      walletAddress,
      summary: {
        totalVaults: decisions.length,
        harvestNow: decisions.filter((d) => d.action === 'harvest-now').length,
        harvestDelay: decisions.filter((d) => d.action === 'harvest-delay').length,
        monitoring: decisions.filter((d) => d.action !== 'harvest-now' && d.action !== 'harvest-delay').length,
      },
      decisions: decisions.map((d) => ({
        vault: d.vault.name,
        vaultAddress: d.vault.vaultAddress,
        strategyAddress: d.vault.strategyAddress,
        apy: d.vault.apy,
        tvl: d.vault.tvl,
        action: d.action,
        confidence: d.confidence,
        reasoning: d.reasoning,
        harvestCalldata: d.harvestCalldata || null,
        volatility: d.data.volatility ? {
          token: d.data.volatility.token,
          realizedVol24h: d.data.volatility.realizedVol24h,
          priceChange24h: d.data.volatility.priceChange24h,
          isHighVolatility: d.data.volatility.isHighVolatility,
        } : null,
        sentiment: d.data.sentiment ? {
          direction: d.data.sentiment.sentiment,
          confidence: d.data.sentiment.confidence,
          reasoning: d.data.sentiment.reasoning,
          headlines: d.data.sentiment.headlines,
        } : null,
      })),
    });
  } catch (error) {
    console.error('[API/keeper] POST Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Keeper harvest analysis failed' },
      { status: 500 }
    );
  }
}
