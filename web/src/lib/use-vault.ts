'use client';

import { useState, useCallback } from 'react';
import { Contract, parseEther, formatUnits, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from './wallet-context';
import {
  BONZO_LENDING_POOL_ABI,
  ERC20_ABI,
  WETH_GATEWAY_ABI,
  VAULT_ABI,
  getBonzoLendingPoolAddress,
  getWETHGatewayLendingPoolArg,
  getVaultAddress,
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

export function useVault() {
  const { provider, address, isConnected, isCorrectNetwork } = useWallet();
  const [depositStatus, setDepositStatus] = useState<TxStatus>('idle');
  const [withdrawStatus, setWithdrawStatus] = useState<TxStatus>('idle');

  // Read addresses dynamically at render time (not module level)
  const bonzoAddress = getBonzoLendingPoolAddress();
  const vaultAddress = getVaultAddress();
  const bonzoAvailable = !!bonzoAddress;

  const isReady =
    isConnected &&
    isCorrectNetwork &&
    !!(bonzoAvailable ? bonzoAddress : vaultAddress);

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

      // Hard network check — prevent deposits on wrong chain.
      // This catches cases where MetaMask is on testnet but UI expects mainnet.
      const expectedConfig = getNetworkConfig();
      try {
        const walletNetwork = await provider.getNetwork();
        const walletChainId = Number(walletNetwork.chainId);
        if (walletChainId !== expectedConfig.chainId) {
          return {
            status: 'failed',
            txHash: null,
            error: `Wrong network: your wallet is on chain ${walletChainId} but ${expectedConfig.chainName} (${expectedConfig.chainId}) is required. Please switch networks in MetaMask.`,
          };
        }
      } catch {
        // If we can't check, proceed cautiously
      }

      // Snapshot addresses at call time
      const lendingPoolAddress = getBonzoLendingPoolAddress();
      const yieldVaultAddress = getVaultAddress();

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

          if (gatewayAddress && lendingPoolAddress) {
            try {
              setDepositStatus('signing');
              const gateway = new Contract(gatewayAddress, WETH_GATEWAY_ABI, signer);
              const value = parseEther(amount.toString());

              // WETHGateway expects the LendingPool in Hedera long-zero format.
              // The WETHGateway's internal whitelist was populated with long-zero
              // addresses (0x000...006F84AB). Passing the full EVM alias
              // (0x236897c5...) causes a mapping miss → early revert at ~3k gas.
              const gatewayLendingPoolArg = getWETHGatewayLendingPoolArg();

              console.log(`[Vault] HBAR deposit via WETHGateway: ${amount} HBAR`);
              console.log(`[Vault] Gateway: ${gatewayAddress}`);
              console.log(`[Vault] LendingPool (long-zero for WETHGateway): ${gatewayLendingPoolArg}`);

              // Hardcoded gasLimit bypasses eth_estimateGas.
              // The Hedera JSON-RPC relay does NOT forward msg.value during
              // estimateGas simulations, so the WETHGateway sees amount=0 and
              // reverts — even though the actual transaction would succeed.
              // 2_000_000 gas is well above the ~300k needed for the full flow.
              tx = await gateway.depositETH(
                gatewayLendingPoolArg, // long-zero LendingPool (0.0.7308459)
                address,               // onBehalfOf
                0,                     // referralCode
                { value, gasLimit: 2_000_000 }
              );
            } catch (gatewayErr) {
              const errMsg = gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr);
              console.warn('[Vault] WETHGateway deposit failed, falling back to YieldMindVault:', errMsg);
              // Fall through to YieldMindVault fallback below
            }
          }

          // Fallback: YieldMindVault (accepts native HBAR only, testnet only)
          if (!tx && yieldVaultAddress) {
            setDepositStatus('signing');
            const contract = new Contract(yieldVaultAddress, VAULT_ABI, signer);
            const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
            const value = parseEther(amount.toString());
            tx = await contract.deposit(strategyIdHash, vaultName, { value });
          }
        } else if (lendingPoolAddress && assetAddress) {
          // ── ERC-20 deposit: approve + LendingPool.deposit() (no msg.value) ──
          const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
          const tokenContract = new Contract(assetAddress, ERC20_ABI, signer);

          console.log(`[Vault] ERC-20 deposit: ${amount} ${symbol} (${rawAmount} raw, ${decimals} decimals)`);
          console.log(`[Vault] Token: ${assetAddress}, LendingPool: ${lendingPoolAddress}`);

          // Always approve for HTS tokens on Hedera.
          // The allowance() view call is unreliable on HTS tokens (returns empty 0x data),
          // so we always send a fresh approve to be safe.
          // gasLimit bypasses estimateGas — same relay issue as HBAR path.
          setDepositStatus('approving');
          console.log(`[Vault] Approving ${lendingPoolAddress} to spend ${rawAmount} of ${symbol}...`);
          const approveTx = await tokenContract.approve(
            lendingPoolAddress,
            rawAmount,
            { gasLimit: 100_000 }
          );
          console.log(`[Vault] Approve tx sent: ${approveTx.hash}, waiting for confirmation...`);
          await approveTx.wait();
          console.log('[Vault] Approve confirmed. Proceeding to deposit...');

          // Deposit (MetaMask popup 2/2)
          setDepositStatus('signing');
          const lendingPool = new Contract(
            lendingPoolAddress,
            BONZO_LENDING_POOL_ABI,
            signer
          );
          try {
            // gasLimit bypasses estimateGas — Hedera relay issue (same as HBAR path).
            tx = await lendingPool.deposit(
              assetAddress,
              rawAmount,
              address, // onBehalfOf
              0,       // referralCode
              { gasLimit: 600_000 }
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
          // Fetch the actual revert reason from Mirror Node for better UX
          const mirrorNodeUrl = getNetworkConfig().mirrorNodeUrl;
          let revertReason = 'Transaction reverted';
          try {
            const res = await fetch(`${mirrorNodeUrl}/api/v1/contracts/results/${tx.hash}`);
            if (res.ok) {
              const data = await res.json() as { error_message?: string; result?: string };
              const detail = data.error_message || data.result;
              if (detail && detail !== 'SUCCESS') {
                revertReason = detail;
                console.error(`[Vault] Revert reason from Mirror Node: ${detail}`);
              }
            }
          } catch {
            // Mirror Node unavailable — use generic message
          }
          setDepositStatus('failed');
          return { status: 'failed', txHash: tx.hash, error: revertReason };
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

      // Snapshot addresses at call time
      const lendingPoolAddress = getBonzoLendingPoolAddress();
      const yieldVaultAddress = getVaultAddress();

      try {
        setWithdrawStatus('signing');
        const signer = await provider.getSigner();

        let tx;

        if (lendingPoolAddress && assetAddress) {
          // Direct Bonzo LendingPool withdrawal
          const contract = new Contract(
            lendingPoolAddress,
            BONZO_LENDING_POOL_ABI,
            signer
          );

          // Use MaxUint256 to withdraw full balance, or compute token-specific amount
          const amountRaw = BigInt(Math.round(amountHbar * 1e8));
          tx = await contract.withdraw(assetAddress, amountRaw, address);
        } else if (yieldVaultAddress) {
          // Fallback: YieldMindVault withdrawal
          const contract = new Contract(yieldVaultAddress, VAULT_ABI, signer);
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

      const yieldVaultAddress = getVaultAddress();
      if (!yieldVaultAddress) {
        return { status: 'failed', txHash: null, error: 'Vault contract not configured' };
      }

      try {
        setWithdrawStatus('signing');
        const signer = await provider.getSigner();
        const contract = new Contract(yieldVaultAddress, VAULT_ABI, signer);
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
      const yieldVaultAddress = getVaultAddress();
      if (!provider || !address || !yieldVaultAddress) return '0';

      try {
        const contract = new Contract(yieldVaultAddress, VAULT_ABI, provider);
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
    const yieldVaultAddress = getVaultAddress();
    if (!provider || !address || !yieldVaultAddress) return '0';

    try {
      const contract = new Contract(yieldVaultAddress, VAULT_ABI, provider);
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
    const yieldVaultAddress = getVaultAddress();
    if (!provider || !yieldVaultAddress) return '0';

    try {
      const contract = new Contract(yieldVaultAddress, VAULT_ABI, provider);
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
