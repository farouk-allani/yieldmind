import { NextResponse } from 'next/server';
import { agentRuntime, parseIntent, getRuntimeError } from '@/lib/runtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const sid = sessionId || `session-${Date.now()}`;

    if (!agentRuntime) {
      return NextResponse.json(
        {
          error: `Agent runtime not initialized: ${getRuntimeError() || 'Check Hedera credentials in .env'}`,
        },
        { status: 503 }
      );
    }

    const intent = await parseIntent(message, sid);
    const response = await agentRuntime.coordinator.processIntent(intent);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /chat] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process chat message',
      },
      { status: 500 }
    );
  }
}
