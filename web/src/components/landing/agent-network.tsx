'use client';

import { motion } from 'framer-motion';

const agents = [
  {
    name: 'Scout',
    color: '#10B981',
    role: 'Discovery & Analysis',
    bullets: [
      'Scans all Bonzo Vaults in real-time',
      'Evaluates APY, risk, liquidity depth',
      'Scores opportunities for your risk profile',
    ],
  },
  {
    name: 'Strategist',
    color: '#3B82F6',
    role: 'Strategy & Allocation',
    bullets: [
      'Interprets your intent into risk parameters',
      'Builds multi-vault allocation strategies',
      'Optimizes for risk-adjusted returns',
    ],
  },
  {
    name: 'Executor',
    color: '#F59E0B',
    role: 'On-Chain Execution',
    bullets: [
      'Deposits into Bonzo Vaults via Hedera',
      'Harvests and compounds rewards',
      'Rebalances positions as needed',
    ],
  },
  {
    name: 'Sentinel',
    color: '#EF4444',
    role: 'Monitoring & Protection',
    bullets: [
      'Watches market conditions 24/7',
      'Triggers alerts on volatility spikes',
      'Initiates emergency exits when needed',
    ],
  },
];

export function AgentNetwork() {
  return (
    <section className="py-24 px-6 bg-[rgba(255,255,255,0.02)]">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-12">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            The Agent Network
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        {/* Agent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              className="glass-card p-6 flex flex-col gap-3"
            >
              {/* Agent header */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="font-display text-[15px] font-bold text-text-primary">
                  {agent.name}
                </span>
              </div>

              {/* Role */}
              <p className="text-[13px] text-text-secondary">{agent.role}</p>

              {/* Bullets */}
              <ul className="flex flex-col gap-1.5 mt-1">
                {agent.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-[13px] text-text-muted leading-snug flex gap-2"
                  >
                    <span className="text-border-subtle mt-0.5">–</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
