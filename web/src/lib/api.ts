import type { ChatResponse, AgentState, DecisionLog, VaultInfo } from './types';

const BASE = '';

export async function sendChatMessage(
  message: string,
  sessionId: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  return res.json();
}

export async function executeStrategy(
  strategyId: string,
  sessionId: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategyId, sessionId }),
  });

  if (!res.ok) {
    throw new Error(`Execute request failed: ${res.status}`);
  }

  return res.json();
}

export async function fetchAgentStatus(): Promise<AgentState[]> {
  const res = await fetch(`${BASE}/api/agents/status`);

  if (!res.ok) {
    throw new Error(`Agent status request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.agents;
}

export async function fetchDecisions(
  sessionId?: string
): Promise<DecisionLog[]> {
  const url = sessionId
    ? `${BASE}/api/decisions?sessionId=${sessionId}`
    : `${BASE}/api/decisions`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Decisions request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.decisions;
}

export async function fetchVaults(): Promise<VaultInfo[]> {
  const res = await fetch(`${BASE}/api/vaults`);

  if (!res.ok) {
    throw new Error(`Vaults request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.vaults;
}
