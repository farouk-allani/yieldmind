'use client';

import { motion } from 'framer-motion';
import type { AgentState, AgentRole } from '@/lib/types';

interface AgentStatusPanelProps {
  agents: AgentState[];
}

const AGENT_CONFIG: Record<
  AgentRole,
  { label: string; icon: string; description: string }
> = {
  scout: {
    label: 'Scout',
    icon: '🔍',
    description: 'Vault scanner',
  },
  strategist: {
    label: 'Strategist',
    icon: '🧠',
    description: 'Strategy builder',
  },
  executor: {
    label: 'Executor',
    icon: '⚡',
    description: 'On-chain executor',
  },
  sentinel: {
    label: 'Sentinel',
    icon: '🛡️',
    description: 'Position monitor',
  },
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-500',
  thinking: 'bg-cyan-400 pulse-dot',
  executing: 'bg-amber-400 pulse-dot',
  waiting: 'bg-yellow-400',
  error: 'bg-red-500',
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
        <h3 className="font-heading text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Agent Network
        </h3>
        <span className="text-[10px] text-gray-600">
          {agents.filter((a) => a.status !== 'idle').length}/{agents.length}{' '}
          active
        </span>
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => {
          const config = AGENT_CONFIG[agent.role];
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 bg-navy-800/50 border border-navy-600/50 rounded-lg px-3 py-2"
            >
              <span className="text-base">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-300">
                    {config.label}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[agent.status]}`}
                  />
                  <span className="text-[10px] text-gray-500">
                    {STATUS_LABELS[agent.status]}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 truncate">
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
