'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DecisionLog, AgentRole } from '@/lib/types';

interface DecisionLogPanelProps {
  decisions: DecisionLog[];
}

const ROLE_COLORS: Record<AgentRole, string> = {
  scout: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  strategist: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  executor: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  sentinel: 'text-red-400 border-red-400/30 bg-red-400/10',
};

const ROLE_LABELS: Record<AgentRole, string> = {
  scout: 'SCT',
  strategist: 'STR',
  executor: 'EXE',
  sentinel: 'SNT',
};

export function DecisionLogPanel({ decisions }: DecisionLogPanelProps) {
  const sortedDecisions = [...decisions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-heading text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Decision Trail
        </h3>
        <span className="text-[10px] text-gray-600">
          {decisions.length} logged
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-cyan-400/50" />
          <span className="text-[10px] text-gray-600">HCS</span>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence>
          {sortedDecisions.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">
              No decisions yet. Send a message to activate agents.
            </p>
          ) : (
            sortedDecisions.map((decision, i) => (
              <motion.div
                key={`${decision.agentId}-${decision.timestamp}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-navy-800/50 border border-navy-600/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ROLE_COLORS[decision.agentRole]}`}
                  >
                    {ROLE_LABELS[decision.agentRole]}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {decision.action}
                  </span>
                  <span className="text-[10px] text-gray-600 ml-auto">
                    {new Date(decision.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  {decision.reasoning}
                </p>

                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-gray-600">
                    confidence:{' '}
                    <span className="text-cyan-400/70">
                      {(decision.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
