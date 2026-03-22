/**
 * GET /api/keeper/status — Keeper loop status
 *
 * The keeper loop monitors Bonzo Vaults and autonomously executes harvests.
 * Harvests are communal operations — they benefit all depositors, no user signature needed.
 * This is the truly autonomous part of the Agent Kit integration.
 *
 * POST /api/keeper/status — Start/stop the keeper loop
 * Body: { action: 'start' | 'stop' | 'run-once' }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { agentRuntime } from '@/lib/runtime';

export async function GET() {
  if (!agentRuntime) {
    return NextResponse.json(
      { error: 'Agent runtime not initialized' },
      { status: 503 }
    );
  }

  const { keeperLoop } = agentRuntime;

  if (!keeperLoop) {
    return NextResponse.json({
      available: false,
      message:
        'Keeper loop not configured. Set HEDERA_MAINNET_ACCOUNT_ID, HEDERA_MAINNET_PRIVATE_KEY, and OPENROUTER_API_KEY.',
    });
  }

  return NextResponse.json({
    available: true,
    ...keeperLoop.getState(),
  });
}

export async function POST(request: NextRequest) {
  if (!agentRuntime) {
    return NextResponse.json(
      { error: 'Agent runtime not initialized' },
      { status: 503 }
    );
  }

  const { keeperLoop } = agentRuntime;

  if (!keeperLoop) {
    return NextResponse.json(
      {
        error:
          'Keeper loop not configured. Set HEDERA_MAINNET_ACCOUNT_ID, HEDERA_MAINNET_PRIVATE_KEY, and OPENROUTER_API_KEY.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { action?: string };

    switch (body.action) {
      case 'start':
        keeperLoop.start();
        return NextResponse.json({
          message: 'Keeper loop started',
          ...keeperLoop.getState(),
        });

      case 'stop':
        keeperLoop.stop();
        return NextResponse.json({
          message: 'Keeper loop stopped',
          ...keeperLoop.getState(),
        });

      case 'run-once':
        const result = await keeperLoop.runOnce();
        return NextResponse.json({
          message: 'Keeper analysis completed',
          ...result,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or run-once' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API/keeper/status] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to control keeper loop',
      },
      { status: 500 }
    );
  }
}
