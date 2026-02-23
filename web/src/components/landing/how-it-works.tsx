'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Brain, Shield } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: MessageSquare,
    color: '#10B981',
    badgeBg: '#103A2E',
    title: 'State Your Intent',
    description:
      'Tell YieldMind what you want: "I want safe yield on my HBAR" or "Maximize returns, I can handle risk." Natural language, no DeFi jargon needed.',
  },
  {
    number: '2',
    icon: Brain,
    color: '#3B82F6',
    badgeBg: '#1E3A5F',
    title: 'Agents Strategize',
    description:
      'Four specialized AI agents — Scout, Strategist, Executor, Sentinel — collaborate to find the optimal Bonzo Vault strategy for your risk profile.',
  },
  {
    number: '3',
    icon: Shield,
    color: '#F59E0B',
    badgeBg: '#462704',
    title: 'Execute & Monitor',
    description:
      'Your strategy executes on-chain via Hedera. Every agent decision is logged to Hedera Consensus Service. Transparent, auditable, autonomous.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-12">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            How It Works
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              className="glass-card p-6 flex flex-col gap-4"
            >
              {/* Step number */}
              <div className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-[13px] text-text-secondary">
                {step.number}
              </div>

              {/* Icon badge */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: step.badgeBg }}
              >
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>

              {/* Content */}
              <h3 className="font-display text-[17px] font-bold text-text-primary">
                {step.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
