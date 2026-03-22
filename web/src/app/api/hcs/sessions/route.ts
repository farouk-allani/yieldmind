import { NextResponse } from 'next/server';
import { getSessionsWithTopics } from '@/lib/supabase';
import { agentRuntime } from '@/lib/runtime';

/**
 * GET /api/hcs/sessions
 *
 * Returns all sessions with HCS topic IDs.
 * Primary source: Supabase (persisted across restarts).
 * Fallback: in-memory coordinator (current session only).
 */
export async function GET() {
  const network = process.env.HEDERA_NETWORK || 'testnet';

  try {
    // Get keeper's HCS topic (from loop state or env var)
    const keeperTopicId =
      agentRuntime?.keeperLoop?.getState()?.hcsTopicId ||
      process.env.HCS_GLOBAL_TOPIC_ID ||
      null;

    // Primary: query Supabase for persisted sessions with topics
    const dbSessions = await getSessionsWithTopics();

    const sessions: Array<{
      sessionId: string;
      topicId: string;
      title: string;
      walletAddress: string;
      createdAt: string;
      hashscanUrl: string;
    }> = [];

    // Prepend keeper topic if available
    if (keeperTopicId) {
      sessions.push({
        sessionId: 'keeper-global',
        topicId: keeperTopicId,
        title: 'Keeper Agent (Global)',
        walletAddress: '',
        createdAt: '',
        hashscanUrl: `https://hashscan.io/${network}/topic/${keeperTopicId}`,
      });
    }

    if (dbSessions.length > 0) {
      for (const s of dbSessions) {
        sessions.push({
          sessionId: s.id,
          topicId: s.hcs_topic_id!,
          title: s.title,
          walletAddress: s.wallet_address,
          createdAt: s.created_at,
          hashscanUrl: `https://hashscan.io/${network}/topic/${s.hcs_topic_id}`,
        });
      }
    } else if (agentRuntime) {
      // Fallback: in-memory coordinator (for sessions not yet persisted)
      const memorySessions = agentRuntime.coordinator.getAllSessions();
      for (const s of memorySessions) {
        sessions.push({
          sessionId: s.sessionId,
          topicId: s.topicId,
          title: '',
          walletAddress: '',
          createdAt: '',
          hashscanUrl: `https://hashscan.io/${network}/topic/${s.topicId}`,
        });
      }
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
