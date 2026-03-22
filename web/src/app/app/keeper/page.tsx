'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Clock,
  Shield,
  Zap,
  BarChart3,
  ArrowLeft,
  ScrollText,
} from 'lucide-react';

interface KeeperDecision {
  vault: string;
  action: string;
  reasoning: string;
  timestamp: string;
}

interface KeeperFullState {
  available: boolean;
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  totalHarvests: number;
  totalHarvestAttempts: number;
  recentDecisions: KeeperDecision[];
  hcsTopicId: string | null;
  hcsHashscanUrl: string | null;
  agentAccountId: string | null;
  message?: string;
}

function getActionIcon(action: string) {
  if (action.includes('harvest-executed')) return <Zap className="w-4 h-4 text-supply" />;
  if (action.includes('harvest-attempted')) return <RefreshCw className="w-4 h-4 text-points" />;
  if (action.includes('harvest-failed') || action.includes('harvest-error')) return <Shield className="w-4 h-4 text-danger" />;
  if (action.includes('harvest-skipped')) return <Minus className="w-4 h-4 text-text-muted" />;
  if (action.includes('harvest-now')) return <TrendingDown className="w-4 h-4 text-borrow" />;
  if (action.includes('harvest-delay')) return <TrendingUp className="w-4 h-4 text-supply" />;
  if (action.includes('alert')) return <Shield className="w-4 h-4 text-danger" />;
  return <Minus className="w-4 h-4 text-text-muted" />;
}

function getActionBadge(action: string) {
  if (action.includes('harvest-executed')) return { label: 'Harvested', bg: 'bg-supply/10', text: 'text-supply' };
  if (action.includes('harvest-attempted')) return { label: 'Attempted (IMF)', bg: 'bg-points/10', text: 'text-points' };
  if (action.includes('harvest-failed') || action.includes('harvest-error')) return { label: 'Failed', bg: 'bg-danger/10', text: 'text-danger' };
  if (action.includes('harvest-skipped')) return { label: 'Skipped', bg: 'bg-surface', text: 'text-text-muted' };
  if (action.includes('harvest-now')) return { label: 'Harvest Now', bg: 'bg-borrow/10', text: 'text-borrow' };
  if (action.includes('harvest-delay')) return { label: 'Delay Harvest', bg: 'bg-supply/10', text: 'text-supply' };
  if (action.includes('alert')) return { label: 'Alert', bg: 'bg-danger/10', text: 'text-danger' };
  if (action.includes('monitor')) return { label: 'Monitoring', bg: 'bg-accent/10', text: 'text-accent' };
  return { label: action, bg: 'bg-surface', text: 'text-text-secondary' };
}

export default function KeeperPage() {
  const [state, setState] = useState<KeeperFullState | null>(null);
  const [loading, setLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/keeper/status');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const controlLoop = async (action: 'start' | 'stop' | 'run-once') => {
    setControlLoading(true);
    try {
      const res = await fetch('/api/keeper/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Control failed');
    } finally {
      setControlLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page text-text-primary">
      {/* Header */}
      <header className="border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="w-px h-5 bg-border-subtle" />
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo without text.png"
                alt="YieldMind"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-[#F7F6F0]">Yield</span>
                <span className="text-supply">Mind</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/hcs"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <ScrollText className="w-3 h-3" />
              HCS Trail
            </Link>
            <Link
              href="/app/portfolio"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <BarChart3 className="w-3 h-3" />
              Portfolio
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[8px] bg-accent/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Intelligent Keeper Agent</h1>
            <p className="text-sm text-text-muted">
              Autonomous vault monitoring, harvest execution, and market analysis
            </p>
          </div>
          {state && (
            <div className="ml-auto flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  state.isRunning ? 'bg-supply animate-pulse' : 'bg-text-muted'
                }`}
              />
              <span className={`text-sm font-medium ${state.isRunning ? 'text-supply' : 'text-text-muted'}`}>
                {state.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          )}
        </div>

        {/* Loading / unavailable states */}
        {!state && (
          <div className="glass-card p-8 text-center">
            <RefreshCw className="w-6 h-6 text-text-muted animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">Loading keeper status...</p>
          </div>
        )}

        {state && !state.available && (
          <div className="glass-card p-8 text-center">
            <Activity className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">
              {state.message || 'Keeper not configured. Set HEDERA_MAINNET_ACCOUNT_ID, HEDERA_MAINNET_PRIVATE_KEY, and OPENROUTER_API_KEY in .env'}
            </p>
          </div>
        )}

        {state?.available && (
          <>
            {/* Top row: Stats + Controls + HCS Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Stats Card */}
              <div className="glass-card p-4">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Total Analyses</span>
                    <span className="text-lg font-bold text-text-primary">{state.totalRuns}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Harvest Attempts</span>
                    <span className="text-lg font-bold text-points">{state.totalHarvestAttempts || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Harvests Succeeded</span>
                    <span className="text-lg font-bold text-supply">{state.totalHarvests}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Last Run</span>
                    <span className="text-sm text-text-secondary">
                      {state.lastRun ? new Date(state.lastRun).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Next Run</span>
                    <span className="text-sm text-text-secondary">
                      {state.nextRun ? new Date(state.nextRun).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls Card */}
              <div className="glass-card p-4">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Controls
                </h3>
                <div className="space-y-2">
                  {state.isRunning ? (
                    <button
                      onClick={() => controlLoop('stop')}
                      disabled={controlLoading}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-danger/10 text-danger text-sm font-medium hover:bg-danger/20 transition-colors disabled:opacity-50"
                    >
                      <Square className="w-4 h-4" />
                      Stop Keeper Loop
                    </button>
                  ) : (
                    <button
                      onClick={() => controlLoop('start')}
                      disabled={controlLoading}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-supply/10 text-supply text-sm font-medium hover:bg-supply/20 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Start Keeper Loop
                    </button>
                  )}
                  <button
                    onClick={() => controlLoop('run-once')}
                    disabled={controlLoading}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${controlLoading ? 'animate-spin' : ''}`} />
                    Analyze Now (Single Run)
                  </button>
                  <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] bg-surface border border-border-subtle text-text-secondary text-sm font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                </div>
              </div>

              {/* HCS & Agent Info Card */}
              <div className="glass-card p-4">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  On-Chain Info
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-text-muted mb-1">HCS Topic (Decision Trail)</p>
                    {state.hcsTopicId ? (
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-accent font-mono">{state.hcsTopicId}</code>
                        <a
                          href={state.hcsHashscanUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-accent transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">
                        Not configured (set HCS_GLOBAL_TOPIC_ID)
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted mb-1">Agent Account (Mainnet)</p>
                    {state.agentAccountId ? (
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-text-secondary font-mono">{state.agentAccountId}</code>
                        <a
                          href={`https://hashscan.io/mainnet/account/${state.agentAccountId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-accent transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">Not configured</p>
                    )}
                  </div>
                  {state.hcsTopicId && (
                    <Link
                      href={`/hcs`}
                      className="flex items-center justify-center gap-2 h-9 rounded-[8px] bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors mt-2"
                    >
                      <ScrollText className="w-4 h-4" />
                      View HCS Messages
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* What the Keeper Does */}
            <div className="glass-card p-4 mb-6">
              <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                How It Works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-surface">
                  <BarChart3 className="w-4 h-4 text-supply mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Scan Vaults</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Queries all Bonzo Vault contracts for pending rewards and performance
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-surface">
                  <TrendingUp className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Analyze Market</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Checks token volatility (CoinGecko) and news sentiment (RAG pipeline)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-surface">
                  <Zap className="w-4 h-4 text-borrow mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Execute Harvest</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Calls harvest() on vault strategy contracts via Hedera Agent Kit
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-surface">
                  <Shield className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Log to HCS</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Every decision published on-chain with reasoning for full transparency
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision History */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Decision History
                </h3>
                <span className="text-[11px] text-text-muted">
                  {state.recentDecisions.length} decisions
                </span>
              </div>

              {state.recentDecisions.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-8 h-8 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No decisions yet.</p>
                  <p className="text-xs text-text-muted mt-1">
                    Start the keeper loop or click &ldquo;Analyze Now&rdquo; to run a single analysis.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {state.recentDecisions.map((d, i) => {
                      const badge = getActionBadge(d.action);
                      return (
                        <motion.div
                          key={`${d.timestamp}-${i}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border border-border-subtle rounded-[8px] px-4 py-3"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {getActionIcon(d.action)}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-sm text-text-secondary font-medium">
                              {d.vault}
                            </span>
                            <span className="text-xs text-text-muted ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(d.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary leading-relaxed ml-6">
                            {d.reasoning}
                          </p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="glass-card p-4 mt-4 border border-danger/20">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
