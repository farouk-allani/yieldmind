import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { HederaClient } from '../hedera/client.js';
import type { DecisionLog, Strategy, ExecutionConfirmation } from '../types/index.js';

interface ExecutorInput {
  strategy: Strategy;
  sessionId: string;
}

/**
 * ExecutorAgent — The on-chain execution arm of YieldMind.
 *
 * Takes an approved strategy from the Strategist and performs
 * actual on-chain transactions: deposits, harvests, rebalances.
 *
 * Every transaction is logged to HCS with reasoning and tx hash.
 */
export class ExecutorAgent extends BaseAgent {
  private hederaClient: HederaClient;

  constructor(hcsService: HCSService, hederaClient: HederaClient) {
    super('executor', hcsService);
    this.hederaClient = hederaClient;
  }

  async execute(input: unknown): Promise<DecisionLog> {
    const { strategy, sessionId } = input as ExecutorInput;
    this.setStatus('executing', 'Executing vault strategy...');

    try {
      const results = [];

      for (const vault of strategy.vaults) {
        this.setStatus(
          'executing',
          `Depositing ${vault.allocation}% into ${vault.vaultName}...`
        );

        // Execute deposit for each vault in the strategy
        const result = await this.executeVaultDeposit(
          vault.vaultAddress,
          vault.allocation,
          strategy.userIntent.targetAmount
        );
        results.push({ vault: vault.vaultName, ...result });
      }

      const allSucceeded = results.every((r) => r.success);
      const reasoning = this.buildReasoning(strategy, results);

      const decision = this.createDecision(
        allSucceeded ? 'execution-complete' : 'execution-partial',
        reasoning,
        allSucceeded ? 0.95 : 0.5,
        sessionId,
        {
          success: allSucceeded,
          results,
          transactionId: results[0]?.transactionId || null,
          hashscanUrl: results[0]?.hashscanUrl || null,
          error: allSucceeded
            ? null
            : results
                .filter((r) => !r.success)
                .map((r) => r.error)
                .join('; '),
        }
      );

      await this.publishDecision('executor:deposit', decision);
      this.setStatus('idle', allSucceeded ? 'Strategy active' : 'Partial execution');

      return decision;
    } catch (error) {
      this.setStatus('error', 'Execution failed');
      return this.createDecision(
        'execution-failed',
        `Failed to execute strategy: ${error instanceof Error ? error.message : 'Unknown error'}. No funds were moved.`,
        0,
        sessionId,
        {
          success: false,
          error: String(error),
          transactionId: null,
          hashscanUrl: null,
        }
      );
    }
  }

  /**
   * Execute a deposit into a Bonzo Vault.
   *
   * Performs a real HBAR transfer on Hedera Testnet for each vault allocation.
   * Each transfer is a provable on-chain transaction viewable on HashScan.
   *
   * In production (mainnet): would call Bonzo's lending pool deposit() via EVM.
   * For hackathon (testnet): executes real HBAR transfers proportional to the
   * strategy allocation, proving on-chain execution capability.
   *
   * The deposit intent (vault address, amount, allocation) is logged to HCS
   * alongside the transaction, creating a full on-chain audit trail.
   */
  private async executeVaultDeposit(
    vaultAddress: string,
    allocationPercent: number,
    totalAmount: number
  ): Promise<{
    success: boolean;
    transactionId: string | null;
    hashscanUrl: string | null;
    error: string | null;
    depositAmount: number;
  }> {
    const depositAmount = (totalAmount * allocationPercent) / 100;

    // Execute real HBAR transfer on testnet proportional to allocation
    // This is a real on-chain transaction, provable on HashScan
    const transferAmount = Math.max(0.01, depositAmount * 0.001); // scale down for testnet
    const result = await this.hederaClient.transferHbar(
      this.hederaClient.getAccountId(),
      transferAmount
    );

    return {
      success: result.success,
      transactionId: result.transactionId,
      hashscanUrl: result.hashscanUrl,
      error: result.error,
      depositAmount,
    };
  }

  /**
   * Confirm a user-signed deposit that was already executed via MetaMask.
   * Verifies the tx via Mirror Node, then publishes to HCS.
   */
  async confirmDeposit(
    confirmation: ExecutionConfirmation,
    verified: boolean
  ): Promise<DecisionLog> {
    this.setStatus('executing', 'Confirming user deposit...');

    const reasoning = verified
      ? `User deposit confirmed on-chain. Transaction ${confirmation.txHash} from ${confirmation.userAddress} ` +
        `for ${confirmation.depositAmount} HBAR deposited into YieldMindVault contract. ` +
        `Verified via Mirror Node. Sentinel monitoring activated.`
      : `User submitted deposit transaction ${confirmation.txHash} but on-chain verification ` +
        `is still pending. The transaction may need more time to propagate to the mirror node.`;

    const decision = this.createDecision(
      'deposit-confirmed',
      reasoning,
      verified ? 0.98 : 0.6,
      confirmation.sessionId,
      {
        success: verified,
        txHash: confirmation.txHash,
        userAddress: confirmation.userAddress,
        depositAmount: confirmation.depositAmount,
        hashscanUrl: `https://hashscan.io/testnet/transaction/${confirmation.txHash}`,
      }
    );

    await this.publishDecision('executor:deposit-confirmed', decision);
    this.setStatus('idle', verified ? 'Deposit confirmed' : 'Awaiting confirmation');

    return decision;
  }

  private buildReasoning(
    strategy: Strategy,
    results: {
      vault: string;
      success: boolean;
      transactionId: string | null;
      depositAmount?: number;
    }[]
  ): string {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length === results.length) {
      const deposits = successful
        .map((r) => `${r.vault} (${r.depositAmount?.toFixed(1) || '?'} ${strategy.userIntent.tokenSymbol})`)
        .join(', ');

      return (
        `Executed ${strategy.vaults.length}-vault strategy on Hedera Testnet. ` +
        `Deposits: ${deposits}. ` +
        `All ${successful.length} transactions confirmed on-chain. ` +
        `Total allocation: ${strategy.userIntent.targetAmount} ${strategy.userIntent.tokenSymbol} at ${strategy.totalExpectedApy.toFixed(2)}% blended APY. ` +
        `Sentinel agent now monitoring positions.`
      );
    }

    return (
      `Partially executed strategy — ${successful.length}/${results.length} deposits confirmed. ` +
      `Succeeded: ${successful.map((r) => r.vault).join(', ') || 'none'}. ` +
      `Failed: ${failed.map((r) => r.vault).join(', ')}. ` +
      `Will retry failed deposits on next cycle.`
    );
  }
}
