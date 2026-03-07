const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { decrypt } = require('../lib/crypto');
const logger = require('../lib/logger');
const fs = require('fs');
const path = require('path');

const LANGUAGE_INSTRUCTION = "CRITICAL: All output, including descriptions, reasoning, and analysis, MUST use English (UK) spelling and terminology (e.g., 'colour', 'centre', 'maximise').";

const BASE_PERSONA = `You are an expert AI Art Prompt Engineer specializing in NightCafe. Your goal is to generate high-quality, descriptive prompts for models like SDXL, Stable Diffusion, and DALL-E 3. ${LANGUAGE_INSTRUCTION}

Key Elements of a Great Prompt:
- Subject: Highly specific description of the main character, object, or scene.
- Style & Medium: Defined art form (e.g., 'digital concept art', 'oil on canvas').
- Visual Details: Intricate textures, lighting (e.g., 'volumetric lighting', 'cinematic framing').
- Atmosphere: Mood and environment (e.g., 'eerie morning mist', 'vibrant neon glow').
- Modifiers: Optimized tags like '8k resolution', 'unreal engine 5', 'masterpiece'.

You must combine these elements into a single, flowing text description without using labels like 'Subject:' or lines.`;

const SYSTEM_PROMPTS = {
    improve: `You are an expert AI image prompt engineer. Improve the user's prompt by enhancing subject, style, details, and atmosphere. IMPORTANT: You must keep the original prompt concept but improve its descriptive quality with a maximum deviation of 10% from the original prompt in intent. Return ONLY the improved prompt text. ${LANGUAGE_INSTRUCTION} CRITICAL: Keep valid prompt response under 1500 characters.`,

    'improve-with-negative': `You are an expert AI image prompt engineer. Improve both the positive prompt and the negative prompt. For the positive prompt, enhance subject, style, details, and atmosphere. IMPORTANT: You must keep the original prompt concept but improve its descriptive quality with a maximum deviation of 10% from the original prompt in intent. For the negative prompt, refine it with better exclusion terms (e.g., deformed, blurry, low quality, extra limbs, bad anatomy). The negative prompt must be between 5 and 15 words in length. ${LANGUAGE_INSTRUCTION} Return ONLY valid JSON: { "improved": "...", "negativePrompt": "..." }. CRITICAL: Limit 'improved' positive prompt to 1500 characters. Limit 'negativePrompt' length to exactly 5-15 words.`,

    'analyze-style': `You are an AI art style analyst. Analyze collections of image prompts to find patterns. Provide: 1. Style profile (2-3 sentences). 2. Top 3 themes. 3. Top 3 techniques. 4. 2-3 suggestions. 5. Style signature. ${LANGUAGE_INSTRUCTION} Format response as JSON: { profile, themes[], techniques[], suggestions[], signature }.`,

    generate: `${BASE_PERSONA}\n\nTask: Transform the description into technical NightCafe prompts. Return BOTH a positive prompt and a matching negative prompt. ${LANGUAGE_INSTRUCTION}\nReturn ONLY valid JSON: { "prompt": "...", "negativePrompt": "..." }.\nCRITICAL: Keep the generated positive prompt under 1500 characters and the negative prompt under 600 characters.`,

    diagnose: `You are an AI troubleshooting expert. Analyze failed prompts. Provide: 1. Likely cause. 2. 3 fixes. 3. Improved prompt. ${LANGUAGE_INSTRUCTION} Format as JSON: { cause, fixes[], improvedPrompt }. CRITICAL: Keep 'improvedPrompt' under 1500 characters.`,

    'recommend-models': `You are a model selection expert. Recommend NightCafe models based on prompt. ${LANGUAGE_INSTRUCTION} Return JSON: { recommendations: [{ modelId, modelName, matchScore, reasoning, tips[] }] }.`,

    'generate-variations': `${BASE_PERSONA}\n\nTask: Generate distinctive variations based on the input. Return JSON including a separate field for the negative prompt. \nOutput Format: { "variations": [{ "type": "string", "prompt": "string", "negativePrompt": "string" }] }.\n\nCRITICAL: The 'prompt' field must be a SINGLE string containing the full image description. DO NOT include structure labels (e.g. 'Subject:', 'Style:'). Just the raw, ready-to-use prompt text.\nPut elements to avoid in 'negativePrompt'.\nLIMITS: Positive prompt < 1500 chars. Negative prompt < 600 chars.`,

    random: `You are an Avant-Garde AI Art Director. Your goal is to generate truly unique, diverse, and creative image prompts.
    
    INSTRUCTIONS:
    STEP 1: Choose a random art style/theme
    Examples: landscape, portrait, abstract, fantasy, sci-fi, architecture, nature, character design, etc.

    STEP 2: Generate a detailed positive prompt (50-150 words)
    - Be specific and descriptive
    - Include style, mood, lighting, composition
    - Add technical details (camera angle, art medium, etc.)
    - Use clear technical specifications

    STEP 3: Generate a matching negative prompt (maximum 100 words)
    - Tailor to the chosen style (avoid elements that don't fit)
    - Include technical quality issues: ugly, blurry, low quality, distorted, deformed, bad anatomy
    - Add relevant exclusions: watermark, signature, text, grainy, jpeg artifacts, cropped, out of frame
    - STOP after 100 words - NO repetition

    ${LANGUAGE_INSTRUCTION}

    CRITICAL: Return ONLY valid JSON: { "style": "...", "prompt": "...", "negativePrompt": "..." }.
    LIMITS: Positive prompt < 1500 chars. Negative prompt < 600 chars.
    NO markdown formatting, NO conversational text. Ensure JSON is strictly formatted and parsable.`,

    'generate-title': `Create a short, catchy title (max 10 words) for the image prompt. ${LANGUAGE_INSTRUCTION} Return ONLY the title text. No quotes.`,

    'suggest-tags': `Suggest exactly 5-10 comma-separated tags for the image prompt. 
    RULES:
    1. Each tag MUST be a single word or short phrase (max 3 words).
    2. NO sentences or long descriptions.
    3. Return ONLY the comma-separated tags.
    ${LANGUAGE_INSTRUCTION}
    Example: "nature, landscape, mountain, blue sky, cinematic lighting"`,

    'optimize-for-model': `You are an expert AI prompt engineer. Optimize the user's prompt for a specific AI model. IMPORTANT: You must keep the original prompt concept but improve its descriptive quality with a maximum deviation of 10% from the original prompt in intent. ${LANGUAGE_INSTRUCTION}
    - If the model is DALL-E 3 or any GPT-Image model (e.g. GPT1.5, GPT-4o): These do NOT support negative prompts. You MUST merge any key negative constraints (e.g. "no blur", "no text") naturally into the positive prompt formulation or ignore them if minor. Return ONLY the optimized positive prompt.
    - If the model is Stable Diffusion / SDXL / Flux / Ideogram: You can keep negative constraints separate if provided, or refine the positive prompt to better suit the model's strengths (e.g. lighting, composition). The negative prompt must be between 5 and 15 words in length.
    CRITICAL: Return ONLY valid JSON: { "optimizedPrompt": "...", "negativePrompt": "..." (optional, empty if DALL-E 3/GPT) }.
    LIMITS: Positive prompt < 1500 chars. Negative prompt length MUST be 5-15 words if provided.`,

    'generate-negative-prompt': `You are an AI assistant helping to generate negative prompts for AI art.
    RULES:
    1. Must be between 5 and 15 words in length
    2. Comma-separated list of unwanted characteristics
    3. Focus on technical quality issues (blurry, distorted, low quality, etc.)
    4. Avoid extreme or repetitive terms
    5. STOP once you have a complete list - NO repetition

    Standard negative prompt structure:
    - Quality issues: ugly, blurry, low quality, distorted, deformed, bad anatomy
    - Artifacts: watermark, signature, text, grainy, jpeg artifacts
    - Composition: cropped, out of frame, duplicate, bad proportions
    - Rendering: oversaturated, underexposed, overexposed, amateur

    Generate a negative prompt of between 5 and 15 words.
    STOP after 15 words max.`,

    'extract-keywords': `Extract 5-10 keywords from this image prompt. Focus on: subject, style, mood, setting, color palette, art technique. Return ONLY a JSON array of lowercase single words or short phrases. Example: ["portrait", "neon", "cyberpunk", "rain", "dramatic lighting"]`
};

const JSON_ACTIONS = new Set([
    'generate',
    'analyze-style',
    'diagnose',
    'recommend-models',
    'improve-detailed',
    'improve-with-negative',
    'generate-variations',
    'describe-character',
    'random',
    'optimize-for-model'
]);

// ─── LLM pricing (USD per 1M tokens) ────────────────────────────────────────
const PROVIDER_PRICING = {
    openai: {
        'gpt-4o': { input: 5.00, output: 15.00 },
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-4-turbo': { input: 10.00, output: 30.00 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
        'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
        'gpt-4.1-mini': { input: 0.40, output: 1.60 }
    },
    anthropic: {
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
        'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
        'claude-opus-4': { input: 15.00, output: 75.00 },
        'claude-sonnet-4': { input: 3.00, output: 15.00 }
    },
    gemini: {
        'gemini-1.5-pro': { input: 1.25, output: 5.00 },
        'gemini-1.5-flash': { input: 0.075, output: 0.30 },
        'gemini-2.0-pro-exp-02-05': { input: 0.00, output: 0.00 }, // free tier
        'gemini-2.0-flash': { input: 0.10, output: 0.40 },
        'gemini-2.5-pro': { input: 1.25, output: 10.00 }
    },
    openrouter: {
        'openai/gpt-4o': { input: 2.50, output: 10.00 },
        'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
        'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
        'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
        'google/gemini-2.0-flash-exp:free': { input: 0.00, output: 0.00 },
        'meta-llama/llama-3.2-11b-vision-instruct': { input: 0.10, output: 0.10 },
        'meta-llama/llama-3.2-90b-vision-instruct': { input: 0.35, output: 0.40 },
        'meta-llama/llama-3.3-70b-instruct': { input: 0.13, output: 0.40 },
        'qwen/qwen-2.5-72b-instruct': { input: 0.12, output: 0.40 },
        'mistralai/mistral-large': { input: 2.00, output: 6.00 }
    },
    together: {
        'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo': { input: 0.18, output: 0.18 },
        'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo': { input: 1.20, output: 1.20 },
        'meta-llama/Llama-3.3-70B-Instruct-Turbo': { input: 0.88, output: 0.88 },
        'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': { input: 3.50, output: 3.50 },
        'Qwen/Qwen2.5-72B-Instruct-Turbo': { input: 1.20, output: 1.20 },
        'mistralai/Mixtral-8x22B-Instruct-v0.1': { input: 1.20, output: 1.20 },
        'deepseek-ai/DeepSeek-V3': { input: 0.14, output: 0.28 },
        'Gryphe/MythoMax-L2-13b': { input: 0.30, output: 0.30 }
    },
    deepinfra: {
        'meta-llama/Llama-3.3-70B-Instruct': { input: 0.13, output: 0.40 },
        'meta-llama/Meta-Llama-3.1-405B-Instruct': { input: 0.90, output: 0.90 },
        'microsoft/WizardLM-2-8x22B': { input: 0.50, output: 0.50 },
        'Qwen/Qwen2.5-72B-Instruct': { input: 0.12, output: 0.40 },
        'deepseek-ai/DeepSeek-V3': { input: 0.14, output: 0.28 }
    }
};

function estimateCostUsd(provider, model, promptTokens, completionTokens, costHintFromClient = null) {
    if (costHintFromClient !== null && typeof costHintFromClient === 'number') {
        return costHintFromClient;
    }

    const providerPricing = PROVIDER_PRICING[provider] || {};
    // Try exact match first, then prefix match
    let pricing = providerPricing[model];
    if (!pricing) {
        const key = Object.keys(providerPricing).find(k => model && model.startsWith(k));
        pricing = key ? providerPricing[key] : null;
    }
    if (!pricing) return 0;
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

async function logUsage(pool, { sessionId, action, provider, model, promptTokens, completionTokens, cost }) {
    try {
        await pool.query(
            `INSERT INTO api_usage_log
                (session_id, action, provider, model, prompt_tokens, completion_tokens, estimated_cost_usd)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [sessionId || null, action, provider, model,
            promptTokens || 0, completionTokens || 0, cost || 0]
        );
    } catch (e) {
        logger.warn('Failed to log usage:', e.message);
    }
}

async function getActiveProvider(role = 'generation') {
    const column = role === 'generation' ? 'is_active_gen' : 'is_active_improve';

    // Check local endpoint first
    const local = await pool.query(
        `SELECT provider, endpoint_url, model_name, model_gen, model_improve FROM user_local_endpoints WHERE ${column} = true`
    );
    if (local.rows.length > 0) {
        return {
            type: 'local',
            ...local.rows[0]
        };
    }

    // Check cloud provider keys
    const cloud = await pool.query(
        `SELECT provider, encrypted_key, model_name, model_gen, model_improve FROM user_api_keys WHERE ${column} = true`
    );

    if (cloud.rows.length > 0) {
        const apiKey = decrypt(cloud.rows[0].encrypted_key);
        if (!apiKey) {
            throw new Error(`Failed to decrypt API key for ${cloud.rows[0].provider}. Your encryption key may have changed. Please re-enter your API key in Settings.`);
        }

        return {
            type: 'cloud',
            provider: cloud.rows[0].provider,
            apiKey: apiKey,
            modelName: cloud.rows[0].model_name,
            modelGen: cloud.rows[0].model_gen,
            modelImprove: cloud.rows[0].model_improve
        };
    }

    return null;
}

// Helper to build standard message array
function buildMessages(system, user) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });
    return messages;
}

function parseJsonStringSafe(raw) {
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Minimal implementation of AI calls using fetch
async function callOpenAI(apiKey, system, user, maxTokens = 1500, temperature = 1.0, model = 'gpt-4o') {
    const messages = buildMessages(system, user);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI error');
    return {
        content: data.choices[0].message.content,
        usage: data.usage || {}
    };
}

async function callAnthropic(apiKey, system, user, maxTokens = 1500, temperature = 1.0, model = 'claude-sonnet-4-6') {
    const messages = buildMessages(null, user);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: temperature,
            system: system,
            messages: messages
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Anthropic error');
    return {
        content: data.content[0].text,
        usage: {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0,
        }
    };
}

async function callGemini(apiKey, system, user, maxTokens = 1500, temperature = 1.0, model = 'gemini-2.0-pro-exp-02-05') {
    // Gemini API structure for vision is slightly different, requiring 'inlineData' or 'fileData'
    // For simplicity, we'll assume text-only for now unless we implement full file upload handling
    // or convert base64 to parts.
    // TODO: Implement full Gemini Vision support if needed.

    // Fallback for now: only text
    const textUser = typeof user === 'string' ? user : user.find(p => p.type === 'text')?.text || '';

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: textUser }] }],
            generationConfig: { temperature: temperature }
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
    return {
        content: data.candidates[0].content.parts[0].text,
        usage: {
            prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
            completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        }
    };
}

async function callOpenRouter(apiKey, system, user, model, maxTokens = 1500, temperature = 1.0, options = {}) {
    const messages = buildMessages(system, user);

    const buildBody = (forceJson = false) => {
        const body = {
            model: model || 'google/gemini-2.0-pro-exp-02-05:free',
            messages,
            max_tokens: maxTokens,
            temperature
        };

        if (forceJson) {
            body.response_format = { type: 'json_object' };
        }

        return body;
    };

    const sendRequest = async (forceJson = false) => fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nightcompanion.app',
            'X-Title': 'NightCompanion',
        },
        body: JSON.stringify(buildBody(forceJson))
    });

    let res = await sendRequest(!!options.forceJson);
    let preReadErrorPayload = null;

    if (!res.ok && options.forceJson) {
        let retryWithoutJsonMode = false;
        const rawError = await res.text();
        const parsedError = parseJsonStringSafe(rawError);
        preReadErrorPayload = parsedError || rawError;

        const normalizedErrorText = (parsedError ? JSON.stringify(parsedError) : rawError).toLowerCase();
        retryWithoutJsonMode = normalizedErrorText.includes('response_format')
            || normalizedErrorText.includes('json_object')
            || normalizedErrorText.includes('not supported');

        if (retryWithoutJsonMode) {
            logger.warn(`[OpenRouter] response_format unsupported for model ${model || 'default'}; retrying without forced JSON mode`);
            res = await sendRequest(false);
            preReadErrorPayload = null;
        }
    }

    if (!res.ok) {
        let errorMsg = 'OpenRouter error';
        let errorData = preReadErrorPayload;
        if (errorData === null) {
            const rawError = await res.text();
            errorData = parseJsonStringSafe(rawError) || rawError;
        }

        if (typeof errorData === 'object' && errorData !== null) {
            logger.error('OpenRouter API Error Details: ' + JSON.stringify(errorData, null, 2));
            if (errorData.error && typeof errorData.error === 'object') {
                errorMsg = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
                if (typeof errorMsg === 'string' && errorMsg.includes('Provider returned error') && errorData.error.metadata) {
                    errorMsg += ` (${JSON.stringify(errorData.error.metadata)})`;
                }
            } else if (errorData.error && typeof errorData.error === 'string') {
                errorMsg = errorData.error;
            } else {
                errorMsg = JSON.stringify(errorData);
            }
        } else if (typeof errorData === 'string') {
            logger.error('OpenRouter API Error Text: ' + errorData);
            errorMsg = errorData.slice(0, 200);
        }

        throw new Error(`OpenRouter Provider Error: ${errorMsg}`);
    }

    const data = await res.json();

    // Log full data for debugging format
    logger.debug('[OpenRouter] Full Response Data: ' + JSON.stringify(data, null, 2).substring(0, 1000));

    if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenRouter returned no choices: ' + JSON.stringify(data));
    }

    const choice = data.choices[0];
    const content = choice.message?.content || choice.text; // Fallback for older/different APIs

    // Log the raw content for debugging
    logger.debug('[OpenRouter] Raw content received: ' + (content ? content.substring(0, 200) + '...' : 'null/undefined'));

    return {
        content,
        usage: data.usage || {}
    };
}

async function callTogether(apiKey, system, user, model, maxTokens = 1500, temperature = 1.0) {
    // Together supports vision on some models, but we'll stick to text for now unless using specific vision models
    // For simplicity, flattening content to text if array
    const textUser = Array.isArray(user) ? (user.find(p => p.type === 'text')?.text || '') : user;
    const messages = buildMessages(system, textUser);

    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Together AI error');
    return {
        content: data.choices[0].message.content,
        usage: data.usage || {}
    };
}

async function callDeepInfra(apiKey, system, user, model, maxTokens = 1500, temperature = 1.0) {
    const textUser = Array.isArray(user) ? (user.find(p => p.type === 'text')?.text || '') : user;
    const messages = buildMessages(system, textUser);

    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'meta-llama/Llama-3.3-70B-Instruct',
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'DeepInfra API error');
    return {
        content: data.choices[0].message.content,
        usage: data.usage || {}
    };
}

async function listModels(providerConfig) {
    const { provider, apiKey, endpoint_url } = providerConfig;

    const asArray = (value) => Array.isArray(value) ? value : [];

    async function readJsonSafe(res) {
        try {
            return await res.json();
        } catch {
            return null;
        }
    }

    function getErrorMessage(data, fallback) {
        if (!data) return fallback;
        if (typeof data === 'string') return data;
        return data?.error?.message || data?.error || data?.message || fallback;
    }

    const REASONING_RE = /reasoning|magistral|r1|deepseek-r|thinking|o1|o3|qwen.*thinking/i;
    const WEB_SEARCH_RE = /online$|compound/i;
    const CODE_RE = /codestral|code\b|coder|starcoder|deepseek-coder/i;
    const VISION_ID_RE = /llava|vision|[\-_]vl[\-_]|pixtral|llama-4|kimi-k2/i;

    function detectOpenRouterCapabilities(m) {
        const id = m?.id ?? '';
        const modality = m?.architecture?.modality || '';
        const supported = Array.isArray(m?.supported_parameters) ? m.supported_parameters : [];

        const isVision = modality.includes('image') || m?.pricing?.image !== undefined || VISION_ID_RE.test(id);
        const isAudio = modality.includes('audio');
        const isVideo = modality.includes('video');

        const isOnline = id.endsWith(':online') || id.includes('online') || supported.includes('online') || WEB_SEARCH_RE.test(id);
        const hasReasoning = supported.includes('reasoning') || REASONING_RE.test(id);
        const isCode = CODE_RE.test(id);

        const caps = ['text'];
        if (isVision) caps.push('vision');
        if (isAudio) caps.push('audio');
        if (isVideo) caps.push('video');
        if (hasReasoning) caps.push('reasoning');
        if (isOnline) caps.push('web_search');
        if (isCode) caps.push('code');
        return caps;
    }

    if (provider === 'local' || providerConfig.type === 'local') {
        // For local (Ollama/LM Studio), we might need different endpoints
        // Ollama: GET /api/tags
        // LM Studio: GET /v1/models

        let urlClean = endpoint_url.trim().replace(/\/+$/, '');

        // Attempt to find the base URL if the user included '/v1'
        const baseUrl = urlClean.replace(/\/v1$/i, '');

        // 1. Try LM Studio specific API (http://localhost:1234/api/v1/models)
        try {
            const res = await fetch(`${baseUrl}/api/v1/models`);
            if (res.ok) {
                const data = await res.json();
                return asArray(data?.data).map(m => ({ id: m.id, name: m.id }));
            }
        } catch (e) { /* ignore */ }

        // 2. Try OpenAI compatible (http://localhost:1234/v1/models)
        try {
            const res = await fetch(`${baseUrl}/v1/models`);
            if (res.ok) {
                const data = await res.json();
                return asArray(data?.data).map(m => ({ id: m.id, name: m.id }));
            }
        } catch (e) { /* ignore */ }

        // 3. Keep original provided URL attempt (e.g. if user has a custom proxy ending in /v1)
        if (urlClean !== baseUrl) {
            try {
                const res = await fetch(`${urlClean}/models`);
                if (res.ok) {
                    const data = await res.json();
                    return asArray(data?.data).map(m => ({ id: m.id, name: m.id }));
                }
            } catch (e) { /* ignore */ }
        }

        // 4. Fallback for Ollama specific (http://localhost:11434/api/tags)
        try {
            const res = await fetch(`${baseUrl}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                return asArray(data?.models).map(m => ({ id: m.name, name: m.name }));
            }
        } catch (e) { /* ignore */ }

        return [];
    }

    if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await readJsonSafe(res);
        if (!res.ok) {
            throw new Error(getErrorMessage(data, `OpenRouter list-models failed (${res.status})`));
        }
        return asArray(data?.data).map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            pricing: m.pricing,
            capabilities: detectOpenRouterCapabilities(m)
        })); // OpenRouter returns proper list
    }

    if (provider === 'together') {
        const res = await fetch('https://api.together.xyz/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await readJsonSafe(res);
        if (!res.ok) {
            throw new Error(getErrorMessage(data, `Together list-models failed (${res.status})`));
        }
        // filter for chat/completion models if possible, but together returns all
        return asArray(data).map(m => ({ id: m.id, name: m.display_name || m.id, description: m.description }));
    }

    if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await readJsonSafe(res);
        if (!res.ok) {
            throw new Error(getErrorMessage(data, `OpenAI list-models failed (${res.status})`));
        }
        // simple filter for gpt models
        return asArray(data?.data).filter(m => m.id.includes('gpt')).map(m => ({ id: m.id, name: m.id }));
    }

    if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await readJsonSafe(res);
        if (!res.ok) {
            throw new Error(getErrorMessage(data, `Gemini list-models failed (${res.status})`));
        }
        return asArray(data?.models).map(m => ({ id: m.name.replace('models/', ''), name: m.displayName, description: m.description }));
    }

    if (provider === 'deepinfra') {
        const res = await fetch('https://api.deepinfra.com/v1/openai/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await readJsonSafe(res);
        if (!res.ok) {
            throw new Error(getErrorMessage(data, `DeepInfra list-models failed (${res.status})`));
        }
        return asArray(data?.data).filter(m => !m.id.includes('vllm')).map(m => ({ id: m.id, name: m.id, description: m.description }));
    }

    return [];
}

async function callAI(providerConfig, system, user, maxTokens = 1500, temperature = 1.0, options = {}) {
    if (providerConfig.type === 'local') {
        // Local usually doesn't support vision easily via standard OpenAI endpoint unless specific model
        // We'll flatten to text if possible or error out for vision
        const textUser = typeof user === 'string' ? user : user.find(p => p.type === 'text')?.text || '';

        // Normalize URL: remove trailing slash and /v1 suffix to get base
        // Normalize URL: remove trailing slash and /v1 suffix to get base
        let baseUrl = providerConfig.endpoint_url.trim().replace(/\/+$/, '');
        baseUrl = baseUrl.replace(/\/v1$/i, '');

        // Always use OpenAI compatible endpoint for chat as requested
        const url = `${baseUrl}/v1/chat/completions`;
        logger.debug(`[AI Service] Calling Local URL: ${url} with model: ${providerConfig.model_name}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: providerConfig.model_name,
                messages: [{ role: 'system', content: system }, { role: 'user', content: textUser }],
                max_tokens: maxTokens,
                temperature: temperature
            })
        });

        const rawBody = await res.text();
        const parsedBody = parseJsonStringSafe(rawBody);
        const data = parsedBody;

        if (!res.ok) {
            let errorMsg = `Local AI Provider Error: ${res.status} ${res.statusText}`;
            try {
                const errorJson = parsedBody || parseJsonStringSafe(rawBody);
                errorMsg = errorJson.error?.message || errorJson.error || errorMsg;
            } catch (e) {
                errorMsg += ` - ${String(rawBody || '').substring(0, 200)}`;
            }
            throw new Error(errorMsg);
        }

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            logger.error('Invalid Local AI response: ' + String(rawBody || '').substring(0, 500));
            throw new Error('Invalid response format from Local AI Provider: Missing choices/message');
        }

        return { content: data.choices[0].message.content, usage: data.usage || {} };
    }

    const { provider, apiKey } = providerConfig;
    const model = providerConfig.modelName || providerConfig.model_name || undefined;
    switch (provider) {
        case 'openai': return callOpenAI(apiKey, system, user, maxTokens, temperature, model);
        case 'anthropic': return callAnthropic(apiKey, system, user, maxTokens, temperature, model);
        case 'gemini': return callGemini(apiKey, system, user, maxTokens, temperature, model);
        case 'openrouter': return callOpenRouter(apiKey, system, user, model, maxTokens, temperature, options);
        case 'together': return callTogether(apiKey, system, user, model, maxTokens, temperature);
        case 'deepinfra': return callDeepInfra(apiKey, system, user, model, maxTokens, temperature);
        default: throw new Error(`Unknown provider: ${provider}`);
    }
}

router.post('/', async (req, res) => {
    try {
        const { action, payload } = req.body;
        const systemPrompt = SYSTEM_PROMPTS[action] || '';
        let userPrompt = '';
        let maxTokens = 1500;
        let temperature = 1.0;

        // Construct user prompt based on action
        if (action === 'improve') {
            userPrompt = `Improve this prompt: ${payload.prompt}`;
            if (payload.modelTips && payload.modelTips.length > 0) {
                userPrompt += `\n\nIMPORTANT: The user's target AI model has the following specific tips. Tailor your improvement to follow these guidelines:\n${payload.modelTips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
            }
        } else if (action === 'improve-with-negative') {
            userPrompt = `Positive prompt: "${payload.prompt}"\nNegative prompt: "${payload.negativePrompt}"\n\nImprove both prompts.`;
            if (payload.modelTips && payload.modelTips.length > 0) {
                userPrompt += `\n\nIMPORTANT: The user's target AI model has the following specific tips. Tailor your improvement to follow these guidelines:\n${payload.modelTips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
            }
        } else if (action === 'improve-detailed') {
            userPrompt = `Detailed analysis for: "${payload.prompt}"`;
            maxTokens = 2000;
        } else if (action === 'analyze-style') {
            userPrompt = `Analyze these prompts:\n${payload.prompts.join('\n')}`;
        } else if (action === 'generate') {
            const maxWords = payload.preferences?.maxWords || 70;
            const creativity = payload.preferences?.creativity || 'balanced';
            const tempMap = { 'focused': 0.8, 'balanced': 1.0, 'wild': 1.3 };
            temperature = tempMap[creativity] || 1.0;

            userPrompt = `Description: ${payload.description}\n\n`;
            userPrompt += `System Rule: Limit response to ${maxWords} words maximum.\n`;
            if (payload.preferences) {
                // omit creativity from the prompt string if we're setting it via temperature
                const safePrefs = { ...payload.preferences };
                delete safePrefs.creativity;
                userPrompt += `Prefs: ${JSON.stringify(safePrefs)}\n`;
            }
            if (payload.context) userPrompt += `Context: ${payload.context}`;
            if (payload.greylist && payload.greylist.length > 0) {
                userPrompt += `\nAvoid using the following words or subjects if possible: ${payload.greylist.join(', ')}.`;
            }
        } else if (action === 'diagnose') {
            userPrompt = `Prompt: "${payload.prompt}"\nIssue: ${payload.issue}`;
        } else if (action === 'recommend-models') {
            userPrompt = `Recommend models for: "${payload.prompt}"`;
            if (payload.candidates && payload.candidates.length > 0) {
                userPrompt += `\n\nCRITICAL: You MUST ONLY rank, select, and explain from the following pre-selected candidate models. Do NOT invent, hallucinate, or suggest any model IDs not in this list.`;
                userPrompt += `\nCandidate Models:\n${payload.candidates.map(c => `- Model ID: ${c.id}, Name: "${c.name}", Local Match Score: ${c.score}`).join('\n')}`;
            }
        } else if (action === 'random') {
            const maxWords = payload.maxWords || 70;

            // Map creativity to temperatures
            const tempMap = { 'focused': 0.8, 'balanced': 1.1, 'wild': 1.5 };
            temperature = tempMap[payload.creativity || 'balanced'] || 1.1;

            const creativeDirections = [
                "focus on surrealism",
                "explore texture contrasts",
                "use unexpected color palettes",
                "blend sci-fi and historical elements",
                "create extreme perspective",
                "employ maximalist details",
                "emphasize soft ethereal atmospheres",
                "focus on stark dramatic lighting"
            ];
            const direction = creativeDirections[Math.floor(Math.random() * creativeDirections.length)];

            userPrompt = `Generate a random, creative image prompt. Theme: ${payload.theme || 'random'}. Creative Direction: ${direction}.`;
            userPrompt += `\nSystem Rule: Limit response to ${maxWords} words maximum.`;
            userPrompt += `\nFollow the 3-step process for style, positive, and negative prompts.`;
            if (payload.greylist && payload.greylist.length > 0) {
                userPrompt += `\nAvoid using the following words or subjects if possible: ${payload.greylist.join(', ')}.`;
            }
            if (payload.recentPrompts && payload.recentPrompts.length > 0) {
                userPrompt += `\nAve avoiding highly similar themes or direct variations of your previous 3 generations: ${payload.recentPrompts.join("; ")}`;
            }
        } else if (action === 'generate-variations') {
            const count = payload.count || 5;
            const strategy = payload.strategy || 'mixed';

            if (strategy === 'mixed') {
                userPrompt = `Generate ${count} variations for: "${payload.basePrompt}". Include a mix of lighting, style, composition, mood, detail, and color variations.`;
            } else {
                userPrompt = `Generate ${count} ${strategy} variations for: "${payload.basePrompt}". Focus specifically on altering the ${strategy} while keeping the core subject intact.`;
            }
            // Ensure response format
            userPrompt += ` Return ONLY valid JSON: { "variations": [{ "type": "${strategy}", "prompt": "..." }] }.`;

            maxTokens = 2000;
        } else if (action === 'generate-title') {
            userPrompt = `Prompt: "${payload.prompt}"`;
            maxTokens = 100;
        } else if (action === 'suggest-tags') {
            userPrompt = `Prompt: "${payload.prompt}"`;
            maxTokens = 200;
        } else if (action === 'describe-character') {
            // Vision multimodal prompt construction
            // Payload should contain imageUrl (url or base64 data uri)
            const imageUrl = payload.imageUrl;
            const isOverride = payload.override;

            // Check if it is a URL or Base64
            const isBase64 = imageUrl.startsWith('data:');

            let content = [];

            // Logic: If override is true, we force description. If false, we check for person.
            let instruction = isOverride
                ? "Describe the character in this image in detail (physical appearance only). Ignoring any previous warnings about no person found."
                : "Analyze this image. Is there a specific character/person? If yes, provide a detailed physical description. If NO person/character is found, return JSON: { \"found\": false, \"reason\": \"...\" }. If found, return JSON: { \"found\": true, \"description\": \"...\" }.";

            content.push({ type: 'text', text: instruction });

            if (isBase64) {
                content.push({
                    type: 'image_url',
                    image_url: { url: imageUrl }
                });
            } else {
                content.push({
                    type: 'image_url',
                    image_url: { url: imageUrl }
                });
            }

            userPrompt = content; // Pass array for multimodal
            maxTokens = 1000;

        } else if (action === 'optimize-for-model') {
            userPrompt = `Optimize this prompt for model: "${payload.targetModel}".\nPositive Prompt: "${payload.prompt}"\n`;
            if (payload.negativePrompt) {
                userPrompt += `Negative Prompt: "${payload.negativePrompt}"\n`;
            }
            userPrompt += `\nTask: Rewrite the prompt to be optimal for ${payload.targetModel}.`;
            maxTokens = 1500;

        } else if (action === 'generate-negative-prompt') {
            userPrompt = "Generate a negative prompt based on the standard structure.";
            maxTokens = 200;

        } else if (action === 'extract-keywords') {
            if (!payload.prompt) {
                return res.status(400).json({ error: 'Missing prompt text for keyword extraction' });
            }
            userPrompt = `Prompt: "${payload.prompt}"`;
            maxTokens = 150;

        } else if (action === 'test-connection') {
            // Bypass AI call for test, just check provider availability
            const provider = await getActiveProvider();
            if (!provider) throw new Error('No active AI provider found');
            return res.json({ result: `Connection successful! Using ${provider.provider || provider.type}` });
        } else if (action === 'list-models') {
            // Dynamic model listing
            // Payload might contain provider and key if we want to list for a specific non-active provider
            // But for now let's reuse getActiveProvider OR allow passing credentials for setup time
            let providerConfig = null;

            if (payload.provider) {
                if (payload.apiKey) {
                    providerConfig = { provider: payload.provider, apiKey: payload.apiKey, type: 'cloud' };
                } else if (payload.provider === 'local') {
                    providerConfig = { type: 'local', endpoint_url: payload.endpointUrl, provider: payload.subProvider };
                } else {
                    // Look up saved credentials for the requested provider
                    providerConfig = await getProviderCredentials(payload.provider);

                    // Special case: OpenRouter doesn't strictly need a key to list models
                    if (!providerConfig && payload.provider === 'openrouter') {
                        providerConfig = { provider: 'openrouter', apiKey: '', type: 'cloud' };
                    }
                }
            } else if (payload.endpointUrl) {
                providerConfig = { type: 'local', endpoint_url: payload.endpointUrl, provider: payload.subProvider };
            } else {
                providerConfig = await getActiveProvider();
            }

            if (!providerConfig) {
                return res.status(400).json({ error: 'No provider configuration found to list models.' });
            }

            const models = await listModels(providerConfig);
            return res.json({ result: models });

        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        if (JSON_ACTIONS.has(action)) {
            temperature = Math.min(temperature, 0.4);
        }

        async function getProviderCredentials(providerId) {
            if (['ollama', 'lmstudio'].includes(providerId)) {
                const local = await pool.query(
                    'SELECT provider, endpoint_url, model_name FROM user_local_endpoints WHERE provider = $1',
                    [providerId]
                );
                if (local.rows.length > 0) {
                    return { type: 'local', ...local.rows[0] };
                }
            } else {
                const cloud = await pool.query(
                    'SELECT provider, encrypted_key, model_name FROM user_api_keys WHERE provider = $1',
                    [providerId]
                );
                if (cloud.rows.length > 0) {
                    return {
                        type: 'cloud',
                        provider: cloud.rows[0].provider,
                        apiKey: decrypt(cloud.rows[0].encrypted_key),
                        modelName: cloud.rows[0].model_name
                    };
                }
            }
            return null;
        }

        // ... (existing getActiveProvider and other functions)

        // Determine which provider/model to use
        let provider;

        // Helper: parse "provider:model" taskModel string into { provider, model } preference
        function parseTaskModel(taskModel) {
            if (!taskModel || typeof taskModel !== 'string') return null;
            const sepIdx = taskModel.indexOf(':');
            if (sepIdx === -1) return null;
            return { provider: taskModel.slice(0, sepIdx), model: taskModel.slice(sepIdx + 1) };
        }

        // Resolve effective preferences: taskModel takes priority over apiPreferences
        const effectivePrefs = parseTaskModel(payload.taskModel) ?? (payload.apiPreferences?.provider ? payload.apiPreferences : null);

        // If the client requested specific preferences (e.g. for Prompt Improver), try to use them
        if (effectivePrefs && effectivePrefs.provider) {
            // Fetch credentials for the requested provider
            provider = await getProviderCredentials(effectivePrefs.provider);

            // If a specific model was also requested, override the default one from DB
            if (provider && effectivePrefs.model) {
                provider.modelName = effectivePrefs.model; // For cloud
                provider.model_name = effectivePrefs.model; // For local
            }
        }

        // Logic to select model_gen vs model_improve
        // Determine which role we are fulfilling
        // ACTIONS that require an LLM (text generation/analysis) should use the 'improvement' provider
        // ACTIONS that generate Images should use the 'generation' provider (though 'generate' here currently generates a PROMPT, so it's also text... wait)

        // The 'generate' action in this file generates a PROMPT from a description. So it IS text generation.
        // Actually, ALL actions in this file return TEXT (JSON or String). None return an Image directly (except strictly image gen which is not handled here, it's in a different route or 'generate' returns prompt text).

        // However, the user likely configures "Generation Model" as their Image Generator (e.g. Flux) and "Assistant Model" as their LLM (e.g. GPT-4).
        // If we send "Write a prompt" to Flux, it fails.
        // So essentially ALL logic in this file should use the Assistant/Improvement model, EXCEPT maybe none?
        // Let's check 'generate'. It transforms description to prompt. That needs an LLM.
        // 'random'. Generates a prompt. Needs LLM.

        // It seems ALL actions in this AI route should use the 'improvement' (LLM) provider, because this route is entirely about Prompt Engineering (Text-to-Text).
        // The only exception IS if we implemented actual Image Generation here, which we don't seem to.

        // Let's look at getActiveProvider usage.
        // The app differentiates "Generation Model" vs "Assistant Model".
        // It seems safer to force EVERYTHING here to use the 'improvement' model, unless the user specifically wants their 'Generation Model' (which might be an LLM if they are using DALL-E 3 via OpenAI chat).

        // But if they use OpenRouter/Local with Flux, 'Generation Model' is Flux. Flux cannot write prompts.
        // So 'generate', 'random', 'suggest-tags' MUST use the 'improvement' model.

        // I will expand the list to include ALL text-processing actions.
        const isImprovementAction = [
            'improve',
            'improve-with-negative',
            'improve-detailed',
            'diagnose',
            'optimize-for-model',
            'recommend-models',
            'suggest-tags',
            'generate-title',
            'generate-negative-prompt',
            'describe-character',
            'generate', // Description -> Prompt
            'random',   // Random Prompt
            'generate-variations'
        ].includes(action);
        const role = isImprovementAction ? 'improvement' : 'generation';

        // Fallback to active provider if no preference or preference failed to load
        if (!provider) {
            provider = await getActiveProvider(role);
        }

        if (!provider) {
            return res.status(503).json({ error: 'No AI provider configured for this action. Please check your Settings.' });
        }

        // Default to model_gen (or legacy model_name if not set)
        let activeModel = provider.modelGen || provider.model_gen || provider.modelName || provider.model_name;

        // For improvement tasks, use model_improve if available
        if (isImprovementAction) {
            activeModel = provider.modelImprove || provider.model_improve || activeModel;
        }

        // Apply the selected model to the provider config so callAI uses it
        provider.modelName = activeModel;
        provider.model_name = activeModel;

        const isLoggingEnabled = req.headers['x-log-api-requests'] === 'true';
        if (isLoggingEnabled) {
            logger.info(`[API Request -> ${action}] Provider: ${provider.provider || provider.type} | Model: ${activeModel}`);
            logger.info(`[API Request Payload]: ${JSON.stringify({ systemPrompt, userPrompt, maxTokens, temperature }, null, 2)}`);

            const reqLog = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n[${new Date().toISOString()}]\n[API Request -> ${action}] Provider: ${provider.provider || provider.type} | Model: ${activeModel}\n[API Request Payload]: ${JSON.stringify({ systemPrompt, userPrompt, maxTokens, temperature }, null, 2)}\n`;
            fs.appendFile(path.join(__dirname, '../../logs/api.log'), reqLog, (err) => { if (err) console.error('Error writing to api.log', err); });
        }

        const { content: result, usage } = await callAI(provider, systemPrompt, userPrompt, maxTokens, temperature, {
            forceJson: JSON_ACTIONS.has(action),
            action
        });

        const promptTokens = usage?.prompt_tokens || 0;
        const completionTokens = usage?.completion_tokens || 0;

        if (isLoggingEnabled) {
            logger.info(`[API Response <- ${action}] Usage: ${JSON.stringify(usage)}`);
            logger.info(`[API Response Content]: ${result}`);

            const resLog = `[API Response <- ${action}] Usage: ${JSON.stringify(usage)}\n[API Response Content]: ${result}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            fs.appendFile(path.join(__dirname, '../../logs/api.log'), resLog, (err) => { if (err) console.error('Error writing to api.log', err); });
        }

        // Log token usage to DB (fire and forget)
        const costHint = payload.apiPreferences?.pricing ? (
            promptTokens * (parseFloat(payload.apiPreferences.pricing.prompt) || 0) +
            completionTokens * (parseFloat(payload.apiPreferences.pricing.completion) || 0)
        ) : null;

        const cost = estimateCostUsd(
            provider.provider || provider.type,
            provider.modelName || provider.model_name || '',
            promptTokens, completionTokens,
            costHint
        );
        logUsage(pool, {
            sessionId: req.headers['x-session-id'] || null,
            action,
            provider: provider.provider || provider.type || 'unknown',
            model: provider.modelName || provider.model_name || '',
            promptTokens,
            completionTokens,
            cost,
        });

        // Parse JSON if needed (for actions that return JSON)
        let parsedResult = result;
        if (JSON_ACTIONS.has(action)) {
            try {
                const tryParseJson = (value) => {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return null;
                    }
                };

                const normalizeJsonish = (value) => {
                    if (!value || typeof value !== 'string') return value;
                    let text = value.trim();

                    // Strip markdown fences
                    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                    if (codeBlockMatch) {
                        text = codeBlockMatch[1].trim();
                    }

                    // Strip leading json markers like "json", "json:", "JSON\n"
                    text = text.replace(/^json\s*[:\-]?\s*/i, '');

                    // If wrapped in [] but looks like an object payload, unwrap to object braces
                    if (text.startsWith('[') && text.endsWith(']') && text.includes('"improved"')) {
                        text = text.slice(1, -1).trim();
                    }

                    // If key/value pairs exist but no surrounding braces, add them
                    if (!text.startsWith('{') && /"[A-Za-z0-9_]+"\s*:/.test(text)) {
                        text = `{${text}}`;
                    }

                    // Remove trailing commas before closing braces/brackets
                    text = text.replace(/,\s*([}\]])/g, '$1');
                    return text;
                };

                let jsonStr = result;
                // Attempt to find JSON within markdown code blocks first
                const codeBlockMatch = result && result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonStr = codeBlockMatch[1];
                } else {
                    // Fallback to finding the first { and last }
                    const firstBrace = result ? result.indexOf('{') : -1;
                    const lastBrace = result ? result.lastIndexOf('}') : -1;
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        jsonStr = result.substring(firstBrace, lastBrace + 1);
                    }
                }

                if (jsonStr) {
                    const direct = tryParseJson(jsonStr);
                    if (direct !== null) {
                        parsedResult = direct;
                    } else {
                        const normalized = normalizeJsonish(jsonStr);
                        const recovered = tryParseJson(normalized);
                        if (recovered !== null) {
                            parsedResult = recovered;
                        } else {
                            throw new Error('Unrecoverable JSON parse failure');
                        }
                    }
                } else {
                    logger.warn('No JSON found in response');
                    // Return a safe fallback structure if possible, or just the raw text
                    parsedResult = { error: "Failed to parse AI response", raw: result };
                }
            } catch (e) {
                logger.warn('Failed to parse JSON response:', e);
                // Return raw text if parsing fails, but helpful to log what it was
                logger.debug('Raw output was: ' + result);
                parsedResult = { error: "Invalid JSON from AI", raw: result };
            }

            if (action === 'improve-with-negative' && parsedResult && typeof parsedResult === 'object' && !parsedResult.error) {
                const improved = typeof parsedResult.improved === 'string' ? parsedResult.improved.trim() : '';
                const negative = typeof parsedResult.negativePrompt === 'string' ? parsedResult.negativePrompt.trim() : '';
                parsedResult = {
                    improved,
                    negativePrompt: negative
                };
            }
        }

        // Set rate limit headers
        res.set('ratelimit-remaining', '5000'); // Default value
        res.set('ratelimit-reset', Math.floor(Date.now() / 1000) + 900); // 15 minutes from now

        res.json({
            result: parsedResult,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                estimated_cost_usd: cost,
                provider: provider.provider || provider.type || 'unknown',
                model: provider.modelName || provider.model_name || '',
                action
            }
        });

    } catch (err) {
        logger.error('AI Service Error:', err.message);

        // Handle connection refused / fetch failed (Local AI down)
        if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
            return res.status(503).json({
                error: 'Could not connect to AI provider',
                details: 'Please ensure your Local AI (Ollama/LM Studio) is running and the URL is correct.',
                hint: 'Check settings or try testing the connection.'
            });
        }

        // Ensure we send a useful error message back to the client
        const isOperational = err.message.includes('Provider Error') || err.message.includes('safety') || err.message.includes('Rate limit');
        res.status(500).json({
            error: err.message || 'An unexpected error occurred',
            details: isOperational ? undefined : (err.stack ? err.stack.split('\n')[0] : undefined)
        });
    }
});

function isLocalProvider(provider) {
    if (!provider) return false;
    return ['ollama', 'lmstudio', 'local', 'localhost'].includes(provider.toLowerCase());
}

module.exports = router;
module.exports.isLocalProvider = isLocalProvider;
module.exports.getActiveProvider = getActiveProvider;
module.exports.callAI = callAI;
