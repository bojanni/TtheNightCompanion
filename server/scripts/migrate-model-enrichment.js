'use strict';

require('dotenv').config({ path: 'server/.env' });
const { pool } = require('../db');

async function migrate() {
    try {
        console.log('Starting migration: create model_enrichments table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS model_enrichments (
                id                  SERIAL PRIMARY KEY,
                nightcafe_model_id  TEXT UNIQUE NOT NULL,
                hf_model_id         TEXT,
                strengths           TEXT[],
                weaknesses          TEXT[],
                best_for            TEXT[],
                keywords            TEXT[],
                technical_details   TEXT,
                hf_downloads        INTEGER,
                hf_likes            INTEGER,
                hf_tags             TEXT[],
                last_enriched_at    TIMESTAMP,
                enriched_at         TIMESTAMP,
                retry_count         INTEGER DEFAULT 0,
                next_retry_at       TIMESTAMP,
                last_error          TEXT,
                enrichment_status   TEXT DEFAULT 'pending'
                    CHECK (enrichment_status IN ('pending', 'enriched', 'not_on_hf', 'error'))
            );
        `);

        // Backfill compatible columns for existing installations.
        await pool.query(`ALTER TABLE model_enrichments ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP`);
        await pool.query(`ALTER TABLE model_enrichments ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE model_enrichments ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP`);
        await pool.query(`ALTER TABLE model_enrichments ADD COLUMN IF NOT EXISTS last_error TEXT`);

        console.log('model_enrichments table created (or already exists).');
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
