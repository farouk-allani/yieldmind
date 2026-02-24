import { NextResponse } from 'next/server';
import { agentRuntime, getRuntimeError } from '@/lib/runtime';

export async function GET() {
  try {
    if (!agentRuntime) {
      return NextResponse.json(
        {
          error: `Agent runtime not initialized: ${getRuntimeError() || 'Check Hedera credentials in .env'}`,
        },
        { status: 503 }
      );
    }

    const agents = agentRuntime.coordinator.getAgentStates();

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[API /agents/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent status' },
      { status: 500 }
    );
  }
}
