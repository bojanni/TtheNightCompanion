import { useState } from 'react';
import {
  Compass, Loader2, ChevronDown, ChevronUp,
  Trophy, Lightbulb, Eraser, ArrowUp,
} from 'lucide-react';

import { recommendModels } from '../lib/ai-service';
import type { ModelRecommendation } from '../lib/ai-service';
import { db } from '../lib/api';
import { MODELS } from '../lib/models-data';
import { handleAIError } from '../lib/error-handler';
import ModelCompareView, { type CompareModel } from './ModelCompareView';
import { loadModelCompareSelection, saveModelCompareSelection } from '../lib/model-compare-storage';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

const BUDGET_OPTIONS = [
  { value: 'low', label: 'Budget', desc: 'Cheap & fast' },
  { value: 'medium', label: 'Balanced', desc: 'Quality + value' },
  { value: 'high', label: 'Premium', desc: 'Best quality' },
];

const MEDAL_COLORS = [
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Best Match' },
  { bg: 'bg-slate-400/10', border: 'border-slate-400/25', text: 'text-slate-300', label: 'Runner Up' },
  { bg: 'bg-orange-700/10', border: 'border-orange-700/25', text: 'text-orange-400', label: '3rd Pick' },
];

interface ModelRecommenderProps {
  generatedPrompt?: string;
}

export default function ModelRecommender({ generatedPrompt }: ModelRecommenderProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [budget, setBudget] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ModelRecommendation[] | null>(null);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>(() => loadModelCompareSelection());

  useEffect(() => {
    saveModelCompareSelection(selectedCompareIds);
  }, [selectedCompareIds]);

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
      if (prev.includes(modelId)) {
        return prev.filter((x) => x !== modelId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, modelId];
    });
  }

  async function handleRecommend() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      // const { data } = await db.auth.getSession();
      const token = '';
      const result = await recommendModels(prompt, { ...(budget ? { budget } : {}) }, token);

      const augmentedResults: ModelRecommendation[] = (result.recommendations ?? []).map(rec => {
        const modelInfo = MODELS.find(m => m.id === rec.modelId || m.name === rec.modelName);
        return {
          ...rec,
          recommendedPreset: modelInfo?.recommendedPreset || undefined
        };
      });

      setResults(augmentedResults);
    } catch (e) {
      handleAIError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800/80 hover:from-slate-800/80 hover:to-slate-800/60 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
            <Compass size={16} className="text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Model Recommender</h3>
            <p className="text-[11px] text-slate-500">AI picks the best NightCafe model for your prompt</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="p-5 bg-slate-900/50 space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste your image prompt here and AI will analyze which NightCafe model would produce the best results..."
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-amber-500/40"
          />

          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-2">Budget preference (optional)</p>
            <div className="flex gap-2">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBudget(budget === opt.value ? undefined : opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${budget === opt.value
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-slate-500 ml-1.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRecommend}
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/15"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Compass size={14} />}
              Get Recommendations
            </button>

            {prompt && (
              <button
                onClick={() => setPrompt('')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                title="Clear Input"
              >
                <Eraser size={14} />
                Clear
              </button>
            )}

            {generatedPrompt && (
              <button
                onClick={() => setPrompt(generatedPrompt)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-amber-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-amber-300 transition-colors border border-slate-700"
                title="Use generated prompt"
              >
                <ArrowUp size={14} />
                Paste Generated
              </button>
            )}
          </div>


          {results && results.length > 0 && (
            <div className="space-y-3">
              {results.map((rec, i) => {
                const medal = MEDAL_COLORS[i] || MEDAL_COLORS[2]!;
                return (
                  <div
                    key={rec.modelId}
                    className={`${medal.bg} border ${medal.border} rounded-xl p-4 transition-all`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${medal.bg} border ${medal.border}`}>
                          <Trophy size={13} className={medal.text} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{rec.modelName}</h4>
                          <p className={`text-[10px] font-medium ${medal.text}`}>{medal.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const widthClass = rec.matchScore >= 90
                            ? 'w-full'
                            : rec.matchScore >= 75
                              ? 'w-4/5'
                              : rec.matchScore >= 60
                                ? 'w-3/5'
                                : rec.matchScore >= 40
                                  ? 'w-2/5'
                                  : 'w-1/5';

                          return (
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all ${widthClass}`} />
                        </div>
                          );
                        })()}
                        <span className="text-xs font-medium text-slate-300">{rec.matchScore}%</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-3">{rec.reasoning}</p>

                    {rec.tips && rec.tips.length > 0 && (
                      <div className="space-y-1">
                        {rec.tips.map((tip, j) => (
                          <div key={j} className="flex items-start gap-2 text-[11px] text-slate-400">
                            <Lightbulb size={10} className="text-amber-400/70 mt-0.5 shrink-0" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    )}
                    {rec.recommendedPreset && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <span className="text-xs font-medium text-teal-400">Recommended NightCafe Preset: {rec.recommendedPreset}</span>
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => toggleCompare(rec.modelId)}
                        title={selectedCompareIds.includes(rec.modelId) ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                          selectedCompareIds.includes(rec.modelId)
                            ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {selectedCompareIds.includes(rec.modelId) ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                      </button>
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
          )}

          {results && results.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No recommendations available.</p>
          )}
        </div>
      )}
    </div>
  );
}
