'use strict';

const logger = require('../lib/logger');
const { pool } = require('../db');
const { decrypt } = require('../lib/crypto');

// Log token status at startup based on environment variable.
// Tokens stored via the app UI are resolved lazily per-request.
if (process.env.HF_TOKEN) {
    logger.info('HuggingFace token: configured ✓');
} else {
    logger.info('HuggingFace token: not set via environment (limited to 1000 req/day; can be set via Settings)');
}

// ── Cache ────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const metaCache = new Map();  // hfModelId → { data, fetchedAt }
const cardCache = new Map();  // hfModelId → { data, fetchedAt }

function isFresh(entry) {
    return entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
}

// ── Token resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the HuggingFace token.
 * Prefers the encrypted key from the API keys store; falls back to process.env.HF_TOKEN.
 * Returns null when no token is available.
 */
async function getHFToken() {
    try {
        const result = await pool.query(
            'SELECT encrypted_key FROM user_api_keys WHERE provider = $1 LIMIT 1',
            ['huggingface']
        );
        if (result.rows.length > 0 && result.rows[0].encrypted_key) {
            const decrypted = decrypt(result.rows[0].encrypted_key);
            if (decrypted) return decrypted;
        }
    } catch (err) {
        logger.warn('[hf-enrichment] Could not load HF token from keys store (falling back to environment variable):', err.message);
    }
    return process.env.HF_TOKEN || null;
}

// ── HF API helpers ───────────────────────────────────────────────────────────

/**
 * Fetch model metadata from the HuggingFace API.
 * Returns { tags, downloads, likes, cardData, pipeline_tag, createdAt, lastModified }
 * Results are cached for 24 h.
 */
async function fetchHFModelMeta(hfModelId) {
    const cached = metaCache.get(hfModelId);
    if (isFresh(cached)) return cached.data;

    const headers = { 'Accept': 'application/json' };
    const token = await getHFToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`https://huggingface.co/api/models/${hfModelId}`, {
        headers,
        signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
        throw new Error(`HuggingFace API error for ${hfModelId}: ${res.status}`);
    }

    const json = await res.json();
    const data = {
        tags: json.tags || [],
        downloads: json.downloads ?? null,
        likes: json.likes ?? null,
        cardData: json.cardData || null,
        pipeline_tag: json.pipeline_tag || null,
        createdAt: json.createdAt || null,
        lastModified: json.lastModified || null,
    };

    metaCache.set(hfModelId, { data, fetchedAt: Date.now() });
    return data;
}

/**
 * Fetch the raw model card markdown from HuggingFace.
 * Returns the raw markdown string, or null if unavailable.
 * Results are cached for 24 h.
 */
async function fetchHFModelCard(hfModelId) {
    const cached = cardCache.get(hfModelId);
    if (isFresh(cached)) return cached.data;

    const headers = {};
    const token = await getHFToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`https://huggingface.co/${hfModelId}/raw/main/README.md`, {
        headers,
        signal: AbortSignal.timeout(15000),
    });

    const data = res.ok ? await res.text() : null;
    cardCache.set(hfModelId, { data, fetchedAt: Date.now() });
    return data;
}

// ── AI extraction ─────────────────────────────────────────────────────────────

const ENRICHMENT_SYSTEM_PROMPT =
    'You are extracting structured data from an AI model card. ' +
    'Extract strengths, weaknesses, best use cases, style keywords, and a one-sentence technical summary. ' +
    'Return ONLY valid JSON.';

/**
 * Extract structured enrichment data for an HF model.
 * Uses AI to parse the model card; falls back to tags when card is unavailable.
 * Returns null on any error (never throws).
 *
 * @returns {Promise<{
 *   strengths: string[],
 *   weaknesses: string[],
 *   bestFor: string[],
 *   keywords: string[],
 *   technicalDetails: string
 * }|null>}
 */
async function extractEnrichmentData(hfModelId) {
    try {
        const [meta, card] = await Promise.allSettled([
            fetchHFModelMeta(hfModelId),
            fetchHFModelCard(hfModelId),
        ]);

        const metaData = meta.status === 'fulfilled' ? meta.value : null;
        const cardText = card.status === 'fulfilled' ? card.value : null;

        // Fallback: derive keywords from tags only when no model card
        if (!cardText) {
            const tags = metaData?.tags || [];
            return {
                strengths: [],
                weaknesses: [],
                bestFor: [],
                keywords: tags.slice(0, 8),
                technicalDetails: metaData?.pipeline_tag
                    ? `A ${metaData.pipeline_tag} model.`
                    : '',
            };
        }

        // Truncate card to keep token usage reasonable
        const truncated = cardText.length > 6000 ? cardText.slice(0, 6000) + '\n...' : cardText;

        const userPrompt =
            `Model ID: ${hfModelId}\n` +
            (metaData ? `Tags: ${(metaData.tags || []).join(', ')}\n` : '') +
            `\nModel Card:\n${truncated}\n\n` +
            'Return JSON with keys: strengths (max 4 strings), weaknesses (max 3 strings), ' +
            'bestFor (max 4 strings), keywords (max 8 strings), technicalDetails (1 sentence string).';

        // Lazy-require to avoid circular dependency issues at module load time
        const { getActiveProvider, callAI } = require('../routes/ai');

        const providerConfig = await getActiveProvider('improve');
        if (!providerConfig) {
            logger.warn('[hf-enrichment] No active AI provider configured; skipping AI extraction');
            // Return tag-based fallback
            return {
                strengths: [],
                weaknesses: [],
                bestFor: [],
                keywords: (metaData?.tags || []).slice(0, 8),
                technicalDetails: '',
            };
        }

        const { content } = await callAI(providerConfig, ENRICHMENT_SYSTEM_PROMPT, userPrompt, 800, 0.2);

        // Strip markdown code fences if present
        const jsonText = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(jsonText);

        return {
            strengths: (parsed.strengths || []).slice(0, 4),
            weaknesses: (parsed.weaknesses || []).slice(0, 3),
            bestFor: (parsed.bestFor || []).slice(0, 4),
            keywords: (parsed.keywords || []).slice(0, 8),
            technicalDetails: String(parsed.technicalDetails || ''),
        };
    } catch (err) {
        logger.error(`[hf-enrichment] extractEnrichmentData failed for ${hfModelId}: ${err.message}`);
        return null;
    }
}

/**
 * Enrich a NightCafe model given its HuggingFace model ID.
 * Returns enrichment data or null.
 */
async function enrichModel(nightcafeModelId, hfModelId) {
    logger.debug(`[hf-enrichment] Enriching NightCafe model "${nightcafeModelId}" via HF model "${hfModelId}"`);
    return extractEnrichmentData(hfModelId);
}

/**
 * Expose the raw caches for debugging purposes.
 */
function getCacheContents() {
    const toPlain = (map) => {
        const obj = {};
        for (const [key, entry] of map.entries()) {
            obj[key] = {
                fetchedAt: new Date(entry.fetchedAt).toISOString(),
                ageMs: Date.now() - entry.fetchedAt,
                data: entry.data,
            };
        }
        return obj;
    };
    return { meta: toPlain(metaCache), card: toPlain(cardCache) };
}

module.exports = { fetchHFModelMeta, fetchHFModelCard, extractEnrichmentData, enrichModel, getCacheContents };
