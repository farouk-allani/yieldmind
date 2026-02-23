'use client';

import { motion } from 'framer-motion';
import { Search, Brain, Zap, Shield } from 'lucide-react';
import type { AgentState, AgentRole } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

interface AgentStatusPanelProps {
  agents: AgentState[];
}

const AGENT_CONFIG: Record<
  AgentRole,
  { label: string; icon: LucideIcon; color: string; badgeBg: string; description: string }
> = {
  scout: {
    label: 'Scout',
    icon: Search,
    color: 'text-supply',
    badgeBg: 'bg-badge-supply',
    description: 'Vault scanner',
  },
  strategist: {
    label: 'Strategist',
    icon: Brain,
    color: 'text-accent',
    badgeBg: 'bg-badge-accent',
    description: 'Strategy builder',
  },
  executor: {
    label: 'Executor',
    icon: Zap,
    color: 'text-borrow',
    badgeBg: 'bg-badge-borrow',
    description: 'On-chain executor',
  },
  sentinel: {
    label: 'Sentinel',
    icon: Shield,
    color: 'text-danger',
    badgeBg: 'bg-badge-danger',
    description: 'Position monitor',
  },
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-text-muted',
  thinking: 'bg-accent',
  executing: 'bg-borrow',
  waiting: 'bg-points',
  error: 'bg-danger',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  executing: 'Executing',
  waiting: 'Waiting',
  error: 'Error',
};

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Agent Network
        </h3>
        <span className="text-[11px] text-text-muted">
          {agents.filter((a) => a.status !== 'idle').length}/{agents.length}{' '}
          active
        </span>
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => {
          const config = AGENT_CONFIG[agent.role];
          const Icon = config.icon;
          const isActive = agent.status === 'thinking' || agent.status === 'executing';
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 glass-card px-3 py-2.5"
            >
              <div className={`rounded-full ${config.badgeBg} p-1.5`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {config.label}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[agent.status]} ${isActive ? 'animate-pulse' : ''}`}
                  />
                  <span className="text-[11px] text-text-muted">
                    {STATUS_LABELS[agent.status]}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted truncate">
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
