import type { BonzoVaultInfo, RiskTolerance } from '../types/index.js';
import {
  BONZO_TOKENS,
  SINGLE_ASSET_DEX_VAULTS,
  DUAL_ASSET_DEX_VAULTS,
  LEVERAGED_LST_VAULTS,
  getToken,
} from '../config/bonzo-contracts.js';
import type {
  BonzoVaultConfig,
  BonzoDualVaultConfig,
  BonzoLSTVaultConfig,
  BonzoVaultVolatility,
} from '../config/bonzo-contracts.js';
import { getBonzoNetworkConfig } from '../config/network.js';
import { displaySymbol } from './vault-client.js';

/**
 * BonzoVaultsClient — Fetches data for Bonzo Vaults (Single/Dual Asset DEX, Leveraged LST).
 *
 * Unlike BonzoVaultClient (which handles Bonzo Lend/LendingPool),
 * this client handles the auto-compounding vault products that use
 * concentrated liquidity on SaucerSwap V2.
 *
 * Data sources:
 * - Vault addresses: bonzo-contracts.ts (verified from Bonzo docs)
 * - On-chain data: Hedera JSON-RPC for balance/totalSupply/pricePerShare
 * - Token decimals: bonzo-contracts.ts (verified from Bonzo Data API)
 */
export class BonzoVaultsClient {
  private readonly rpcUrl: string;
  private cachedVaults: BonzoVaultInfo[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const config = getBonzoNetworkConfig();
    this.rpcUrl = config.rpcUrl;
  }

  /**
   * Get all available Bonzo Vaults with on-chain data.
   */
  async getVaults(): Promise<BonzoVaultInfo[]> {
    if (this.cachedVaults && Date.now() < this.cacheExpiry) {
      return this.cachedVaults;
    }

    try {
      const vaults = await this.buildVaultInfos();
      this.cachedVaults = vaults;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      console.log(`[BonzoVaults] Built ${vaults.length} vault entries`);
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
   * Build vault info for all deployed vaults.
   * Fetches on-chain totalSupply for TVL estimation.
   */
  private async buildVaultInfos(): Promise<BonzoVaultInfo[]> {
    const vaults: BonzoVaultInfo[] = [];

    // Single Asset DEX vaults
    for (const vault of SINGLE_ASSET_DEX_VAULTS) {
      const info = await this.buildSingleAssetVault(vault);
      if (info) vaults.push(info);
    }

    // Dual Asset DEX vaults
    for (const vault of DUAL_ASSET_DEX_VAULTS) {
      const info = this.buildDualAssetVault(vault);
      if (info) vaults.push(info);
    }

    // Leveraged LST vaults
    for (const vault of LEVERAGED_LST_VAULTS) {
      const info = this.buildLSTVault(vault);
      if (info) vaults.push(info);
    }

    return vaults;
  }

  private async buildSingleAssetVault(
    config: BonzoVaultConfig
  ): Promise<BonzoVaultInfo | null> {
    const token = getToken(config.depositToken);
    if (!token) return null;

    const totalSupply = await this.fetchTotalSupply(config.vaultAddress);

    return {
      vaultAddress: config.vaultAddress,
      strategyAddress: config.strategyAddress,
      type: 'single-asset-dex',
      name: config.name,
      depositToken: displaySymbol(config.depositToken),
      pairedToken: displaySymbol(config.pairedToken),
      depositDecimals: token.decimals,
      apy: 0, // fetched live from vault or estimated
      tvl: totalSupply,
      riskLevel: this.volatilityToRisk(config.volatility),
      volatility: config.volatility,
    };
  }

  private buildDualAssetVault(
    config: BonzoDualVaultConfig
  ): BonzoVaultInfo | null {
    const token0 = getToken(config.token0);
    if (!token0) return null;

    return {
      vaultAddress: config.vaultAddress,
      strategyAddress: config.strategyAddress,
      type: 'dual-asset-dex',
      name: config.name,
      depositToken: `${displaySymbol(config.token0)}-${displaySymbol(config.token1)}`,
      pairedToken: undefined,
      depositDecimals: token0.decimals,
      apy: 0,
      tvl: 0,
      riskLevel: 'moderate',
      volatility: 'medium-narrow',
    };
  }

  private buildLSTVault(
    config: BonzoLSTVaultConfig
  ): BonzoVaultInfo | null {
    const token = getToken(config.depositToken);
    if (!token) return null;

    return {
      vaultAddress: config.vaultAddress,
      strategyAddress: config.strategyAddress,
      type: 'leveraged-lst',
      name: config.name,
      depositToken: displaySymbol(config.depositToken),
      depositDecimals: token.decimals,
      apy: 0,
      tvl: 0,
      riskLevel: 'moderate',
      volatility: 'medium-narrow',
    };
  }

  /**
   * Fetch totalSupply() from a vault contract via JSON-RPC.
   * Used to estimate TVL.
   */
  private async fetchTotalSupply(vaultAddress: string): Promise<number> {
    try {
      // totalSupply() selector = 0x18160ddd
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: vaultAddress, data: '0x18160ddd' }, 'latest'],
        }),
      });

      const data = await response.json() as { result?: string };
      if (data.result && data.result !== '0x') {
        return parseInt(data.result, 16);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Map vault volatility classification to risk level.
   */
  private volatilityToRisk(volatility: BonzoVaultVolatility): RiskTolerance {
    switch (volatility) {
      case 'low-ultra-tight':
        return 'conservative';
      case 'medium-narrow':
        return 'moderate';
      case 'high-medium':
      case 'high-wide':
        return 'aggressive';
      default:
        return 'moderate';
    }
  }
}
