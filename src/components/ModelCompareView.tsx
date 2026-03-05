import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface CompareModel {
  id: string;
  name: string;
  type: 'Image' | 'Video' | 'Edit' | string;
  starRating: number;
  costRating: number;
  descriptionNl: string;
  capabilities: string[];
}

interface ModelCompareViewProps {
  allModels: CompareModel[];
  selectedModelIds: string[];
  onChangeSelected: (ids: string[]) => void;
  title?: string;
}

const MAX_COMPARE_MODELS = 4;
const MIN_COMPARE_MODELS = 2;

function clampStars(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

function renderStars(value: number): string {
  const stars = clampStars(value);
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`;
}

function renderCost(value: number): string {
  const level = Math.max(1, Math.min(5, Math.round(value || 1)));
  return '$'.repeat(level);
}

export default function ModelCompareView({
  allModels,
  selectedModelIds,
  onChangeSelected,
  title = 'Model Comparison',
}: ModelCompareViewProps) {
  const [search, setSearch] = useState('');

  const selectedModels = useMemo(
    () => selectedModelIds
      .map((id) => allModels.find((m) => m.id === id))
      .filter((m): m is CompareModel => !!m),
    [allModels, selectedModelIds]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const available = useMemo(
    () => allModels
      .filter((m) => !selectedModelIds.includes(m.id))
      .filter((m) => {
        if (!normalizedSearch) return true;
        return m.name.toLowerCase().includes(normalizedSearch);
      })
      .slice(0, 20),
    [allModels, normalizedSearch, selectedModelIds]
  );

  const addModel = (id: string) => {
    if (selectedModelIds.includes(id)) return;
    if (selectedModelIds.length >= MAX_COMPARE_MODELS) return;
    onChangeSelected([...selectedModelIds, id]);
  };

  const removeModel = (id: string) => {
    onChangeSelected(selectedModelIds.filter((x) => x !== id));
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h3 className="text-white text-lg font-semibold">{title}</h3>
          <p className="text-slate-400 text-xs">Selecteer {MIN_COMPARE_MODELS}-{MAX_COMPARE_MODELS} modellen om te vergelijken.</p>
        </div>
        {selectedModels.length > 0 && (
          <button
            onClick={() => onChangeSelected([])}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            Reset Compare
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek model om toe te voegen..."
          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
        />
        <div className="flex flex-wrap gap-2">
          {available.map((model) => (
            <button
              key={model.id}
              onClick={() => addModel(model.id)}
              disabled={selectedModelIds.length >= MAX_COMPARE_MODELS}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40"
            >
              <Plus size={12} />
              {model.name}
            </button>
          ))}
        </div>
      </div>

      {selectedModels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedModels.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300">
              {m.name}
              <button
                onClick={() => removeModel(m.id)}
                className="text-teal-200 hover:text-white"
                title={`Verwijder ${m.name} uit vergelijking`}
                aria-label={`Verwijder ${m.name} uit vergelijking`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedModels.length >= MIN_COMPARE_MODELS ? (
        <div className="overflow-auto border border-slate-800 rounded-xl">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Star Rating</th>
                <th className="px-3 py-2">Cost Rating</th>
                <th className="px-3 py-2">Dutch Description</th>
                <th className="px-3 py-2">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {selectedModels.map((model) => (
                <tr key={model.id} className="border-t border-slate-800 align-top">
                  <td className="px-3 py-3 text-white font-medium">{model.name}</td>
                  <td className="px-3 py-3 text-slate-200">{model.type}</td>
                  <td className="px-3 py-3 text-amber-300 whitespace-nowrap" title={`${model.starRating}/5`}>
                    {renderStars(model.starRating)}
                  </td>
                  <td className="px-3 py-3 text-emerald-300 whitespace-nowrap" title={`Level ${model.costRating}`}>
                    {renderCost(model.costRating)}
                  </td>
                  <td className="px-3 py-3 text-slate-300 min-w-[260px]">{model.descriptionNl}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {model.capabilities.length > 0 ? model.capabilities.map((cap) => (
                        <span key={cap} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {cap}
                        </span>
                      )) : (
                        <span className="text-xs text-slate-500">n/a</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Kies minimaal 2 modellen om de vergelijkingstabel te tonen.</p>
      )}
    </div>
  );
}
