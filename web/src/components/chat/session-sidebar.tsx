'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, Trash2, Clock, ChevronRight, X } from 'lucide-react';
import type { ChatSession } from '@/lib/supabase';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  isOpen,
  onClose,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: SessionSidebarProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (sessionId: string) => {
    if (confirmDelete === sessionId) {
      onDeleteSession(sessionId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(sessionId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-[#0d1018] border-r border-border-subtle z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="text-sm font-semibold text-text-primary">Chat History</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-[6px] hover:bg-surface transition-colors text-text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New chat button */}
            <div className="px-3 py-3">
              <button
                onClick={() => { onNewSession(); onClose(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[8px] bg-accent/10 border border-accent/20 text-sm text-accent font-medium hover:bg-accent/20 transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                New Conversation
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[12px]">No previous conversations</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors ${
                      session.id === activeSessionId
                        ? 'bg-surface border border-border-subtle'
                        : 'hover:bg-surface/50'
                    }`}
                    onClick={() => { onSwitchSession(session.id); onClose(); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-text-primary truncate font-medium">
                        {session.title}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {formatDate(session.updated_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                      className={`p-1 rounded transition-colors flex-shrink-0 ${
                        confirmDelete === session.id
                          ? 'text-danger bg-danger/10'
                          : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10'
                      }`}
                      title={confirmDelete === session.id ? 'Click again to confirm' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
