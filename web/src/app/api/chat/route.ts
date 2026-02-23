import { NextResponse } from 'next/server';
import { createMockChatResponse } from '@/lib/mock-data';

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

    // TODO: When agent backend is available, replace with:
    //   const runtime = getRuntime();
    //   const intent = parseUserIntent(message, sid);
    //   const response = await runtime.coordinator.processIntent(intent);

    const response = createMockChatResponse(message, sid);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
