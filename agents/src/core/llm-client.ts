/**
 * LLM Client — Multi-provider agent reasoning.
 *
 * Provider priority:
 * 1. Modal GLM-5 (745B, free until Apr 30 2026) — primary
 * 2. OpenRouter free-tier chain — fallback if Modal rate-limits (concurrent limit: 1)
 *
 * All providers use the OpenAI-compatible chat completions API.
 * Modal GLM-5 supports system messages natively — no flattening needed.
 * OpenRouter flattening only applies to small models that don't support system role.
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  provider: 'modal' | 'openrouter';
}

// Modal GLM-5 config
const MODAL_BASE_URL = 'https://api.us-west-2.modal.direct/v1';
const MODAL_MODEL = 'zai-org/GLM-5-FP8';

// OpenRouter free fallback chain (ordered by capability)
const OPENROUTER_FALLBACKS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-3-4b-it:free',
];

export class LLMClient {
  private modalApiKey: string | null;
  private openrouterApiKey: string;
  private openrouterBaseUrl: string;
  private openrouterPrimaryModel: string;

  constructor() {
    this.modalApiKey = process.env.MODAL_API_KEY || null;

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      throw new Error('OPENROUTER_API_KEY must be set in environment variables');
    }
    this.openrouterApiKey = openrouterKey;
    this.openrouterBaseUrl =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.openrouterPrimaryModel =
      process.env.LLM_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free';
  }

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    // 1. Try Modal GLM-5 first (745B, highest quality)
    if (this.modalApiKey) {
      try {
        const result = await this.callModal(messages);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRateLimit = msg.includes('429') || msg.includes('503') || msg.includes('502');
        if (isRateLimit) {
          console.log('[LLM] Modal GLM-5 rate-limited (concurrent limit reached), falling back to OpenRouter...');
        } else {
          console.warn(`[LLM] Modal GLM-5 error: ${msg}. Falling back to OpenRouter...`);
        }
      }
    }

    // 2. OpenRouter fallback chain
    return this.chatViaOpenRouter(messages);
  }

  private async callModal(messages: ChatMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${MODAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.modalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODAL_MODEL,
        messages, // GLM-5 supports system messages natively
        temperature: 0.3,
        max_tokens: 1024, // GLM-5 can handle longer outputs
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modal API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model?: string;
    };

    const content = (data.choices[0]?.message?.content || '').trim();
    console.log(`[LLM] Modal GLM-5 responded (${content.length} chars)`);

    return { content, model: data.model || MODAL_MODEL, provider: 'modal' };
  }

  private async chatViaOpenRouter(messages: ChatMessage[]): Promise<LLMResponse> {
    const modelsToTry = [this.openrouterPrimaryModel, ...OPENROUTER_FALLBACKS];
    const tried = new Set<string>();

    for (const model of modelsToTry) {
      if (tried.has(model)) continue;
      tried.add(model);

      try {
        const result = await this.callOpenRouter(model, messages);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable =
          msg.includes('402') || msg.includes('429') || msg.includes('400') ||
          msg.includes('503') || msg.includes('502') || msg.includes('404') ||
          msg.includes('UNAVAILABLE') || msg.includes('No endpoints found');
        if (!isRetryable) throw error;
        console.log(`[LLM] OpenRouter ${model} unavailable, trying next...`);
      }
    }

    throw new Error('All LLM providers exhausted. Check rate limits and API keys.');
  }

  private async callOpenRouter(
    model: string,
    messages: ChatMessage[]
  ): Promise<LLMResponse> {
    // Flatten system messages for small models that don't support the system role
    const processedMessages = this.flattenSystemMessagesForSmallModels(model, messages);

    const response = await fetch(`${this.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://yieldmind.app',
        'X-Title': 'YieldMind Protocol',
      },
      body: JSON.stringify({
        model,
        messages: processedMessages,
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model?: string;
    };

    let content = data.choices[0]?.message?.content || '';

    // Strip <think>...</think> tags from reasoning models (DeepSeek R1 etc.)
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const resolvedModel = data.model || model;
    if (resolvedModel !== this.openrouterPrimaryModel) {
      console.log(`[LLM] OpenRouter fallback model used: ${resolvedModel}`);
    }

    return { content, model: resolvedModel, provider: 'openrouter' };
  }

  /**
   * Merge system messages into the first user message.
   * Only needed for small/limited models (Gemma etc.) that reject the system role.
   * Large capable models (Qwen, GPT-OSS) handle system messages correctly.
   */
  private flattenSystemMessagesForSmallModels(
    model: string,
    messages: ChatMessage[]
  ): ChatMessage[] {
    const limitedModels = ['google/gemma-3-4b-it:free'];
    if (!limitedModels.some((m) => model.includes(m.split(':')[0]))) {
      return messages;
    }

    const systemParts: string[] = [];
    const rest: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        rest.push(msg);
      }
    }

    if (systemParts.length === 0) return messages;

    const systemPrefix = systemParts.join('\n\n');
    if (rest.length > 0 && rest[0].role === 'user') {
      return [
        { role: 'user', content: `${systemPrefix}\n\n${rest[0].content}` },
        ...rest.slice(1),
      ];
    }

    return [{ role: 'user', content: systemPrefix }, ...rest];
  }
}
