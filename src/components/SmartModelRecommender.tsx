import { useState, useEffect } from 'react';
import { Compass, Loader2, ChevronDown, ChevronUp, Trophy, Lightbulb, Eraser, ArrowUp, Search, Zap, ChevronRight, MessageSquare, Eye, Type, Sparkles } from 'lucide-react';
import { analyzePrompt, getTopCandidates, MODELS, type ModelInfo } from '../lib/models-data';
import { recommendModels } from '../lib/ai-service';
import { handleAIError } from '../lib/error-handler';
import ModelCompareView, { type CompareModel } from './ModelCompareView';
import { loadModelCompareSelection, saveModelCompareSelection } from '../lib/model-compare-storage';
import { useTranslation } from 'react-i18next';

const BUDGET_OPTIONS = [
    { value: 'low', label: 'Budget', desc: 'Cheap & fast' },
    { value: 'medium', label: 'Balanced', desc: 'Quality + value' },
    { value: 'high', label: 'Premium', desc: 'Best quality' },
];

const MEDAL_COLORS = [
    { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Best Match' },
    { bg: 'bg-slate-400/10', border: 'border-slate-400/25', text: 'text-slate-300', label: 'Runner Up' },
    { bg: 'bg-orange-700/10', border: 'border-orange-700/25', text: 'text-orange-400', label: '3rd Pick' },
    { bg: 'bg-slate-700/20', border: 'border-slate-600/30', text: 'text-slate-400', label: 'Option' },
    { bg: 'bg-slate-700/20', border: 'border-slate-600/30', text: 'text-slate-400', label: 'Option' },
];

interface SmartModelRecommenderProps {
    generatedPrompt?: string;
    onSelectModel?: (model: ModelInfo) => void;
    defaultExpanded?: boolean;
}

type HybridResult = {
    model: ModelInfo;
    score: number;
    reasons: string[];
    tips?: string[];
    recommendedPreset?: string;
    isAiRefined: boolean;
};

function RatingDots({ value, max = 5, color }: { value: number; max?: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < value ? color : 'bg-slate-700'}`}
                />
            ))}
        </div>
    );
}

export default function SmartModelRecommender({ generatedPrompt, onSelectModel, defaultExpanded = true }: SmartModelRecommenderProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [prompt, setPrompt] = useState('');
    const [budget, setBudget] = useState<string | undefined>();
    const [loadingAi, setLoadingAi] = useState(false);

    const [results, setResults] = useState<HybridResult[] | null>(null);
    const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>(() => loadModelCompareSelection());

    const compareModels: CompareModel[] = MODELS.map((m) => {
        const capabilities = new Set<string>();
        if (m.modelType === 'Image') capabilities.add('image generation');
        if (m.modelType === 'Edit') capabilities.add('image edit');
        if (m.modelType === 'Video') capabilities.add('video generation');
        (m.bestFor || []).forEach((x) => capabilities.add(x));
        (m.styleTags || []).forEach((x) => capabilities.add(x));

        const avgStar = ((m.artRating || 0) + (m.promptingRating || 0) + (m.realismRating || 0) + (m.typographyRating || 0)) / 4;
        return {
            id: m.id,
            name: m.name,
            type: m.modelType || 'Image',
            starRating: avgStar || m.qualityRating || 0,
            costRating: m.costLevel || 1,
            descriptionNl: m.description,
            capabilities: Array.from(capabilities).slice(0, 8),
        };
    });

    function toggleCompare(modelId: string) {
        setSelectedCompareIds((prev) => {
            if (prev.includes(modelId)) return prev.filter((x) => x !== modelId);
            if (prev.length >= 4) return prev;
            return [...prev, modelId];
        });
    }

    // Auto-fill prompt if passed down
    useEffect(() => {
        if (generatedPrompt && !prompt) {
            setPrompt(generatedPrompt);
        }
    }, [generatedPrompt, prompt]); // Added prompt as dependency to satisfy lint

    useEffect(() => {
        saveModelCompareSelection(selectedCompareIds);
    }, [selectedCompareIds]);

    async function handleAnalyze() {
        if (!prompt.trim()) return;

        // Step 1: Local Analysis instantly
        const localMatches = analyzePrompt(prompt);
        const topLocal = localMatches.slice(0, 3).map(m => ({
            model: m.model,
            score: m.score,
            reasons: m.reasons,
            isAiRefined: false
        }));

        setResults(topLocal);
        setLoadingAi(true);

        try {
            const candidates = getTopCandidates(prompt, 5);
            const token = ''; // Local auth mock or session handled inside ai-service if needed

            // Step 2: Fire AI request in background
            const options: { candidates: Array<{ id: string; name: string; score: number }>; budget?: string } = { candidates };
            if (budget) options.budget = budget;
            const aiResponse = await recommendModels(prompt, options, token);

            // Step 3: Merge AI results
            if (aiResponse.recommendations && aiResponse.recommendations.length > 0) {
                const refinedResults: HybridResult[] = aiResponse.recommendations.map(rec => {
                    // Robust mapping: AI might return an id, try finding it in local MODELS.
                    // Fallback to local matching if AI hallucinated an ID.
                    const realModel = MODELS.find(m => m.id === rec.modelId)
                        || MODELS.find(m => m.name.toLowerCase() === rec.modelName.toLowerCase());

                    if (realModel) {
                        // Filter out Video models as requested
                        if (realModel.modelType === 'Video') return null;

                        return {
                            model: realModel,
                            score: rec.matchScore,
                            reasons: [rec.reasoning],
                            tips: rec.tips,
                            recommendedPreset: rec.recommendedPreset,
                            isAiRefined: true
                        };
                    }
                    return null;
                }).filter(Boolean) as HybridResult[];

                // Fill in any gaps with local top results if AI returned fewer than 3
                if (refinedResults.length < 3) {
                    for (const local of topLocal) {
                        if (!refinedResults.find(r => r.model.id === local.model.id)) {
                            refinedResults.push(local);
                        }
                        if (refinedResults.length >= 3) break;
                    }
                }

                setResults(refinedResults.slice(0, 5)); // Show up to 5
            }

        } catch (e) {
            handleAIError(e);
            // Fails silently for the user, retaining local results
        } finally {
            setLoadingAi(false);
        }
    }

    return (
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800/80 hover:from-slate-800/80 hover:to-slate-800/60 transition-all border-b border-slate-800/50"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
                        <Compass size={16} className="text-amber-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Smart Model Recommender</h3>
                        <p className="text-[11px] text-slate-500">Hybrid AI analysis for the best generator models</p>
                    </div>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {expanded && (
                <div className="p-5 space-y-5">
                    {/* Input Section */}
                    <div className="space-y-4">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your scene or paste your prompt here..."
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                        />

                        <div>
                            <p className="text-[11px] font-medium text-slate-400 mb-2">Budget preference (optional)</p>
                            <div className="flex flex-wrap gap-2">
                                {BUDGET_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setBudget(budget === opt.value ? undefined : opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${budget === opt.value
                                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/5'
                                            : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                                            }`}
                                    >
                                        <span className="font-medium">{opt.label}</span>
                                        <span className="text-slate-500 ml-1.5 hidden sm:inline">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/50">
                            <button
                                onClick={handleAnalyze}
                                disabled={loadingAi && !results ? true : !prompt.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/15"
                            >
                                {!results && loadingAi ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                Analyze Prompt
                            </button>

                            {prompt && (
                                <button
                                    onClick={() => { setPrompt(''); setResults(null); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                                    title="Clear Input"
                                >
                                    <Eraser size={14} />
                                    Clear
                                </button>
                            )}

                            {generatedPrompt && prompt !== generatedPrompt && (
                                <button
                                    onClick={() => setPrompt(generatedPrompt)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 text-amber-400 text-xs font-medium rounded-xl hover:bg-slate-800 hover:text-amber-300 transition-colors border border-amber-500/20"
                                    title="Use generated prompt"
                                >
                                    <ArrowUp size={14} />
                                    Paste Generator Prompt
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results Section */}
                    {results && (
                        <div className="space-y-3 pt-3">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    {loadingAi ? 'Finding Initial Matches...' : 'Recommendations'}
                                </h3>
                                {loadingAi && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-full animate-pulse border border-amber-500/20">
                                        <Loader2 size={10} className="animate-spin" />
                                        AI Refining matches...
                                    </div>
                                )}
                            </div>

                            {results.length > 0 ? (
                                <div className="space-y-3">
                                    {results.map((rec, i) => {
                                        const medal = MEDAL_COLORS[i] || MEDAL_COLORS[3]!;
                                        const isSelectable = !!onSelectModel;

                                        return (
                                            <div
                                                key={rec.model.id}
                                                onClick={() => isSelectable && onSelectModel(rec.model)}
                                                className={`relative bg-slate-900 border ${medal.border} rounded-2xl p-4 transition-all ${isSelectable ? 'cursor-pointer hover:border-amber-500/50 hover:bg-slate-800/50' : ''}`}
                                            >
                                                {/* Badge */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${medal.bg} border ${medal.border}`}>
                                                            <Trophy size={14} className={medal.text} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-bold text-white leading-none">{rec.model.name}</h4>
                                                                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md">
                                                                    {rec.model.provider}
                                                                </span>
                                                            </div>
                                                            <p className={`text-[10px] font-medium ${medal.text} mt-1`}>
                                                                {medal.label} • {rec.isAiRefined ? 'AI Verified' : 'Local Match'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                        <div className="text-right">
                                                            <div className={`text-lg font-black ${rec.isAiRefined ? 'text-amber-400' : 'text-slate-300'}`}>{rec.score}</div>
                                                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">score</div>
                                                        </div>
                                                        {isSelectable && <ChevronRight size={16} className="text-slate-600" />}
                                                    </div>
                                                </div>

                                                {/* Reasoning & Tags */}
                                                <div className="space-y-3">
                                                    {rec.isAiRefined ? (
                                                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/50">
                                                            <span className="text-amber-400/80 mr-1">✦</span>
                                                            {rec.reasons[0]}
                                                        </p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {rec.reasons.map((reason, j) => (
                                                                <span key={j} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
                                                                    <Zap size={8} className="text-amber-500" />
                                                                    {reason}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {rec.tips && rec.tips.length > 0 && (
                                                        <div className="space-y-1.5 pl-1">
                                                            {rec.tips.map((tip, j) => (
                                                                <div key={j} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                                                                    <Lightbulb size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                                                    {tip}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {rec.recommendedPreset && (
                                                        <div className="flex items-center gap-1.5 text-[11px] text-teal-400 bg-teal-950/30 border border-teal-900/50 w-fit px-2 py-1 rounded-md">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                                                            Suggested Preset: <span className="font-semibold">{rec.recommendedPreset}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleCompare(rec.model.id);
                                                            }}
                                                            title={selectedCompareIds.includes(rec.model.id) ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                                                            className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                                                                selectedCompareIds.includes(rec.model.id)
                                                                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {selectedCompareIds.includes(rec.model.id) ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Footer Ratings */}
                                                <div className="grid grid-cols-2 gap-x-5 gap-y-2 mt-4 pt-3 border-t border-slate-800/70 text-[10px] text-slate-400">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <Sparkles size={11} className="text-amber-500" />
                                                            <span className="font-medium">Art</span>
                                                        </div>
                                                        <RatingDots value={rec.model.artRating || rec.model.qualityRating} color="bg-amber-400" />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <MessageSquare size={11} className="text-blue-500" />
                                                            <span className="font-medium">Prompting</span>
                                                        </div>
                                                        <RatingDots value={rec.model.promptingRating || 3} color="bg-blue-400" />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <Eye size={11} className="text-teal-500" />
                                                            <span className="font-medium">Realism</span>
                                                        </div>
                                                        <RatingDots value={rec.model.realismRating || 3} color="bg-teal-400" />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <Type size={11} className="text-purple-500" />
                                                            <span className="font-medium">Typography</span>
                                                        </div>
                                                        <RatingDots value={rec.model.typographyRating || 1} color="bg-purple-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <ModelCompareView
                                        allModels={compareModels}
                                        selectedModelIds={selectedCompareIds}
                                        onChangeSelected={setSelectedCompareIds}
                                        title={t('modelCompare.recommendedTitle', 'Compare Recommended Models')}
                                    />
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 text-sm border border-slate-800 border-dashed rounded-xl">
                                    {loadingAi ? 'Analyzing options...' : 'No models found.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
