'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {/* Agent avatar for assistant messages */}
      {isAssistant && (
        <div className="w-7 h-7 rounded-[8px] bg-[#F7F6F0] flex items-center justify-center flex-shrink-0 mr-2 mt-1 overflow-hidden">
          <img
            src="/logo without text.png"
            alt="YieldMind"
            className="w-5 h-5 object-contain"
          />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-[8px] px-4 py-3 ${
          isUser
            ? 'bg-surface border border-border-subtle text-text-primary'
            : isSystem
              ? 'bg-card border border-border-subtle text-text-secondary'
              : 'glass-card text-text-primary'
        }`}
      >
        {/* Role label */}
        <div
          className={`text-[11px] font-medium mb-1 ${
            isUser
              ? 'text-text-muted'
              : isSystem
                ? 'text-borrow'
                : 'text-supply'
          }`}
        >
          {isUser ? 'You' : isSystem ? 'System' : 'YieldMind'}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {renderContent(message.content)}
        </div>

        {/* Timestamp */}
        <div className="text-[11px] text-text-muted mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

function renderContent(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const isHashScan = part.includes('hashscan.io');
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-supply hover:text-supply/80 underline underline-offset-2 transition-colors"
        >
          {isHashScan ? 'View on HashScan' : part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
