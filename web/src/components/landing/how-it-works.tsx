'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    icon: '/scout.png',
    color: '#10B981',
    title: 'State Your Intent',
    description:
      'Tell YieldMind what you want: "I want safe yield on my HBAR" or "Maximize returns, I can handle risk." Natural language, no DeFi jargon needed.',
  },
  {
    number: '02',
    icon: '/strategist.png',
    color: '#3B82F6',
    title: 'Agents Strategize',
    description:
      'Four specialized AI agents — Scout, Strategist, Executor, Sentinel — collaborate to find the optimal Bonzo Vault strategy for your risk profile.',
  },
  {
    number: '03',
    icon: '/execute.png',
    color: '#F59E0B',
    title: 'Execute & Monitor',
    description:
      'Your strategy executes on-chain via Hedera. Every agent decision is logged to Hedera Consensus Service. Transparent, auditable, autonomous.',
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
          From natural language intent to on-chain execution in three steps.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.12, ease: 'easeOut' }}
              className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden"
            >
              {/* Step number */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold tracking-widest uppercase"
                  style={{ color: step.color }}
                >
                  Step {step.number}
                </span>
                <div className="w-10 h-10 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden">
                  <img
                    src={step.icon}
                    alt={step.title}
                    className="w-6 h-6 object-contain"
                  />
                </div>
              </div>

              {/* Content */}
              <h3 className="font-display text-[17px] font-bold text-text-primary">
                {step.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.description}
              </p>

              {/* Connector line (except last) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 w-6 h-px bg-border-subtle" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
