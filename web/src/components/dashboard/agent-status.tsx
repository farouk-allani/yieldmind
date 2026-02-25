'use client';

import { motion } from 'framer-motion';
import type { AgentState, AgentRole } from '@/lib/types';

interface AgentStatusPanelProps {
  agents: AgentState[];
}

const AGENT_CONFIG: Record<
  AgentRole,
  {
    label: string;
    staticIcon: string;
    animatedIcon: string;
    color: string;
    accentColor: string;
    description: string;
  }
> = {
  scout: {
    label: 'Scout',
    staticIcon: '/scout.png',
    animatedIcon: '/scout.gif',
    color: 'text-supply',
    accentColor: '#10B981',
    description: 'Vault scanner',
  },
  strategist: {
    label: 'Strategist',
    staticIcon: '/strategist.png',
    animatedIcon: '/strategist.gif',
    color: 'text-accent',
    accentColor: '#3B82F6',
    description: 'Strategy builder',
  },
  executor: {
    label: 'Executor',
    staticIcon: '/execute.png',
    animatedIcon: '/execute.gif',
    color: 'text-borrow',
    accentColor: '#FFA500',
    description: 'On-chain executor',
  },
  sentinel: {
    label: 'Sentinel',
    staticIcon: '/sentinel.png',
    animatedIcon: '/sentinel.gif',
    color: 'text-danger',
    accentColor: '#EF4444',
    description: 'Position monitor',
  },
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Analyzing',
  executing: 'Executing',
  waiting: 'Waiting',
  error: 'Error',
};

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Agent Network
        </h3>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${agents.some(a => a.status !== 'idle') ? 'bg-supply animate-pulse' : 'bg-text-muted'}`} />
          <span className="text-[11px] text-text-muted">
            {agents.filter((a) => a.status !== 'idle').length}/{agents.length} active
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => {
          const config = AGENT_CONFIG[agent.role];
          const isActive = agent.status === 'thinking' || agent.status === 'executing';
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 rounded-[8px] px-3 py-2.5 border transition-all duration-300 ${
                isActive
                  ? 'bg-surface border-border-subtle'
                  : 'bg-card border-border-subtle'
              }`}
            >
              <div
                className="w-9 h-9 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-300"
                style={isActive ? { boxShadow: `0 0 0 1px ${config.accentColor}40` } : undefined}
              >
                <img
                  src={isActive ? config.animatedIcon : config.staticIcon}
                  alt={config.label}
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {config.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isActive
                        ? 'bg-supply/15 text-supply'
                        : agent.status === 'error'
                          ? 'bg-danger/15 text-danger'
                          : 'bg-card text-text-muted'
                    }`}
                  >
                    {STATUS_LABELS[agent.status]}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {agent.lastAction ?? config.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
