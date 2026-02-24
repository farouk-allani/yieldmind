import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  AccountBalanceQuery,
} from '@hashgraph/sdk';
import type { TransactionResult } from '../types';

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
        hashscanUrl: `https://hashscan.io/testnet/transaction/${response.transactionId.toString()}`,
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

  close(): void {
    this.client.close();
  }
}
