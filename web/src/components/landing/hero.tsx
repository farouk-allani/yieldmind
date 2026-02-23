'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export function Hero() {
  return (
    <section
      className="min-h-screen flex items-center justify-center relative px-6"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(16,185,129,0.03) 0%, transparent 70%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6 pt-16"
      >
        {/* Hackathon badge */}
        <span className="bg-surface border border-border-subtle rounded-full px-4 py-1.5 text-[13px] text-text-secondary">
          Hedera Hello Future Apex Hackathon 2026
        </span>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold text-text-primary leading-[1.1] tracking-tight">
          DeFi yield management that thinks for you.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl leading-relaxed">
          Tell YieldMind what you want in plain English. Our AI agents find the
          best Bonzo Vault strategy, execute on-chain, and manage your
          position — with every decision transparently logged on Hedera.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Link
            href="/app"
            className="h-11 px-6 rounded-[8px] bg-accent text-sm font-medium text-white flex items-center gap-2 hover:bg-accent/90 transition-colors"
          >
            Launch App <span aria-hidden>→</span>
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-6 rounded-[8px] border border-border-subtle text-sm font-medium text-text-primary flex items-center hover:bg-card transition-colors"
          >
            View on GitHub
          </a>
        </div>

        {/* Trust line */}
        <p className="text-[13px] text-text-muted mt-4 flex items-center gap-2 flex-wrap justify-center">
          <span>Built on Hedera</span>
          <span className="text-border-subtle">·</span>
          <span>Powered by Bonzo Vaults</span>
          <span className="text-border-subtle">·</span>
          <span>Every decision on-chain</span>
        </p>
      </motion.div>
    </section>
  );
}
