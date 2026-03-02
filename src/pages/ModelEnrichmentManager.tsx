import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2, Filter, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllEnrichments,
  triggerEnrichment,
  type ModelEnrichment,
} from '../lib/model-enrichment-service';
import { API_BASE_URL } from '../lib/constants';

type StatusFilter = 'all' | 'enriched' | 'pending' | 'not_on_hf' | 'error';

function StatusBadge({ status }: { status: ModelEnrichment['enrichment_status'] }) {
  switch (status) {
    case 'enriched':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
          <CheckCircle2 size={10} /> Enriched
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30">
          <Clock size={10} /> Pending
        </span>
      );
    case 'not_on_hf':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <XCircle size={10} /> Not on HF
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
          <AlertCircle size={10} /> Error
        </span>
      );
    default:
      return null;
  }
}

export default function ModelEnrichmentManager() {
  const [enrichments, setEnrichments] = useState<ModelEnrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichAllProgress, setEnrichAllProgress] = useState(0);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllEnrichments();
      setEnrichments(data);
    } catch (err) {
      toast.error('Failed to load enrichments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh(modelId: string) {
    setRefreshingId(modelId);
    try {
      await triggerEnrichment(modelId);
      toast.success(`Enriched: ${modelId}`);
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleEnrichAll() {
    setEnrichingAll(true);
    setEnrichAllProgress(0);
    try {
      const res = await fetch(`${API_BASE_URL}/api/models/enrich-all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const results: { modelId: string; status: string }[] = await res.json();
      const succeeded = results.filter(r => r.status === 'ok').length;
      setEnrichAllProgress(100);
      toast.success(`Enrich All complete: ${succeeded}/${results.length} succeeded`);
      await load();
    } catch (err) {
      toast.error(`Enrich All failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnrichingAll(false);
    }
  }

  const filtered = enrichments.filter(e =>
    statusFilter === 'all' ? true : e.enrichment_status === statusFilter
  );

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'enriched', label: 'Enriched' },
    { value: 'pending', label: 'Pending' },
    { value: 'not_on_hf', label: 'Not on HF' },
    { value: 'error', label: 'Error' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Model Enrichment Manager</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage HuggingFace enrichment data for NightCafe models
          </p>
        </div>

        <button
          onClick={handleEnrichAll}
          disabled={enrichingAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
        >
          {enrichingAll ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {enrichingAll ? 'Enriching…' : 'Enrich All'}
        </button>
      </div>

      {/* Progress bar shown while enriching all */}
      {enrichingAll && (
        <div className="mb-4 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${enrichAllProgress}%` }}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === opt.value
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} models</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading enrichments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          No enrichments found for the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">HF ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">❤️ Likes</th>
                <th className="px-4 py-3 text-left">⬇️ Downloads</th>
                <th className="px-4 py-3 text-left">Last Enriched</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filtered.map(row => (
                <tr key={row.nightcafe_model_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{row.nightcafe_model_id}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {row.hf_model_id ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.enrichment_status} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.hf_likes !== null ? row.hf_likes.toLocaleString() : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.hf_downloads !== null
                      ? row.hf_downloads >= 1000
                        ? `${(row.hf_downloads / 1000).toFixed(1)}K`
                        : row.hf_downloads.toLocaleString()
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {row.last_enriched_at
                      ? new Date(row.last_enriched_at).toLocaleString()
                      : <span className="text-slate-600">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRefresh(row.nightcafe_model_id)}
                      disabled={refreshingId === row.nightcafe_model_id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs transition-colors"
                    >
                      {refreshingId === row.nightcafe_model_id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <RefreshCw size={12} />}
                      Refresh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
