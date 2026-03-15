'use client';

import { useState, useCallback } from 'react';
import { Contract, parseEther, formatUnits, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from './wallet-context';
import {
  BONZO_LENDING_POOL_ABI,
  ERC20_ABI,
  VAULT_ABI,
  getBonzoLendingPoolAddress,
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

// ── Hedera SDK deposit via WalletConnect (HashPack / Kabila) ──

// ── Known Bonzo contract Hedera IDs ──
// We maintain these mappings because ContractId.fromEvmAddress() doesn't
// reverse-lookup the actual Hedera ID — it just encodes bytes, causing
// INVALID_CONTRACT_ID errors. These are verified via Mirror Node.
const BONZO_HEDERA_IDS: Record<string, Record<string, string>> = {
  mainnet: {
    // LendingPool: 0x236897c518996163E7b313aD21D1C9fCC7BA1afc
    lendingPool: '0.0.7308459',
    lendingPoolEvm: '236897c518996163e7b313ad21d1c9fcc7ba1afc',
    // WHBARGateway (Hedera-native): 0xa7e46f496b088a8f8ee35b74d7e58d6ce648ae64
    // Uses depositHBAR(address,address,uint16) — wraps HBAR→WHBAR via IWhbarHelper
    whbarGateway: '0.0.10071466',
    // WETHGateway (original Aave v2 fork): 0x9a601543e9264255BebB20Cef0E7924e97127105
    // Uses withdrawETH(address,uint256,address) — for HBAR withdrawals
    // WHBARGateway has a safeApprove bug; use WETHGateway for withdrawals instead.
    wethGateway: '0.0.7308485',
    wethGatewayEvm: '9a601543e9264255bebb20cef0e7924e97127105',
  },
  testnet: {
    // LendingPool: 0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2
    lendingPool: '0.0.4999355',
    lendingPoolEvm: 'f67dbe9bd1b331ca379c44b5562eaa1ce831ebc2',
    // WETHGateway (testnet): 0x16197Ef10F26De77C9873d075f8774BdEc20A75d
    whbarGateway: '0.0.4999360',
  },
};

/**
 * Resolve an EVM address to a Hedera account/contract ID via Mirror Node.
 * Falls back to extracting the account number from long-zero format addresses.
 */
async function resolveHederaId(evmAddress: string, mirrorNodeUrl: string): Promise<string> {
  // Long-zero format (0x000...00XXXX) — extract account number directly
  if (evmAddress.startsWith('0x000000000000000000000000000000')) {
    const accountNum = parseInt(evmAddress.slice(2), 16);
    return `0.0.${accountNum}`;
  }

  // Full EVM alias — look up via Mirror Node
  try {
    const res = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${evmAddress}`);
    if (res.ok) {
      const data = await res.json() as { account?: string };
      if (data.account) return data.account;
    }
  } catch {
    // Mirror Node unavailable
  }

  throw new Error(`Cannot resolve Hedera ID for ${evmAddress}`);
}

/**
 * Execute a Bonzo deposit using the Hedera SDK + WalletConnect.
 *
 * For HBAR: calls WHBARGateway.depositHBAR(lendingPool, onBehalfOf, referralCode)
 *   with native HBAR value. The WHBARGateway wraps HBAR→WHBAR via IWhbarHelper
 *   then deposits into LendingPool. Selector: 0x08154a7b
 *
 * For ERC-20 (USDC, etc.): approve + LendingPool.deposit()
 */
async function depositViaHederaSDK(
  accountId: string,
  lendingPoolAddress: string,
  assetAddress: string,
  rawAmount: bigint,
  symbol: string,
  isNativeHbar: boolean,
  setStatus: (s: TxStatus) => void,
): Promise<TxResult> {
  const { ContractExecuteTransaction, ContractId, AccountAllowanceApproveTransaction, TokenId, Hbar } =
    await import('@hiero-ledger/sdk');
  const { getHederaConnector, transactionToBase64String } =
    await import('./hedera-wallet-connect');
  const { getCurrentNetwork, getNetworkConfig } = await import('./network-config');

  const connector = await getHederaConnector();
  const network = getCurrentNetwork();
  const mirrorNodeUrl = getNetworkConfig().mirrorNodeUrl;
  const knownIds = BONZO_HEDERA_IDS[network] || BONZO_HEDERA_IDS.mainnet;
  const signerAccountId = `hedera:${network}:${accountId}`;

  // Resolve the user's EVM address for onBehalfOf parameter
  let userEvmAddress = '';
  try {
    const res = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
    if (res.ok) {
      const data = await res.json() as { evm_address?: string };
      userEvmAddress = data.evm_address || '';
    }
  } catch { /* use fallback */ }

  // Build onBehalfOf: user's address in 32-byte ABI-encoded form
  let onBehalfOf: string;
  if (userEvmAddress) {
    onBehalfOf = userEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
  } else {
    const accountNum = parseInt(accountId.split('.')[2], 10);
    onBehalfOf = accountNum.toString(16).padStart(64, '0');
  }

  if (isNativeHbar) {
    // ── HBAR deposit via WHBARGateway ──
    // WHBARGateway.depositHBAR(address lendingPool, address onBehalfOf, uint16 referralCode)
    // Selector: 0x08154a7b (keccak256)
    // The HBAR value is sent as payableAmount — WHBARGateway wraps it to WHBAR via IWhbarHelper.
    // IMPORTANT: lendingPool param must be the EVM address (not Hedera ID).
    setStatus('signing');
    console.log(`[Vault/SDK] Depositing ${symbol} via WHBARGateway.depositHBAR (HBAR→WHBAR wrap + deposit)...`);

    // LendingPool EVM address padded to 32 bytes (the WHBARGateway validates this)
    const lendingPoolEvmPadded = (knownIds.lendingPoolEvm || '').padStart(64, '0');
    const referralCode = ''.padStart(64, '0');

    const callData = Buffer.from(
      '08154a7b' + lendingPoolEvmPadded + onBehalfOf + referralCode,
      'hex'
    );

    // Convert HBAR amount: rawAmount is in tinybars (8 decimals)
    const hbarAmount = Hbar.fromTinybars(Number(rawAmount));

    const depositTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(knownIds.whbarGateway))
      .setGas(2_000_000) // WHBARGateway needs ~1.75M gas (wrap + approve + deposit)
      .setPayableAmount(hbarAmount)
      .setFunctionParameters(callData)
      .setMaxTransactionFee(new Hbar(10));

    setStatus('confirming');
    const result = await connector.signAndExecuteTransaction({
      signerAccountId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionList: transactionToBase64String(depositTx as any),
    });

    console.log('[Vault/SDK] WHBARGateway deposit result:', result);
    const txId = (result as { transactionId?: string })?.transactionId || null;
    setStatus('confirmed');
    return { status: 'confirmed', txHash: txId, error: null };

  } else {
    // ── ERC-20 deposit: approve + LendingPool.deposit() ──

    // Step 1: Approve the LendingPool to spend the token
    setStatus('approving');
    const tokenHederaId = await resolveHederaId(assetAddress, mirrorNodeUrl);
    console.log(`[Vault/SDK] Approving ${symbol} (${tokenHederaId}) for LendingPool...`);

    const approveTx = new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(
        TokenId.fromString(tokenHederaId),
        accountId,
        knownIds.lendingPool,
        Number(rawAmount),
      )
      .setMaxTransactionFee(new Hbar(2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approveResult = await connector.signAndExecuteTransaction({
      signerAccountId,
      transactionList: transactionToBase64String(approveTx as any),
    });
    console.log('[Vault/SDK] Approve result:', approveResult);

    // Step 2: Call LendingPool.deposit(asset, amount, onBehalfOf, referralCode)
    setStatus('signing');
    console.log(`[Vault/SDK] Depositing ${symbol} into Bonzo LendingPool...`);

    // ABI encode: deposit(address,uint256,address,uint16) = 0xe8eda9df
    const assetPadded = assetAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const amountHex = rawAmount.toString(16).padStart(64, '0');
    const referralCode = ''.padStart(64, '0');
    const callData = Buffer.from(
      'e8eda9df' + assetPadded + amountHex + onBehalfOf + referralCode,
      'hex'
    );

    const depositTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(knownIds.lendingPool))
      .setGas(1_500_000) // Hedera HTS operations need more gas than standard EVM
      .setFunctionParameters(callData)
      .setMaxTransactionFee(new Hbar(10));

    setStatus('confirming');
    const result = await connector.signAndExecuteTransaction({
      signerAccountId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionList: transactionToBase64String(depositTx as any),
    });

    console.log('[Vault/SDK] LendingPool deposit result:', result);
    const txId = (result as { transactionId?: string })?.transactionId || null;
    setStatus('confirmed');
    return { status: 'confirmed', txHash: txId, error: null };
  }
}

// ── Withdraw via Hedera SDK (WalletConnect) ──

/**
 * Execute a Bonzo withdraw using the Hedera SDK + WalletConnect.
 *
 * For HBAR/WHBAR: ERC20-approve aWHBAR for WHBARGateway, then call
 *   withdrawHBAR(address lendingPool, uint256 amount, address to)
 *   Selector: 0xb465c052
 *
 * For ERC-20: call LendingPool.withdraw(asset, amount, to)
 */
async function withdrawViaHederaSDK(
  accountId: string,
  aTokenAddress: string,
  assetAddress: string,
  rawAmount: bigint,
  symbol: string,
  isNativeHbar: boolean,
  setStatus: (s: TxStatus) => void,
): Promise<TxResult> {
  const { ContractExecuteTransaction, ContractId, AccountAllowanceApproveTransaction, TokenId, Hbar } =
    await import('@hiero-ledger/sdk');
  const { getHederaConnector, transactionToBase64String } =
    await import('./hedera-wallet-connect');
  const { getCurrentNetwork, getNetworkConfig } = await import('./network-config');

  const connector = await getHederaConnector();
  const network = getCurrentNetwork();
  const mirrorNodeUrl = getNetworkConfig().mirrorNodeUrl;
  const knownIds = BONZO_HEDERA_IDS[network] || BONZO_HEDERA_IDS.mainnet;
  const signerAccountId = `hedera:${network}:${accountId}`;

  // Resolve user's EVM address
  let userEvmAddress = '';
  try {
    const res = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
    if (res.ok) {
      const data = await res.json() as { evm_address?: string };
      userEvmAddress = data.evm_address || '';
    }
  } catch { /* ignore */ }

  if (isNativeHbar) {
    // ── HBAR/WHBAR withdraw via LendingPool.withdraw() directly ──
    // Gateway contracts are broken (WHBARGateway: safeApprove bug, WETHGateway:
    // WalletConnect can't sequence approve+withdraw). Use LendingPool.withdraw()
    // directly — user receives WHBAR (HTS token 0.0.1456986).
    //
    // Prerequisite: user must be associated with WHBAR token on Hedera.
    // If not, we send a TokenAssociateTransaction first (one click), then
    // the user clicks Withdraw again for the actual LendingPool.withdraw().

    const whbarTokenId = '0.0.1456986'; // WHBAR HTS token ID
    const whbarEvm = '0000000000000000000000000000000000163b5a';
    const amountHex = rawAmount.toString(16).padStart(64, '0');

    // Check if user is associated with WHBAR via Mirror Node
    let isAssociated = false;
    try {
      const res = await fetch(
        `${mirrorNodeUrl}/api/v1/accounts/${accountId}/tokens?token.id=${whbarTokenId}&limit=1`
      );
      if (res.ok) {
        const data = await res.json() as { tokens?: Array<{ token_id: string }> };
        isAssociated = (data.tokens?.length ?? 0) > 0;
      }
      console.log(`[Vault/SDK] WHBAR token association: ${isAssociated ? 'YES' : 'NO'}`);
    } catch {
      console.warn('[Vault/SDK] Could not check token association');
    }

    // If not associated, send TokenAssociateTransaction first
    if (!isAssociated) {
      setStatus('approving');
      console.log('[Vault/SDK] User not associated with WHBAR — sending TokenAssociateTransaction...');

      const { TokenAssociateTransaction } = await import('@hiero-ledger/sdk');
      const { TokenId } = await import('@hiero-ledger/sdk');

      const associateTx = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([TokenId.fromString(whbarTokenId)])
        .setMaxTransactionFee(new Hbar(5));

      try {
        const assocResult = await connector.signAndExecuteTransaction({
          signerAccountId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transactionList: transactionToBase64String(associateTx as any),
        });
        console.log('[Vault/SDK] Token associate result:', assocResult);
      } catch (assocErr) {
        console.error('[Vault/SDK] Token association failed:', assocErr);
        setStatus('idle');
        return {
          status: 'failed',
          txHash: null,
          error: `Token association failed: ${assocErr instanceof Error ? assocErr.message : String(assocErr)}. Please try again.`,
        };
      }

      // WalletConnect can't do two txs in sequence — tell user to click again
      setStatus('idle');
      return {
        status: 'failed',
        txHash: null,
        error: 'WHBAR token associated! Please click Withdraw again to complete. (You will receive WHBAR tokens.)',
      };
    }

    // User is associated with WHBAR — proceed with LendingPool.withdraw()
    let toPadded: string;
    if (userEvmAddress) {
      toPadded = userEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    } else {
      const accountNum = parseInt(accountId.split('.')[2], 10);
      toPadded = accountNum.toString(16).padStart(64, '0');
    }

    // LendingPool.withdraw(address asset, uint256 amount, address to)
    // Selector: 0x69328dec
    setStatus('signing');
    console.log(`[Vault/SDK] Withdrawing ${symbol} via LendingPool.withdraw() (returns WHBAR)...`);
    console.log(`[Vault/SDK] withdraw params: asset=WHBAR(${whbarEvm}), amount=${amountHex}, to=${toPadded}`);

    const withdrawCallData = Buffer.from(
      '69328dec' + whbarEvm.padStart(64, '0') + amountHex + toPadded,
      'hex'
    );

    const withdrawTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(knownIds.lendingPool))
      .setGas(1_500_000)
      .setFunctionParameters(withdrawCallData)
      .setMaxTransactionFee(new Hbar(10));

    setStatus('confirming');
    let result;
    try {
      result = await connector.signAndExecuteTransaction({
        signerAccountId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transactionList: transactionToBase64String(withdrawTx as any),
      });
      console.log('[Vault/SDK] LendingPool withdraw result:', result);
    } catch (withdrawErr) {
      console.error('[Vault/SDK] Withdraw step failed:', withdrawErr);
      const errStr = withdrawErr instanceof Error ? withdrawErr.message : String(withdrawErr);
      setStatus('idle');
      return {
        status: 'failed',
        txHash: null,
        error: errStr.includes('CONTRACT_REVERT')
          ? 'Withdrawal reverted. Please try a smaller amount.'
          : `Withdrawal failed: ${errStr}`,
      };
    }

    // Verify via Mirror Node that the contract didn't revert
    const txId = (result as { transactionId?: string })?.transactionId || null;
    if (txId) {
      try {
        await new Promise(r => setTimeout(r, 3000));
        const txIdFormatted = txId.replace('@', '-').replace(/\./g, '-');
        const res = await fetch(`${mirrorNodeUrl}/api/v1/contracts/results/${txIdFormatted}`);
        if (res.ok) {
          const data = await res.json() as { result?: string; error_message?: string };
          if (data.result === 'CONTRACT_REVERT_EXECUTED' || data.error_message) {
            console.error('[Vault/SDK] Contract reverted:', data.error_message);
            setStatus('idle');
            return {
              status: 'failed',
              txHash: txId,
              error: `Withdrawal reverted: ${data.error_message || 'unknown reason'}. Try a smaller amount.`,
            };
          }
        }
      } catch {
        // Mirror Node check failed — proceed optimistically
      }
    }

    setStatus('confirmed');
    return { status: 'confirmed', txHash: txId, error: null };

  } else {
    // ── ERC-20 withdraw via LendingPool.withdraw(asset, amount, to) ──
    // selector: 0x69328dec
    setStatus('signing');
    console.log(`[Vault/SDK] Withdrawing ${symbol} from Bonzo LendingPool...`);

    const assetPadded = assetAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const amountHex = rawAmount.toString(16).padStart(64, '0');

    let toPadded: string;
    if (userEvmAddress) {
      toPadded = userEvmAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    } else {
      const accountNum = parseInt(accountId.split('.')[2], 10);
      toPadded = accountNum.toString(16).padStart(64, '0');
    }

    const withdrawCallData = Buffer.from(
      '69328dec' + assetPadded + amountHex + toPadded,
      'hex'
    );

    const withdrawTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(knownIds.lendingPool))
      .setGas(1_500_000)
      .setFunctionParameters(withdrawCallData)
      .setMaxTransactionFee(new Hbar(10));

    setStatus('confirming');
    const result = await connector.signAndExecuteTransaction({
      signerAccountId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionList: transactionToBase64String(withdrawTx as any),
    });

    console.log('[Vault/SDK] LendingPool withdraw result:', result);
    const txId = (result as { transactionId?: string })?.transactionId || null;
    setStatus('confirmed');
    return { status: 'confirmed', txHash: txId, error: null };
  }
}

// ── Main hook ──

export function useVault() {
  const { provider, address, accountId, isConnected, isCorrectNetwork, walletType } = useWallet();
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

  const isWalletConnect = walletType === 'hashpack' || walletType === 'walletconnect';

  /**
   * Deposit into Bonzo LendingPool.
   *
   * Two paths:
   * - MetaMask: ethers.js Contract calls (approve + deposit)
   * - HashPack/Kabila: Hedera SDK ContractExecuteTransaction via WalletConnect
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
      // ── WalletConnect path (HashPack / Kabila) ──
      if (isWalletConnect && accountId) {
        const lendingPoolAddress = getBonzoLendingPoolAddress();
        if (!lendingPoolAddress) {
          return { status: 'failed', txHash: null, error: 'Bonzo LendingPool not configured' };
        }

        // Determine if this is a native HBAR deposit (goes through WETHGateway)
        // or an ERC-20 deposit (approve + LendingPool.deposit)
        const isHbar = symbol === 'HBAR' || symbol === 'WHBAR';
        const tokenAddress = assetAddress || (isHbar ? '0x0000000000000000000000000000000000163b5a' : '');
        if (!tokenAddress) {
          return { status: 'failed', txHash: null, error: `No asset address for ${symbol}` };
        }

        const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

        try {
          setDepositStatus('signing');
          return await depositViaHederaSDK(
            accountId,
            lendingPoolAddress,
            tokenAddress,
            rawAmount,
            symbol,
            isHbar, // HBAR → WHBARGateway, ERC-20 → LendingPool
            setDepositStatus,
          );
        } catch (err: unknown) {
          setDepositStatus('failed');
          const error = err as { message?: string };
          console.error('[Vault/SDK] Deposit error:', error);
          return {
            status: 'failed',
            txHash: null,
            error: error.message || 'WalletConnect deposit failed',
          };
        }
      }

      // ── MetaMask path (ethers.js) ──
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      // Hard network check — prevent deposits on wrong chain
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
        // isNativeHbar is only true for bare 'HBAR' with no EVM asset address.
        // WHBAR has a real EVM address and goes through the ERC-20 path.
        const isNativeHbar = symbol === 'HBAR' && !assetAddress;

        let tx;

        if (isNativeHbar) {
          // ── HBAR deposit (MetaMask) ──
          // The Bonzo WETHGateway on mainnet is broken (zero immutables).
          // Try WHBAR as ERC-20 if user has pre-wrapped WHBAR.
          const whbarAddress = '0x0000000000000000000000000000000000163b5a';

          if (lendingPoolAddress && assetAddress) {
            // Fall through to ERC-20 path below
          } else if (lendingPoolAddress) {
            const rawAmount = BigInt(Math.round(amount * 1e8));
            const whbarContract = new Contract(whbarAddress, ERC20_ABI, signer);

            console.log(`[Vault] HBAR→WHBAR ERC-20 deposit: ${amount} WHBAR`);
            setDepositStatus('approving');
            const approveTx = await whbarContract.approve(
              lendingPoolAddress,
              rawAmount,
              { gasLimit: 100_000 }
            );
            await approveTx.wait();

            setDepositStatus('signing');
            const lendingPool = new Contract(lendingPoolAddress, BONZO_LENDING_POOL_ABI, signer);
            try {
              tx = await lendingPool.deposit(
                whbarAddress,
                rawAmount,
                address,
                0,
                { gasLimit: 600_000 }
              );
            } catch (whbarErr) {
              const errMsg = whbarErr instanceof Error ? whbarErr.message : String(whbarErr);
              console.warn('[Vault] WHBAR deposit failed:', errMsg);
              setDepositStatus('failed');
              return {
                status: 'failed',
                txHash: null,
                error:
                  'HBAR deposit via MetaMask failed. Try connecting with HashPack or Kabila ' +
                  'for native Hedera wallet support, or deposit USDC/USDT directly.',
              };
            }
          }

          // Fallback: YieldMindVault (testnet only)
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

          setDepositStatus('signing');
          const lendingPool = new Contract(
            lendingPoolAddress,
            BONZO_LENDING_POOL_ABI,
            signer
          );
          try {
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

            const isBonzoAuthError = errMsg.includes('CALLER_NOT_AUTHORIZED') ||
              errMsg.includes('Failed to send tokens');

            setDepositStatus('failed');
            return {
              status: 'failed',
              txHash: null,
              error: isBonzoAuthError
                ? `Bonzo testnet lending pools are not yet active for ${symbol} deposits. ` +
                  `Try connecting with HashPack or Kabila for native Hedera wallet support.`
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
              ? 'No deposit contract configured. Try connecting with HashPack or Kabila.'
              : `Cannot deposit ${symbol} — Bonzo LendingPool is not configured.`,
          };
        }

        setDepositStatus('confirming');
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          setDepositStatus('confirmed');
          return { status: 'confirmed', txHash: tx.hash, error: null };
        } else {
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
            // Mirror Node unavailable
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
    [provider, address, accountId, isWalletConnect]
  );

  /**
   * Withdraw from Bonzo LendingPool (or YieldMindVault as fallback).
   *
   * For Bonzo mainnet withdrawals:
   * - Pass `assetAddress` (underlying token) and `aTokenAddress` (aToken for approval)
   * - HBAR/WHBAR goes through WHBARGateway, ERC-20 goes through LendingPool.withdraw
   *
   * @param strategyId - Strategy identifier (used for YieldMindVault fallback)
   * @param amount - Human-readable amount to withdraw
   * @param assetAddress - Underlying asset EVM address (e.g., WHBAR address)
   * @param symbol - Token symbol (HBAR, WHBAR, USDC, etc.)
   * @param decimals - Token decimals (8 for HBAR/WHBAR, 6 for USDC, etc.)
   * @param aTokenAddress - Bonzo aToken EVM address (needed for WHBARGateway approval)
   */
  const withdraw = useCallback(
    async (
      strategyId: string,
      amount: number,
      assetAddress?: string,
      symbol: string = 'HBAR',
      decimals: number = 8,
      aTokenAddress?: string,
    ): Promise<TxResult> => {
      // ── WalletConnect path (HashPack / Kabila) ──
      if (isWalletConnect && accountId && assetAddress && aTokenAddress) {
        const isHbar = symbol === 'HBAR' || symbol === 'WHBAR';
        const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

        try {
          setWithdrawStatus('approving');
          return await withdrawViaHederaSDK(
            accountId,
            aTokenAddress,
            assetAddress,
            rawAmount,
            symbol,
            isHbar,
            setWithdrawStatus,
          );
        } catch (err: unknown) {
          setWithdrawStatus('failed');
          const error = err as { message?: string };
          console.error('[Vault/SDK] Withdraw error:', error);
          return {
            status: 'failed',
            txHash: null,
            error: error.message || 'WalletConnect withdraw failed',
          };
        }
      }

      // ── MetaMask path (ethers.js) ──
      if (!provider || !address) {
        return { status: 'failed', txHash: null, error: 'Wallet not connected' };
      }

      const lendingPoolAddress = getBonzoLendingPoolAddress();
      const yieldVaultAddress = getVaultAddress();

      try {
        setWithdrawStatus('signing');
        const signer = await provider.getSigner();

        let tx;

        if (lendingPoolAddress && assetAddress) {
          const contract = new Contract(lendingPoolAddress, BONZO_LENDING_POOL_ABI, signer);
          const amountRaw = BigInt(Math.round(amount * Math.pow(10, decimals)));
          tx = await contract.withdraw(assetAddress, amountRaw, address);
        } else if (yieldVaultAddress) {
          const contract = new Contract(yieldVaultAddress, VAULT_ABI, signer);
          const strategyIdHash = keccak256(toUtf8Bytes(strategyId));
          const amountTinybars = BigInt(Math.round(amount * 1e8));
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
    [provider, address, accountId, isWalletConnect]
  );

  /**
   * Emergency withdraw ALL HBAR from YieldMindVault (all strategies).
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
