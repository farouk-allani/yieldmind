'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, X, Loader2, Wallet, ShieldCheck, ShieldAlert, Zap, History } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { SessionSidebar } from './session-sidebar';
import { useWallet } from '@/lib/wallet-context';
import { useVault } from '@/lib/use-vault';
import { useChatHistory } from '@/lib/use-chat-history';
import { hashscanTxUrl, getNetworkConfig, getCurrentNetwork } from '@/lib/network-config';
import type { ChatMessage, Strategy } from '@/lib/types';
import { sendChatMessage, fetchAgentStatus } from '@/lib/api';

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
  const [showHistory, setShowHistory] = useState(false);

  const wallet = useWallet();
  const vault = useVault();
  const chatHistory = useChatHistory();

  const welcomeMessage: ChatMessage = {
    id: 'welcome',
    role: 'system',
    content:
      'Welcome to YieldMind. Connect your wallet, then tell me your yield intent and I\'ll coordinate the agent network to find the optimal strategy on Bonzo Vaults.\n\nTry: "I want safe yield on 100 HBAR"',
    timestamp: new Date().toISOString(),
  };

  useEffect(() => {
    setMounted(true);
    setMessages([welcomeMessage]);
  }, []);

  // Load chat sessions when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address && chatHistory.isAvailable) {
      chatHistory.loadSessions(wallet.address);
      // Create a new session if none active
      if (!chatHistory.activeSessionId) {
        chatHistory.newSession(wallet.address).then((id) => {
          sessionRef.current = id;
        });
      }
    }
  }, [wallet.isConnected, wallet.address, chatHistory.isAvailable]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Keep a stable ref to the callback so the polling effect doesn't restart
  // every time the parent re-renders with a new function reference.
  const onAgentUpdateRef = useRef(onAgentUpdate);
  useEffect(() => { onAgentUpdateRef.current = onAgentUpdate; }, [onAgentUpdate]);

  // Poll agent status every 1.5s while agents are working so the right panel
  // reflects live state (thinking → executing → idle) in real-time.
  useEffect(() => {
    if (!isLoading) return;

    const poll = async () => {
      try {
        const states = await fetchAgentStatus();
        onAgentUpdateRef.current?.(states);
      } catch {
        // silent — panel will update from final chat response
      }
    };

    poll(); // immediate first poll
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [isLoading]); // intentionally omits onAgentUpdate — use the ref instead

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
    const totalAmount = strategy.userIntent?.targetAmount || 100;
    const tokenSymbol = strategy.userIntent?.tokenSymbol || 'HBAR';
    // Separate executable allocations: Bonzo Lend + Bonzo Vaults
    const lendVault = strategy.vaults.find((v) => v.productType === 'bonzo-lend' && v.allocation > 0);
    const vaultAllocations = strategy.vaults.filter((v) => v.productType === 'bonzo-vault' && v.allocation > 0);

    const primaryVault = lendVault || strategy.vaults.find((v) => v.allocation > 0) || strategy.vaults[0];
    const assetEvmAddress = primaryVault?.assetEvmAddress;
    const vaultSymbol = primaryVault?.symbol || 'HBAR';
    const isNativeHbar = vaultSymbol === 'HBAR' && !assetEvmAddress;

    // Calculate amounts per allocation
    const lendAmount = lendVault ? Math.round((totalAmount * lendVault.allocation / 100) * 1e8) / 1e8 : 0;
    const vaultAmounts = vaultAllocations.map((v) => ({
      vault: v,
      amount: Math.round((totalAmount * v.allocation / 100) * 1e8) / 1e8,
    }));

    // Build deposit summary
    const parts: string[] = [];
    if (lendAmount > 0) parts.push(`${lendAmount} ${tokenSymbol} → Bonzo Lend (${lendVault!.allocation}%)`);
    for (const va of vaultAmounts) parts.push(`${va.amount} ${tokenSymbol} → ${va.vault.vaultName} (${va.vault.allocation}%)`);

    addMessage({
      id: `system-signing-${Date.now()}`,
      role: 'system',
      content: `Executing strategy:\n${parts.map((p) => `• ${p}`).join('\n')}\n\n${
        vaultAmounts.length > 0
          ? `This will require ${1 + vaultAmounts.length} wallet signature${vaultAmounts.length > 0 ? 's' : ''} (one per deposit target).`
          : isNativeHbar ? 'Please confirm in your wallet.' : 'This requires 2 signatures: token approval + deposit.'
      }`,
      timestamp: new Date().toISOString(),
    });

    // ── Execute deposits sequentially: Lend first, then Vault(s) ──
    const depositResults: Array<{ target: string; amount: number; txHash?: string; error?: string }> = [];

    // Step 1: Bonzo Lend deposit
    if (lendAmount > 0 && lendVault) {
      addMessage({
        id: `system-lend-${Date.now()}`,
        role: 'system',
        content: `Step 1: Depositing ${lendAmount} ${tokenSymbol} into Bonzo Lend...`,
        timestamp: new Date().toISOString(),
      });

      const lendResult = await vault.deposit(
        strategy.id,
        lendVault.vaultName,
        lendAmount,
        lendVault.assetEvmAddress,
        lendVault.symbol,
        lendVault.decimals
      );

      if (lendResult.status === 'confirmed' && lendResult.txHash) {
        depositResults.push({ target: lendVault.vaultName, amount: lendAmount, txHash: lendResult.txHash });
        addMessage({
          id: `system-lend-ok-${Date.now()}`,
          role: 'system',
          content: `Bonzo Lend deposit confirmed: ${lendAmount} ${tokenSymbol}`,
          timestamp: new Date().toISOString(),
        });
        vault.resetStatus();
      } else {
        depositResults.push({ target: lendVault.vaultName, amount: lendAmount, error: lendResult.error || 'Failed' });
        addMessage({
          id: `system-lend-fail-${Date.now()}`,
          role: 'system',
          content: `Bonzo Lend deposit failed: ${lendResult.error || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
        vault.resetStatus();
      }
    }

    // Step 2: Bonzo Vault deposit(s)
    for (let i = 0; i < vaultAmounts.length; i++) {
      const { vault: vaultAlloc, amount: vaultAmt } = vaultAmounts[i];

      addMessage({
        id: `system-vault-${i}-${Date.now()}`,
        role: 'system',
        content: `Step ${(lendAmount > 0 ? 2 : 1) + i}: Depositing ${vaultAmt} ${tokenSymbol} into ${vaultAlloc.vaultName}...`,
        timestamp: new Date().toISOString(),
      });

      // Bonzo Vault deposit: approve token + vault.deposit(amount)
      // The deposit function in use-vault handles this via depositBonzoVault
      const vaultResult = await vault.deposit(
        strategy.id,
        vaultAlloc.vaultName,
        vaultAmt,
        vaultAlloc.assetEvmAddress,  // vault contract address
        vaultAlloc.symbol,
        vaultAlloc.decimals,
        undefined, // aTokenAddress not needed
        'bonzo-vault' // signal this is a vault deposit, not a lend deposit
      );

      if (vaultResult.status === 'confirmed' && vaultResult.txHash) {
        depositResults.push({ target: vaultAlloc.vaultName, amount: vaultAmt, txHash: vaultResult.txHash });
        addMessage({
          id: `system-vault-ok-${i}-${Date.now()}`,
          role: 'system',
          content: `Vault deposit confirmed: ${vaultAmt} ${tokenSymbol} → ${vaultAlloc.vaultName}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        depositResults.push({ target: vaultAlloc.vaultName, amount: vaultAmt, error: vaultResult.error || 'Failed' });
        addMessage({
          id: `system-vault-fail-${i}-${Date.now()}`,
          role: 'system',
          content: `Vault deposit failed: ${vaultResult.error || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
      }
      vault.resetStatus();
    }

    // ── Summary & HCS logging ──
    const successful = depositResults.filter((r) => r.txHash);
    const totalDeposited = successful.reduce((sum, r) => sum + r.amount, 0);

    if (successful.length > 0) {
      // Log the first successful tx to HCS
      const primaryTx = successful[0];
      try {
        const response = await fetch('/api/execute/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: primaryTx.txHash,
            userAddress: wallet.address,
            depositAmount: totalDeposited,
            tokenSymbol,
            sessionId,
            evmNetwork: getCurrentNetwork(),
          }),
        });

        const data = await response.json();
        const txLinks = successful.map((r) => `• ${r.target}: [${r.txHash!.slice(0, 12)}...](${hashscanTxUrl(r.txHash!)})`).join('\n');

        addMessage({
          id: `assistant-confirm-${Date.now()}`,
          role: 'assistant',
          content: data.message || `Strategy executed! ${totalDeposited} ${tokenSymbol} deposited.\n\n${txLinks}\n\nThe Sentinel agent is monitoring your positions.`,
          timestamp: new Date().toISOString(),
          agentStates: data.agentStates,
          strategy: data.strategy,
          decisions: data.decisions,
        });

        if (data.agentStates) onAgentUpdate?.(data.agentStates);
        if (data.decisions) onDecisionsUpdate?.(data.decisions);
        if (data.strategy) onStrategyUpdate?.(data.strategy);
      } catch {
        const txLinks = successful.map((r) => `• ${r.target}: ${hashscanTxUrl(r.txHash!)}`).join('\n');
        addMessage({
          id: `assistant-confirmed-fallback-${Date.now()}`,
          role: 'assistant',
          content: `Strategy executed! ${totalDeposited} ${tokenSymbol} deposited into Bonzo Finance.\n\n${txLinks}\n\nSentinel agent is monitoring your positions.`,
          timestamp: new Date().toISOString(),
        });
      }

      setPendingStrategy(null);
      wallet.refreshBalance();
    } else {
      addMessage({
        id: `system-failed-${Date.now()}`,
        role: 'system',
        content: `All deposits failed. No funds were moved. ${depositResults.map((r) => r.error).join('; ')}`,
        timestamp: new Date().toISOString(),
      });
    }
    vault.resetStatus();
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

    // Persist user message to Supabase
    chatHistory.persistMessage(sessionId, 'user', trimmed);

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

      // Persist assistant message to Supabase (with metadata)
      chatHistory.persistMessage(sessionId, 'assistant', response.message, {
        strategy: response.strategy || undefined,
        decisions: response.decisions || undefined,
      });

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

  const handleNewSession = async () => {
    if (!wallet.address) return;
    const id = await chatHistory.newSession(wallet.address);
    sessionRef.current = id;
    setMessages([welcomeMessage]);
    setPendingStrategy(null);
  };

  const handleSwitchSession = async (sid: string) => {
    sessionRef.current = sid;
    const loaded = await chatHistory.switchSession(sid);
    if (loaded.length > 0) {
      setMessages([welcomeMessage, ...loaded]);
    } else {
      setMessages([welcomeMessage]);
    }
    setPendingStrategy(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Session History Sidebar */}
      <SessionSidebar
        sessions={chatHistory.sessions}
        activeSessionId={chatHistory.activeSessionId}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onNewSession={handleNewSession}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={(sid) => chatHistory.removeSession(sid)}
      />

      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2.5">
          {chatHistory.isAvailable && (
            <button
              onClick={() => setShowHistory(true)}
              className="p-1.5 rounded-[6px] hover:bg-surface transition-colors text-text-muted hover:text-text-primary"
              title="Chat history"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <div className="w-7 h-7 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center overflow-hidden">
            <img src="/strategist.png" alt="AI" className="w-4 h-4 object-contain" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-text-primary">
              Agent Chat
            </h2>
            <p className="text-[10px] text-text-muted">
              {mounted ? (chatHistory.isAvailable && chatHistory.activeSessionId
                ? `Session ${chatHistory.activeSessionId.slice(0, 8)}...`
                : sessionId) : ''}
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
            onSwitchNetwork={wallet.switchToHedera}
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

const RISK_CONFIG = {
  conservative: { label: 'Conservative', icon: ShieldCheck, color: 'text-supply', bg: 'bg-supply/10', border: 'border-supply/25' },
  moderate:     { label: 'Moderate',     icon: ShieldAlert, color: 'text-points',  bg: 'bg-points/10',  border: 'border-points/25' },
  aggressive:   { label: 'Aggressive',   icon: Zap,         color: 'text-borrow',  bg: 'bg-borrow/10',  border: 'border-borrow/25' },
} as const;

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
  const isDepositing = depositStatus === 'approving' || depositStatus === 'signing' || depositStatus === 'confirming';

  const riskKey = (strategy.overallRisk || 'moderate') as keyof typeof RISK_CONFIG;
  const risk = RISK_CONFIG[riskKey] ?? RISK_CONFIG.moderate;
  const RiskIcon = risk.icon;

  // First vault reasoning as AI insight
  const aiReasoning = strategy.vaults[0]?.reasoning;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-1 mb-4 rounded-[8px] border border-border-subtle bg-surface overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-text-primary">
              Strategy Proposal
            </span>
          </div>
          <div className="text-[11px] text-text-muted">
            Analyzed by Scout &amp; Strategist agents · Ready to execute
          </div>
        </div>
        {/* Risk badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] border text-[11px] font-medium flex-shrink-0 ${risk.color} ${risk.bg} ${risk.border}`}>
          <RiskIcon className="w-3 h-3" />
          {risk.label}
        </div>
      </div>

      {/* APY hero */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">
            Deposit
          </div>
          <div className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <img
              src={tokenSymbol === 'HBAR' ? '/hbar.webp' : `/${tokenSymbol.toLowerCase()}.png`}
              alt={tokenSymbol}
              className="w-6 h-6 rounded-full"
            />
            {amount} {tokenSymbol}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">
            Expected APY
          </div>
          <div className="text-2xl font-bold text-supply">
            {strategy.totalExpectedApy.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Executable allocations */}
      <div className="px-4 pb-3 space-y-1.5">
        {strategy.vaults.filter((v) => v.allocation > 0).map((v, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 px-3 rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-border-subtle"
          >
            <div className="flex items-center gap-2.5">
              <img src="/bonzo.webp" alt="Bonzo" className="w-5 h-5 rounded-full flex-shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary leading-tight">{v.vaultName}</div>
                <div className="text-[11px] text-text-muted">{v.symbol} · Bonzo Lend</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[13px] font-semibold text-text-primary">{v.allocation}%</div>
              <div className="text-[11px] text-supply">{v.expectedApy.toFixed(2)}% APY</div>
            </div>
          </div>
        ))}

        {/* Vault recommendations (not auto-deposited) */}
        {strategy.vaults.filter((v) => v.allocation === 0).length > 0 && (
          <>
            <div className="text-[10px] text-text-muted uppercase tracking-wide pt-2 pb-1">
              Additional Yield Opportunities (manual deposit)
            </div>
            {strategy.vaults.filter((v) => v.allocation === 0).map((v, i) => (
              <div
                key={`rec-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-[8px] bg-[rgba(255,255,255,0.02)] border border-border-subtle border-dashed opacity-75"
              >
                <div className="flex items-center gap-2.5">
                  <img src="/bonzo.webp" alt="Bonzo" className="w-5 h-5 rounded-full flex-shrink-0" />
                  <div>
                    <div className="text-[12px] font-medium text-text-secondary leading-tight">{v.vaultName}</div>
                    <div className="text-[11px] text-text-muted">{v.symbol} · Bonzo Vault</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] font-semibold text-points">{v.expectedApy.toFixed(1)}% APY</div>
                  <a
                    href="https://app.bonzo.finance/vaults"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-accent hover:text-accent/80"
                  >
                    Deposit on Bonzo →
                  </a>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* AI reasoning excerpt */}
      {aiReasoning && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-[8px] bg-[rgba(255,255,255,0.02)] border border-border-subtle">
          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">
            AI Reasoning
          </div>
          <p className="text-[12px] text-text-muted leading-relaxed line-clamp-2">
            {aiReasoning}
          </p>
        </div>
      )}

      {/* Deposit status */}
      {isDepositing && (
        <div className="mx-4 mb-3 flex items-center gap-2 py-2 px-3 rounded-[8px] bg-accent/10 text-[13px] text-accent border border-accent/20">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          {depositStatus === 'approving'
            ? 'Approving token spend… (1 of 2 signatures)'
            : depositStatus === 'signing'
              ? 'Waiting for deposit signature…'
              : 'Confirming on Hedera…'}
        </div>
      )}

      {/* Balance warning */}
      {walletConnected && correctNetwork && !hasBalance && balance !== null && (
        <div className="mx-4 mb-3 text-[11px] text-borrow px-3 py-2 rounded-[8px] bg-borrow/10 border border-borrow/20">
          Insufficient balance — you have {parseFloat(balance || '0').toFixed(2)} {tokenSymbol}, need {amount} {tokenSymbol}.
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
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
            Switch to {getNetworkConfig().chainName}
          </button>
        ) : (
          <>
            <button
              onClick={onApprove}
              disabled={isDepositing || !hasBalance}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[8px] bg-supply text-white text-sm font-medium hover:bg-supply/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDepositing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isDepositing ? 'Processing…' : 'Approve & Deposit'}
            </button>
            <button
              onClick={onReject}
              disabled={isDepositing}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-[8px] border border-border-subtle text-text-muted text-sm hover:bg-[rgba(255,255,255,0.04)] transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
