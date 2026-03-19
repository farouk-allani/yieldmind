'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    icon: '/scout.png',
    color: '#10B981',
    title: 'State Your Intent',
    description:
      'Tell YieldMind what you want: "Safe yield on 100 HBAR" or "Max APY, I can handle risk." Natural language — no DeFi expertise needed.',
    badge: 'Plain English',
  },
  {
    number: '02',
    icon: '/strategist.png',
    color: '#3B82F6',
    title: 'AI Agents Strategize',
    description:
      'Scout scans all Bonzo Lend pools and auto-compounding Vaults. Strategist builds a multi-allocation strategy optimized for your risk profile and target APY.',
    badge: '4 Agents',
  },
  {
    number: '03',
    icon: '/execute.png',
    color: '#F59E0B',
    title: 'Execute On-Chain',
    description:
      'Review the strategy and approve it. Executor deposits into Bonzo products via your MetaMask wallet. Every action is a real on-chain transaction — verifiable on HashScan.',
    badge: 'Your Keys',
  },
  {
    number: '04',
    icon: '/sentinel.png',
    color: '#EF4444',
    title: 'Sentinel Monitors 24/7',
    description:
      'Sentinel watches price feeds and vault health. Intelligent Keeper decides the optimal harvest time using volatility and sentiment analysis — logged transparently to Hedera HCS.',
    badge: 'Always On',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            How It Works
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>
        <p className="text-text-secondary text-sm mb-10 max-w-2xl">
          From natural language intent to autonomous on-chain yield management — in four steps.
          You stay in control: every transaction requires your wallet signature.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden"
            >
              {/* Step number */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: step.color }}
                >
                  Step {step.number}
                </span>
                <div className="w-9 h-9 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden">
                  <img
                    src={step.icon}
                    alt={step.title}
                    className="w-5 h-5 object-contain"
                  />
                </div>
              </div>

              {/* Content */}
              <h3 className="font-display text-[15px] font-bold text-text-primary">
                {step.title}
              </h3>
              <p className="text-[13px] text-text-secondary leading-relaxed flex-1">
                {step.description}
              </p>

              {/* Badge */}
              <span
                className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: step.color, background: `${step.color}15` }}
              >
                {step.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
