import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from '@hashgraph/sdk';
import type { HCSMessage, DecisionLog, HCSMessageType } from '../types/index.js';
import { HederaClient } from './client.js';
import { getNetworkConfig } from '../config/index.js';

const MIRROR_NODE_URL =
  process.env.HEDERA_MIRROR_NODE_URL ||
  getNetworkConfig().mirrorNodeUrl;

export class HCSService {
  private hederaClient: HederaClient;

  constructor(hederaClient: HederaClient) {
    this.hederaClient = hederaClient;
  }

  /**
   * Create a new HCS topic for agent coordination
   * @param memo - Human-readable topic description
   * @returns TopicId string (e.g., "0.0.12345")
   */
  async createTopic(memo: string): Promise<string> {
    const client = this.hederaClient.getClient();

    const transaction = new TopicCreateTransaction()
      .setTopicMemo(memo)
      .setSubmitKey(client.operatorPublicKey!);

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);

    if (!receipt.topicId) {
      throw new Error('Failed to create HCS topic — no topicId in receipt');
    }

    return receipt.topicId.toString();
  }

  /**
   * Publish an agent decision to an HCS topic.
   * This is the core of the "transparent AI" differentiator —
   * every agent decision is permanently logged on Hedera consensus.
   *
   * HCS has a 1024-byte message limit. We publish a compact version
   * with the reasoning (the human-readable part) and core metadata.
   * The full data payload stays in the application layer.
   */
  async publishDecision(
    topicId: string,
    type: HCSMessageType,
    decision: DecisionLog
  ): Promise<string> {
    const client = this.hederaClient.getClient();

    // Build a compact HCS payload that fits within 1024 bytes.
    // The reasoning is what matters on-chain — it's the transparency proof.
    const hcsPayload = this.buildCompactPayload(type, decision);
    const messageBytes = Buffer.from(JSON.stringify(hcsPayload), 'utf-8');

    if (messageBytes.length > 1024) {
      // If STILL too large, aggressively truncate reasoning
      hcsPayload.reasoning = hcsPayload.reasoning.substring(0, 100) + '...';
      const finalBytes = Buffer.from(JSON.stringify(hcsPayload), 'utf-8');
      console.warn(
        `[HCS] Payload compressed to ${finalBytes.length} bytes for topic ${topicId}`
      );
    }

    const finalMessage = Buffer.from(JSON.stringify(hcsPayload), 'utf-8');

    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(finalMessage)
      .execute(client);

    await response.getReceipt(client);
    return response.transactionId.toString();
  }

  /**
   * Build a compact payload for HCS that fits within 1024 bytes.
   * Keeps the human-readable reasoning + core metadata.
   * Strips the large `data` field (vault arrays, strategies, etc.).
   */
  private buildCompactPayload(
    type: HCSMessageType,
    decision: DecisionLog
  ): {
    type: HCSMessageType;
    agent: string;
    action: string;
    reasoning: string;
    confidence: number;
    timestamp: string;
    session: string;
    summary: Record<string, unknown>;
  } {
    // Extract only small summary fields from data
    const summary: Record<string, unknown> = {};
    if (decision.data.dataSource) summary.source = decision.data.dataSource;
    if (decision.data.vaultsScanned) summary.scanned = decision.data.vaultsScanned;
    if (decision.data.vaultsMatched) summary.matched = decision.data.vaultsMatched;
    if (decision.data.success !== undefined) summary.success = decision.data.success;
    if (decision.data.transactionId) summary.txId = decision.data.transactionId;
    if (decision.data.marketStatus) summary.market = decision.data.marketStatus;
    if (decision.data.alert) {
      const alert = decision.data.alert as { severity?: string; condition?: string };
      summary.alertSeverity = alert.severity;
      summary.alertCondition = alert.condition;
    }

    return {
      type,
      agent: decision.agentRole,
      action: decision.action,
      reasoning: decision.reasoning.substring(0, 300),
      confidence: decision.confidence,
      timestamp: decision.timestamp,
      session: decision.sessionId,
      summary,
    };
  }

  /**
   * Fetch messages from an HCS topic via Mirror Node REST API
   * Used by agents to read other agents' decisions
   */
  async getTopicMessages(
    topicId: string,
    limit: number = 25,
    afterTimestamp?: string
  ): Promise<HCSMessage[]> {
    let url = `${MIRROR_NODE_URL}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;

    if (afterTimestamp) {
      url += `&timestamp=gt:${afterTimestamp}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Mirror Node request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      messages: Array<{
        sequence_number: number;
        consensus_timestamp: string;
        message: string;
      }>;
    };

    return data.messages.map((msg) => {
      const decoded = Buffer.from(msg.message, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as HCSMessage;
      return {
        ...parsed,
        sequenceNumber: msg.sequence_number,
        consensusTimestamp: msg.consensus_timestamp,
      };
    });
  }

  /**
   * Create a session-specific coordination topic
   */
  async createSessionTopic(sessionId: string): Promise<string> {
    return this.createTopic(`YieldMind Session: ${sessionId}`);
  }

  /**
   * Create the global coordination topic (for Sentinel alerts)
   */
  async createGlobalTopic(): Promise<string> {
    return this.createTopic('YieldMind Global Coordination');
  }
}
