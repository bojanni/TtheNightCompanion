const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const logger = require('../lib/logger');

function normalizeReason(reason) {
  if (typeof reason !== 'string') return 'manual';
  const trimmed = reason.trim().toLowerCase();
  if (['manual', 'auto', 'diversity'].includes(trimmed)) return trimmed;
  return 'manual';
}

function parseExpiresAt(expiresAt) {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return null;
  const date = new Date(String(expiresAt));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// GET /api/greylist -> all entries
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, prompt_id, reason, greylisted_at, expires_at
      FROM prompt_greylist
      ORDER BY greylisted_at DESC
    `);
    res.json({ result: result.rows });
  } catch (error) {
    logger.error('Failed to fetch greylist:', error);
    res.status(500).json({ error: 'Failed to fetch greylist', details: error.message });
  }
});

// GET /api/greylist/active -> non-expired entries
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, prompt_id, reason, greylisted_at, expires_at
      FROM prompt_greylist
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY greylisted_at DESC
    `);
    res.json({ result: result.rows });
  } catch (error) {
    logger.error('Failed to fetch active greylist entries:', error);
    res.status(500).json({ error: 'Failed to fetch active greylist', details: error.message });
  }
});

// POST /api/greylist -> add/update entry
router.post('/', async (req, res) => {
  try {
    const { prompt_id: promptId, reason, expires_at: expiresAt } = req.body || {};

    if (!promptId || typeof promptId !== 'string') {
      return res.status(400).json({ error: 'prompt_id is required' });
    }

    const normalizedReason = normalizeReason(reason);
    const normalizedExpiresAt = parseExpiresAt(expiresAt);

    const result = await pool.query(`
      INSERT INTO prompt_greylist (prompt_id, reason, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (prompt_id)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        expires_at = EXCLUDED.expires_at,
        greylisted_at = NOW()
      RETURNING id, prompt_id, reason, greylisted_at, expires_at
    `, [promptId, normalizedReason, normalizedExpiresAt]);

    res.status(201).json({ result: result.rows[0] });
  } catch (error) {
    logger.error('Failed to upsert greylist entry:', error);
    res.status(500).json({ error: 'Failed to save greylist entry', details: error.message });
  }
});

// DELETE /api/greylist/:prompt_id -> remove entry
router.delete('/:prompt_id', async (req, res) => {
  try {
    const { prompt_id: promptId } = req.params;
    if (!promptId) {
      return res.status(400).json({ error: 'prompt_id is required' });
    }

    await pool.query('DELETE FROM prompt_greylist WHERE prompt_id = $1', [promptId]);
    res.json({ result: { prompt_id: promptId, removed: true } });
  } catch (error) {
    logger.error('Failed to remove greylist entry:', error);
    res.status(500).json({ error: 'Failed to remove greylist entry', details: error.message });
  }
});

module.exports = router;
