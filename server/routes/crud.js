const express = require('express');
const { pool } = require('../db');
const logger = require('../lib/logger');
const { handlePgError } = require('../lib/pg-error-handler');
const { notFound } = require('../lib/app-error');

const createCrudRouter = (tableName, searchableColumns = []) => {
    const router = express.Router();

    const getTableSchema = async (tableName) => {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
        `, [tableName]);
        const schema = {};
        result.rows.forEach(row => {
            schema[row.column_name] = row.data_type;
        });
        return schema;
    };

    const buildConditions = (filters, valueStartIndex = 0) => {
        const conditions = [];
        const values = [];
        let idx = valueStartIndex + 1;

        Object.entries(filters).forEach(([key, value]) => {
            if (value === undefined || value === null) return;

            let operator = '=';
            let finalValue = value;

            if (typeof value === 'string') {
                if (value.startsWith('neq.')) {
                    operator = '!=';
                    finalValue = value.substring(4);
                } else if (value.startsWith('gt.')) {
                    operator = '>';
                    finalValue = value.substring(3);
                } else if (value.startsWith('gte.')) {
                    operator = '>=';
                    finalValue = value.substring(4);
                } else if (value.startsWith('lt.')) {
                    operator = '<';
                    finalValue = value.substring(3);
                } else if (value.startsWith('lte.')) {
                    operator = '<=';
                    finalValue = value.substring(4);
                } else if (value.startsWith('in.')) {
                    // in.(val1,val2)
                    operator = '= ANY';
                    const raw = value.substring(3);
                    if (raw.startsWith('(') && raw.endsWith(')')) {
                        finalValue = raw.substring(1, raw.length - 1).split(',');
                    } else {
                        finalValue = [raw];
                    }
                }
            }

            if (operator === '= ANY') {
                conditions.push(`${key} = ANY($${idx})`);
            } else {
                conditions.push(`${key} ${operator} $${idx}`);
            }

            values.push(finalValue);
            idx++;
        });

        return { conditions, values };
    };

    // GET all items with filtering, sorting, and pagination
    router.get('/', async (req, res, next) => {
        try {
            const { limit, offset, order, search, ...filters } = req.query;
            let queryText = `SELECT * FROM ${tableName}`;

            const { conditions, values } = buildConditions(filters);

            // Handle Search
            if (search && searchableColumns.length > 0) {
                const searchPlaceholders = searchableColumns.map((col, i) => `${col} ILIKE $${values.length + 1}`);
                conditions.push(`(${searchPlaceholders.join(' OR ')})`);
                values.push(`%${search}%`);
            }

            if (conditions.length > 0) {
                queryText += ` WHERE ${conditions.join(' AND ')}`;
            }

            // Handle Sorting
            const schema = await getTableSchema(tableName);
            const hasCreatedAt = !!schema['created_at'];

            if (order) {
                const [col, dir] = order.split('.');
                queryText += ` ORDER BY ${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
            } else if (hasCreatedAt) {
                queryText += ` ORDER BY created_at DESC`;
            }

            // Handle Pagination
            if (limit) {
                queryText += ` LIMIT $${values.length + 1}`;
                values.push(parseInt(limit));
            }
            if (offset) {
                queryText += ` OFFSET $${values.length + 1}`;
                values.push(parseInt(offset));
            }

            const result = await pool.query(queryText, values);
            res.json(result.rows);
        } catch (err) {
            // Retry without order if created_at failed (fallback)
            if (err.message && err.message.includes('column "created_at" does not exist')) {
                try {
                    const result = await pool.query(`SELECT * FROM ${tableName}`);
                    return res.json(result.rows);
                } catch (retryErr) {
                    return next(handlePgError(retryErr));
                }
            }
            next(handlePgError(err));
        }
    });

    // GET single item
    router.get('/:id', async (req, res, next) => {
        try {
            const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
            if (result.rows.length === 0) return next(notFound('Item'));
            res.json(result.rows[0]);
        } catch (err) {
            next(handlePgError(err));
        }
    });

    // CREATE item (Supports UPSERT via onConflict=col)
    router.post('/', async (req, res, next) => {
        try {
            const data = req.body;
            // Support both snake_case and camelCase param
            const onConflict = req.query.on_conflict || req.query.onConflict;
            const schema = await getTableSchema(tableName);

            const filterToKnownColumns = (row) => {
                const filtered = {};
                Object.entries(row || {}).forEach(([key, value]) => {
                    if (schema[key]) filtered[key] = value;
                });
                return filtered;
            };

            // Helper to process values based on schema
            const processValue = (key, value) => {
                if (schema[key] === 'jsonb' && typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            };

            let insertItems = (Array.isArray(data) ? data : [data]).map(filterToKnownColumns);
            if (insertItems.length === 0) return res.json([]);

            insertItems = insertItems.filter(item => Object.keys(item).length > 0);
            if (insertItems.length === 0) {
                return res.status(400).json({ error: 'No valid columns to insert' });
            }

            // Auto-inject user_id if required by schema but missing (Single Tenant Fix)
            if (schema['user_id']) {
                insertItems.forEach(item => {
                    if (!item.user_id) {
                        item.user_id = '88ea3bcb-d9a8-44b5-ac26-c90885a74686'; // Local Default User
                    }
                });
            }



            const columns = Object.keys(insertItems[0]);
            const values = [];
            const rowPlaceholders = [];

            insertItems.forEach((row) => {
                const rowValues = Object.entries(row).map(([key, val]) => processValue(key, val));
                const placeholders = rowValues.map((_, i) => `$${values.length + i + 1}`);
                rowPlaceholders.push(`(${placeholders.join(', ')})`);
                values.push(...rowValues);
            });

            let query = `
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES ${rowPlaceholders.join(', ')}
            `;

            if (onConflict) {
                // Generate ON CONFLICT (col) DO UPDATE SET ...
                const conflictCols = onConflict.split(',').map(s => s.trim());
                const updateColumns = columns.filter(c => !conflictCols.includes(c) && c !== 'id' && c !== 'created_at');

                if (updateColumns.length > 0) {
                    const updates = updateColumns.map(c => `${c} = EXCLUDED.${c}`).join(', ');
                    query += ` ON CONFLICT (${onConflict}) DO UPDATE SET ${updates}`;
                } else {
                    query += ` ON CONFLICT (${onConflict}) DO NOTHING`;
                }
            }

            query += ` RETURNING *`;

            const result = await pool.query(query, values);
            if (Array.isArray(data)) {
                res.status(201).json(result.rows);
            } else {
                res.status(201).json(result.rows[0]);
            }
        } catch (err) {
            next(handlePgError(err));
        }
    });

    // UPDATE item
    router.put('/:id', async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = req.body;
            delete data.id;
            delete data.created_at;
            delete data.updated_at;

            if (Object.keys(data).length === 0) return res.json({ status: 'no changes' });

            const schema = await getTableSchema(tableName);

            Object.keys(data).forEach((key) => {
                if (!schema[key]) delete data[key];
            });

            if (Object.keys(data).length === 0) return res.json({ status: 'no valid changes' });
            const hasUpdatedAt = !!schema['updated_at'];

            // Build SET clause
            const updates = [];
            const values = [];
            let idx = 1;

            Object.entries(data).forEach(([key, value]) => {
                updates.push(`${key} = $${idx}`);

                // Handle jsonb autoconversion
                if (schema[key] === 'jsonb' && typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
                idx++;
            });

            if (hasUpdatedAt) {
                updates.push(`updated_at = NOW()`);
            }

            values.push(id);

            const query = `
        UPDATE ${tableName}
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;

            logger.debug(`[CRUD] Updating ${tableName}: ${query}`);
            logger.debug(`[CRUD] Values: ${JSON.stringify(values)}`);

            const result = await pool.query(query, values);
            if (result.rows.length === 0) return next(notFound('Item'));
            res.json(result.rows[0]);
        } catch (err) {
            next(handlePgError(err));
        }
    });

    // UPDATE with filters (Batch update)
    router.put('/', async (req, res, next) => {
        try {
            const filters = req.query;
            const data = req.body;
            delete data.id;
            delete data.created_at;
            delete data.updated_at;

            if (Object.keys(filters).length === 0) {
                return res.status(400).json({ error: 'Update operation requires filters' });
            }

            if (Object.keys(data).length === 0) return res.json({ status: 'no changes' });

            const schema = await getTableSchema(tableName);

            Object.keys(data).forEach((key) => {
                if (!schema[key]) delete data[key];
            });

            if (Object.keys(data).length === 0) return res.json({ status: 'no valid changes' });
            const hasUpdatedAt = !!schema['updated_at'];

            const updates = [];
            const values = [];
            let idx = 1;

            Object.entries(data).forEach(([key, value]) => {
                updates.push(`${key} = $${idx}`);
                if (schema[key] === 'jsonb' && typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
                idx++;
            });

            if (hasUpdatedAt) {
                updates.push(`updated_at = NOW()`);
            }

            const { conditions, values: filterValues } = buildConditions(filters, idx - 1);
            if (conditions.length === 0) {
                return res.status(400).json({ error: 'Update operation requires valid filters' });
            }

            values.push(...filterValues);

            const query = `
                UPDATE ${tableName}
                SET ${updates.join(', ')}
                WHERE ${conditions.join(' AND ')}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            res.json(result.rows);
        } catch (err) {
            next(handlePgError(err));
        }
    });

    // DELETE with filters (e.g. DELETE /?prompt_id=123)
    router.delete('/', async (req, res, next) => {
        try {
            const filters = req.query;
            if (Object.keys(filters).length === 0) {
                return res.status(400).json({ error: 'Delete operation requires filters' });
            }

            const { conditions, values } = buildConditions(filters);

            if (conditions.length === 0) {
                return res.status(400).json({ error: 'Delete operation requires valid filters' });
            }

            const query = `DELETE FROM ${tableName} WHERE ${conditions.join(' AND ')}`;
            await pool.query(query, values);
            res.json({ status: 'deleted' });
        } catch (err) {
            next(handlePgError(err));
        }
    });

    // DELETE item
    router.delete('/:id', async (req, res, next) => {
        try {
            const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [req.params.id]);
            if (result.rowCount === 0) return next(notFound('Item'));
            res.json({ status: 'deleted' });
        } catch (err) {
            next(handlePgError(err));
        }
    });

    return router;
};

module.exports = createCrudRouter;
