import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Shuffle, Target, Zap, Clock, ArrowRight, Eraser, PenTool, Wand2 } from 'lucide-react';
import ChoiceModal from '../components/ChoiceModal';
import RandomGenerator from '../components/RandomGenerator';
import GuidedBuilder from '../components/GuidedBuilder';
import ManualGenerator from '../components/ManualGenerator';
import AITools, { AIToolsRef } from '../components/AITools';
import MagicPromptInput from '../components/MagicPromptInput';
import PromptEditor from '../components/PromptEditor';
import Modal from '../components/Modal';
import { db } from '../lib/api';
import type { Prompt } from '../lib/types';
import { PRESET_OPTIONS } from '../lib/models-data';
import { API_BASE_URL } from '../lib/constants';
import { getPromptDiversityThreshold } from '../lib/user-settings';


type Mode = 'random' | 'guided' | 'remix' | 'manual';

const STORAGE_KEY = 'nightcompanion_generator_state';

export default function Generator() {
  const { t } = useTranslation();
  // Use lazy state initializers to read from localStorage synchronously on mount.
  // This ensures child components receive the correct initial values immediately.
  const [mode, setMode] = useState<Mode>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).mode || 'random'; } catch { /* ignore */ } return 'random';
  });

  const aiToolsRef = useRef<AIToolsRef>(null);
  const [aiAdviceTips, setAiAdviceTips] = useState<string[]>([]);

  const [guidedInitial, setGuidedInitial] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).guidedInitial || ''; } catch { /* ignore */ } return '';
  });
  const [lastPrompts, setLastPrompts] = useState<Prompt[]>([]);
  const [remixBase, setRemixBase] = useState('');
  const [saveCount, setSaveCount] = useState(0);
  const [maxWords, setMaxWords] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return 70;
    try {
      const state = JSON.parse(saved);
      return state.maxWords || 70;
    } catch {
      return 70;
    }
  });

  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sliderRef.current) {
      sliderRef.current.style.setProperty('--gradient-percent', `${((maxWords - 20) / 80) * 100}%`);
    }
  }, [maxWords]);
  const [randomPrompt, setRandomPrompt] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).randomPrompt || ''; } catch { /* ignore */ } return '';
  });
  const [randomNegativePrompt, setRandomNegativePrompt] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).randomNegativePrompt || ''; } catch { /* ignore */ } return '';
  });
  const [manualInitial, setManualInitial] = useState<{ prompts: string[], negative: string }>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).manualInitial || { prompts: [], negative: '' }; } catch { /* ignore */ } return { prompts: [], negative: '' };
  });

  // Greylist State
  const defaultGreylist = ['bioluminescent', 'neon-lit', 'cyberpunk', 'cyber', 'jellyfish', 'neon'];
  const [greylist, setGreylist] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('nightcompanion_generator_greylist');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return defaultGreylist;
  });
  const [newGreylistWord, setNewGreylistWord] = useState('');

  // NightCafe Preset State
  const [selectedNightCafePreset, setSelectedNightCafePreset] = useState<string>(() => {
    try {
      const s = localStorage.getItem('nightcompanion_generator_nc_preset');
      if (s) return s;
    } catch { /* ignore */ }
    return '';
  });

  // Persist NightCafe Preset
  useEffect(() => {
    localStorage.setItem('nightcompanion_generator_nc_preset', selectedNightCafePreset);
  }, [selectedNightCafePreset]);

  // Persist Greylist
  useEffect(() => {
    localStorage.setItem('nightcompanion_generator_greylist', JSON.stringify(greylist));
  }, [greylist]);

  function handleAddGreylistWord() {
    const word = newGreylistWord.trim().toLowerCase();
    if (word && !greylist.includes(word)) {
      setGreylist([...greylist, word]);
    }
    setNewGreylistWord('');
  }

  function handleRemoveGreylistWord(wordToRemove: string) {
    setGreylist(greylist.filter(w => w !== wordToRemove));
  }



  // Load recent prompts on mount
  useEffect(() => {
    loadRecentPrompts();
  }, []);

  // Reload prompts when saveCount changes
  useEffect(() => {
    loadRecentPrompts();
  }, [saveCount]);

  // Save state to localStorage when it changes
  // Save state to localStorage when it changes
  useEffect(() => {
    // We don't persist manualInitial because ManualGenerator handles its own persistence.
    // If we persist it here, it would overwrite the user's latest edits in ManualGenerator
    // with the stale "initial" state on refresh.
    const state = { guidedInitial, maxWords, mode, randomPrompt, randomNegativePrompt };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [guidedInitial, maxWords, mode, randomPrompt, randomNegativePrompt]);

  async function loadRecentPrompts() {
    const { data } = await db
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setLastPrompts(data ?? []);
  }

  function handleSwitchToGuided(prompt: string) {
    setGuidedInitial(prompt);
    setMode('guided');
  }

  function handleSwitchToManual(prompt: string, negative: string) {
    setManualInitial({ prompts: [prompt], negative });
    setMode('manual');
  }

  function handleSelectRemix(prompt: Prompt) {
    setRemixBase(prompt.content);
    setGuidedInitial(prompt.content);
    setMode('guided');
  }



  const [resetKey, setResetKey] = useState(0);

  function handleClearAll() {
    setGuidedInitial('');
    setRandomPrompt('');
    setRandomNegativePrompt('');
    setManualInitial({ prompts: [], negative: '' });
    setMode('random');
    setMaxWords(70);
    setResetKey(prev => prev + 1); // Force ManualGenerator to reset
    localStorage.removeItem(STORAGE_KEY);
    // Also clear manual generator specific storage
    localStorage.removeItem('nightcompanion_manual_generator');
    localStorage.removeItem('nightcompanion_guided_state');
    localStorage.removeItem('nightcompanion_aitools_state');
    localStorage.removeItem('nightcompanion_random_ai_advice');
    localStorage.removeItem('nightcompanion_manual_ai_advice');
    if (aiToolsRef.current) {
      aiToolsRef.current.clearContent();
    }
  }

  // Modal State for External Checks (Improve Tab)
  const [showExternalClearModal, setShowExternalClearModal] = useState(false);
  // pendingExternalAction now accepts (keepNegative: boolean)
  const [pendingExternalAction, setPendingExternalAction] = useState<((keepNegative: boolean) => void) | null>(null);
  const [externalModalConfig, setExternalModalConfig] = useState<{title?: string, message?: React.ReactNode, fullClear?: boolean}>({});

  function handleCheckExternalFields(proceed: (keepNegative: boolean) => void, isLocalDirty: boolean, config?: {title?: string, message?: React.ReactNode, fullClear?: boolean}) {
    const isExternalDirty = aiToolsRef.current?.hasContent();

    if (!isLocalDirty && !isExternalDirty) {
      // Nothing dirty, just proceed (standard clear behavior = clear all usually)
      proceed(false);
      return;
    }

    setExternalModalConfig(config || { fullClear: true });
    // Show Unified ChoiceModal
    setPendingExternalAction(() => proceed);
    setShowExternalClearModal(true);
  }

  const modes = [
    { id: 'random' as Mode, label: t('generator.modes.random'), icon: Shuffle, desc: t('generator.modes.randomDesc') },
    { id: 'guided' as Mode, label: t('generator.modes.guided'), icon: Target, desc: t('generator.modes.guidedDesc') },
    { id: 'manual' as Mode, label: t('generator.modes.manual'), icon: PenTool, desc: t('generator.modes.manualDesc') },
    { id: 'remix' as Mode, label: t('generator.modes.remix'), icon: Zap, desc: t('generator.modes.remixDesc') },
  ];

  const [autoFillImprove, setAutoFillImprove] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s).autoFillImprove ?? false; } catch { /* ignore */ } return false;
  });

  const [editingPromptData, setEditingPromptData] = useState<Partial<Prompt> | null>(null);

  const [similarPromptData, setSimilarPromptData] = useState<{ existing: Prompt, new: Partial<Prompt> } | null>(null);

  async function handleRequestSavePrompt(data: Partial<Prompt>) {
    setSimilarPromptData(null);
    if (data.content) {
      try {
        const similarityThreshold = getPromptDiversityThreshold();

        // 1. Check exact match
        const { data: existingPrompts } = await db
          .from('prompts')
          .select('*')
          .eq('content', data.content)
          .limit(1);

        if (existingPrompts && existingPrompts.length > 0) {
          toast.info('This prompt already exists in your library. Editing existing prompt.');
          setEditingPromptData(existingPrompts[0]);
          return;
        }

        // 2. Check similarity match
        const res = await fetch(
          `${API_BASE_URL}/api/prompts/similar?content=${encodeURIComponent(data.content)}&threshold=${similarityThreshold}`
        );
        if (res.ok) {
          const similar = await res.json();
          // Only flag if similarity exceeds the user-configured threshold.
          if (similar && similar.length > 0 && similar[0].sim >= similarityThreshold) {
            setSimilarPromptData({ existing: similar[0], new: data });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to check for duplicates/similarity', e);
      }
    }
    setEditingPromptData(data);
  }

  // Save autoFillImprove state
  useEffect(() => {
    const state = { guidedInitial, maxWords, mode, randomPrompt, randomNegativePrompt, autoFillImprove };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [guidedInitial, maxWords, mode, randomPrompt, randomNegativePrompt, autoFillImprove]);

  // Handle AutoFill Logic
  useEffect(() => {
    if (autoFillImprove && aiToolsRef.current) {
      // Determine current prompt based on mode
      let p = '';
      let n = '';
      if (mode === 'random') {
        p = randomPrompt;
        n = randomNegativePrompt;
      } else if (mode === 'guided') {
        p = guidedInitial;
      } else if (mode === 'remix') {
        p = remixBase;
      }

      // Only update if differen to avoid loops/refreshes, though setInputContent should be safe 
      if (p) {
        // We use a small timeout to let the UI settle if needed, but direct is fine
        aiToolsRef.current.setInputContent(p);
        if (n) aiToolsRef.current.setNegativeInputContent(n);
      }
    }
  }, [randomPrompt, randomNegativePrompt, guidedInitial, remixBase, mode, autoFillImprove]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('generator.title')}</h1>
        <p className="text-slate-400 mt-1">{t('generator.subtitle')}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {modes.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => {
              setMode(id);
              if (id !== 'guided') setGuidedInitial('');
            }}
            className={`p-4 rounded-2xl text-left transition-all border ${mode === id
              ? 'bg-amber-500/10 border-amber-500/30 shadow-sm'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${mode === id
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-slate-800 text-slate-500'
              }`}>
              <Icon size={18} />
            </div>
            <p className={`text-sm font-medium ${mode === id ? 'text-amber-300' : 'text-white'}`}>
              {label}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">

        {/* Global Max Words Slider, Greylist, and Controls (Hide in Manual Mode?) */}
        {mode !== 'manual' && (
          <div className="flex flex-col xl:flex-row items-stretch gap-3">
            {/* Max Words Slider */}
            <div className="flex-1 min-w-[300px] bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="max-words-slider" className="text-sm font-medium text-slate-300">{t('generator.slider.maxWords')}</label>
                <span className="text-sm font-semibold text-amber-400">{t('generator.slider.words', { count: maxWords })}</span>
              </div>
              <input
                id="max-words-slider"
                type="range"
                min="20"
                max="100"
                step="5"
                value={maxWords}
                onChange={(e) => setMaxWords(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 dynamic-slider-gradient"
                ref={sliderRef}
                title="Adjust max words"
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-slate-500">{t('generator.slider.short')}</span>
                <span className="text-xs text-slate-500">{t('generator.slider.standard')}</span>
                <span className="text-xs text-slate-500">{t('generator.slider.long')}</span>
              </div>
            </div>

            {/* Greylist */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Greylist Words</label>
                <span className="text-[10px] text-slate-500 hidden sm:inline">Words to avoid during random generation</span>
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newGreylistWord}
                  onChange={(e) => setNewGreylistWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGreylistWord();
                    }
                  }}
                  placeholder="Add a word..."
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={handleAddGreylistWord}
                  disabled={!newGreylistWord.trim()}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                {greylist.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/50 text-[10px] text-slate-300 rounded-md"
                  >
                    {word}
                    <button
                      onClick={() => handleRemoveGreylistWord(word)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title={`Remove ${word}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* NightCafe Presets Dropdown */}
            <div className="flex-1 min-w-[200px] bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">NightCafe Preset</label>
              </div>
              <select
                value={selectedNightCafePreset}
                onChange={(e) => setSelectedNightCafePreset(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                aria-label="Select NightCafe Preset"
              >
                <option value="">No Preset</option>
                {PRESET_OPTIONS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Actions */}
            <div className="flex flex-row xl:flex-col justify-between gap-3 min-w-[140px]">
              <div className="group relative flex-1">
                <button
                  onClick={() => setAutoFillImprove(!autoFillImprove)}
                  className={`w-full h-full flex items-center justify-center gap-2 px-4 py-3 xl:py-0 border text-sm rounded-2xl transition-colors shadow-sm ${autoFillImprove
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                >
                  <Wand2 size={14} className={autoFillImprove ? "text-teal-400" : ""} />
                  <span className="inline-flex items-center gap-1">
                    <span>{t('generator.buttons.autoFill')}</span>
                    <span className="inline-block w-7 text-left">{autoFillImprove ? 'ON' : 'OFF'}</span>
                  </span>
                </button>
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] rounded border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 delay-150 pointer-events-none z-20 shadow-xl translate-x-1 group-hover:translate-x-0 hidden xl:block">
                  {autoFillImprove ? 'Automatically copies generated prompts to Improve tab' : 'Click to enable auto-copying prompts to Improve tab'}
                </div>
              </div>

              <div className="group relative flex-1">
                <button
                  onClick={handleClearAll}
                  className="w-full h-full flex items-center justify-center gap-2 px-4 py-3 xl:py-0 bg-slate-900 border border-slate-800 text-slate-400 text-sm rounded-2xl hover:bg-slate-800 hover:text-white hover:border-slate-700 transition-colors shadow-sm"
                >
                  <Eraser size={14} />
                  <span>{t('generator.buttons.clearAll')}</span>
                </button>
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-[10px] rounded border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 delay-150 pointer-events-none z-20 shadow-xl translate-x-1 group-hover:translate-x-0 hidden xl:block">
                  Clear all fields
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {mode === 'random' && (
        <RandomGenerator
          key={resetKey}
          onSwitchToGuided={handleSwitchToGuided}
          onSwitchToManual={handleSwitchToManual}
          onSaved={() => setSaveCount((c) => c + 1)}
          onRequestSavePrompt={handleRequestSavePrompt}
          onPromptGenerated={(prompt) => {
            setGuidedInitial(prompt);
            setRandomPrompt(prompt);
          }}
          onNegativePromptChanged={(neg) => {
            setRandomNegativePrompt(neg);
          }}
          maxWords={maxWords}
          greylist={greylist}
          initialPrompt={randomPrompt}
          initialNegativePrompt={randomNegativePrompt}
          onCheckExternalFields={handleCheckExternalFields}
          onAiAdviceTips={setAiAdviceTips}
          magicInputSlot={
            <MagicPromptInput
              className="h-full"
              onGenerate={(prompt, negativePrompt) => {
                setGuidedInitial(prompt);
                setRandomPrompt(prompt);
                if (negativePrompt) setRandomNegativePrompt(negativePrompt);
              }}
              maxWords={maxWords}
              greylist={greylist}
              onCheckBeforeGenerate={(proceed) => {
                const isLocalDirty = randomPrompt.trim().length > 0;
                handleCheckExternalFields(() => {
                  proceed();
                }, isLocalDirty, {
                  title: 'Do you want to proceed?',
                  message: 'All other fields will be cleared to make room for your new prompt.',
                  fullClear: false
                });
              }}
            />
          }
          recentPrompts={lastPrompts.slice(0, 3).map(p => p.content)}
        />
      )}

      {mode === 'guided' && (
        <GuidedBuilder
          key={guidedInitial}
          {...(guidedInitial && { initialPrompt: guidedInitial })}
          onSaved={() => setSaveCount((c) => c + 1)}
          onRequestSavePrompt={handleRequestSavePrompt}
          maxWords={maxWords}
          selectedNightCafePreset={selectedNightCafePreset}
          onAiAdviceTips={setAiAdviceTips}
        />
      )}

      {mode === 'manual' && (
        <ManualGenerator
          key={resetKey} // Force remount to read fresh storage/props
          resetKey={resetKey} // Explicit signal
          onSaved={() => setSaveCount((c) => c + 1)}
          onRequestSavePrompt={handleRequestSavePrompt}
          maxWords={maxWords}
          initialPrompts={manualInitial.prompts.length > 0 ? manualInitial.prompts : undefined}
          initialNegativePrompt={manualInitial.negative || undefined}
          selectedNightCafePreset={selectedNightCafePreset}
        />
      )}

      {mode === 'remix' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-400" />
              <h3 className="text-sm font-medium text-slate-300">{t('generator.remix.title', { defaultValue: 'Recent Prompts' })}</h3>
            </div>
            {lastPrompts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No prompts yet. Generate or save one first!
              </p>
            ) : (
              <div className="space-y-2">
                {lastPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handleSelectRemix(prompt)}
                    className="w-full flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-left hover:border-slate-700 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{prompt.title || 'Untitled'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{prompt.content}</p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 group-hover:text-amber-400 transition-colors flex-shrink-0 mt-1">
                      <span className="text-[10px]">{t('generator.buttons.remix')}</span>
                      <ArrowRight size={12} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {remixBase && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3">
              <p className="text-xs text-slate-500">Remixing:</p>
              <p className="text-xs text-slate-300 mt-1 italic truncate">{remixBase}</p>
            </div>
          )}
        </div>
      )}

      <AITools
        ref={aiToolsRef}
        onPromptGenerated={(prompt) => {
          setGuidedInitial(prompt);
          setMode('guided');
        }}
        onNegativePromptGenerated={(neg) => setRandomNegativePrompt(neg)}
        generatedPrompt={guidedInitial}
        generatedNegativePrompt={randomNegativePrompt}
        maxWords={maxWords}
        onSaved={() => setSaveCount((c) => c + 1)}
        onRequestSavePrompt={handleRequestSavePrompt}
        allowedTabs={['improve']}
        defaultTab="improve"
        showHeader={false}
        initialExpanded={true}
        availableModelTips={aiAdviceTips}
      />
      <Modal
        open={!!editingPromptData}
        onClose={() => setEditingPromptData(null)}
        title={editingPromptData?.id ? "Edit Prompt" : "Save Prompt"}
        wide
      >
        {editingPromptData && (
          <PromptEditor
            prompt={editingPromptData.id ? (editingPromptData as Prompt) : null}
            mode={editingPromptData.id ? 'edit' : 'save'}
            {...(!editingPromptData.id && { initialData: editingPromptData })}
            onSave={() => {
              setSaveCount((c) => c + 1);
              setEditingPromptData(null);
            }}
            onCancel={() => setEditingPromptData(null)}
          />
        )}
      </Modal>
      <ChoiceModal
        isOpen={showExternalClearModal}
        onClose={() => {
          setShowExternalClearModal(false);
          setPendingExternalAction(null);
        }}
        title={externalModalConfig.title || t('generator.modals.notEmptyTitle')}
        message={externalModalConfig.message || t('generator.modals.notEmptyMsg')}
        choices={[
          {
            label: t('generator.buttons.proceed'),
            onClick: async () => {
              if (externalModalConfig.fullClear !== false) {
                // Clear EVERYTHING before proceeding
                handleClearAll();
              } else {
                // Partial clear for Magic AI Expansion - keep MagicPromptInput intact
                if (aiToolsRef.current) {
                  aiToolsRef.current.clearContent();
                }
                setGuidedInitial('');
                setRandomPrompt('');
                if (mode !== 'manual') setRandomNegativePrompt('');
              }

              if (pendingExternalAction) await pendingExternalAction(false); // keepNegative = false
              setShowExternalClearModal(false);
              setPendingExternalAction(null);
            },
            variant: 'danger'
          }
        ]}
      />
      <ChoiceModal
        isOpen={!!similarPromptData}
        onClose={() => setSimilarPromptData(null)}
        title="Similar Prompt Detected"
        message={
          <div className="space-y-3">
            <p>A very similar prompt already exists in your library. What would you like to do?</p>
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-slate-300">Existing:</p>
              <p className="text-xs text-slate-400 mt-1">{similarPromptData?.existing.content}</p>
            </div>
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-amber-300">New:</p>
              <p className="text-xs text-amber-400 mt-1">{similarPromptData?.new.content}</p>
            </div>
          </div>
        }
        choices={[
          {
            label: "Edit Existing",
            onClick: () => {
              const existing = similarPromptData?.existing;
              setSimilarPromptData(null);
              if (existing) setEditingPromptData(existing);
            }
          },
          {
            label: "Save as New",
            onClick: () => {
              const newData = similarPromptData?.new;
              setSimilarPromptData(null);
              if (newData) setEditingPromptData(newData);
            },
            variant: "danger"
          }
        ]}
      />
    </div>
  );
}
