'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-2xl mx-auto text-center flex flex-col items-center gap-5"
      >
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
          Start earning smarter yield on Hedera.
        </h2>
        <p className="text-base text-text-secondary">
          No DeFi expertise required. Just tell YieldMind what you want.
        </p>
        <Link
          href="/app"
          className="h-11 px-6 rounded-[8px] bg-accent text-sm font-medium text-white flex items-center gap-2 hover:bg-accent/90 transition-colors mt-2"
        >
          Launch App <span aria-hidden>→</span>
        </Link>
        <p className="text-[13px] text-text-muted mt-2">
          Open source · MIT License ·{' '}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            GitHub ↗
          </a>
        </p>
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-6 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[13px] text-text-muted">
          YieldMind Protocol © 2026
        </span>
        <div className="flex items-center gap-5">
          {[
            { label: 'GitHub', href: 'https://github.com' },
            { label: 'Docs', href: '#' },
            { label: 'Hedera', href: 'https://hedera.com' },
            { label: 'Bonzo', href: 'https://bonzo.finance' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-text-muted hover:text-text-secondary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
