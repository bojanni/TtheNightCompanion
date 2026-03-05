require('dotenv').config();

const logger = require('./lib/logger');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { pool } = require('./db');
const path = require('path');
const { initSchema } = require('./db-init');
const errorMiddleware = require('./middleware/error-handler');
const { handlePgError } = require('./lib/pg-error-handler');

const app = express();
const port = process.env.PORT || 3000;
let httpServer = null;
let isShuttingDown = false;

let dbReady = false;
let dbInitError = null;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const createCrudRouter = require('./routes/crud');
const apiKeysRouter = require('./routes/api-keys');
const localEndpointsRouter = require('./routes/local-endpoints');
const ncModelsRouter = require('./routes/nc-models');
const { importModels } = require('./scripts/import_nc_models');

// Custom Prompts Endpoint for Similarity Search
app.get('/api/prompts/similar', async (req, res, next) => {
  try {
    const { content, limit = 5, threshold = 0.5 } = req.query;
    if (!content) {
      return res.status(400).json({ error: 'content query parameter is required' });
    }
    // PostgreSQL pg_trgm similarity() function returns a value from 0 to 1
    const result = await pool.query(`
            SELECT id, title, content, similarity(content, $1) as sim 
            FROM prompts 
            WHERE similarity(content, $1) > $2
            ORDER BY sim DESC 
            LIMIT $3
        `, [content, parseFloat(threshold), parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    next(handlePgError(err));
  }
});

app.use('/api/prompts', createCrudRouter('prompts', ['title', 'content', 'notes']));
app.use('/api/tags', createCrudRouter('tags', ['name']));
app.use('/api/characters', createCrudRouter('characters', ['name', 'description']));
app.use('/api/character_details', createCrudRouter('character_details'));
app.use('/api/gallery_items', createCrudRouter('gallery_items', ['title', 'prompt_used', 'notes', 'model_used', 'model', 'aspect_ratio', 'start_image', 'metadata', 'media_type', 'rating', 'local_path', 'width', 'height', 'character_id', 'collection_id', 'video_url', 'video_local_path', 'thumbnail_url', 'duration_seconds', 'storage_mode']));
app.use('/api/collections', createCrudRouter('collections'));
app.use('/api/prompt_tags', createCrudRouter('prompt_tags'));
app.use('/api/prompt_versions', createCrudRouter('prompt_versions'));
app.use('/api/style_profiles', createCrudRouter('style_profiles'));
app.use('/api/style_keywords', createCrudRouter('style_keywords'));
app.use('/api/style_learning', createCrudRouter('style_learning'));
app.use('/api/batch_tests', createCrudRouter('batch_tests'));
app.use('/api/batch_test_prompts', createCrudRouter('batch_test_prompts'));
app.use('/api/batch_test_results', createCrudRouter('batch_test_results'));
app.use('/api/model_usage', createCrudRouter('model_usage'));
app.use('/api/user_profiles', createCrudRouter('user_profiles'));
app.use('/api/nc-models', ncModelsRouter);
app.use('/api/models', require('./routes/model-enrichment'));

// Rate limiting setup for sensitive routes
const apiKeysLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // High limit to prevent accidental blocking in developer/local use
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for API keys, please try again later.' }
});

const { ipKeyGenerator } = require('express-rate-limit');
const providerAwareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Higher ceiling for active usage
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Provider-aware limiting; fallback to IPv4-safe helper for IPs (avoids IPv6 bypass)
    const provider = req.body?.provider || req.query?.provider;
    if (provider) return String(provider).toLowerCase();
    return ipKeyGenerator(req, res);
  },
  skip: async (req) => {
    const provider = String(req.body?.provider || req.query?.provider || '').toLowerCase();

    // Skip rate limiting entirely for local models
    if (['ollama', 'lmstudio', 'local', 'localhost'].includes(provider)) {
      return true;
    }

    try {
      // Fast check if it's the very first start/generations of the app.
      // If the usage log is totally empty, give them a free pass right away.
      const res = await pool.query('SELECT 1 FROM api_usage_log LIMIT 1');
      if (res.rowCount === 0) {
        return true; // Unlimited on first start
      }
    } catch (e) {
      // Fallback to rate limiting if the DB check fails
    }

    return false;
  },
  message: {
    error: 'Rate limit bereikt voor deze externe AI provider. Probeer een lokaal model (Ollama/LM Studio) als alternatief of wacht 15 minuten.'
  }
});

// API Keys & Local Endpoints
app.use('/api/user_api_keys', apiKeysLimiter, apiKeysRouter);
app.use('/api/user_local_endpoints', localEndpointsRouter);
app.use('/api/ai', providerAwareLimiter, require('./routes/ai'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/usage', require('./routes/usage'));

// Server-Sent Events voor realtime extensie-updates
const sseClients = new Set();
app.set('sseClients', sseClients);

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:5173');
  res.flushHeaders();

  // Stuur ping elke 30 seconden
  const ping = setInterval(() => res.write('data: {"type":"ping"}\n\n'), 30000);

  sseClients.add(res);
  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

app.use('/api/import', require('./routes/import'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Fallback compatibility for older image URLs that used /api/images or /api/videos
app.use('/api/images', express.static(path.join(__dirname, '../uploads/images')));
app.use('/api/videos', express.static(path.join(__dirname, '../uploads/videos')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), dbReady, dbInitError: dbInitError ? dbInitError.message : null });
});

// Test DB connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Database connection error:', err);
    res.status(500).json({
      error: 'Database connection failed',
      details: err.message,
      hint: 'Ensure PostgreSQL is running and credentials in .env are correct'
    });
  }
});

// Error handling middleware should be the last app.use()
app.use(errorMiddleware);

httpServer = app.listen(port, () => {
  logger.info(`✅ Server running on http://localhost:${port}`);
});

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close SSE connections so clients do not hang during shutdown.
    for (const client of sseClients) {
      try {
        client.end();
      } catch (e) {
        // Ignore individual client close failures.
      }
    }
    sseClients.clear();

    await new Promise((resolve) => {
      if (!httpServer) {
        resolve();
        return;
      }

      httpServer.close((err) => {
        if (err) {
          logger.error('Error while closing HTTP server:', err);
        }
        resolve();
      });
    });

    await pool.end();
    logger.info('✅ PostgreSQL pool closed. Shutdown complete.');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Graceful shutdown failed:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

// Initialize DB and start background tasks
initSchema().then(async () => {
  dbReady = true;
  logger.info('✅ Database check complete.');
  
  // Auto-import NC models if CSV exists
  try {
    await importModels(false);
  } catch (err) {
    logger.warn('⚠️  NC models import failed (non-fatal):', err.message);
  }
}).catch(err => {
  dbInitError = err;
  logger.error('❌ Failed to initialize database:', err);
});
