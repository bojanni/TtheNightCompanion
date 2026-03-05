import { useState, useEffect, useCallback } from 'react';
import { Copy, Save, Check, Plus, Minus, Info, Shuffle, Sparkles, Loader2, X, Wand2, Coins, RefreshCcw, Compass } from 'lucide-react';
import ChoiceModal from './ChoiceModal';
import { db } from '../lib/api';
import { toast } from 'sonner';
import { generateRandomPrompt } from '../lib/prompt-fragments';
import { generateRandomPromptAI, improvePromptWithNegative, optimizePromptForModel, generateNegativePrompt, listModels, ModelListItem, recommendModels, triggerKeywordExtraction } from '../lib/ai-service';
import { analyzePrompt, supportsNegativePrompt, getTopCandidates, ModelInfo } from '../lib/models-data';
import { recommendNCModel } from '../lib/nc-model-recommender';
import { handleAIError } from '../lib/error-handler';
import { getDefaultModelForProvider, ModelOption } from '../lib/provider-models';
import { listApiKeys } from '../lib/api-keys-service';
import { estimateLLMCost } from '../lib/pricing';
import { useTaskModels } from '../hooks/useTaskModels';
import type { Prompt } from '../lib/types';

interface ManualGeneratorProps {
    onSaved: () => void;
    maxWords: number;
    initialPrompts?: string[] | undefined;
    initialNegativePrompt?: string | undefined;
    resetKey?: number;
    selectedNightCafePreset?: string;
    onRequestSavePrompt?: (data: Partial<Prompt>) => void;
}

const MANUAL_STORAGE_KEY = 'nightcompanion_manual_generator';

export default function ManualGenerator({ onSaved, maxWords, initialPrompts, initialNegativePrompt = '', resetKey = 0, selectedNightCafePreset, onRequestSavePrompt }: ManualGeneratorProps) {
    const { generate: taskGenerateModel, improve: taskImproveModel } = useTaskModels();
    const [prompts, setPrompts] = useState<string[]>(() => {
        if (initialPrompts && initialPrompts.length > 0) return initialPrompts;
        const saved = localStorage.getItem(MANUAL_STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved).prompts || ['']; } catch { /* ignore */ }
        }
        return [''];
    });
    const [negativePrompt, setNegativePrompt] = useState<string>(() => {
        if (initialNegativePrompt) return initialNegativePrompt;
        const saved = localStorage.getItem(MANUAL_STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved).negativePrompt || ''; } catch { /* ignore */ }
        }
        return '';
    });
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedNeg, setCopiedNeg] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [unifying, setUnifying] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [suggestedModel, setSuggestedModel] = useState<ModelInfo | null>(null);
    const [, setActiveModel] = useState<string>('');
    const [activeModelPricing, setActiveModelPricing] = useState<{ prompt: string, completion: string } | undefined>(undefined);

    const [aiAdvice, setAiAdvice] = useState<{ id: string; name: string; reasoning: string; tips: string[]; preset?: string } | null>(() => {
        try {
            const saved = localStorage.getItem('nightcompanion_manual_ai_advice');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return null;
    });
    const [loadingAiAdvice, setLoadingAiAdvice] = useState(false);

    // Modal State
    const [showClearModal, setShowClearModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const confirmClear = (action: () => void, index: number) => {
        if (prompts[index] && prompts[index].trim().length > 0) {
            setPendingAction(() => action);
            setShowClearModal(true);
        } else {
            action();
        }
    };

    const fullPrompt = [
        ...prompts.filter(p => p.trim()),
        (supportsNegativePrompt(suggestedModel?.id || '') && negativePrompt.trim()) ? `\n### Negative Prompt: \n${negativePrompt.trim()} ` : ''
    ].filter(Boolean).join('\n');

    const positivePrompt = prompts.filter(p => p.trim()).join('\n');

    // Reset state when resetKey changes (from parent Clear All)
    useEffect(() => {
        if (resetKey > 0) {
            setPrompts(['']);
            setNegativePrompt('');
            setAiAdvice(null);
        }
    }, [resetKey]);

    // Analyze prompt for model advice
    useEffect(() => {
        if (!positivePrompt.trim()) {
            setSuggestedModel(null);
            return;
        }

        const timeout = setTimeout(() => {
            const results = analyzePrompt(positivePrompt);
            if (results && results.length > 0 && results[0]) {
                const bestMatch = results[0];
                setSuggestedModel(bestMatch.model);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeout);
    }, [positivePrompt]);

    // Persist AI advice
    useEffect(() => {
        if (aiAdvice) {
            localStorage.setItem('nightcompanion_manual_ai_advice', JSON.stringify(aiAdvice));
        } else {
            localStorage.removeItem('nightcompanion_manual_ai_advice');
        }
    }, [aiAdvice]);

    async function handleGetAIAdvice() {
        if (!positivePrompt.trim()) return;
        setLoadingAiAdvice(true);
        try {
            const candidates = getTopCandidates(positivePrompt, 5);
            const result = await recommendModels(positivePrompt, { candidates });
            const top = result.recommendations[0];
            if (top) {
                setAiAdvice({
                    id: top.modelId,
                    name: top.modelName,
                    reasoning: top.reasoning,
                    tips: top.tips || [],
                    ...(top.recommendedPreset ? { preset: top.recommendedPreset } : {}),
                });
            }
        } catch (e) {
            handleAIError(e);
        } finally {
            setLoadingAiAdvice(false);
        }
    }

    const fetchActiveModel = useCallback(async () => {
        try {
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
                    listModels('', 'openrouter')
                        .then((routerModels: ModelListItem[]) => {
                            try {
                                const existingCache = localStorage.getItem('cachedModels');
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const cache: any = existingCache ? JSON.parse(existingCache) : {};
                                cache.openrouter = routerModels;
                                localStorage.setItem('cachedModels', JSON.stringify(cache));

                                const found = routerModels.find((m) => m.id === model);
                                if (found?.pricing) {
                                    const newPricing = found.pricing;
                                    setActiveModelPricing(prev => prev?.prompt === newPricing.prompt && prev?.completion === newPricing.completion ? prev : newPricing);
                                }
                            } catch (e) {
                                console.error('Failed to update cache', e);
                            }
                        })
                        .catch((err: unknown) => console.error('Failed to fetch openrouter models', err));
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

    // Persist manual generator state
    useEffect(() => {
        localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify({ prompts, negativePrompt }));
    }, [prompts, negativePrompt]);

    function handleStandardGenerate(index: number) {
        const generated = generateRandomPrompt({ dreamy: false, characters: false, cinematic: false });
        const newPrompts = [...prompts];
        newPrompts[index] = generated;
        setPrompts(newPrompts);
    }

    async function handleAIGenerate(index: number) {
        confirmClear(() => executeAIGenerate(index), index);
    }

    async function executeAIGenerate(index: number) {
        setGenerating(true);
        try {
            const token = '';
            const result = await generateRandomPromptAI(token, undefined, maxWords, undefined, undefined, undefined, taskGenerateModel);
            if (result && typeof result === 'object' && 'prompt' in result) {
                const newPrompts = [...prompts];
                newPrompts[index] = result.prompt || '';
                setPrompts(newPrompts);
                if (result.negativePrompt) {
                    setNegativePrompt((prev: string) => {
                        const newTerms = result.negativePrompt
                            ? result.negativePrompt.split(',').map(t => t.trim()).filter(Boolean)
                            : [];

                        if (newTerms.length === 0) return prev;
                        if (!prev.trim()) return newTerms.join(', ');

                        const existingTerms = prev.split(',').map(t => t.trim().toLowerCase());
                        const uniqueNewTerms = newTerms.filter(term =>
                            !existingTerms.includes(term.toLowerCase())
                        );

                        if (uniqueNewTerms.length === 0) return prev;
                        return prev + ', ' + uniqueNewTerms.join(', ');
                    });
                }

                if (result.style) {
                    toast.success(`Generated: ${result.style}`);
                }
            } else if (typeof result === 'string') {
                const newPrompts = [...prompts];
                newPrompts[index] = result;
                setPrompts(newPrompts);
            }
        } catch (err) {
            handleAIError(err);
        } finally {
            setGenerating(false);
        }
    }

    async function handleUnify() {
        if (!fullPrompt.trim()) return;
        setUnifying(true);
        try {
            // First, get the session token
            const token = '';

            // Use just the positive prompts for unification context + negative for context if needed?
            // improvePromptWithNegative takes (token, prompt, negativePrompt).
            // We want to unify the *positive* parts into one, and potentially improve negative.
            // If we treat the current combined prompts as the input prompt.
            const combinedPositive = prompts.filter(p => p.trim()).join(' ');

            const result = await improvePromptWithNegative(combinedPositive, negativePrompt, token, undefined, taskImproveModel);

            if (result.improved) {
                setPrompts([result.improved]);
            }
            if (result.negativePrompt) {
                setNegativePrompt((prev: string) => {
                    // Same merging logic
                    const newTerms = result.negativePrompt
                        ? result.negativePrompt.split(',').map(t => t.trim()).filter(Boolean)
                        : [];

                    if (newTerms.length === 0) return prev;
                    if (!prev.trim()) return newTerms.join(', ');

                    const existingTerms = prev.split(',').map(t => t.trim().toLowerCase());
                    const uniqueNewTerms = newTerms.filter(term =>
                        !existingTerms.includes(term.toLowerCase())
                    );

                    if (uniqueNewTerms.length === 0) return prev;
                    return prev + ', ' + uniqueNewTerms.join(', ');
                });
            }
            toast.success('Prompts unified!');
        } catch (err) {
            handleAIError(err);
        } finally {
            setUnifying(false);
        }
    }

    async function handleOptimize() {
        if (!positivePrompt.trim()) return;
        setOptimizing(true);
        try {
            const token = '';
            const result = await optimizePromptForModel(
                positivePrompt,
                suggestedModel?.name || 'DALL-E 3',
                token,
                negativePrompt
            );

            if (result.optimizedPrompt) {
                setPrompts([result.optimizedPrompt]);
                // If DALL-E 3, clear negative prompt as it's merged or ignored
                // If model doesn't support negative prompt (DALL-E 3, GPT, etc.)
                if (!supportsNegativePrompt(suggestedModel?.id || '')) {
                    setNegativePrompt('');
                    toast.success(`Optimized for ${suggestedModel?.name} (Negative merged)`);
                } else if (result.negativePrompt) {
                    setNegativePrompt(result.negativePrompt);
                    toast.success(`Optimized for ${suggestedModel?.name}`);
                } else {
                    toast.success(`Optimized for ${suggestedModel?.name}`);
                }
            }
        } catch (err) {
            handleAIError(err);
        } finally {
            setOptimizing(false);
        }
    }

    async function handleGenerateNegative() {
        setGenerating(true);
        try {
            const token = '';
            const result = await generateNegativePrompt(token);
            if (result) {
                setNegativePrompt(result);
            }
        } catch (err) {
            handleAIError(err);
        } finally {
            setGenerating(false);
        }
    }

    function handleAddPrompt() {
        if (prompts.length < 3) {
            setPrompts([...prompts, '']);
        }
    }

    function handleRemovePrompt(index: number) {
        if (prompts.length > 1) {
            setPrompts(prompts.filter((_, i) => i !== index));
        }
    }

    function handleClearPrompt(index: number) {
        const newPrompts = [...prompts];
        newPrompts[index] = '';
        setPrompts(newPrompts);
    }

    function handlePromptChange(index: number, value: string) {
        const newPrompts = [...prompts];
        newPrompts[index] = value;
        setPrompts(newPrompts);
    }



    async function handleCopyPrompt() {
        if (!positivePrompt) return;
        await navigator.clipboard.writeText(positivePrompt);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
        toast.success('Prompt copied to clipboard');
    }

    async function handleCopyNegative() {
        if (!negativePrompt.trim()) return;
        await navigator.clipboard.writeText(negativePrompt.trim());
        setCopiedNeg(true);
        setTimeout(() => setCopiedNeg(false), 2000);
        toast.success('Negative prompt copied to clipboard');
    }

    async function handleSave() {
        if (!fullPrompt.trim()) return;
        setSaving(true);
        try {
            const journeySteps = [
                { step: 'Manual', label: '✏️ Manual' },
            ];
            if (selectedNightCafePreset) journeySteps.push({ step: 'NightCafe Preset', label: `⚙️ Preset: ${selectedNightCafePreset}` });

            if (onRequestSavePrompt) {
                onRequestSavePrompt({
                    title: (prompts[0] || 'Untitled').trim().slice(0, 160),
                    content: fullPrompt,
                    generation_journey: journeySteps,
                });
                setSaving(false);
                return;
            }

            // Check for duplicates
            const { data: existingPrompts } = await db
                .from('prompts')
                .select('id')
                .eq('content', fullPrompt)
                .limit(1);

            if (existingPrompts && existingPrompts.length > 0) {
                toast.error('This prompt is already in your library.');
                setSaving(false);
                return;
            }

            const topSuggestion = analyzePrompt(fullPrompt)[0];
            const suggestedModelIdToSave = topSuggestion ? topSuggestion.model.id : undefined;

            const { data: newPrompt, error } = await db.from('prompts').insert({
                title: (prompts[0] || 'Untitled').trim().slice(0, 160),
                content: fullPrompt,
                generation_journey: journeySteps,
                rating: 0,
                is_template: false,
                is_favorite: false,
                suggested_model: suggestedModelIdToSave
            }).select().single();
            
            if (newPrompt && !error) {
                triggerKeywordExtraction(newPrompt.id, newPrompt.content);
            }
            
            toast.success('Prompt saved to library');
            onSaved();
        } catch (e) {
            handleAIError(e);
        } finally {
            setSaving(false);
        }
    }



    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-base font-semibold text-white">Manual Builder</h3>
                        <p className="text-sm text-slate-400">Combine multiple prompts to create complex scenes</p>
                    </div>

                    {activeModelPricing && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-700/50 ml-auto mr-4">
                            <Coins size={12} className="text-amber-400" />
                            <span className="text-[10px] text-slate-400 font-medium">Est. Cost</span>
                            <span className="text-[10px] text-amber-300 font-mono">
                                {estimateLLMCost(activeModelPricing.prompt, activeModelPricing.completion, fullPrompt.split(' ').length, maxWords)}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleAddPrompt}
                        disabled={prompts.length >= 3}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg hover:bg-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus size={14} />
                        Add Prompt Section
                    </button>
                </div>



                <div className="space-y-3">
                    {prompts.map((prompt, index) => (
                        <div key={index} className="relative group">
                            <div className="absolute top-3 left-3 px-2 py-0.5 bg-slate-800/80 rounded text-[10px] text-slate-500 font-mono pointer-events-none">
                                {index + 1}
                            </div>
                            <textarea
                                value={prompt}
                                onChange={(e) => handlePromptChange(index, e.target.value)}
                                placeholder={`Enter prompt part ${index + 1}...`}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-10 pt-3 pb-10 text-sm text-white placeholder-slate-600 resize-none h-32 focus:outline-none focus:border-teal-500/40"
                            />

                            <div className="absolute top-3 right-3 flex items-center gap-1">
                                {prompt && (
                                    <button
                                        onClick={() => handleClearPrompt(index)}
                                        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Clear text"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                                {prompts.length > 1 && (
                                    <button
                                        onClick={() => handleRemovePrompt(index)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Remove section"
                                    >
                                        <Minus size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="absolute bottom-2 right-2 flex gap-1.5 transform scale-90 origin-bottom-right">
                                <button
                                    onClick={() => handleStandardGenerate(index)}
                                    disabled={generating || showClearModal}
                                    className="p-1.5 text-slate-400 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                                    title="Generate random fragment"
                                >
                                    <Shuffle size={14} />
                                </button>
                                <button
                                    onClick={() => handleAIGenerate(index)}
                                    disabled={generating || showClearModal}
                                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500/20 transition-all disabled:opacity-50"
                                    title="Generate with AI"
                                >
                                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    <span className="hidden sm:inline">Generate with AI</span>
                                </button>
                                {activeModelPricing && (
                                    <div className="flex flex-col justify-center items-start ml-2">
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                            <Coins size={12} className="text-amber-400" />
                                            <span className="text-[10px] text-slate-400 font-medium">Est.</span>
                                            <span className="text-[10px] text-amber-300 font-mono">
                                                {estimateLLMCost(activeModelPricing.prompt, activeModelPricing.completion, prompt.split(' ').length, maxWords)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-slate-700/50">
                    {!supportsNegativePrompt(suggestedModel?.id || '') ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="flex items-center gap-3 text-emerald-400 mb-3">
                                <Sparkles size={16} />
                                <p className="text-sm font-medium">Model Advice: {suggestedModel?.name} Recommended</p>
                            </div>
                            <p className="text-xs text-slate-400 mb-3">
                                This prompt style works best with {suggestedModel?.name}, which handles complex text and instructions well without needing a negative prompt.
                                {suggestedModel?.recommendedPreset && (
                                    <span className="block text-teal-400 mt-1 font-medium">
                                        Recommended Preset: {suggestedModel.recommendedPreset}
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={handleOptimize}
                                disabled={optimizing}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            >
                                {optimizing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                Optimize for {suggestedModel?.name}
                            </button>
                            {!aiAdvice ? (
                                <button
                                    onClick={handleGetAIAdvice}
                                    disabled={loadingAiAdvice}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-400 text-xs font-medium rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition-all disabled:opacity-50 mt-2"
                                >
                                    {loadingAiAdvice ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Upgrade to AI Advice
                                </button>
                            ) : (
                                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Compass size={13} className="text-amber-400" />
                                            <span className="text-xs font-semibold text-white">{aiAdvice.name}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300">AI Verified</span>
                                        </div>
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
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-red-300 uppercase tracking-wide">Negative Prompt</span>
                                    <span className={`text-[10px] font-mono ${negativePrompt.length > 550 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                        {negativePrompt.length}/600
                                    </span>
                                    <div className="group relative">
                                        <Info size={12} className="text-slate-500 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            What you want to avoid (e.g. blurry, deformed, text). Max 600 characters.
                                        </div>
                                    </div>
                                </div>
                                {negativePrompt && (
                                    <button
                                        onClick={() => setNegativePrompt('')}
                                        className="p-1 text-slate-500 hover:text-red-300 transition-colors"
                                        title="Clear negative prompt"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <textarea
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value.slice(0, 600))}
                                    maxLength={600}
                                    placeholder="blurred, low quality, watermark, distorted..."
                                    className="w-full bg-slate-900/30 border border-red-900/30 focus:border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-50 placeholder-red-900/50 resize-none h-28 focus:outline-none pr-20"
                                />
                                <div className="absolute bottom-2 right-2 flex gap-1.5">
                                    <button
                                        onClick={handleGenerateNegative}
                                        disabled={generating}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-medium rounded border border-red-500/20 transition-colors disabled:opacity-50"
                                        title="Generate negative prompt with AI"
                                    >
                                        {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        <span className="hidden sm:inline">Generate</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const embeddings = 'EasyNegative, BadHandV4';
                                            if (!negativePrompt.includes('EasyNegative')) {
                                                setNegativePrompt(prev => prev ? `${prev}, ${embeddings}` : embeddings);
                                                toast.success('Added EasyNegative & BadHandV4 embeddings');
                                            } else {
                                                toast('Embeddings already present');
                                            }
                                        }}
                                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-medium rounded border border-red-500/20 transition-colors"
                                        title="Add standard negative embeddings (EasyNegative, BadHandV4)"
                                    >
                                        + Embeddings
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={handleCopyPrompt}
                    disabled={!positivePrompt.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 border border-slate-700"
                >
                    {copiedPrompt ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    {copiedPrompt ? 'Copied' : 'Copy Prompt'}
                </button>
                {supportsNegativePrompt(suggestedModel?.id || '') && negativePrompt.trim() && (
                    <button
                        onClick={handleCopyNegative}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-red-300 text-sm font-medium rounded-xl hover:bg-slate-700 hover:text-red-200 transition-all border border-slate-700"
                    >
                        {copiedNeg ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        {copiedNeg ? 'Copied' : 'Copy Negative'}
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={!fullPrompt.trim() || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save to Library'}
                </button>
            </div>

            {fullPrompt.trim() && (
                <div className="relative bg-slate-900/50 border border-slate-800 rounded-xl p-4 group">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-2">
                        <div className="flex items-center gap-3">
                            <p className="text-xs text-slate-500 font-mono">PREVIEW</p>
                            {(() => {
                                const tokenCount = Math.round(fullPrompt.length / 4);
                                let color = 'text-emerald-400';
                                let status = 'Optimal';

                                if (tokenCount > 150) {
                                    color = 'text-red-400';
                                    status = 'Excessive (Dilution Risk)';
                                } else if (tokenCount > 75) {
                                    color = 'text-amber-400';
                                    status = 'Heavy';
                                }

                                return (
                                    <div className="flex items-center gap-2" title={`1 token ≈ 4 characters. Status: ${status}`}>
                                        <div className={`text-[10px] font-mono ${color} bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800`}>
                                            {tokenCount} tokens
                                        </div>
                                        {tokenCount > 75 && (
                                            <span className={`text-[10px] ${color}`}>
                                                {tokenCount > 150 ? '⚠️ Dilution Risk > 150' : '⚠️ Best < 75'}
                                            </span>
                                        )}
                                        {fullPrompt.length > 1500 && (
                                            <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1 rounded" title="Technical Limit: 1500 chars">
                                                ⛔ &gt; 1500 chars
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="group/tip relative flex items-center">
                                <Info size={12} className="text-slate-600 hover:text-slate-400 cursor-help transition-colors" />
                                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-10">
                                    <p className="font-semibold text-teal-400 mb-1">Optimization Tip</p>
                                    <p className="mb-2">For best results, keep the core prompt under 75 tokens.</p>
                                    <p className="text-slate-400">Use <strong>Embeddings</strong> (Textual Inversions) like <em>EasyNegative</em> or <em>BadHandV4</em> to replace long negative lists with a single token.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleUnify}
                                disabled={unifying}
                                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                                title="Merge all sections into one cohesive prompt using AI"
                            >
                                {unifying ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                {unifying ? 'Unifying...' : 'Unify to Single Prompt'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-light">
                            {positivePrompt || <span className="text-slate-600 italic">No positive prompt...</span>}
                        </div>

                        {supportsNegativePrompt(suggestedModel?.id || '') && negativePrompt.trim() && (
                            <div className="pt-3 border-t border-slate-700/50">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-red-400 font-mono uppercase">Negative</p>
                                    <div className="text-[10px] text-slate-600 font-mono">
                                        {Math.round(negativePrompt.length / 4)} tokens
                                    </div>
                                </div>
                                <p className="text-sm text-red-300/80 leading-relaxed font-light">
                                    {negativePrompt}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <ChoiceModal
                isOpen={showClearModal}
                onClose={() => {
                    setShowClearModal(false);
                    setPendingAction(null);
                }}
                title="Prompt section is not empty"
                message="This prompt section contains text. How would you like to proceed?"
                choices={[
                    {
                        label: "Clear generate",
                        onClick: () => {
                            if (pendingAction) pendingAction();
                        },
                        variant: 'primary'
                    },
                    {
                        label: "Clear All",
                        onClick: () => {
                            setNegativePrompt('');
                            if (pendingAction) pendingAction();
                        },
                        variant: 'danger'
                    }
                ]}
            />
        </div>
    );
}
