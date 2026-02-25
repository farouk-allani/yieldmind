'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { DecisionLog, AgentRole } from '@/lib/types';

interface DecisionLogPanelProps {
  decisions: DecisionLog[];
}

const ROLE_CONFIG: Record<AgentRole, { label: string; icon: string; text: string; bg: string }> = {
  scout: { label: 'SCT', icon: '/scout.png', text: 'text-supply', bg: 'bg-badge-supply' },
  strategist: { label: 'STR', icon: '/strategist.png', text: 'text-accent', bg: 'bg-badge-accent' },
  executor: { label: 'EXE', icon: '/execute.png', text: 'text-borrow', bg: 'bg-badge-borrow' },
  sentinel: { label: 'SNT', icon: '/sentinel.png', text: 'text-danger', bg: 'bg-badge-danger' },
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-supply';
  if (confidence >= 0.4) return 'text-points';
  return 'text-danger';
}

function getDataSourceLabel(data: Record<string, unknown>): string | null {
  if (data.dataSource === 'bonzo-mainnet-live') return 'Live Data';
  if (data.transactionId) return 'On-Chain';
  return null;
}

function getHashScanUrl(data: Record<string, unknown>): string | null {
  if (typeof data.hashscanUrl === 'string') return data.hashscanUrl;
  const results = data.results as Array<{ hashscanUrl?: string }> | undefined;
  if (results?.[0]?.hashscanUrl) return results[0].hashscanUrl;
  return null;
}

export function DecisionLogPanel({ decisions }: DecisionLogPanelProps) {
  const sortedDecisions = [...decisions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            HCS Decision Trail
          </h3>
          <span className="text-[11px] text-text-muted">
            {decisions.length} logged
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] bg-surface">
          <div className="w-1 h-1 rounded-full bg-supply animate-pulse" />
          <span className="text-[10px] text-text-muted">On-Chain</span>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence>
          {sortedDecisions.length === 0 ? (
            <p className="text-[11px] text-text-muted text-center py-4">
              No decisions yet. Send a message to activate agents.
            </p>
          ) : (
            sortedDecisions.map((decision, i) => {
              const config = ROLE_CONFIG[decision.agentRole];
              const dataSource = getDataSourceLabel(decision.data);
              const hashscanUrl = getHashScanUrl(decision.data);

              return (
                <motion.div
                  key={`${decision.agentId}-${decision.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-[4px] bg-[#F7F6F0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        src={config.icon}
                        alt={config.label}
                        className="w-3 h-3 object-contain"
                      />
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] ${config.bg} ${config.text}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      {decision.action}
                    </span>
                    {dataSource && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-supply/10 text-supply font-medium">
                        {dataSource}
                      </span>
                    )}
                    <span className="text-[11px] text-text-muted ml-auto">
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary leading-relaxed ml-7">
                    {decision.reasoning}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 ml-7">
                    <span className="text-[11px] text-text-muted">
                      confidence:{' '}
                      <span className={`font-medium ${getConfidenceColor(decision.confidence)}`}>
                        {(decision.confidence * 100).toFixed(0)}%
                      </span>
                    </span>
                    {hashscanUrl && (
                      <a
                        href={hashscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors ml-auto"
                      >
                        <ExternalLink className="w-3 h-3" />
                        HashScan
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
