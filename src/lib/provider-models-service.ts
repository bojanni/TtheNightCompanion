import { API_BASE_URL } from './constants';

const API_BASE = `${API_BASE_URL}/api/providers`;

// ── Types ────────────────────────────────────────────────────────────────────
export interface NormalizedModel {
    id: string;           // "provider:model-id"
    originalId: string;
    provider: string;
    name: string;
    capabilities: string[];   // "text" | "vision" | "reasoning" | "web_search" | "code"
    contextWindow: number | null;
    costTier: 'free' | 'low' | 'medium' | 'high' | 'unknown';
    pricing: { prompt: string; completion: string } | null;
    isAvailable: boolean;
    fetchedAt: string; // ISO date string
}

export interface ProviderModelsResponse {
    models: Record<string, NormalizedModel[]>;
    _meta: Record<string, { fetchedAt: string; count: number }>;
}

// ── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetch normalized models for ALL configured providers.
 */
export async function fetchProviderModels(): Promise<Record<string, NormalizedModel[]>> {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error(`Failed to fetch provider models: ${res.status}`);
    const data: ProviderModelsResponse = await res.json();
    return data.models ?? {};
}

/**
 * Force-refresh a single provider and return its models.
 */
export async function refreshProvider(provider: string): Promise<NormalizedModel[]> {
    const res = await fetch(`${API_BASE}/models/${provider}`);
    if (!res.ok) throw new Error(`Failed to refresh ${provider}: ${res.status}`);
    const data = await res.json() as { models: NormalizedModel[] };
    return data.models ?? [];
}

// ── Capability filters ────────────────────────────────────────────────────────

export function filterByCapability(
    models: NormalizedModel[],
    cap: 'vision' | 'reasoning' | 'web_search' | 'code' | 'audio' | 'video' | 'text'
): NormalizedModel[] {
    return models.filter(m => m.capabilities.includes(cap));
}

// ── Task recommendation logic ─────────────────────────────────────────────────

export function getRecommendedForTask(
    models: NormalizedModel[],
    task: 'generate' | 'improve' | 'vision' | 'research'
): NormalizedModel[] {
    let candidates = models.filter(m => m.isAvailable);

    switch (task) {
        case 'generate':
            // Text capable, not reasoning-only, prefer low/medium cost
            candidates = candidates.filter(m =>
                m.capabilities.includes('text') &&
                !m.capabilities.every(c => c === 'reasoning')
            );
            // Sort: free first, then low, medium, high, unknown
            return sortByCostTier(candidates);

        case 'improve':
            // Prefer instruction-following models (claude, gpt-4o, mistral-large, command-a)
            candidates = candidates.filter(m => m.capabilities.includes('text'));
            return candidates.sort((a, b) => {
                const aScore = instructionScore(a.originalId);
                const bScore = instructionScore(b.originalId);
                return bScore - aScore;
            });

        case 'vision':
            // MUST have vision capability
            return candidates.filter(m => m.capabilities.includes('vision'));

        case 'research': {
            // Prefer web_search capable (Perplexity first), then reasoning
            const withSearch = candidates.filter(m => m.capabilities.includes('web_search'));
            const withReasoning = candidates.filter(m =>
                !m.capabilities.includes('web_search') && m.capabilities.includes('reasoning')
            );
            return [...withSearch, ...withReasoning];
        }
    }
}

// Helpers
const COST_ORDER: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3, unknown: 4 };

function sortByCostTier(models: NormalizedModel[]) {
    return [...models].sort((a, b) =>
        (COST_ORDER[a.costTier] ?? 4) - (COST_ORDER[b.costTier] ?? 4)
    );
}

const INSTRUCTION_KEYWORDS = ['claude', 'gpt-4o', 'mistral-large', 'command-a', 'gemini-1.5-pro', 'gemini-2'];

function instructionScore(id: string): number {
    if (!id) return 0;
    const lower = id.toLowerCase();
    for (const [index, keyword] of INSTRUCTION_KEYWORDS.entries()) {
        if (lower.includes(keyword)) return INSTRUCTION_KEYWORDS.length - index;
    }
    return 0;
}

// ── Cost tier display helpers ─────────────────────────────────────────────────

export const COST_TIER_LABELS: Record<string, { label: string; color: string }> = {
    free: { label: 'Free', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    low: { label: 'Budget', color: 'text-green-400   bg-green-500/10   border-green-500/20' },
    medium: { label: 'Mid', color: 'text-amber-400   bg-amber-500/10   border-amber-500/20' },
    high: { label: 'Premium', color: 'text-rose-400    bg-rose-500/10    border-rose-500/20' },
    unknown: { label: '?', color: 'text-slate-400   bg-slate-500/10   border-slate-600/20' },
};

export function formatTimeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
