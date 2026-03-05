import { useEffect, useState } from 'react';
import { Search, Zap, Filter, ArrowUpDown, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../lib/constants';
import { toast } from 'sonner';
import ModelCompareView, { type CompareModel } from '../components/ModelCompareView';
import { MODELS } from '../lib/models-data';
import { loadModelCompareSelection, saveModelCompareSelection } from '../lib/model-compare-storage';
import { useTranslation } from 'react-i18next';

interface NCModel {
  id: number;
  name: string;
  description: string;
  art_rating: number;
  prompting_rating: number;
  realism_rating: number;
  typography_rating: number;
  cost_level: number;
  model_type: 'Image' | 'Edit' | 'Video';
}

type SortField = 'name' | 'art_rating' | 'prompting_rating' | 'realism_rating' | 'typography_rating' | 'cost_level';
type SortOrder = 'asc' | 'desc';
type ModelTypeFilter = 'all' | 'Image' | 'Edit' | 'Video';

function StatBar({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-16 text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      <div className="flex-1 flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`${label}-${i}`}
            className={`h-1.5 flex-1 rounded-full ${i < value ? 'bg-emerald-400' : 'bg-slate-800'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function NCModels() {
  const { t } = useTranslation();
  const [models, setModels] = useState<NCModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<ModelTypeFilter>('all');
  const [costFilter, setCostFilter] = useState<{ min: number; max: number }>({ min: 1, max: 5 });
  
  // Sort states
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>(() => loadModelCompareSelection());

  const modelKey = (model: NCModel) => model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const toCompareModel = (model: NCModel): CompareModel => {
    const linked = MODELS.find((m) => m.name === model.name);
    const caps = new Set<string>();

    if (model.model_type === 'Image') caps.add('image generation');
    if (model.model_type === 'Edit') caps.add('image edit');
    if (model.model_type === 'Video') caps.add('video generation');
    if (model.typography_rating >= 4) caps.add('typography');
    if (model.realism_rating >= 4) caps.add('realism');
    if (model.prompting_rating >= 4) caps.add('prompt following');
    if (model.art_rating >= 4) caps.add('artistic quality');

    (linked?.bestFor || []).forEach((x) => caps.add(x));
    (linked?.styleTags || []).forEach((x) => caps.add(x));

    const avg = (model.art_rating + model.prompting_rating + model.realism_rating + model.typography_rating) / 4;

    return {
      id: modelKey(model),
      name: model.name,
      type: model.model_type,
      starRating: avg,
      costRating: model.cost_level,
      descriptionNl: model.description,
      capabilities: Array.from(caps).slice(0, 8),
    };
  };

  const compareModels = models.map(toCompareModel);

  // Fetch models from API with AbortController to prevent race conditions
  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchModels() {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        
        if (typeFilter !== 'all') params.append('type', typeFilter);
        if (costFilter.min > 1) params.append('min_cost', costFilter.min.toString());
        if (costFilter.max < 5) params.append('max_cost', costFilter.max.toString());
        if (searchTerm) params.append('search', searchTerm);
        params.append('sort_by', sortBy);
        params.append('sort_order', sortOrder);

        const res = await fetch(`${API_BASE_URL}/api/nc-models?${params}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error('Failed to fetch models');
        
        const data = await res.json();
        setModels(data);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Error fetching models:', err);
        setError('Failed to load models. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    // Debounce all filter changes
    const timer = setTimeout(fetchModels, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, typeFilter, costFilter, sortBy, sortOrder, syncTrigger]);

  useEffect(() => {
    saveModelCompareSelection(selectedCompareIds);
  }, [selectedCompareIds]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch(`${API_BASE_URL}/api/nc-models/sync`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync models');
      }
      
      if (data.inserted > 0 || data.updated > 0 || data.deleted > 0) {
        toast.success(`Sync compleet: ${data.inserted} toegevoegd, ${data.updated} bewerkt, ${data.deleted} verwijderd.`);
        setSyncTrigger(prev => prev + 1); // Trigger reload
      } else {
        toast.info('Geen wijzigingen gevonden. Modellen zijn up-to-date.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Fout bij synchroniseren van modellen.');
    } finally {
      setIsSyncing(false);
    }
  };

  const costStr = (level: number) => '$'.repeat(level);
  const isPro = (level: number) => level >= 4;

  const toggleCompare = (model: NCModel) => {
    const id = modelKey(model);
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast.info(t('modelCompare.maxReached', 'You can compare up to 4 models at once.'));
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            NightCafe Models <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-medium ml-2">{models.length} available</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Comprehensive guide to all available models and their capabilities.</p>
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Sync
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">Type:</span>
        </div>
        
        {(['all', 'Image', 'Edit', 'Video'] as ModelTypeFilter[]).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              typeFilter === type 
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {type === 'all' ? 'All' : type}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-700 mx-2" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Cost:</span>
          <select 
            value={costFilter.max}
            onChange={(e) => setCostFilter({ ...costFilter, max: parseInt(e.target.value) })}
            title="Filter models by cost"
            aria-label="Filter models by cost"
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500/50"
          >
            <option value={5}>Any</option>
            <option value={1}>$</option>
            <option value={2}>$$</option>
            <option value={3}>$$$</option>
            <option value={4}>$$$$</option>
          </select>
        </div>

        <div className="w-px h-6 bg-slate-700 mx-2" />

        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-slate-500" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            title="Sort models"
            aria-label="Sort models"
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500/50"
          >
            <option value="name">Name</option>
            <option value="art_rating">Art</option>
            <option value="prompting_rating">Prompting</option>
            <option value="realism_rating">Realism</option>
            <option value="typography_rating">Typography</option>
            <option value="cost_level">Cost</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown size={12} className={`text-slate-400 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-teal-500 animate-spin" />
          <span className="ml-3 text-slate-400">Loading models...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-20 text-red-400 gap-3">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Models Grid */}
      {!loading && !error && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {models.map((model) => {
            const compareId = modelKey(model);
            const isSelectedForCompare = selectedCompareIds.includes(compareId);
            return (
            <div key={model.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors group flex flex-col h-full">
              {/* Image Header */}
              <div className="h-32 bg-slate-800 relative overflow-hidden shrink-0">
                <div className="absolute inset-x-0 top-0 h-full opacity-60 mix-blend-overlay">
                  <div className={`w-full h-full bg-gradient-to-br ${
                    model.model_type === 'Video' ? 'from-purple-900 to-slate-900' :
                    model.model_type === 'Edit' ? 'from-blue-900 to-slate-900' :
                    'from-slate-700 to-slate-900'
                  }`} />
                </div>

                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px]" />

                <div className="absolute top-2 left-2 flex gap-1">
                  {model.name.toLowerCase().includes('fast') || model.name.toLowerCase().includes('turbo') || model.name.toLowerCase().includes('lightning') || model.name.toLowerCase().includes('schnell') ? (
                    <span className="px-1.5 py-0.5 bg-amber-500/90 text-[9px] font-bold text-white rounded shadow-sm flex items-center gap-0.5 uppercase tracking-wider backdrop-blur-md">
                      <Zap size={8} className="fill-white" /> Fast
                    </span>
                  ) : null}
                  {isPro(model.cost_level) && (
                    <span className="px-1.5 py-0.5 bg-pink-600/90 text-[9px] font-bold text-white rounded shadow-sm uppercase tracking-wider backdrop-blur-md">
                      Pro Model
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold text-white rounded shadow-sm uppercase tracking-wider backdrop-blur-md ${
                    model.model_type === 'Video' ? 'bg-purple-600/90' :
                    model.model_type === 'Edit' ? 'bg-blue-600/90' :
                    'bg-teal-600/90'
                  }`}>
                    {model.model_type}
                  </span>
                </div>

                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3 pt-8">
                  <h3 className="text-white font-bold text-sm leading-tight drop-shadow-md">{model.name}</h3>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed flex-1">
                  {model.description}
                </p>

                <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-800/50">
                  <StatBar label="Art" value={model.art_rating} />
                  <StatBar label="Prompting" value={model.prompting_rating} />
                  <StatBar label="Realism" value={model.realism_rating} />
                  <StatBar label="Typography" value={model.typography_rating} />
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Cost:</span>
                    <span className={`text-xs font-bold tracking-widest ${
                      model.cost_level === 1 ? 'text-teal-400' :
                      model.cost_level >= 4 ? 'text-rose-400' :
                      model.cost_level === 3 ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {costStr(model.cost_level)}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleCompare(model)}
                    title={isSelectedForCompare ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                      isSelectedForCompare
                        ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isSelectedForCompare ? t('modelCompare.compared', 'Compared') : t('modelCompare.compare', 'Compare')}
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>

        <ModelCompareView
          allModels={compareModels}
          selectedModelIds={selectedCompareIds}
          onChangeSelected={setSelectedCompareIds}
          title={t('modelCompare.nightCafeTitle', 'Compare NightCafe Models')}
        />
        </>
      )}

      {/* Empty State */}
      {!loading && !error && models.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Search size={32} className="opacity-20" />
          <p>No models found matching your criteria</p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('all');
              setCostFilter({ min: 1, max: 5 });
            }}
            className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
