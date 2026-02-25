'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare, Check, X, Loader2, Wallet } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { useWallet } from '@/lib/wallet-context';
import { useVault } from '@/lib/use-vault';
import type { ChatMessage, Strategy } from '@/lib/types';
import { sendChatMessage } from '@/lib/api';

interface ChatInterfaceProps {
  onAgentUpdate?: (agentStates: ChatMessage['agentStates']) => void;
  onDecisionsUpdate?: (decisions: ChatMessage['decisions']) => void;
  onStrategyUpdate?: (strategy: Strategy | undefined) => void;
}

export function ChatInterface({
  onAgentUpdate,
  onDecisionsUpdate,
  onStrategyUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sessionRef = useRef(`session-${Date.now()}`);
  const sessionId = sessionRef.current;
  const [mounted, setMounted] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wallet = useWallet();
  const vault = useVault();

  useEffect(() => {
    setMounted(true);
    setMessages([{
      id: 'welcome',
      role: 'system',
      content:
        'Welcome to YieldMind. Connect your wallet, then tell me your yield intent and I\'ll coordinate the agent network to find the optimal strategy on Bonzo Vaults.\n\nTry: "I want safe yield on 100 HBAR"',
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /**
   * Handle deposit approval — user clicks "Approve & Deposit"
   */
  const handleApproveDeposit = async () => {
    if (!pendingStrategy || !wallet.isConnected || !wallet.isCorrectNetwork)
      return;

    const strategy = pendingStrategy;
    const amount = strategy.userIntent?.targetAmount || 100;
    const strategyName =
      strategy.vaults.map((v) => v.vaultName).join(' + ') || 'YieldMind Strategy';

    addMessage({
      id: `system-signing-${Date.now()}`,
      role: 'system',
      content: `Requesting deposit of ${amount} HBAR into YieldMindVault... Please confirm in MetaMask.`,
      timestamp: new Date().toISOString(),
    });

    // Call the vault deposit — triggers MetaMask popup
    const result = await vault.deposit(strategy.id, strategyName, amount);

    if (result.status === 'confirmed' && result.txHash) {
      addMessage({
        id: `system-confirmed-${Date.now()}`,
        role: 'system',
        content: `Transaction signed and confirmed on-chain! Verifying with agent network...`,
        timestamp: new Date().toISOString(),
      });

      // Send tx hash to backend for HCS logging
      try {
        const response = await fetch('/api/execute/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: result.txHash,
            userAddress: wallet.address,
            depositAmount: amount,
            sessionId,
          }),
        });

        const data = await response.json();

        const confirmMessage: ChatMessage = {
          id: `assistant-confirm-${Date.now()}`,
          role: 'assistant',
          content:
            data.message ||
            `Deposit confirmed! View on HashScan: https://hashscan.io/testnet/transaction/${result.txHash}`,
          timestamp: new Date().toISOString(),
          agentStates: data.agentStates,
          strategy: data.strategy,
          decisions: data.decisions,
        };
        addMessage(confirmMessage);

        if (data.agentStates) onAgentUpdate?.(data.agentStates);
        if (data.decisions) onDecisionsUpdate?.(data.decisions);
        if (data.strategy) onStrategyUpdate?.(data.strategy);
      } catch {
        addMessage({
          id: `assistant-confirmed-fallback-${Date.now()}`,
          role: 'assistant',
          content: `Deposit confirmed on-chain!\n\n**Transaction:** https://hashscan.io/testnet/transaction/${result.txHash}\n\nYour ${amount} HBAR is now in the YieldMindVault contract. The Sentinel agent is monitoring your position.`,
          timestamp: new Date().toISOString(),
        });
      }

      setPendingStrategy(null);
      vault.resetStatus();
      wallet.refreshBalance();
    } else {
      addMessage({
        id: `system-failed-${Date.now()}`,
        role: 'system',
        content: `Deposit failed: ${result.error || 'Unknown error'}. No funds were moved.`,
        timestamp: new Date().toISOString(),
      });
      vault.resetStatus();
    }
  };

  const handleRejectStrategy = () => {
    setPendingStrategy(null);
    vault.resetStatus();
    addMessage({
      id: `system-rejected-${Date.now()}`,
      role: 'system',
      content: 'Strategy rejected. Describe a different intent or adjust your preferences.',
      timestamp: new Date().toISOString(),
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

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
      const response = await sendChatMessage(trimmed, sessionId);
      if (response.strategy) {
        setPendingStrategy(response.strategy);
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

      if (response.agentStates) onAgentUpdate?.(response.agentStates);
      if (response.decisions) onDecisionsUpdate?.(response.decisions);
      if (response.strategy) onStrategyUpdate?.(response.strategy);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}. The agent backend may be offline.`,
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
      <div className="flex-shrink-0 border-b border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden">
            <img src="/strategist.png" alt="AI" className="w-4 h-4 object-contain" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-text-primary">
              Agent Chat
            </h2>
            <p className="text-[10px] text-text-muted">
              {mounted ? sessionId : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-supply" />
            <span className="text-[10px] text-text-muted">Connected</span>
          </div>
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
            className="flex items-center gap-2 text-text-muted text-sm pl-1"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Agents coordinating...</span>
          </motion.div>
        )}

        {/* Strategy Approval Card */}
        {pendingStrategy && (
          <StrategyApprovalCard
            strategy={pendingStrategy}
            walletConnected={wallet.isConnected}
            correctNetwork={wallet.isCorrectNetwork}
            depositStatus={vault.depositStatus}
            balance={wallet.balance}
            onApprove={handleApproveDeposit}
            onReject={handleRejectStrategy}
            onConnect={wallet.connect}
            onSwitchNetwork={wallet.switchToHederaTestnet}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border-subtle px-5 py-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your yield intent..."
            disabled={isLoading}
            className="flex-1 bg-surface border border-border-subtle rounded-[8px] px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="h-[42px] px-4 bg-accent hover:bg-accent/90 rounded-[8px] text-text-primary text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Strategy Approval Card ─────────────────────────────────────────

interface StrategyApprovalCardProps {
  strategy: Strategy;
  walletConnected: boolean;
  correctNetwork: boolean;
  depositStatus: string;
  balance: string | null;
  onApprove: () => void;
  onReject: () => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}

function StrategyApprovalCard({
  strategy,
  walletConnected,
  correctNetwork,
  depositStatus,
  balance,
  onApprove,
  onReject,
  onConnect,
  onSwitchNetwork,
}: StrategyApprovalCardProps) {
  const amount = strategy.userIntent?.targetAmount || 100;
  const tokenSymbol = strategy.userIntent?.tokenSymbol || 'HBAR';
  const hasBalance = balance ? parseFloat(balance) >= amount : false;
  const isDepositing = depositStatus === 'signing' || depositStatus === 'confirming';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-1 mb-4 rounded-[8px] border border-accent/30 bg-accent/5 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-accent/20 bg-accent/10">
        <div className="text-sm font-medium text-text-primary">
          Strategy Ready for Execution
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          Review and approve to deposit via your wallet
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Amount */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted uppercase tracking-wide">
            Deposit Amount
          </span>
          <span className="text-base font-bold text-text-primary">
            {amount} {tokenSymbol}
          </span>
        </div>

        {/* Vault allocations */}
        <div className="space-y-2">
          {strategy.vaults.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-3 rounded-[8px] bg-surface"
            >
              <div>
                <div className="text-sm text-text-primary">{v.vaultName}</div>
                <div className="text-[11px] text-text-muted">
                  {v.riskLevel} risk
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-text-primary">
                  {v.allocation}%
                </div>
                <div className="text-[11px] text-supply">
                  ~{v.expectedApy.toFixed(1)}% APY
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Expected APY */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <span className="text-[11px] text-text-muted uppercase tracking-wide">
            Blended APY
          </span>
          <span className="text-sm font-bold text-supply">
            ~{strategy.totalExpectedApy.toFixed(1)}%
          </span>
        </div>

        {/* Deposit status */}
        {isDepositing && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-[8px] bg-accent/10 text-sm text-accent">
            <Loader2 className="w-4 h-4 animate-spin" />
            {depositStatus === 'signing'
              ? 'Waiting for MetaMask signature...'
              : 'Confirming on Hedera...'}
          </div>
        )}

        {/* Balance warning */}
        {walletConnected && correctNetwork && !hasBalance && balance !== null && (
          <div className="text-[11px] text-borrow px-3 py-2 rounded-[8px] bg-borrow/10">
            Insufficient balance. You have {parseFloat(balance || '0').toFixed(2)} HBAR
            but need {amount} HBAR.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {!walletConnected ? (
            <button
              onClick={onConnect}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[8px] bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet to Deposit
            </button>
          ) : !correctNetwork ? (
            <button
              onClick={onSwitchNetwork}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[8px] bg-borrow/20 text-borrow text-sm font-medium hover:bg-borrow/30 transition-colors"
            >
              Switch to Hedera Testnet
            </button>
          ) : (
            <>
              <button
                onClick={onApprove}
                disabled={isDepositing || !hasBalance}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[8px] bg-supply text-white text-sm font-medium hover:bg-supply/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {isDepositing ? 'Processing...' : 'Approve & Deposit'}
              </button>
              <button
                onClick={onReject}
                disabled={isDepositing}
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-[8px] border border-border-subtle text-text-muted text-sm hover:bg-surface transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
