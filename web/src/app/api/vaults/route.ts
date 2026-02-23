import { NextResponse } from 'next/server';
import { MOCK_VAULTS } from '@/lib/mock-data';

export async function GET() {
  try {
    // TODO: When agent backend is available, replace with:
    //   const runtime = getRuntime();
    //   const vaults = await runtime.agents.scout.fetchVaults();

    return NextResponse.json({
      vaults: MOCK_VAULTS,
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
