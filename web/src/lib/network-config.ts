'use client';

/**
 * Frontend-safe network configuration for YieldMind.
 *
 * Reads localStorage (runtime toggle) first, then NEXT_PUBLIC_HEDERA_NETWORK,
 * defaulting to 'mainnet'. No server-only dependencies — safe for 'use client'.
 */

export type HederaNetwork = 'testnet' | 'mainnet';

export interface FrontendNetworkConfig {
  network: HederaNetwork;
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  mirrorNodeUrl: string;
  hashscanBaseUrl: string;
  bonzoLendingPoolAddress: string;
  /** Bonzo WETHGateway — required for native HBAR deposits */
  wethGatewayAddress: string;
}

// ---------------------------------------------------------------------------
// Hardcoded address maps — both networks are always available
// ---------------------------------------------------------------------------

const BONZO_LENDING_POOLS: Record<HederaNetwork, string> = {
  testnet: '0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2',
  mainnet: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc',
};

const WETH_GATEWAYS: Record<HederaNetwork, string> = {
  testnet: '0x16197Ef10F26De77C9873d075f8774BdEc20A75d',
  mainnet: '0x9a601543e9264255BebB20Cef0E7924e97127105',
};

/** YieldMindVault only exists on testnet */
const VAULT_ADDRESSES: Record<HederaNetwork, string> = {
  testnet: '0x29d115707bEe4adAa159Fe757B7dA4ffF8cc432A',
  mainnet: '',
};

const CONFIGS: Record<HederaNetwork, Omit<FrontendNetworkConfig, 'bonzoLendingPoolAddress' | 'wethGatewayAddress'>> = {
  testnet: {
    network: 'testnet',
    chainId: 296,
    chainIdHex: '0x128',
    chainName: 'Hedera Testnet',
    rpcUrl: 'https://testnet.hashio.io/api',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    hashscanBaseUrl: 'https://hashscan.io/testnet',
  },
  mainnet: {
    network: 'mainnet',
    chainId: 295,
    chainIdHex: '0x127',
    chainName: 'Hedera Mainnet',
    rpcUrl: 'https://mainnet.hashio.io/api',
    mirrorNodeUrl: 'https://mainnet.mirrornode.hedera.com',
    hashscanBaseUrl: 'https://hashscan.io/mainnet',
  },
};

const LS_KEY = 'ym_network';

let _cached: FrontendNetworkConfig | null = null;

/**
 * Read the active network. Priority: localStorage → env var → 'mainnet'.
 */
export function getCurrentNetwork(): HederaNetwork {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'testnet' || stored === 'mainnet') return stored;
  }
  const env = process.env.NEXT_PUBLIC_HEDERA_NETWORK;
  if (env === 'testnet' || env === 'mainnet') return env;
  return 'mainnet';
}

/**
 * Switch the active network. Saves to localStorage and busts the config cache.
 * Caller should reload the page afterwards so all module-level values reinitialize.
 */
export function setNetwork(network: HederaNetwork): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_KEY, network);
  }
  _cached = null;
}

export function getNetworkConfig(): FrontendNetworkConfig {
  if (_cached) return _cached;

  const network = getCurrentNetwork();
  const base = CONFIGS[network];

  _cached = {
    ...base,
    mirrorNodeUrl: process.env.NEXT_PUBLIC_MIRROR_NODE_URL || base.mirrorNodeUrl,
    bonzoLendingPoolAddress:
      process.env.NEXT_PUBLIC_BONZO_LENDING_POOL_ADDRESS || BONZO_LENDING_POOLS[network],
    wethGatewayAddress:
      process.env.NEXT_PUBLIC_BONZO_WETH_GATEWAY_ADDRESS || WETH_GATEWAYS[network],
  };

  return _cached;
}

/**
 * Get the YieldMindVault address for the current network.
 * Returns empty string on mainnet (vault only exists on testnet).
 */
export function getVaultAddress(): string {
  const network = getCurrentNetwork();
  return process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || VAULT_ADDRESSES[network];
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function hashscanTxUrl(txId: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/transaction/${txId}`;
}

export function hashscanAccountUrl(address: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/account/${address}`;
}

export function hashscanContractUrl(address: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/contract/${address}`;
}
