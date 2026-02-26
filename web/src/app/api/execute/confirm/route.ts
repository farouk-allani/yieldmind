import { NextResponse } from 'next/server';
import { agentRuntime, getRuntimeError } from '@/lib/runtime';

/**
 * POST /api/execute/confirm
 *
 * Called by the frontend after a user signs a deposit in MetaMask.
 * Verifies the transaction via Mirror Node, then publishes to HCS.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txHash, userAddress, depositAmount, tokenSymbol, sessionId } = body;

    if (!txHash || !userAddress || !sessionId) {
      return NextResponse.json(
        { error: 'txHash, userAddress, and sessionId are required' },
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

    const response = await agentRuntime.coordinator.confirmExecution({
      txHash,
      userAddress,
      depositAmount: depositAmount || 0,
      tokenSymbol: tokenSymbol || 'HBAR',
      sessionId,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /execute/confirm] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to confirm execution',
      },
      { status: 500 }
    );
  }
}
