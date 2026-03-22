/**
 * KeeperAgent — LangChain ReAct Agent powered by Hedera Agent Kit.
 *
 * This is the core Bonzo bounty deliverable: an Intelligent Keeper Agent that:
 * 1. Uses Hedera Agent Kit tools for on-chain execution (deposits, HCS, transfers)
 * 2. Uses custom tools for Bonzo-specific operations (vault scanning, deposit, harvest)
 * 3. Uses RAG tools for market intelligence (volatility, sentiment analysis)
 * 4. Makes autonomous decisions with human-readable reasoning
 * 5. Logs every decision to HCS for full transparency
 *
 * The agent combines all 3 bounty examples:
 * - Intent-based interface: parses natural language yield intents
 * - Sentiment-based harvesting: RAG pipeline for harvest timing
 * - Volatility-aware rebalancing: monitors volatility for risk management
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import type { HederaToolkitInstance } from './hedera-toolkit.js';
import type { KeeperService } from './keeper-service.js';

// ── Fallback model chain (same as LLMClient) ────────────────

const OPENROUTER_FALLBACK_MODELS = [
  'openrouter/hunter-alpha',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-3-4b-it:free',
];

// ── Types ─────────────────────────────────────────────────────

export interface KeeperAgentConfig {
  /** Hedera toolkit with all tools (built-in + custom) */
  toolkit: HederaToolkitInstance;
  /** OpenRouter API key for LLM */
  openRouterApiKey: string;
  /** LLM model to use */
  model?: string;
}

export interface KeeperAgentResult {
  output: string;
  intermediateSteps?: unknown[];
}

// ── System Prompt ─────────────────────────────────────────────

const KEEPER_SYSTEM_PROMPT = `You are YieldMind's Intelligent Keeper Agent for Bonzo Finance vaults on Hedera.

You are an AUTONOMOUS agent that makes intelligent decisions about DeFi vault operations.
You have access to the Hedera Agent Kit for on-chain execution and custom tools for market analysis.

## Your Capabilities
1. **Scan vaults**: Find optimal Bonzo Finance vaults (Bonzo Lend + Bonzo Vaults) based on APY, risk, and token
2. **Analyze volatility**: Check realized volatility for any token using CoinGecko data
3. **Analyze sentiment**: RAG-powered sentiment analysis using news, market data, and trending coins
4. **Deposit HBAR**: Execute deposits into Bonzo LendingPool via WETHGateway on behalf of users
5. **Harvest vaults**: Call harvest() on vault strategy contracts to compound rewards
6. **HCS logging**: Publish decisions to Hedera Consensus Service for transparency
7. **HBAR transfers**: Transfer HBAR between accounts

## Decision Framework
- When a user wants yield: scan vaults → pick best match → explain reasoning → execute deposit
- For keeper monitoring: analyze volatility + sentiment → decide harvest timing → execute or log
- **High volatility (>80% annualized)** → harvest immediately to protect reward value
- **Bearish sentiment (>60% confidence)** → harvest now, swap to stablecoins before price drops
- **Bullish sentiment (>60% confidence)** → delay harvest, let rewards appreciate
- **Low volatility + neutral sentiment** → let rewards compound, no action needed

## Critical Rules
1. ALWAYS explain your reasoning before taking action. This reasoning gets published to HCS.
2. NEVER execute a deposit without explicitly stating the amount, token, and destination vault.
3. ALWAYS check volatility and sentiment before recommending harvest timing.
4. When depositing on behalf of a user, confirm the amount and vault before executing.
5. After every on-chain action, log the decision to HCS with a submit_topic_message.

## Response Format
Be concise and data-driven. Include:
- What you analyzed (which data sources, what the numbers say)
- What you decided (which action, which vault, why)
- What you executed (tx hash, on-chain proof)
- What happens next (monitoring, next harvest check)`;

// ── Create Agent ──────────────────────────────────────────────

function createLLM(model: string, apiKey: string): ChatOpenAI {
  return new ChatOpenAI({
    modelName: model,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://yieldmind.app',
        'X-Title': 'YieldMind Protocol',
      },
    },
    temperature: 0.3,
    maxTokens: 1024,
  });
}

function buildExecutor(
  llm: ChatOpenAI,
  tools: any,
  memory: BufferMemory,
): AgentExecutor {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', KEEPER_SYSTEM_PROMPT],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = createToolCallingAgent({ llm, tools, prompt } as any);

  return new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
    maxIterations: 15,
    handleParsingErrors: true,
  });
}

export function createKeeperAgent(config: KeeperAgentConfig): {
  invoke: (input: string) => Promise<KeeperAgentResult>;
  executor: AgentExecutor;
} {
  const tools = config.toolkit.getAllTools() as any;

  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    inputKey: 'input',
    outputKey: 'output',
    returnMessages: true,
  });

  // Build model fallback list: configured model first, then fallbacks
  const primaryModel = config.model || 'qwen/qwen3-next-80b-a3b-instruct:free';
  const modelsToTry = [primaryModel, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  // Default executor uses primary model
  const primaryLLM = createLLM(primaryModel, config.openRouterApiKey);
  const executor = buildExecutor(primaryLLM, tools, memory);

  const invoke = async (input: string): Promise<KeeperAgentResult> => {
    // Try each model in the fallback chain until one succeeds
    for (const model of modelsToTry) {
      try {
        const llm = model === primaryModel
          ? primaryLLM
          : createLLM(model, config.openRouterApiKey);
        const exec = model === primaryModel
          ? executor
          : buildExecutor(llm, tools, memory);

        console.log(`[KeeperAgent] Trying model: ${model}`);
        const response = await exec.invoke({ input });
        return {
          output: response?.output ?? String(response),
          intermediateSteps: response?.intermediateSteps,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable = msg.includes('429') || msg.includes('503') || msg.includes('502') || msg.includes('404') || msg.includes('rate') || msg.includes('No endpoints');
        if (!isRetryable) {
          console.error(`[KeeperAgent] Non-retryable error with ${model}:`, msg);
          return { output: `Agent error: ${msg}` };
        }
        console.log(`[KeeperAgent] ${model} rate-limited (429), trying next model...`);
      }
    }

    return { output: 'All LLM models are rate-limited. Please try again in a few minutes.' };
  };

  console.log(
    `[KeeperAgent] Initialized with ${tools.length} tools, ` +
      `${modelsToTry.length} model fallbacks ` +
      `(Hedera Agent Kit + Bonzo custom tools)`
  );

  return { invoke, executor };
}

// ── Keeper Loop (Direct Service Calls — No LLM Agent Loop) ──
// Uses KeeperService.analyzeVaults() directly for reliable, fast analysis.
// Attempts on-chain harvest via Hedera SDK when analysis recommends it.
// No dependency on LLM for the loop itself — LLM is only used inside
// KeeperService for sentiment analysis (RAG).

export interface KeeperLoopConfig {
  toolkit: HederaToolkitInstance;
  openRouterApiKey: string;
  model?: string;
  /** KeeperService for vault analysis */
  keeperService: KeeperService;
  /** Interval in ms between keeper runs (default: 5 minutes) */
  intervalMs?: number;
}

export interface KeeperLoopState {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  totalHarvests: number;
  recentDecisions: Array<{
    vault: string;
    action: string;
    reasoning: string;
    timestamp: string;
  }>;
}

export function createKeeperLoop(config: KeeperLoopConfig): {
  start: () => void;
  stop: () => void;
  getState: () => KeeperLoopState;
  runOnce: () => Promise<KeeperLoopState>;
} {
  const intervalMs = config.intervalMs || 5 * 60 * 1000; // 5 minutes
  let timer: ReturnType<typeof setInterval> | null = null;

  const state: KeeperLoopState = {
    isRunning: false,
    lastRun: null,
    nextRun: null,
    totalRuns: 0,
    totalHarvests: 0,
    recentDecisions: [],
  };

  const runOnce = async (): Promise<KeeperLoopState> => {
    const startTime = new Date().toISOString();
    console.log(`[KeeperLoop] Running keeper analysis at ${startTime}...`);

    try {
      // Direct service call — no LLM agent loop, fast and reliable
      const decisions = await config.keeperService.analyzeVaults();

      state.lastRun = startTime;
      state.totalRuns++;

      for (const decision of decisions) {
        // If analysis recommends immediate harvest, attempt on-chain execution
        if (decision.action === 'harvest-now' && decision.vault.strategyAddress) {
          try {
            // Find the harvest tool from the toolkit
            const tools = config.toolkit.getAllTools();
            const harvestTool = tools.find((t: { name: string }) => t.name === 'harvest_bonzo_vault');
            if (harvestTool) {
              console.log(`[KeeperLoop] Attempting harvest on ${decision.vault.name}...`);
              const result = await (harvestTool as { invoke: (input: Record<string, string>) => Promise<string> }).invoke({
                strategyAddress: decision.vault.strategyAddress,
                vaultName: decision.vault.name,
                reasoning: decision.reasoning,
              });
              const parsed = JSON.parse(result);
              if (parsed.success) {
                state.totalHarvests++;
                console.log(`[KeeperLoop] Harvest succeeded: ${parsed.txHash}`);
              } else {
                console.log(`[KeeperLoop] Harvest logged (restricted): ${decision.vault.name}`);
              }
            }
          } catch (harvestErr) {
            console.warn(`[KeeperLoop] Harvest attempt failed for ${decision.vault.name}:`, harvestErr);
          }
        }

        // Store decision
        state.recentDecisions.unshift({
          vault: decision.vault.name,
          action: decision.action,
          reasoning: decision.reasoning.slice(0, 300),
          timestamp: startTime,
        });
      }

      // Keep only last 20 decisions
      if (state.recentDecisions.length > 20) {
        state.recentDecisions = state.recentDecisions.slice(0, 20);
      }

      console.log(`[KeeperLoop] Analysis complete. ${decisions.length} decisions, ${state.totalHarvests} total harvests.`);
    } catch (error) {
      console.error('[KeeperLoop] Error during analysis:', error);
      state.recentDecisions.unshift({
        vault: 'All Vaults',
        action: 'error',
        reasoning: error instanceof Error ? error.message : String(error),
        timestamp: startTime,
      });
    }

    if (state.isRunning) {
      state.nextRun = new Date(Date.now() + intervalMs).toISOString();
    }

    return { ...state };
  };

  const start = () => {
    if (state.isRunning) return;
    state.isRunning = true;
    state.nextRun = new Date(Date.now() + intervalMs).toISOString();
    console.log(`[KeeperLoop] Started. Interval: ${intervalMs / 1000}s. Next run: ${state.nextRun}`);
    // Run immediately on start
    runOnce().catch(console.error);
    // Schedule recurring runs
    timer = setInterval(() => { runOnce().catch(console.error); }, intervalMs);
  };

  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
    state.isRunning = false;
    state.nextRun = null;
    console.log('[KeeperLoop] Stopped.');
  };

  const getState = (): KeeperLoopState => ({ ...state });

  return { start, stop, getState, runOnce };
}
