'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Activity, Play, Square, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, Maximize2 } from 'lucide-react';

interface KeeperLoopState {
  available: boolean;
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  totalHarvests: number;
  recentDecisions: Array<{
    vault: string;
    action: string;
    reasoning: string;
    timestamp: string;
  }>;
  hcsTopicId?: string | null;
  hcsHashscanUrl?: string | null;
  message?: string;
}

export function KeeperPanel() {
  const [state, setState] = useState<KeeperLoopState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/keeper/status');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const controlLoop = async (action: 'start' | 'stop' | 'run-once') => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  if (!state) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-text-muted" />
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Keeper Agent
          </span>
        </div>
        <p className="text-[11px] text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!state.available) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-text-muted" />
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Keeper Agent
          </span>
        </div>
        <p className="text-[11px] text-text-muted">
          {state.message || 'Not configured. Set mainnet credentials in .env'}
        </p>
      </div>
    );
  }

  const actionIcon = (action: string) => {
    if (action.includes('harvest-executed')) return <TrendingUp className="w-3 h-3 text-supply" />;
    if (action.includes('harvest-attempted')) return <RefreshCw className="w-3 h-3 text-points" />;
    if (action.includes('harvest-failed') || action.includes('harvest-error')) return <TrendingDown className="w-3 h-3 text-danger" />;
    if (action.includes('harvest-now')) return <TrendingDown className="w-3 h-3 text-borrow" />;
    if (action.includes('harvest-delay')) return <TrendingUp className="w-3 h-3 text-supply" />;
    return <Minus className="w-3 h-3 text-text-muted" />;
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Keeper Agent
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              state.isRunning ? 'bg-supply animate-pulse' : 'bg-text-muted'
            }`}
          />
          <span className="text-[10px] text-text-muted">
            {state.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-bold text-text-primary">{state.totalRuns}</p>
          <p className="text-[10px] text-text-muted">Analyses</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-supply">{state.totalHarvests}</p>
          <p className="text-[10px] text-text-muted">Harvests</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-medium text-text-secondary">
            {state.lastRun
              ? new Date(state.lastRun).toLocaleTimeString()
              : '—'}
          </p>
          <p className="text-[10px] text-text-muted">Last Run</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-3">
        {state.isRunning ? (
          <button
            onClick={() => controlLoop('stop')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] bg-danger/10 text-danger text-[11px] font-medium hover:bg-danger/20 transition-colors disabled:opacity-50"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => controlLoop('start')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] bg-supply/10 text-supply text-[11px] font-medium hover:bg-supply/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Start
          </button>
        )}
        <button
          onClick={() => controlLoop('run-once')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] bg-accent/10 text-accent text-[11px] font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Analyze Now
        </button>
      </div>

      {/* HCS Topic + Full Page Link */}
      <div className="flex items-center gap-2 mb-3">
        {state.hcsTopicId && (
          <a
            href={state.hcsHashscanUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            HCS: {state.hcsTopicId}
          </a>
        )}
        <Link
          href="/app/keeper"
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors ml-auto"
        >
          <Maximize2 className="w-3 h-3" />
          Full View
        </Link>
      </div>

      {/* Next Run */}
      {state.nextRun && (
        <p className="text-[10px] text-text-muted mb-3">
          Next analysis: {new Date(state.nextRun).toLocaleTimeString()}
        </p>
      )}

      {/* Recent Decisions */}
      {state.recentDecisions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            Recent Decisions
          </p>
          {state.recentDecisions.slice(0, 3).map((d, i) => (
            <motion.div
              key={`${d.timestamp}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface rounded-[6px] px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5 mb-1">
                {actionIcon(d.action)}
                <span className="text-[10px] font-medium text-text-secondary">
                  {d.action}
                </span>
                <span className="text-[10px] text-text-muted ml-auto">
                  {new Date(d.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed line-clamp-2">
                {d.reasoning.slice(0, 150)}
                {d.reasoning.length > 150 ? '...' : ''}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[10px] text-danger mt-2">{error}</p>
      )}
    </div>
  );
}
