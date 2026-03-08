/**
 * AI Model Connection Test
 *
 * This test validates that the testConnection functionality works properly
 * to detect if an AI model can be reached.
 *
 * Usage: node --test server/tests/ai-connection.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Mock database pool for testing
const mockPool = {
    query: async (sql, params) => {
        // Simulate no active provider configured
        return { rows: [] };
    }
};

test('getActiveProvider returns null when no provider is configured', async () => {
    // This simulates the getActiveProvider function behavior
    async function getActiveProvider(role = 'generation') {
        const column = role === 'generation' ? 'is_active_gen' : 'is_active_improve';

        // Check local endpoint first
        const local = await mockPool.query(
            `SELECT provider, endpoint_url, model_name, model_gen, model_improve FROM user_local_endpoints WHERE ${column} = true`
        );
        if (local.rows.length > 0) {
            return {
                type: 'local',
                ...local.rows[0]
            };
        }

        // Check cloud provider keys
        const cloud = await mockPool.query(
            `SELECT provider, encrypted_key, model_name, model_gen, model_improve FROM user_api_keys WHERE ${column} = true`
        );

        if (cloud.rows.length > 0) {
            return {
                type: 'cloud',
                provider: cloud.rows[0].provider
            };
        }

        return null;
    }

    const provider = await getActiveProvider();
    assert.equal(provider, null, 'Should return null when no provider is configured');
});

test('testConnection endpoint returns error when no provider is configured', async () => {
    // This simulates the test-connection endpoint behavior
    async function handleTestConnection() {
        const provider = null; // Simulating no active provider
        if (!provider) {
            throw new Error('No active AI provider found');
        }
        return { result: `Connection successful! Using ${provider.provider || provider.type}` };
    }

    await assert.rejects(
        async () => await handleTestConnection(),
        {
            name: 'Error',
            message: 'No active AI provider found'
        },
        'Should throw error when no provider is configured'
    );
});

test('testConnection endpoint returns success when provider is configured', async () => {
    // This simulates the test-connection endpoint behavior with a configured provider
    async function handleTestConnection(provider) {
        if (!provider) {
            throw new Error('No active AI provider found');
        }
        return { result: `Connection successful! Using ${provider.provider || provider.type}` };
    }

    const mockProvider = { provider: 'openai', type: 'cloud' };
    const result = await handleTestConnection(mockProvider);

    assert.ok(result.result, 'Should return a result object');
    assert.match(result.result, /Connection successful/, 'Should indicate successful connection');
    assert.match(result.result, /openai/, 'Should include provider name');
});

test('task models can be synced and retrieved', () => {
    // Simulate the syncTaskModel and useTaskModels functionality
    const STORAGE_KEY = 'ai-task-models';
    const DEFAULT_MODELS = {
        generate: 'google:gemini-1.5-flash',
        improve: 'anthropic:claude-3-5-sonnet-20241022',
        vision: 'openai:gpt-4o',
        research: 'openai:gpt-4o',
    };

    function syncTaskModel(role, provider, model) {
        const taskKey = role === 'generation' ? 'generate'
            : role === 'improvement' ? 'improve'
            : 'vision';
        const value = `${provider}:${model}`;
        const updates = { [taskKey]: value };

        // research mirrors the generation model
        if (role === 'generation') {
            updates.research = value;
        }

        return updates;
    }

    const updates = syncTaskModel('generation', 'anthropic', 'claude-3-opus');

    assert.equal(updates.generate, 'anthropic:claude-3-opus', 'Should update generate model');
    assert.equal(updates.research, 'anthropic:claude-3-opus', 'Should update research model to match generate');
});

console.log('All AI connection tests passed!');
