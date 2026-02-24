import { NextResponse } from 'next/server';
import { agentRuntime, getRuntimeError } from '@/lib/runtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!agentRuntime) {
      return NextResponse.json(
        {
          error: `Agent runtime not initialized: ${getRuntimeError() || 'Check Hedera credentials in .env'}`,
        },
        { status: 503 }
      );
    }

    // Retrieve the last proposed strategy from the coordinator
    const strategy = agentRuntime.coordinator.getLastStrategy();

    if (!strategy) {
      return NextResponse.json(
        {
          error:
            'No strategy found. Send a chat message first to generate a strategy.',
        },
        { status: 404 }
      );
    }

    const response = await agentRuntime.coordinator.executeStrategy(
      strategy,
      sessionId
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /execute] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to execute strategy',
      },
      { status: 500 }
    );
  }
}
