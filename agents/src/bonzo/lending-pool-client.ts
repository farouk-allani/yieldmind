import { getBonzoNetworkConfig } from '../config/index.js';

/**
 * BonzoLendingPoolClient — Wraps Bonzo's Aave v2 LendingPool contract.
 *
 * Provides deposit() and withdraw() for server-side agent operations,
 * plus read methods like getUserAccountData().
 *
 * Reads the lending pool address from network config.
 * isAvailable() returns false when the address isn't configured,
 * allowing callers to fall back gracefully.
 */

// Aave v2 LendingPool ABI (subset used by YieldMind)
export const LENDING_POOL_ABI = [
  'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

export interface LendingPoolResult {
  success: boolean;
  transactionId: string | null;
  hashscanUrl: string | null;
  error: string | null;
}

export interface DepositParams {
  /** EVM address of the token to deposit */
  asset: string;
  /** Amount in the token's smallest unit */
  amount: bigint;
  /** EVM address of the user receiving the deposit */
  onBehalfOf: string;
  /** Referral code (default 0) */
  referralCode?: number;
}

export interface WithdrawParams {
  /** EVM address of the token to withdraw */
  asset: string;
  /** Amount in the token's smallest unit (use MaxUint256 for full balance) */
  amount: bigint;
  /** EVM address to receive the withdrawn tokens */
  to: string;
}

export class BonzoLendingPoolClient {
  private readonly lendingPoolAddress: string;
  private readonly lendingPoolEvmAddress: string;
  private readonly mirrorNodeUrl: string;

  constructor() {
    const config = getBonzoNetworkConfig();
    this.lendingPoolAddress = config.bonzo.lendingPoolAddress;
    this.lendingPoolEvmAddress = config.bonzo.lendingPoolEvmAddress;
    this.mirrorNodeUrl = config.mirrorNodeUrl;
  }

  /**
   * Returns true if the Bonzo LendingPool is configured for the current network.
   * When false, callers should fall back to alternative deposit methods.
   */
  isAvailable(): boolean {
    return !!this.lendingPoolEvmAddress;
  }

  /** Hedera-native address (0.0.xxx) */
  getLendingPoolAddress(): string {
    return this.lendingPoolAddress;
  }

  /** EVM hex address */
  getLendingPoolEvmAddress(): string {
    return this.lendingPoolEvmAddress;
  }

  /** ABI for frontend MetaMask integration */
  getAbi(): string[] {
    return LENDING_POOL_ABI;
  }

  /**
   * Server-side Bonzo deposit is not supported.
   *
   * On-chain deposits require a user-signed EVM transaction. The backend agent
   * account only manages HCS topic transactions on testnet and cannot sign
   * mainnet Bonzo LendingPool calls on behalf of users.
   *
   * Real deposits go through: MetaMask (frontend) → WETHGateway/LendingPool
   * → confirmed via Mirror Node → logged to HCS by executor.confirmDeposit().
   */
  deposit(_params: DepositParams): Promise<LendingPoolResult> {
    return Promise.resolve({
      success: false,
      transactionId: null,
      hashscanUrl: null,
      error:
        'Server-side deposits are not supported. Use the frontend MetaMask deposit flow — the executor agent will verify and log the transaction after you sign it.',
    });
  }

  /**
   * Read a user's account data from Bonzo LendingPool.
   */
  async getUserAccountData(
    userEvmAddress: string
  ): Promise<{
    totalCollateral: bigint;
    totalDebt: bigint;
    availableBorrows: bigint;
    healthFactor: bigint;
  } | null> {
    if (!this.isAvailable()) return null;

    try {
      // getUserAccountData(address) selector: 0xbf92857c
      const addressPadded = userEvmAddress.replace('0x', '').padStart(64, '0');
      const callData = `0xbf92857c${addressPadded}`;

      const response = await fetch(`${this.mirrorNodeUrl}/api/v1/contracts/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: callData,
          to: this.lendingPoolEvmAddress,
          estimate: false,
        }),
      });

      if (!response.ok) return null;

      const result = (await response.json()) as { result: string };
      const clean = result.result.replace('0x', '');
      const chunks: string[] = [];
      for (let i = 0; i < clean.length; i += 64) {
        chunks.push(clean.slice(i, i + 64));
      }

      return {
        totalCollateral: BigInt('0x' + (chunks[0] || '0')),
        totalDebt: BigInt('0x' + (chunks[1] || '0')),
        availableBorrows: BigInt('0x' + (chunks[2] || '0')),
        healthFactor: BigInt('0x' + (chunks[5] || '0')),
      };
    } catch {
      return null;
    }
  }
}
