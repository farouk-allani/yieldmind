import { NextResponse } from 'next/server';
import { getMockDecisions } from '@/lib/mock-data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') ?? '';

    // TODO: When agent backend is available, replace with:
    //   const runtime = getRuntime();
    //   const decisions = runtime.coordinator.getDecisionHistory();

    const decisions = getMockDecisions(sessionId);

    return NextResponse.json({ decisions });
  } catch (error) {
    console.error('[API /decisions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
