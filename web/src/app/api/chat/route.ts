import { NextResponse } from 'next/server';
import { agentRuntime, parseIntent, getRuntimeError } from '@/lib/runtime';

/**
 * General-purpose responses for non-yield queries.
 * When the user asks a question rather than expressing a yield intent,
 * we respond helpfully without triggering the agent pipeline.
 */
function handleGeneralQuery(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('strateg') && (lower.includes('list') || lower.includes('show') || lower.includes('existing'))) {
    return [
      'YieldMind builds strategies on-demand based on your intent. There are no pre-made strategies — each one is custom-built by the AI agents.',
      '',
      '**How it works:**',
      '1. Tell me your yield intent (e.g., "I want safe yield on 100 HBAR")',
      '2. Scout agent scans Bonzo Finance lending reserves in real-time',
      '3. Strategist agent builds an optimal allocation based on your risk tolerance',
      '4. You review and approve the strategy before any funds move',
      '',
      'Try: "I want conservative yield on 50 HBAR" or "Aggressive strategy for 200 HBAR"',
    ].join('\n');
  }

  if (lower.includes('withdraw') || lower.includes('get my money')) {
    return [
      'To withdraw your funds:',
      '',
      '1. Go to the **Portfolio** page (top-right nav)',
      '2. Click the **Withdraw** button',
      '3. Enter the amount and sign with MetaMask',
      '',
      'You can also use **Emergency Withdraw** to pull all funds at once.',
    ].join('\n');
  }

  if (lower.includes('sentinel') || lower.includes('monitor')) {
    return [
      'The **Sentinel Agent** is YieldMind\'s watchdog:',
      '',
      '- Monitors token prices via CoinGecko in real-time',
      '- Triggers **warning alerts** when prices move >8%',
      '- Triggers **critical alerts** when prices move >15%',
      '- Recommends emergency exits on critical price drops',
      '- All alerts are logged to HCS (Hedera Consensus Service)',
      '',
      'You can see Sentinel alerts in the **Decision Trail** panel on the right side of this page.',
    ].join('\n');
  }

  if ((lower.includes('where') && lower.includes('money')) || (lower.includes('bonzo') && lower.includes('what'))) {
    return [
      '**Where your funds go:**',
      '',
      'Your deposits go into **Bonzo Finance** products on Hedera:',
      '- **Bonzo Lend**: Lending pools with stable supply APY',
      '- **Bonzo Vaults**: Auto-compounding concentrated liquidity vaults on SaucerSwap V2 with higher APY',
      '',
      'Every deposit is a real on-chain transaction — verifiable on HashScan.',
      'Strategy tracking and agent decisions are logged transparently to HCS.',
      '',
      'View your position details on the **Portfolio** page.',
    ].join('\n');
  }

  if (lower.includes('help') || lower.includes('what can') || lower.includes('how do')) {
    return [
      'Welcome to **YieldMind** — autonomous DeFi intelligence on Hedera.',
      '',
      '**What I can do:**',
      '- Build custom yield strategies based on your risk tolerance',
      '- Scan Bonzo Finance lending pools AND auto-compounding vaults in real-time',
      '- Execute deposits via your MetaMask wallet',
      '- Monitor your positions with the Sentinel agent (24/7 price alerts)',
      '- Run intelligent keeper analysis to optimize harvest timing',
      '',
      '**Try saying:**',
      '- "I want safe yield on 100 HBAR"',
      '- "Aggressive strategy for 500 HBAR"',
      '- "Conservative yield on USDC"',
      '- "Best APY for HBAR right now"',
      '',
      '**Other commands:**',
      '- Ask about withdrawals, monitoring, or where your funds are',
      '- Visit the Portfolio page for position details and keeper analysis',
    ].join('\n');
  }

  if (
    (lower.includes('best') && (lower.includes('apy') || lower.includes('yield') || lower.includes('rate'))) ||
    (lower.includes('current') && lower.includes('apy'))
  ) {
    return [
      'YieldMind scans live APY data from both **Bonzo Lend** and **Bonzo Vaults** on Hedera.',
      '',
      '**Product types available:**',
      '- **Bonzo Lend** — Lending pools with stable, low-risk supply APY (2–12% typical)',
      '- **Bonzo Vaults** — Auto-compounding concentrated liquidity vaults (higher APY, more volatile)',
      '',
      'To see live rates, just tell me your intent and I\'ll run a full scan:',
      '- "Best APY on 100 HBAR" → Scout scans all available pools',
      '- "Safe yield on USDC" → Filter for low-risk stablecoin pools',
      '- "Max yield, any risk" → Scan all products sorted by APY',
      '',
      '**Live yields are also shown on the** [landing page](/) in the "Live Yields" section.',
    ].join('\n');
  }

  // Default for unrecognized queries
  return [
    'I can help you build yield strategies on Hedera using Bonzo Finance data.',
    '',
    'Tell me your yield intent to get started:',
    '- "I want safe yield on 100 HBAR"',
    '- "Aggressive strategy for 200 HBAR"',
    '- "Conservative yield on 50 USDC"',
    '',
    'Or ask me about: withdrawals, monitoring, strategy details, or how it works.',
  ].join('\n');
}

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

    // Parse intent — returns null if not a yield query
    const intent = await parseIntent(message, sid);

    if (!intent) {
      // Not a yield intent — respond with helpful info
      return NextResponse.json({
        message: handleGeneralQuery(message),
        agentStates: agentRuntime.coordinator.getAgentStates(),
        decisions: [],
      });
    }

    // It's a yield intent — run the full agent pipeline
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
