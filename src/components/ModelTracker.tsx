import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Trophy, TrendingUp, BarChart3,
  Save, Loader2, CheckCircle2,
} from 'lucide-react';
import { db } from '../lib/api';
import { MODELS, CATEGORY_OPTIONS, type ModelInfo } from '../lib/models-data';
import { useNCModels } from '../hooks/useNCModels';
import type { GalleryItem } from '../lib/types';
import StarRating from './StarRating';

// Define interfaces before component
interface UsageEntry {
  id: string;
  model_id: string;
  prompt_used: string;
  category: string;
  rating: number;
  is_keeper: boolean;
  notes: string;
  created_at: string;
}

interface ModelStats {
  model: ModelInfo;
  totalUses: number;
  avgRating: number;
  keeperRate: number;
  keepers: number;
  topCategory: string;
}

export default function ModelTracker() {
  const ncModelsQuery = useNCModels();
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formModelId, setFormModelId] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formRating, setFormRating] = useState(0);
  const [formKeeper, setFormKeeper] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  const modelsForDropdown = ncModelsQuery.data ?? MODELS;

  const findModelId = useCallback((modelNameOrId: string): string => {
    if (!modelNameOrId) return '';
    // Check if it's already a valid ID
    const directMatch = modelsForDropdown.find(m => m.id === modelNameOrId);
    if (directMatch) return directMatch.id;

    // Check if it's a name
    const nameMatch = modelsForDropdown.find(m => m.name.toLowerCase() === modelNameOrId.toLowerCase());
    if (nameMatch) return nameMatch.id;

    // Try partial match on name
    const partialMatch = modelsForDropdown.find(m => m.name.toLowerCase().includes(modelNameOrId.toLowerCase()));
    if (partialMatch) return partialMatch.id;

    return '';
  }, [modelsForDropdown]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, galleryRes] = await Promise.all([
        db
          .from('model_usage')
          .select('*')
          .order('created_at', { ascending: false }),
        db
          .from('gallery_items')
          .select('*')
          .neq('model', null) // Only items with a model
          .order('created_at', { ascending: false })
      ]);

      const usageData = (usageRes.data as UsageEntry[]) ?? [];
      const galleryData = (galleryRes.data as GalleryItem[]) ?? [];

      // Convert gallery items to UsageEntry format
      const galleryEntries: UsageEntry[] = galleryData.map((item) => {
        // Try to find model ID from name if stored as name
        const modelId = findModelId(item.model || '');

        return {
          id: `gallery-${item.id}`, // Prefix to avoid collision
          model_id: modelId,
          prompt_used: item.prompt_used || '',
          category: 'gallery', // Default category for gallery items
          rating: item.rating || 0,
          is_keeper: true, // Gallery items are keepers by definition
          notes: item.notes || '',
          created_at: item.created_at
        };
      }).filter(e => e.model_id); // Filter out items where model couldn't be identified

      // Merge and sort
      const allEntries = [...usageData, ...galleryEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEntries(allEntries);
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  }, [findModelId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handleSave() {
    if (!formModelId) return;
    setSaving(true);
    await db.from('model_usage').insert({
      model_id: formModelId,
      prompt_used: formPrompt,
      category: formCategory,
      rating: formRating,
      is_keeper: formKeeper,
      notes: formNotes,
    });
    setSaving(false);
    setShowForm(false);
    resetForm();
    loadEntries();
  }

  function resetForm() {
    setFormModelId('');
    setFormPrompt('');
    setFormCategory('general');
    setFormRating(0);
    setFormKeeper(false);
    setFormNotes('');
  }

  async function handleDelete(id: string) {
    await db.from('model_usage').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const stats: ModelStats[] = useMemo(() => {
    const grouped = new Map<string, UsageEntry[]>();
    entries.forEach((e) => {
      const arr = grouped.get(e.model_id) ?? [];
      arr.push(e);
      grouped.set(e.model_id, arr);
    });

    return Array.from(grouped.entries())
      .map(([modelId, uses]) => {
        const model = modelsForDropdown.find((m) => m.id === modelId);
        if (!model) return null;

        const rated = uses.filter((u) => u.rating > 0);
        const keepers = uses.filter((u) => u.is_keeper);
        const avgRating = rated.length > 0
          ? rated.reduce((sum, u) => sum + u.rating, 0) / rated.length
          : 0;
        const keeperRate = uses.length > 0 ? (keepers.length / uses.length) * 100 : 0;

        const catCount = new Map<string, number>();
        uses.forEach((u) => catCount.set(u.category, (catCount.get(u.category) ?? 0) + 1));
        const topCategory = catCount.size > 0
          ? Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general'
          : 'general';

        return {
          model,
          totalUses: uses.length,
          avgRating,
          keeperRate,
          keepers: keepers.length,
          topCategory,
        } as ModelStats;
      })
      .filter((s): s is ModelStats => s !== null)
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [entries, modelsForDropdown]);

  const bestModel = stats[0] ?? null;
  const mostUsed = [...stats].sort((a, b) => b.totalUses - a.totalUses)[0] ?? null;
  const bestKeeper = [...stats].sort((a, b) => b.keeperRate - a.keeperRate)[0] ?? null;

  function getModelName(id: string): string {
    return modelsForDropdown.find((m) => m.id === id)?.name ?? id;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bestModel && (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Highest Rated</span>
              </div>
              <p className="text-base font-semibold text-white">{bestModel.model.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Avg {bestModel.avgRating.toFixed(1)} stars across {bestModel.totalUses} uses
              </p>
            </div>
          )}
          {mostUsed && (
            <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border border-teal-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} className="text-teal-400" />
                <span className="text-xs text-teal-400 font-medium">Most Used</span>
              </div>
              <p className="text-base font-semibold text-white">{mostUsed.model.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {mostUsed.totalUses} generations, mainly {mostUsed.topCategory || 'general'}
              </p>
            </div>
          )}
          {bestKeeper && (
            <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-rose-400" />
                <span className="text-xs text-rose-400 font-medium">Best Keeper Rate</span>
              </div>
              <p className="text-base font-semibold text-white">{bestKeeper.model.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {bestKeeper.keeperRate.toFixed(0)}% keepers ({bestKeeper.keepers}/{bestKeeper.totalUses})
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-400">
          {stats.length > 0 ? 'Performance by Model' : 'Track Your Model Usage'}
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus size={13} />
          Log Result
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model</label>
              <select
                aria-label="Select Model"
                value={formModelId}
                onChange={(e) => setFormModelId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              >
                <option value="">Select model...</option>
                {modelsForDropdown.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                aria-label="Select Category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Prompt Used</label>
            <textarea
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
              placeholder="The prompt you used..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none resize-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rating</label>
              <StarRating rating={formRating} onChange={setFormRating} size={18} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={formKeeper}
                onChange={(e) => setFormKeeper(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <CheckCircle2 size={14} className={formKeeper ? 'text-emerald-400' : 'text-slate-500'} />
              <span className="text-sm text-slate-300">Keeper</span>
            </label>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any observations..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formModelId}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>
      )}

      {stats.length > 0 ? (
        <div className="space-y-3">
          {stats.map(({ model, totalUses, avgRating, keeperRate, keepers, topCategory }) => (
            <div
              key={model.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">{model.name}</h4>
                  <p className="text-[10px] text-slate-500">{model.provider}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{avgRating.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">avg rating</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Uses</div>
                  <div className="text-sm font-medium text-white">{totalUses}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Keepers</div>
                  <div className="text-sm font-medium text-emerald-400">
                    {keepers} ({keeperRate.toFixed(0)}%)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Best for</div>
                  <div className="text-sm font-medium text-amber-400">{topCategory}</div>
                </div>
              </div>
              <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${keeperRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No usage data yet. Log your first result to start tracking.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Recent Entries</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {entries.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 bg-slate-900/50 border border-slate-800/50 rounded-lg group text-xs"
              >
                <span className="font-medium text-slate-300 w-28 flex-shrink-0 truncate">
                  {getModelName(entry.model_id)}
                </span>
                <span className="text-slate-500 w-20 flex-shrink-0">{entry.category}</span>
                <StarRating rating={entry.rating} size={10} />
                {entry.is_keeper && (
                  <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                )}
                <span className="text-slate-500 truncate flex-1">{entry.prompt_used || entry.notes || ''}</span>
                <button
                  title="Delete entry"
                  onClick={() => handleDelete(entry.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
