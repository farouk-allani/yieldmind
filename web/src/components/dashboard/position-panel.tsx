'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Vault, ExternalLink, RefreshCw, Shield } from 'lucide-react';
import { useWallet } from '@/lib/wallet-context';
import { useVault } from '@/lib/use-vault';
import { hashscanAccountUrl, hashscanContractUrl } from '@/lib/network-config';
import type { Strategy } from '@/lib/types';

interface PositionPanelProps {
  activeStrategy: Strategy | null;
}

export function PositionPanel({ activeStrategy }: PositionPanelProps) {
  const wallet = useWallet();
  const vault = useVault();
  const [userTotal, setUserTotal] = useState<string>('0');
  const [tvl, setTvl] = useState<string>('0');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshPositions = useCallback(async () => {
    if (!wallet.isConnected) return;
    setIsRefreshing(true);
    try {
      const [total, totalLocked] = await Promise.all([
        vault.getUserTotal(),
        vault.getTVL(),
      ]);
      setUserTotal(total);
      setTvl(totalLocked);
    } catch {
      // Silently fail
    } finally {
      setIsRefreshing(false);
    }
  }, [wallet.isConnected, vault]);

  useEffect(() => {
    refreshPositions();
  }, [refreshPositions]);

  if (!wallet.isConnected) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Your Position
          </h3>
        </div>
        <div className="glass-card px-4 py-6 text-center">
          <p className="text-sm text-text-muted">
            Connect your wallet to view positions
          </p>
        </div>
      </div>
    );
  }

  const hasPosition = parseFloat(userTotal) > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Your Position
        </h3>
        <button
          onClick={refreshPositions}
          disabled={isRefreshing}
          className="ml-auto p-1 rounded-[8px] hover:bg-surface transition-colors"
        >
          <RefreshCw
            className={`w-3 h-3 text-text-muted ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="space-y-2">
        {/* Total deposited */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card px-3 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-badge-supply p-1.5">
                <Vault className="w-3.5 h-3.5 text-supply" />
              </div>
              <div>
                <div className="text-[11px] text-text-muted">Your Deposits</div>
                <div className="text-sm font-bold text-text-primary">
                  {parseFloat(userTotal).toFixed(2)} HBAR
                </div>
              </div>
            </div>
            {hasPosition && (
              <a
                href={hashscanAccountUrl(wallet.address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-[8px] hover:bg-surface transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
              </a>
            )}
          </div>
        </motion.div>

        {/* Protocol TVL */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-badge-accent p-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <div className="text-[11px] text-text-muted">Protocol TVL</div>
              <div className="text-sm font-bold text-text-primary">
                {parseFloat(tvl).toFixed(2)} HBAR
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active strategy */}
        {activeStrategy && activeStrategy.status === 'active' && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card px-3 py-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full bg-badge-danger p-1.5">
                <Shield className="w-3.5 h-3.5 text-danger" />
              </div>
              <div>
                <div className="text-[11px] text-text-muted">
                  Active Strategy
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {activeStrategy.overallRisk} ·{' '}
                  <span className="text-supply">
                    ~{activeStrategy.totalExpectedApy.toFixed(1)}% APY
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pl-8">
              {activeStrategy.vaults.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-text-secondary truncate mr-2">
                    {v.vaultName}
                  </span>
                  <span className="text-text-muted whitespace-nowrap">
                    {v.allocation}%
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mt-2 pl-8">
              <div className="w-1.5 h-1.5 rounded-full bg-supply animate-pulse" />
              <span className="text-[11px] text-supply">
                Sentinel monitoring active
              </span>
            </div>
          </motion.div>
        )}

        {/* Wallet balance */}
        <div className="glass-card px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">Wallet Balance</span>
            <span className="text-text-secondary font-medium">
              {wallet.balance
                ? `${parseFloat(wallet.balance).toFixed(2)} HBAR`
                : '...'}
            </span>
          </div>
        </div>

        {/* Contract link */}
        {hasPosition && (
          <a
            href={hashscanContractUrl(process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || '')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors py-1.5"
          >
            <ExternalLink className="w-3 h-3" />
            View contract on HashScan
          </a>
        )}
      </div>
    </div>
  );
}
