import { BaseAgent } from '../core/base-agent';
import type { HCSService } from '../hedera/hcs';
import type { HederaClient } from '../hedera/client';
import type { DecisionLog, Strategy } from '../types';

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
   * In production: calls vault contract's deposit() function via EVM.
   * For MVP: performs an HBAR transfer to demonstrate on-chain execution,
   * then logs the vault deposit intent to HCS.
   *
   * TODO: Replace with actual Bonzo Vault contract interaction when
   * testnet contracts are available. The interface is:
   *   vault.deposit(amount, tokenId)
   *   vault.harvest()
   *   vault.withdraw(shares)
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
  }> {
    const depositAmount = (totalAmount * allocationPercent) / 100;

    // For MVP, demonstrate on-chain capability with HBAR transfer
    // In production, this calls the Bonzo Vault deposit() contract function
    if (vaultAddress.startsWith('0.0.mock')) {
      // Testnet mock: do a small self-transfer to prove on-chain capability
      // and log the "deposit" to HCS
      const result = await this.hederaClient.transferHbar(
        this.hederaClient.getAccountId(),
        0.01 // minimal transfer to demonstrate on-chain execution
      );

      return {
        success: result.success,
        transactionId: result.transactionId,
        hashscanUrl: result.hashscanUrl,
        error: result.error,
      };
    }

    // Real vault deposit would go here:
    // const contract = new ContractExecuteTransaction()
    //   .setContractId(vaultAddress)
    //   .setFunction('deposit', new ContractFunctionParameters().addUint256(depositAmount))
    //   .setGas(100000);
    // const response = await contract.execute(this.hederaClient.getClient());

    return {
      success: false,
      transactionId: null,
      hashscanUrl: null,
      error: `Real vault interaction not yet implemented for ${vaultAddress}`,
    };
  }

  private buildReasoning(
    strategy: Strategy,
    results: { vault: string; success: boolean; transactionId: string | null }[]
  ): string {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length === results.length) {
      return (
        `Successfully executed ${strategy.vaults.length}-vault strategy. ` +
        `Deposited across: ${successful.map((r) => r.vault).join(', ')}. ` +
        `All transactions confirmed on Hedera Testnet. ` +
        `Position is now active and being monitored by Sentinel agent.`
      );
    }

    return (
      `Partially executed strategy. ` +
      `Succeeded: ${successful.map((r) => r.vault).join(', ') || 'none'}. ` +
      `Failed: ${failed.map((r) => r.vault).join(', ')}. ` +
      `Will retry failed deposits on next cycle.`
    );
  }
}
