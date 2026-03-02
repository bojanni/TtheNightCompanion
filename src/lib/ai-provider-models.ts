export interface AIProviderModel {
    id: string;           // matches provider:model format e.g. "openai:gpt-4o"
    name: string;         // display name e.g. "GPT-4o"
    provider: string;     // "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "lmstudio"
    providerLabel?: string; // display name for the provider badge, e.g. "OpenAI"
    capabilities: ('text' | 'vision' | 'reasoning' | 'web_search' | 'code' | 'audio' | 'video')[];
    strengths: {
        creativity: number;    // 1-5
        instruction: number;   // 1-5
        speed: number;         // 1-5
        cost: 'free' | 'low' | 'medium' | 'high';
    };
    recommendedFor: ('generate' | 'improve' | 'vision' | 'research')[];
    badge?: 'Best' | 'Fast' | 'Budget' | 'Local';
    note?: string;
    description?: string;   // short model description
    costIn?: string;        // e.g. "$3.00/1M"  tokens in
    costOut?: string;       // e.g. "$15.00/1M" tokens out
    infoUrl?: string;       // link to model documentation
}

export const AI_PROVIDER_MODELS: AIProviderModel[] = [
    // ── OpenAI ─────────────────────────────────────────────────────────────
    {
        id: 'openai:gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        providerLabel: 'OpenAI',
        capabilities: ['text', 'vision', 'reasoning'],
        strengths: { creativity: 4, instruction: 5, speed: 3, cost: 'high' },
        recommendedFor: ['improve', 'vision', 'research'],
        badge: 'Best',
        description: 'OpenAI\'s flagship multimodal model. Excels at complex reasoning and vision tasks.',
        costIn: '$2.50/1M',
        costOut: '$10.00/1M',
        infoUrl: 'https://platform.openai.com/docs/models/gpt-4o',
    },
    {
        id: 'openai:gpt-4o-mini',
        name: 'GPT-4o mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        capabilities: ['text', 'vision'],
        strengths: { creativity: 3, instruction: 4, speed: 5, cost: 'low' },
        recommendedFor: ['generate', 'improve'],
        badge: 'Fast',
        description: 'Smaller, faster, cheaper GPT-4o. Great for high-volume generation tasks.',
        costIn: '$0.15/1M',
        costOut: '$0.60/1M',
        infoUrl: 'https://platform.openai.com/docs/models/gpt-4o-mini',
    },
    {
        id: 'openai:o1-mini',
        name: 'o1-mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        capabilities: ['text', 'reasoning'],
        strengths: { creativity: 3, instruction: 5, speed: 2, cost: 'medium' },
        recommendedFor: ['research'],
        description: 'OpenAI o1-mini is a fast, cost-efficient reasoning model best suited for research and analytical tasks.',
        costIn: '$1.10/1M',
        costOut: '$4.40/1M',
        infoUrl: 'https://platform.openai.com/docs/models/o1',
    },

    // ── Anthropic ───────────────────────────────────────────────────────────
    {
        id: 'anthropic:claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        capabilities: ['text', 'vision', 'reasoning'],
        strengths: { creativity: 4, instruction: 5, speed: 3, cost: 'medium' },
        recommendedFor: ['improve', 'vision', 'research'],
        description: 'Anthropic\'s most intelligent model. Best-in-class instruction following and nuanced writing.',
        costIn: '$3.00/1M',
        costOut: '$15.00/1M',
        infoUrl: 'https://www.anthropic.com/claude/sonnet',
    },
    {
        id: 'anthropic:claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        capabilities: ['text', 'vision'],
        strengths: { creativity: 3, instruction: 4, speed: 5, cost: 'low' },
        recommendedFor: ['generate', 'improve'],
        badge: 'Fast',
        description: 'Anthropic\'s fastest model. Near-instant responses at very low cost.',
        costIn: '$0.80/1M',
        costOut: '$4.00/1M',
        infoUrl: 'https://www.anthropic.com/claude/haiku',
    },
    {
        id: 'anthropic:claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        capabilities: ['text', 'vision'],
        strengths: { creativity: 3, instruction: 4, speed: 5, cost: 'low' },
        recommendedFor: ['generate', 'improve'],
        badge: 'Budget',
        description: 'The affordable workhorse in the Claude 3 family. Ideal for bulk prompt generation.',
        costIn: '$0.25/1M',
        costOut: '$1.25/1M',
        infoUrl: 'https://www.anthropic.com/claude/haiku',
    },

    // ── Google ──────────────────────────────────────────────────────────────
    {
        id: 'google:gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        providerLabel: 'Google',
        capabilities: ['text', 'vision'],
        strengths: { creativity: 4, instruction: 4, speed: 5, cost: 'low' },
        recommendedFor: ['generate', 'research'],
        badge: 'Fast',
        description: 'Google\'s fastest next-gen model. Excellent for quick creative generation at low cost.',
        costIn: '$0.10/1M',
        costOut: '$0.40/1M',
        infoUrl: 'https://deepmind.google/technologies/gemini/flash/',
    },
    {
        id: 'google:gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        providerLabel: 'Google',
        capabilities: ['text', 'vision'],
        strengths: { creativity: 4, instruction: 4, speed: 5, cost: 'low' },
        recommendedFor: ['generate', 'vision'],
        badge: 'Budget',
        description: 'Speed-optimized Gemini model with long context support and vision capabilities.',
        costIn: '$0.075/1M',
        costOut: '$0.30/1M',
        infoUrl: 'https://deepmind.google/technologies/gemini/flash/',
    },
    {
        id: 'google:gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        providerLabel: 'Google',
        capabilities: ['text', 'vision', 'reasoning'],
        strengths: { creativity: 4, instruction: 5, speed: 3, cost: 'medium' },
        recommendedFor: ['improve', 'vision', 'research'],
        description: 'Google\'s most capable Gemini 1.5 model. Supports 2M token context window.',
        costIn: '$1.25/1M',
        costOut: '$5.00/1M',
        infoUrl: 'https://deepmind.google/technologies/gemini/pro/',
    },

    // ── Local ───────────────────────────────────────────────────────────────
    {
        id: 'ollama:auto',
        name: 'Local Model (Ollama)',
        provider: 'ollama',
        providerLabel: 'Ollama',
        capabilities: ['text'],
        strengths: { creativity: 3, instruction: 3, speed: 5, cost: 'free' },
        recommendedFor: ['generate', 'improve'],
        badge: 'Local',
        description: 'Uses your configured local Ollama model. Completely free, fully private.',
        costIn: 'Free',
        costOut: 'Free',
        note: 'Uses your configured local model',
    },
    {
        id: 'lmstudio:auto',
        name: 'Local Model (LM Studio)',
        provider: 'lmstudio',
        providerLabel: 'LM Studio',
        capabilities: ['text'],
        strengths: { creativity: 3, instruction: 3, speed: 5, cost: 'free' },
        recommendedFor: ['generate', 'improve'],
        badge: 'Local',
        description: 'Uses your configured LM Studio model. Completely free, fully private.',
        costIn: 'Free',
        costOut: 'Free',
    },
];

export type TaskType = 'generate' | 'improve' | 'vision' | 'research';

export function getModelsForTask(task: TaskType): AIProviderModel[] {
    return AI_PROVIDER_MODELS.filter(m => m.recommendedFor.includes(task))
        .sort((a, b) => {
            // Sort: Best badge first, then by combined creativity + instruction desc
            if (a.badge === 'Best' && b.badge !== 'Best') return -1;
            if (b.badge === 'Best' && a.badge !== 'Best') return 1;

            const scoreA = a.strengths.creativity + a.strengths.instruction;
            const scoreB = b.strengths.creativity + b.strengths.instruction;
            return scoreB - scoreA;
        });
}

export function getModelById(id: string): AIProviderModel | undefined {
    return AI_PROVIDER_MODELS.find(m => m.id === id);
}

export function isVisionCapable(id: string): boolean {
    const model = getModelById(id);
    return model ? model.capabilities.includes('vision') : false;
}

export const PROVIDER_GROUPS: { key: string; label: string; type: 'cloud' | 'local' }[] = [
    { key: 'openai', label: 'OpenAI', type: 'cloud' },
    { key: 'anthropic', label: 'Anthropic', type: 'cloud' },
    { key: 'google', label: 'Google', type: 'cloud' },
    { key: 'ollama', label: 'Local (Ollama)', type: 'local' },
    { key: 'lmstudio', label: 'Local (LM Studio)', type: 'local' },
];
