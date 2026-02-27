import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  AccountBalanceQuery,
} from '@hashgraph/sdk';
import type { TransactionResult } from '../types/index.js';
import { getNetworkConfig, getBonzoNetworkConfig, getHashscanTransactionUrl } from '../config/index.js';

export class HederaClient {
  private client: Client;
  private accountId: AccountId;
  private privateKey: PrivateKey;

  constructor() {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const accountIdStr = process.env.HEDERA_ACCOUNT_ID;
    const privateKeyStr = process.env.HEDERA_PRIVATE_KEY;

    if (!accountIdStr || !privateKeyStr) {
      throw new Error(
        'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in environment variables'
      );
    }

    this.accountId = AccountId.fromString(accountIdStr);
    this.privateKey = PrivateKey.fromStringDer(privateKeyStr);

    this.client =
      network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    this.client.setOperator(this.accountId, this.privateKey);
    this.client.setDefaultMaxTransactionFee(new Hbar(10));
  }

  getAccountId(): string {
    return this.accountId.toString();
  }

  getClient(): Client {
    return this.client;
  }

  /**
   * Transfer HBAR to another account
   */
  async transferHbar(
    toAccountId: string,
    amount: number
  ): Promise<TransactionResult> {
    try {
      const transaction = new TransferTransaction()
        .addHbarTransfer(this.accountId, new Hbar(-amount))
        .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amount));

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        success: receipt.status.toString() === 'SUCCESS',
        transactionId: response.transactionId.toString(),
        hashscanUrl: getHashscanTransactionUrl(response.transactionId.toString()),
        error: null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        transactionId: null,
        hashscanUrl: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get account HBAR balance
   */
  async getBalance(): Promise<number> {
    const balance = await new AccountBalanceQuery()
      .setAccountId(this.accountId)
      .execute(this.client)
      .catch(() => null);
    return balance ? balance.hbars.toBigNumber().toNumber() : 0;
  }

  /**
   * Verify an EVM transaction via Mirror Node.
   * Used to confirm user-signed deposits from MetaMask.
   */
  async verifyEvmTransaction(
    txHash: string
  ): Promise<{
    verified: boolean;
    from: string | null;
    to: string | null;
    amount: string | null;
    error: string | null;
  }> {
    // Use Bonzo network's mirror node (mainnet) for verifying deposit txs,
    // since deposits happen on mainnet even when HCS runs on testnet.
    const mirrorUrl = getBonzoNetworkConfig().mirrorNodeUrl;

    try {
      const response = await fetch(
        `${mirrorUrl}/api/v1/contracts/results/${txHash}`
      );

      if (!response.ok) {
        return {
          verified: false,
          from: null,
          to: null,
          amount: null,
          error: `Mirror Node returned ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        result: string;
        from: string;
        to: string;
        amount: number;
        status: string;
      };

      return {
        verified: data.result === 'SUCCESS' || data.status === '0x1',
        from: data.from || null,
        to: data.to || null,
        amount: data.amount?.toString() || null,
        error: null,
      };
    } catch (error) {
      return {
        verified: false,
        from: null,
        to: null,
        amount: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  close(): void {
    this.client.close();
  }
}
