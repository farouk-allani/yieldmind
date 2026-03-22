'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Globe,
  Layers,
  DollarSign,
  Target,
  ChevronRight,
  CheckCircle2,
  Rocket,
  Building2,
  Cpu,
  Lock,
  BarChart3,
} from 'lucide-react';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function BusinessModelPage() {
  return (
    <main className="min-h-screen bg-page">
      {/* Header */}
      <header className="border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
            <div className="w-px h-4 bg-border-subtle" />
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo without text.png"
                alt="YieldMind"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
              />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-[#F7F6F0]">Yield</span>
                <span className="text-supply">Mind</span>
              </span>
            </Link>
          </div>
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Business Model & Roadmap
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Hero Section */}
        <motion.div {...fadeIn} className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-text-primary">
            From Hackathon to{' '}
            <span className="text-supply">Production DeFi</span>
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl mx-auto leading-relaxed">
            YieldMind is built to scale from a Bonzo-focused keeper agent to a
            full-stack autonomous DeFi coordination layer across the Hedera
            ecosystem and beyond.
          </p>
        </motion.div>

        {/* Revenue Model */}
        <motion.section {...fadeIn} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-full bg-supply/10">
              <DollarSign className="w-4 h-4 text-supply" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              Revenue Model
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Performance Fees */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-supply" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Performance Fees
                </h3>
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Collect a percentage of yield generated through autonomous
                harvest operations. The keeper agent compounds vault rewards —
                we take a small cut of the value created.
              </p>
              <div className="bg-surface rounded-[8px] px-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-text-muted">Fee Rate</span>
                  <span className="text-sm font-bold text-supply">
                    5-10% of harvested yield
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-text-muted italic">
                Only charged when value is created — zero fees if no harvest
                profit.
              </p>
            </div>

            {/* Keeper CallFee */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-points" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Keeper Incentives
                </h3>
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Bonzo Vault strategy contracts pay a{' '}
                <span className="text-text-primary font-medium">callFee</span>{' '}
                to whoever triggers harvest. Our intelligent keeper earns this
                fee while optimizing timing for all depositors.
              </p>
              <div className="bg-surface rounded-[8px] px-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-text-muted">
                    Per Harvest
                  </span>
                  <span className="text-sm font-bold text-points">
                    callFee from contract
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-text-muted italic">
                Built into protocol — the smarter the timing, the more the
                keeper earns.
              </p>
            </div>

            {/* Premium Tiers */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Premium Subscriptions
                </h3>
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Advanced features for power users and institutions: custom
                strategies, priority execution, dedicated keeper agents, API
                access, and institutional-grade reporting.
              </p>
              <div className="bg-surface rounded-[8px] px-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-text-muted">Revenue</span>
                  <span className="text-sm font-bold text-accent">
                    Monthly SaaS tiers
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-text-muted italic">
                Free tier always available — premium unlocks automation &
                customization.
              </p>
            </div>
          </div>
        </motion.section>

        {/* User Tiers */}
        <motion.section {...fadeIn} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-full bg-accent/10">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">User Tiers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Explorer
                </h3>
                <p className="text-[22px] font-bold text-text-primary mt-1">
                  Free
                </p>
              </div>
              <ul className="space-y-2">
                {[
                  'AI-powered vault recommendations',
                  'Manual deposit via wallet',
                  'Basic vault analytics',
                  'HCS decision trail (read-only)',
                  'Community keeper (shared)',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-supply mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-border-subtle">
                <p className="text-[10px] text-text-muted">
                  Perfect for individual DeFi users exploring Hedera yield.
                </p>
              </div>
            </div>

            {/* Pro */}
            <div className="glass-card p-5 space-y-4 border border-supply/20 relative">
              <div className="absolute -top-2.5 left-4">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-supply text-page px-2.5 py-0.5 rounded-full">
                  Most Popular
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Pro</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-[22px] font-bold text-supply">$29</p>
                  <span className="text-[11px] text-text-muted">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  'Everything in Explorer',
                  'Autonomous keeper execution',
                  'Custom risk profiles',
                  'Priority harvest timing',
                  'Real-time Sentinel alerts',
                  'Advanced analytics dashboard',
                  'Multi-vault strategies',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-supply mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-border-subtle">
                <p className="text-[10px] text-text-muted">
                  For active DeFi users who want hands-off yield optimization.
                </p>
              </div>
            </div>

            {/* Institutional */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Institutional
                </h3>
                <p className="text-[22px] font-bold text-text-primary mt-1">
                  Custom
                </p>
              </div>
              <ul className="space-y-2">
                {[
                  'Everything in Pro',
                  'Dedicated keeper agents',
                  'Custom strategy builder',
                  'API access & webhooks',
                  'Compliance & audit reports',
                  'Multi-sig vault management',
                  'SLA-backed uptime',
                  'White-label option',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-supply mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-border-subtle">
                <p className="text-[10px] text-text-muted">
                  For funds, DAOs, and enterprises managing DeFi treasuries.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Expansion Roadmap */}
        <motion.section {...fadeIn} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-full bg-points/10">
              <Rocket className="w-4 h-4 text-points" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              Expansion Roadmap
            </h2>
          </div>

          <div className="glass-card p-6">
            <div className="space-y-0">
              {/* Phase 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-supply/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-supply" />
                  </div>
                  <div className="w-0.5 flex-1 bg-border-subtle my-2" />
                </div>
                <div className="pb-8">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-text-primary">
                      Phase 1 — Bonzo Finance
                    </h3>
                    <span className="text-[10px] font-medium text-supply bg-supply/10 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary leading-relaxed mb-2">
                    Intelligent keeper agent for Bonzo Vaults on Hedera mainnet.
                    Autonomous harvest execution, AI-driven timing, full HCS
                    audit trail.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Bonzo Lend',
                      'Bonzo Vaults',
                      'Harvest Optimization',
                      'HCS Logging',
                    ].map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-accent" />
                  </div>
                  <div className="w-0.5 flex-1 bg-border-subtle my-2" />
                </div>
                <div className="pb-8">
                  <h3 className="text-sm font-bold text-text-primary mb-1">
                    Phase 2 — All Hedera DeFi
                  </h3>
                  <p className="text-[12px] text-text-secondary leading-relaxed mb-2">
                    Expand agent coverage to SaucerSwap, HeliSwap, Stader, and
                    all major Hedera DeFi protocols. Cross-protocol strategy
                    optimization.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'SaucerSwap',
                      'HeliSwap',
                      'Stader',
                      'Cross-Protocol',
                      'LP Management',
                    ].map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-points/20 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-points" />
                  </div>
                  <div className="w-0.5 flex-1 bg-border-subtle my-2" />
                </div>
                <div className="pb-8">
                  <h3 className="text-sm font-bold text-text-primary mb-1">
                    Phase 3 — Cross-Chain Expansion
                  </h3>
                  <p className="text-[12px] text-text-secondary leading-relaxed mb-2">
                    Bridge agent intelligence to EVM chains (Ethereum, Arbitrum,
                    Base). Same AI-powered keeper with HCS as the universal
                    audit layer.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Ethereum',
                      'Arbitrum',
                      'Base',
                      'HCS Audit Layer',
                      'Cross-Chain Vaults',
                    ].map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase 4 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-danger" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary mb-1">
                    Phase 4 — Agent Marketplace
                  </h3>
                  <p className="text-[12px] text-text-secondary leading-relaxed mb-2">
                    Open marketplace for third-party DeFi agents. Anyone can
                    build, deploy, and monetize specialized agents (MEV
                    strategies, liquidation bots, yield aggregators) with
                    YieldMind as the coordination layer.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Agent SDK',
                      'Marketplace',
                      'Revenue Sharing',
                      'Community Agents',
                      'Agent Staking',
                    ].map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Competitive Advantages */}
        <motion.section {...fadeIn} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-full bg-danger/10">
              <Shield className="w-4 h-4 text-danger" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              Competitive Advantages
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5 flex gap-4">
              <div className="p-2 rounded-full bg-supply/10 h-fit">
                <Lock className="w-4 h-4 text-supply" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  On-Chain Transparency
                </h3>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  Every AI decision is logged to Hedera Consensus Service with
                  full reasoning. No black boxes. Users and regulators can audit
                  every action the agent takes.
                </p>
              </div>
            </div>

            <div className="glass-card p-5 flex gap-4">
              <div className="p-2 rounded-full bg-accent/10 h-fit">
                <Cpu className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  Multi-Agent Intelligence
                </h3>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  Four specialized agents (Scout, Strategist, Executor,
                  Sentinel) collaborate via HCS — outperforming single-agent
                  systems through division of expertise.
                </p>
              </div>
            </div>

            <div className="glass-card p-5 flex gap-4">
              <div className="p-2 rounded-full bg-points/10 h-fit">
                <Zap className="w-4 h-4 text-points" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  Intelligent Harvest Timing
                </h3>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  The keeper doesn&apos;t just harvest on a timer. It uses
                  volatility analysis, sentiment data, and gas optimization to
                  pick the optimal moment — maximizing compound returns.
                </p>
              </div>
            </div>

            <div className="glass-card p-5 flex gap-4">
              <div className="p-2 rounded-full bg-danger/10 h-fit">
                <Building2 className="w-4 h-4 text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  Hedera-Native Architecture
                </h3>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  Built on Hedera&apos;s unique strengths: HCS for consensus
                  logging (not available on other chains), low fees for frequent
                  keeper operations, and Hedera Agent Kit for native
                  integration.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Market Opportunity */}
        <motion.section {...fadeIn} transition={{ delay: 0.25 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-full bg-supply/10">
              <BarChart3 className="w-4 h-4 text-supply" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              Market Opportunity
            </h2>
          </div>

          <div className="glass-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-supply">$180B+</p>
                <p className="text-[11px] text-text-muted mt-1">
                  Total DeFi TVL
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">$12B+</p>
                <p className="text-[11px] text-text-muted mt-1">
                  Yield Aggregator Market
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-points">Growing</p>
                <p className="text-[11px] text-text-muted mt-1">
                  Hedera DeFi Ecosystem
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-danger">Untapped</p>
                <p className="text-[11px] text-text-muted mt-1">
                  AI Agent DeFi Space
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle">
              <p className="text-[12px] text-text-secondary leading-relaxed text-center max-w-3xl mx-auto">
                The intersection of AI agents and DeFi is nascent. Most yield
                optimizers are rule-based (Yearn, Beefy). YieldMind brings
                genuine AI reasoning — with on-chain proof that the agent is
                thinking, not just following if/else rules. As DeFi complexity
                grows, intelligent agents become essential.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Footer CTA */}
        <motion.div
          {...fadeIn}
          transition={{ delay: 0.3 }}
          className="text-center pb-8"
        >
          <p className="text-[12px] text-text-muted mb-4">
            Every AI decision, auditable on-chain. No black boxes.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-supply text-page text-sm font-semibold hover:bg-supply/90 transition-colors"
          >
            Try YieldMind
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
