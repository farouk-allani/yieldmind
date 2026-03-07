'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, ExternalLink, LogOut, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/lib/wallet-context';
import { getNetworkConfig, hashscanAccountUrl } from '@/lib/network-config';

const WALLET_LABELS: Record<string, string> = {
  metamask: 'MetaMask',
  hashpack: 'HashPack',
  walletconnect: 'WalletConnect',
};

export function ConnectWalletButton() {
  const {
    address,
    accountId,
    balance,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    walletType,
    connect,
    disconnect,
    switchToHedera,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Not connected — show connect button
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="flex items-center gap-2 px-3 h-9 rounded-[8px] bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  // Connected but wrong network (MetaMask only) — show switch button
  if (!isCorrectNetwork) {
    return (
      <button
        onClick={switchToHedera}
        className="flex items-center gap-2 px-3 h-9 rounded-[8px] bg-borrow/20 text-borrow text-sm font-medium hover:bg-borrow/30 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        Switch to {getNetworkConfig().chainName}
      </button>
    );
  }

  // Connected + correct network — show address + dropdown
  const displayId = accountId || address;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const displayLabel = accountId
    ? `${accountId}${shortAddress ? ` (${shortAddress})` : ''}`
    : shortAddress;
  const formattedBalance = balance
    ? `${parseFloat(balance).toFixed(2)} HBAR`
    : '... HBAR';
  const walletLabel = walletType ? WALLET_LABELS[walletType] : '';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 h-9 rounded-[8px] bg-surface border border-border-subtle text-sm text-text-primary hover:bg-elevated transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-supply" />
        <span className="font-medium">{accountId || shortAddress}</span>
        <span className="text-text-muted text-[11px]">{formattedBalance}</span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-[8px] bg-[#1a1d2e] border border-border-subtle shadow-2xl z-50">
          <div className="p-3 border-b border-border-subtle bg-[#141726] rounded-t-[8px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[11px] text-text-muted">Connected via</div>
              <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                {walletLabel}
              </span>
            </div>
            {accountId && (
              <div className="text-sm font-medium text-text-primary">{accountId}</div>
            )}
            {shortAddress && (
              <div className="text-[11px] text-text-muted font-mono mt-0.5">
                {shortAddress}
              </div>
            )}
            <div className="text-sm text-supply font-medium mt-1">
              {formattedBalance}
            </div>
          </div>

          <div className="p-1.5">
            {(address || accountId) && (
              <a
                href={hashscanAccountUrl(accountId || address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-sm text-text-secondary hover:bg-[#252840] transition-colors w-full"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on HashScan
              </a>
            )}

            <button
              onClick={() => {
                disconnect();
                setDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-sm text-danger hover:bg-[#252840] transition-colors w-full"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
