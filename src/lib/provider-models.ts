export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  capabilities?: string[];
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
}

export const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, balanced performance', capabilities: ['vision', 'chat', 'code'] },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', capabilities: ['vision', 'chat'] },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship', capabilities: ['vision', 'chat', 'code'] },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical', capabilities: ['chat'] },
  ],
  gemini: [
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Latest, fastest model', capabilities: ['vision', 'chat', 'code'] },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable, large context', capabilities: ['vision', 'chat', 'code'] },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient', capabilities: ['vision', 'chat'] },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest, most capable', capabilities: ['vision', 'chat', 'code'] },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Previous version', capabilities: ['vision', 'chat'] },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Balanced performance', capabilities: ['vision', 'chat'] },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient', capabilities: ['chat'] },
  ],
  openrouter: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship', capabilities: ['vision', 'chat'] },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Anthropic flagship', capabilities: ['vision', 'chat'] },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', description: 'Google latest', capabilities: ['vision', 'chat'] },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', description: 'Open source vision', capabilities: ['vision', 'chat'] },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', description: 'Large open vision', capabilities: ['vision', 'chat'] },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Open source flagship', capabilities: ['chat'] },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Strong multilingual', capabilities: ['chat'] },
    { id: 'mistralai/mistral-large', name: 'Mistral Large', description: 'European flagship', capabilities: ['chat'] },
  ],
  together: [
    { id: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', name: 'Llama 3.2 11B Vision', description: 'Fast vision model', capabilities: ['vision', 'chat'] },
    { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', name: 'Llama 3.2 90B Vision', description: 'Powerful vision model', capabilities: ['vision', 'chat'] },
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', description: 'Fast, high quality open model', capabilities: ['chat'] },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B', description: 'Massive, GPT-4 class open model', capabilities: ['chat'] },
    { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', description: 'Strong reasoning & coding', capabilities: ['chat'] },
    { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B', description: 'Large MoE model', capabilities: ['chat'] },
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', description: 'Efficient & capable', capabilities: ['chat'] },
    { id: 'Gryphe/MythoMax-L2-13b', name: 'MythoMax 13B', description: 'Roleplay specialized', capabilities: ['chat'] },
  ],
  deepinfra: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', description: 'Powerful instruction model', capabilities: ['chat'] },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', description: 'Massive instruction model', capabilities: ['chat'] },
    { id: 'microsoft/WizardLM-2-8x22B', name: 'WizardLM 2 8x22B', description: 'Microsoft MOE', capabilities: ['chat'] },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', description: 'Strong multi-lingual model', capabilities: ['chat'] },
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', description: 'Fast and efficient', capabilities: ['chat'] },
  ],
};

export interface FlatModelOption extends ModelOption {
  provider: string;
}

export const ALL_MODELS: FlatModelOption[] = Object.entries(PROVIDER_MODELS).flatMap(([provider, models]) =>
  models.map(m => ({ ...m, provider }))
);

export function getModelsForProvider(provider: string): ModelOption[] {
  return PROVIDER_MODELS[provider] || [];
}

export function getDefaultModelForProvider(provider: string): string {
  const models = PROVIDER_MODELS[provider];
  return models?.[0]?.id || '';
}

export function getVisionModelsForProvider(provider: string): ModelOption[] {
  const models = PROVIDER_MODELS[provider] || [];
  return models.filter(m => m.capabilities?.includes('vision'));
}
