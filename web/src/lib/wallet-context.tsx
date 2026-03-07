'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { BrowserProvider, formatEther, type Eip1193Provider } from 'ethers';
import { getNetworkConfig } from './network-config';

// @hiero-ledger/sdk overrides window.ethereum type to Record<string,unknown>.
// Cast to ethers Eip1193Provider for BrowserProvider compatibility.
type EthereumProvider = Eip1193Provider & {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
};
function getEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.ethereum as unknown as EthereumProvider | undefined;
}
import {
  connectWalletConnect,
  disconnectWalletConnect,
  getHederaConnector,
  getExistingSession,
} from './hedera-wallet-connect';

export type WalletType = 'metamask' | 'hashpack' | 'walletconnect';

interface WalletState {
  address: string | null;
  /** Hedera account ID (e.g. "0.0.12345") — set for WalletConnect wallets */
  accountId: string | null;
  balance: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  walletType: WalletType | null;
  /** Show wallet selection modal */
  showWalletPicker: () => void;
  /** Connect with a specific wallet type */
  connectWith: (type: WalletType) => Promise<void>;
  /** Legacy connect — opens wallet picker */
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToHedera: () => Promise<void>;
  /** @deprecated Use switchToHedera() instead */
  switchToHederaTestnet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletState>({
  address: null,
  accountId: null,
  balance: null,
  chainId: null,
  isConnected: false,
  isCorrectNetwork: false,
  isConnecting: false,
  provider: null,
  walletType: null,
  showWalletPicker: () => {},
  connectWith: async () => {},
  connect: async () => {},
  disconnect: () => {},
  switchToHedera: async () => {},
  switchToHederaTestnet: async () => {},
  refreshBalance: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Build HEDERA_CHAIN from config at render time (reactive to network toggle)
  const networkConfig = useMemo(() => getNetworkConfig(), []);
  const HEDERA_CHAIN = useMemo(() => ({
    chainId: networkConfig.chainIdHex,
    chainName: networkConfig.chainName,
    rpcUrls: [networkConfig.rpcUrl],
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    blockExplorerUrls: [networkConfig.hashscanBaseUrl],
  }), [networkConfig]);

  const isConnected = !!address || !!accountId;
  // WalletConnect wallets are always on the correct network (set during DAppConnector init)
  const isCorrectNetwork =
    walletType === 'hashpack' || walletType === 'walletconnect'
      ? true
      : chainId === networkConfig.chainId;

  const refreshBalance = useCallback(async () => {
    if (walletType === 'hashpack' || walletType === 'walletconnect') {
      // For WalletConnect wallets, fetch balance from Mirror Node
      if (!accountId) return;
      try {
        const res = await fetch(
          `${networkConfig.mirrorNodeUrl}/api/v1/accounts/${accountId}`
        );
        if (res.ok) {
          const data = await res.json() as { balance?: { balance?: number } };
          const tinybars = data.balance?.balance || 0;
          setBalance((tinybars / 1e8).toFixed(4));
        }
      } catch (err) {
        console.error('Failed to fetch WC balance:', err);
      }
    } else if (provider && address) {
      try {
        const bal = await provider.getBalance(address);
        setBalance(formatEther(bal));
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      }
    }
  }, [provider, address, accountId, walletType, networkConfig.mirrorNodeUrl]);

  // ── MetaMask: Initialize provider + check saved connection ──
  useEffect(() => {
    const saved = localStorage.getItem('ym_wallet_type');

    if (saved === 'metamask') {
      const eth = getEthereum();
      if (!eth) return;
      const p = new BrowserProvider(eth);
      setProvider(p);

      const savedConnected = localStorage.getItem('ym_wallet_connected');
      if (savedConnected === 'true') {
        p.listAccounts()
          .then((accounts) => {
            if (accounts.length > 0) {
              setAddress(accounts[0].address);
              setWalletType('metamask');
            }
          })
          .catch(() => {});
      }

      p.getNetwork()
        .then((net) => setChainId(Number(net.chainId)))
        .catch(() => {});
    }
  }, []);

  // ── WalletConnect: Restore existing session ──
  useEffect(() => {
    const saved = localStorage.getItem('ym_wallet_type');
    if (saved !== 'hashpack' && saved !== 'walletconnect') return;

    (async () => {
      try {
        await getHederaConnector();
        const existing = getExistingSession();
        if (existing) {
          setAccountId(existing.accountId);
          setWalletType(saved as WalletType);
          // Also fetch the EVM address from Mirror Node for display
          fetchEvmAddress(existing.accountId);
        } else {
          // Session expired
          localStorage.removeItem('ym_wallet_type');
          localStorage.removeItem('ym_wallet_connected');
        }
      } catch {
        // WalletConnect project ID missing or init failed
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch EVM address from Mirror Node for a Hedera account
  const fetchEvmAddress = useCallback(async (hederaAccountId: string) => {
    try {
      const res = await fetch(
        `${networkConfig.mirrorNodeUrl}/api/v1/accounts/${hederaAccountId}`
      );
      if (res.ok) {
        const data = await res.json() as { evm_address?: string };
        if (data.evm_address) {
          setAddress(data.evm_address);
        }
      }
    } catch {
      // Mirror Node unavailable
    }
  }, [networkConfig.mirrorNodeUrl]);

  // Refresh balance when address or chain changes
  useEffect(() => {
    if (isConnected) {
      refreshBalance();
    }
  }, [address, accountId, provider, chainId, isConnected, refreshBalance]);

  // ── MetaMask events ──
  useEffect(() => {
    const eth = getEthereum();
    if (!eth || walletType !== 'metamask') return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAddress(null);
        setBalance(null);
        localStorage.removeItem('ym_wallet_connected');
        localStorage.removeItem('ym_wallet_type');
        setWalletType(null);
      } else {
        setAddress(accs[0]);
      }
    };

    const handleChainChanged = (newChainId: unknown) => {
      setChainId(Number(newChainId as string));
      const freshEth = getEthereum();
      if (freshEth) {
        setProvider(new BrowserProvider(freshEth));
      }
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [walletType]);

  // ── Connect functions ──
  const connectMetaMask = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const p = new BrowserProvider(eth);
      const accounts = await p.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setProvider(p);
        setWalletType('metamask');
        setAccountId(null);
        localStorage.setItem('ym_wallet_connected', 'true');
        localStorage.setItem('ym_wallet_type', 'metamask');

        const net = await p.getNetwork();
        setChainId(Number(net.chainId));
      }
    } catch (err) {
      console.error('MetaMask connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectHashPackOrWC = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    try {
      const { accountId: acctId } = await connectWalletConnect();
      setAccountId(acctId);
      setWalletType(type);
      setProvider(null);
      localStorage.setItem('ym_wallet_connected', 'true');
      localStorage.setItem('ym_wallet_type', type);
      // Fetch EVM address for display
      await fetchEvmAddress(acctId);
    } catch (err) {
      console.error(`${type} connection failed:`, err);
    } finally {
      setIsConnecting(false);
    }
  }, [fetchEvmAddress]);

  const connectWith = useCallback(async (type: WalletType) => {
    setPickerOpen(false);
    if (type === 'metamask') {
      await connectMetaMask();
    } else {
      await connectHashPackOrWC(type);
    }
  }, [connectMetaMask, connectHashPackOrWC]);

  const showWalletPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  // Legacy connect — opens the wallet picker
  const connect = useCallback(async () => {
    setPickerOpen(true);
  }, []);

  const disconnect = useCallback(() => {
    if (walletType === 'hashpack' || walletType === 'walletconnect') {
      disconnectWalletConnect().catch(() => {});
    }
    setAddress(null);
    setAccountId(null);
    setBalance(null);
    setChainId(null);
    setProvider(null);
    setWalletType(null);
    localStorage.removeItem('ym_wallet_connected');
    localStorage.removeItem('ym_wallet_type');
  }, [walletType]);

  const switchToHedera = useCallback(async () => {
    // Only relevant for MetaMask
    const eth = getEthereum();
    if (walletType !== 'metamask' || !eth) return;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HEDERA_CHAIN.chainId }],
      });
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      if (err.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [HEDERA_CHAIN],
        });
      }
    }
  }, [HEDERA_CHAIN, walletType]);

  const switchToHederaTestnet = switchToHedera;

  return (
    <WalletContext.Provider
      value={{
        address,
        accountId,
        balance,
        chainId,
        isConnected,
        isCorrectNetwork,
        isConnecting,
        provider,
        walletType,
        showWalletPicker,
        connectWith,
        connect,
        disconnect,
        switchToHedera,
        switchToHederaTestnet,
        refreshBalance,
      }}
    >
      {children}
      {pickerOpen && (
        <WalletPickerModal
          onSelect={connectWith}
          onClose={() => setPickerOpen(false)}
          isConnecting={isConnecting}
        />
      )}
    </WalletContext.Provider>
  );
}

// ── Inline wallet picker modal ──
function WalletPickerModal({
  onSelect,
  onClose,
  isConnecting,
}: {
  onSelect: (type: WalletType) => Promise<void>;
  onClose: () => void;
  isConnecting: boolean;
}) {
  const hasMetaMask = typeof window !== 'undefined' && !!getEthereum();
  const hasProjectId = !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[360px] rounded-[12px] bg-[#141726] border border-border-subtle shadow-2xl">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="text-base font-bold text-text-primary">Connect Wallet</h3>
          <p className="text-[11px] text-text-muted mt-1">
            Choose a wallet to connect to YieldMind
          </p>
        </div>

        <div className="p-3 space-y-2">
          {/* HashPack — Primary for Hedera */}
          {hasProjectId && (
            <button
              onClick={() => onSelect('hashpack')}
              disabled={isConnecting}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-[8px] bg-surface border border-border-subtle hover:bg-elevated transition-colors disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-lg font-bold text-[#8B5CF6]">
                H
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text-primary">HashPack</div>
                <div className="text-[11px] text-text-muted">Hedera native wallet</div>
              </div>
              <span className="ml-auto text-[10px] text-supply bg-supply/10 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            </button>
          )}

          {/* Kabila */}
          {hasProjectId && (
            <button
              onClick={() => onSelect('walletconnect')}
              disabled={isConnecting}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-[8px] bg-surface border border-border-subtle hover:bg-elevated transition-colors disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-full bg-[#3B82F6]/20 flex items-center justify-center text-lg font-bold text-[#3B82F6]">
                K
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text-primary">Kabila / Other</div>
                <div className="text-[11px] text-text-muted">WalletConnect compatible</div>
              </div>
            </button>
          )}

          {/* MetaMask */}
          <button
            onClick={() => onSelect('metamask')}
            disabled={isConnecting}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-[8px] bg-surface border border-border-subtle hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-full bg-[#F6851B]/20 flex items-center justify-center text-lg font-bold text-[#F6851B]">
              M
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-text-primary">
                MetaMask {!hasMetaMask && '(not installed)'}
              </div>
              <div className="text-[11px] text-text-muted">EVM wallet (limited HTS support)</div>
            </div>
          </button>

          {!hasProjectId && (
            <p className="text-[11px] text-borrow px-2 py-1">
              Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable HashPack &amp; Kabila.
              Get one at cloud.walletconnect.com
            </p>
          )}
        </div>

        <div className="p-3 pt-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
