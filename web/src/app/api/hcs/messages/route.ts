import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/hcs/messages?topicId=0.0.xxxxx
 *
 * Fetches HCS messages for a given topic from the Hedera Mirror Node.
 * Returns decoded JSON payloads for the decision trail viewer.
 */
export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');

  if (!topicId || !/^\d+\.\d+\.\d+$/.test(topicId)) {
    return NextResponse.json(
      { error: 'Valid topicId required (e.g., 0.0.12345)' },
      { status: 400 }
    );
  }

  // Use testnet mirror node (HCS is on testnet in split-network mode)
  const mirrorNodeUrl =
    process.env.HEDERA_NETWORK === 'mainnet'
      ? 'https://mainnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

  try {
    const res = await fetch(
      `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages?limit=50&order=desc`,
      { next: { revalidate: 10 } } // cache for 10s
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Mirror Node returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      messages?: Array<{
        sequence_number: number;
        consensus_timestamp: string;
        message: string; // base64 encoded
      }>;
    };

    // Decode base64 messages and parse JSON payloads
    const messages = (data.messages || []).map((msg) => {
      let decoded: Record<string, unknown> = {};
      try {
        const raw = Buffer.from(msg.message, 'base64').toString('utf-8');
        decoded = JSON.parse(raw);
      } catch {
        decoded = { raw: Buffer.from(msg.message, 'base64').toString('utf-8') };
      }

      return {
        sequenceNumber: msg.sequence_number,
        timestamp: msg.consensus_timestamp,
        payload: decoded,
      };
    });

    return NextResponse.json({
      topicId,
      messageCount: messages.length,
      messages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch HCS messages' },
      { status: 500 }
    );
  }
}
