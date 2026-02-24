/**
 * LLM Client — OpenRouter integration for agent reasoning.
 *
 * Uses OpenRouter's OpenAI-compatible API via fetch.
 * No LangChain dependency — direct HTTP for simplicity and speed.
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
}

export class LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY must be set in environment variables');
    }
    this.apiKey = apiKey;
    this.model = process.env.LLM_MODEL || 'qwen/qwen3-235b-a22b:free';
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://yieldmind.app',
        'X-Title': 'YieldMind Protocol',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
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

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || this.model,
    };
  }
}
