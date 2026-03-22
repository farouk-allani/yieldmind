'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from './wallet-context';
import { getNetworkConfig, getCurrentNetwork } from './network-config';

export interface BonzoPosition {
  symbol: string;
  /** Display symbol (HBAR instead of WHBAR) */
  displaySymbol: string;
  decimals: number;
  /** Raw balance in smallest unit */
  balanceRaw: bigint;
  /** Human-readable balance */
  balance: number;
  /** Supply APY as percentage */
  supplyApy: number;
  /** USD value (approximate) */
  usdValue: number;
  /** aToken EVM address */
  aTokenAddress: string;
  /** Underlying asset EVM address */
  assetAddress: string;
}

export interface BonzoVaultPosition {
  /** Vault name (e.g., "USDC-HBAR") */
  name: string;
  /** Vault EVM address */
  vaultAddress: string;
  /** User's vault share token balance (human-readable) */
  shares: number;
  /** Estimated USD value of the position */
  usdValue: number;
  /** Vault APY */
  apy: number;
  /** Vault type */
  type: 'single-asset-dex' | 'dual-asset-dex' | 'leveraged-lst';
}

export interface BonzoPositionsSummary {
  positions: BonzoPosition[];
  vaultPositions: BonzoVaultPosition[];
  totalUsdValue: number;
  totalHbarValue: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Bonzo aToken addresses (mainnet) — from Bonzo Data API /market endpoint
// We fetch these dynamically but keep a static map for the most common ones as fallback
const DISPLAY_SYMBOL: Record<string, string> = {
  WHBAR: 'HBAR',
};

/**
 * Call a contract's balanceOf(address) via Mirror Node simulation.
 * Works for both WalletConnect and MetaMask users — no signer needed.
 */
async function queryBalanceOf(
  mirrorNodeUrl: string,
  contractEvmAddress: string,
  userEvmAddress: string,
): Promise<bigint> {
  // balanceOf(address) selector = 0x70a08231
  const userPadded = userEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
  const calldata = `0x70a08231${userPadded}`;

  const res = await fetch(`${mirrorNodeUrl}/api/v1/contracts/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: calldata,
      to: contractEvmAddress,
      estimate: false,
      blockNumber: 'latest',
    }),
  });

  if (!res.ok) return BigInt(0);
  const data = await res.json() as { result?: string };
  const result = data.result || '0x';
  if (result.length <= 2) return BigInt(0);
  return BigInt(result);
}

/**
 * Fetch all Bonzo reserves from the Data API and query user balances.
 */
async function fetchBonzoPositions(
  mirrorNodeUrl: string,
  userEvmAddress: string,
): Promise<{ positions: BonzoPosition[]; totalUsd: number; totalHbar: number }> {
  // Fetch market data from Bonzo
  const marketRes = await fetch('https://mainnet-data-staging.bonzo.finance/market');
  if (!marketRes.ok) throw new Error('Failed to fetch Bonzo market data');

  const marketData = await marketRes.json() as {
    reserves: Array<{
      symbol: string;
      decimals: number;
      atoken_address: string;
      evm_address: string;
      supply_apy: number;
      price_usd_wad: string;
      price_weibars: string;
    }>;
  };

  // Query aToken balances in parallel
  const balancePromises = marketData.reserves.map(async (reserve) => {
    const balance = await queryBalanceOf(
      mirrorNodeUrl,
      reserve.atoken_address,
      userEvmAddress,
    );
    return { reserve, balance };
  });

  const results = await Promise.all(balancePromises);

  const positions: BonzoPosition[] = [];
  let totalUsd = 0;
  let totalHbar = 0;

  for (const { reserve, balance } of results) {
    if (balance === BigInt(0)) continue;

    const balanceNum = Number(balance) / Math.pow(10, reserve.decimals);
    const priceUsd = Number(BigInt(reserve.price_usd_wad)) / 1e18;
    const priceHbar = Number(BigInt(reserve.price_weibars)) / 1e18;
    const usdValue = balanceNum * priceUsd;
    const hbarValue = balanceNum * priceHbar;

    positions.push({
      symbol: reserve.symbol,
      displaySymbol: DISPLAY_SYMBOL[reserve.symbol] || reserve.symbol,
      decimals: reserve.decimals,
      balanceRaw: balance,
      balance: balanceNum,
      supplyApy: reserve.supply_apy,
      usdValue,
      aTokenAddress: reserve.atoken_address,
      assetAddress: reserve.evm_address,
    });

    totalUsd += usdValue;
    totalHbar += hbarValue;
  }

  // Sort by USD value descending
  positions.sort((a, b) => b.usdValue - a.usdValue);

  return { positions, totalUsd, totalHbar };
}

/**
 * Fetch user positions from Bonzo Vaults (auto-compounding vaults).
 * Queries vault contract balanceOf() for user's share tokens.
 */
async function fetchBonzoVaultPositions(
  mirrorNodeUrl: string,
  userEvmAddress: string,
): Promise<BonzoVaultPosition[]> {
  // Fetch vault data from Bonzo Vaults API
  let vaults: Array<{
    name: string;
    contractAddress: string;
    apy: string;
    tvl: string;
    assets: Array<{ symbol: string; decimals: number; price: string }>;
    vaultType: string;
    isHidden: boolean;
  }> = [];

  try {
    const res = await fetch('https://mainnet-vaults.bonzo.finance/v1/api/vaults');
    if (res.ok) {
      const data = await res.json() as { vaults: typeof vaults };
      vaults = data.vaults.filter((v) => !v.isHidden);
    }
  } catch {
    return [];
  }

  if (vaults.length === 0) return [];

  // Query balanceOf on each vault contract in parallel
  const results = await Promise.all(
    vaults.map(async (vault) => {
      const balance = await queryBalanceOf(mirrorNodeUrl, vault.contractAddress, userEvmAddress);
      return { vault, balance };
    })
  );

  const positions: BonzoVaultPosition[] = [];

  for (const { vault, balance } of results) {
    if (balance === BigInt(0)) continue;

    // Vault share tokens use 18 decimals (standard ERC-20 vault pattern)
    const shares = Number(balance) / 1e18;

    // Estimate USD value from TVL and total shares
    // Simple approximation: shares * (TVL / totalSupply)
    // Since we don't have totalSupply easily, use share value ≈ TVL proportion
    // For display purposes, try to get pricePerShare if available
    let usdValue = 0;
    try {
      // Query pricePerFullShare() = 0x77c7b8fc
      const ppsRes = await fetch(`${mirrorNodeUrl}/api/v1/contracts/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: '0x77c7b8fc',
          to: vault.contractAddress,
          estimate: false,
          blockNumber: 'latest',
        }),
      });

      if (ppsRes.ok) {
        const ppsData = await ppsRes.json() as { result?: string };
        const pps = ppsData.result && ppsData.result.length > 2
          ? Number(BigInt(ppsData.result)) / 1e18
          : 1;
        // pps is ratio of underlying per share
        // For dual-asset vaults, underlying value ≈ pps * shares * asset0Price
        const asset0Price = vault.assets[0] ? parseFloat(vault.assets[0].price) || 0 : 0;
        if (asset0Price > 0) {
          usdValue = shares * pps * asset0Price;
        } else {
          // Fallback: estimate from TVL
          const tvl = parseFloat(vault.tvl) || 0;
          usdValue = tvl > 0 ? shares * pps : 0;
        }
      }
    } catch {
      // Fallback: just show shares
    }

    const vaultType = vault.assets.length >= 2 ? 'dual-asset-dex' as const : 'single-asset-dex' as const;

    positions.push({
      name: vault.name,
      vaultAddress: vault.contractAddress,
      shares,
      usdValue,
      apy: parseFloat(vault.apy) || 0,
      type: vaultType,
    });
  }

  return positions;
}

/**
 * Hook to fetch user positions from Bonzo Finance on mainnet.
 * Uses Mirror Node contract call simulation — works with any wallet type.
 */
export function useBonzoPositions(): BonzoPositionsSummary {
  const { address, accountId, isConnected } = useWallet();
  const [positions, setPositions] = useState<BonzoPosition[]>([]);
  const [vaultPositions, setVaultPositions] = useState<BonzoVaultPosition[]>([]);
  const [totalUsdValue, setTotalUsdValue] = useState(0);
  const [totalHbarValue, setTotalHbarValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Use refs to avoid dependency cycles
  const addressRef = useRef(address);
  const accountIdRef = useRef(accountId);
  addressRef.current = address;
  accountIdRef.current = accountId;

  // Guard against concurrent refresh calls
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;

    const network = getCurrentNetwork();
    if (network !== 'mainnet') {
      // Only set state if positions exist (avoid re-render from [] → [])
      setPositions((prev) => (prev.length === 0 ? prev : []));
      setTotalUsdValue(0);
      setTotalHbarValue(0);
      return;
    }

    // Resolve EVM address inline
    let evmAddress = addressRef.current;
    if (!evmAddress && accountIdRef.current) {
      const config = getNetworkConfig();
      try {
        const res = await fetch(`${config.mirrorNodeUrl}/api/v1/accounts/${accountIdRef.current}`);
        if (res.ok) {
          const data = await res.json() as { evm_address?: string };
          evmAddress = data.evm_address || null;
        }
      } catch { /* ignore */ }
    }
    if (!evmAddress) return;

    refreshingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const config = getNetworkConfig();
      const [lendResult, vaultResult] = await Promise.all([
        fetchBonzoPositions(config.mirrorNodeUrl, evmAddress),
        fetchBonzoVaultPositions(config.mirrorNodeUrl, evmAddress).catch(() => [] as BonzoVaultPosition[]),
      ]);
      setPositions(lendResult.positions);
      setVaultPositions(vaultResult);
      const vaultUsd = vaultResult.reduce((sum, v) => sum + v.usdValue, 0);
      setTotalUsdValue(lendResult.totalUsd + vaultUsd);
      setTotalHbarValue(lendResult.totalHbar);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch positions';
      setError(msg);
      console.error('[BonzoPositions] Error:', err);
    } finally {
      setIsLoading(false);
      refreshingRef.current = false;
    }
  }, []); // stable — no deps, uses refs

  // Auto-fetch once on connect (not on every render)
  useEffect(() => {
    if (isConnected && !hasFetched) {
      setHasFetched(true);
      refresh();
    }
    if (!isConnected) {
      setHasFetched(false);
      setPositions([]);
      setVaultPositions([]);
      setTotalUsdValue(0);
      setTotalHbarValue(0);
    }
  }, [isConnected, hasFetched, refresh]);

  return { positions, vaultPositions, totalUsdValue, totalHbarValue, isLoading, error, refresh };
}
