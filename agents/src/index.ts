import 'dotenv/config';
import { HederaClient } from './hedera/client.js';
import { HCSService } from './hedera/hcs.js';
import { ScoutAgent } from './agents/scout.js';
import { StrategistAgent } from './agents/strategist.js';
import { ExecutorAgent } from './agents/executor.js';
import { SentinelAgent } from './agents/sentinel.js';
import { AgentCoordinator } from './core/agent-coordinator.js';
import type { UserIntent } from './types/index.js';

/**
 * YieldMind Agent Runtime
 *
 * Initializes the Hedera connection and all 4 agents,
 * then exposes the AgentCoordinator for the web API to use.
 */
export function createRuntime() {
  // Core Hedera infrastructure
  const hederaClient = new HederaClient();
  const hcsService = new HCSService(hederaClient);

  // Initialize agents with dependency injection
  const scout = new ScoutAgent(hcsService);
  const strategist = new StrategistAgent(hcsService);
  const executor = new ExecutorAgent(hcsService, hederaClient);
  const sentinel = new SentinelAgent(hcsService);

  // Wire up the coordinator
  const coordinator = new AgentCoordinator({
    hcsService,
    scout,
    strategist,
    executor,
    sentinel,
  });

  console.log('🧠 YieldMind Agent Runtime initialized');
  console.log(`   Hedera Account: ${hederaClient.getAccountId()}`);
  console.log(`   Network: ${process.env.HEDERA_NETWORK || 'testnet'}`);
  console.log('   Agents: Scout, Strategist, Executor, Sentinel');

  return {
    coordinator,
    hederaClient,
    hcsService,
    agents: { scout, strategist, executor, sentinel },
  };
}

/**
 * Parse natural language user message into structured UserIntent.
 *
 * In production: uses Claude API for nuanced intent extraction.
 * For MVP: keyword-based parsing with sensible defaults.
 *
 * TODO: Replace with LangChain + Claude API call:
 *   const chain = new ChatAnthropic({ model: 'claude-sonnet-4-20250514' })
 *   const result = await chain.invoke([
 *     { role: 'system', content: INTENT_PARSER_PROMPT },
 *     { role: 'user', content: message }
 *   ]);
 */
export function parseUserIntent(
  message: string,
  sessionId: string
): UserIntent {
  const lower = message.toLowerCase();

  // Risk tolerance detection
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

  // Amount extraction (simple regex)
  const amountMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hbar|usdc|usdt)?/);
  const targetAmount = amountMatch ? parseFloat(amountMatch[1]) : 100;

  // Token detection
  let tokenSymbol = 'HBAR';
  if (lower.includes('usdc')) tokenSymbol = 'USDC';
  else if (lower.includes('usdt')) tokenSymbol = 'USDT';

  // Preferences
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

// Export types for web layer
export type { UserIntent } from './types/index.js';
export { AgentCoordinator } from './core/agent-coordinator.js';
