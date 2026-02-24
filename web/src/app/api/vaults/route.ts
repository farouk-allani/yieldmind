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

    // Use the Scout agent to fetch real vault data
    const scoutDecision = await agentRuntime.agents.scout.execute({
      riskTolerance: 'moderate',
      tokenSymbol: 'HBAR',
    });

    const vaults = scoutDecision.data.topVaults || [];

    return NextResponse.json({
      vaults,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API /vaults] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults' },
      { status: 500 }
    );
  }
}
