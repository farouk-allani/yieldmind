import type { BonzoVaultInfo, RiskTolerance } from '../types/index.js';

// ── Bonzo Vaults API response types ─────────────────────────────────
// Source: https://mainnet-vaults.bonzo.finance/v1/api/vaults

interface BonzoVaultsApiAsset {
  symbol: string;
  address: string;
  contractId: string;
  decimals: number;
  price: string;
}

interface BonzoVaultsApiVault {
  id: string;
  name: string;
  protocols: string[];
  strategyType: string;
  network: string;
  assets: BonzoVaultsApiAsset[];
  apy: string;
  totalApy: string;
  harvestApy7d: string;
  harvestApy30d: string;
  tvl: string;
  contractAddress: string;
  strategyAddress: string;
  contractId: string;
  strategyContractId: string;
  vaultType: string;
  isHidden: boolean;
  lastHarvest: string;
  safetyScore: number;
  description: string;
  fees: {
    deposit: number;
    withdrawal: number;
    performance: number;
  };
  tabs?: {
    risks?: Array<{
      complexity: string;
      volatility: string;
      risk: string;
    }>;
  };
}

interface BonzoVaultsApiResponse {
  summary: {
    totalValueLocked: string;
    vaultCount: number;
    averageApy: string;
  };
  vaults: BonzoVaultsApiVault[];
}

const BONZO_VAULTS_API = 'https://mainnet-vaults.bonzo.finance/v1/api/vaults';

/**
 * BonzoVaultsClient — Fetches live data from the Bonzo Vaults API.
 *
 * Unlike BonzoVaultClient (which handles Bonzo Lend/LendingPool),
 * this client handles the auto-compounding vault products that use
 * concentrated liquidity on SaucerSwap V2.
 *
 * Data source: https://mainnet-vaults.bonzo.finance/v1/api/vaults
 * Returns live APY (from harvest history), TVL, assets, and vault metadata.
 */
export class BonzoVaultsClient {
  private cachedVaults: BonzoVaultInfo[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all available Bonzo Vaults with live API data.
   */
  async getVaults(): Promise<BonzoVaultInfo[]> {
    if (this.cachedVaults && Date.now() < this.cacheExpiry) {
      return this.cachedVaults;
    }

    try {
      const vaults = await this.fetchVaultsFromApi();
      this.cachedVaults = vaults;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      console.log(`[BonzoVaults] Fetched ${vaults.length} vaults from Bonzo Vaults API`);
      return vaults;
    } catch (error) {
      console.error(
        '[BonzoVaults] Failed to fetch vault data:',
        error instanceof Error ? error.message : error
      );
      return this.cachedVaults || [];
    }
  }

  /**
   * Fetch live vault data from the Bonzo Vaults API.
   */
  private async fetchVaultsFromApi(): Promise<BonzoVaultInfo[]> {
    const response = await fetch(BONZO_VAULTS_API);
    if (!response.ok) {
      throw new Error(`Bonzo Vaults API returned ${response.status}`);
    }

    const data = (await response.json()) as BonzoVaultsApiResponse;
    console.log(
      `[BonzoVaults] API returned ${data.vaults.length} vaults, ` +
      `TVL $${parseFloat(data.summary.totalValueLocked).toFixed(0)}, ` +
      `avg APY ${data.summary.averageApy}%`
    );

    return data.vaults
      .filter((v) => !v.isHidden)
      .map((v) => this.mapApiVault(v))
      .filter((v): v is BonzoVaultInfo => v !== null);
  }

  /**
   * Map a Bonzo Vaults API vault to our BonzoVaultInfo type.
   */
  private mapApiVault(vault: BonzoVaultsApiVault): BonzoVaultInfo | null {
    if (vault.assets.length === 0) return null;

    const asset0 = vault.assets[0];
    const asset1 = vault.assets[1];
    const isDualAsset = vault.assets.length >= 2;

    // Determine vault type from the API data
    const type = this.inferVaultType(vault);

    // Build deposit token display
    const depositToken = isDualAsset
      ? `${asset0.symbol}-${asset1.symbol}`
      : asset0.symbol;

    // Parse APY — the API returns it as a percentage string (e.g. "57.78")
    const apy = parseFloat(vault.apy) || 0;

    // Parse TVL in USD
    const tvl = parseFloat(vault.tvl) || 0;

    // Risk from API tabs.risks or infer from volatility
    const riskLevel = this.inferRisk(vault);

    // Volatility from API
    const volatility = vault.tabs?.risks?.[0]?.volatility || 'medium';

    return {
      vaultAddress: vault.contractAddress,
      strategyAddress: vault.strategyAddress,
      type,
      name: vault.name,
      depositToken,
      pairedToken: isDualAsset ? asset1.symbol : undefined,
      depositDecimals: asset0.decimals,
      apy,
      tvl,
      riskLevel,
      volatility,
    };
  }

  /**
   * Infer vault type from API data.
   * All current Bonzo Vaults are concentrated liquidity (dual asset).
   */
  private inferVaultType(vault: BonzoVaultsApiVault): 'single-asset-dex' | 'dual-asset-dex' | 'leveraged-lst' {
    // All current Bonzo Vaults are dual-asset concentrated liquidity
    if (vault.assets.length >= 2) {
      return 'dual-asset-dex';
    }
    return 'single-asset-dex';
  }

  /**
   * Infer risk level from the API's safety/risk data.
   */
  private inferRisk(vault: BonzoVaultsApiVault): RiskTolerance {
    const riskInfo = vault.tabs?.risks?.[0];
    if (riskInfo) {
      switch (riskInfo.risk) {
        case 'low': return 'conservative';
        case 'medium': return 'moderate';
        case 'high': return 'aggressive';
      }
    }

    // Fallback: higher APY = higher risk
    const apy = parseFloat(vault.apy) || 0;
    if (apy > 30) return 'aggressive';
    if (apy > 10) return 'moderate';
    return 'conservative';
  }
}
