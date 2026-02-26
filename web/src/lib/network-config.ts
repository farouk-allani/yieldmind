'use client';

/**
 * Frontend-safe network configuration for YieldMind.
 *
 * Reads NEXT_PUBLIC_HEDERA_NETWORK to determine which chain to use.
 * No server-only dependencies — safe for 'use client' components.
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

let _cached: FrontendNetworkConfig | null = null;

export function getNetworkConfig(): FrontendNetworkConfig {
  if (_cached) return _cached;

  const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet') as HederaNetwork;
  const base = CONFIGS[network];

  const WETH_GATEWAYS: Record<HederaNetwork, string> = {
    testnet: '0x16197Ef10F26De77C9873d075f8774BdEc20A75d',
    mainnet: '0x9a601543e9264255BebB20Cef0E7924e97127105',
  };

  _cached = {
    ...base,
    mirrorNodeUrl: process.env.NEXT_PUBLIC_MIRROR_NODE_URL || base.mirrorNodeUrl,
    bonzoLendingPoolAddress:
      process.env.NEXT_PUBLIC_BONZO_LENDING_POOL_ADDRESS || '',
    wethGatewayAddress:
      process.env.NEXT_PUBLIC_BONZO_WETH_GATEWAY_ADDRESS || WETH_GATEWAYS[network],
  };

  return _cached;
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
