'use client';

import { motion, AnimatePresence } from 'framer-motion';
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
    accentColor: string;
    badgeBg: string;
    badgeText: string;
    description: string;
  }
> = {
  scout: {
    label: 'Scout',
    staticIcon: '/scout.png',
    animatedIcon: '/scout.gif',
    accentColor: '#10B981',
    badgeBg: 'bg-supply/15',
    badgeText: 'text-supply',
    description: 'Vault scanner',
  },
  strategist: {
    label: 'Strategist',
    staticIcon: '/strategist.png',
    animatedIcon: '/strategist.gif',
    accentColor: '#3B82F6',
    badgeBg: 'bg-accent/15',
    badgeText: 'text-accent',
    description: 'Strategy builder',
  },
  executor: {
    label: 'Executor',
    staticIcon: '/execute.png',
    animatedIcon: '/execute.gif',
    accentColor: '#FFA500',
    badgeBg: 'bg-borrow/15',
    badgeText: 'text-borrow',
    description: 'On-chain executor',
  },
  sentinel: {
    label: 'Sentinel',
    staticIcon: '/sentinel.png',
    animatedIcon: '/sentinel.gif',
    accentColor: '#EF4444',
    badgeBg: 'bg-danger/15',
    badgeText: 'text-danger',
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
  const activeCount = agents.filter((a) => a.status !== 'idle').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Agent Network
        </h3>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
              activeCount > 0 ? 'bg-supply animate-pulse' : 'bg-text-muted/40'
            }`}
          />
          <span className="text-[11px] text-text-muted">
            {activeCount}/{agents.length} active
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => {
          const config = AGENT_CONFIG[agent.role];
          const isActive =
            agent.status === 'thinking' || agent.status === 'executing';
          const isError = agent.status === 'error';

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              layout
              className="relative rounded-[8px] border border-border-subtle overflow-hidden transition-colors duration-300"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${config.accentColor}08 0%, transparent 60%)`
                  : undefined,
                borderColor: isActive
                  ? `${config.accentColor}35`
                  : undefined,
              }}
            >
              {/* Active left accent bar */}
              {isActive && (
                <motion.div
                  layoutId={`bar-${agent.id}`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  exit={{ scaleY: 0 }}
                  className="absolute left-0 top-0 bottom-0 w-0.5 origin-top"
                  style={{ backgroundColor: config.accentColor }}
                />
              )}

              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-300"
                  style={
                    isActive
                      ? { boxShadow: `0 0 0 1.5px ${config.accentColor}60` }
                      : undefined
                  }
                >
                  <img
                    src={isActive ? config.animatedIcon : config.staticIcon}
                    alt={config.label}
                    className="w-6 h-6 object-contain"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {config.label}
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={agent.status}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.15 }}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isActive
                            ? `${config.badgeBg} ${config.badgeText}`
                            : isError
                              ? 'bg-danger/15 text-danger'
                              : 'bg-surface text-text-muted'
                        }`}
                      >
                        {STATUS_LABELS[agent.status]}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={agent.lastAction ?? config.description}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-[11px] text-text-muted truncate mt-0.5"
                    >
                      {agent.lastAction ?? config.description}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Working progress bar at bottom */}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ backgroundColor: `${config.accentColor}30` }}
                >
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: config.accentColor }}
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {agents.length === 0 && (
          <p className="text-[11px] text-text-muted text-center py-4">
            Agents initializing...
          </p>
        )}
      </div>
    </div>
  );
}
