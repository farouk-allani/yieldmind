'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Zap, Eye } from 'lucide-react';

export function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center relative px-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(16,185,129,0.06) 0%, transparent 70%)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6 pt-16 relative z-10"
      >
        {/* Owl logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <Image
                src="/logo without text.png"
                alt="YieldMind"
                width={80}
                height={80}
                className="h-16 sm:h-20 w-16 sm:w-20"
                priority
              />
              <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                <span className="text-[#F7F6F0]">Yield</span>
                <span className="text-supply">Mind</span>
              </span>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-text-muted">
              Autonomous DeFi on Hedera
            </span>
          </div>
        </motion.div>

        {/* Hackathon badge */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-surface border border-border-subtle rounded-full px-4 py-1.5 text-[13px] text-text-secondary"
        >
          Hedera Hello Future Apex Hackathon 2026
        </motion.span>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold text-text-primary leading-[1.1] tracking-tight">
          DeFi yield management{' '}
          <span className="text-supply">that thinks</span> for you.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl leading-relaxed">
          Tell YieldMind what you want in plain English. Our AI agents find the
          best Bonzo Vault strategy, execute on-chain, and manage your
          position — with every decision transparently logged on Hedera.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border-subtle text-[12px] text-text-secondary">
            <Shield className="w-3 h-3 text-supply" />
            On-Chain Transparency
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border-subtle text-[12px] text-text-secondary">
            <Zap className="w-3 h-3 text-borrow" />
            Autonomous Execution
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border-subtle text-[12px] text-text-secondary">
            <Eye className="w-3 h-3 text-accent" />
            24/7 Monitoring
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
          <Link
            href="/app"
            className="h-12 px-7 rounded-[8px] bg-supply text-sm font-semibold text-white flex items-center gap-2 hover:bg-supply/90 transition-all shadow-lg shadow-supply/20"
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com/farouk-allani/yieldmind"
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 px-7 rounded-[8px] border border-border-subtle text-sm font-medium text-text-primary flex items-center hover:bg-card transition-colors"
          >
            View on GitHub
          </a>
        </div>

        {/* Trust line */}
        <div className="text-[13px] text-text-muted mt-4 flex items-center gap-4 flex-wrap justify-center">
          <span className="flex items-center gap-1.5">
            <img src="/hbar.webp" alt="Hedera" className="w-4 h-4 rounded-full" />
            Built on Hedera
          </span>
          <span className="flex items-center gap-1.5">
            <img src="/bonzo.webp" alt="Bonzo" className="w-4 h-4 rounded-full" />
            Powered by Bonzo Vaults
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-borrow" />
            Every decision on-chain
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-6 flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
          {[
            { value: '4', label: 'AI Agents' },
            { value: '100%', label: 'On-Chain Logs', color: 'text-supply' },
            { value: '<3s', label: 'Finality' },
            { value: '$0.001', label: 'Per Transaction' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`text-xl sm:text-2xl font-bold ${stat.color || 'text-text-primary'}`}>
                {stat.value}
              </div>
              <div className="text-[11px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
