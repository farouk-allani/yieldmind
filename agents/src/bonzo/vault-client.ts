import type { VaultInfo, RiskTolerance } from '../types/index.js';
import { getBonzoNetworkConfig } from '../config/index.js';

/**
 * BonzoVaultClient — Fetches REAL data from Bonzo Finance on Hedera.
 *
 * Data flow:
 * - Mainnet: Bonzo Data API /market → supply_apy and available_liquidity directly
 *   (no Mirror Node contract calls, no CoinGecko price fetching needed)
 * - Testnet: Hardcoded reserve list with fallback APY values
 *   (testnet data API is unavailable)
 *
 * WHBAR mapping: When users say "HBAR", Bonzo wraps it to WHBAR for lending.
 * The client maps HBAR intent → WHBAR pool automatically.
 */

// ── WHBAR ↔ HBAR mapping ───────────────────────────────────────────
// Bonzo uses WHBAR (Wrapped HBAR) for lending pools. Users say "HBAR"
// but the actual pool asset is WHBAR. This mapping lets the Scout and
// Strategist seamlessly translate between user intent and pool reality.
export const WHBAR_EVM_ADDRESS: Record<string, string> = {
  testnet: '', // no WHBAR pool on testnet
  mainnet: '0x0000000000000000000000000000000000163b5a',
};

/**
 * Normalize token symbol for vault lookups.
 * "HBAR" → "WHBAR" (since Bonzo uses wrapped HBAR)
 */
export function normalizeTokenSymbol(symbol: string): string {
  return symbol.toUpperCase() === 'HBAR' ? 'WHBAR' : symbol.toUpperCase();
}

// ── Testnet reserve definitions ──────────────────────────────────────
// Source: https://docs.bonzo.finance/hub/developer/bonzo-lend/lend-contracts
// The testnet data API (testnet-data.bonzo.finance) returns 403,
// so we hardcode the known testnet reserves.
interface TestnetReserve {
  id: number;
  name: string;
  symbol: string;
  evm_address: string;
  hts_address: string;
  decimals: number;
  ltv: number;
  active: boolean;
  frozen: boolean;
}

const TESTNET_RESERVES: TestnetReserve[] = [
  {
    id: 0, name: 'USD Coin', symbol: 'USDC',
    evm_address: '0x0000000000000000000000000000000000001549',
    hts_address: '0.0.5449', decimals: 6, ltv: 0.80,
    active: true, frozen: false,
  },
  {
    id: 1, name: 'Sauce', symbol: 'SAUCE',
    evm_address: '0x0000000000000000000000000000000000120f46',
    hts_address: '0.0.1183558', decimals: 6, ltv: 0.40,
    active: true, frozen: false,
  },
  {
    id: 2, name: 'Karate Combat', symbol: 'KARATE',
    evm_address: '0x00000000000000000000000000000000003991ed',
    hts_address: '0.0.3772909', decimals: 8, ltv: 0.20,
    active: true, frozen: false,
  },
  {
    id: 3, name: 'xSAUCE', symbol: 'XSAUCE',
    evm_address: '0x000000000000000000000000000000000015a59b',
    hts_address: '0.0.1418651', decimals: 6, ltv: 0.40,
    active: true, frozen: false,
  },
  {
    id: 4, name: 'HBARX', symbol: 'HBARX',
    evm_address: '0x0000000000000000000000000000000000220ced',
    hts_address: '0.0.2231533', decimals: 8, ltv: 0.62,
    active: true, frozen: false,
  },
];

// Fallback APY values for testnet reserves.
// Testnet pools have little to no real supply activity so on-chain rates return 0%.
// These are based on typical Bonzo mainnet rates for a realistic demo experience.
const TESTNET_FALLBACK_APYS: Record<string, { supplyApy: number; tvlUsd: number }> = {
  USDC:   { supplyApy: 3.45, tvlUsd: 850_000 },
  SAUCE:  { supplyApy: 5.82, tvlUsd: 320_000 },
  KARATE: { supplyApy: 8.15, tvlUsd: 95_000 },
  XSAUCE: { supplyApy: 6.10, tvlUsd: 210_000 },
  HBARX:  { supplyApy: 4.25, tvlUsd: 540_000 },
};

// ── Bonzo Data API response types ───────────────────────────────────
// Source: https://mainnet-data-staging.bonzo.finance/market

interface BonzoPriceData {
  tiny_token: string;
  token_display: string;
  hbar_tinybar: string;
  hbar_display: string;
  usd_wad: string;
  usd_display: string;
  usd_abbreviated: string;
}

interface BonzoMarketReserve {
  id: number;
  name: string;
  symbol: string;
  coingecko_id: string | null;
  evm_address: string;
  hts_address: string;
  atoken_address: string;
  stable_debt_address: string;
  variable_debt_address: string;
  decimals: number;
  ltv: number;
  liquidation_threshold: number;
  liquidation_bonus: number;
  active: boolean;
  frozen: boolean;
  variable_borrowing_enabled: boolean;
  stable_borrowing_enabled: boolean;
  reserve_factor: number;
  available_liquidity: BonzoPriceData;
  total_supply: BonzoPriceData;
  utilization_rate: number;
  /** Supply APY as a percentage (e.g., 1.03 = 1.03%) */
  supply_apy: number;
  variable_borrow_apy: number;
  stable_borrow_apy: number;
  price_usd_display: string;
}

interface BonzoMarketResponse {
  chain_id: number;
  network_name: string;
  total_market_supplied: BonzoPriceData;
  total_market_borrowed: BonzoPriceData;
  total_market_liquidity: BonzoPriceData;
  reserves: BonzoMarketReserve[];
  timestamp: string;
}

export class BonzoVaultClient {
  private readonly dataApiUrl: string;
  private readonly isTestnet: boolean;
  private cachedVaults: VaultInfo[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const config = getBonzoNetworkConfig();
    this.isTestnet = config.network === 'testnet';
    this.dataApiUrl = config.bonzo.dataApiUrl;
  }

  /**
   * Fetch all Bonzo lending reserves with live data.
   *
   * On mainnet: hits the Bonzo Data API /market endpoint which returns
   * supply_apy and available_liquidity directly — no contract calls needed.
   *
   * On testnet: uses hardcoded reserves with fallback APYs.
   */
  async getVaults(): Promise<VaultInfo[]> {
    if (this.cachedVaults && Date.now() < this.cacheExpiry) {
      console.log('[BonzoClient] Returning cached vault data');
      return this.cachedVaults;
    }

    try {
      const vaults = this.isTestnet
        ? this.buildTestnetVaults()
        : await this.fetchMainnetVaults();

      console.log(
        `[BonzoClient] Built ${vaults.length} vault entries with ${this.isTestnet ? 'fallback' : 'live'} APY data`
      );

      this.cachedVaults = vaults;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      return vaults;
    } catch (error) {
      console.error(
        '[BonzoClient] Failed to fetch vault data:',
        error instanceof Error ? error.message : error
      );
      return this.cachedVaults || [];
    }
  }

  /**
   * Fetch live vault data from Bonzo Data API /market endpoint.
   * Returns supply_apy and available_liquidity.usd_display directly.
   * No Mirror Node contract calls or CoinGecko needed.
   */
  private async fetchMainnetVaults(): Promise<VaultInfo[]> {
    const url = `${this.dataApiUrl}/market`;
    console.log(`[BonzoClient] Fetching live data from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bonzo Data API returned ${response.status}`);
    }

    const data = (await response.json()) as BonzoMarketResponse;
    console.log(
      `[BonzoClient] Fetched ${data.reserves.length} reserves from Bonzo (${data.network_name})`
    );

    const activeReserves = data.reserves.filter((r) => r.active && !r.frozen);
    const vaults: VaultInfo[] = [];

    for (const reserve of activeReserves) {
      // Parse TVL from usd_display (e.g., "7,070,756.90" → 7070756.90)
      const tvlUsd = this.parseUsdDisplay(reserve.available_liquidity.usd_display);

      // Parse liquidity in token units
      const liquidityDepth = parseFloat(reserve.available_liquidity.token_display) || 0;

      vaults.push({
        address: reserve.hts_address,
        evmAddress: reserve.evm_address,
        symbol: reserve.symbol,
        decimals: reserve.decimals,
        name: `${reserve.symbol} Supply Pool`,
        tokenPair: `${reserve.symbol}/USD`,
        apy: reserve.supply_apy, // Already a percentage from the API
        tvl: tvlUsd,
        riskLevel: this.assessRisk(reserve.ltv),
        liquidityDepth,
        lastHarvest: data.timestamp,
        rewardToken: reserve.symbol,
      });
    }

    return vaults;
  }

  /**
   * Build testnet vault data from hardcoded reserves + fallback APYs.
   */
  private buildTestnetVaults(): VaultInfo[] {
    const activeReserves = TESTNET_RESERVES.filter((r) => r.active && !r.frozen);
    console.log(
      `[BonzoClient] Using ${activeReserves.length} hardcoded testnet reserves`
    );

    return activeReserves.map((reserve) => {
      const fallback = TESTNET_FALLBACK_APYS[reserve.symbol];
      return {
        address: reserve.hts_address,
        evmAddress: reserve.evm_address,
        symbol: reserve.symbol,
        decimals: reserve.decimals,
        name: `${reserve.symbol} Supply Pool`,
        tokenPair: `${reserve.symbol}/USD`,
        apy: fallback?.supplyApy || 0,
        tvl: fallback?.tvlUsd || 0,
        riskLevel: this.assessRisk(reserve.ltv),
        liquidityDepth: 0,
        lastHarvest: new Date().toISOString(),
        rewardToken: reserve.symbol,
      };
    });
  }

  /**
   * Parse Bonzo's usd_display format to number.
   * e.g., "7,070,756.90" → 7070756.90
   */
  private parseUsdDisplay(display: string): number {
    if (!display) return 0;
    const cleaned = display.replace(/,/g, '').replace(/\$/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Map Bonzo LTV ratio to risk level.
   * Higher LTV = protocol considers asset safer (allows more borrowing).
   */
  private assessRisk(ltv: number): RiskTolerance {
    if (ltv >= 0.7) return 'conservative';
    if (ltv >= 0.4) return 'moderate';
    return 'aggressive';
  }
}
