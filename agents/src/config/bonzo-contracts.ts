/**
 * Bonzo Finance — Authoritative Contract & Token Registry
 *
 * SINGLE SOURCE OF TRUTH for all Bonzo addresses, token decimals, and contract IDs.
 * Agents MUST use this file — never hardcode addresses elsewhere.
 *
 * Data sources (all verified 2026-03-14):
 * - Token addresses & decimals: Bonzo Data API (mainnet-data-staging.bonzo.finance/market)
 * - Vault contracts: Bonzo docs (docs.bonzo.finance/hub/bonzo-vaults-beta)
 * - Token IDs: Hedera Mirror Node (mainnet.mirrornode.hedera.com/api/v1/tokens)
 * - wBTC/wETH decimals: On-chain decimals() call via mainnet.hashio.io
 * - JAM token: On-chain token0() call on ICHI vault contract
 */

// ============================================================
// Token Definitions — verified from Bonzo Data API + Mirror Node
// ============================================================

export interface TokenInfo {
  /** Display symbol (what users see) */
  symbol: string;
  /** Full token name */
  name: string;
  /** Token decimals — NEVER guess these */
  decimals: number;
  /** Hedera Token Service address (0.0.xxxxx) */
  htsAddress: string;
  /** EVM address (0x...) — used for contract calls */
  evmAddress: string;
  /** CoinGecko ID for price lookups (if available) */
  coingeckoId?: string;
}

/**
 * All tokens supported by Bonzo Finance on Hedera Mainnet.
 * Decimals and addresses verified from Bonzo Data API on 2026-03-14.
 */
export const BONZO_TOKENS: Record<string, TokenInfo> = {
  // --- Bonzo Lend supported tokens (from Bonzo Data API /market) ---
  WHBAR: {
    symbol: 'WHBAR',
    name: 'Wrapped Hbar',
    decimals: 8,
    htsAddress: '0.0.1456986',
    evmAddress: '0x0000000000000000000000000000000000163B5a',
    coingeckoId: 'hedera-hashgraph',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    htsAddress: '0.0.456858',
    evmAddress: '0x000000000000000000000000000000000006f89a',
    coingeckoId: 'usd-coin',
  },
  SAUCE: {
    symbol: 'SAUCE',
    name: 'SAUCE',
    decimals: 6,
    htsAddress: '0.0.731861',
    evmAddress: '0x00000000000000000000000000000000000b2aD5',
    coingeckoId: 'saucerswap',
  },
  XSAUCE: {
    symbol: 'XSAUCE',
    name: 'xSAUCE',
    decimals: 6,
    htsAddress: '0.0.1460200',
    evmAddress: '0x00000000000000000000000000000000001647e8',
    coingeckoId: 'xsauce',
  },
  HBARX: {
    symbol: 'HBARX',
    name: 'HBARX',
    decimals: 8,
    htsAddress: '0.0.834116',
    evmAddress: '0x00000000000000000000000000000000000cbA44',
    coingeckoId: 'hbarx',
  },
  BONZO: {
    symbol: 'BONZO',
    name: 'BONZO',
    decimals: 8,
    htsAddress: '0.0.8279134',
    evmAddress: '0x00000000000000000000000000000000007e545e',
  },
  XBONZO: {
    symbol: 'xBONZO',
    name: 'xBONZO',
    decimals: 8,
    htsAddress: '0.0.8490541',
    evmAddress: '0x0000000000000000000000000000000000818e2d',
  },
  KARATE: {
    symbol: 'KARATE',
    name: 'Karate',
    decimals: 8,
    htsAddress: '0.0.2283230',
    evmAddress: '0x000000000000000000000000000000000022D6de',
    coingeckoId: 'karate-combat',
  },
  DOVU: {
    symbol: 'DOVU',
    name: 'Dovu',
    decimals: 8,
    htsAddress: '0.0.3716059',
    evmAddress: '0x000000000000000000000000000000000038b3db',
  },
  HST: {
    symbol: 'HST',
    name: 'HeadStarter',
    decimals: 8,
    htsAddress: '0.0.968069',
    evmAddress: '0x00000000000000000000000000000000000Ec585',
  },
  PACK: {
    symbol: 'PACK',
    name: 'PACK',
    decimals: 6,
    htsAddress: '0.0.4794920',
    evmAddress: '0x0000000000000000000000000000000000492A28',
  },
  STEAM: {
    symbol: 'STEAM',
    name: 'STEAM',
    decimals: 2,
    htsAddress: '0.0.3210123',
    evmAddress: '0x000000000000000000000000000000000030fb8b',
  },
  GRELF: {
    symbol: 'GRELF',
    name: 'GRELF',
    decimals: 8,
    htsAddress: '0.0.1159074',
    evmAddress: '0x000000000000000000000000000000000011afa2',
  },
  KBL: {
    symbol: 'KBL',
    name: 'KBL',
    decimals: 6,
    htsAddress: '0.0.5989978',
    evmAddress: '0x00000000000000000000000000000000005B665A',
  },

  // --- Bridged EVM assets (LayerZero/Stargate) ---
  // These are EVM-only contracts (not HTS tokens). Decimals verified on-chain.
  WETH: {
    symbol: 'WETH',
    name: 'WETH',
    decimals: 18,
    htsAddress: '0.0.9470869', // contract account on Hedera
    evmAddress: '0xCa367694CDaC8f152e33683BB36CC9d6A73F1ef2',
  },
  WBTC: {
    symbol: 'wBTC',
    name: 'wBTC',
    decimals: 8,
    htsAddress: '0.0.10047837', // contract account on Hedera
    evmAddress: '0xd7d4d91d64a6061fa00a94e2b3a2d2a5fb677849',
  },

  // --- Additional tokens used in vaults ---
  JAM: {
    symbol: 'JAM',
    name: 'Tune.FM',
    decimals: 8,
    htsAddress: '0.0.127877',
    evmAddress: '0x000000000000000000000000000000000001f385',
  },
  USDC_HTS: {
    symbol: 'USDC[hts]',
    name: 'USD Coin (HashPort)',
    decimals: 6,
    htsAddress: '0.0.1055459',
    evmAddress: '0x0000000000000000000000000000000000101ae3',
  },
} as const;

// ============================================================
// Bonzo Lend — Lending Pool Contracts
// ============================================================

export interface BonzoLendContracts {
  lendingPool: { evmAddress: string; hederaId: string };
  wethGateway: { evmAddress: string; hederaId: string };
  whbarGateway: { evmAddress: string; hederaId: string };
  protocolDataProvider: { evmAddress: string };
  priceOracle: { evmAddress: string };
  addressesProvider: { evmAddress: string };
  collateralManager: { evmAddress: string };
  configurator: { evmAddress: string };
}

export const BONZO_LEND_MAINNET: BonzoLendContracts = {
  lendingPool: {
    evmAddress: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc',
    hederaId: '0.0.7308459',
  },
  wethGateway: {
    evmAddress: '0x9a601543e9264255BebB20Cef0E7924e97127105',
    hederaId: '0.0.7308485',
  },
  whbarGateway: {
    evmAddress: '0xa7e46f496b088a8f8ee35b74d7e58d6ce648ae64',
    hederaId: '0.0.10071466',
  },
  protocolDataProvider: {
    evmAddress: '0x78feDC4D7010E409A0c0c7aF964cc517D3dCde18',
  },
  priceOracle: {
    evmAddress: '0x09ABEb1C1D601B3FBDbbCCe048c45Df34494Bcb8',
  },
  addressesProvider: {
    evmAddress: '0x60729c53d498c8C4e3D2D1E51e4aB4e5BF1268f6',
  },
  collateralManager: {
    evmAddress: '0x70dC2eb5E8fA51E773D67A2a14E42ce7b0d3DcC1',
  },
  configurator: {
    evmAddress: '0xfC4c83bAE0F6a0f4A00ba5B3BA10d63E8E59E01c',
  },
};

export const BONZO_LEND_TESTNET = {
  lendingPool: {
    evmAddress: '0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2',
    hederaId: '0.0.4999355',
  },
  wethGateway: {
    evmAddress: '0x16197Ef10F26De77C9873d075f8774BdEc20A75d',
    hederaId: '0.0.4999360',
  },
  protocolDataProvider: {
    evmAddress: '0x121A2AFFA5f595175E60E01EAeF0deC43Cc3b024',
  },
};

// ============================================================
// Bonzo Lend — aToken & Debt Token Addresses (Mainnet)
// Source: Bonzo Data API /market endpoint, verified 2026-03-14
// ============================================================

export interface LendReserveAddresses {
  aTokenAddress: string;
  variableDebtAddress: string;
  stableDebtAddress: string;
}

export const BONZO_LEND_RESERVES: Record<string, LendReserveAddresses> = {
  WHBAR: {
    aTokenAddress: '0x6e96a607F2F5657b39bf58293d1A006f9415aF32',
    variableDebtAddress: '0xCD5A1FF3AD6EDd7e85ae6De3854f3915dD8c9103',
    stableDebtAddress: '0x1F267FBa2ca543EFb4b31bBb8d47abD9c436Aa01',
  },
  USDC: {
    aTokenAddress: '0xB7687538c7f4CAD022d5e97CC778d0b46457c5DB',
    variableDebtAddress: '0x8a90C2f80Fc266e204cb37387c69EA2ed42A3cc1',
    stableDebtAddress: '0x9E83bE4C2a95b9CC10CF3Cf27BABe1a33867581D',
  },
  SAUCE: {
    aTokenAddress: '0x2bcC0a304c0bc816D501c7C647D958b9A5bc716d',
    variableDebtAddress: '0x736c5dbB8ADC643f04c1e13a9C25f28d3D4f0503',
    stableDebtAddress: '0xb67d416dE3b6c8Ff891C6f384852538987300C38',
  },
  XSAUCE: {
    aTokenAddress: '0xEc9CEF1167b4673726B1e5f5A978150e63cDf23b',
    variableDebtAddress: '0x08c816eC7aC0580c802151E4efFbDa687f7Cac2a',
    stableDebtAddress: '0x4a3C9c4ba1Bf30b3b8d249aB7A4eE8305be116fa',
  },
  HBARX: {
    aTokenAddress: '0x40EBC87627Fe4689567C47c8C9C84EDC4Cf29132',
    variableDebtAddress: '0xF4167Af5C303ec2aD1B96316fE013CA96Eb141B5',
    stableDebtAddress: '0x6cD2D4319419Fe01712727749bc90dB1ed814fB2',
  },
  BONZO: {
    aTokenAddress: '0xC5aa104d5e7D9baE3A69Ddd5A722b8F6B69729c9',
    variableDebtAddress: '0x1790C9169480c5C67D8011cd0311DDE1b2DC76e0',
    stableDebtAddress: '',
  },
  KARATE: {
    aTokenAddress: '0x98262552C8246Ffb55E3539Ceb51838912402959',
    variableDebtAddress: '0xB6209F33982CE99139Ab325b13B260d32287A807',
    stableDebtAddress: '0x26BE85fc10dd1D51350F4c1C33Da9fC2Df9C3B24',
  },
  DOVU: {
    aTokenAddress: '0x89D2789481cB4CB5B6949Ff55EBA5629c5bC5B1E',
    variableDebtAddress: '0x9d81E1676A7e116ec725208DdeAB11929eA3F7A6',
    stableDebtAddress: '',
  },
  HST: {
    aTokenAddress: '0x2e63e864AAD2ce87b45d2C93bc126850DC5122c9',
    variableDebtAddress: '0xdc6e9E967648cd28E8BaF2EB1124ef7C9C5Bd027',
    stableDebtAddress: '',
  },
  PACK: {
    aTokenAddress: '0x5F98C43ce4b4765638d69B4a2407a2186A347CB9',
    variableDebtAddress: '0x63c7EF5398E8Fe23D95E762802F011590A7816a1',
    stableDebtAddress: '',
  },
  STEAM: {
    aTokenAddress: '0x46BEf910150a3880ce6eAC60A059E70494A4805e',
    variableDebtAddress: '0xdFD1D43cbd700AEC5bcc151d028274412d31db70',
    stableDebtAddress: '',
  },
  GRELF: {
    aTokenAddress: '0xb8c34c9a46AEdf1decb846F942861EeE7dE78075',
    variableDebtAddress: '0x0E509Fc72f4b5d97494c0d45fcd1cF04d531Be44',
    stableDebtAddress: '',
  },
  KBL: {
    aTokenAddress: '0xC45A34b9D9e29fBfCAACC9193FD0CE950e63Ba81',
    variableDebtAddress: '0x6a74429E0D761085C4D5520A14ab59874dfe1C06',
    stableDebtAddress: '',
  },
  WETH: {
    aTokenAddress: '0x6f3FBff04314573e5A2f4eD6dcEf3aA709ab8eD0',
    variableDebtAddress: '0x5451A5863b3d6b672610CE5923Eb1eC0bB8FCa51',
    stableDebtAddress: '',
  },
};

// ============================================================
// Bonzo Vaults — Core Protocol Contracts (Mainnet)
// Source: docs.bonzo.finance/hub/bonzo-vaults-beta/vault-contracts
// ============================================================

/** Dual Asset DEX & Leveraged LST core roles */
export const BONZO_VAULTS_CORE = {
  deployer: '0x512c307b0c2e5ad652195c6fae14fe3fc1a24933',
  keeper: '0xaba50e992ab2df8f197aac4d3ec284f55b43af9c',
  strategist: '0x12ab96bebf0bc4fe1a8f62049c7d840ac949cab6',
  feeRecipient: '0x00000000000000000000000000000000005dbdc1',
  harvester: '0xaba50e992ab2df8f197aac4d3ec284f55b43af9c',
  moveTicks: '0xaba50e992ab2df8f197aac4d3ec284f55b43af9c',
} as const;

/** Single Asset DEX (ICHI) core contracts */
export const BONZO_VAULTS_ICHI_CORE = {
  ichiVaultFactory: '0x822b0bE4958ab5b4A48DA3c5f68Fc54846093618',
  ichiVaultDeployerLib: '0x4fA116f8864eE7d7cee1F5Fbb58d41b70d75A529',
  uv3MathLib: '0x51aD1f2A691F0de1a28942C6d2870bBA05D1c8f7',
  depositGuard: '0x84e653E209525f70dC1410a304dFF98fE47CfD4a',
  slippageCheckV2: '0xce878019645439E64B0e375fE73DDD3d532CC819',
  gnosis: '0xC159b19C5bd0E4a0709eC13C1303Ff2Bb67F7145',
  poolFactory: '0x00000000000000000000000000000000003c3951',
  volatilityCheck: '0x1596BF18141b2Cd07BF6F7875975222C5B092064',
} as const;

/** Chainlink oracles for Bonzo Vaults */
export const BONZO_VAULTS_ORACLES = {
  beefyOracleChainlink: '0x118ac3CD5362eF452293304b1A660A9D78Bdfe88',
  beefyOracleOwner: '0x5DfBB5EF52Cf1932Eeb8324DA4E8D287e06FE915',
} as const;

// ============================================================
// Bonzo Vaults — Deployed Vault Instances
// ============================================================

export type BonzoVaultStrategy =
  | 'single-asset-dex'
  | 'dual-asset-dex'
  | 'leveraged-lst';

export type BonzoVaultVolatility =
  | 'low-ultra-tight'
  | 'medium-narrow'
  | 'high-medium'
  | 'high-wide';

export interface BonzoVaultConfig {
  /** Human-readable vault name, e.g. "USDC (paired with HBAR)" */
  name: string;
  /** Strategy type */
  strategy: BonzoVaultStrategy;
  /** Volatility/range classification */
  volatility: BonzoVaultVolatility;
  /** The token you deposit */
  depositToken: string; // key into BONZO_TOKENS
  /** The paired token in the pool */
  pairedToken: string; // key into BONZO_TOKENS
  /** Strategy contract EVM address */
  strategyAddress: string;
  /** Vault (LP token) EVM address — this is what users interact with */
  vaultAddress: string;
}

export interface BonzoDualVaultConfig {
  /** Human-readable vault name */
  name: string;
  strategy: 'dual-asset-dex';
  /** Token 0 in the pair */
  token0: string; // key into BONZO_TOKENS
  /** Token 1 in the pair */
  token1: string; // key into BONZO_TOKENS
  /** Strategy proxy EVM address */
  strategyAddress: string;
  /** Vault (LP token) EVM address */
  vaultAddress: string;
  /** Underlying SaucerSwap pool address */
  poolAddress: string;
  /** Token0 EVM address */
  token0Address: string;
  /** Token1 EVM address */
  token1Address: string;
  /** LARI reward token addresses */
  rewardTokens: string[];
}

export interface BonzoLSTVaultConfig {
  name: string;
  strategy: 'leveraged-lst';
  depositToken: string;
  strategyAddress: string;
  vaultAddress: string;
}

// ── Single Asset DEX Vaults ──────────────────────────────────
// Source: docs.bonzo.finance — Vaults Contracts > Single Asset DEX
// Each vault accepts a single token deposit; the strategy manages
// concentrated liquidity on SaucerSwap V2.

export const SINGLE_ASSET_DEX_VAULTS: BonzoVaultConfig[] = [
  {
    name: 'JAM (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'JAM',
    pairedToken: 'WHBAR',
    strategyAddress: '0x7AbF45908d733a60799d1B4B04E373366770EEcC',
    vaultAddress: '0x26C770f89d320Da2c2341cbf410F132f44eF70CD',
  },
  {
    name: 'HBAR (paired with JAM)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'WHBAR',
    pairedToken: 'JAM',
    strategyAddress: '0x1787Cd1DFAd83e85c2D4713F7032521592FA807B',
    vaultAddress: '0x55958da8d5aC662aa8eD45111f170C3D8e4fCB3b',
  },
  {
    name: 'PACK (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'PACK',
    pairedToken: 'WHBAR',
    strategyAddress: '0x3cE3A64669d1E3ab4789235Fc3e019234C4be9B7',
    vaultAddress: '0xACd982eE8b869f11aa928c4760cC3C0D4f30a6d3',
  },
  {
    name: 'HBAR (paired with PACK)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'WHBAR',
    pairedToken: 'PACK',
    strategyAddress: '0xC260c60b3e974F54A73c0a6F540ee5eC979fDc00',
    vaultAddress: '0xd1893FcFB1dbEbCCAa6813993074fEfb1569FA5F',
  },
  {
    name: 'BONZO (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'BONZO',
    pairedToken: 'WHBAR',
    strategyAddress: '0xC2343277CAE1090052c770dEf66Cb5911fAF4f05',
    vaultAddress: '0x5D1e9BCAe2c171c0C8aF697Bdd02908f280716bc',
  },
  {
    name: 'USDC (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'USDC',
    pairedToken: 'WHBAR',
    strategyAddress: '0x5dAE71d8a6F980f88F6586dF1A528E53456b8C97',
    vaultAddress: '0x1b90B8f8ab3059cf40924338D5292FfbAEd79089',
  },
  {
    name: 'HBAR (paired with USDC)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'WHBAR',
    pairedToken: 'USDC',
    strategyAddress: '0xB8021f6a7BE89DFd0F66B89CE4cae76De33A90A2',
    vaultAddress: '0xebaFaBBD6610304d7ae89351C5C37b8cf40c76eB',
  },
  {
    name: 'DOVU (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'DOVU',
    pairedToken: 'WHBAR',
    strategyAddress: '0xA1ffF8A98edb1c314cf6a64b47b842A2954304a1',
    vaultAddress: '0x072bC950618A4e286683886eBc01C73090BC1C8a',
  },
  {
    name: 'HBAR (paired with DOVU)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'WHBAR',
    pairedToken: 'DOVU',
    strategyAddress: '0xDAd5F1F4094451Ffd8DDD65dD48A99e7E277FbC9',
    vaultAddress: '0xEf55ABc71271dceaE4880b9000402a4b3F87D1eA',
  },
  {
    name: 'SAUCE (paired with HBAR)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'SAUCE',
    pairedToken: 'WHBAR',
    strategyAddress: '0x5241E22Feb810C50F32Bf16a0edD4105E47Be165',
    vaultAddress: '0x8e253F359Ba5DDD62644b1e5DAbD3D7748fb8193',
  },
  {
    name: 'HBAR (paired with SAUCE)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'WHBAR',
    pairedToken: 'SAUCE',
    strategyAddress: '0x9271898ceF0d44d1704245C2232D56C05150cdAf',
    vaultAddress: '0xc883F70804380c1a49E23A6d1DCF8e784D093a3f',
  },
  {
    name: 'HBAR (paired with BONZO)',
    strategy: 'single-asset-dex',
    volatility: 'high-medium',
    depositToken: 'WHBAR',
    pairedToken: 'BONZO',
    strategyAddress: '0x4e1bc1184Df76e897BA5eaD761f75B01F6197726',
    vaultAddress: '0xd406F0C0211836dbcA3EbF3b84487137be400E57',
  },
  {
    name: 'BONZO (paired with xBONZO)',
    strategy: 'single-asset-dex',
    volatility: 'medium-narrow',
    depositToken: 'BONZO',
    pairedToken: 'XBONZO',
    strategyAddress: '', // not listed in contracts table
    vaultAddress: '0x8F6A6441D5Bb2AFD8063181Da52363B9d568F5BE',
  },
  {
    name: 'xBONZO (paired with BONZO)',
    strategy: 'single-asset-dex',
    volatility: 'medium-narrow',
    depositToken: 'XBONZO',
    pairedToken: 'BONZO',
    strategyAddress: '', // not listed in contracts table
    vaultAddress: '0x938697BaAC6d574f77b848C4B98BfED0ec44a8B2',
  },
  {
    name: 'USDC (paired with wETH)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'USDC',
    pairedToken: 'WETH',
    strategyAddress: '0xb9A69E0261f67Da41FccBEf8511b99E2D8255806',
    vaultAddress: '0x0Db93Cfe4BA0b2A7C10C83FBEe81Fd2EFB871864',
  },
  {
    name: 'wETH (paired with USDC)',
    strategy: 'single-asset-dex',
    volatility: 'high-wide',
    depositToken: 'WETH',
    pairedToken: 'USDC',
    strategyAddress: '0x0084260A5f7BF324b2325487D3EF080f298057b9',
    vaultAddress: '0x31403d085C601F49b9644a4c9a493403FA14ABfe',
  },
];

// ── Dual Asset DEX Vaults ────────────────────────────────────
// Source: docs.bonzo.finance — Vaults Contracts > Dual Asset DEX

export const DUAL_ASSET_DEX_VAULTS: BonzoDualVaultConfig[] = [
  {
    name: 'USDC-HBAR',
    strategy: 'dual-asset-dex',
    token0: 'USDC',
    token1: 'WHBAR',
    strategyAddress: '0x157EB9ba35d70560D44394206D4a03885C33c6d5',
    vaultAddress: '0x724F19f52A3E0e9D2881587C997db93f9613B2C7',
    poolAddress: '0xc5b707348da504e9be1bd4e21525459830e7b11d',
    token0Address: '0x000000000000000000000000000000000006f89a',
    token1Address: '0x0000000000000000000000000000000000163b5a',
    rewardTokens: [
      '0x0000000000000000000000000000000000163b5a', // WHBAR
      '0x00000000000000000000000000000000000b2ad5', // SAUCE
      '0x0000000000000000000000000000000000492a28', // LARI
    ],
  },
  {
    name: 'USDC-SAUCE',
    strategy: 'dual-asset-dex',
    token0: 'USDC',
    token1: 'SAUCE',
    strategyAddress: '0xDC74aC010A60357A89008d5eBDBaF144Cf5BD8C6',
    vaultAddress: '0x0171baa37fC9f56c98bD56FEB32bC28342944C6e',
    poolAddress: '0x36acdfe1cbf9098bdb7a3c62b8eaa1016c111e31',
    token0Address: '0x000000000000000000000000000000000006f89a',
    token1Address: '0x00000000000000000000000000000000000b2ad5',
    rewardTokens: [
      '0x0000000000000000000000000000000000163b5a',
      '0x00000000000000000000000000000000000b2ad5',
      '0x0000000000000000000000000000000000492a28',
    ],
  },
  {
    name: 'BONZO-xBONZO',
    strategy: 'dual-asset-dex',
    token0: 'BONZO',
    token1: 'XBONZO',
    strategyAddress: '0x3Dab58797e057878d3cD8f78F28C6967104FcD0c',
    vaultAddress: '0xcfba07324bd207C3ED41416a9a36f8184F9a2134',
    poolAddress: '0xf6cc94f16bc141115fcb9b587297aecfa14f4eb6',
    token0Address: '0x00000000000000000000000000000000007e545e',
    token1Address: '0x0000000000000000000000000000000000818e2d',
    rewardTokens: [
      '0x0000000000000000000000000000000000163b5a',
      '0x00000000000000000000000000000000000b2ad5',
      '0x0000000000000000000000000000000000492a28',
    ],
  },
  {
    name: 'SAUCE-xSAUCE',
    strategy: 'dual-asset-dex',
    token0: 'SAUCE',
    token1: 'XSAUCE',
    strategyAddress: '0xE9Ab1D3C3d086A8efA0f153f107B096BEaBDee6f',
    vaultAddress: '0x8AEE31dFF6264074a1a3929432070E1605F6b783',
    poolAddress: '0xcfeffaae43f176f91602d75ec1d0637e273c973b',
    token0Address: '0x00000000000000000000000000000000000b2ad5',
    token1Address: '0x00000000000000000000000000000000001647e8',
    rewardTokens: [
      '0x0000000000000000000000000000000000163b5a',
      '0x00000000000000000000000000000000000b2ad5',
      '0x0000000000000000000000000000000000492a28',
    ],
  },
];

// ── Leveraged LST Vaults ─────────────────────────────────────
// Source: docs.bonzo.finance — Vaults Contracts > Leveraged LST

export const LEVERAGED_LST_VAULTS: BonzoLSTVaultConfig[] = [
  {
    name: 'HBARX Leveraged LST',
    strategy: 'leveraged-lst',
    depositToken: 'HBARX',
    strategyAddress: '0xE7f31dD688Ce850e44902b2c55D703BC2d91a84e',
    vaultAddress: '0x10288A0F368c82922a421EEb4360537b93af3780',
  },
];

// ============================================================
// Helper Functions
// ============================================================

/**
 * Look up a token by symbol. Case-insensitive.
 * Maps "HBAR" → WHBAR automatically.
 */
export function getToken(symbol: string): TokenInfo | undefined {
  const normalized = symbol.toUpperCase();
  if (normalized === 'HBAR') return BONZO_TOKENS.WHBAR;
  return BONZO_TOKENS[normalized];
}

/**
 * Get token decimals by symbol. Returns undefined if token not found.
 * ALWAYS use this instead of guessing decimals.
 */
export function getTokenDecimals(symbol: string): number | undefined {
  return getToken(symbol)?.decimals;
}

/**
 * Get all Bonzo Vault configs (single + dual + LST).
 */
export function getAllVaultConfigs(): (BonzoVaultConfig | BonzoDualVaultConfig | BonzoLSTVaultConfig)[] {
  return [
    ...SINGLE_ASSET_DEX_VAULTS,
    ...DUAL_ASSET_DEX_VAULTS,
    ...LEVERAGED_LST_VAULTS,
  ];
}

/**
 * Find vaults that accept a given deposit token.
 */
export function findVaultsByDepositToken(symbol: string): BonzoVaultConfig[] {
  const normalized = symbol.toUpperCase();
  const key = normalized === 'HBAR' ? 'WHBAR' : normalized;
  return SINGLE_ASSET_DEX_VAULTS.filter(
    (v) => v.depositToken === key
  );
}
