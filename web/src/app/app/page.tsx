'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, BarChart3, ScrollText, Activity, Rocket } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AgentStatusPanel } from '@/components/dashboard/agent-status';
import { DecisionLogPanel } from '@/components/dashboard/decision-log';
import { PositionPanel } from '@/components/dashboard/position-panel';
import { KeeperPanel } from '@/components/dashboard/keeper-panel';
import { ConnectWalletButton } from '@/components/wallet/connect-button';
import { NetworkToggle } from '@/components/wallet/network-toggle';
import { fetchAgentStatus } from '@/lib/api';
import type { AgentState, DecisionLog, Strategy } from '@/lib/types';

export default function AppPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<Strategy | null>(null);
  const [hcsTopicId, setHcsTopicId] = useState<string | null>(null);
  const [keeperRunning, setKeeperRunning] = useState(false);

  useEffect(() => {
    fetchAgentStatus()
      .then(setAgents)
      .catch(() => {
        // Agent backend not ready yet — will populate after first chat
      });
  }, []);

  const pollKeeperStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/keeper/status');
      if (res.ok) {
        const data = await res.json();
        setKeeperRunning(data.isRunning ?? false);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    pollKeeperStatus();
    const interval = setInterval(pollKeeperStatus, 15_000);
    return () => clearInterval(interval);
  }, [pollKeeperStatus]);

  return (
    <main className="h-screen flex flex-col">
      {/* Top nav */}
      <header className="flex-shrink-0 border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo without text.png"
              alt="YieldMind"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
            <span className="text-base font-bold tracking-tight">
              <span className="text-[#F7F6F0]">Yield</span>
              <span className="text-supply">Mind</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app/portfolio"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <BarChart3 className="w-3 h-3" />
              Portfolio
            </Link>
            <Link
              href="/hcs"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <ScrollText className="w-3 h-3" />
              HCS Trail
            </Link>
            <Link
              href="/app/keeper"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] font-medium transition-colors ${
                keeperRunning
                  ? 'bg-supply/10 border-supply/20 text-supply'
                  : 'bg-surface border-border-subtle text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Activity className="w-3 h-3" />
              Keeper
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  keeperRunning ? 'bg-supply animate-pulse' : 'bg-text-muted'
                }`}
              />
            </Link>
            <Link
              href="/app/business"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <Rocket className="w-3 h-3" />
              Business
            </Link>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-supply/10 text-[11px] text-supply font-medium">
              <Database className="w-3 h-3" />
              Live Data
            </div>
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 max-w-7xl mx-auto w-full">
        {/* Chat — primary panel */}
        <div className="flex-1 flex flex-col border-r border-border-subtle min-w-0">
          <ChatInterface
            onAgentUpdate={(states) => states && setAgents(states)}
            onDecisionsUpdate={(decs) =>
              decs &&
              setDecisions((prev) => {
                const ids = new Set(
                  prev.map((d) => `${d.agentId}-${d.timestamp}`)
                );
                const newDecs = decs.filter(
                  (d) => !ids.has(`${d.agentId}-${d.timestamp}`)
                );
                return [...prev, ...newDecs];
              })
            }
            onStrategyUpdate={(strategy) =>
              strategy && setActiveStrategy(strategy)
            }
            onHcsTopicUpdate={(topicId) =>
              topicId && setHcsTopicId(topicId)
            }
          />
        </div>

        {/* Dashboard sidebar */}
        <aside className="w-80 flex-shrink-0 overflow-y-auto bg-page p-4 space-y-6 hidden md:block">
          <PositionPanel activeStrategy={activeStrategy} />
          <div className="border-t border-border-subtle" />
          <AgentStatusPanel agents={agents} />
          <div className="border-t border-border-subtle" />
          <KeeperPanel />
          <div className="border-t border-border-subtle" />
          <DecisionLogPanel decisions={decisions} hcsTopicId={hcsTopicId} />
        </aside>
      </div>
    </main>
  );
}
