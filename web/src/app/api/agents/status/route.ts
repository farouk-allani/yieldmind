import { NextResponse } from 'next/server';
import { createMockAgentStates } from '@/lib/mock-data';

export async function GET() {
  try {
    // TODO: When agent backend is available, replace with:
    //   const runtime = getRuntime();
    //   const agents = runtime.coordinator.getAgentStates();

    const agents = createMockAgentStates();

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[API /agents/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent status' },
      { status: 500 }
    );
  }
}
