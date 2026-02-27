/**
 * Centralized network configuration for YieldMind.
 *
 * SPLIT NETWORK MODE:
 * - HCS (topic creation, message publishing) runs on HEDERA_NETWORK (testnet).
 *   This needs a funded Hedera account. Testnet HBAR is free via faucet.
 * - Bonzo data, deposits, and Mirror Node verification run on BONZO_NETWORK (mainnet).
 *   These are HTTP-only calls (no account needed) or user-signed via MetaMask.
 *
 * This split lets us demo real mainnet Bonzo deposits with HCS transparency
 * logging on testnet — no mainnet HBAR needed for the backend.
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

const ALL_CONFIGS: Record<HederaNetwork, NetworkConfig> = {
  testnet: TESTNET_CONFIG,
  mainnet: MAINNET_CONFIG,
};

let _cachedConfig: NetworkConfig | null = null;
let _cachedBonzoConfig: NetworkConfig | null = null;

/**
 * Returns the HCS / Hedera account network config.
 * Controls: topic creation, message publishing, HBAR transfers.
 * Reads from HEDERA_NETWORK env var (defaults to 'testnet').
 */
export function getNetworkConfig(): NetworkConfig {
  if (_cachedConfig) return _cachedConfig;

  const network = (
    process.env.HEDERA_NETWORK ||
    process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
    'testnet'
  ) as HederaNetwork;

  const base = { ...ALL_CONFIGS[network] };

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

/**
 * Returns the Bonzo / deposit network config.
 * Controls: vault data fetching, LendingPool calls, Mirror Node tx verification.
 *
 * Reads from BONZO_NETWORK env var (defaults to 'mainnet').
 * This is independent of HEDERA_NETWORK so that HCS can run on testnet
 * while Bonzo data and deposits happen on mainnet.
 */
export function getBonzoNetworkConfig(): NetworkConfig {
  if (_cachedBonzoConfig) return _cachedBonzoConfig;

  const network = (
    process.env.BONZO_NETWORK || 'mainnet'
  ) as HederaNetwork;

  const base = { ...ALL_CONFIGS[network] };

  // Allow env overrides for Bonzo-specific values
  base.bonzo = {
    ...base.bonzo,
    lendingPoolEvmAddress:
      process.env.BONZO_LENDING_POOL_EVM_ADDRESS ||
      base.bonzo.lendingPoolEvmAddress,
    protocolDataProviderAddress:
      process.env.BONZO_PROTOCOL_DATA_PROVIDER ||
      base.bonzo.protocolDataProviderAddress,
  };

  _cachedBonzoConfig = base;
  return base;
}

/** Reset cached config (useful for testing) */
export function resetNetworkConfig(): void {
  _cachedConfig = null;
  _cachedBonzoConfig = null;
}

// ---------------------------------------------------------------------------
// URL helpers — use Bonzo network for HashScan (deposit txs are on mainnet)
// ---------------------------------------------------------------------------

export function getHashscanTransactionUrl(txId: string): string {
  return `${getBonzoNetworkConfig().hashscanBaseUrl}/transaction/${txId}`;
}

export function getHashscanAccountUrl(address: string): string {
  return `${getBonzoNetworkConfig().hashscanBaseUrl}/account/${address}`;
}

export function getHashscanContractUrl(address: string): string {
  return `${getBonzoNetworkConfig().hashscanBaseUrl}/contract/${address}`;
}
