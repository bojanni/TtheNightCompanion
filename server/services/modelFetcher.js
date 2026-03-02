'use strict';

const logger = require('../lib/logger');

// ── In-memory cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // provider → { models: NormalizedModel[], fetchedAt: Date }

// ── Cost-tier derivation (per million OUTPUT tokens) ─────────────────────────
function deriveCostTier(costPerToken) {
    if (costPerToken === undefined || costPerToken === null) return 'unknown';
    const perMillion = parseFloat(costPerToken) * 1_000_000;
    if (isNaN(perMillion)) return 'unknown';
    if (perMillion === 0) return 'free';
    if (perMillion < 1) return 'low';
    if (perMillion <= 5) return 'medium';
    return 'high';
}

// ── Capability detection ─────────────────────────────────────────────────────
const REASONING_RE = /reasoning|magistral|r1|deepseek-r|thinking|o1|o3|qwen.*thinking/i;
const WEB_SEARCH_RE = /online$|compound/i;
const CODE_RE = /codestral|code\b|coder|starcoder|deepseek-coder/i;
const VISION_ID_RE = /llava|vision|[\-_]vl[\-_]|pixtral|llama-4|kimi-k2/i;

function detectCapabilities(id, extra = {}) {
    const caps = ['text'];
    if (extra.vision || VISION_ID_RE.test(id)) caps.push('vision');
    if (extra.audio) caps.push('audio');
    if (extra.video) caps.push('video');
    if (extra.reasoning || REASONING_RE.test(id)) caps.push('reasoning');
    if (extra.webSearch || WEB_SEARCH_RE.test(id)) caps.push('web_search');
    if (CODE_RE.test(id)) caps.push('code');
    return caps;
}

// ── Normalize helper ─────────────────────────────────────────────────────────
function normalize({ originalId, provider, name, capabilities, contextWindow, costTier, pricing }) {
    return {
        id: `${provider}:${originalId}`,
        originalId,
        provider,
        name: name || originalId,
        capabilities: capabilities || ['text'],
        contextWindow: contextWindow || null,
        costTier: costTier || 'unknown',
        pricing: pricing || null,
        isAvailable: true,
        fetchedAt: new Date(),
    };
}

// ── Per-provider fetchers ────────────────────────────────────────────────────

async function fetchOpenRouter(apiKey) {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OpenRouter /models → ${res.status}`);
    const { data } = await res.json();
    return (data || []).map(m => {
        const modality = m.architecture?.modality || '';
        const isVision = modality.includes('image') || m.pricing?.image !== undefined;
        const isAudio = modality.includes('audio');
        const isVideo = modality.includes('video');

        const isOnline = m.id.endsWith(':online') || m.id.includes('online') ||
            (m.supported_parameters || []).includes('online');
        const hasReasoning = (m.supported_parameters || []).includes('reasoning');
        const costOut = m.pricing?.completion;
        return normalize({
            originalId: m.id,
            provider: 'openrouter',
            name: m.name,
            capabilities: detectCapabilities(m.id, {
                vision: isVision,
                webSearch: isOnline,
                reasoning: hasReasoning,
                audio: isAudio,
                video: isVideo,
            }),
            contextWindow: m.context_length,
            costTier: m.pricing?.completion === '0' ? 'free' : deriveCostTier(costOut),
            pricing: m.pricing ? {
                prompt: m.pricing.prompt,
                completion: m.pricing.completion,
            } : null,
        });
    });
}

async function fetchGroq(apiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Groq /models → ${res.status}`);
    const { data } = await res.json();
    const GROQ_VISION = new Set([
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'meta-llama/llama-4-maverick-17b-128e-instruct',
    ]);
    return (data || []).map(m => normalize({
        originalId: m.id,
        provider: 'groq',
        name: m.id.split('/').pop() || m.id,
        capabilities: detectCapabilities(m.id, { vision: GROQ_VISION.has(m.id) }),
        contextWindow: m.context_window || null,
        costTier: 'low', // Groq provides no pricing - typically very cheap
        pricing: null,
    }));
}

async function fetchMistral(apiKey) {
    const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Mistral /models → ${res.status}`);
    const { data } = await res.json();
    return (data || []).map(m => normalize({
        originalId: m.id,
        provider: 'mistral',
        name: m.id,
        capabilities: detectCapabilities(m.id, { vision: m.capabilities?.vision === true }),
        contextWindow: null,
        costTier: 'medium',
        pricing: null,
    }));
}

async function fetchTogether(apiKey) {
    const res = await fetch('https://api.together.xyz/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Together /models → ${res.status}`);
    const data = await res.json();
    return (data || [])
        .filter(m => !m.type || ['chat', 'language', 'code'].includes(m.type))
        .map(m => {
            const costOut = m.pricing?.output;
            return normalize({
                originalId: m.id,
                provider: 'together',
                name: m.display_name || m.id,
                capabilities: detectCapabilities(m.id, {
                    vision: m.type === 'vision' || (m.capabilities || []).includes('vision'),
                    code: m.type === 'code',
                }),
                contextWindow: m.context_length,
                costTier: costOut !== undefined ? deriveCostTier(costOut) : 'medium',
                pricing: m.pricing ? { prompt: String(m.pricing.input), completion: String(m.pricing.output) } : null,
            });
        });
}

async function fetchCohere(apiKey) {
    const res = await fetch('https://api.cohere.com/v1/models?endpoint=chat', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Cohere /models → ${res.status}`);
    const { models } = await res.json();
    return (models || []).map(m => normalize({
        originalId: m.name,
        provider: 'cohere',
        name: m.name,
        capabilities: detectCapabilities(m.name, {
            vision: m.name.toLowerCase().includes('vision'),
        }),
        contextWindow: m.context_length,
        costTier: 'medium',
        pricing: null,
    }));
}

async function fetchDeepInfra(apiKey) {
    const res = await fetch('https://api.deepinfra.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`DeepInfra /models → ${res.status}`);
    const { data } = await res.json();
    return (data || []).map(m => {
        const meta = m.metadata || {};
        const p = meta.pricing || {};
        const tags = meta.tags || [];
        const isVision = tags.includes('vision');
        const isReasoning = tags.includes('reasoning_effort') || tags.includes('reasoning') || detectCapabilities(m.id).includes('reasoning');

        // DeepInfra pricing is USD per 1M tokens. Normalized format expects USD per token.
        const costIn = p.input_tokens ? p.input_tokens / 1_000_000 : null;
        const costOut = p.output_tokens ? p.output_tokens / 1_000_000 : null;

        return normalize({
            originalId: m.id,
            provider: 'deepinfra',
            name: m.id.split('/').pop() || m.id,
            capabilities: detectCapabilities(m.id, { vision: isVision, reasoning: isReasoning }),
            contextWindow: meta.context_length || null,
            costTier: costOut !== null ? deriveCostTier(costOut) : 'low',
            pricing: costIn !== null ? {
                prompt: String(costIn),
                completion: String(costOut),
            } : null,
        });
    });
}

// Perplexity has no /models endpoint — hardcoded stable list
function fetchPerplexity(_apiKey) {
    const MODELS = [
        { id: 'sonar', name: 'Sonar', desc: 'Fast search + grounded answers' },
        { id: 'sonar-pro', name: 'Sonar Pro', desc: 'Deeper retrieval and follow-ups' },
        { id: 'sonar-reasoning', name: 'Sonar Reasoning', desc: 'Multi-step reasoning + web search' },
        { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', desc: 'Advanced reasoning + web search' },
        { id: 'sonar-deep-research', name: 'Sonar Deep Research', desc: 'Comprehensive long-form research' },
    ];
    return Promise.resolve(MODELS.map(m => normalize({
        originalId: m.id,
        provider: 'perplexity',
        name: m.name,
        capabilities: ['text', 'web_search', ...(m.id.includes('reasoning') ? ['reasoning'] : [])],
        contextWindow: 127000,
        costTier: m.id.includes('pro') || m.id.includes('deep') ? 'medium' : 'low',
        pricing: null,
    })));
}

async function fetchOpenAI(apiKey) {
    const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenAI /models → ${res.status}`);
    const { data } = await res.json();
    const CHAT_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini']);
    const VISION_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision-preview']);
    // Only return chat-capable models
    return (data || [])
        .filter(m => CHAT_MODELS.has(m.id) || m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
        .map(m => normalize({
            originalId: m.id,
            provider: 'openai',
            name: m.id,
            capabilities: detectCapabilities(m.id, { vision: VISION_MODELS.has(m.id) }),
            contextWindow: null,
            costTier: m.id.includes('mini') ? 'low' : m.id.startsWith('gpt-3') ? 'low' : 'high',
            pricing: null,
        }));
}

async function fetchAnthropic(_apiKey) {
    // Anthropic has no public /models endpoint — hardcoded known models
    const MODELS = [
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', tier: 'high', vision: true },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', tier: 'medium', vision: true },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tier: 'medium', vision: true },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'low', vision: true },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tier: 'high', vision: true },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tier: 'low', vision: true },
    ];
    return Promise.resolve(MODELS.map(m => normalize({
        originalId: m.id,
        provider: 'anthropic',
        name: m.name,
        capabilities: detectCapabilities(m.id, { vision: m.vision }),
        contextWindow: 200000,
        costTier: m.tier,
        pricing: null,
    })));
}

async function fetchGoogle(_apiKey) {
    // Google Gemini — hardcoded known models (API key auth for listing is complex)
    const MODELS = [
        { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro Preview', tier: 'high', vision: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'low', vision: true },
        { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', tier: 'low', vision: true },
        { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', tier: 'medium', vision: true },
        { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', tier: 'low', vision: true },
    ];
    return Promise.resolve(MODELS.map(m => normalize({
        originalId: m.id,
        provider: 'google',
        name: m.name,
        capabilities: detectCapabilities(m.id, { vision: m.vision }),
        contextWindow: 1000000,
        costTier: m.tier,
        pricing: null,
    })));
}

// ── Provider dispatch table ───────────────────────────────────────────────────
const FETCHERS = {
    openrouter: fetchOpenRouter,
    groq: fetchGroq,
    mistral: fetchMistral,
    together: fetchTogether,
    cohere: fetchCohere,
    deepinfra: fetchDeepInfra,
    perplexity: fetchPerplexity,
    openai: fetchOpenAI,
    anthropic: fetchAnthropic,
    google: fetchGoogle,
    gemini: fetchGoogle, // alias
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch (or return cached) normalized models for a single provider.
 * @param {string} provider
 * @param {string} apiKey       Decrypted API key
 * @param {boolean} forceRefresh  Bypass cache
 */
async function getModelsForProvider(provider, apiKey, forceRefresh = false) {
    const key = provider;
    const cached = cache.get(key);
    const now = Date.now();

    if (!forceRefresh && cached && (now - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
        return cached.models;
    }

    const fetcher = FETCHERS[provider];
    if (!fetcher) {
        logger.warn(`[modelFetcher] No fetcher for provider: ${provider}`);
        return cached ? cached.models : [];
    }

    try {
        const models = await fetcher(apiKey);
        cache.set(key, { models, fetchedAt: new Date() });
        logger.info(`[modelFetcher] Fetched ${models.length} models from ${provider}`);
        return models;
    } catch (err) {
        logger.error(`[modelFetcher] Failed to fetch ${provider}: ${err.message}`);
        // Return stale cache if available
        return cached ? cached.models : [];
    }
}

/**
 * Fetch models for all configured providers in parallel.
 * @param {Array<{provider: string, apiKey: string}>} providers
 */
async function getAllModels(providers) {
    const results = await Promise.allSettled(
        providers.map(({ provider, apiKey }) =>
            getModelsForProvider(provider, apiKey)
                .then(models => ({ provider, models }))
        )
    );

    const out = {};
    for (const r of results) {
        if (r.status === 'fulfilled') {
            out[r.value.provider] = r.value.models;
        }
    }
    return out;
}

/**
 * Return cached fetchedAt date for a provider (or null).
 */
function getCachedAt(provider) {
    return cache.get(provider)?.fetchedAt ?? null;
}

module.exports = { getModelsForProvider, getAllModels, getCachedAt, FETCHERS };
