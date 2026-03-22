import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { agentRuntime, parseIntent, getRuntimeError } from '@/lib/runtime';
import { saveSessionTopicId } from '@/lib/supabase';

/**
 * POST /api/chat
 *
 * Chat endpoint with two intelligence levels:
 * - Standard: Scout → Strategist pipeline (fast, rule-based)
 * - Enhanced (Agent Kit): Keeper agent adds volatility + sentiment analysis (smarter)
 *
 * In BOTH modes, the user signs deposits with their own wallet.
 * The Agent Kit provides intelligence, NOT fund custody.
 *
 * Body: { message, sessionId, autonomous?, stream? }
 */

// OpenRouter provider via Vercel AI SDK
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

/**
 * General-purpose responses for non-yield queries.
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
      '- Analyze Bonzo Finance lending reserves and vaults in real-time',
      '- Execute deposits autonomously via Hedera Agent Kit',
      '- Monitor your positions with the Sentinel agent',
      '- Make intelligent harvest decisions using volatility + sentiment analysis',
      '',
      '**Try saying:**',
      '- "I want safe yield on 100 HBAR"',
      '- "Aggressive strategy for 500 HBAR"',
      '- "Conservative yield on USDC"',
      '',
      '**Modes:**',
      '- **Standard**: Scout + Strategist pick the best vault',
      '- **Enhanced**: Adds volatility + sentiment analysis via Hedera Agent Kit (toggle in chat header)',
      '',
      'In both modes, **you sign deposits with your own wallet**. Your funds, your keys.',
      '',
      '**Other commands:**',
      '- Ask about withdrawals, monitoring, or where your funds are',
      '- Visit the Portfolio page for position details',
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

const YIELDMIND_SYSTEM_PROMPT = `You are YieldMind, an intelligent DeFi yield advisor on Hedera.
You help users earn yield on their crypto through Bonzo Finance vaults.

Key facts:
- You use Hedera Agent Kit for market intelligence (volatility, sentiment analysis)
- Users always sign deposits with their own wallet — you never hold user funds
- Every decision is logged to HCS (Hedera Consensus Service) for transparency
- You support Bonzo Lend (lending pools) and Bonzo Vaults (auto-compounding DEX vaults)
- Keeper agent monitors positions and executes harvests autonomously
- Supported tokens: HBAR, USDC, SAUCE, BONZO, HBARX, and more

When users want yield, guide them to express their intent clearly:
amount + token + risk preference (e.g., "I want safe yield on 100 HBAR")

Be concise, data-driven, and transparent about risks.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId, autonomous, stream } = body;

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

    // ── Streaming mode (Vercel AI SDK) ──
    // Used for general queries and autonomous execution
    if (stream && !intent) {
      // General query — stream via Vercel AI SDK
      const result = streamText({
        model: openrouter(process.env.LLM_MODEL || 'qwen/qwen3-32b:free'),
        system: YIELDMIND_SYSTEM_PROMPT,
        prompt: message,
        temperature: 0.3,
      });

      return result.toTextStreamResponse();
    }

    if (!intent) {
      // Non-streaming general query
      return NextResponse.json({
        message: handleGeneralQuery(message),
        agentStates: agentRuntime.coordinator.getAgentStates(),
        decisions: [],
      });
    }

    // ── Enhanced mode (Agent Kit): Add volatility + sentiment intelligence ──
    // Runs keeper service analysis (volatility + sentiment) in parallel with
    // the standard Scout → Strategist pipeline. No LLM agent loop — direct
    // service calls for reliability and speed.
    if (autonomous && agentRuntime.keeperService) {
      try {
        const token = intent.tokenSymbol.toUpperCase();
        // Run market analysis in parallel with standard pipeline
        const [volatility, sentiment, standardResponse] = await Promise.all([
          agentRuntime.keeperService.getVolatility(token).catch(() => null),
          agentRuntime.keeperService.getSentiment(token).catch(() => null),
          agentRuntime.coordinator.processIntent(intent),
        ]);

        // Build market intelligence summary
        const insights: string[] = [];
        if (volatility) {
          const level = volatility.realizedVol24h > 60 ? 'High' : volatility.realizedVol24h > 30 ? 'Moderate' : 'Low';
          insights.push(`**Volatility:** ${level} (${volatility.realizedVol24h.toFixed(1)}% 24h, ${volatility.realizedVol7d.toFixed(1)}% 7d)`);
          insights.push(`**Price:** $${volatility.currentPrice.toFixed(4)} (${volatility.priceChange24h >= 0 ? '+' : ''}${volatility.priceChange24h.toFixed(2)}% 24h)`);
        }
        if (sentiment) {
          const label = sentiment.sentiment === 'bullish' ? 'Bullish' : sentiment.sentiment === 'bearish' ? 'Bearish' : 'Neutral';
          insights.push(`**Sentiment:** ${label} (${(sentiment.confidence * 100).toFixed(0)}% confidence)`);
          if (sentiment.reasoning) {
            insights.push(`**Analysis:** ${sentiment.reasoning}`);
          }
        }

        // Persist HCS topic for enhanced mode too
        const enhancedTopicId = agentRuntime.coordinator.getSessionTopicId(sid);
        if (enhancedTopicId) {
          saveSessionTopicId(sid, enhancedTopicId).catch((err) =>
            console.warn('[API /chat] Failed to persist HCS topic:', err)
          );
        }

        if (insights.length > 0) {
          const analysis = '\n\n**Agent Kit Market Analysis:**\n' + insights.join('\n');
          return NextResponse.json({
            ...standardResponse,
            message: standardResponse.message + analysis,
            mode: 'enhanced',
            hcsTopicId: enhancedTopicId,
          });
        }

        return NextResponse.json({ ...standardResponse, hcsTopicId: enhancedTopicId });
      } catch {
        console.log('[API /chat] Enhanced analysis failed, using standard pipeline...');
      }
    }

    // ── Standard mode: Scout → Strategist → user approves & signs ──
    const response = await agentRuntime.coordinator.processIntent(intent);

    // Include the HCS topic ID so frontend can link to the decision trail
    const hcsTopicId = agentRuntime.coordinator.getSessionTopicId(sid);

    // Persist HCS topic ID to Supabase so it survives server restarts
    if (hcsTopicId) {
      saveSessionTopicId(sid, hcsTopicId).catch((err) =>
        console.warn('[API /chat] Failed to persist HCS topic:', err)
      );
    }

    return NextResponse.json({
      ...response,
      hcsTopicId,
    });
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
