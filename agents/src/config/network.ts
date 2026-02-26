/**
 * Centralized network configuration for YieldMind.
 *
 * All network-specific values (URLs, contract addresses, chain IDs)
 * are defined here. Switching between testnet and mainnet is controlled
 * by the HEDERA_NETWORK environment variable.
 */

export type HederaNetwork = 'testnet' | 'mainnet';

export interface BonzoConfig {
  /** Bonzo data API for reserve metadata */
  dataApiUrl: string;
  /** Bonzo LendingPool Hedera-native address (0.0.xxx) */
  lendingPoolAddress: string;
  /** Bonzo LendingPool EVM address (0x...) */
  lendingPoolEvmAddress: string;
  /** Bonzo ProtocolDataProvider EVM address for on-chain reads */
  protocolDataProviderAddress: string;
  /** Bonzo WETHGateway EVM address — required for native HBAR deposits */
  wethGatewayAddress: string;
}

export interface NetworkConfig {
  network: HederaNetwork;
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  mirrorNodeUrl: string;
  hashscanBaseUrl: string;
  bonzo: BonzoConfig;
}

const TESTNET_CONFIG: NetworkConfig = {
  network: 'testnet',
  chainId: 296,
  chainIdHex: '0x128',
  chainName: 'Hedera Testnet',
  rpcUrl: 'https://testnet.hashio.io/api',
  mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
  hashscanBaseUrl: 'https://hashscan.io/testnet',
  bonzo: {
    dataApiUrl: '', // Testnet data API is unavailable — uses hardcoded reserves
    lendingPoolAddress: '0.0.4999355',
    lendingPoolEvmAddress: '0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2',
    protocolDataProviderAddress: '0x121A2AFFA5f595175E60E01EAeF0deC43Cc3b024',
    wethGatewayAddress: '0x16197Ef10F26De77C9873d075f8774BdEc20A75d',
  },
};

const MAINNET_CONFIG: NetworkConfig = {
  network: 'mainnet',
  chainId: 295,
  chainIdHex: '0x127',
  chainName: 'Hedera Mainnet',
  rpcUrl: 'https://mainnet.hashio.io/api',
  mirrorNodeUrl: 'https://mainnet.mirrornode.hedera.com',
  hashscanBaseUrl: 'https://hashscan.io/mainnet',
  bonzo: {
    dataApiUrl: 'https://mainnet-data-staging.bonzo.finance',
    lendingPoolAddress: '0.0.7308459',
    lendingPoolEvmAddress: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc',
    protocolDataProviderAddress: '0x78feDC4D7010E409A0c0c7aF964cc517D3dCde18',
    wethGatewayAddress: '0x9a601543e9264255BebB20Cef0E7924e97127105',
  },
};

let _cachedConfig: NetworkConfig | null = null;

/**
 * Returns the network configuration for the current environment.
 * Reads HEDERA_NETWORK (backend) or NEXT_PUBLIC_HEDERA_NETWORK (frontend).
 * Supports env overrides for individual values.
 */
export function getNetworkConfig(): NetworkConfig {
  if (_cachedConfig) return _cachedConfig;

  const network = (
    process.env.HEDERA_NETWORK ||
    process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
    'testnet'
  ) as HederaNetwork;

  const base = network === 'mainnet' ? { ...MAINNET_CONFIG } : { ...TESTNET_CONFIG };

  // Allow env overrides
  base.mirrorNodeUrl =
    process.env.HEDERA_MIRROR_NODE_URL ||
    process.env.NEXT_PUBLIC_MIRROR_NODE_URL ||
    base.mirrorNodeUrl;

  base.bonzo = {
    ...base.bonzo,
    lendingPoolEvmAddress:
      process.env.BONZO_LENDING_POOL_EVM_ADDRESS ||
      process.env.NEXT_PUBLIC_BONZO_LENDING_POOL_ADDRESS ||
      base.bonzo.lendingPoolEvmAddress,
    protocolDataProviderAddress:
      process.env.BONZO_PROTOCOL_DATA_PROVIDER ||
      base.bonzo.protocolDataProviderAddress,
  };

  _cachedConfig = base;
  return base;
}

/** Reset cached config (useful for testing) */
export function resetNetworkConfig(): void {
  _cachedConfig = null;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function getHashscanTransactionUrl(txId: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/transaction/${txId}`;
}

export function getHashscanAccountUrl(address: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/account/${address}`;
}

export function getHashscanContractUrl(address: string): string {
  return `${getNetworkConfig().hashscanBaseUrl}/contract/${address}`;
}
