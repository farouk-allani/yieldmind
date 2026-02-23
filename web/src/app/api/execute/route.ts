import { NextResponse } from 'next/server';
import { createMockExecuteResponse } from '@/lib/mock-data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { strategyId, sessionId } = body;

    if (!strategyId || !sessionId) {
      return NextResponse.json(
        { error: 'strategyId and sessionId are required' },
        { status: 400 }
      );
    }

    // TODO: When agent backend is available, replace with:
    //   const runtime = getRuntime();
    //   const response = await runtime.coordinator.executeStrategy(strategy, sessionId);

    const response = createMockExecuteResponse(sessionId);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /execute] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute strategy' },
      { status: 500 }
    );
  }
}
