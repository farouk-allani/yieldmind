'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Clock,
  ArrowLeft,
  Activity,
  ScrollText,
} from 'lucide-react';

interface HCSSession {
  sessionId: string;
  topicId: string;
  title?: string;
  walletAddress?: string;
  createdAt?: string;
  hashscanUrl: string;
}

interface HCSMessage {
  sequenceNumber: number;
  timestamp: string;
  payload: {
    type?: string;
    agent?: string;
    action?: string;
    reasoning?: string;
    confidence?: number;
    session?: string;
    [key: string]: unknown;
  };
}

const AGENT_COLORS: Record<string, string> = {
  scout: 'text-supply',
  strategist: 'text-accent',
  executor: 'text-borrow',
  sentinel: 'text-danger',
  keeper: 'text-points',
};

const AGENT_BADGES: Record<string, { label: string; bg: string }> = {
  scout: { label: 'Scout', bg: 'bg-supply/10' },
  strategist: { label: 'Strategist', bg: 'bg-accent/10' },
  executor: { label: 'Executor', bg: 'bg-borrow/10' },
  sentinel: { label: 'Sentinel', bg: 'bg-danger/10' },
  keeper: { label: 'Keeper', bg: 'bg-points/10' },
};

export default function HCSViewerPage() {
  const [sessions, setSessions] = useState<HCSSession[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customTopic, setCustomTopic] = useState('');
  const [messages, setMessages] = useState<HCSMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions from database (persisted)
  useEffect(() => {
    setSessionsLoading(true);
    fetch('/api/hcs/sessions')
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  const fetchMessages = async (topicId: string) => {
    if (!topicId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hcs/messages?topicId=${topicId}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setSelectedTopic(topicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopic.match(/^\d+\.\d+\.\d+$/)) {
      fetchMessages(customTopic);
    }
  };

  const network = 'testnet'; // HCS is on testnet

  return (
    <div className="min-h-screen bg-page text-text-primary">
      {/* Header */}
      <header className="border-b border-border-subtle bg-page px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="w-px h-5 bg-border-subtle" />
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo without text.png"
                alt="YieldMind"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-[#F7F6F0]">Yield</span>
                <span className="text-supply">Mind</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/keeper"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle text-[11px] text-text-secondary font-medium hover:bg-surface-hover transition-colors"
            >
              <Activity className="w-3 h-3" />
              Keeper Agent
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[8px] bg-accent/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold">HCS Decision Trail</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Every agent decision is logged on-chain via Hedera Consensus Service (testnet)
            </p>
          </div>
        </div>

        {/* Session selector */}
        <div className="glass-card p-4 mb-4">
          <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            Sessions with HCS Topics
          </h2>

          {sessionsLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 text-text-muted animate-spin" />
              <p className="text-xs text-text-muted">Loading sessions...</p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-2 mb-4">
              {sessions.map((session) => {
                const isKeeper = session.sessionId === 'keeper-global';
                return (
                  <button
                    key={session.topicId}
                    onClick={() => fetchMessages(session.topicId)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] text-sm transition-colors ${
                      selectedTopic === session.topicId
                        ? 'bg-accent/10 border border-accent/20'
                        : 'hover:bg-surface border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isKeeper ? (
                        <Activity className="w-4 h-4 text-points flex-shrink-0" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-text-muted flex-shrink-0" />
                      )}
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isKeeper ? 'text-points' : 'text-text-secondary'
                        }`}>
                          {session.title || session.sessionId}
                        </p>
                        <p className="text-[10px] text-text-muted font-mono">
                          {session.topicId}
                          {session.createdAt && !isKeeper && (
                            <span className="ml-2">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <a
                      href={session.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-accent flex-shrink-0 ml-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      HashScan
                    </a>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted mb-4 py-2">
              No sessions with HCS topics found. Send a message in the chat to create one.
            </p>
          )}

          {/* Custom topic input */}
          <form onSubmit={handleCustomTopicSubmit} className="flex gap-2">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Enter topic ID (0.0.xxxxx)"
              className="flex-1 px-3 py-2 rounded-[8px] bg-surface border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={!customTopic.match(/^\d+\.\d+\.\d+$/)}
              className="px-4 py-2 rounded-[8px] bg-accent text-white text-sm font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
            >
              Load
            </button>
          </form>
        </div>

        {/* Messages */}
        {selectedTopic && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-secondary">
                  Topic {selectedTopic}
                </h2>
                <span className="text-xs text-text-muted">
                  {messages.length} messages
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://hashscan.io/${network}/topic/${selectedTopic}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                >
                  <ExternalLink className="w-3 h-3" />
                  HashScan
                </a>
                <button
                  onClick={() => fetchMessages(selectedTopic)}
                  disabled={loading}
                  className="p-1.5 rounded-[8px] hover:bg-surface transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger mb-4">{error}</p>
            )}

            {loading && messages.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">
                Loading messages...
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">
                No messages in this topic yet.
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const agent = msg.payload.agent || 'unknown';
                  const badge = AGENT_BADGES[agent] || AGENT_BADGES.sentinel;
                  const color = AGENT_COLORS[agent] || 'text-text-secondary';

                  return (
                    <motion.div
                      key={msg.sequenceNumber}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-border-subtle rounded-[8px] px-4 py-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-text-muted font-mono">
                          #{msg.sequenceNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] ${badge.bg} ${color}`}
                        >
                          {badge.label}
                        </span>
                        {msg.payload.action && (
                          <span className="text-xs text-text-secondary">
                            {msg.payload.action as string}
                          </span>
                        )}
                        {msg.payload.confidence != null && (
                          <span className="text-xs text-text-muted">
                            {((msg.payload.confidence as number) * 100).toFixed(0)}%
                          </span>
                        )}
                        <span className="text-xs text-text-muted ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(
                            parseFloat(msg.timestamp) * 1000
                          ).toLocaleString()}
                        </span>
                      </div>

                      {msg.payload.reasoning && (
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {msg.payload.reasoning as string}
                        </p>
                      )}

                      {msg.payload.type && (
                        <div className="mt-2 text-[11px] text-text-muted font-mono">
                          type: {msg.payload.type as string}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
