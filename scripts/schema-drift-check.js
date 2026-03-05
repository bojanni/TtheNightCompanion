#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseColumnsFromTableBody(tableBody) {
  const columns = new Set();
  const keywordStarts = new Set(['primary', 'foreign', 'constraint', 'unique', 'check']);

  for (const rawLine of tableBody.split('\n')) {
    const line = rawLine.replace(/--.*$/, '').trim();
    if (!line) continue;

    const normalized = line.replace(/,$/, '').trim();
    if (!normalized) continue;

    const firstToken = normalized.split(/\s+/)[0].replace(/^"|"$/g, '');
    if (keywordStarts.has(firstToken.toLowerCase())) {
      continue;
    }

    if (/^[a-z_][a-z0-9_]*$/i.test(firstToken)) {
      columns.add(firstToken);
    }
  }

  return columns;
}

function extractCreateTableColumns(sourceText) {
  const tableMap = new Map();
  const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi;

  let match;
  while ((match = createTableRegex.exec(sourceText)) !== null) {
    const table = match[1];
    const body = match[2];
    tableMap.set(table, parseColumnsFromTableBody(body));
  }

  return tableMap;
}

function extractDbInitExpectedSchema(dbInitSource) {
  const tableMap = extractCreateTableColumns(dbInitSource);
  const addColumnRegex = /addColumn\s*\(\s*pool\s*,\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]\s*,\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]\s*,/g;

  let match;
  while ((match = addColumnRegex.exec(dbInitSource)) !== null) {
    const table = match[1];
    const column = match[2];
    if (!tableMap.has(table)) {
      tableMap.set(table, new Set());
    }
    tableMap.get(table).add(column);
  }

  return tableMap;
}

function summarizeSchemaDrift(sqlSchema, dbInitSchema) {
  const missingTablesInDbInit = [];
  const missingTablesInSql = [];
  const missingColumnsInDbInit = [];
  const missingColumnsInSql = [];

  for (const table of sqlSchema.keys()) {
    if (!dbInitSchema.has(table)) {
      missingTablesInDbInit.push(table);
    }
  }

  for (const table of dbInitSchema.keys()) {
    if (!sqlSchema.has(table)) {
      missingTablesInSql.push(table);
    }
  }

  for (const [table, sqlColumns] of sqlSchema.entries()) {
    if (!dbInitSchema.has(table)) continue;
    const dbColumns = dbInitSchema.get(table);

    for (const column of sqlColumns) {
      if (!dbColumns.has(column)) {
        missingColumnsInDbInit.push(`${table}.${column}`);
      }
    }

    for (const column of dbColumns) {
      if (!sqlColumns.has(column)) {
        missingColumnsInSql.push(`${table}.${column}`);
      }
    }
  }

  return {
    missingTablesInDbInit,
    missingTablesInSql,
    missingColumnsInDbInit,
    missingColumnsInSql,
  };
}

function formatList(items) {
  if (items.length === 0) return null;
  if (items.length <= 20) return items.join(', ');
  return `${items.slice(0, 20).join(', ')} ... (+${items.length - 20} more)`;
}

function runSchemaDriftCheck() {
  const repoRoot = path.resolve(__dirname, '..');
  const sqlPath = path.join(repoRoot, 'create-schema.sql');
  const dbInitPath = path.join(repoRoot, 'server', 'db-init.js');

  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const dbInitText = fs.readFileSync(dbInitPath, 'utf8');

  const sqlSchema = extractCreateTableColumns(sqlText);
  const dbInitSchema = extractDbInitExpectedSchema(dbInitText);
  const drift = summarizeSchemaDrift(sqlSchema, dbInitSchema);

  const hasDrift =
    drift.missingTablesInDbInit.length ||
    drift.missingTablesInSql.length ||
    drift.missingColumnsInDbInit.length ||
    drift.missingColumnsInSql.length;

  if (!hasDrift) {
    console.log('Schema drift check passed.');
    return;
  }

  console.error('Schema drift detected between create-schema.sql and server/db-init.js');

  const onlyInSqlTables = formatList(drift.missingTablesInDbInit);
  if (onlyInSqlTables) {
    console.error(`- Tables only in create-schema.sql: ${onlyInSqlTables}`);
  }

  const onlyInDbInitTables = formatList(drift.missingTablesInSql);
  if (onlyInDbInitTables) {
    console.error(`- Tables only in db-init.js: ${onlyInDbInitTables}`);
  }

  const onlyInSqlColumns = formatList(drift.missingColumnsInDbInit);
  if (onlyInSqlColumns) {
    console.error(`- Columns only in create-schema.sql: ${onlyInSqlColumns}`);
  }

  const onlyInDbInitColumns = formatList(drift.missingColumnsInSql);
  if (onlyInDbInitColumns) {
    console.error(`- Columns only in db-init.js: ${onlyInDbInitColumns}`);
  }

  process.exit(1);
}

runSchemaDriftCheck();
