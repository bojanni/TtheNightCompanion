import { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Shuffle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { generateRandomPromptAI } from '../lib/ai-service';
import { useTaskModels } from '../hooks/useTaskModels';

function parseTaskModel(taskModel: string): { provider: string; model: string } {
  const separatorIndex = taskModel.indexOf(':');
  if (separatorIndex === -1) {
    return { provider: 'unknown', model: taskModel };
  }

  return {
    provider: taskModel.slice(0, separatorIndex),
    model: taskModel.slice(separatorIndex + 1),
  };
}

export default function AIRandomGenerator() {
  const { generate: selectedTaskModel } = useTaskModels();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [theme, setTheme] = useState('');
  const [maxWords, setMaxWords] = useState(70);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => parseTaskModel(selectedTaskModel), [selectedTaskModel]);

  const generatePrompt = async () => {
    setLoading(true);
    try {
      const token = '';
      const result = await generateRandomPromptAI(
        token,
        theme.trim() || undefined,
        maxWords,
        undefined,
        'balanced',
        undefined,
        selectedTaskModel,
      );

      setPrompt(result.prompt || '');
      setNegativePrompt(result.negativePrompt || '');
      toast.success('Random prompt generated with selected AI model.');
    } catch (error) {
      console.error('Failed to generate AI random prompt:', error);
      toast.error('Failed to generate random prompt. Check AI configuration and try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async () => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      toast.error('Could not copy prompt to clipboard.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">AI Random Prompt Generator</h1>
        <p className="text-sm text-slate-400">
          Uses the active generation model from AI Configuration.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-semibold text-amber-300">
            Active Provider: {selected.provider}
          </span>
          <span className="inline-flex items-center rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-1 font-semibold text-teal-300">
            Model: {selected.model}
          </span>
        </div>

        <label className="block text-sm font-medium text-slate-300">
          Theme (optional)
          <input
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="e.g. ancient forest rituals"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-500/60"
          />
        </label>

        <label className="block text-sm font-medium text-slate-300">
          Max words: {maxWords}
          <input
            type="range"
            min={20}
            max={120}
            value={maxWords}
            onChange={(event) => setMaxWords(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={generatePrompt}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
            New Random Prompt
          </button>

          <Link
            to="/ai-config"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
          >
            <SlidersHorizontal size={16} />
            Open AI Configuration
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Generated Prompt</h2>
          <button
            onClick={copyPrompt}
            disabled={!prompt.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={7}
          placeholder="Click 'New Random Prompt' to generate..."
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500/60"
        />

        <label className="block text-sm font-medium text-slate-300">
          Negative prompt
          <textarea
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-amber-500/60"
          />
        </label>
      </div>
    </div>
  );
}
