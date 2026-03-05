-- ============================================================
-- NightCompanion Database Schema
-- Single source of truth for database structure
-- 
-- Usage:
--   psql -U postgres -d nightcafe_companion -f create-schema.sql
-- 
-- This file contains the complete schema for a fresh install.
-- For existing databases, use server/db-init.js which handles
-- schema evolution with addColumn() calls.
-- ============================================================

-- Enable required extensions
DO $$
BEGIN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS "pg_trgm"';
END
$$;

BEGIN;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    user_metadata JSONB DEFAULT '{}',
    language TEXT DEFAULT 'nl'
);

-- Prompts
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
    -- Additional columns from addColumn() evolution
    model TEXT,
    category TEXT,
    revised_prompt TEXT,
    seed INTEGER,
    aspect_ratio TEXT,
    use_custom_aspect_ratio BOOLEAN DEFAULT FALSE,
    start_image TEXT,
    gallery_item_id UUID,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    suggested_model TEXT,
    generation_journey JSONB DEFAULT '[]',
    negative_prompt TEXT,
    auto_keywords TEXT[]
);

-- Add pg_trgm index for similarity search
CREATE INDEX IF NOT EXISTS idx_prompts_content_trgm 
    ON prompts USING GIST (content gist_trgm_ops);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0
);

-- Prompt Tags (Junction)
CREATE TABLE IF NOT EXISTS prompt_tags (
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

-- Prompt Versions
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Characters
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

-- Character Details
CREATE TABLE IF NOT EXISTS character_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    detail TEXT,
    works_well BOOLEAN DEFAULT FALSE,
    category TEXT
);

-- Gallery Items
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
    use_custom_aspect_ratio BOOLEAN DEFAULT FALSE,
    start_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Additional columns from addColumn() evolution
    prompt_id UUID,
    rating NUMERIC(3,1) DEFAULT 0,
    model TEXT,
    local_path TEXT,
    metadata JSONB DEFAULT '{}',
    width INTEGER,
    height INTEGER,
    character_id UUID,
    collection_id UUID,
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'unknown')),
    video_url TEXT,
    video_local_path TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    storage_mode TEXT DEFAULT 'url' CHECK (storage_mode IN ('url', 'local', 'both'))
);

-- Gallery Items Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at ON gallery_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_nightcafe_id ON gallery_items((metadata->>'nightcafe_creation_id'));
CREATE INDEX IF NOT EXISTS idx_gallery_items_source_created_at ON gallery_items((metadata->>'source'), created_at DESC);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    color TEXT
);

-- ============================================================
-- CONFIGURATION TABLES
-- ============================================================

-- User API Keys
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

-- Local Endpoints
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

-- ============================================================
-- STYLE & BATCH TABLES
-- ============================================================

-- Style Profiles
CREATE TABLE IF NOT EXISTS style_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    keywords TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Tests
CREATE TABLE IF NOT EXISTS batch_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Test Prompts
CREATE TABLE IF NOT EXISTS batch_test_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_test_id UUID REFERENCES batch_tests(id) ON DELETE CASCADE,
    prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Test Results
CREATE TABLE IF NOT EXISTS batch_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_test_prompt_id UUID REFERENCES batch_test_prompts(id) ON DELETE CASCADE,
    image_url TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model Usage
CREATE TABLE IF NOT EXISTS model_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Style Keywords
CREATE TABLE IF NOT EXISTS style_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT,
    category TEXT,
    UNIQUE(keyword, category)
);

-- Style Learning
CREATE TABLE IF NOT EXISTS style_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    style_name TEXT,
    prompt_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Usage Log
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

-- API Usage Log Indexes
CREATE INDEX IF NOT EXISTS idx_usage_log_provider_created ON api_usage_log(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_log_created ON api_usage_log(created_at);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

INSERT INTO user_profiles (id, email, user_metadata, language)
VALUES ('88ea3bcb-d9a8-44b5-ac26-c90885a74686', 'local@user.com', '{"name": "Local User"}', 'nl')
ON CONFLICT (email) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_collections ON collections;
CREATE TRIGGER set_updated_at_collections
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_characters ON characters;
CREATE TRIGGER set_updated_at_characters
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_gallery_items ON gallery_items;
CREATE TRIGGER set_updated_at_gallery_items
    BEFORE UPDATE ON gallery_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_user_api_keys ON user_api_keys;
CREATE TRIGGER set_updated_at_user_api_keys
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_user_local_endpoints ON user_local_endpoints;
CREATE TRIGGER set_updated_at_user_local_endpoints
    BEFORE UPDATE ON user_local_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Schema initialization complete!';
    RAISE NOTICE 'Total tables created: %', table_count;
    RAISE NOTICE '===========================================';
END $$;
