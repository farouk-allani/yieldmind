'use client';

import { motion } from 'framer-motion';

const agents = [
  {
    name: 'Scout',
    icon: '/scout.png',
    animatedIcon: '/scout.gif',
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
    icon: '/strategist.png',
    animatedIcon: '/strategist.gif',
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
    icon: '/execute.png',
    animatedIcon: '/execute.gif',
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
    icon: '/sentinel.png',
    animatedIcon: '/sentinel.gif',
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
    <section id="agents" className="py-24 px-6 relative">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            The Agent Network
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>
        <p className="text-text-secondary text-sm mb-10 max-w-2xl">
          Four specialized AI agents collaborate to manage your yield strategy.
          Each agent has a distinct role and communicates decisions transparently via Hedera Consensus Service.
        </p>

        {/* Agent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              className="group glass-card-hover p-5 flex flex-col gap-4 relative overflow-hidden"
            >
              {/* Subtle top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
                style={{ backgroundColor: agent.color }}
              />

              {/* Agent icon */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[10px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden flex-shrink-0 transition-transform group-hover:scale-105">
                  <img
                    src={agent.icon}
                    alt={agent.name}
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div>
                  <span className="font-display text-[15px] font-bold text-text-primary block">
                    {agent.name}
                  </span>
                  <p className="text-[12px] text-text-secondary">{agent.role}</p>
                </div>
              </div>

              {/* Bullets */}
              <ul className="flex flex-col gap-2 mt-1">
                {agent.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-[13px] text-text-muted leading-snug flex gap-2"
                  >
                    <span
                      className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: agent.color }}
                    />
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
