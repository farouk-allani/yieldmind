'use client';

import { useState, useCallback } from 'react';
import { Contract, parseEther, formatEther, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from './wallet-context';
import { VAULT_ABI, VAULT_ADDRESS } from './vault-abi';

export type DepositStatus =
  | 'idle'
  | 'signing'
  | 'confirming'
  | 'confirmed'
  | 'failed';

export interface DepositResult {
  status: DepositStatus;
  txHash: string | null;
  error: string | null;
}

export function useVault() {
  const { provider, address, isConnected, isCorrectNetwork } = useWallet();
  const [depositStatus, setDepositStatus] = useState<DepositStatus>('idle');

  const isReady = isConnected && isCorrectNetwork && !!VAULT_ADDRESS;

  /**
   * Deposit HBAR into the YieldMindVault contract.
   * User signs the transaction in MetaMask.
   */
  const deposit = useCallback(
    async (
      strategyId: string,
      vaultName: string,
      amountHbar: number
    ): Promise<DepositResult> => {
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      if (!VAULT_ADDRESS) {
        return {
          status: 'failed',
          txHash: null,
          error: 'Vault contract address not configured',
        };
      }

      try {
        setDepositStatus('signing');

        const signer = await provider.getSigner();
        const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);

        // Hash the strategy ID to bytes32
        const strategyIdHash = keccak256(toUtf8Bytes(strategyId));

        // Send the deposit transaction — MetaMask popup appears here
        const tx = await contract.deposit(strategyIdHash, vaultName, {
          value: parseEther(amountHbar.toString()),
        });

        setDepositStatus('confirming');

        // Wait for on-chain confirmation
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          setDepositStatus('confirmed');
          return {
            status: 'confirmed',
            txHash: tx.hash,
            error: null,
          };
        } else {
          setDepositStatus('failed');
          return {
            status: 'failed',
            txHash: tx.hash,
            error: 'Transaction reverted',
          };
        }
      } catch (err: unknown) {
        setDepositStatus('failed');
        const error = err as { code?: string; message?: string };

        // User rejected in MetaMask
        if (error.code === 'ACTION_REJECTED') {
          return {
            status: 'failed',
            txHash: null,
            error: 'Transaction rejected by user',
          };
        }

        return {
          status: 'failed',
          txHash: null,
          error: error.message || 'Unknown error',
        };
      }
    },
    [provider, address]
  );

  /**
   * Read a user's deposit for a specific strategy
   */
  const getDeposit = useCallback(
    async (strategyId: string): Promise<string> => {
      if (!provider || !address || !VAULT_ADDRESS) return '0';

      try {
        const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
        const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
        const amount = await contract.getDeposit(strategyIdHash, address);
        return formatEther(amount);
      } catch {
        return '0';
      }
    },
    [provider, address]
  );

  /**
   * Read a user's total deposits across all strategies
   */
  const getUserTotal = useCallback(async (): Promise<string> => {
    if (!provider || !address || !VAULT_ADDRESS) return '0';

    try {
      const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      const total = await contract.userTotals(address);
      return formatEther(total);
    } catch {
      return '0';
    }
  }, [provider, address]);

  /**
   * Read total value locked in the vault
   */
  const getTVL = useCallback(async (): Promise<string> => {
    if (!provider || !VAULT_ADDRESS) return '0';

    try {
      const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      const tvl = await contract.totalValueLocked();
      return formatEther(tvl);
    } catch {
      return '0';
    }
  }, [provider]);

  const resetStatus = useCallback(() => {
    setDepositStatus('idle');
  }, []);

  return {
    deposit,
    getDeposit,
    getUserTotal,
    getTVL,
    depositStatus,
    resetStatus,
    isReady,
  };
}
