'use client';

import { useState, useEffect } from 'react';
import { Database, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AgentStatusPanel } from '@/components/dashboard/agent-status';
import { DecisionLogPanel } from '@/components/dashboard/decision-log';
import { ConnectWalletButton } from '@/components/wallet/connect-button';
import { NetworkToggle } from '@/components/wallet/network-toggle';
import { fetchAgentStatus } from '@/lib/api';
import type { AgentState, DecisionLog, Strategy } from '@/lib/types';

export default function AppPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    fetchAgentStatus()
      .then(setAgents)
      .catch(() => {
        // Agent backend not ready yet — will populate after first chat
      });
  }, []);

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
          />
        </div>

        {/* Dashboard sidebar */}
        <aside className="w-80 flex-shrink-0 overflow-y-auto bg-page p-4 space-y-6 hidden lg:block">
          <AgentStatusPanel agents={agents} />
          <div className="border-t border-border-subtle" />
          <DecisionLogPanel decisions={decisions} />
        </aside>
      </div>
    </main>
  );
}
