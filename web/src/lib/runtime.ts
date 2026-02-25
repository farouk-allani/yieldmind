/**
 * Agent Runtime Singleton for Next.js
 *
 * Initializes the full agent pipeline once and reuses across
 * all API route invocations. Survives Next.js hot reloads in dev.
 */
import {
  createRuntime,
  parseUserIntentWithLLM,
  parseUserIntent,
} from '@yieldmind/agents';
import type { UserIntent } from '@yieldmind/agents';

type AgentRuntime = ReturnType<typeof createRuntime>;

const globalForRuntime = globalThis as unknown as {
  agentRuntime: AgentRuntime | undefined;
  runtimeError: string | undefined;
};

function initRuntime(): AgentRuntime | null {
  try {
    const runtime = createRuntime();
    globalForRuntime.runtimeError = undefined;
    return runtime;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown initialization error';
    console.error('[Runtime] Failed to initialize agent runtime:', message);
    globalForRuntime.runtimeError = message;
    return null;
  }
}

// Initialize once — reuse across requests and hot reloads
export const agentRuntime: AgentRuntime | null =
  globalForRuntime.agentRuntime ?? initRuntime();

if (process.env.NODE_ENV !== 'production' && agentRuntime) {
  globalForRuntime.agentRuntime = agentRuntime;
}

/**
 * Parse user intent — tries LLM first, falls back to keywords.
 * Returns null if the message is not a yield intent.
 */
export async function parseIntent(
  message: string,
  sessionId: string
): Promise<UserIntent | null> {
  if (agentRuntime?.llmClient) {
    return parseUserIntentWithLLM(message, sessionId, agentRuntime.llmClient);
  }
  return parseUserIntent(message, sessionId);
}

/**
 * Get the runtime initialization error (if any).
 */
export function getRuntimeError(): string | undefined {
  return globalForRuntime.runtimeError;
}
