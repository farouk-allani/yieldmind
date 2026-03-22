import type { BonzoVaultInfo, RiskTolerance } from '../types/index.js';
import { SINGLE_ASSET_DEX_VAULTS, LEVERAGED_LST_VAULTS, getToken } from '../config/bonzo-contracts.js';

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
   * Get all available Bonzo Vaults — combines API data + on-chain single-asset vaults.
   *
   * The Bonzo Vaults API only returns 4 dual-asset vaults, but there are 15+
   * single-asset vaults deployed on mainnet (from bonzo-contracts.ts).
   * We merge both sources so the strategist can recommend single-asset vaults
   * for users who have only one token (e.g., "yield on 10 HBAR").
   */
  async getVaults(): Promise<BonzoVaultInfo[]> {
    if (this.cachedVaults && Date.now() < this.cacheExpiry) {
      return this.cachedVaults;
    }

    try {
      const apiVaults = await this.fetchVaultsFromApi();
      const configVaults = this.getConfigVaults(apiVaults);
      const allVaults = [...apiVaults, ...configVaults];
      this.cachedVaults = allVaults;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      console.log(`[BonzoVaults] ${apiVaults.length} API vaults + ${configVaults.length} on-chain single-asset vaults = ${allVaults.length} total`);
      return allVaults;
    } catch (error) {
      console.error(
        '[BonzoVaults] Failed to fetch vault data:',
        error instanceof Error ? error.message : error
      );
      return this.cachedVaults || [];
    }
  }

  /**
   * Build BonzoVaultInfo entries from on-chain single-asset vault configs.
   * These vaults are deployed on mainnet but not in the Bonzo Vaults API.
   * We don't have live APY data for them, so we estimate based on the
   * paired dual-asset vault APY (single-sided earns ~40-60% of dual-sided).
   */
  private getConfigVaults(apiVaults: BonzoVaultInfo[]): BonzoVaultInfo[] {
    // Build a map of API vault addresses to avoid duplicates
    const apiAddresses = new Set(apiVaults.map((v) => v.vaultAddress.toLowerCase()));

    const configVaults: BonzoVaultInfo[] = [];

    for (const cfg of SINGLE_ASSET_DEX_VAULTS) {
      if (apiAddresses.has(cfg.vaultAddress.toLowerCase())) continue;

      const token = getToken(cfg.depositToken);
      const decimals = token?.decimals || 8;
      const displayToken = cfg.depositToken === 'WHBAR' ? 'HBAR' : cfg.depositToken;
      const displayPaired = cfg.pairedToken === 'WHBAR' ? 'HBAR' : cfg.pairedToken;

      // Estimate APY: find the matching dual-asset vault from API and use ~50% of its APY
      const matchingDual = apiVaults.find((v) => {
        const name = v.name.toUpperCase();
        return name.includes(displayToken) || name.includes(cfg.depositToken);
      });
      const estimatedApy = matchingDual ? matchingDual.apy * 0.45 : 5.0;

      configVaults.push({
        vaultAddress: cfg.vaultAddress,
        strategyAddress: cfg.strategyAddress,
        type: 'single-asset-dex',
        name: `${displayToken} (paired with ${displayPaired})`,
        depositToken: displayToken,
        pairedToken: displayPaired,
        depositDecimals: decimals,
        apy: estimatedApy,
        tvl: 0, // Unknown — not in API
        riskLevel: cfg.volatility.includes('high') ? 'aggressive' : 'moderate',
        volatility: cfg.volatility,
        safetyScore: 7,
      });
    }

    // Add leveraged LST vaults
    for (const cfg of LEVERAGED_LST_VAULTS) {
      if (apiAddresses.has(cfg.vaultAddress.toLowerCase())) continue;
      const token = getToken(cfg.depositToken);
      configVaults.push({
        vaultAddress: cfg.vaultAddress,
        strategyAddress: cfg.strategyAddress,
        type: 'leveraged-lst',
        name: cfg.name,
        depositToken: cfg.depositToken,
        depositDecimals: token?.decimals || 8,
        apy: 8.0, // Estimate for leveraged LST
        tvl: 0,
        riskLevel: 'moderate',
        volatility: 'low',
        safetyScore: 8,
      });
    }

    return configVaults;
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
      lastHarvest: vault.lastHarvest || undefined,
      safetyScore: vault.safetyScore,
      // Token addresses for dual-asset deposits (deposit(uint256,uint256,uint256))
      token0Address: asset0.address,
      token1Address: isDualAsset ? asset1.address : undefined,
    };
  }

  /**
   * Infer vault type from API data.
   * Staking pairs (BONZO-XBONZO, SAUCE-XSAUCE) are treated as single-asset
   * because the "X" token is just the staked version of the same token.
   */
  private inferVaultType(vault: BonzoVaultsApiVault): 'single-asset-dex' | 'dual-asset-dex' | 'leveraged-lst' {
    if (vault.assets.length >= 2) {
      // Check if this is a staking pair (e.g., BONZO-XBONZO, SAUCE-XSAUCE)
      const symbols = vault.assets.map((a) => a.symbol.toUpperCase());
      const isStakingPair = symbols.some((s) =>
        symbols.some((other) => other === `X${s}` || s === `X${other}`)
      );
      if (isStakingPair) return 'single-asset-dex';
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
