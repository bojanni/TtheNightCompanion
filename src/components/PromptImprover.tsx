import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, ChevronRight, Lightbulb, Wand2 } from 'lucide-react';
import { improvePromptDetailed, DetailedImprovement, triggerKeywordExtraction } from '../lib/ai-service';
import { handleAIError } from '../lib/error-handler';
import { toast } from 'sonner';
import { db } from '../lib/api';

interface PromptImproverProps {
  prompt: string;
  onApply?: (improvedPrompt: string) => void;
}

export function PromptImprover({ prompt, onApply }: PromptImproverProps) {
  const [loading, setLoading] = useState(false);
  const [improvement, setImprovement] = useState<DetailedImprovement | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedAlternate, setExpandedAlternate] = useState<number | null>(null);

  const handleImprove = async () => {
    setLoading(true);
    setImprovement(null);

    try {
      // const { data: { session } } = await db.auth.getSession();
      // if (!session) {
      //   toast.error('Please sign in to use AI improvements');
      //   return;
      // }

      // Check for feature specific preference
      let apiPrefs = undefined;
      try {
        const savedPrefs = localStorage.getItem('promptImproverPrefs');
        if (savedPrefs) {
          apiPrefs = JSON.parse(savedPrefs);
        }
      } catch (e) {
        console.error('Failed to load prompt improver prefs', e);
      }

      const token = '';
      const result = await improvePromptDetailed(prompt, token, apiPrefs);
      setImprovement(result);
    } catch (err) {
      handleAIError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleApply = (text: string) => {
    if (onApply) {
      onApply(text);
    }
  };

  const handleSave = async (text: string) => {
    try {
      // Local DB insert
      const { data: newPrompt, error } = await db.from('prompts').insert({
        title: 'Improved: ' + (text.split(',')[0] || 'Untitled').slice(0, 30),
        content: text,
        notes: 'Created via AI Prompt Improver',
        rating: 0,
        is_template: false,
        is_favorite: false,
      }).select().single();
      
      if (newPrompt && !error) {
        triggerKeywordExtraction(newPrompt.id, newPrompt.content);
      }
      
      // Show success (simple alert/console for now if toast not available in this context, but better to use toast if possible)
      // Assuming toast is available or we can just change button state briefly
      const btn = document.getElementById('save-btn-' + text.length);
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Saved!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
      }
    } catch (e) {
      console.error('Failed to save prompt:', e);
    }
  };

  return (
    <div className="space-y-4">
      {!improvement && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            AI Prompt Improvement
          </h3>
          <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
            Let AI analyze your prompt and suggest improvements with detailed reasoning and alternate creative directions.
          </p>
          <button
            onClick={handleImprove}
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Improve with AI
              </>
            )}
          </button>
        </div>
      )}


      {improvement && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-orange-50 to-pink-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Improved Version
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(improvement.improved, -1)}
                  className="p-1.5 rounded-lg bg-white hover:bg-orange-100 text-orange-700 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedIndex === -1 ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                {onApply && (
                  <button
                    onClick={() => handleApply(improvement.improved)}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors"
                  >
                    Apply
                  </button>
                )}
                <button
                  id={'save-btn-' + improvement.improved.length}
                  onClick={() => handleSave(improvement.improved)}
                  className="px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium transition-colors border border-orange-200"
                >
                  Save
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {improvement.improved}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              What Changed & Why
            </h4>
            <div className="space-y-2">
              {improvement.reasoning.map((reason, index) => (
                <div key={index} className="flex gap-2">
                  <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{reason}</p>
                </div>
              ))}
            </div>
            {improvement.changesSummary && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-xs font-medium text-blue-800 mb-1">Summary:</p>
                <p className="text-sm text-slate-700">{improvement.changesSummary}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-600" />
              Alternate Creative Directions
            </h4>
            <div className="space-y-3">
              {improvement.alternateVersions.map((alternate, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-colors"
                >
                  <button
                    onClick={() => setExpandedAlternate(expandedAlternate === index ? null : index)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-slate-900 mb-1">
                          {alternate.variation}
                        </h5>
                        <p className="text-xs text-slate-600">{alternate.description}</p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-slate-500 transition-transform ${expandedAlternate === index ? 'rotate-90' : ''
                          }`}
                      />
                    </div>
                  </button>

                  {expandedAlternate === index && (
                    <div className="px-4 py-3 bg-white border-t border-slate-200">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm text-slate-700 leading-relaxed flex-1 whitespace-pre-wrap">
                          {alternate.prompt}
                        </p>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleCopy(alternate.prompt, index)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {onApply && (
                            <button
                              onClick={() => handleApply(alternate.prompt)}
                              className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setImprovement(null);
              }}
              className="text-sm text-slate-600 hover:text-slate-900 underline transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
