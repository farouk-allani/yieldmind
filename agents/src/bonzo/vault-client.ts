import type { VaultInfo, RiskTolerance } from '../types/index.js';

/**
 * BonzoVaultClient — Fetches REAL data from Bonzo Finance on Hedera.
 *
 * Data flow:
 * 1. Bonzo Data API → reserve metadata (symbols, addresses, risk params)
 * 2. Hedera Mirror Node → on-chain supply APY rates via getReserveData()
 * 3. CoinGecko → USD prices for TVL calculation
 *
 * Uses mainnet data (Bonzo is only deployed on mainnet).
 * Execution happens on testnet for the hackathon demo.
 */

const BONZO_DATA_API = 'https://mainnet-data-staging.bonzo.finance';
const MIRROR_NODE = 'https://mainnet.mirrornode.hedera.com';
const PROTOCOL_DATA_PROVIDER = '0x78feDC4D7010E409A0c0c7aF964cc517D3dCde18';

interface BonzoReserve {
  id: number;
  name: string;
  symbol: string;
  coingecko_id: string;
  evm_address: string;
  hts_address: string;
  decimals: number;
  ltv: number;
  liquidation_threshold: number;
  active: boolean;
  frozen: boolean;
  variable_borrowing_enabled: boolean;
  reserve_factor: number;
}

interface BonzoDataResponse {
  chain_id: number;
  network_name: string;
  reserves: BonzoReserve[];
  timestamp: string;
}

interface ReserveRates {
  supplyApy: number;
  borrowApy: number;
  availableLiquidity: number;
}

export class BonzoVaultClient {
  private cachedVaults: VaultInfo[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch all Bonzo lending reserves with live on-chain data.
   */
  async getVaults(): Promise<VaultInfo[]> {
    if (this.cachedVaults && Date.now() < this.cacheExpiry) {
      console.log('[BonzoClient] Returning cached vault data');
      return this.cachedVaults;
    }

    try {
      // Step 1: Fetch reserve metadata from Bonzo Data API
      const response = await fetch(BONZO_DATA_API);
      if (!response.ok) {
        throw new Error(`Bonzo API returned ${response.status}`);
      }
      const data = (await response.json()) as BonzoDataResponse;
      console.log(
        `[BonzoClient] Fetched ${data.reserves.length} reserves from Bonzo (${data.network_name})`
      );

      const activeReserves = data.reserves.filter(
        (r) => r.active && !r.frozen
      );

      // Step 2: Fetch USD prices from CoinGecko
      const cgIds = activeReserves
        .map((r) => r.coingecko_id)
        .filter(Boolean)
        .join(',');
      const prices = await this.fetchPrices(cgIds);

      // Step 3: Fetch on-chain APY rates for each reserve
      const vaults: VaultInfo[] = [];
      for (const reserve of activeReserves) {
        try {
          const rates = await this.getReserveRates(
            reserve.evm_address,
            reserve.decimals
          );
          const price = prices[reserve.coingecko_id] || 0;
          const tvlUsd = rates.availableLiquidity * price;

          vaults.push({
            address: reserve.hts_address,
            name: `${reserve.symbol} Supply Pool`,
            tokenPair: `${reserve.symbol}/USD`,
            apy: rates.supplyApy,
            tvl: tvlUsd,
            riskLevel: this.assessRisk(reserve.ltv),
            liquidityDepth: rates.availableLiquidity,
            lastHarvest: data.timestamp,
            rewardToken: reserve.symbol,
          });
        } catch (error) {
          console.log(
            `[BonzoClient] Failed to get rates for ${reserve.symbol}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      console.log(
        `[BonzoClient] Built ${vaults.length} real vault entries with live APY`
      );

      this.cachedVaults = vaults;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      return vaults;
    } catch (error) {
      console.error(
        '[BonzoClient] Failed to fetch real data:',
        error instanceof Error ? error.message : error
      );
      return this.cachedVaults || [];
    }
  }

  /**
   * Read live supply/borrow APY from Bonzo's on-chain contracts
   * via Hedera Mirror Node contract call.
   *
   * Calls getReserveData(address) on the Protocol Data Provider.
   * Returns decoded rates in RAY format (1e27).
   */
  private async getReserveRates(
    tokenEvmAddress: string,
    decimals: number
  ): Promise<ReserveRates> {
    const paddedAddress = tokenEvmAddress
      .replace('0x', '')
      .padStart(64, '0');
    const callData = `0x35ea6a75${paddedAddress}`;

    const response = await fetch(`${MIRROR_NODE}/api/v1/contracts/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: callData,
        to: PROTOCOL_DATA_PROVIDER,
        estimate: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mirror Node contract call failed: ${response.status}`);
    }

    const result = (await response.json()) as { result: string };
    return this.decodeReserveData(result.result, decimals);
  }

  /**
   * Decode the ABI-encoded response from getReserveData().
   *
   * Fields (each 32 bytes / 64 hex chars):
   * [0] availableLiquidity
   * [1] totalStableDebt
   * [2] totalVariableDebt
   * [3] liquidityRate (supply APY in RAY = 1e27)
   * [4] variableBorrowRate (borrow APY in RAY)
   */
  private decodeReserveData(hex: string, decimals: number): ReserveRates {
    const clean = hex.replace('0x', '');
    const chunks: string[] = [];
    for (let i = 0; i < clean.length; i += 64) {
      chunks.push(clean.slice(i, i + 64));
    }

    const rawLiquidity = BigInt('0x' + (chunks[0] || '0'));
    const liquidityRate = BigInt('0x' + (chunks[3] || '0'));
    const variableBorrowRate = BigInt('0x' + (chunks[4] || '0'));

    const RAY = BigInt('1000000000000000000000000000'); // 1e27
    const MULTIPLIER = BigInt(10000);
    const supplyApy = Number((liquidityRate * MULTIPLIER) / RAY) / 100;
    const borrowApy = Number((variableBorrowRate * MULTIPLIER) / RAY) / 100;
    const availableLiquidity =
      Number(rawLiquidity) / Math.pow(10, decimals);

    return { supplyApy, borrowApy, availableLiquidity };
  }

  /**
   * Fetch USD prices from CoinGecko for TVL calculation.
   */
  private async fetchPrices(
    cgIds: string
  ): Promise<Record<string, number>> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd`
      );
      if (!response.ok) return {};
      const data = (await response.json()) as Record<
        string,
        { usd: number }
      >;
      const prices: Record<string, number> = {};
      for (const [id, val] of Object.entries(data)) {
        prices[id] = val.usd;
      }
      return prices;
    } catch {
      console.log('[BonzoClient] CoinGecko unavailable, TVL will show 0');
      return {};
    }
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
