/**
 * LLM Client — OpenRouter integration for agent reasoning.
 *
 * Uses OpenRouter's OpenAI-compatible API via fetch.
 * No LangChain dependency — direct HTTP for simplicity and speed.
 *
 * Supports model fallback: if the primary model is rate-limited (402/429),
 * automatically tries alternative free models.
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
}

// Free models ordered by capability — fallback chain
const FREE_MODEL_FALLBACKS = [
  'google/gemma-3n-e4b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'qwen/qwen3-4b:free',
  'stepfun/step-3.5-flash:free',
];

export class LLMClient {
  private apiKey: string;
  private primaryModel: string;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY must be set in environment variables');
    }
    this.apiKey = apiKey;
    this.primaryModel =
      process.env.LLM_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    // Try primary model first, then fallbacks
    const modelsToTry = [this.primaryModel, ...FREE_MODEL_FALLBACKS];
    const tried = new Set<string>();

    for (const model of modelsToTry) {
      if (tried.has(model)) continue;
      tried.add(model);

      try {
        const result = await this.callModel(model, messages);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable =
          msg.includes('402') || msg.includes('429') || msg.includes('400');
        if (!isRetryable) throw error;
        console.log(
          `[LLM] ${model} unavailable (rate-limited), trying next...`
        );
      }
    }

    throw new Error('All LLM models are rate-limited. Using keyword fallback.');
  }

  private async callModel(
    model: string,
    messages: ChatMessage[]
  ): Promise<LLMResponse> {
    // Some free models don't support system instructions — merge into user message
    const processedMessages = this.flattenSystemMessages(messages);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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

    // Strip <think>...</think> tags from reasoning models (DeepSeek R1)
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (data.model !== this.primaryModel && model !== this.primaryModel) {
      console.log(`[LLM] Using fallback model: ${data.model || model}`);
    }

    return {
      content,
      model: data.model || model,
    };
  }

  /**
   * Merge system messages into user messages for model compatibility.
   * Many free models (Gemma, etc.) don't support the system role.
   */
  private flattenSystemMessages(messages: ChatMessage[]): ChatMessage[] {
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

    // Prepend system content to the first user message
    const systemPrefix = systemParts.join('\n\n');
    if (rest.length > 0 && rest[0].role === 'user') {
      return [
        { role: 'user', content: `${systemPrefix}\n\n${rest[0].content}` },
        ...rest.slice(1),
      ];
    }

    // If no user message, add system content as a user message
    return [{ role: 'user', content: systemPrefix }, ...rest];
  }
}
