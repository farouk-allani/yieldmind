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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400'
            : isSystem
              ? 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
              : 'bg-navy-700 border border-navy-600 text-gray-200'
        }`}
      >
        {/* Role label */}
        <div
          className={`text-[10px] uppercase tracking-widest mb-1 ${
            isUser
              ? 'text-cyan-400/60'
              : isSystem
                ? 'text-amber-400/60'
                : 'text-gray-500'
          }`}
        >
          {isUser ? 'You' : isSystem ? 'System' : 'YieldMind'}
        </div>

        {/* Message content with markdown-like bold */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {renderContent(message.content)}
        </div>

        {/* Timestamp */}
        <div className="text-[10px] text-gray-600 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

function renderContent(text: string) {
  // Simple bold rendering for **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="font-semibold text-cyan-400">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
