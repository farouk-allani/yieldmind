'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageBubble } from './message-bubble';
import type { ChatMessage, Strategy } from '@/lib/types';
import { sendChatMessage, executeStrategy } from '@/lib/api';

interface ChatInterfaceProps {
  onAgentUpdate?: (agentStates: ChatMessage['agentStates']) => void;
  onDecisionsUpdate?: (decisions: ChatMessage['decisions']) => void;
}

export function ChatInterface({
  onAgentUpdate,
  onDecisionsUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content:
        'Welcome to YieldMind. Tell me your yield intent and I\'ll coordinate the agent network to find the optimal strategy on Bonzo Vaults.\n\nTry: "I want safe yield on 100 HBAR"',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Check if user is approving execution
    const isApproval =
      pendingStrategy &&
      (trimmed.toLowerCase().includes('yes') ||
        trimmed.toLowerCase().includes('execute') ||
        trimmed.toLowerCase().includes('do it') ||
        trimmed.toLowerCase().includes('confirm'));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response;

      if (isApproval && pendingStrategy) {
        response = await executeStrategy(pendingStrategy.id, sessionId);
        setPendingStrategy(null);
      } else {
        response = await sendChatMessage(trimmed, sessionId);
        if (response.strategy) {
          setPendingStrategy(response.strategy);
        }
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        agentStates: response.agentStates,
        strategy: response.strategy,
        decisions: response.decisions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.agentStates) {
        onAgentUpdate?.(response.agentStates);
      }
      if (response.decisions) {
        onDecisionsUpdate?.(response.decisions);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}. The agent backend may be offline — using simulated mode.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-cyan-400/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 pulse-dot" />
          <h2 className="font-heading text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Agent Chat
          </h2>
          <span className="text-[10px] text-gray-600 ml-auto font-mono">
            {sessionId}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        <AnimatePresence>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-cyan-400/60 text-sm pl-1"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Agents coordinating...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-cyan-400/10 px-5 py-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingStrategy
                ? 'Type "yes" to execute strategy, or describe a new intent...'
                : 'Describe your yield intent...'
            }
            disabled={isLoading}
            className="flex-1 bg-navy-800 border border-cyan-400/20 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-5 py-2.5 bg-cyan-400/10 border border-cyan-400/30 rounded-lg text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 hover:border-cyan-400/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
