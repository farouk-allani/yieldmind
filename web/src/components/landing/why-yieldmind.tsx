'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import Link from 'next/link';

const manualItems = [
  'Research 20+ vaults manually every week',
  'Need deep DeFi expertise to avoid mistakes',
  'Miss harvest windows and lose compounded yield',
  'No visibility into AI black-box decisions',
  'Risk liquidation without real-time monitoring',
  'Complex multi-step transactions for each deposit',
];

const yieldmindItems = [
  'Scout agent auto-scans all Bonzo opportunities',
  'Just describe what you want in plain English',
  'Intelligent Keeper harvests at the optimal moment',
  'Every decision logged transparently on Hedera HCS',
  'Sentinel watches positions 24/7 with auto-alerts',
  'One-click multi-vault execution from chat',
];

export function WhyYieldMind() {
  return (
    <section id="why" className="py-24 px-6 relative overflow-hidden">
      {/* Subtle background accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(16,185,129,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            Why YieldMind?
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-display text-3xl sm:text-4xl font-bold text-text-primary leading-tight mb-3"
        >
          The smarter alternative to{' '}
          <span className="text-text-muted line-through decoration-borrow/60">manual DeFi</span>.
        </motion.h2>
        <p className="text-sm text-text-secondary mb-10 max-w-2xl">
          Manual yield farming is time-consuming, error-prone, and opaque.
          YieldMind automates every step while keeping you in control —
          with every AI decision auditable on Hedera.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual DeFi column */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="glass-card p-6 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
              <div className="w-2 h-2 rounded-full bg-borrow opacity-70" />
              <h3 className="text-[14px] font-semibold text-text-muted">Manual DeFi</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {manualItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-borrow/15 flex items-center justify-center flex-shrink-0">
                    <X className="w-2.5 h-2.5 text-borrow" />
                  </div>
                  <span className="text-[13px] text-text-muted leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* YieldMind column */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
            className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden"
          >
            {/* Accent border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-supply opacity-50" />

            <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
              <div className="w-2 h-2 rounded-full bg-supply" />
              <h3 className="text-[14px] font-semibold text-text-primary">YieldMind</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {yieldmindItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-supply/15 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-supply" />
                  </div>
                  <span className="text-[13px] text-text-secondary leading-snug">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/app"
              className="mt-2 flex items-center justify-center gap-2 h-10 rounded-[8px] bg-supply text-[13px] font-semibold text-white hover:bg-supply/90 transition-all"
            >
              Try YieldMind Free
            </Link>
          </motion.div>
        </div>

        {/* Bottom callout */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
          className="mt-6 flex flex-wrap items-center gap-4 px-5 py-4 rounded-[12px] bg-supply/5 border border-supply/15"
        >
          <div className="flex items-center gap-2">
            <img src="/hbar.webp" alt="Hedera" className="w-5 h-5 rounded-full" />
            <span className="text-[13px] text-text-secondary font-medium">
              Built on Hedera — fast, low-fee, environmentally sustainable blockchain.
            </span>
          </div>
          <div className="text-[13px] text-text-muted">
            Fees as low as $0.001 per transaction ·{' '}
            <span className="text-supply">3 second finality</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
