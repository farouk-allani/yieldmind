import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from '@hashgraph/sdk';
import type { HCSMessage, DecisionLog, HCSMessageType } from '../types';
import { HederaClient } from './client';

const MIRROR_NODE_URL =
  process.env.HEDERA_MIRROR_NODE_URL ||
  'https://testnet.mirrornode.hedera.com';

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
   * Publish an agent decision to an HCS topic
   * This is the core of the "transparent AI" differentiator —
   * every agent decision is permanently logged on Hedera consensus.
   */
  async publishDecision(
    topicId: string,
    type: HCSMessageType,
    decision: DecisionLog
  ): Promise<string> {
    const client = this.hederaClient.getClient();

    const message: HCSMessage = {
      type,
      payload: decision,
    };

    const messageBytes = Buffer.from(JSON.stringify(message), 'utf-8');

    // HCS messages have a 1024-byte limit per chunk.
    // For larger payloads, we'd need chunking. For MVP, keep decisions concise.
    if (messageBytes.length > 1024) {
      console.warn(
        `HCS message exceeds 1024 bytes (${messageBytes.length}). Truncating reasoning.`
      );
      decision.reasoning = decision.reasoning.substring(0, 200) + '...';
      const truncated = Buffer.from(
        JSON.stringify({ type, payload: decision }),
        'utf-8'
      );
      const response = await new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(truncated)
        .execute(client);

      const receipt = await response.getReceipt(client);
      return response.transactionId.toString();
    }

    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(messageBytes)
      .execute(client);

    await response.getReceipt(client);
    return response.transactionId.toString();
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
