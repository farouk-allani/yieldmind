import type {
  AgentRole,
  AgentState,
  AgentStatus,
  DecisionLog,
  HCSMessageType,
} from '../types';
import type { HCSService } from '../hedera/hcs';

/**
 * BaseAgent — Abstract foundation for all YieldMind agents.
 *
 * Every agent must:
 * 1. Have a role (scout, strategist, executor, sentinel)
 * 2. Produce DecisionLog entries for every action (published to HCS)
 * 3. Be able to read other agents' decisions from HCS
 * 4. Manage its own state lifecycle
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly role: AgentRole;
  protected status: AgentStatus = 'idle';
  protected lastAction: string | null = null;
  protected hcsService: HCSService;
  protected topicId: string | null = null;

  constructor(role: AgentRole, hcsService: HCSService) {
    this.id = `yieldmind-${role}-${Date.now()}`;
    this.role = role;
    this.hcsService = hcsService;
  }

  /**
   * Set the HCS topic this agent publishes to / reads from
   */
  setTopic(topicId: string): void {
    this.topicId = topicId;
  }

  /**
   * Get current agent state (for dashboard display)
   */
  getState(): AgentState {
    return {
      id: this.id,
      role: this.role,
      status: this.status,
      lastAction: this.lastAction,
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Create a structured decision log entry.
   * This is the transparent AI differentiator — every decision
   * includes human-readable reasoning that gets published on-chain.
   */
  protected createDecision(
    action: string,
    reasoning: string,
    confidence: number,
    sessionId: string,
    data: Record<string, unknown> = {}
  ): DecisionLog {
    return {
      agentId: this.id,
      agentRole: this.role,
      action,
      reasoning,
      confidence: Math.max(0, Math.min(1, confidence)),
      timestamp: new Date().toISOString(),
      sessionId,
      data,
    };
  }

  /**
   * Publish a decision to HCS. Every meaningful agent action
   * should call this to maintain the on-chain audit trail.
   */
  protected async publishDecision(
    type: HCSMessageType,
    decision: DecisionLog
  ): Promise<string | null> {
    if (!this.topicId) {
      console.warn(`[${this.role}] No topic set — decision not published to HCS`);
      return null;
    }

    try {
      const txId = await this.hcsService.publishDecision(
        this.topicId,
        type,
        decision
      );
      console.log(
        `[${this.role}] Decision published to HCS: ${type} (tx: ${txId})`
      );
      return txId;
    } catch (error) {
      console.error(`[${this.role}] Failed to publish decision:`, error);
      return null;
    }
  }

  /**
   * Read recent decisions from other agents on this topic
   */
  protected async readDecisions(limit: number = 10): Promise<DecisionLog[]> {
    if (!this.topicId) return [];

    try {
      const messages = await this.hcsService.getTopicMessages(
        this.topicId,
        limit
      );
      return messages.map((m) => m.payload);
    } catch (error) {
      console.error(`[${this.role}] Failed to read decisions:`, error);
      return [];
    }
  }

  /**
   * Update agent status with logging
   */
  protected setStatus(status: AgentStatus, action?: string): void {
    this.status = status;
    if (action) this.lastAction = action;
    console.log(`[${this.role}] Status: ${status}${action ? ` — ${action}` : ''}`);
  }

  /**
   * Abstract method — each agent implements its core logic here
   */
  abstract execute(input: unknown): Promise<DecisionLog>;
}
