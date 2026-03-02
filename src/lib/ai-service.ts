import { API_BASE_URL } from './constants';
import { db } from './api';

const API_URL = `${API_BASE_URL}/api/ai`;

async function callAI(action: string, payload: Record<string, unknown>, token: string) {
  const loggingEnabled = localStorage.getItem('nc_api_logging_enabled') === 'true';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  if (loggingEnabled) {
    headers['X-Log-Api-Requests'] = 'true';
    console.log(`[AI Request -> ${action}]`, payload);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });

  const data = await res.json();

  if (loggingEnabled) {
    if (res.ok) {
      console.log(`[AI Response <- ${action}]`, data);
    } else {
      console.error(`[AI Error <- ${action}]`, data);
    }
  }

  if (!res.ok) {
    const errorMessage = data.error || 'AI request failed';
    const errorDetails = data.details && !data.details.includes(errorMessage) ? ` (${data.details})` : '';
    throw new Error(`${errorMessage}${errorDetails}`);
  }

  const rateLimitRemaining = res.headers.get('ratelimit-remaining');
  const rateLimitReset = res.headers.get('ratelimit-reset');

  // Attach rate limit info to the result object if it's an object,
  // otherwise we just return the result (some endpoints might return raw strings, though most return objects).
  if (data.result && typeof data.result === 'object') {
    data.result._rateLimit = {
      remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null,
      reset: rateLimitReset ? parseInt(rateLimitReset, 10) : null
    };
  }

  // Dispatch global event for the RateLimit widget
  if (rateLimitRemaining || rateLimitReset) {
    window.dispatchEvent(new CustomEvent('nc-rate-limit-update', {
      detail: {
        remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null,
        reset: rateLimitReset ? parseInt(rateLimitReset, 10) : null
      }
    }));
  }

  // Dispatch global usage event for session stats
  if (data.usage) {
    window.dispatchEvent(new CustomEvent('nc-usage-update', {
      detail: data.usage
    }));
  }

  return data.result;
}

export function taskModelToPreferences(taskModel?: string): ApiPreferences | undefined {
  if (!taskModel) return undefined;
  const sepIdx = taskModel.indexOf(':');
  if (sepIdx === -1) return undefined;
  return { provider: taskModel.slice(0, sepIdx), model: taskModel.slice(sepIdx + 1) };
}

export async function improvePrompt(prompt: string, token: string, apiPreferences?: ApiPreferences, taskModel?: string, modelTips?: string[]): Promise<string> {
  const payload: Record<string, unknown> = { prompt };
  const prefs = taskModelToPreferences(taskModel) ?? apiPreferences;
  if (prefs) payload.apiPreferences = prefs;
  if (modelTips && modelTips.length > 0) payload.modelTips = modelTips;
  return callAI('improve', payload, token);
}

export async function extractKeywords(prompt: string, token: string): Promise<string[]> {
  try {
    const rawResult = await callAI('extract-keywords', { prompt }, token);
    
    if (typeof rawResult === 'string') {
      // In case the AI returns a markdown block like ```json ["word"] ```
      let cleanString = rawResult;
      if (cleanString.startsWith('```json')) {
        cleanString = cleanString.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (cleanString.startsWith('```')) {
        cleanString = cleanString.replace(/```/g, '').trim();
      }

      try {
        return JSON.parse(cleanString);
      } catch {
        // Fallback if the AI returns a string that isn't valid JSON (e.g. comma separated)
        return cleanString.replace(/[[\]"]/g, '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 10);
      }
    }
    
    if (Array.isArray(rawResult)) {
      return rawResult;
    }
    
    return [];
  } catch (error) {
    console.error('Failed to extract keywords:', error);
    return []; // Fail gracefully as per requirements
  }
}

export async function improvePromptWithNegative(
  prompt: string,
  negativePrompt: string,
  token: string,
  apiPreferences?: ApiPreferences,
  taskModel?: string,
  modelTips?: string[]
): Promise<{ improved: string; negativePrompt: string }> {
  const payload: Record<string, unknown> = { prompt, negativePrompt };
  const prefs = taskModelToPreferences(taskModel) ?? apiPreferences;
  if (prefs) payload.apiPreferences = prefs;
  if (modelTips && modelTips.length > 0) payload.modelTips = modelTips;
  return callAI('improve-with-negative', payload, token);
}

export interface DetailedImprovement {
  improved: string;
  reasoning: string[];
  alternateVersions: Array<{
    variation: string;
    description: string;
    prompt: string;
  }>;
  changesSummary: string;
}

export interface ApiPreferences {
  provider: string;
  model?: string;
  pricing?: {
    prompt: string | number;
    completion: string | number;
  };
}

export async function improvePromptDetailed(
  prompt: string,
  token: string,
  apiPreferences?: ApiPreferences
): Promise<DetailedImprovement> {
  const payload: Record<string, unknown> = { prompt };
  if (apiPreferences) {
    payload.apiPreferences = apiPreferences;
  }
  return callAI('improve-detailed', payload, token);
}

export interface StyleAnalysis {
  profile: string;
  themes: string[];
  techniques: string[];
  suggestions: string[];
  signature: string;
}

export async function analyzeStyle(prompts: string[], token: string): Promise<StyleAnalysis> {
  return callAI('analyze-style', { prompts }, token);
}

export interface GeneratePreferences {
  style?: string | undefined;
  mood?: string | undefined;
  subject?: string | undefined;
  maxWords?: number | undefined;
  creativity?: string | undefined;
}

export async function generateFromDescription(
  description: string,
  options: {
    context?: string | undefined;
    preferences?: GeneratePreferences | undefined;
    successfulPrompts?: string[] | undefined;
    greylist?: string[] | undefined;
    taskModel?: string | undefined;
  },
  token: string
): Promise<{ prompt: string; negativePrompt?: string }> {
  const payload: Record<string, unknown> = {
    description,
    context: options.context,
    preferences: options.preferences,
    successfulPrompts: options.successfulPrompts,
    greylist: options.greylist,
  };
  const prefs = taskModelToPreferences(options.taskModel);
  if (prefs) payload.apiPreferences = prefs;
  return callAI('generate', payload, token);
}

export async function generateRandomPromptAI(token: string, theme?: string, maxWords?: number, greylist?: string[], creativity?: 'focused' | 'balanced' | 'wild', recentPrompts?: string[], taskModel?: string): Promise<{ prompt: string; negativePrompt?: string; style?: string }> {
  const payload: Record<string, unknown> = { theme, maxWords, greylist, creativity, recentPrompts };
  const prefs = taskModelToPreferences(taskModel);
  if (prefs) payload.apiPreferences = prefs;
  return callAI('random', payload, token);
}

export async function generateNegativePrompt(token: string): Promise<string> {
  return callAI('generate-negative-prompt', {}, token);
}

export interface Diagnosis {
  cause: string;
  fixes: string[];
  improvedPrompt: string;
}

export async function diagnosePrompt(prompt: string, issue: string, token: string): Promise<Diagnosis> {
  return callAI('diagnose', { prompt, issue }, token);
}

export interface ModelRecommendation {
  modelId: string;
  modelName: string;
  matchScore: number;
  reasoning: string;
  tips: string[];
  recommendedPreset?: string | undefined;
}

export interface RecommendModelsResult {
  recommendations: ModelRecommendation[];
}

export async function recommendModels(
  prompt: string,
  options?: { budget?: string; style?: string; candidates?: { id: string; name: string; score: number }[] },
  token?: string
): Promise<RecommendModelsResult> {
  return callAI('recommend-models', {
    prompt,
    budget: options?.budget,
    style: options?.style,
    candidates: options?.candidates,
  }, token ?? '');
}

export interface ImageAnalysisResult {
  composition: string;
  lighting: string;
  colors: string;
  technicalQuality: string;
  overallScore: number;
  promptMatch: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  improvedPrompt: string;
}

export async function analyzeImage(
  image: { imageUrl?: string; imageBase64?: string; imageMimeType?: string },
  promptUsed: string | undefined,
  token: string
): Promise<ImageAnalysisResult> {
  return callAI('analyze-image', {
    imageUrl: image.imageUrl,
    imageBase64: image.imageBase64,
    imageMimeType: image.imageMimeType,
    promptUsed,
  }, token);
}

export interface BatchImageAnalysis {
  imageIndex: number;
  model: string;
  overallScore: number;
  promptMatch: number;
  composition: string;
  lighting: string;
  colors: string;
  technicalQuality: string;
  strengths: string[];
  weaknesses: string[];
}

export interface BatchAnalysisResult {
  analyses: BatchImageAnalysis[];
  comparison: {
    winnerIndex: number;
    winnerReasoning: string;
    commonIssues: string[];
    modelStrengths: Record<string, string[]>;
  };
  improvedPrompt: string;
}

export interface BatchImageInput {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  model: string;
}

export async function batchAnalyzeImages(
  images: BatchImageInput[],
  promptUsed: string | undefined,
  token: string
): Promise<BatchAnalysisResult> {
  return callAI('batch-analyze', { images, promptUsed }, token);
}

export interface PromptVariation {
  type: string;
  prompt: string;
  negativePrompt?: string;
}

export async function generatePromptVariations(
  basePrompt: string,
  token: string,
  count: number = 5,
  strategy: string = 'mixed'
): Promise<PromptVariation[]> {
  return callAI('generate-variations', { basePrompt, count, strategy }, token);
}

export async function testConnection(token: string): Promise<string> {
  return callAI('test-connection', {}, token);
}

export interface CharacterDescriptionResult {
  found: boolean;
  description?: string;
  reason?: string;
}

export async function describeCharacter(
  imageUrl: string,
  override: boolean,
  token: string
): Promise<CharacterDescriptionResult | string> {
  return callAI('describe-character', { imageUrl, override }, token);
}

export function resizeImageToBase64(file: File, maxSize = 1024): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h / w) * maxSize);
          w = maxSize;
        } else {
          w = Math.round((w / h) * maxSize);
          h = maxSize;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ data: base64, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function generateTitle(prompt: string, token: string): Promise<string> {
  return callAI('generate-title', { prompt }, token);
}

export async function suggestTags(prompt: string, token: string): Promise<string> {
  return callAI('suggest-tags', { prompt }, token);
}

export async function optimizePromptForModel(
  prompt: string,
  targetModel: string,
  token: string,
  negativePrompt?: string,
  apiPreferences?: ApiPreferences
): Promise<{ optimizedPrompt: string; negativePrompt?: string }> {
  const payload: Record<string, unknown> = { prompt, targetModel, negativePrompt };
  if (apiPreferences) payload.apiPreferences = apiPreferences;
  return callAI('optimize-for-model', payload, token);
}

export interface ModelListItem {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
}

export async function listModels(
  token: string,
  provider?: string,
  apiKey?: string,
  endpointUrl?: string
): Promise<ModelListItem[]> {
  const payload: Record<string, unknown> = {};
  if (provider) payload.provider = provider;
  if (apiKey) payload.apiKey = apiKey;
  if (endpointUrl) payload.endpointUrl = endpointUrl;

  return callAI('list-models', payload, token);
}

export function triggerKeywordExtraction(promptId: string, content: string, token: string = '') {
  extractKeywords(content, token).then(async (keywords) => {
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      await db.from('prompts').update({ auto_keywords: keywords }).eq('id', promptId);
    }
  }).catch((err) => {
    console.error('Background keyword extraction failed:', err);
  });
}
