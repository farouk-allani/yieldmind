'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Vault, ExternalLink, RefreshCw, Shield } from 'lucide-react';
import { useWallet } from '@/lib/wallet-context';
import { useBonzoPositions } from '@/lib/use-bonzo-positions';
import { hashscanAccountUrl } from '@/lib/network-config';
import type { Strategy } from '@/lib/types';

interface PositionPanelProps {
  activeStrategy: Strategy | null;
}

export function PositionPanel({ activeStrategy }: PositionPanelProps) {
  const wallet = useWallet();
  const bonzo = useBonzoPositions();

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

  const hasPositions = bonzo.positions.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Your Position
        </h3>
        <button
          onClick={bonzo.refresh}
          disabled={bonzo.isLoading}
          className="ml-auto p-1 rounded-[8px] hover:bg-surface transition-colors"
        >
          <RefreshCw
            className={`w-3 h-3 text-text-muted ${bonzo.isLoading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="space-y-2">
        {/* Bonzo positions */}
        {hasPositions ? (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card px-3 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-badge-supply p-1.5">
                  <Vault className="w-3.5 h-3.5 text-supply" />
                </div>
                <div>
                  <div className="text-[11px] text-text-muted">Bonzo Deposits</div>
                  <div className="text-sm font-bold text-text-primary">
                    ${bonzo.totalUsdValue.toFixed(2)}
                  </div>
                </div>
              </div>
              {wallet.address && (
                <a
                  href={hashscanAccountUrl(wallet.accountId || wallet.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-[8px] hover:bg-surface transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                </a>
              )}
            </div>

            <div className="space-y-1.5 pl-8">
              {bonzo.positions.map((pos) => (
                <div
                  key={pos.symbol}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-text-secondary">
                    {pos.balance.toFixed(pos.decimals <= 6 ? 2 : 4)} {pos.displaySymbol}
                  </span>
                  <span className="text-supply whitespace-nowrap">
                    {pos.supplyApy.toFixed(2)}% APY
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-badge-supply p-1.5">
                <Vault className="w-3.5 h-3.5 text-supply" />
              </div>
              <div>
                <div className="text-[11px] text-text-muted">Bonzo Deposits</div>
                <div className="text-sm font-bold text-text-primary">
                  {bonzo.isLoading ? '...' : '$0.00'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
      </div>
    </div>
  );
}
