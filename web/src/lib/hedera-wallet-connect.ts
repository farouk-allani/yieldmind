'use client';

import {
  DAppConnector,
  HederaSessionEvent,
  HederaJsonRpcMethod,
  HederaChainId,
  transactionToBase64String,
} from '@hashgraph/hedera-wallet-connect';
import { LedgerId, AccountId } from '@hiero-ledger/sdk';
import type { SessionTypes } from '@walletconnect/types';
import { getCurrentNetwork } from './network-config';

export type { DAppConnector };

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const APP_METADATA = {
  name: 'YieldMind',
  description: 'Autonomous DeFi coordination layer for Hedera',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://yieldmind.app',
  icons: ['https://yieldmind.app/icon.png'],
};

let connectorInstance: DAppConnector | null = null;
let initPromise: Promise<DAppConnector> | null = null;

function getNetwork(): { ledgerId: LedgerId; chainId: HederaChainId } {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    return { ledgerId: LedgerId.MAINNET, chainId: HederaChainId.Mainnet };
  }
  return { ledgerId: LedgerId.TESTNET, chainId: HederaChainId.Testnet };
}

/**
 * Initialize (or return cached) DAppConnector singleton.
 * Safe to call multiple times — only initializes once.
 */
export async function getHederaConnector(): Promise<DAppConnector> {
  if (connectorInstance) return connectorInstance;
  if (initPromise) return initPromise;

  if (!WALLETCONNECT_PROJECT_ID) {
    throw new Error(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. ' +
      'Get one at https://cloud.walletconnect.com'
    );
  }

  initPromise = (async () => {
    const { ledgerId, chainId } = getNetwork();

    const connector = new DAppConnector(
      APP_METADATA,
      ledgerId,
      WALLETCONNECT_PROJECT_ID,
      Object.values(HederaJsonRpcMethod),
      [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
      [chainId],
    );

    await connector.init({ logger: 'error' });
    connectorInstance = connector;
    return connector;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Open the WalletConnect modal (shows QR code / wallet list).
 * Returns the connected session.
 */
export async function connectWalletConnect(): Promise<{
  session: SessionTypes.Struct;
  accountId: string;
}> {
  const connector = await getHederaConnector();
  const session = await connector.openModal();

  // Extract account ID from session namespaces
  const accountId = extractAccountId(session);
  if (!accountId) {
    throw new Error('No Hedera account found in WalletConnect session');
  }

  return { session, accountId };
}

/**
 * Disconnect WalletConnect session.
 */
export async function disconnectWalletConnect(): Promise<void> {
  if (!connectorInstance) return;
  const signers = connectorInstance.signers;
  if (signers.length > 0) {
    try {
      const topic = signers[0].topic;
      await connectorInstance.disconnect(topic);
    } catch {
      // Session might already be dead
    }
  }
  connectorInstance = null;
  initPromise = null;
}

/**
 * Get a DAppSigner for the given account ID.
 */
export function getWalletConnectSigner(accountId: string) {
  if (!connectorInstance) {
    throw new Error('WalletConnect not initialized. Call connectWalletConnect() first.');
  }
  // Cast to any to avoid version mismatch between root and web @hiero-ledger/sdk
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return connectorInstance.getSigner(AccountId.fromString(accountId) as any);
}

/**
 * Check if there's an existing WalletConnect session.
 */
export function getExistingSession(): {
  accountId: string;
  topic: string;
} | null {
  if (!connectorInstance) return null;
  const signers = connectorInstance.signers;
  if (signers.length === 0) return null;

  const signer = signers[0];
  return {
    accountId: signer.getAccountId().toString(),
    topic: signer.topic,
  };
}

/** Extract the first Hedera account ID from a WC session */
function extractAccountId(session: SessionTypes.Struct): string | null {
  // Session namespaces contain accounts like "hedera:mainnet:0.0.12345"
  const accounts = Object.values(session.namespaces)
    .flatMap((ns) => ns.accounts || []);

  for (const account of accounts) {
    // Format: "hedera:<network>:<accountId>"
    const parts = account.split(':');
    if (parts.length >= 3) {
      return parts.slice(2).join(':'); // "0.0.12345"
    }
  }
  return null;
}

export { transactionToBase64String };
