import { HederaClient } from './hedera/client.js';
import { HCSService } from './hedera/hcs.js';
import { BonzoVaultClient } from './bonzo/vault-client.js';
import { BonzoLendingPoolClient } from './bonzo/lending-pool-client.js';
import { ScoutAgent } from './agents/scout.js';
import { StrategistAgent } from './agents/strategist.js';
import { ExecutorAgent } from './agents/executor.js';
import { SentinelAgent } from './agents/sentinel.js';
import { AgentCoordinator } from './core/agent-coordinator.js';
import { LLMClient } from './core/llm-client.js';
import { getNetworkConfig } from './config/index.js';
import type { UserIntent } from './types/index.js';

/**
 * YieldMind Agent Runtime
 *
 * Initializes the Hedera connection, LLM client, and all 4 agents,
 * then exposes the AgentCoordinator for the web API to use.
 */
export function createRuntime() {
  // Core Hedera infrastructure
  const hederaClient = new HederaClient();
  const hcsService = new HCSService(hederaClient);

  // LLM client for intent parsing (optional — degrades to keyword parser)
  let llmClient: LLMClient | null = null;
  try {
    llmClient = new LLMClient();
    console.log(
      `   LLM: ${process.env.LLM_MODEL || 'qwen/qwen3-235b-a22b:free'} via OpenRouter`
    );
  } catch {
    console.log(
      '   LLM: Not configured — using keyword-based intent parsing'
    );
  }

  // Bonzo vault data client (reads real mainnet data for strategy building)
  const bonzoClient = new BonzoVaultClient();
  // Bonzo LendingPool client (for real deposits on the configured network)
  const bonzoLendingPool = new BonzoLendingPoolClient();

  // Initialize agents with dependency injection
  const scout = new ScoutAgent(hcsService, bonzoClient);
  const strategist = new StrategistAgent(hcsService, llmClient);
  const executor = new ExecutorAgent(hcsService, hederaClient, bonzoLendingPool);
  const sentinel = new SentinelAgent(hcsService);

  // Wire up the coordinator
  const coordinator = new AgentCoordinator({
    hcsService,
    hederaClient,
    scout,
    strategist,
    executor,
    sentinel,
  });

  const networkConfig = getNetworkConfig();
  console.log('YieldMind Agent Runtime initialized');
  console.log(`   Hedera Account: ${hederaClient.getAccountId()}`);
  console.log(`   Network: ${networkConfig.chainName}`);
  console.log(`   Bonzo LendingPool: ${bonzoLendingPool.isAvailable() ? `Connected (${networkConfig.bonzo.lendingPoolAddress})` : 'Unavailable (fallback mode)'}`);
  console.log('   Agents: Scout, Strategist, Executor, Sentinel');

  return {
    coordinator,
    hederaClient,
    hcsService,
    llmClient,
    agents: { scout, strategist, executor, sentinel },
  };
}

// System prompt for LLM-powered intent parsing
const INTENT_PARSER_PROMPT = `You are YieldMind's intent parser. Extract structured yield intent from the user's message.

First determine if the message is a DeFi yield intent (wanting to deposit, invest, earn yield, etc.) or a general question (asking about features, status, help, listing info, etc.).

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "isYieldIntent": true | false,
  "riskTolerance": "conservative" | "moderate" | "aggressive",
  "targetAmount": <number>,
  "tokenSymbol": "HBAR" | "USDC" | "USDT",
  "preferences": ["stable-pairs" | "high-apy" | "diversified"]
}

Rules:
- If the user is asking a question, listing info, asking for help, or not expressing a desire to invest/deposit/earn yield -> isYieldIntent: false
- "safe", "low risk", "stable", "conservative" -> conservative
- "balanced", "moderate", "medium" -> moderate
- "aggressive", "max", "high yield", "risky", "yolo" -> aggressive
- Default: moderate risk, 100 HBAR, no preferences
- Extract the numeric amount and token from the message`;

/**
 * Check if a message looks like a yield/DeFi intent using keyword heuristics.
 * Returns false for general questions, help requests, etc.
 */
export function isLikelyYieldIntent(message: string): boolean {
  const lower = message.toLowerCase();

  // Positive signals — user wants to deposit/invest/earn
  const yieldKeywords = [
    'yield', 'deposit', 'invest', 'earn', 'apy', 'stake',
    'supply', 'lend', 'put', 'allocate', 'want',
    'hbar', 'usdc', 'usdt', 'safe', 'aggressive', 'conservative',
    'moderate', 'low risk', 'high yield', 'diversi',
  ];

  // Negative signals — user is asking questions or browsing
  const questionKeywords = [
    'list', 'show', 'what is', 'what are', 'how do', 'how does',
    'explain', 'help', 'tell me about', 'describe', 'status',
    'history', 'who', 'where', 'when', 'why', 'can you',
    'what can', 'features', 'options', 'available',
  ];

  const hasYieldKeyword = yieldKeywords.some((kw) => lower.includes(kw));
  const hasQuestionKeyword = questionKeywords.some((kw) => lower.includes(kw));

  // Must have at least one yield keyword and NOT be purely a question
  // Exception: if it has both (e.g., "I want safe yield"), yield wins
  if (hasYieldKeyword && !hasQuestionKeyword) return true;
  if (hasYieldKeyword && hasQuestionKeyword) {
    // If it contains amount + yield keyword, it's likely a yield intent
    const hasAmount = /\d+/.test(lower);
    if (hasAmount) return true;
    // "I want" + yield keyword = yield intent
    if (lower.includes('want') || lower.includes('earn') || lower.includes('deposit')) return true;
    return false;
  }

  return false;
}

/**
 * Parse user intent using LLM (OpenRouter) with keyword fallback.
 * Returns null if the message is not a yield intent (general question).
 */
export async function parseUserIntentWithLLM(
  message: string,
  sessionId: string,
  llmClient: LLMClient | null
): Promise<UserIntent | null> {
  if (llmClient) {
    try {
      const response = await llmClient.chat([
        { role: 'system', content: INTENT_PARSER_PROMPT },
        { role: 'user', content: message },
      ]);

      let content = response.content.trim();
      if (content.startsWith('```')) {
        content = content
          .replace(/^```(?:json)?\n?/, '')
          .replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(content) as {
        isYieldIntent?: boolean;
        riskTolerance?: string;
        targetAmount?: number;
        tokenSymbol?: string;
        preferences?: string[];
      };

      // If LLM says it's not a yield intent, return null
      if (parsed.isYieldIntent === false) {
        console.log('[Intent] LLM classified as non-yield query');
        return null;
      }

      const validRisks = ['conservative', 'moderate', 'aggressive'];
      const riskTolerance = validRisks.includes(parsed.riskTolerance || '')
        ? (parsed.riskTolerance as UserIntent['riskTolerance'])
        : 'moderate';

      console.log(
        `[Intent] LLM parsed: ${riskTolerance} risk, ${parsed.targetAmount || 100} ${parsed.tokenSymbol || 'HBAR'}`
      );

      return {
        rawMessage: message,
        riskTolerance,
        targetAmount: parsed.targetAmount || 100,
        tokenSymbol: parsed.tokenSymbol || 'HBAR',
        preferences: parsed.preferences || [],
        sessionId,
      };
    } catch (error) {
      console.log(
        '[Intent] LLM parsing failed, falling back to keyword parser:',
        error instanceof Error ? error.message : error
      );
    }
  }

  return parseUserIntent(message, sessionId);
}

/**
 * Keyword-based intent parser (reliable fallback).
 * Returns null if the message doesn't look like a yield intent.
 */
export function parseUserIntent(
  message: string,
  sessionId: string
): UserIntent | null {
  // First check if this is actually a yield intent
  if (!isLikelyYieldIntent(message)) {
    console.log('[Intent] Keyword parser: not a yield intent');
    return null;
  }

  const lower = message.toLowerCase();

  let riskTolerance: UserIntent['riskTolerance'] = 'moderate';
  if (
    lower.includes('safe') ||
    lower.includes('low risk') ||
    lower.includes('conservative') ||
    lower.includes('stable')
  ) {
    riskTolerance = 'conservative';
  } else if (
    lower.includes('aggressive') ||
    lower.includes('max') ||
    lower.includes('high yield') ||
    lower.includes('risky')
  ) {
    riskTolerance = 'aggressive';
  }

  const amountMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hbar|usdc|usdt)?/);
  const targetAmount = amountMatch ? parseFloat(amountMatch[1]) : 100;

  let tokenSymbol = 'HBAR';
  if (lower.includes('usdc')) tokenSymbol = 'USDC';
  else if (lower.includes('usdt')) tokenSymbol = 'USDT';

  const preferences: string[] = [];
  if (lower.includes('stable')) preferences.push('stable-pairs');
  if (lower.includes('high yield')) preferences.push('high-apy');
  if (lower.includes('diversi')) preferences.push('diversified');

  return {
    rawMessage: message,
    riskTolerance,
    targetAmount,
    tokenSymbol,
    preferences,
    sessionId,
  };
}

// Re-export everything the web layer needs
export type {
  UserIntent,
  Strategy,
  ChatResponse,
  DecisionLog,
  AgentState,
  VaultInfo,
} from './types/index.js';
export { AgentCoordinator } from './core/agent-coordinator.js';
export { LLMClient } from './core/llm-client.js';
