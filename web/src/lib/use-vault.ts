'use client';

import { useState, useCallback } from 'react';
import { Contract, parseEther, formatUnits, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from './wallet-context';
import {
  BONZO_LENDING_POOL_ABI,
  BONZO_LENDING_POOL_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
} from './vault-abi';

// Hedera EVM stores msg.value in tinybars (8 decimals), not wei (18).
// parseEther works for deposits (relay converts), but reads need 8 decimals.
const HBAR_DECIMALS = 8;

export type TxStatus =
  | 'idle'
  | 'signing'
  | 'confirming'
  | 'confirmed'
  | 'failed';

/** @deprecated Use TxStatus instead */
export type DepositStatus = TxStatus;

export interface TxResult {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
}

/** @deprecated Use TxResult instead */
export type DepositResult = TxResult;

/**
 * Whether Bonzo LendingPool is configured for direct deposits.
 * When true, deposits go directly to Bonzo. When false, falls back to YieldMindVault.
 */
const bonzoAvailable = !!BONZO_LENDING_POOL_ADDRESS;

export function useVault() {
  const { provider, address, isConnected, isCorrectNetwork } = useWallet();
  const [depositStatus, setDepositStatus] = useState<TxStatus>('idle');
  const [withdrawStatus, setWithdrawStatus] = useState<TxStatus>('idle');

  const isReady =
    isConnected &&
    isCorrectNetwork &&
    !!(bonzoAvailable ? BONZO_LENDING_POOL_ADDRESS : VAULT_ADDRESS);

  /**
   * Deposit into Bonzo LendingPool (or YieldMindVault as fallback).
   *
   * When Bonzo is configured:
   *   - Calls LendingPool.deposit(asset, amount, onBehalfOf, referralCode)
   *   - `assetAddress` = EVM address of the token to supply
   *
   * When Bonzo is NOT configured:
   *   - Falls back to YieldMindVault.deposit(strategyId, vaultName)
   *   - `strategyId` and `vaultName` are used for on-chain tracking
   */
  const deposit = useCallback(
    async (
      strategyId: string,
      vaultName: string,
      amountHbar: number,
      assetAddress?: string
    ): Promise<TxResult> => {
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      try {
        setDepositStatus('signing');
        const signer = await provider.getSigner();

        let tx;

        if (bonzoAvailable && assetAddress) {
          // Direct Bonzo LendingPool deposit
          const contract = new Contract(
            BONZO_LENDING_POOL_ADDRESS,
            BONZO_LENDING_POOL_ABI,
            signer
          );

          // For native HBAR deposits, we send value with the transaction
          // For HTS token deposits, we'd need token approval first
          tx = await contract.deposit(
            assetAddress,
            parseEther(amountHbar.toString()),
            address, // onBehalfOf = the user
            0 // referralCode
          );
        } else if (VAULT_ADDRESS) {
          // Fallback: YieldMindVault deposit
          const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
          const strategyIdHash = keccak256(toUtf8Bytes(strategyId));

          tx = await contract.deposit(strategyIdHash, vaultName, {
            value: parseEther(amountHbar.toString()),
          });
        } else {
          setDepositStatus('failed');
          return {
            status: 'failed',
            txHash: null,
            error: 'No deposit contract configured',
          };
        }

        setDepositStatus('confirming');
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          setDepositStatus('confirmed');
          return { status: 'confirmed', txHash: tx.hash, error: null };
        } else {
          setDepositStatus('failed');
          return { status: 'failed', txHash: tx.hash, error: 'Transaction reverted' };
        }
      } catch (err: unknown) {
        setDepositStatus('failed');
        const error = err as { code?: string; message?: string };

        if (error.code === 'ACTION_REJECTED') {
          return { status: 'failed', txHash: null, error: 'Transaction rejected by user' };
        }

        return { status: 'failed', txHash: null, error: error.message || 'Unknown error' };
      }
    },
    [provider, address]
  );

  /**
   * Withdraw from Bonzo LendingPool (or YieldMindVault as fallback).
   */
  const withdraw = useCallback(
    async (
      strategyId: string,
      amountHbar: number,
      assetAddress?: string
    ): Promise<TxResult> => {
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      try {
        setWithdrawStatus('signing');
        const signer = await provider.getSigner();

        let tx;

        if (bonzoAvailable && assetAddress) {
          // Direct Bonzo LendingPool withdrawal
          const contract = new Contract(
            BONZO_LENDING_POOL_ADDRESS,
            BONZO_LENDING_POOL_ABI,
            signer
          );

          const amountTinybars = BigInt(Math.round(amountHbar * 1e8));
          tx = await contract.withdraw(assetAddress, amountTinybars, address);
        } else if (VAULT_ADDRESS) {
          // Fallback: YieldMindVault withdrawal
          const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
          const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
          const amountTinybars = BigInt(Math.round(amountHbar * 1e8));
          tx = await contract.withdraw(strategyIdHash, amountTinybars);
        } else {
          setWithdrawStatus('failed');
          return { status: 'failed', txHash: null, error: 'No withdraw contract configured' };
        }

        setWithdrawStatus('confirming');
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          setWithdrawStatus('confirmed');
          return { status: 'confirmed', txHash: tx.hash, error: null };
        } else {
          setWithdrawStatus('failed');
          return { status: 'failed', txHash: tx.hash, error: 'Transaction reverted' };
        }
      } catch (err: unknown) {
        setWithdrawStatus('failed');
        const error = err as { code?: string; message?: string };

        if (error.code === 'ACTION_REJECTED') {
          return { status: 'failed', txHash: null, error: 'Transaction rejected by user' };
        }

        return { status: 'failed', txHash: null, error: error.message || 'Unknown error' };
      }
    },
    [provider, address]
  );

  /**
   * Emergency withdraw ALL HBAR from YieldMindVault (all strategies).
   * Only available when using the legacy YieldMindVault contract.
   */
  const emergencyWithdraw = useCallback(
    async (): Promise<TxResult> => {
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      if (!VAULT_ADDRESS) {
        return { status: 'failed', txHash: null, error: 'Vault contract not configured' };
      }

      try {
        setWithdrawStatus('signing');
        const signer = await provider.getSigner();
        const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
        const tx = await contract.emergencyWithdraw();

        setWithdrawStatus('confirming');
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          setWithdrawStatus('confirmed');
          return { status: 'confirmed', txHash: tx.hash, error: null };
        } else {
          setWithdrawStatus('failed');
          return { status: 'failed', txHash: tx.hash, error: 'Transaction reverted' };
        }
      } catch (err: unknown) {
        setWithdrawStatus('failed');
        const error = err as { code?: string; message?: string };

        if (error.code === 'ACTION_REJECTED') {
          return { status: 'failed', txHash: null, error: 'Transaction rejected by user' };
        }

        return { status: 'failed', txHash: null, error: error.message || 'Unknown error' };
      }
    },
    [provider, address]
  );

  /**
   * Read a user's deposit for a specific strategy (YieldMindVault only)
   */
  const getDeposit = useCallback(
    async (strategyId: string): Promise<string> => {
      if (!provider || !address || !VAULT_ADDRESS) return '0';

      try {
        const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
        const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
        const amount = await contract.getDeposit(strategyIdHash, address);
        return formatUnits(amount, HBAR_DECIMALS);
      } catch {
        return '0';
      }
    },
    [provider, address]
  );

  /**
   * Read a user's total deposits across all strategies (YieldMindVault only)
   */
  const getUserTotal = useCallback(async (): Promise<string> => {
    if (!provider || !address || !VAULT_ADDRESS) return '0';

    try {
      const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      const total = await contract.userTotals(address);
      return formatUnits(total, HBAR_DECIMALS);
    } catch {
      return '0';
    }
  }, [provider, address]);

  /**
   * Read total value locked in the vault (YieldMindVault only)
   */
  const getTVL = useCallback(async (): Promise<string> => {
    if (!provider || !VAULT_ADDRESS) return '0';

    try {
      const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      const tvl = await contract.totalValueLocked();
      return formatUnits(tvl, HBAR_DECIMALS);
    } catch {
      return '0';
    }
  }, [provider]);

  const resetStatus = useCallback(() => {
    setDepositStatus('idle');
    setWithdrawStatus('idle');
  }, []);

  return {
    deposit,
    withdraw,
    emergencyWithdraw,
    getDeposit,
    getUserTotal,
    getTVL,
    depositStatus,
    withdrawStatus,
    resetStatus,
    isReady,
    /** Whether deposits go directly to Bonzo LendingPool */
    isBonzoDirect: bonzoAvailable,
  };
}
