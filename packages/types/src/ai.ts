/**
 * Supported AI provider identifiers.
 */
export type AiProviderName =
  'anthropic' | 'openai' | 'gemini' | 'kimi' | 'deepseek' | 'groq' | 'ollama';

/**
 * A configuration object that identifies an AI provider.
 */
export type AiProviderConfig = {
  provider: AiProviderName;
  apiKey?: string;
  endpoint?: string;
  model?: string;
};

/**
 * A normalized request sent to an AI provider.
 */
export type AiProviderRequest = {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

/**
 * A normalized response from an AI provider.
 */
export type AiProviderResponse = {
  id: string;
  model: string;
  output: string;
  raw?: unknown;
};
