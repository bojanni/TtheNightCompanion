'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const logger = require('../lib/logger');
const { enrichModel, getCacheContents, fetchHFModelMeta } = require('../services/hf-enrichment');
const { HF_MODEL_MAP } = require('../lib/hf-model-map');
const { pool } = require('../db');

/** Milliseconds to wait between HuggingFace requests to respect rate limits. */
const RATE_LIMIT_DELAY_MS = 2000;
const RETRY_QUEUE_TICK_MS = Number(process.env.HF_ENRICH_RETRY_TICK_MS || 10000);
const RETRY_BASE_DELAY_MS = Number(process.env.HF_ENRICH_RETRY_BASE_MS || 30000);
const RETRY_MAX_DELAY_MS = Number(process.env.HF_ENRICH_RETRY_MAX_MS || 10 * 60 * 1000);
const RETRY_MAX_ATTEMPTS = Number(process.env.HF_ENRICH_MAX_RETRIES || 5);
const STALE_AFTER_HOURS = Number(process.env.HF_ENRICH_STALE_AFTER_HOURS || 168);

// In-memory retry queue: modelId -> queued retry payload
const retryQueue = new Map();
let retryQueueProcessing = false;

function computeRetryDelayMs(attempt) {
    const safeAttempt = Math.max(1, Number(attempt) || 1);
    return Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, safeAttempt - 1), RETRY_MAX_DELAY_MS);
}

function buildRetryEntry(modelId, hfModelId, attempt, errorMessage) {
    const delayMs = computeRetryDelayMs(attempt);
    return {
        modelId,
        hfModelId,
        attempt,
        lastError: errorMessage || 'unknown_error',
        queuedAt: new Date(),
        nextRetryAt: new Date(Date.now() + delayMs),
    };
}

/** Rate limiter for enrichment endpoints that touch the database. */
const enrichmentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many enrichment requests, please try again later.' },
});

/**
 * Upsert enrichment data for a NightCafe model into the model_enrichments table.
 */
async function saveEnrichment(nightcafeModelId, hfModelId, enrichmentData, hfMeta, options = {}) {
    const resolvedStatus = options.status ?? (enrichmentData ? 'enriched' : 'error');
    const attemptTimestamp = options.attemptedAt || new Date();
    const enrichedAt = options.enrichedAt || (enrichmentData ? attemptTimestamp : null);
    const retryCount = Number.isInteger(options.retryCount) ? options.retryCount : 0;
    const nextRetryAt = options.nextRetryAt || null;
    const lastError = options.lastError || null;

    await pool.query(
        `INSERT INTO model_enrichments
            (nightcafe_model_id, hf_model_id, strengths, weaknesses, best_for, keywords,
             technical_details, hf_downloads, hf_likes, hf_tags, last_enriched_at, enriched_at,
             enrichment_status, retry_count, next_retry_at, last_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (nightcafe_model_id) DO UPDATE SET
            hf_model_id       = EXCLUDED.hf_model_id,
            strengths         = EXCLUDED.strengths,
            weaknesses        = EXCLUDED.weaknesses,
            best_for          = EXCLUDED.best_for,
            keywords          = EXCLUDED.keywords,
            technical_details = EXCLUDED.technical_details,
            hf_downloads      = EXCLUDED.hf_downloads,
            hf_likes          = EXCLUDED.hf_likes,
            hf_tags           = EXCLUDED.hf_tags,
            last_enriched_at  = EXCLUDED.last_enriched_at,
            enriched_at       = COALESCE(EXCLUDED.enriched_at, model_enrichments.enriched_at),
            enrichment_status = EXCLUDED.enrichment_status,
            retry_count       = EXCLUDED.retry_count,
            next_retry_at     = EXCLUDED.next_retry_at,
            last_error        = EXCLUDED.last_error`,
        [
            nightcafeModelId,
            hfModelId,
            enrichmentData?.strengths ?? null,
            enrichmentData?.weaknesses ?? null,
            enrichmentData?.bestFor ?? null,
            enrichmentData?.keywords ?? null,
            enrichmentData?.technicalDetails ?? null,
            hfMeta?.downloads ?? null,
            hfMeta?.likes ?? null,
            hfMeta?.tags ?? null,
            attemptTimestamp,
            enrichedAt,
            resolvedStatus,
            retryCount,
            nextRetryAt,
            lastError,
        ]
    );
}

async function runSingleEnrichmentAttempt(modelId, hfModelId) {
    const [enrichResult, metaResult] = await Promise.allSettled([
        enrichModel(modelId, hfModelId),
        fetchHFModelMeta(hfModelId),
    ]);

    return {
        enrichmentData: enrichResult.status === 'fulfilled' ? enrichResult.value : null,
        metaData: metaResult.status === 'fulfilled' ? metaResult.value : null,
        enrichmentError: enrichResult.status === 'rejected' ? enrichResult.reason : null,
        metaError: metaResult.status === 'rejected' ? metaResult.reason : null,
    };
}

async function queueRetry(modelId, hfModelId, attempt, errorMessage) {
    const entry = buildRetryEntry(modelId, hfModelId, attempt, errorMessage);
    retryQueue.set(modelId, entry);

    await saveEnrichment(modelId, hfModelId, null, null, {
        status: 'error',
        retryCount: attempt,
        nextRetryAt: entry.nextRetryAt,
        lastError: entry.lastError,
    }).catch(err => {
        logger.warn(`[model-enrichment] Retry queue DB save warning for ${modelId}: ${err.message}`);
    });

    logger.warn(
        `[model-enrichment] Queued retry for ${modelId} (attempt ${attempt}/${RETRY_MAX_ATTEMPTS}) at ${entry.nextRetryAt.toISOString()}: ${entry.lastError}`
    );
}

async function processRetryQueue() {
    if (retryQueueProcessing || retryQueue.size === 0) {
        return;
    }

    retryQueueProcessing = true;
    try {
        const now = Date.now();
        const dueEntries = Array.from(retryQueue.values())
            .filter((entry) => entry.nextRetryAt.getTime() <= now)
            .sort((a, b) => a.nextRetryAt - b.nextRetryAt);

        for (const entry of dueEntries) {
            const { modelId, hfModelId, attempt } = entry;
            const { enrichmentData, metaData, enrichmentError, metaError } = await runSingleEnrichmentAttempt(modelId, hfModelId);

            if (enrichmentData) {
                await saveEnrichment(modelId, hfModelId, enrichmentData, metaData, {
                    status: 'enriched',
                    enrichedAt: new Date(),
                    retryCount: 0,
                    nextRetryAt: null,
                    lastError: null,
                }).catch(err => {
                    logger.warn(`[model-enrichment] Retry success DB save warning for ${modelId}: ${err.message}`);
                });
                retryQueue.delete(modelId);
                logger.info(`[model-enrichment] Retry succeeded for ${modelId}`);
                continue;
            }

            const errorMessage = String(
                enrichmentError?.message || metaError?.message || entry.lastError || 'enrichment_failed'
            );

            if (attempt >= RETRY_MAX_ATTEMPTS) {
                await saveEnrichment(modelId, hfModelId, null, metaData, {
                    status: 'error',
                    retryCount: attempt,
                    nextRetryAt: null,
                    lastError: `max_retries_exhausted: ${errorMessage}`,
                }).catch(err => {
                    logger.warn(`[model-enrichment] Retry exhausted DB save warning for ${modelId}: ${err.message}`);
                });

                retryQueue.delete(modelId);
                logger.error(`[model-enrichment] Retry exhausted for ${modelId}: ${errorMessage}`);
                continue;
            }

            await queueRetry(modelId, hfModelId, attempt + 1, errorMessage);
        }
    } catch (err) {
        logger.error(`[model-enrichment] processRetryQueue failed: ${err.message}`);
    } finally {
        retryQueueProcessing = false;
    }
}

async function hydrateRetryQueueFromDatabase() {
    try {
        const result = await pool.query(
            `SELECT nightcafe_model_id, hf_model_id, retry_count, next_retry_at, last_error
             FROM model_enrichments
             WHERE enrichment_status = 'error'
               AND hf_model_id IS NOT NULL
               AND retry_count < $1
               AND next_retry_at IS NOT NULL`,
            [RETRY_MAX_ATTEMPTS]
        );

        for (const row of result.rows) {
            const modelId = row.nightcafe_model_id;
            const entry = {
                modelId,
                hfModelId: row.hf_model_id,
                attempt: Math.max(1, Number(row.retry_count) || 1),
                lastError: row.last_error || 'rehydrated_retry',
                queuedAt: new Date(),
                nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : new Date(),
            };
            retryQueue.set(modelId, entry);
        }

        if (result.rowCount > 0) {
            logger.info(`[model-enrichment] Rehydrated ${result.rowCount} retries from database`);
        }
    } catch (err) {
        logger.warn(`[model-enrichment] Failed to rehydrate retry queue: ${err.message}`);
    }
}

setInterval(processRetryQueue, RETRY_QUEUE_TICK_MS).unref();
hydrateRetryQueueFromDatabase();

// GET /api/models/enrichments
// Return all stored model enrichments from the database.
router.get('/enrichments', enrichmentLimiter, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM model_enrichments ORDER BY nightcafe_model_id ASC'
        );
        const staleCutoff = Date.now() - (STALE_AFTER_HOURS * 60 * 60 * 1000);
        const rows = result.rows.map((row) => ({
            ...row,
            is_stale: !row.enriched_at || new Date(row.enriched_at).getTime() < staleCutoff,
        }));
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/models/enrich/:modelId
// Enrich a single NightCafe model by its model ID.
router.get('/enrich/:modelId', enrichmentLimiter, async (req, res, next) => {
    try {
        const { modelId } = req.params;
        const hfModelId = HF_MODEL_MAP[modelId];

        if (hfModelId === undefined) {
            return res.status(404).json({ error: `Unknown model ID: ${modelId}` });
        }
        if (hfModelId === null) {
            // Mark as not_on_hf in the DB
            await pool.query(
                `INSERT INTO model_enrichments
                    (nightcafe_model_id, hf_model_id, enrichment_status, last_enriched_at, enriched_at, retry_count, next_retry_at, last_error)
                 VALUES ($1, NULL, 'not_on_hf', $2, NULL, 0, NULL, NULL)
                 ON CONFLICT (nightcafe_model_id) DO UPDATE SET
                    hf_model_id = NULL,
                    enrichment_status = 'not_on_hf',
                    last_enriched_at = $2,
                    enriched_at = NULL,
                    retry_count = 0,
                    next_retry_at = NULL,
                    last_error = NULL`,
                [modelId, new Date()]
            ).catch(err => logger.warn(`[model-enrichment] DB upsert warning for ${modelId}: ${err.message}`));
            return res.status(422).json({ error: `Model ${modelId} is not available on HuggingFace` });
        }

        const { enrichmentData, metaData, enrichmentError, metaError } = await runSingleEnrichmentAttempt(modelId, hfModelId);

        if (!enrichmentData) {
            const errorMessage = String(enrichmentError?.message || metaError?.message || 'enrichment_failed');
            await queueRetry(modelId, hfModelId, 1, errorMessage);
            return res.status(202).json({
                modelId,
                hfModelId,
                status: 'queued_for_retry',
                error: errorMessage,
            });
        }

        await saveEnrichment(modelId, hfModelId, enrichmentData, metaData, {
            status: 'enriched',
            enrichedAt: new Date(),
            retryCount: 0,
            nextRetryAt: null,
            lastError: null,
        })
            .catch(err => logger.warn(`[model-enrichment] DB save warning for ${modelId}: ${err.message}`));

        retryQueue.delete(modelId);
        res.json({ modelId, hfModelId, enrichment: enrichmentData });
    } catch (err) {
        next(err);
    }
});

// GET /api/models/enrich-all
// Enrich all models that have a HuggingFace mapping, with a 2 s delay between
// requests to respect rate limits.  Returns a JSON array of progress objects.
router.get('/enrich-all', async (req, res, next) => {
    try {
        const results = [];
        const entries = Object.entries(HF_MODEL_MAP).filter(([, hfId]) => hfId !== null);

        for (let i = 0; i < entries.length; i++) {
            const [modelId, hfModelId] = entries[i];
            const result = { modelId, hfModelId, status: 'ok', enrichment: null };
            try {
                const { enrichmentData, metaData, enrichmentError, metaError } = await runSingleEnrichmentAttempt(modelId, hfModelId);

                result.enrichment = enrichmentData;
                if (!enrichmentData) {
                    result.status = 'queued_for_retry';
                    const errorMessage = String(enrichmentError?.message || metaError?.message || 'enrichment_failed');
                    result.error = errorMessage;
                    await queueRetry(modelId, hfModelId, 1, errorMessage);
                }

                await saveEnrichment(modelId, hfModelId, enrichmentData, metaData, {
                    status: enrichmentData ? 'enriched' : 'error',
                    enrichedAt: enrichmentData ? new Date() : null,
                    retryCount: enrichmentData ? 0 : 1,
                    nextRetryAt: enrichmentData ? null : retryQueue.get(modelId)?.nextRetryAt || null,
                    lastError: enrichmentData ? null : result.error || 'enrichment_failed',
                })
                    .catch(err => logger.warn(`[model-enrichment] DB save warning for ${modelId}: ${err.message}`));

                if (enrichmentData) {
                    retryQueue.delete(modelId);
                }
            } catch (err) {
                result.status = 'error';
                result.error = err.message;
                logger.error(`[model-enrichment] enrich-all error for ${modelId}: ${err.message}`);
            }
            results.push(result);

            // Delay between requests to respect HF rate limits
            if (i < entries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
            }
        }

        res.json(results);
    } catch (err) {
        next(err);
    }
});

// GET /api/models/hf-cache
// Return current HF enrichment cache contents for debugging.
router.get('/hf-cache', (req, res) => {
    res.json(getCacheContents());
});

// GET /api/models/enrichment-retry-queue
// Return in-memory retry queue status for debugging/operations.
router.get('/enrichment-retry-queue', (req, res) => {
    const queue = Array.from(retryQueue.values())
        .sort((a, b) => a.nextRetryAt - b.nextRetryAt)
        .map(entry => ({
            modelId: entry.modelId,
            hfModelId: entry.hfModelId,
            attempt: entry.attempt,
            lastError: entry.lastError,
            queuedAt: entry.queuedAt,
            nextRetryAt: entry.nextRetryAt,
        }));

    res.json({
        size: queue.length,
        maxAttempts: RETRY_MAX_ATTEMPTS,
        tickMs: RETRY_QUEUE_TICK_MS,
        queue,
    });
});

module.exports = router;
