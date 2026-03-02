'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { enrichModel, getCacheContents } = require('../services/hf-enrichment');
const { HF_MODEL_MAP } = require('../lib/hf-model-map');

/** Milliseconds to wait between HuggingFace requests to respect rate limits. */
const RATE_LIMIT_DELAY_MS = 2000;

// GET /api/models/enrich/:modelId
// Enrich a single NightCafe model by its model ID.
router.get('/enrich/:modelId', async (req, res, next) => {
    try {
        const { modelId } = req.params;
        const hfModelId = HF_MODEL_MAP[modelId];

        if (hfModelId === undefined) {
            return res.status(404).json({ error: `Unknown model ID: ${modelId}` });
        }
        if (hfModelId === null) {
            return res.status(422).json({ error: `Model ${modelId} is not available on HuggingFace` });
        }

        const data = await enrichModel(modelId, hfModelId);
        if (!data) {
            return res.status(500).json({ error: 'Enrichment failed' });
        }

        res.json({ modelId, hfModelId, enrichment: data });
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
                result.enrichment = await enrichModel(modelId, hfModelId);
                if (!result.enrichment) result.status = 'failed';
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
