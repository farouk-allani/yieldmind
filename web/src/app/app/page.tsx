'use client';

import { useState, useEffect } from 'react';
import { Activity, Radio } from 'lucide-react';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AgentStatusPanel } from '@/components/dashboard/agent-status';
import { DecisionLogPanel } from '@/components/dashboard/decision-log';
import type { AgentState, DecisionLog } from '@/lib/types';
import { createMockAgentStates } from '@/lib/mock-data';

export default function AppPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);

  useEffect(() => {
    setAgents(createMockAgentStates());
  }, []);

  return (
    <main className="h-screen flex flex-col">
      {/* Top nav */}
      <header className="flex-shrink-0 border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold text-text-primary">
                YieldMind
              </h1>
              <p className="text-[11px] text-text-muted -mt-0.5">
                Autonomous DeFi Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-supply" />
              <span className="text-[11px] text-text-secondary">
                Hedera Testnet
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-surface text-[11px] text-text-muted">
              <Radio className="w-3 h-3" />
              Bonzo Vaults
            </div>
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
