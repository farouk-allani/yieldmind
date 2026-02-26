'use client';

import { useState, useCallback } from 'react';
import { Contract, parseEther, formatUnits, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from './wallet-context';
import {
  BONZO_LENDING_POOL_ABI,
  BONZO_LENDING_POOL_ADDRESS,
  ERC20_ABI,
  WETH_GATEWAY_ABI,
  VAULT_ABI,
  VAULT_ADDRESS,
} from './vault-abi';
import { getNetworkConfig } from './network-config';

// Hedera EVM stores msg.value in tinybars (8 decimals), not wei (18).
// parseEther works for deposits (relay converts), but reads need 8 decimals.
const HBAR_DECIMALS = 8;

export type TxStatus =
  | 'idle'
  | 'approving'
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
   * Token-aware: detects HBAR vs ERC-20 tokens and uses the correct flow.
   * - HBAR/WHBAR: WETHGateway.depositETH() — wraps HBAR → WHBAR then deposits
   * - ERC-20 (USDC, USDT, etc.): approve() + LendingPool.deposit() without msg.value
   *
   * Falls back to YieldMindVault if WETHGateway/LendingPool are not available.
   */
  const deposit = useCallback(
    async (
      strategyId: string,
      vaultName: string,
      amount: number,
      assetAddress?: string,
      symbol: string = 'HBAR',
      decimals: number = 8
    ): Promise<TxResult> => {
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      try {
        const signer = await provider.getSigner();
        const isNativeHbar = symbol === 'WHBAR' || symbol === 'HBAR';
        const networkConfig = getNetworkConfig();

        let tx;

        if (isNativeHbar) {
          // ── HBAR deposit via WETHGateway ──
          // On Hedera, native HBAR MUST go through WETHGateway (wraps to WHBAR).
          // Calling LendingPool.deposit() directly with msg.value does NOT work.
          const gatewayAddress = networkConfig.wethGatewayAddress;

          if (gatewayAddress && BONZO_LENDING_POOL_ADDRESS) {
            try {
              setDepositStatus('signing');
              const gateway = new Contract(gatewayAddress, WETH_GATEWAY_ABI, signer);
              const value = parseEther(amount.toString());

              console.log(`[Vault] HBAR deposit via WETHGateway: ${amount} HBAR`);
              console.log(`[Vault] Gateway: ${gatewayAddress}, LendingPool: ${BONZO_LENDING_POOL_ADDRESS}`);

              tx = await gateway.depositETH(
                BONZO_LENDING_POOL_ADDRESS, // lendingPool
                address,                     // onBehalfOf
                0,                           // referralCode
                { value }
              );
            } catch (gatewayErr) {
              const errMsg = gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr);
              console.warn('[Vault] WETHGateway deposit failed, falling back to YieldMindVault:', errMsg);
              // Fall through to YieldMindVault fallback below
            }
          }

          // Fallback: YieldMindVault (accepts native HBAR only)
          if (!tx && VAULT_ADDRESS) {
            setDepositStatus('signing');
            const contract = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
            const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
            const value = parseEther(amount.toString());
            tx = await contract.deposit(strategyIdHash, vaultName, { value });
          }
        } else if (bonzoAvailable && assetAddress) {
          // ── ERC-20 deposit: approve + LendingPool.deposit() (no msg.value) ──
          const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
          const tokenContract = new Contract(assetAddress, ERC20_ABI, signer);

          console.log(`[Vault] ERC-20 deposit: ${amount} ${symbol} (${rawAmount} raw, ${decimals} decimals)`);
          console.log(`[Vault] Token: ${assetAddress}, LendingPool: ${BONZO_LENDING_POOL_ADDRESS}`);

          // Always approve for HTS tokens on Hedera.
          // The allowance() view call is unreliable on HTS tokens (returns empty 0x data),
          // so we always send a fresh approve to be safe.
          setDepositStatus('approving');
          console.log(`[Vault] Approving ${BONZO_LENDING_POOL_ADDRESS} to spend ${rawAmount} of ${symbol}...`);
          const approveTx = await tokenContract.approve(
            BONZO_LENDING_POOL_ADDRESS,
            rawAmount
          );
          console.log(`[Vault] Approve tx sent: ${approveTx.hash}, waiting for confirmation...`);
          await approveTx.wait();
          console.log('[Vault] Approve confirmed. Proceeding to deposit...');

          // Deposit (MetaMask popup 2/2)
          setDepositStatus('signing');
          const lendingPool = new Contract(
            BONZO_LENDING_POOL_ADDRESS,
            BONZO_LENDING_POOL_ABI,
            signer
          );
          try {
            tx = await lendingPool.deposit(
              assetAddress,
              rawAmount,
              address, // onBehalfOf
              0        // referralCode
            );
          } catch (depositErr) {
            const errMsg = depositErr instanceof Error ? depositErr.message : String(depositErr);
            console.warn('[Vault] Bonzo LendingPool deposit failed:', errMsg);

            // Known issue: Bonzo testnet aToken contracts are not associated with
            // HTS tokens, causing CALLER_NOT_AUTHORIZED on every deposit attempt.
            // This is a Bonzo testnet deployment limitation (no one has ever
            // successfully deposited into this LendingPool — verified via Mirror Node).
            const isBonzoAuthError = errMsg.includes('CALLER_NOT_AUTHORIZED') ||
              errMsg.includes('Failed to send tokens');

            setDepositStatus('failed');
            return {
              status: 'failed',
              txHash: null,
              error: isBonzoAuthError
                ? `Bonzo testnet lending pools are not yet active for ${symbol} deposits. ` +
                  `The strategy was built using real Bonzo reserve data, but the testnet ` +
                  `aToken contracts cannot receive HTS tokens yet. ` +
                  `Try depositing HBAR instead, which uses the YieldMind escrow contract.`
                : `${symbol} deposit failed: ${errMsg}`,
            };
          }
        }

        if (!tx) {
          setDepositStatus('failed');
          return {
            status: 'failed',
            txHash: null,
            error: isNativeHbar
              ? 'No deposit contract configured (WETHGateway + YieldMindVault both unavailable)'
              : `Cannot deposit ${symbol} — Bonzo LendingPool is not configured. Set NEXT_PUBLIC_BONZO_LENDING_POOL_ADDRESS in your environment.`,
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

        console.error('[Vault] Deposit error:', error);
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

          // Use MaxUint256 to withdraw full balance, or compute token-specific amount
          const amountRaw = BigInt(Math.round(amountHbar * 1e8));
          tx = await contract.withdraw(assetAddress, amountRaw, address);
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
