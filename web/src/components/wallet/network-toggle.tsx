'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  type HederaNetwork,
  getCurrentNetwork,
  setNetwork,
  getNetworkConfig,
} from '@/lib/network-config';

const NETWORKS: { id: HederaNetwork; label: string; dotColor: string }[] = [
  { id: 'mainnet', label: 'Hedera Mainnet', dotColor: 'bg-supply' },
  { id: 'testnet', label: 'Hedera Testnet', dotColor: 'bg-borrow' },
];

export function NetworkToggle() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<HederaNetwork>('mainnet');
  const ref = useRef<HTMLDivElement>(null);

  // Read from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setCurrent(getCurrentNetwork());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const active = NETWORKS.find((n) => n.id === current) || NETWORKS[0];

  const handleSwitch = async (network: HederaNetwork) => {
    if (network === current) {
      setOpen(false);
      return;
    }

    setNetwork(network);

    // Ask MetaMask to switch chain
    const config = getNetworkConfig();
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainIdHex }],
        });
      } catch (switchError: unknown) {
        const err = switchError as { code?: number };
        if (err.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: config.chainIdHex,
                chainName: config.chainName,
                rpcUrls: [config.rpcUrl],
                nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
                blockExplorerUrls: [config.hashscanBaseUrl],
              },
            ],
          });
        }
      }
    }

    // Reload so all module-level constants reinitialize
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
      >
        <img src="/hbar.webp" alt="Hedera" className="w-4 h-4 rounded-full" />
        <span className={active.dotColor + ' w-1.5 h-1.5 rounded-full'} />
        <span>{active.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-[8px] bg-[#171923] border border-border-subtle shadow-xl z-50 py-1">
          {NETWORKS.map((n) => (
            <button
              key={n.id}
              onClick={() => handleSwitch(n.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-hover transition-colors"
            >
              <span className={n.dotColor + ' w-2 h-2 rounded-full'} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.id === current && (
                <Check className="w-3.5 h-3.5 text-supply" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
