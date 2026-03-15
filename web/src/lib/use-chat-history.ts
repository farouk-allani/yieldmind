'use client';

import { useState, useCallback, useRef } from 'react';
import {
  supabase,
  listSessions,
  getOrCreateSession,
  saveMessage,
  loadMessages,
  deleteSession,
  updateSessionTitle,
  type ChatSession,
  type ChatMessage as DbMessage,
} from './supabase';
import type { ChatMessage } from './types';

export interface UseChatHistoryReturn {
  /** All sessions for the connected wallet */
  sessions: ChatSession[];
  /** Currently active session ID (Supabase UUID) */
  activeSessionId: string | null;
  /** Whether Supabase is configured and available */
  isAvailable: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Load sessions for a wallet address */
  loadSessions: (walletAddress: string) => Promise<void>;
  /** Start a new session */
  newSession: (walletAddress: string) => Promise<string>;
  /** Switch to an existing session, returns its messages */
  switchSession: (sessionId: string) => Promise<ChatMessage[]>;
  /** Persist a user or assistant message */
  persistMessage: (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  /** Delete a session */
  removeSession: (sessionId: string) => Promise<void>;
  /** Rename a session */
  renameSession: (sessionId: string, title: string) => Promise<void>;
}

/** Convert a DB message to the frontend ChatMessage shape */
function toFrontendMessage(dbMsg: DbMessage): ChatMessage {
  return {
    id: dbMsg.id,
    role: dbMsg.role as ChatMessage['role'],
    content: dbMsg.content,
    timestamp: dbMsg.created_at,
    ...(dbMsg.metadata as Record<string, unknown> || {}),
  };
}

export function useChatHistory(): UseChatHistoryReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if Supabase is configured
  const isAvailable = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const loadSessions = useCallback(async (walletAddress: string) => {
    if (!isAvailable) return;
    setIsLoading(true);
    try {
      const data = await listSessions(walletAddress);
      setSessions(data);
    } catch (err) {
      console.warn('[ChatHistory] Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  const newSession = useCallback(async (walletAddress: string): Promise<string> => {
    if (!isAvailable) return `session-${Date.now()}`;
    try {
      const session = await getOrCreateSession(walletAddress);
      setActiveSessionId(session.id);
      setSessions((prev) => [session, ...prev]);
      return session.id;
    } catch (err) {
      console.warn('[ChatHistory] Failed to create session:', err);
      return `session-${Date.now()}`;
    }
  }, [isAvailable]);

  const switchSession = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    if (!isAvailable) return [];
    setIsLoading(true);
    try {
      setActiveSessionId(sessionId);
      const msgs = await loadMessages(sessionId);
      return msgs.map(toFrontendMessage);
    } catch (err) {
      console.warn('[ChatHistory] Failed to load messages:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  const persistMessage = useCallback(async (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!isAvailable) return;
    try {
      await saveMessage(sessionId, role, content, metadata);
    } catch (err) {
      console.warn('[ChatHistory] Failed to save message:', err);
    }
  }, [isAvailable]);

  const removeSession = useCallback(async (sessionId: string) => {
    if (!isAvailable) return;
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch (err) {
      console.warn('[ChatHistory] Failed to delete session:', err);
    }
  }, [isAvailable, activeSessionId]);

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    if (!isAvailable) return;
    try {
      await updateSessionTitle(sessionId, title);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      );
    } catch (err) {
      console.warn('[ChatHistory] Failed to rename session:', err);
    }
  }, [isAvailable]);

  return {
    sessions,
    activeSessionId,
    isAvailable,
    isLoading,
    loadSessions,
    newSession,
    switchSession,
    persistMessage,
    removeSession,
    renameSession,
  };
}
