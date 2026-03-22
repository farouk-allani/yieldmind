import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  wallet_address: string;
  title: string;
  hcs_topic_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Agent decisions attached to this message (for assistant messages) */
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Chat History API ─────────────────────────────────────────────

/**
 * Get or create a chat session for a wallet address.
 * If sessionId is provided, returns that session.
 * Otherwise creates a new one.
 */
export async function getOrCreateSession(
  walletAddress: string,
  sessionId?: string
): Promise<ChatSession> {
  if (sessionId) {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (data) return data as ChatSession;
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      wallet_address: walletAddress,
      title: 'New conversation',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data as ChatSession;
}

/**
 * List all chat sessions for a wallet, newest first.
 */
export async function listSessions(walletAddress: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return (data || []) as ChatSession[];
}

/**
 * Save a message to a chat session.
 */
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata: metadata || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Update session timestamp and title (use first user message as title)
  if (role === 'user') {
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    // Set title from first user message (truncated)
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user');
    if (count !== null && count <= 1) {
      updates.title = content.length > 60 ? content.slice(0, 57) + '...' : content;
    }
    await supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId);
  }

  return data as ChatMessage;
}

/**
 * Load all messages for a session, ordered chronologically.
 */
export async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data || []) as ChatMessage[];
}

/**
 * Delete a chat session and all its messages.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from('chat_messages').delete().eq('session_id', sessionId);
  await supabase.from('chat_sessions').delete().eq('id', sessionId);
}

/**
 * Update session title.
 */
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId);
}

// ── HCS Topic Persistence ───────────────────────────────────

/**
 * Save HCS topic ID for a chat session.
 */
export async function saveSessionTopicId(sessionId: string, hcsTopicId: string): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ hcs_topic_id: hcsTopicId })
    .eq('id', sessionId);
}

/**
 * Get all sessions that have an HCS topic ID (for the HCS viewer page).
 */
export async function getSessionsWithTopics(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .not('hcs_topic_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch HCS sessions: ${error.message}`);
  return (data || []) as ChatSession[];
}
