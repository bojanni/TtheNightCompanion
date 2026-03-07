import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Brain, MessageSquare, AlertTriangle,
  Loader2, Copy, Check, ArrowRight, ChevronDown, ChevronUp, Eraser, ArrowUp, Save, RefreshCcw,
} from 'lucide-react';

import { toast } from 'sonner';
import { diffWords } from '../lib/diff-utils';
import { handleAIError } from '../lib/error-handler';
import { improvePrompt, improvePromptWithNegative, analyzeStyle, generateFromDescription, diagnosePrompt, optimizePromptForModel, triggerKeywordExtraction, taskModelToPreferences } from '../lib/ai-service';
import { analyzePrompt, supportsNegativePrompt } from '../lib/models-data';
import { recommendNCModel } from '../lib/nc-model-recommender';
import type { StyleAnalysis, Diagnosis, GeneratePreferences } from '../lib/ai-service';
import { db } from '../lib/api';
import { listApiKeys } from '../lib/api-keys-service';
import { getDefaultModelForProvider } from '../lib/provider-models';
import { saveStyleProfile } from '../lib/style-analysis';
import { useTaskModels } from '../hooks/useTaskModels';
import type { Prompt } from '../lib/types';

interface AIToolsProps {
  onPromptGenerated?: (prompt: string) => void;
  onNegativePromptGenerated?: (neg: string) => void;
  generatedPrompt?: string;
  generatedNegativePrompt?: string;
  maxWords: number;
  onSaved?: () => void;
  allowedTabs?: Tab[];
  defaultTab?: Tab;
  showHeader?: boolean;
  initialExpanded?: boolean;
  availableModelTips?: string[] | undefined;
  onRequestSavePrompt?: (data: Partial<Prompt>) => void;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  recommendedPreset?: string;
}

export interface AIToolsRef {
  hasContent: () => boolean;
  clearContent: () => void;
  setInputContent: (content: string) => void;
  setNegativeInputContent: (content: string) => void;
  clearImproveInput: () => void;
}

type Tab = 'improve' | 'analyze' | 'generate' | 'diagnose';

const TABS: { id: Tab; labelKey: string; icon: typeof Sparkles; descKey: string }[] = [
  { id: 'improve', labelKey: 'aiTools.tabs.improve', icon: Sparkles, descKey: 'aiTools.tabs.improveDesc' },
  { id: 'generate', labelKey: 'aiTools.tabs.generate', icon: MessageSquare, descKey: 'aiTools.tabs.generateDesc' },
  { id: 'analyze', labelKey: 'aiTools.tabs.analyze', icon: Brain, descKey: 'aiTools.tabs.analyzeDesc' },
  { id: 'diagnose', labelKey: 'aiTools.tabs.diagnose', icon: AlertTriangle, descKey: 'aiTools.tabs.diagnoseDesc' },
];

const AITOOLS_STORAGE_KEY = 'nightcompanion_aitools_state';

function loadAIToolsState<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(AITOOLS_STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      return parsed[key] !== undefined ? parsed[key] : fallback;
    }
  } catch {
    // ignore
  }
  return fallback;
}

const AITools = forwardRef<AIToolsRef, AIToolsProps>(({ onRequestSavePrompt, onPromptGenerated, onNegativePromptGenerated, generatedPrompt, generatedNegativePrompt, maxWords, onSaved, allowedTabs, defaultTab = 'improve', showHeader = true, initialExpanded = false, availableModelTips }, ref) => {
  const { t } = useTranslation();
  const { improve: taskImproveModel, generate: taskGenerateModel } = useTaskModels();
  const [tab, setTab] = useState<Tab>(() => {
    if (allowedTabs && allowedTabs.length > 0 && !allowedTabs.includes(defaultTab)) {
      return allowedTabs[0]!;
    }
    return defaultTab;
  });

  const [expanded, setExpanded] = useState(() => {
    if (initialExpanded) return true;
    return loadAIToolsState('expanded', true);
  });

  const [loading, setLoading] = useState(false);

  const [improveInput, setImproveInput] = useState(() => loadAIToolsState('improveInput', ''));
  const [improveResult, setImproveResult] = useState(() => loadAIToolsState('improveResult', ''));
  const [negativeInput, setNegativeInput] = useState(() => loadAIToolsState('negativeInput', ''));
  const [negativeResult, setNegativeResult] = useState(() => loadAIToolsState('negativeResult', ''));

  const [generateInput, setGenerateInput] = useState(() => loadAIToolsState('generateInput', ''));
  const [generateResult, setGenerateResult] = useState(() => loadAIToolsState('generateResult', ''));
  const [generateNegativeResult, setGenerateNegativeResult] = useState(() => loadAIToolsState('generateNegativeResult', ''));
  const [generatePrefs, setGeneratePrefs] = useState<GeneratePreferences>(() => loadAIToolsState('generatePrefs', {}));

  const [styleResult, setStyleResult] = useState<StyleAnalysis | null>(() => loadAIToolsState('styleResult', null));

  const [diagnosePromptInput, setDiagnosePromptInput] = useState(() => loadAIToolsState('diagnosePromptInput', ''));
  const [diagnoseIssue, setDiagnoseIssue] = useState(() => loadAIToolsState('diagnoseIssue', ''));
  const [diagnoseResult, setDiagnoseResult] = useState<Diagnosis | null>(() => loadAIToolsState('diagnoseResult', null));

  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState('');

  const [suggestedModel, setSuggestedModel] = useState<ModelInfo | null>(null);
  const [activeModel, setActiveModel] = useState<string>('');
  const [modelTips, setModelTips] = useState<string[]>([]);
  const [useModelTips, setUseModelTips] = useState(false);

  async function fetchActiveModel() {
    try {
      const keys = await listApiKeys();
      const activeKey = keys.find(k => k.is_active_improve || k.is_active);

      if (activeKey) {
        const model = activeKey.model_improve || activeKey.model_name || getDefaultModelForProvider(activeKey.provider);
        const providerName = activeKey.provider.charAt(0).toUpperCase() + activeKey.provider.slice(1);
        setActiveModel(`${providerName} ${model}`);
        return;
      }

      const { data: localData } = await db
        .from('user_local_endpoints')
        .select('*')
        .eq('is_active_improve', true)
        .single();

      if (localData) {
        const modelName = localData.model_improve || localData.model_name;
        setActiveModel(`${localData.provider === 'ollama' ? 'Ollama' : 'LM Studio'} (${modelName})`);
        return;
      }

      setActiveModel('');
    } catch (e) {
      console.error('Failed to fetch active model', e);
    }
  }

  useImperativeHandle(ref, () => ({
    hasContent: () => {
      if (tab === 'improve') return !!improveInput.trim();
      return false;
    },
    clearContent: () => {
      setImproveInput(''); setNegativeInput(''); setImproveResult(''); setNegativeResult('');
    },
    setInputContent: (content: string) => {
      setImproveInput(content); setTab('improve'); setExpanded(true);
    },
    setNegativeInputContent: (content: string) => {
      setNegativeInput(content); setExpanded(true);
    },
    clearImproveInput: () => {
      setImproveInput(''); setImproveResult('');
    }
  }));

  useEffect(() => {
    if (!improveInput.trim()) { setSuggestedModel(null); setModelTips([]); return; }
    const timeout = setTimeout(() => {
      const results = analyzePrompt(improveInput);
      if (results && results.length > 0 && results[0]) {
        setSuggestedModel(results[0].model as ModelInfo);
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [improveInput]);

  useEffect(() => {
    const state = {
      tab, expanded,
      improveInput, improveResult, negativeInput, negativeResult,
      generateInput, generateResult, generateNegativeResult, generatePrefs,
      styleResult,
      diagnosePromptInput, diagnoseIssue, diagnoseResult,
    };
    localStorage.setItem(AITOOLS_STORAGE_KEY, JSON.stringify(state));
  }, [tab, expanded, improveInput, improveResult, negativeInput, negativeResult, generateInput, generateResult, generateNegativeResult, generatePrefs, styleResult, diagnosePromptInput, diagnoseIssue, diagnoseResult]);

  useEffect(() => {
    fetchActiveModel();
    const onFocus = () => fetchActiveModel();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function handleCopy(text: string, id: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopied(id); setTimeout(() => setCopied(''), 2000);
        return;
      }
    } catch (err) { }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
      document.body.appendChild(textArea); textArea.focus(); textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) { setCopied(id); setTimeout(() => setCopied(''), 2000); }
    } catch (err) { toast.error('Failed to copy to clipboard'); }
  }

  async function handleImprove() {
    if (!improveInput.trim()) return;
    setLoading(true); setImproveResult(''); setNegativeResult('');
    try {
      const token = '';
      let apiPreferences;
      try {
        const saved = localStorage.getItem('promptImproverPrefs');
        if (saved) apiPreferences = JSON.parse(saved);
      } catch (e) { }

      // Always prioritize the selected task model from Settings/Task Models.
      const effectivePrefs = taskModelToPreferences(taskImproveModel) ?? apiPreferences;

      if (!supportsNegativePrompt(suggestedModel?.id || '')) {
        const result: any = await optimizePromptForModel(improveInput, suggestedModel?.name ?? 'DALL-E 3', token, negativeInput, effectivePrefs);
        const improvedText = result.optimizedPrompt || result.improved || result.prompt || result.raw || (typeof result === 'string' ? result : '');
        setImproveResult(improvedText);
        setNegativeResult(result.negativePrompt || '');
      } else {
        const tips = useModelTips ? modelTips : undefined;
        if (negativeInput.trim()) {
          const result: any = await improvePromptWithNegative(improveInput, negativeInput.trim(), token, effectivePrefs, taskImproveModel, tips);
          const improvedText = result.improved || result.optimizedPrompt || result.prompt || result.raw || (typeof result === 'string' ? result : '');
          setImproveResult(improvedText);
          setNegativeResult(result.negativePrompt || '');
        } else {
          const improved = await improvePrompt(improveInput, token, effectivePrefs, taskImproveModel, tips);
          setImproveResult(typeof improved === 'string' ? improved : String(improved ?? ''));
          setNegativeResult('');
        }
      }
    } catch (e) { handleAIError(e); } finally { setLoading(false); }
  }

  async function handleGenerate() {
    if (!generateInput.trim()) return;
    setLoading(true); setGenerateResult(''); setGenerateNegativeResult('');
    try {
      const token = '';
      const [charsRes, topPromptsRes] = await Promise.all([
        db.from('characters').select('name, description').limit(5),
        db.from('prompts').select('content').gte('rating', 4).order('rating', { ascending: false }).limit(5),
      ]);
      const context = charsRes.data?.map((c: any) => `${c.name}: ${c.description}`).join('; ');
      const successfulPrompts = topPromptsRes.data?.map((p: any) => p.content) ?? [];
      const result = await generateFromDescription(generateInput, {
        context: context || undefined,
        preferences: { ...generatePrefs, maxWords },
        successfulPrompts: successfulPrompts.length > 0 ? successfulPrompts : undefined,
        taskModel: taskGenerateModel,
      }, token);
      if (result) {
        setGenerateResult(result.prompt);
        if (result.negativePrompt) setGenerateNegativeResult(result.negativePrompt);
      }
    } catch (e) { handleAIError(e); } finally { setLoading(false); }
  }

  async function handleAnalyze() {
    setLoading(true); setStyleResult(null);
    try {
      const token = '';
      const { data } = await db.from('prompts').select('content').order('created_at', { ascending: false }).limit(20);
      if (!data || data.length < 3) {
        toast.error('Need at least 3 saved prompts to analyze your style');
        setLoading(false); return;
      }
      const result = await analyzeStyle(data.map((p: any) => p.content), token);
      setStyleResult(result);
      saveStyleProfile(result, data.length).catch(() => { });
    } catch (e) { handleAIError(e); } finally { setLoading(false); }
  }

  async function handleDiagnose() {
    if (!diagnosePromptInput.trim() || !diagnoseIssue.trim()) return;
    setLoading(true); setDiagnoseResult(null);
    try {
      const token = '';
      const result = await diagnosePrompt(diagnosePromptInput, diagnoseIssue, token);
      setDiagnoseResult(result);
    } catch (e) { handleAIError(e); } finally { setLoading(false); }
  }

  async function handleSavePrompt(text: string, title: string, options?: { originalPrompt?: string, suggestedModelId?: string, negativePrompt?: string }) {
    setSaving(title);
    try {
      const journeySteps = options?.originalPrompt ? [
        { step: 'Original Prompt', label: options.originalPrompt }, { step: 'Improved by AI', label: text }
      ] : [{ step: 'Generated with AI', label: text }];

      if (onRequestSavePrompt) {
        const data: Partial<Prompt> = { title, content: text, notes: 'Generated with AI Tools', generation_journey: journeySteps };
        if (options?.suggestedModelId) data.suggested_model = options.suggestedModelId;
        if (options?.negativePrompt) data.negative_prompt = options.negativePrompt;
        onRequestSavePrompt(data); setSaving(''); return;
      }

      const { data: existingPrompts } = await db.from('prompts').select('id').eq('content', text).limit(1);
      if (existingPrompts && existingPrompts.length > 0) { toast.error('Already in library'); setSaving(''); return; }

      const suggestion = analyzePrompt(text)[0];
      const suggestedModelIdToSave = suggestion ? suggestion.model.id : undefined;

      let ncModelNote = '';
      try {
        const ncRecommendation = await recommendNCModel(text);
        if (ncRecommendation) {
          ncModelNote = ` | Best NC Model: ${ncRecommendation.model.name}`;
          toast.success(`Recommended: ${ncRecommendation.model.name}`);
        }
      } catch (e) { }

      const { data: newPrompt, error } = await db.from('prompts').insert({
        title, content: text, notes: 'Generated with AI Tools' + ncModelNote, generation_journey: journeySteps,
        rating: 0, is_template: false, is_favorite: false, suggested_model: suggestedModelIdToSave,
        negative_prompt: options?.negativePrompt || null
      }).select().single();

      if (error) throw error;
      
      if (newPrompt) {
        triggerKeywordExtraction(newPrompt.id, newPrompt.content);
      }
      
      toast.success('Prompt saved'); if (onSaved) onSaved();
    } catch (e) { toast.error('Failed to save prompt'); } finally { setSaving(''); }
  }

  const visibleTabs = allowedTabs ? TABS.filter(t => allowedTabs.includes(t.id)) : TABS;

  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50">
      {showHeader && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800/80 hover:from-slate-800/80 hover:to-slate-800/60 transition-all border-b border-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center">
              <Brain size={16} className="text-teal-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">{t('aiTools.title', 'AI Tools')}</h3>
              <p className="text-[11px] text-slate-500">{t('aiTools.subtitle', 'Optimize your creative flow')}</p>
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </button>
      )}

      {(expanded || !showHeader) && (
        <div className="p-5 space-y-5">
          {visibleTabs.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map(({ id, labelKey, icon: Icon, descKey }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 min-w-[80px] p-3 rounded-xl text-left transition-all border ${tab === id ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'}`}
                >
                  <Icon size={15} className={tab === id ? 'text-teal-400' : 'text-slate-500'} />
                  <p className={`text-xs font-medium mt-1.5 ${tab === id ? 'text-teal-300' : 'text-slate-300'}`}>{t(labelKey)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{t(descKey)}</p>
                </button>
              ))}
            </div>
          )}

          {tab === 'improve' && (
            <ImproveTab
              input={improveInput} setInput={setImproveInput}
              negativeInput={negativeInput} setNegativeInput={setNegativeInput}
              result={improveResult} negativeResult={negativeResult}
              loading={loading} copied={copied} saving={saving}
              onSubmit={handleImprove} onCopy={handleCopy}
              onUse={() => {
                if (onPromptGenerated) onPromptGenerated(improveResult);
                if (negativeResult && onNegativePromptGenerated) onNegativePromptGenerated(negativeResult);
              }}
              onSave={(text) => handleSavePrompt(text, (text.split(',')[0] || 'Untitled').trim().slice(0, 160), { originalPrompt: improveInput, suggestedModelId: suggestedModel?.id, negativePrompt: negativeResult })}
              onClear={() => { setImproveResult(''); setNegativeResult(''); }}
              generatedPrompt={generatedPrompt} generatedNegativePrompt={generatedNegativePrompt}
              suggestedModel={suggestedModel} activeModel={activeModel}
              modelTips={modelTips} useModelTips={useModelTips}
              onSetUseModelTips={setUseModelTips} onSetModelTips={setModelTips}
              availableModelTips={availableModelTips}
            />
          )}

          {tab === 'generate' && (
            <GenerateTab
              input={generateInput} setInput={setGenerateInput}
              preferences={generatePrefs} setPreferences={setGeneratePrefs}
              result={generateResult} negativeResult={generateNegativeResult}
              loading={loading} copied={copied} saving={saving}
              onSubmit={handleGenerate} onCopy={handleCopy}
              onUse={() => {
                if (onPromptGenerated) onPromptGenerated(generateResult);
                if (generateNegativeResult && onNegativePromptGenerated) onNegativePromptGenerated(generateNegativeResult);
              }}
              onSave={(text) => handleSavePrompt(text, (text.split(',')[0] || 'Untitled').trim().slice(0, 160), { originalPrompt: generateInput, negativePrompt: generateNegativeResult })}
              onClear={() => { setGenerateResult(''); setGenerateNegativeResult(''); }}
              generatedPrompt={generatedPrompt}
            />
          )}

          {tab === 'analyze' && (
            <AnalyzeTab result={styleResult} loading={loading} onAnalyze={handleAnalyze} />
          )}

          {tab === 'diagnose' && (
            <DiagnoseTab
              promptInput={diagnosePromptInput} setPromptInput={setDiagnosePromptInput}
              issue={diagnoseIssue} setIssue={setDiagnoseIssue}
              result={diagnoseResult} loading={loading} copied={copied} saving={saving}
              onSubmit={handleDiagnose} onCopy={handleCopy}
              onUse={(p) => { if (onPromptGenerated) onPromptGenerated(p); }}
              onSave={(text) => handleSavePrompt(text, (text.split(',')[0] || 'Untitled').trim().slice(0, 160))}
              generatedPrompt={generatedPrompt}
            />
          )}
        </div>
      )}
    </div>
  );
});

export default AITools;

function ImproveTab({
  input, setInput, negativeInput, setNegativeInput, result, negativeResult, loading, copied, saving, onSubmit, onCopy, onUse, onSave, onClear, generatedPrompt, generatedNegativePrompt, suggestedModel, activeModel, modelTips, useModelTips, onSetUseModelTips, onSetModelTips, availableModelTips,
}: any) {
  const { t } = useTranslation();
  const [showDiff, setShowDiff] = useState(true);
  const [fetchingTips, setFetchingTips] = useState(false);
  const diff = result ? diffWords(input, result) : [];
  const negativeDiff = negativeResult ? diffWords(negativeInput, negativeResult) : [];

  const handleAccept = () => {
    setInput(result); if (negativeResult) setNegativeInput(negativeResult); onClear();
  };

  return (
    <div className="space-y-3">
      {activeModel && (
        <div className="flex items-center gap-2 px-1">
          <Sparkles size={14} className="text-teal-400" />
          <h3 className="text-xs font-medium text-slate-300">
            {t('aiTools.improve.button', 'Improve Prompt')} with <span className="text-teal-400">{activeModel}</span>
          </h3>
        </div>
      )}
      <textarea
        value={input} onChange={(e) => setInput(e.target.value)}
        placeholder={t('aiTools.improve.placeholder', 'Enter your prompt here...')}
        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-32 focus:outline-none focus:border-teal-500/40"
      />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={useModelTips} onChange={(e) => onSetUseModelTips(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-teal-500 focus:ring-0" />
          <span className="text-[11px] text-slate-400 group-hover:text-slate-300">{t('aiTools.improve.useTips', 'Use model tips')}</span>
        </label>
        {useModelTips && (
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <span className="text-[11px] text-teal-300 font-medium">Model tips ({modelTips.length})</span>
            <button
              onClick={async (e) => {
                e.preventDefault(); setFetchingTips(true);
                try {
                  const { getTopCandidates } = await import('../lib/models-data');
                  const { recommendModels } = await import('../lib/ai-service');
                  const candidates = getTopCandidates(input, 5);
                  const res = await recommendModels(input, { candidates });
                  const top = res.recommendations[0];
                  if (top?.tips?.length) { onSetModelTips(top.tips); onSetUseModelTips(true); }
                } catch { } finally { setFetchingTips(false); }
              }}
              disabled={fetchingTips} className="p-1 text-slate-500 hover:text-teal-400"
            >
              <RefreshCcw size={10} className={fetchingTips ? 'animate-spin' : ''} />
            </button>
            {modelTips.length > 0 && <button onClick={() => { onSetModelTips([]); onSetUseModelTips(false); }} className="text-[10px] text-slate-500 hover:text-slate-300">✕</button>}
          </label>
        )}
      </div>

      {useModelTips && modelTips.length > 0 && (
        <ul className="bg-slate-900/60 border border-teal-900/40 rounded-xl px-3 py-2 space-y-1">
          {modelTips.map((tip: string, i: number) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
              <span className="text-teal-500 shrink-0 mt-0.5">💡</span>{tip}
            </li>
          ))}
        </ul>
      )}

      {supportsNegativePrompt(suggestedModel?.id || '') ? (
        <>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-medium text-slate-400 block">{t('aiTools.improve.negativeLabel', 'Negative Prompt')} <span className="text-slate-600">{t('aiTools.improve.optional', '(optional)')}</span></label>
            <span className={`text-[10px] font-mono ${negativeInput.length > 550 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>{negativeInput.length}/600</span>
          </div>
          <textarea
            value={negativeInput} onChange={(e) => setNegativeInput(e.target.value.slice(0, 600))}
            maxLength={600} placeholder={t('aiTools.improve.negativePlaceholder', 'Things to avoid...')}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-teal-500/40"
          />
        </>
      ) : (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 rounded-lg"><Sparkles size={14} className="text-teal-400" /></div>
          <div>
            <p className="text-xs font-medium text-slate-300">Optimized for {suggestedModel?.name}</p>
            <p className="text-[10px] text-slate-500">Negative prompts automatically handled for this model.</p>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDiff(true)} className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${showDiff ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-slate-300'}`}>Diff View</button>
              <button onClick={() => setShowDiff(false)} className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${!showDiff ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-slate-300'}`}>Final Result</button>
            </div>
          </div>
          <div className="p-4 text-sm leading-relaxed min-h-[6rem]">
            <p className="text-[10px] font-medium text-teal-400/70 mb-1 uppercase tracking-wider">Positive Prompt</p>
            {showDiff ? (
              <div className="whitespace-pre-wrap">
                {diff.map((part: any, i: number) => (
                  <span key={i} className={`${part.type === 'add' ? 'bg-emerald-500/20 text-emerald-200 px-0.5 rounded' : part.type === 'del' ? 'bg-red-500/20 text-red-300 line-through decoration-red-400/50 px-0.5 rounded mx-0.5' : 'text-slate-300'}`}>{part.value}{' '}</span>
                ))}
              </div>
            ) : <p className="text-white whitespace-pre-wrap">{result}</p>}
            {negativeResult && (
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <p className="text-[10px] font-medium text-red-400/70 mb-1 uppercase tracking-wider">Negative Prompt</p>
                {showDiff ? (
                  <div className="whitespace-pre-wrap">
                    {negativeDiff.map((part: any, i: number) => (
                      <span key={i} className={`${part.type === 'add' ? 'bg-emerald-500/20 text-emerald-200 px-0.5 rounded' : part.type === 'del' ? 'bg-red-500/20 text-red-300 line-through decoration-red-400/50 px-0.5 rounded mx-0.5' : 'text-slate-300'}`}>{part.value}{' '}</span>
                    ))}
                  </div>
                ) : <p className="text-white whitespace-pre-wrap">{negativeResult}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={onSubmit} disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? t('aiTools.improve.buttonLoading', 'Improving...') : t('aiTools.improve.button', 'Improve Prompt')}
        </button>

        {!result ? (
          <>
            {input && (
              <button onClick={() => onCopy(input, 'input-copy')} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                {copied === 'input-copy' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied === 'input-copy' ? t('aiTools.improve.copied', 'Copied') : t('aiTools.improve.copy', 'Copy')}
              </button>
            )}
            {generatedPrompt && (
              <button onClick={() => { setInput(generatedPrompt); if (generatedNegativePrompt) setNegativeInput(generatedNegativePrompt); }} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-amber-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-amber-300 border border-slate-700">
                <ArrowUp size={14} /> Paste Generated
              </button>
            )}
            {input.trim() && (
              <button onClick={() => onSave(input)} className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-xl hover:bg-amber-500/20 border border-amber-500/30">
                <Save size={14} /> {t('aiTools.improve.saveToLibrary', 'Save')}
              </button>
            )}
            {(input || (supportsNegativePrompt(suggestedModel?.id || '') && negativeInput)) && (
              <button onClick={() => { setInput(''); setNegativeInput(''); }} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 ml-auto md:ml-0">
                <Eraser size={14} /> {t('aiTools.common.clear', 'Clear')}
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={handleAccept} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium rounded-xl hover:bg-emerald-600/30">
              <Check size={14} /> {t('aiTools.improve.accept', 'Accept')}
            </button>
            <button onClick={onClear} className="px-4 py-2.5 text-slate-400 hover:text-white text-sm">
              {t('aiTools.improve.discard', 'Discard')}
            </button>
            <button onClick={() => onSave(result)} disabled={saving === 'improve'} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs rounded-lg border border-amber-500/30 disabled:opacity-50">
              <Save size={11} /> Save
            </button>
            <button onClick={() => onCopy(result, 'improve')} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 text-xs rounded-lg hover:bg-slate-700 hover:text-white border border-slate-700">
              {copied === 'improve' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              {copied === 'improve' ? 'Copied' : 'Copy Result'}
            </button>
            <button onClick={onUse} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-teal-400 text-xs rounded-lg hover:bg-slate-700 hover:text-teal-300 border border-slate-700">
              <ArrowUp size={11} /> Use
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const STYLE_OPTIONS = ['Dreamy & Ethereal', 'Dark Fantasy', 'Photorealistic', 'Cinematic', 'Watercolor', 'Anime / Manga', 'Oil Painting', 'Impressionist', 'Minimalist', 'Steampunk', 'Cyberpunk / Neon', 'Studio Ghibli'];
const MOOD_OPTIONS = ['Peaceful', 'Dramatic', 'Mysterious', 'Joyful', 'Melancholic', 'Epic', 'Nostalgic', 'Eerie'];
const SUBJECT_OPTIONS = ['Landscape', 'Character / Portrait', 'Creature / Animal', 'Architecture', 'Still Life', 'Abstract', 'Scene / Narrative'];

function GenerateTab({
  input, setInput, preferences, setPreferences, result, negativeResult, loading, copied, saving, onSubmit, onCopy, onUse, onSave, onClear, generatedPrompt,
}: any) {
  const { t } = useTranslation();
  const [showPrefs, setShowPrefs] = useState(false);

  return (
    <div className="space-y-3">
      <textarea
        value={input} onChange={(e) => setInput(e.target.value)}
        placeholder={t('aiTools.describe.placeholder', 'Describe what you want to create...')}
        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-teal-500/40"
      />
      <button onClick={() => setShowPrefs(!showPrefs)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors">
        {showPrefs ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t('aiTools.describe.preferences', 'Preferences')}
        {(preferences.style || preferences.mood || preferences.subject) && <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
      </button>

      {showPrefs && (
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <PreferenceRow label={t('aiTools.describe.style', 'Style')} value={preferences.style} options={STYLE_OPTIONS} onChange={(v) => setPreferences({ ...preferences, style: v })} />
          <PreferenceRow label={t('aiTools.describe.mood', 'Mood')} value={preferences.mood} options={MOOD_OPTIONS} onChange={(v) => setPreferences({ ...preferences, mood: v })} />
          <PreferenceRow label={t('aiTools.describe.subject', 'Subject')} value={preferences.subject} options={SUBJECT_OPTIONS} onChange={(v) => setPreferences({ ...preferences, subject: v })} />
          <div className="pt-2 border-t border-slate-700/50 flex justify-end">
            <button onClick={() => setPreferences({})} className="text-[10px] text-slate-500 hover:text-slate-300">{t('aiTools.describe.reset', 'Reset')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onSubmit} disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? t('aiTools.describe.buttonLoading', 'Generating...') : t('aiTools.describe.button', 'Generate Prompt')}
        </button>
        {input && (
          <button onClick={() => { setInput(''); onClear(); }} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 ml-auto md:ml-0">
            <Eraser size={14} /> {t('aiTools.common.clear', 'Clear')}
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-3 pt-2">
          <PromptResult text={result} id="generate" copied={copied} saving={saving} onCopy={onCopy} onUse={onUse} onSave={() => onSave(result)} label="Generated Prompt" />
          {negativeResult && <PromptResult text={negativeResult} id="generate-neg" copied={copied} onCopy={onCopy} onUse={() => { }} label="Generated Negative Prompt" />}
        </div>
      )}
    </div>
  );
}

function PreferenceRow({ label, value, options, onChange }: any) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt: string) => (
          <button
            key={opt} onClick={() => onChange(value === opt ? undefined : opt)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${value === opt ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalyzeTab({ result, loading, onAnalyze }: any) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {!result ? (
        <div className="text-center py-6 px-4 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
          <Brain size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-4">{t('aiTools.analyze.description', 'Analyze your prompt history to discover your unique style profile.')}</p>
          <button
            onClick={onAnalyze} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
            {loading ? t('aiTools.analyze.buttonLoading', 'Analyzing...') : t('aiTools.analyze.button', 'Analyze My Style')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Top Signature</p>
              <p className="text-sm text-teal-400 font-semibold">{result.signature}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Complexity</p>
              <p className="text-sm text-white font-semibold">{result.profile}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-[10px] font-medium text-slate-500 uppercase mb-3 tracking-wider">Recurring Themes</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {result.themes.map((t: string, i: number) => <span key={i} className="px-2 py-1 bg-slate-900 text-slate-300 rounded-md border border-slate-700">{t}</span>)}
            </div>
          </div>
          <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl p-4">
            <p className="text-[10px] font-medium text-teal-400 uppercase mb-2">Style Growth Advice</p>
            <ul className="space-y-1.5">
              {result.suggestions.map((s: string, i: number) => <li key={i} className="text-xs text-slate-300 flex items-start gap-2"><span className="text-teal-500">•</span> {s}</li>)}
            </ul>
          </div>
          <button onClick={onAnalyze} disabled={loading} className="w-full py-2.5 text-xs text-slate-500 hover:text-teal-400 transition-colors">Re-run Analysis</button>
        </div>
      )}
    </div>
  );
}

function DiagnoseTab({
  promptInput, setPromptInput, issue, setIssue, result, loading, copied, saving, onSubmit, onCopy, onUse, onSave, generatedPrompt,
}: any) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <textarea
        value={promptInput} onChange={(e) => setPromptInput(e.target.value)}
        placeholder={t('aiTools.diagnose.promptPlaceholder', 'Paste the prompt that has issues...')}
        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-20 focus:outline-none focus:border-teal-500/40"
      />
      <textarea
        value={issue} onChange={(e) => setIssue(e.target.value)}
        placeholder={t('aiTools.diagnose.issuePlaceholder', 'Describe what is wrong with the result...')}
        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none h-20 focus:outline-none focus:border-teal-500/40"
      />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onSubmit} disabled={loading || !promptInput.trim() || !issue.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
          {loading ? t('aiTools.diagnose.buttonLoading', 'Diagnosing...') : t('aiTools.diagnose.button', 'Diagnose Issue')}
        </button>
        {(promptInput || issue) && (
          <button onClick={() => { setPromptInput(''); setIssue(''); }} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 ml-auto md:ml-0">
            <Eraser size={14} /> {t('aiTools.common.clear', 'Clear')}
          </button>
        )}
        {generatedPrompt && (
          <button onClick={() => setPromptInput(generatedPrompt)} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-amber-400 text-xs font-medium rounded-xl hover:bg-slate-700 hover:text-amber-300 border border-slate-700">
            <ArrowUp size={14} /> Paste Generated
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-3 pt-2">
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-400 mb-1">{t('aiTools.diagnose.likelyCause', 'Likely Cause')}</p>
            <p className="text-sm text-slate-300">{result.cause}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">{t('aiTools.diagnose.fixes', 'Suggested Fixes')}</p>
            <div className="space-y-1.5">
              {result.fixes.map((f: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-amber-400 font-medium mt-px">{i + 1}.</span> {f}
                </div>
              ))}
            </div>
          </div>
          <PromptResult
            text={result.improvedPrompt} id="diagnose" copied={copied} saving={saving} onCopy={onCopy}
            onUse={() => onUse(result.improvedPrompt)} onSave={() => onSave(result.improvedPrompt)}
            label={t('aiTools.diagnose.improvedLabel', 'Fixed Prompt')}
          />
        </div>
      )}
    </div>
  );
}

function PromptResult({
  text, id, copied, saving, onCopy, onUse, onSave, label,
}: any) {
  const { t } = useTranslation();
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      {label && <p className="text-xs font-medium text-teal-400 mb-2">{label}</p>}
      <p className="text-sm text-white leading-relaxed mb-3">{text}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onCopy(text, id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition-colors">
          {copied === id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied === id ? t('aiTools.common.copied', 'Copied') : t('aiTools.common.copy', 'Copy')}
        </button>
        {onSave && (
          <button onClick={onSave} disabled={saving === id} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs rounded-lg hover:bg-amber-500/20 border border-amber-500/30 disabled:opacity-50">
            <Save size={11} /> Save to Library
          </button>
        )}
        <button onClick={onUse} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 text-teal-400 text-xs rounded-lg hover:bg-teal-500/20 transition-colors">
          <ArrowRight size={11} /> {t('aiTools.common.useThis', 'Use This')}
        </button>
      </div>
    </div>
  );
}
