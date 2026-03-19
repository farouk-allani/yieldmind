/**
 * GET /api/market-vaults — Fetch live vault APY data from Bonzo Finance.
 *
 * This endpoint fetches directly from Bonzo's public APIs without
 * requiring the agent runtime to be initialized. It's used by the
 * landing page to show live yield data to visitors before they connect
 * a wallet.
 *
 * Data sources:
 * - Bonzo Lend: https://mainnet-data-staging.bonzo.finance/market
 * - Bonzo Vaults: https://mainnet-vaults.bonzo.finance/v1/api/vaults
 */

import { NextResponse } from 'next/server';

// ── Bonzo API types ──────────────────────────────────────────────────

interface BonzoPriceData {
  usd_display?: string;
  token_display?: string;
}

interface BonzoMarketReserve {
  id: number;
  name: string;
  symbol: string;
  evm_address: string;
  hts_address: string;
  decimals: number;
  ltv: number;
  active: boolean;
  frozen: boolean;
  available_liquidity: BonzoPriceData;
  supply_apy: number;
  variable_borrow_apy: number;
}

interface BonzoMarketResponse {
  reserves: BonzoMarketReserve[];
  total_market_supplied?: BonzoPriceData;
  timestamp?: string;
}

interface BonzoVaultAsset {
  symbol: string;
  address: string;
  decimals: number;
}

interface BonzoVaultApiEntry {
  id: string;
  name: string;
  apy: string;
  totalApy: string;
  tvl: string;
  contractAddress: string;
  strategyAddress: string;
  vaultType: string;
  assets: BonzoVaultAsset[];
  isHidden: boolean;
  safetyScore: number;
  lastHarvest: string;
  tabs?: {
    risks?: Array<{
      volatility?: string;
    }>;
  };
}

interface BonzoVaultsApiResponse {
  summary?: {
    totalValueLocked: string;
    vaultCount: number;
    averageApy: string;
  };
  vaults: BonzoVaultApiEntry[];
}

// ── Normalized output types ──────────────────────────────────────────

export interface MarketVaultEntry {
  id: string;
  name: string;
  symbol: string;
  apy: number;
  tvl: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  productType: 'bonzo-lend' | 'bonzo-vault';
  tokens: string[];
  vaultType?: string;
  address: string;
}

export interface MarketVaultsResponse {
  lendReserves: MarketVaultEntry[];
  bonzoVaults: MarketVaultEntry[];
  totalTvl: number;
  bestApy: number;
  lastUpdated: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseUsd(display: string | undefined): number {
  if (!display) return 0;
  const n = parseFloat(display.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function ltvToRisk(ltv: number): 'conservative' | 'moderate' | 'aggressive' {
  if (ltv >= 0.7) return 'conservative';
  if (ltv >= 0.4) return 'moderate';
  return 'aggressive';
}

function volatilityToRisk(v: string | undefined): 'conservative' | 'moderate' | 'aggressive' {
  const lower = (v || '').toLowerCase();
  if (lower === 'low') return 'conservative';
  if (lower === 'medium') return 'moderate';
  return 'aggressive';
}

function displaySym(s: string) {
  return s.toUpperCase() === 'WHBAR' ? 'HBAR' : s.toUpperCase();
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET() {
  try {
    const [lendResult, vaultsResult] = await Promise.allSettled([
      fetch('https://mainnet-data-staging.bonzo.finance/market', {
        next: { revalidate: 120 },
        headers: { Accept: 'application/json' },
      }),
      fetch('https://mainnet-vaults.bonzo.finance/v1/api/vaults', {
        next: { revalidate: 120 },
        headers: { Accept: 'application/json' },
      }),
    ]);

    // ── Bonzo Lend reserves ──
    const lendReserves: MarketVaultEntry[] = [];
    if (lendResult.status === 'fulfilled' && lendResult.value.ok) {
      const data = (await lendResult.value.json()) as BonzoMarketResponse;
      for (const r of data.reserves ?? []) {
        if (!r.active || r.frozen) continue;
        const sym = displaySym(r.symbol);
        lendReserves.push({
          id: r.hts_address,
          name: `${sym} Supply Pool`,
          symbol: sym,
          apy: r.supply_apy ?? 0,
          tvl: parseUsd(r.available_liquidity?.usd_display),
          riskLevel: ltvToRisk(r.ltv),
          productType: 'bonzo-lend',
          tokens: [sym],
          address: r.evm_address,
        });
      }
    }

    // ── Bonzo Vaults ──
    const bonzoVaults: MarketVaultEntry[] = [];
    if (vaultsResult.status === 'fulfilled' && vaultsResult.value.ok) {
      const data = (await vaultsResult.value.json()) as BonzoVaultsApiResponse;
      for (const v of data.vaults ?? []) {
        if (v.isHidden) continue;
        const apy = parseFloat(v.totalApy ?? v.apy ?? '0');
        const tvl = parseFloat(v.tvl ?? '0');
        const tokens = (v.assets ?? []).map((a) => displaySym(a.symbol));
        const volatility = v.tabs?.risks?.[0]?.volatility;
        bonzoVaults.push({
          id: v.contractAddress,
          name: v.name,
          symbol: tokens.join('-'),
          apy,
          tvl,
          riskLevel: volatilityToRisk(volatility),
          productType: 'bonzo-vault',
          tokens,
          vaultType: v.vaultType,
          address: v.contractAddress,
        });
      }
    }

    // Sort by APY descending
    lendReserves.sort((a, b) => b.apy - a.apy);
    bonzoVaults.sort((a, b) => b.apy - a.apy);

    const allVaults = [...lendReserves, ...bonzoVaults];
    const totalTvl = allVaults.reduce((s, v) => s + v.tvl, 0);
    const bestApy = allVaults.reduce((m, v) => Math.max(m, v.apy), 0);

    const response: MarketVaultsResponse = {
      lendReserves,
      bonzoVaults,
      totalTvl,
      bestApy,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[API /market-vaults]', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
