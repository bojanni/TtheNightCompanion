#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nightcafe_companion',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
};

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const STATUS_MODE = process.argv.includes('--status');

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC');
  return new Set(result.rows.map((r) => r.filename));
}

async function applyMigration(client, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration failed (${filename}): ${error.message}`);
  }
}

async function run() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const files = getMigrationFiles();
    const applied = await getAppliedMigrations(client);
    const pending = files.filter((f) => !applied.has(f));

    if (STATUS_MODE) {
      console.log(`Migrations directory: ${MIGRATIONS_DIR}`);
      console.log(`Total: ${files.length}`);
      console.log(`Applied: ${applied.size}`);
      console.log(`Pending: ${pending.length}`);
      if (pending.length > 0) {
        console.log('Pending files:');
        for (const file of pending) {
          console.log(`- ${file}`);
        }
      }
      return;
    }

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);
    for (const filename of pending) {
      console.log(`- ${filename}`);
      await applyMigration(client, filename);
    }
    console.log('Migrations applied successfully.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
