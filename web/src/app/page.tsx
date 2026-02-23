'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AgentStatusPanel } from '@/components/dashboard/agent-status';
import { DecisionLogPanel } from '@/components/dashboard/decision-log';
import type { AgentState, DecisionLog } from '@/lib/types';
import { createMockAgentStates } from '@/lib/mock-data';

export default function Home() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);

  useEffect(() => {
    setAgents(createMockAgentStates());
  }, []);

  return (
    <main className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-cyan-400/10 bg-navy-900/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
              <span className="text-cyan-400 font-heading font-bold text-sm">
                Y
              </span>
            </div>
            <div>
              <h1 className="font-heading text-base font-bold text-gray-100 glow-text-cyan">
                YieldMind
              </h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">
                Autonomous DeFi Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-500">
                Hedera Testnet
              </span>
            </div>
            <div className="text-[10px] text-gray-600 font-mono">
              Bonzo Vaults
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 max-w-[1600px] mx-auto w-full">
        {/* Chat — primary panel */}
        <div className="flex-1 flex flex-col border-r border-cyan-400/10 min-w-0">
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
        <aside className="w-80 flex-shrink-0 overflow-y-auto bg-navy-900/50 p-4 space-y-6 hidden lg:block">
          <AgentStatusPanel agents={agents} />
          <div className="border-t border-cyan-400/10" />
          <DecisionLogPanel decisions={decisions} />
        </aside>
      </div>
    </main>
  );
}
