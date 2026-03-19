'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

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
          Start earning <span className="text-supply">smarter yield</span> on Hedera.
        </h2>
        <p className="text-base text-text-secondary">
          No DeFi expertise required. Just tell YieldMind what you want.
        </p>
        <Link
          href="/app"
          className="h-12 px-7 rounded-[8px] bg-supply text-sm font-semibold text-white flex items-center gap-2 hover:bg-supply/90 transition-all shadow-lg shadow-supply/20 mt-2"
        >
          Launch App
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-[13px] text-text-muted mt-2">
          Open source · MIT License ·{' '}
          <a
            href="https://github.com/farouk-allani/yieldmind"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </p>
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logo without text.png"
            alt="YieldMind"
            width={24}
            height={24}
            className="h-6 w-6 opacity-60"
          />
          <span className="text-sm font-bold tracking-tight opacity-60">
            <span className="text-[#F7F6F0]">Yield</span>
            <span className="text-supply">Mind</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          {[
          { label: 'GitHub', href: 'https://github.com/farouk-allani/yieldmind' },
            { label: 'Docs', href: '#' },
            { label: 'Hedera', href: 'https://hedera.com', image: '/hbar.webp' },
            { label: 'Bonzo', href: 'https://bonzo.finance', image: '/bonzo.webp' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1.5"
            >
              {'image' in link && link.image && (
                <img src={link.image} alt="" className="w-4 h-4 rounded-full" />
              )}
              {link.label}
            </a>
          ))}
        </div>
        <span className="text-[12px] text-text-muted">
          © 2026 YieldMind Protocol
        </span>
      </div>
    </footer>
  );
}
