import { useState, useEffect, useCallback } from 'react';
import { handleAIError } from '../lib/error-handler';
import { toast } from 'sonner';
import { Shuffle, Copy, Check, Save, Loader2, ArrowRight, Compass, Sparkles, PenTool, Palette, Eraser, Coins, RefreshCcw, BarChart2 } from 'lucide-react';
import ChoiceModal from './ChoiceModal';
import { generateRandomPrompt } from '../lib/prompt-fragments';
import { analyzePrompt, supportsNegativePrompt, getTopCandidates } from '../lib/models-data';
import { recommendNCModel } from '../lib/nc-model-recommender';
import { db } from '../lib/api';
import { generateRandomPromptAI, listModels, ModelListItem, recommendModels, triggerKeywordExtraction } from '../lib/ai-service';
import { listApiKeys } from '../lib/api-keys-service';
import { getDefaultModelForProvider, ModelOption } from '../lib/provider-models';
import { estimateLLMCost } from '../lib/pricing';
import { useTaskModels } from '../hooks/useTaskModels';
import type { Prompt } from '../lib/types';
import DiversityInsights from './DiversityInsights';
import { buildDiversityContext, type DiversityContext } from '../lib/diversity-context';

interface FilterState {
  dreamy: boolean;
  characters: boolean;
  cinematic: boolean;
  [key: string]: boolean;
}

interface RandomGeneratorProps {
  onSwitchToGuided: (prompt: string) => void;
  onSwitchToManual?: (prompt: string, negative: string) => void;
  onSaved: () => void;
  onPromptGenerated: (prompt: string) => void;
  onNegativePromptChanged?: (neg: string) => void;
  maxWords: number;
  initialPrompt?: string;
  initialNegativePrompt?: string;
  onCheckExternalFields?: (proceed: (keepNegative: boolean) => void, isLocalDirty: boolean, config?: {title?: string, message?: React.ReactNode, fullClear?: boolean}) => void;
  onAiAdviceTips?: (tips: string[]) => void;
  magicInputSlot?: React.ReactNode;
  greylist: string[];
  recentPrompts?: string[];
  onRequestSavePrompt?: (data: Partial<Prompt>) => void;
}

export default function RandomGenerator({ onSwitchToGuided, onSwitchToManual, onSaved, onRequestSavePrompt, onPromptGenerated, onNegativePromptChanged, maxWords, initialPrompt, initialNegativePrompt, onCheckExternalFields, onAiAdviceTips, magicInputSlot, greylist, recentPrompts }: RandomGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState(initialPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState(initialNegativePrompt || '');
  const { generate: taskGenerateModel } = useTaskModels();

  // Sync state when initialPrompt changes (e.g. from Magic Prompt Input)
  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt);
      setLastGeneratedPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const [filters, setFilters] = useState<FilterState>({ dreamy: false, characters: false, cinematic: false });
  const [creativityLevel, setCreativityLevel] = useState<'focused' | 'balanced' | 'wild'>('balanced');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatedStyle, setGeneratedStyle] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeModelPricing, setActiveModelPricing] = useState<{ prompt: string, completion: string } | undefined>(undefined);

  // Diversity State
  const [showDiversity, setShowDiversity] = useState(false);
  const [autoDiversityEnabled, setAutoDiversityEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('nightcompanion_auto_diversity');
      return saved === 'true';
    } catch { return false; }
  });
  const [diversityContext, setDiversityContext] = useState<DiversityContext | null>(null);

  useEffect(() => {
    localStorage.setItem('nightcompanion_auto_diversity', String(autoDiversityEnabled));
  }, [autoDiversityEnabled]);

  const loadDiversity = useCallback(async () => {
    try {
        const ctx = await buildDiversityContext();
        setDiversityContext(ctx);
    } catch (e) {
        console.error('Failed to load diversity context', e);
    }
  }, []);

  useEffect(() => {
    if (showDiversity && !diversityContext) {
      loadDiversity();
    }
  }, [showDiversity, loadDiversity, diversityContext]);

  // Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<((keepNegative: boolean) => void) | null>(null);

  // AI model advice state
  const [aiAdvice, setAiAdvice] = useState<{ id: string; name: string; reasoning: string; tips: string[]; preset?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('nightcompanion_random_ai_advice');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  });
  const [loadingAiAdvice, setLoadingAiAdvice] = useState(false);

  useEffect(() => {
    if (aiAdvice) {
      localStorage.setItem('nightcompanion_random_ai_advice', JSON.stringify(aiAdvice));
    } else {
      localStorage.removeItem('nightcompanion_random_ai_advice');
    }
  }, [aiAdvice]);

  const confirmClear = (action: (keepNegative: boolean) => void) => {
    if (prompt.trim()) {
      setPendingAction(() => action);
      setShowClearModal(true);
    } else {
      action(false);
    }
  };

  const fetchActiveModel = useCallback(async () => {
    try {
      // await db.auth.getSession();

      // Check cloud providers FIRST (matches Settings precedence)
      const keys = await listApiKeys();
      const activeKey = keys.find(k => k.is_active_gen || k.is_active); // Prioritize gen flag

      if (activeKey) {
        const model = activeKey.model_gen || activeKey.model_name || getDefaultModelForProvider(activeKey.provider);
        const providerName = activeKey.provider.charAt(0).toUpperCase() + activeKey.provider.slice(1);
        setActiveModel(`${providerName} ${model}`);

        // Try to find pricing in cached styles
        try {
          const cached = localStorage.getItem('cachedModels');
          if (cached) {
            const models = JSON.parse(cached)[activeKey.provider] as ModelOption[];
            const modelData = models?.find(m => m.id === model);
            if (modelData?.pricing) {
              const newPricing = modelData.pricing;
              setActiveModelPricing(prev => prev?.prompt === newPricing.prompt && prev?.completion === newPricing.completion ? prev : newPricing);
              return;
            }
          }
        } catch { /* ignore */ }

        // If activeKey is openrouter but we don't have pricing, try to fetch it
        if (activeKey.provider === 'openrouter' && !activeModelPricing) {
          // We need a token or at least call the endpoint.

          const token = '';
          listModels(token, 'openrouter').then((routerModels: ModelListItem[]) => {
            // Update cache
            try {
              const existingCache = localStorage.getItem('cachedModels');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cache: any = existingCache ? JSON.parse(existingCache) : {};
              cache['openrouter'] = routerModels;
              localStorage.setItem('cachedModels', JSON.stringify(cache));

              // Update state
              const found = routerModels.find((m) => m.id === model);
              if (found?.pricing) {
                const newPricing = found.pricing;
                setActiveModelPricing(prev => prev?.prompt === newPricing.prompt && prev?.completion === newPricing.completion ? prev : newPricing);
              }
            } catch (e) { console.error("Failed to update cache", e); }
          }).catch((err: unknown) => console.error("Failed to fetch openrouter models", err));
          return;
        }

        if (activeModelPricing) {
          setActiveModelPricing(undefined);
        }
        return;
      }

      // Check local endpoints fallback
      const { data: localData } = await db
        .from('user_local_endpoints')
        .select('*')
        .eq('is_active_gen', true) // Check for generation specific flag
        .single();

      if (localData) {
        const modelName = localData.model_gen || localData.model_name;
        setActiveModel(`${localData.provider === 'ollama' ? 'Ollama' : 'LM Studio'} (${modelName})`);
        return;
      }

      setActiveModel('');
    } catch (e) {
      console.error('Failed to fetch active model', e);
    }
  }, [activeModelPricing]);

  // Fetch active model on mount and focus
  useEffect(() => {
    fetchActiveModel();

    const onFocus = () => fetchActiveModel();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchActiveModel]);

  function handleGenerate() {
    const isLocalDirty = prompt.trim().length > 0 && prompt.trim() !== lastGeneratedPrompt.trim();
    if (onCheckExternalFields) {
      onCheckExternalFields(executeGenerate, isLocalDirty, {
        title: 'Clear AI Draft?',
        message: 'Generating a new prompt will clear your current AI Draft. Proceed?',
        fullClear: false
      });
    } else {
      if (isLocalDirty) {
        confirmClear(executeGenerate);
      } else {
        executeGenerate(false);
      }
    }
  }

  function executeGenerate(keepNegative: boolean) {
    const computedGreylist = autoDiversityEnabled && diversityContext
      ? Array.from(new Set([...greylist, ...diversityContext.overusedKeywords]))
      : greylist;

    const run = () => {
      const newPrompt = generateRandomPrompt(filters, computedGreylist);
      setPrompt(newPrompt);
      setLastGeneratedPrompt(newPrompt);
      if (!keepNegative) {
        setNegativePrompt('');
        onNegativePromptChanged?.('');
      }
      setGeneratedStyle('');
      setCopiedPrompt(false);
      setCopiedNeg(false);
      setAiAdvice(null); // Clear previous advice
      localStorage.removeItem('nightcompanion_random_ai_advice');
      onPromptGenerated(newPrompt);
    };

    run();
  }

  async function handleCopyPrompt() {
    if (!navigator.clipboard) return;
    try {
      window.focus();
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  async function handleCopyNegative() {
    if (!negativePrompt || !navigator.clipboard) return;
    try {
      window.focus();
      await navigator.clipboard.writeText(negativePrompt);
      setCopiedNeg(true);
      setTimeout(() => setCopiedNeg(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  async function handleSave() {
    if (!prompt) return;
    setSaving(true);

    const fullContent = negativePrompt
      ? `${prompt}\n\n### Negative Prompt:\n${negativePrompt}`
      : prompt;

    const topSuggestion = (prompt && typeof prompt === 'string') ? analyzePrompt(prompt)[0] : null;

    // Build the generation journey chain
    const journeySteps = [
      { step: regenerating ? 'Magic Random (AI)' : 'Random', label: '🎲 Random' },
    ];
    if (generatedStyle) journeySteps.push({ step: 'Style', label: `🎨 ${generatedStyle}` });
    if (filters.dreamy) journeySteps.push({ step: 'Filter', label: '💫 Dreamy' });
    if (filters.characters) journeySteps.push({ step: 'Filter', label: '👤 Characters' });
    if (filters.cinematic) journeySteps.push({ step: 'Filter', label: '🎬 Cinematic' });

    if (onRequestSavePrompt) {
      onRequestSavePrompt({
        title: (prompt.split(',')[0] || 'Untitled').trim().slice(0, 160),
        content: fullContent,
        ...(generatedStyle ? { notes: `Style: ${generatedStyle}` } : {}),
        generation_journey: journeySteps,
        model: activeModel,
      });
      setSaving(false);
      return;
    }

    const suggestedModelIdToSave = aiAdvice ? aiAdvice.id : (topSuggestion ? topSuggestion.model.id : undefined);

    // Get NC model recommendation
    let ncModelNote = '';
    try {
      const ncRecommendation = await recommendNCModel(prompt);
      if (ncRecommendation) {
        ncModelNote = ` | Best NC Model: ${ncRecommendation.model.name} (${ncRecommendation.reasons[0]})`;
        toast.success(`Recommended NightCafe model: ${ncRecommendation.model.name}`, {
          description: ncRecommendation.reasons[0],
          duration: 5000,
        });
      }
    } catch (e) {
      console.warn('NC model recommendation failed:', e);
    }

    // Check for duplicates
    const { data: existingPrompts } = await db
      .from('prompts')
      .select('id')
      .eq('content', fullContent)
      .limit(1);

    if (existingPrompts && existingPrompts.length > 0) {
      toast.error('This prompt is already in your library.');
      setSaving(false);
      return;
    }

    const { data: newPrompt, error } = await db.from('prompts').insert({
      title: (prompt.split(',')[0] || 'Untitled').trim().slice(0, 160),
      content: fullContent,
      notes: (generatedStyle ? `Style: ${generatedStyle}` : '') + ncModelNote || undefined,
      generation_journey: journeySteps,
      rating: 0,
      is_template: false,
      is_favorite: false,
      model: activeModel,
      suggested_model: suggestedModelIdToSave
    }).select().single();
    
    if (newPrompt && !error) {
      triggerKeywordExtraction(newPrompt.id, newPrompt.content);
    }
    
    setSaving(false);
    onSaved();
  }

  const topSuggestion = (prompt && typeof prompt === 'string') ? analyzePrompt(prompt)[0] : null;

  // Reset AI advice when prompt changes significantly
  const promptRef = { current: prompt };
  promptRef.current = prompt;

  async function handleGetAIAdvice() {
    if (!prompt.trim()) return;
    setLoadingAiAdvice(true);
    try {
      const candidates = getTopCandidates(prompt, 5);
      const result = await recommendModels(prompt, { candidates });
      const top = result.recommendations[0];
      if (top) {
        setAiAdvice({
          id: top.modelId,
          name: top.modelName,
          reasoning: top.reasoning,
          tips: top.tips || [],
          ...(top.recommendedPreset ? { preset: top.recommendedPreset } : {}),
        });
        if (onAiAdviceTips && top.tips) {
          onAiAdviceTips(top.tips);
        }
      }
    } catch (e) {
      handleAIError(e);
    } finally {
      setLoadingAiAdvice(false);
    }
  }

  async function handleMagicRandom() {
    // Refresh model info, but do not block the Magic Random flow
    Promise.race([
      fetchActiveModel(),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]).catch((err) => {
      console.warn('Model refresh failed before Magic Random:', err);
    });

    const isLocalDirty = prompt.trim().length > 0 && prompt.trim() !== lastGeneratedPrompt.trim();
    if (onCheckExternalFields) {
      onCheckExternalFields(executeMagicRandom, isLocalDirty, {
        title: 'Clear AI Draft?',
        message: 'Generating a new prompt will clear your current AI Draft. Proceed?',
        fullClear: false
      });
      return;
    } else {
      if (isLocalDirty) {
        confirmClear(executeMagicRandom);
      } else {
        executeMagicRandom(false);
      }
    }
  }

  async function executeMagicRandom(keepNegative: boolean) {
    const computedGreylist = autoDiversityEnabled && diversityContext
      ? Array.from(new Set([...greylist, ...diversityContext.overusedKeywords]))
      : greylist;

    const run = async () => {
      setRegenerating(true);
      setAiAdvice(null);
      localStorage.removeItem('nightcompanion_random_ai_advice');
      try {
        const token = '';
        const result = await generateRandomPromptAI(token, undefined, maxWords, computedGreylist, creativityLevel, recentPrompts, taskGenerateModel);

        // result is { prompt: string, negativePrompt?: string, style?: string }
        if (result && typeof result === 'object' && 'prompt' in result) {
          const promptText = result.prompt || '';
          const negText = result.negativePrompt || '';
          const styleText = result.style || '';

          setPrompt(promptText);
          setLastGeneratedPrompt(promptText);
          if (!keepNegative) {
            setNegativePrompt(negText); // If we clear everything, we accept the AI's new negative
            onNegativePromptChanged?.(negText);
          } else {
            // If we keep negative, do we keep OLD negative or use NEW negative?
            // "Clear only generation field" implies keeping the OLD negative.
            // But Magic Random generates a PAIR.
            // If user says "Clear only generation field", they might expect the AI to generate a prompt that fits the OLD negative?
            // But the AI already generated a prompt.
            // Let's assume "Keep Negative" means "Preserve my existing negative prompt"
            // So we ignore the AI's negative prompt?
            // Or maybe Magic Random ALWAYS replaces everything?
            // "Clear only generation field" for Magic Random is tricky.
            // Let's assume it preserves the *current* negative prompt state.
          }
          setGeneratedStyle(styleText);
          setCopiedPrompt(false);
          onPromptGenerated(promptText);
        } else if (typeof result === 'string') {
          setPrompt(result);
          setLastGeneratedPrompt(result);
          if (!keepNegative) {
            setNegativePrompt('');
            onNegativePromptChanged?.('');
          }
          setGeneratedStyle('');
          setCopiedPrompt(false);
          onPromptGenerated(result);
        }
      } catch (err) {
        handleAIError(err);
        console.error('Failed to generate random prompt:', err);
        const fallback = generateRandomPrompt(filters, computedGreylist);
        setPrompt(fallback);
        setLastGeneratedPrompt(fallback);
        if (!keepNegative) {
          setNegativePrompt('');
          onNegativePromptChanged?.('');
        }
        setGeneratedStyle('');
        onPromptGenerated(fallback);
      } finally {
        setRegenerating(false);
      }
    };

    run();
  }

  return (
    <div className="space-y-6">
      {magicInputSlot ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="h-full">
            {magicInputSlot}
          </div>
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl p-6 text-center h-full flex flex-col justify-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 rounded-2xl mb-4 mx-auto">
              <Shuffle size={24} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Surprise Me</h3>
            <p className="text-sm text-slate-400 mb-5">Generate a random prompt based on your preferences</p>

            <div className="flex flex-wrap justify-center gap-3 mb-5">
              {([
                { key: 'dreamy', label: 'Keep it dreamy' },
                { key: 'characters', label: 'Include characters' },
                { key: 'cinematic', label: 'Cinematic style' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${filters[key]
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                >
                  {filters[key] ? '* ' : ''}{label}
                </button>
              ))}
            </div>

            <div className="flex flex-col mb-6 items-center w-full px-4">
              <div className="flex w-full max-w-sm items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Chaos Slider</span>
                <span className={`text-xs font-bold capitalize ${creativityLevel === 'focused' ? 'text-emerald-400' : creativityLevel === 'wild' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {creativityLevel}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="1"
                value={creativityLevel === 'focused' ? 0 : creativityLevel === 'wild' ? 2 : 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCreativityLevel(val === 0 ? 'focused' : val === 2 ? 'wild' : 'balanced');
                }}
                className={`w-full max-w-sm h-2 rounded-lg appearance-none cursor-pointer transition-colors ${creativityLevel === 'focused' ? 'bg-emerald-500/20 accent-emerald-500' : creativityLevel === 'wild' ? 'bg-rose-500/20 accent-rose-500' : 'bg-amber-500/20 accent-amber-500'}`}
              />
              <div className="flex w-full max-w-sm justify-between mt-2 text-[10px] text-slate-500 font-medium px-1">
                <span>Focused</span>
                <span>Balanced</span>
                <span>Wild</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 mt-auto">
              <div className="flex flex-col items-center gap-2">
                {autoDiversityEnabled && (
                  <div className="flex items-center justify-center gap-1.5 mb-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] text-amber-400 font-medium w-fit">
                    <Sparkles size={10} /> Auto-Diversity ON
                  </div>
                )}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDiversity(!showDiversity)}
                    className={`p-3 rounded-xl transition-all border flex items-center justify-center ${showDiversity ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                    title="View Diversity Insights"
                  >
                    <BarChart2 size={16} />
                  </button>

                  <button
                    onClick={handleGenerate}
                    disabled={saving || regenerating || showClearModal}
                    className="px-6 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-all border border-slate-700 text-sm"
                  >
                    Standard Random
                  </button>

                  <button
                    onClick={handleMagicRandom}
                    disabled={saving || regenerating || showClearModal}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2"
                  >
                    {regenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {regenerating ? 'Generating...' : 'Magic Random (AI)'}
                  </button>
                </div>
                {activeModelPricing && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <Coins size={12} className="text-amber-400" />
                    <span className="text-[10px] text-slate-400 font-medium">Est. Cost</span>
                    <span className="text-[10px] text-amber-300 font-mono">
                      {estimateLLMCost(activeModelPricing.prompt, activeModelPricing.completion, 50, maxWords)}
                    </span>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-500 italic">
                Auto-fill is now managed globally above
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 rounded-2xl mb-4">
            <Shuffle size={24} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Surprise Me</h3>
          <p className="text-sm text-slate-400 mb-5">Generate a random prompt based on your preferences</p>

          <div className="flex flex-wrap justify-center gap-3 mb-5">
            {([
              { key: 'dreamy', label: 'Keep it dreamy' },
              { key: 'characters', label: 'Include characters' },
              { key: 'cinematic', label: 'Cinematic style' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${filters[key]
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
              >
                {filters[key] ? '* ' : ''}{label}
              </button>
            ))}
          </div>

          <div className="flex flex-col mb-6 items-center w-full px-4">
            <div className="flex w-full max-w-sm items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Chaos Slider</span>
              <span className={`text-xs font-bold capitalize ${creativityLevel === 'focused' ? 'text-emerald-400' : creativityLevel === 'wild' ? 'text-rose-400' : 'text-amber-400'}`}>
                {creativityLevel}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={creativityLevel === 'focused' ? 0 : creativityLevel === 'wild' ? 2 : 1}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setCreativityLevel(val === 0 ? 'focused' : val === 2 ? 'wild' : 'balanced');
              }}
              className={`w-full max-w-sm h-2 rounded-lg appearance-none cursor-pointer transition-colors ${creativityLevel === 'focused' ? 'bg-emerald-500/20 accent-emerald-500' : creativityLevel === 'wild' ? 'bg-rose-500/20 accent-rose-500' : 'bg-amber-500/20 accent-amber-500'}`}
            />
            <div className="flex w-full max-w-sm justify-between mt-2 text-[10px] text-slate-500 font-medium px-1">
              <span>Focused</span>
              <span>Balanced</span>
              <span>Wild</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-auto">
            <div className="flex flex-col items-center gap-2">
              {autoDiversityEnabled && (
                <div className="flex items-center justify-center gap-1.5 mb-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] text-amber-400 font-medium w-fit">
                  <Sparkles size={10} /> Auto-Diversity ON
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDiversity(!showDiversity)}
                  className={`p-3 rounded-xl transition-all border flex items-center justify-center ${showDiversity ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                  title="View Diversity Insights"
                >
                  <BarChart2 size={16} />
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={saving || regenerating || showClearModal}
                  className="px-6 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-all border border-slate-700 text-sm"
                >
                  Standard Random
                </button>

                <button
                  onClick={handleMagicRandom}
                  disabled={saving || regenerating || showClearModal}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2"
                >
                  {regenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {regenerating ? 'Generating...' : 'Magic Random (AI)'}
                </button>
              </div>
              {activeModelPricing && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <Coins size={12} className="text-amber-400" />
                  <span className="text-[10px] text-slate-400 font-medium">Est. Cost</span>
                  <span className="text-[10px] text-amber-300 font-mono">
                    {estimateLLMCost(activeModelPricing.prompt, activeModelPricing.completion, 50, maxWords)}
                  </span>
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-500 italic">
              Auto-fill is now managed globally above
            </span>
          </div>
        </div>
      )}

      {showDiversity && (
        <div className="animate-in slide-in-from-top-4 fade-in duration-300">
          <DiversityInsights 
            context={diversityContext} 
            autoDiversityEnabled={autoDiversityEnabled}
            onToggleAutoDiversity={setAutoDiversityEnabled}
            onAddGreylist={(kw) => {
              if (!greylist.includes(kw)) {
                toast.success(`Keyword '${kw}' is now effectively greylisted via Auto-Diversity.`, {
                  description: "You can permanently add it to global greylist in Settings."
                });
              }
            }}
            onSuggestTheme={(tm) => {
              setPrompt(prev => prev ? `${prev}, ${tm}` : tm);
              toast.success(`Added '${tm}' to prompt.`);
            }}
          />
        </div>
      )}

      {prompt && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex flex-col gap-3 mb-4">
              {generatedStyle && (
                <div className="flex items-center gap-2 mb-1 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg w-fit">
                  <Palette size={12} className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">Style: {generatedStyle}</span>
                </div>
              )}
              {activeModel && (
                <span className="text-xs font-medium text-slate-400">Generated with <span className="text-amber-400">{activeModel}</span></span>
              )}
              {activeModelPricing && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-700/50 w-fit ml-auto">
                  <Coins size={12} className="text-amber-400" />
                  <span className="text-[10px] text-slate-400 font-medium">Est. Cost</span>
                  <span className="text-[10px] text-amber-300 font-mono">
                    {estimateLLMCost(activeModelPricing.prompt, activeModelPricing.completion, prompt.split(' ').length, maxWords)}
                  </span>
                </div>
              )}
            </div>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); onPromptGenerated(e.target.value); }}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 leading-relaxed resize-none h-40 pr-10"
                placeholder="Positive prompt..."
              />
              {prompt && (
                <button
                  onClick={() => { setPrompt(''); onPromptGenerated(''); }}
                  className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Clear prompt"
                >
                  <Eraser size={14} />
                </button>
              )}
            </div>

            {supportsNegativePrompt(topSuggestion?.model.id || '') && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] text-red-300 font-bold uppercase">Negative Prompt</p>
                  <span className={`text-[10px] font-mono ${negativePrompt.length > 550 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                    {negativePrompt.length}/600
                  </span>
                </div>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 600);
                    setNegativePrompt(val);
                    onNegativePromptChanged?.(val);
                  }}
                  maxLength={600}
                  className="w-full bg-transparent border-0 p-0 text-xs text-red-200/80 leading-relaxed focus:outline-none focus:ring-0 placeholder-red-900/50 resize-none h-20"
                  placeholder="blurred, low quality, watermark, distorted..."
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition-colors"
            >
              {copiedPrompt ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedPrompt ? 'Copied' : 'Copy Prompt'}
            </button>
            {supportsNegativePrompt(topSuggestion?.model.id || '') && negativePrompt && (
              <button
                onClick={handleCopyNegative}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-red-300 text-xs rounded-lg hover:bg-slate-700 hover:text-red-200 transition-colors"
              >
                {copiedNeg ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedNeg ? 'Copied' : 'Copy Negative'}
              </button>
            )}
            {onSwitchToManual && (
              <button
                onClick={() => onSwitchToManual(prompt, negativePrompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-teal-400 text-xs rounded-lg hover:bg-slate-700 hover:text-teal-300 transition-colors border border-slate-700"
              >
                <PenTool size={11} />
                Edit in Manual
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 ml-auto"
            >
              <Save size={12} />
              Save to Library
            </button>
            <button
              onClick={() => onSwitchToGuided(prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ArrowRight size={12} />
              Guided Mode
            </button>
          </div>

          {topSuggestion && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass size={13} className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Suggested Model</span>
                  {aiAdvice && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300">AI Verified</span>
                  )}
                </div>
                {!aiAdvice && (
                  <button
                    onClick={handleGetAIAdvice}
                    disabled={loadingAiAdvice}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-lg hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                  >
                    {loadingAiAdvice ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {loadingAiAdvice ? 'Analyzing...' : 'Get AI Advice'}
                  </button>
                )}
              </div>

              {aiAdvice ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{aiAdvice.name}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGetAIAdvice}
                        disabled={loadingAiAdvice}
                        title="Rerun AI Advice"
                        className="p-1 text-slate-500 hover:text-teal-400 transition-colors disabled:opacity-50"
                      >
                        <RefreshCcw size={10} className={loadingAiAdvice ? 'animate-spin' : ''} />
                      </button>
                      <button onClick={() => setAiAdvice(null)} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors" title="Switch back to local heuristics">↩ Local</button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700/50">
                    <span className="text-amber-400/80 mr-1">✦</span>{aiAdvice.reasoning}
                  </p>
                  {aiAdvice.tips.length > 0 && (
                    <ul className="space-y-1">
                      {aiAdvice.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <span className="text-amber-500 mt-0.5 shrink-0">💡</span>{tip}
                        </li>
                      ))}
                    </ul>
                  )}
                  {aiAdvice.preset && (
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-400 bg-teal-950/30 border border-teal-900/50 w-fit px-2 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      Suggested Preset: <span className="font-semibold">{aiAdvice.preset}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{topSuggestion.model.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {topSuggestion.reasons[0]}
                      {!supportsNegativePrompt(topSuggestion.model.id) && (
                        <span className="block text-red-400 mt-0.5">Note: Negative prompts disabled for this model.</span>
                      )}
                      {topSuggestion.model.recommendedPreset && (
                        <span className="block text-teal-400 mt-0.5 font-medium">
                          Recommended Preset: {topSuggestion.model.recommendedPreset}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{topSuggestion.model.provider}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ChoiceModal
        isOpen={showClearModal}
        onClose={() => {
          setShowClearModal(false);
          setPendingAction(null);
        }}
        title="Prompt field is not empty"
        message="The prompt field contains text. How would you like to proceed?"
        choices={[
          {
            label: "Clear generate",
            onClick: () => {
              if (pendingAction) pendingAction(true); // true = keep negative
              setShowClearModal(false);
              setPendingAction(null);
            },
            variant: 'primary'
          },
          {
            label: "Clear All",
            onClick: () => {
              setNegativePrompt('');
              onNegativePromptChanged?.('');
              if (pendingAction) pendingAction(false); // false = don't keep negative (already cleared)
              setShowClearModal(false);
              setPendingAction(null);
            },
            variant: 'danger'
          }
        ]}
      />
    </div>
  );
}
