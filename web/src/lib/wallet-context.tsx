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
import { BrowserProvider, formatEther } from 'ethers';
import { getNetworkConfig } from './network-config';

interface WalletState {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToHedera: () => Promise<void>;
  /** @deprecated Use switchToHedera() instead */
  switchToHederaTestnet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletState>({
  address: null,
  balance: null,
  chainId: null,
  isConnected: false,
  isCorrectNetwork: false,
  isConnecting: false,
  provider: null,
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
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  // Build HEDERA_CHAIN from config at render time (reactive to network toggle)
  const networkConfig = useMemo(() => getNetworkConfig(), []);
  const HEDERA_CHAIN = useMemo(() => ({
    chainId: networkConfig.chainIdHex,
    chainName: networkConfig.chainName,
    rpcUrls: [networkConfig.rpcUrl],
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    blockExplorerUrls: [networkConfig.hashscanBaseUrl],
  }), [networkConfig]);

  const isConnected = !!address;
  const isCorrectNetwork = chainId === networkConfig.chainId;

  const refreshBalance = useCallback(async () => {
    if (!provider || !address) return;
    try {
      const bal = await provider.getBalance(address);
      setBalance(formatEther(bal));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [provider, address]);

  // Initialize provider + check saved connection
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const p = new BrowserProvider(window.ethereum);
    setProvider(p);

    // Check if already connected (auto-reconnect)
    const saved = localStorage.getItem('ym_wallet_connected');
    if (saved === 'true') {
      p.listAccounts()
        .then((accounts) => {
          if (accounts.length > 0) {
            setAddress(accounts[0].address);
          }
        })
        .catch(() => {});
    }

    // Get chain ID
    p.getNetwork()
      .then((net) => setChainId(Number(net.chainId)))
      .catch(() => {});
  }, []);

  // Refresh balance when address or chain changes
  useEffect(() => {
    if (address && provider) {
      refreshBalance();
    }
  }, [address, provider, chainId, refreshBalance]);

  // Listen to MetaMask events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAddress(null);
        setBalance(null);
        localStorage.removeItem('ym_wallet_connected');
      } else {
        setAddress(accs[0]);
      }
    };

    const handleChainChanged = (newChainId: unknown) => {
      setChainId(Number(newChainId as string));
      // Refresh provider on chain change
      if (window.ethereum) {
        setProvider(new BrowserProvider(window.ethereum));
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const p = new BrowserProvider(window.ethereum);
      const accounts = await p.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setProvider(p);
        localStorage.setItem('ym_wallet_connected', 'true');

        const net = await p.getNetwork();
        setChainId(Number(net.chainId));
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setChainId(null);
    localStorage.removeItem('ym_wallet_connected');
  }, []);

  const switchToHedera = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HEDERA_CHAIN.chainId }],
      });
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      // Chain not added — add it
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HEDERA_CHAIN],
        });
      }
    }
  }, [HEDERA_CHAIN]);

  // Backward compatibility alias
  const switchToHederaTestnet = switchToHedera;

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        chainId,
        isConnected,
        isCorrectNetwork,
        isConnecting,
        provider,
        connect,
        disconnect,
        switchToHedera,
        switchToHederaTestnet,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
