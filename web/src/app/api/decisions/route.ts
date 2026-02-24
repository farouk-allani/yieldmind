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

    const decisions = agentRuntime.coordinator.getDecisionHistory();

    return NextResponse.json({ decisions });
  } catch (error) {
    console.error('[API /decisions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
