import { BaseAgent } from '../core/base-agent.js';
import type { HCSService } from '../hedera/hcs.js';
import type { HederaClient } from '../hedera/client.js';
import type { DecisionLog, Strategy, ExecutionConfirmation } from '../types/index.js';
import { getBonzoNetworkConfig, getHashscanTransactionUrl } from '../config/index.js';

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
  constructor(hcsService: HCSService, _hederaClient: HederaClient) {
    super('executor', hcsService);
    // hederaClient reserved for future server-side operations (withdrawals, etc.)
  }

  /**
   * Log strategy approval to HCS and signal that the user's wallet signature
   * is required to execute on-chain.
   *
   * Real on-chain execution happens in the frontend:
   *   MetaMask → WETHGateway / LendingPool.deposit() → tx confirmed
   *   → frontend calls /api/execute/confirm → executor.confirmDeposit()
   *
   * This method records the approval intent on HCS so every step of the
   * decision chain is auditable, even before the user signs.
   */
  async execute(input: unknown): Promise<DecisionLog> {
    const { strategy, sessionId } = input as ExecutorInput;
    this.setStatus('waiting', 'Awaiting user signature...');

    const network = getBonzoNetworkConfig().chainName;
    const vaultList = strategy.vaults
      .map((v) => `${v.vaultName} (${v.allocation}% · ${v.expectedApy.toFixed(1)}% APY)`)
      .join(', ');

    const reasoning =
      `Strategy approved by Strategist. Queued for on-chain execution on ${network}. ` +
      `Vaults: ${vaultList}. ` +
      `Total: ${strategy.userIntent.targetAmount} ${strategy.userIntent.tokenSymbol} ` +
      `at ${strategy.totalExpectedApy.toFixed(2)}% blended APY. ` +
      `Waiting for user wallet signature to submit deposit transaction. ` +
      `No funds have moved yet — execution requires explicit user approval in MetaMask.`;

    const decision = this.createDecision(
      'execution-queued',
      reasoning,
      0.9,
      sessionId,
      {
        success: false,
        awaitingSignature: true,
        transactionId: null,
        hashscanUrl: null,
        error: null,
        vaults: strategy.vaults.map((v) => ({
          name: v.vaultName,
          allocation: v.allocation,
          apy: v.expectedApy,
        })),
      }
    );

    await this.publishDecision('executor:deposit', decision);
    return decision;
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

    const token = confirmation.tokenSymbol || 'HBAR';
    const reasoning = verified
      ? `User deposit confirmed on-chain. Transaction ${confirmation.txHash} from ${confirmation.userAddress} ` +
        `for ${confirmation.depositAmount} ${token} deposited into YieldMindVault contract. ` +
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
        hashscanUrl: getHashscanTransactionUrl(confirmation.txHash),
      }
    );

    await this.publishDecision('executor:deposit-confirmed', decision);
    this.setStatus('idle', verified ? 'Deposit confirmed' : 'Awaiting confirmation');

    return decision;
  }

}
