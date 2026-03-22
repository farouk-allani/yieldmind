import { HederaClient } from './hedera/client.js';
import { HCSService } from './hedera/hcs.js';
import { BonzoVaultClient } from './bonzo/vault-client.js';
import { BonzoVaultsClient } from './bonzo/bonzo-vaults-client.js';
import { BonzoLendingPoolClient } from './bonzo/lending-pool-client.js'; // read-only (getUserAccountData)
import { ScoutAgent } from './agents/scout.js';
import { StrategistAgent } from './agents/strategist.js';
import { ExecutorAgent } from './agents/executor.js';
import { SentinelAgent } from './agents/sentinel.js';
import { AgentCoordinator } from './core/agent-coordinator.js';
import { LLMClient } from './core/llm-client.js';
import { KeeperService } from './core/keeper-service.js';
import { createHederaToolkit } from './core/hedera-toolkit.js';
import { createKeeperAgent, createKeeperLoop } from './core/keeper-agent.js';
import type { KeeperLoopState } from './core/keeper-agent.js';
import { getNetworkConfig, getBonzoNetworkConfig } from './config/index.js';
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
      `   LLM: ${process.env.LLM_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free'} via OpenRouter`
    );
  } catch {
    console.log(
      '   LLM: Not configured — using keyword-based intent parsing'
    );
  }

  // Bonzo Lend data client (reads real mainnet data for lending reserves)
  const bonzoClient = new BonzoVaultClient();
  // Bonzo Vaults client (reads on-chain data for auto-compounding vaults)
  const bonzoVaultsClient = new BonzoVaultsClient();
  // Bonzo LendingPool client — read-only (getUserAccountData).
  // Actual deposits are user-signed via MetaMask on the frontend.
  const bonzoLendingPool = new BonzoLendingPoolClient();

  // Intelligent Keeper Service — the Bonzo bounty differentiator
  // Analyzes vault state + market volatility + news sentiment (RAG)
  // to make optimal harvest/rebalance timing decisions.
  const keeperService = new KeeperService(llmClient, bonzoVaultsClient);

  // Initialize agents with dependency injection
  const scout = new ScoutAgent(hcsService, bonzoClient, bonzoVaultsClient);
  const strategist = new StrategistAgent(hcsService, llmClient);
  const executor = new ExecutorAgent(hcsService, hederaClient);
  const sentinel = new SentinelAgent(hcsService);

  // Wire keeper into Sentinel for intelligent vault monitoring
  sentinel.setKeeperService(keeperService);

  // Wire up the coordinator
  const coordinator = new AgentCoordinator({
    hcsService,
    hederaClient,
    scout,
    strategist,
    executor,
    sentinel,
  });

  // ── Hedera Agent Kit (Bonzo bounty requirement) ──
  // Enables autonomous on-chain execution via the official Hedera Agent Kit
  let hederaToolkit: ReturnType<typeof createHederaToolkit> | null = null;
  let keeperAgent: ReturnType<typeof createKeeperAgent> | null = null;
  let keeperLoop: ReturnType<typeof createKeeperLoop> | null = null;

  const mainnetAccountId = process.env.HEDERA_MAINNET_ACCOUNT_ID;
  const mainnetPrivateKey = process.env.HEDERA_MAINNET_PRIVATE_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (mainnetAccountId && mainnetPrivateKey && openRouterKey) {
    try {
      hederaToolkit = createHederaToolkit({
        mainnetAccountId,
        mainnetPrivateKey,
        keeperService,
        bonzoLendClient: bonzoClient,
        bonzoVaultsClient,
      });

      keeperAgent = createKeeperAgent({
        toolkit: hederaToolkit,
        openRouterApiKey: openRouterKey,
        model: process.env.LLM_MODEL,
      });

      keeperLoop = createKeeperLoop({
        toolkit: hederaToolkit,
        openRouterApiKey: openRouterKey,
        model: process.env.LLM_MODEL,
        keeperService,
        hcsService,
        hcsTopicId: process.env.HCS_GLOBAL_TOPIC_ID || undefined,
        intervalMs: parseInt(process.env.KEEPER_INTERVAL_MS || '300000', 10),
      });

      // Auto-create keeper HCS topic if not configured
      if (!process.env.HCS_GLOBAL_TOPIC_ID) {
        hcsService.createTopic('YieldMind Keeper Agent — Decision Trail').then((topicId) => {
          console.log(`   Keeper HCS topic auto-created: ${topicId}`);
          // Update the keeper loop config with the new topic
          keeperLoop!.setHcsTopicId(topicId);
        }).catch((err) => {
          console.warn('   Failed to auto-create keeper HCS topic:', err);
        });
      }

      console.log('   Agent Kit: Hedera Agent Kit initialized (AUTONOMOUS mode, mainnet)');
      console.log(`   Keeper Agent: LangChain ReAct agent with ${hederaToolkit.getAllTools().length} tools`);
    } catch (error) {
      console.warn(
        '   Agent Kit: Failed to initialize —',
        error instanceof Error ? error.message : error
      );
    }
  } else {
    console.log(
      '   Agent Kit: Not configured (set HEDERA_MAINNET_ACCOUNT_ID, HEDERA_MAINNET_PRIVATE_KEY, OPENROUTER_API_KEY)'
    );
  }

  const hcsConfig = getNetworkConfig();
  const bonzoConfig = getBonzoNetworkConfig();
  console.log('YieldMind Agent Runtime initialized');
  console.log(`   Hedera Account: ${hederaClient.getAccountId()}`);
  console.log(`   HCS Network: ${hcsConfig.chainName} (topic creation & logging)`);
  console.log(`   Bonzo Network: ${bonzoConfig.chainName} (data, deposits, verification)`);
  console.log(`   Bonzo LendingPool: ${bonzoLendingPool.isAvailable() ? `Configured (${bonzoConfig.bonzo.lendingPoolAddress}) — deposits via user wallet` : 'Unavailable'}`);
  console.log('   Agents: Scout, Strategist, Executor, Sentinel');
  console.log('   Keeper: Intelligent harvest/rebalance (volatility + sentiment RAG)');

  return {
    coordinator,
    hederaClient,
    hcsService,
    llmClient,
    keeperService,
    agents: { scout, strategist, executor, sentinel },
    // Agent Kit (Bonzo bounty)
    hederaToolkit,
    keeperAgent,
    keeperLoop,
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
  "secondaryToken": null | "HBAR" | "USDC" | "USDT",
  "secondaryAmount": null | <number>,
  "preferences": ["stable-pairs" | "high-apy" | "diversified"]
}

Rules:
- If the user is asking a question, listing info, asking for help, or not expressing a desire to invest/deposit/earn yield -> isYieldIntent: false
- "safe", "low risk", "stable", "conservative" -> conservative
- "balanced", "moderate", "medium" -> moderate
- "aggressive", "max", "high yield", "risky", "yolo" -> aggressive
- Default: moderate risk, 100 HBAR, no preferences
- Extract the numeric amount and token from the message
- IMPORTANT: If the user mentions TWO tokens (e.g., "2 USDC and 20 HBAR", "both USDC and HBAR"), set secondaryToken and secondaryAmount. The primary token should be the first one mentioned, secondary is the second.
- If the user says "equivalent" or "matching" for the second token, set secondaryAmount to 0 (the system will calculate it)
- If only one token is mentioned, set secondaryToken and secondaryAmount to null`;

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
        secondaryToken?: string | null;
        secondaryAmount?: number | null;
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

      const hasDualToken = parsed.secondaryToken && parsed.secondaryToken !== parsed.tokenSymbol;
      console.log(
        `[Intent] LLM parsed: ${riskTolerance} risk, ${parsed.targetAmount || 100} ${parsed.tokenSymbol || 'HBAR'}` +
        (hasDualToken ? ` + ${parsed.secondaryAmount || '?'} ${parsed.secondaryToken} (dual-token)` : '')
      );

      return {
        rawMessage: message,
        riskTolerance,
        targetAmount: parsed.targetAmount || 100,
        tokenSymbol: parsed.tokenSymbol || 'HBAR',
        secondaryToken: hasDualToken ? (parsed.secondaryToken as string) : undefined,
        secondaryAmount: hasDualToken ? (parsed.secondaryAmount || 0) : undefined,
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
export { KeeperService } from './core/keeper-service.js';
export type { KeeperDecision, VolatilityData, SentimentData } from './core/keeper-service.js';
export type { KeeperLoopState } from './core/keeper-agent.js';
