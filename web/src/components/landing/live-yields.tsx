'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Shield, Zap, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { MarketVaultEntry, MarketVaultsResponse } from '@/app/api/market-vaults/route';

const RISK_COLORS: Record<string, string> = {
  conservative: '#10B981',
  moderate: '#3B82F6',
  aggressive: '#F59E0B',
};

const RISK_LABELS: Record<string, string> = {
  conservative: 'Low Risk',
  moderate: 'Medium Risk',
  aggressive: 'High Risk',
};

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLORS[level] || '#6B7280';
  const label = RISK_LABELS[level] || level;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18` }}
    >
      {label}
    </span>
  );
}

function TokenIcon({ symbol }: { symbol: string }) {
  const s = symbol.toUpperCase();
  const TOKEN_COLORS: Record<string, string> = {
    HBAR: '#7B3FF3',
    USDC: '#2775CA',
    SAUCE: '#FF6B35',
    HBARX: '#00D4AA',
    KARATE: '#E91E8C',
    BONZO: '#FF4D6D',
    XBONZO: '#FF4D6D',
    XSAUCE: '#FF6B35',
    DOVU: '#00BCD4',
  };
  const bg = TOKEN_COLORS[s] || '#6B7280';
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white flex-shrink-0"
      style={{ background: bg }}
    >
      {s.slice(0, 2)}
    </span>
  );
}

function VaultCard({ vault, index }: { vault: MarketVaultEntry; index: number }) {
  const isVault = vault.productType === 'bonzo-vault';
  const accentColor = isVault ? '#F59E0B' : '#10B981';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
      className="glass-card-hover p-4 flex flex-col gap-3 relative overflow-hidden group"
    >
      {/* Top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50"
        style={{ background: accentColor }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {vault.tokens.slice(0, 2).map((t) => (
            <TokenIcon key={t} symbol={t} />
          ))}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">
              {vault.name}
            </p>
            <p className="text-[11px] text-text-muted leading-tight mt-0.5">
              {isVault ? 'Auto-compounding Vault' : 'Lending Pool'}
            </p>
          </div>
        </div>
        <RiskBadge level={vault.riskLevel} />
      </div>

      {/* Stats row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[22px] font-bold leading-none" style={{ color: accentColor }}>
            {vault.apy.toFixed(2)}
            <span className="text-[13px] font-normal text-text-muted ml-0.5">% APY</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            TVL: ${vault.tvl >= 1_000_000
              ? `${(vault.tvl / 1_000_000).toFixed(2)}M`
              : vault.tvl >= 1_000
              ? `${(vault.tvl / 1_000).toFixed(0)}K`
              : vault.tvl.toFixed(0)}
          </div>
        </div>
        <Link
          href="/app"
          className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
        >
          Try strategy
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  );
}

function StatPill({ value, label, icon: Icon }: { value: string; label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] bg-surface border border-border-subtle">
      <div className="w-7 h-7 rounded-[8px] bg-supply/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-supply" />
      </div>
      <div>
        <div className="text-base font-bold text-text-primary leading-tight">{value}</div>
        <div className="text-[11px] text-text-muted leading-tight">{label}</div>
      </div>
    </div>
  );
}

export function LiveYields() {
  const [data, setData] = useState<MarketVaultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/market-vaults');
      if (res.ok) {
        const json = (await res.json()) as MarketVaultsResponse;
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // silent — show nothing if unavailable
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Top vaults to show: mix of best lend reserves + best vaults, capped at 6
  const topVaults: MarketVaultEntry[] = data
    ? [
        ...(data.lendReserves.slice(0, 3)),
        ...(data.bonzoVaults.slice(0, 3)),
      ].sort((a, b) => b.apy - a.apy).slice(0, 6)
    : [];

  return (
    <section id="live-yields" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            Live Yields
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
          </button>
        </div>

        <p className="text-text-secondary text-sm mb-8 max-w-2xl">
          Live APY rates from Bonzo Finance on Hedera — updated every 2 minutes.
          YieldMind AI agents automatically find and execute the best opportunities for you.
        </p>

        {/* Market stats */}
        {data && (
          <div className="flex flex-wrap gap-3 mb-8">
            <StatPill
              value={`${data.bestApy.toFixed(1)}%`}
              label="Best APY Available"
              icon={TrendingUp}
            />
            <StatPill
              value={`$${(data.totalTvl / 1_000_000).toFixed(1)}M`}
              label="Total Market TVL"
              icon={Shield}
            />
            <StatPill
              value={`${(data.lendReserves.length + data.bonzoVaults.length)}`}
              label="Active Yield Products"
              icon={Zap}
            />
          </div>
        )}

        {/* Vault grid */}
        {isLoading && topVaults.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-4 h-[120px] animate-pulse" />
            ))}
          </div>
        ) : topVaults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topVaults.map((vault, i) => (
              <VaultCard key={vault.id} vault={vault} index={i} />
            ))}
          </div>
        ) : (
          // Fallback — show static preview vaults if API unavailable
          <div className="glass-card px-6 py-8 text-center">
            <p className="text-sm text-text-muted">
              Live data temporarily unavailable.{' '}
              <Link href="/app" className="text-supply hover:underline">
                Launch the app
              </Link>{' '}
              to see real-time yields.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[13px] text-text-muted">
            YieldMind selects the best opportunity for your risk profile automatically.
          </p>
          <Link
            href="/app"
            className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-supply text-sm font-semibold text-white hover:bg-supply/90 transition-all shadow-md shadow-supply/20"
          >
            Start Earning
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Powered by footer */}
        <div className="mt-6 flex items-center gap-2 text-[11px] text-text-muted">
          <span>Powered by</span>
          <a href="https://bonzo.finance" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-text-secondary transition-colors">
            <img src="/bonzo.webp" alt="Bonzo" className="w-3.5 h-3.5 rounded-full" />
            Bonzo Finance
          </a>
          <span>·</span>
          <a href="https://hedera.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-text-secondary transition-colors">
            <img src="/hbar.webp" alt="Hedera" className="w-3.5 h-3.5 rounded-full" />
            Hedera Network
          </a>
          <span>·</span>
          <span>Every yield decision logged on HCS</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </section>
  );
}
