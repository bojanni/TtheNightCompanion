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
async function saveEnrichment(nightcafeModelId, hfModelId, enrichmentData, hfMeta, status) {
    const resolvedStatus = status ?? (enrichmentData ? 'enriched' : 'error');
    const now = new Date();

    await pool.query(
        `INSERT INTO model_enrichments
            (nightcafe_model_id, hf_model_id, strengths, weaknesses, best_for, keywords,
             technical_details, hf_downloads, hf_likes, hf_tags, last_enriched_at, enrichment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            enrichment_status = EXCLUDED.enrichment_status`,
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
            now,
            resolvedStatus,
        ]
    );
}

// GET /api/models/enrichments
// Return all stored model enrichments from the database.
router.get('/enrichments', enrichmentLimiter, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM model_enrichments ORDER BY nightcafe_model_id ASC'
        );
        res.json(result.rows);
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
                `INSERT INTO model_enrichments (nightcafe_model_id, hf_model_id, enrichment_status, last_enriched_at)
                 VALUES ($1, NULL, 'not_on_hf', $2)
                 ON CONFLICT (nightcafe_model_id) DO UPDATE SET
                    hf_model_id = NULL, enrichment_status = 'not_on_hf', last_enriched_at = $2`,
                [modelId, new Date()]
            ).catch(err => logger.warn(`[model-enrichment] DB upsert warning for ${modelId}: ${err.message}`));
            return res.status(422).json({ error: `Model ${modelId} is not available on HuggingFace` });
        }

        const [enrichResult, metaResult] = await Promise.allSettled([
            enrichModel(modelId, hfModelId),
            fetchHFModelMeta(hfModelId),
        ]);

        const enrichmentData = enrichResult.status === 'fulfilled' ? enrichResult.value : null;
        const metaData = metaResult.status === 'fulfilled' ? metaResult.value : null;

        if (!enrichmentData) {
            return res.status(500).json({ error: 'Enrichment failed' });
        }

        await saveEnrichment(modelId, hfModelId, enrichmentData, metaData)
            .catch(err => logger.warn(`[model-enrichment] DB save warning for ${modelId}: ${err.message}`));

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
                const [enrichResult, metaResult] = await Promise.allSettled([
                    enrichModel(modelId, hfModelId),
                    fetchHFModelMeta(hfModelId),
                ]);
                const enrichmentData = enrichResult.status === 'fulfilled' ? enrichResult.value : null;
                const metaData = metaResult.status === 'fulfilled' ? metaResult.value : null;

                result.enrichment = enrichmentData;
                if (!enrichmentData) result.status = 'failed';

                await saveEnrichment(modelId, hfModelId, enrichmentData, metaData)
                    .catch(err => logger.warn(`[model-enrichment] DB save warning for ${modelId}: ${err.message}`));
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

module.exports = router;
