'use client';

import { motion } from 'framer-motion';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
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
                : 'text-accent'
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
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
