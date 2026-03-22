'use client';

import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

const logEntries = [
  {
    agent: 'Scout',
    icon: '/scout.png',
    color: '#10B981',
    time: '2:34 PM',
    action: 'vault-scan-complete',
    reasoning:
      'Scanned Bonzo Lend pools + 4 Bonzo Vaults. HBAR Supply Pool: 0.68% APY, $8.2M liquidity. HBAR-USDC SaucerSwap V2 Vault: 43.7% APY (aggressive).',
    confidence: 0.87,
  },
  {
    agent: 'Strategist',
    icon: '/strategist.png',
    color: '#3B82F6',
    time: '2:34 PM',
    action: 'strategy-proposed',
    reasoning:
      'User intent: safe yield on HBAR. Allocating 100% to HBAR Supply Pool (Bonzo Lend) at 0.68% APY. Conservative risk — single-token, no impermanent loss.',
    confidence: 0.92,
  },
  {
    agent: 'Executor',
    icon: '/execute.png',
    color: '#F59E0B',
    time: '2:35 PM',
    action: 'deposit-executed',
    reasoning: 'Deposited 10 HBAR into Bonzo Lend via WETHGateway. Autonomous execution via Hedera Agent Kit.',
    confidence: 1.0,
    link: true,
  },
];

export function TransparentAI() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[13px] font-medium text-supply tracking-wide uppercase">
            Transparent AI
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col gap-5"
          >
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
              Every decision, <span className="text-supply">auditable</span> on-chain.
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Unlike black-box yield optimizers, YieldMind logs every agent
              decision to Hedera Consensus Service with human-readable
              reasoning. You can see exactly why each action was taken, verify
              it on HashScan, and trust that your funds are managed with full
              transparency.
            </p>

            {/* Key stats */}
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary">4</div>
                <div className="text-[11px] text-text-muted">AI Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-supply">100%</div>
                <div className="text-[11px] text-text-muted">On-Chain Logged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary">24/7</div>
                <div className="text-[11px] text-text-muted">Monitoring</div>
              </div>
            </div>

            <a
              href="https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-supply hover:text-supply/80 w-fit flex items-center gap-1.5 transition-colors"
            >
              Learn more about HCS
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>

          {/* Right — mock decision log */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="glass-card overflow-hidden"
          >
            {/* Log header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-surface/50">
              <span className="text-sm font-medium text-text-primary">
                HCS Decision Log
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-text-muted">Live</span>
                <div className="w-1.5 h-1.5 rounded-full bg-supply animate-pulse" />
              </div>
            </div>

            {/* Log entries */}
            <div className="divide-y divide-border-subtle">
              {logEntries.map((entry, i) => (
                <motion.div
                  key={entry.action}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="px-5 py-4 hover:bg-card/50 transition-colors"
                >
                  {/* Entry header */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-[6px] bg-[#F7F6F0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        src={entry.icon}
                        alt={entry.agent}
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                    <span className="text-[13px] font-medium text-text-primary">
                      {entry.agent}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${entry.color}15`,
                        color: entry.color,
                      }}
                    >
                      {entry.action}
                    </span>
                    <span className="text-[12px] text-text-muted ml-auto">
                      {entry.time}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <p className="text-[13px] text-text-secondary leading-snug ml-9">
                    &ldquo;{entry.reasoning}&rdquo;
                  </p>

                  {/* Confidence + HashScan link */}
                  <div className="flex items-center gap-3 ml-9 mt-2">
                    <span className="text-[11px] text-text-muted">
                      Confidence: {(entry.confidence * 100).toFixed(0)}%
                    </span>
                    {entry.link && (
                      <span className="text-[11px] text-supply flex items-center gap-1">
                        View on HashScan
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
