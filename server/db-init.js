require('dotenv').config({ path: __dirname + '/.env' });
const { Client } = require('pg');

const DB_CONFIG = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
};
const DB_NAME = process.env.DB_NAME || 'nightcafe_companion';

async function createDatabaseIfNotExists() {
    const client = new Client({ ...DB_CONFIG, database: 'postgres' });
    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
        if (res.rowCount === 0) {
            console.log(`Creating database "${DB_NAME}"...`);
            await client.query(`CREATE DATABASE "${DB_NAME}"`);
            console.log('Database created.');
        } else {
            console.log(`Database "${DB_NAME}" already exists.`);
        }
    } catch (err) {
        console.error('Error checking/creating database:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

async function addColumn(pool, table, column, type) {
    try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
    } catch (e) {
        console.log(`Note: Could not add column ${column} to ${table}: ${e.message}`);
    }
}

async function initSchema() {
    await createDatabaseIfNotExists();

    const pool = new Client({ ...DB_CONFIG, database: DB_NAME });
    try {
        await pool.connect();
        console.log('Connected to database. Initializing schema...');

        // Enable extensions
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

        // --- Core Tables ---

        // User Profiles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email TEXT UNIQUE NOT NULL,
                user_metadata JSONB DEFAULT '{}',
                language TEXT DEFAULT 'nl'
            );
        `);


        // Prompts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS prompts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                title TEXT,
                content TEXT NOT NULL,
                notes TEXT,
                rating NUMERIC(3,1) DEFAULT 0,
                is_favorite BOOLEAN DEFAULT FALSE,
                is_template BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                auto_keywords TEXT[]
            );
        `);
        await addColumn(pool, 'prompts', 'rating', 'NUMERIC(3,1) DEFAULT 0');
        await addColumn(pool, 'prompts', 'is_favorite', 'BOOLEAN DEFAULT FALSE');
        await addColumn(pool, 'prompts', 'is_template', 'BOOLEAN DEFAULT FALSE');
        await addColumn(pool, 'prompts', 'model', 'TEXT');
        await addColumn(pool, 'prompts', 'category', 'TEXT');
        await addColumn(pool, 'prompts', 'revised_prompt', 'TEXT');
        await addColumn(pool, 'prompts', 'seed', 'INTEGER');
        await addColumn(pool, 'prompts', 'aspect_ratio', 'TEXT');
        await addColumn(pool, 'prompts', 'use_custom_aspect_ratio', 'BOOLEAN DEFAULT FALSE');
        await addColumn(pool, 'prompts', 'gallery_item_id', 'UUID');
        await addColumn(pool, 'prompts', 'negative_prompt', 'TEXT');
        await addColumn(pool, 'prompts', 'start_image', 'TEXT');
        await addColumn(pool, 'prompts', 'use_count', 'INTEGER DEFAULT 0');
        await addColumn(pool, 'prompts', 'last_used_at', 'TIMESTAMP WITH TIME ZONE');
        await addColumn(pool, 'prompts', 'suggested_model', 'TEXT');
        await addColumn(pool, 'prompts', 'generation_journey', "JSONB DEFAULT '[]'");
        await addColumn(pool, 'prompts', 'auto_keywords', 'TEXT[]');

        // Add pg_trgm index for similarity search
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_prompts_content_trgm 
            ON prompts USING GIST (content gist_trgm_ops);
        `);

        // Tags
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT UNIQUE NOT NULL,
                usage_count INTEGER DEFAULT 0
            );
        `);
        await addColumn(pool, 'tags', 'usage_count', 'INTEGER DEFAULT 0');

        // Prompt Tags (Junction)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS prompt_tags (
                prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
                tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (prompt_id, tag_id)
            );
        `);

        // Prompt Versions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS prompt_versions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Characters
        await pool.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                name TEXT NOT NULL,
                description TEXT,
                reference_image_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                images JSONB DEFAULT '[]'
            );
        `);
        await addColumn(pool, 'characters', 'reference_image_url', 'TEXT');
        await addColumn(pool, 'characters', 'images', "JSONB DEFAULT '[]'");

        // Character Details
        await pool.query(`
            CREATE TABLE IF NOT EXISTS character_details (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
                key TEXT NOT NULL,
                value TEXT,
                category TEXT
            );
        `);

        // Compatibility: newer UI uses { detail, works_well } instead of { key, value }
        await addColumn(pool, 'character_details', 'detail', 'TEXT');
        await addColumn(pool, 'character_details', 'works_well', 'BOOLEAN DEFAULT FALSE');

        // Make legacy "key" optional so inserts that only provide detail/works_well don't fail
        try {
            await pool.query(`ALTER TABLE character_details ALTER COLUMN key DROP NOT NULL`);
            await pool.query(`ALTER TABLE character_details ALTER COLUMN key SET DEFAULT 'detail'`);
        } catch (e) {
            console.log(`Note: Could not relax character_details.key constraint: ${e.message}`);
        }

        // Gallery Items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gallery_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                title TEXT,
                image_url TEXT NOT NULL,
                prompt_used TEXT,
                model_used TEXT,
                notes TEXT,
                is_favorite BOOLEAN DEFAULT FALSE,
                aspect_ratio TEXT,
                use_custom_aspect_ratio BOOLEAN DEFAULT false,
                start_image TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        await addColumn(pool, 'gallery_items', 'prompt_id', 'UUID');
        await addColumn(pool, 'gallery_items', 'start_image', 'TEXT');
        await addColumn(pool, 'gallery_items', 'rating', 'NUMERIC(3,1) DEFAULT 0');
        await addColumn(pool, 'gallery_items', 'model_used', 'TEXT');
        await addColumn(pool, 'gallery_items', 'model', 'TEXT');
        await addColumn(pool, 'gallery_items', 'is_favorite', 'BOOLEAN DEFAULT FALSE');
        await addColumn(pool, 'gallery_items', 'local_path', 'TEXT');
        await addColumn(pool, 'gallery_items', 'metadata', "JSONB DEFAULT '{}'");
        await addColumn(pool, 'gallery_items', 'width', 'INTEGER');
        await addColumn(pool, 'gallery_items', 'height', 'INTEGER');
        await addColumn(pool, 'gallery_items', 'character_id', 'UUID');
        await addColumn(pool, 'gallery_items', 'collection_id', 'UUID');
        await addColumn(pool, 'gallery_items', 'media_type', "TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video'))");
        await addColumn(pool, 'gallery_items', 'video_url', 'TEXT');
        await addColumn(pool, 'gallery_items', 'video_local_path', 'TEXT');
        await addColumn(pool, 'gallery_items', 'thumbnail_url', 'TEXT');
        await addColumn(pool, 'gallery_items', 'created_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
        await addColumn(pool, 'gallery_items', 'duration_seconds', 'INTEGER');
        await addColumn(pool, 'gallery_items', 'storage_mode', "TEXT DEFAULT 'url' CHECK (storage_mode IN ('url', 'local', 'both'))");
        await addColumn(pool, 'gallery_items', 'updated_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()');

        // Add index on created_at for performant sorting
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at ON gallery_items(created_at DESC);
        `);

        // Index voor snelle extensie duplicate-check
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gallery_items_nightcafe_id 
            ON gallery_items ((metadata->>'nightcafe_creation_id'));
        `);

        // Composite index for fast ImportHub filtering and sorting
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gallery_items_source_created_at 
            ON gallery_items ((metadata->>'source'), created_at DESC);
        `);

        // Collections
        await pool.query(`
            CREATE TABLE IF NOT EXISTS collections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        await addColumn(pool, 'collections', 'color', 'TEXT');

        // --- Configuration Tables ---

        // User API Keys
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_api_keys (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                provider TEXT UNIQUE NOT NULL,
                encrypted_key TEXT NOT NULL,
                key_hint TEXT,
                model_name TEXT, 
                model_gen TEXT,
                model_improve TEXT,
                model_vision TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                is_active_gen BOOLEAN DEFAULT FALSE,
                is_active_improve BOOLEAN DEFAULT FALSE,
                is_active_vision BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);


        // Local Endpoints
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_local_endpoints (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                provider TEXT NOT NULL,
                endpoint_url TEXT NOT NULL,
                model_name TEXT,
                model_gen TEXT,
                model_improve TEXT,
                model_vision TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                is_active_gen BOOLEAN DEFAULT FALSE,
                is_active_improve BOOLEAN DEFAULT FALSE,
                is_active_vision BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);


        // Style Profiles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS style_profiles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL,
                description TEXT,
                keywords TEXT[],
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Batch Tests
        await pool.query(`
            CREATE TABLE IF NOT EXISTS batch_tests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                base_prompt TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Batch Test Prompts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS batch_test_prompts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                batch_test_id UUID REFERENCES batch_tests(id) ON DELETE CASCADE,
                prompt TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Batch Test Results
        await pool.query(`
            CREATE TABLE IF NOT EXISTS batch_test_results (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                batch_test_prompt_id UUID REFERENCES batch_test_prompts(id) ON DELETE CASCADE,
                image_url TEXT,
                status TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);




        // Model Usage
        await pool.query(`
            CREATE TABLE IF NOT EXISTS model_usage (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                model_name TEXT,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Style Keywords
        await pool.query(`
            CREATE TABLE IF NOT EXISTS style_keywords (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                keyword TEXT,
                category TEXT,
                UNIQUE(keyword, category)
            );
        `);

        // Style Learning
        await pool.query(`
             CREATE TABLE IF NOT EXISTS style_learning (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                style_name TEXT,
                prompt_content TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // API Usage Log
        await pool.query(`
            CREATE TABLE IF NOT EXISTS api_usage_log (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                session_id TEXT,
                action TEXT,
                provider TEXT,
                model TEXT,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                estimated_cost_usd NUMERIC(14,8) DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        await addColumn(pool, 'api_usage_log', 'action', 'TEXT');
        await addColumn(pool, 'api_usage_log', 'provider', 'TEXT');
        await addColumn(pool, 'api_usage_log', 'model', 'TEXT');
        await addColumn(pool, 'api_usage_log', 'prompt_tokens', 'INTEGER DEFAULT 0');
        await addColumn(pool, 'api_usage_log', 'completion_tokens', 'INTEGER DEFAULT 0');
        await addColumn(pool, 'api_usage_log', 'estimated_cost_usd', 'NUMERIC(14,8) DEFAULT 0');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_log_provider_created ON api_usage_log(provider, created_at);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_log_created ON api_usage_log(created_at);
        `);


        // --- Default Data ---

        const defaultUser = '88ea3bcb-d9a8-44b5-ac26-c90885a74686';
        await pool.query(`
            INSERT INTO user_profiles (id, email, user_metadata, language)
            VALUES ($1, 'local@user.com', '{"name": "Local User"}', 'nl')
            ON CONFLICT (email) DO NOTHING
        `, [defaultUser]);

        // Add updated_at columns to existing tables
        await addUpdatedAtColumns(pool);

        // --- Cleanup: remove deprecated credits system ---
        await pool.query(`ALTER TABLE user_profiles DROP COLUMN IF EXISTS credit_balance`);
        await pool.query(`ALTER TABLE user_profiles DROP COLUMN IF EXISTS total_credits_earned`);
        await pool.query(`ALTER TABLE user_profiles DROP COLUMN IF EXISTS total_credits_spent`);
        await pool.query(`DROP TABLE IF EXISTS credit_transactions`);


    } catch (err) {
        throw err; // Re-throw the error so the caller can catch it
    } finally {
        await pool.end();
    }
}

async function addUpdatedAtColumns(pool) {
    const tables = ['collections', 'tags', 'characters', 'user_api_keys'];
    for (const table of tables) {
        await addColumn(pool, table, 'updated_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    }
}

module.exports = { initSchema };

// If run directly, execute initSchema
if (require.main === module) {
    initSchema().then(() => {
        console.log('✅ Schema initialization complete.');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Schema initialization failed:', err);
        process.exit(1);
    });
}
