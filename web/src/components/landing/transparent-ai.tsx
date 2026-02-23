'use client';

import { motion } from 'framer-motion';

const logEntries = [
  {
    agent: 'Scout',
    color: '#10B981',
    time: '2:34 PM',
    action: 'vault-scan-complete',
    reasoning:
      'Scanned 5 Bonzo Vaults. Best match for conservative risk: HBAR-USDC Stable Yield at 8.5% APY. Score: 0.87/1.0',
  },
  {
    agent: 'Strategist',
    color: '#3B82F6',
    time: '2:34 PM',
    action: 'strategy-proposed',
    reasoning:
      'Proposed 2-vault strategy: HBAR-USDC (70%), USDC-USDT (30%). Blended APY: 6.2%. Risk: conservative.',
  },
  {
    agent: 'Executor',
    color: '#F59E0B',
    time: '2:35 PM',
    action: 'deposit-confirmed',
    reasoning: 'Deposited into 2 vaults. Tx: 0.0.1234@1709142938',
    link: true,
  },
];

export function TransparentAI() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-12">
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
              Every decision, auditable on-chain.
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Unlike black-box yield optimizers, YieldMind logs every agent
              decision to Hedera Consensus Service with human-readable
              reasoning. You can see exactly why each action was taken, verify
              it on HashScan, and trust that your funds are managed with full
              transparency.
            </p>
            <a
              href="https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-supply hover:underline w-fit"
            >
              Learn more about HCS →
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
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
              <span className="text-sm font-medium text-text-primary">
                Decision Log
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-text-muted">Live</span>
                <div className="w-1.5 h-1.5 rounded-full bg-supply" />
              </div>
            </div>

            {/* Log entries */}
            <div className="divide-y divide-border-subtle">
              {logEntries.map((entry) => (
                <div key={entry.action} className="px-5 py-4">
                  {/* Entry header */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[13px] font-medium text-text-primary">
                      {entry.agent}
                    </span>
                    <span className="text-[12px] text-text-muted ml-auto">
                      {entry.time}
                    </span>
                  </div>

                  {/* Action label */}
                  <p className="text-[12px] text-text-muted mb-1.5 ml-4">
                    {entry.action}
                  </p>

                  {/* Reasoning */}
                  <p className="text-[13px] text-text-secondary leading-snug ml-4">
                    &ldquo;{entry.reasoning}&rdquo;
                  </p>

                  {/* HashScan link */}
                  {entry.link && (
                    <p className="text-[12px] text-supply mt-2 ml-4">
                      View on HashScan ↗
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
