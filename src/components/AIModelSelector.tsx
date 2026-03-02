import React, { useMemo, useState } from 'react';
import { Search, Cloud, Server, Info, CheckCircle2, Eye, BookOpen, Sparkles, Wand2, RefreshCw, AlertTriangle } from 'lucide-react';
import { AI_PROVIDER_MODELS, getModelById } from '../lib/ai-provider-models';
import type { TaskType, AIProviderModel } from '../lib/ai-provider-models';
import type { NormalizedModel } from '../lib/provider-models-service';
import { COST_TIER_LABELS, formatTimeAgo } from '../lib/provider-models-service';

interface AIModelSelectorProps {
    task: TaskType;
    value: string;
    onChange: (id: string) => void;
    availableProviders?: string[];
    onlyAvailable?: boolean;
    /** Live models from useProviderModels hook — optional, falls back to static list */
    liveModels?: Record<string, NormalizedModel[]>;
    liveLoading?: boolean;
    liveLastUpdated?: Date | null;
    onRefresh?: () => void;
    onRefreshProvider?: (provider: string) => Promise<void>;
}

// ── Task recommendation badges ──────────────────────────────────────────────
const TASK_META: Record<TaskType, { label: string; icon: typeof Sparkles; color: string }> = {
    generate: { label: 'Generation', icon: Sparkles, color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
    improve: { label: 'Improvement', icon: Wand2, color: 'text-teal-400   bg-teal-500/10   border-teal-500/20' },
    vision: { label: 'Vision', icon: Eye, color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
    research: { label: 'Research', icon: BookOpen, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

// Badge colours
const BADGE_COLORS: Record<string, string> = {
    Best: 'bg-amber-500/20   text-amber-400   border-amber-500/30',
    Fast: 'bg-blue-500/20    text-blue-400    border-blue-500/30',
    Budget: 'bg-green-500/20   text-green-400   border-green-500/30',
    Local: 'bg-slate-600/30   text-slate-300   border-slate-600/30',
};

const CAPABILITY_BADGES: Record<string, { label: string; icon: string; color: string; title: string }> = {
    text: { label: 'Text', icon: '📝', color: 'bg-gray-100 text-gray-700', title: 'Dit model ondersteunt tekst-input en tekst-output' },
    vision: { label: 'Vision', icon: '👁️', color: 'bg-blue-100 text-blue-700', title: 'Dit model ondersteunt afbeeldingen als input' },
    reasoning: { label: 'Reasoning', icon: '🧠', color: 'bg-purple-100 text-purple-700', title: 'Dit model ondersteunt (expliciete) reasoning' },
    web_search: { label: 'Web Search', icon: '🔍', color: 'bg-green-100 text-green-700', title: 'Dit model kan online/web search gebruiken' },
    code: { label: 'Code', icon: '💻', color: 'bg-yellow-100 text-yellow-700', title: 'Dit model is geoptimaliseerd voor code' },
    audio: { label: 'Audio', icon: '🎙️', color: 'bg-orange-100 text-orange-700', title: 'Dit model ondersteunt audio als input of output' },
    video: { label: 'Video', icon: '🎬', color: 'bg-red-100 text-red-700', title: 'Dit model ondersteunt video als input of output' },
};

function CapabilityBadges({ capabilities }: { capabilities: string[] | undefined | null }) {
    if (!capabilities || capabilities.length === 0) return null;
    const unique = Array.from(new Set(capabilities));
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {unique.map((c) => {
                const meta = CAPABILITY_BADGES[c];
                if (!meta) return null;
                return (
                    <span
                        key={c}
                        title={meta.title}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${meta.color}`}
                    >
                        <span className="text-[10px] leading-none">{meta.icon}</span>
                        {meta.label}
                    </span>
                );
            })}
        </div>
    );
}

// Provider colour dots
const PROVIDER_DOTS: Record<string, string> = {
    openai: 'bg-emerald-400',
    anthropic: 'bg-orange-400',
    google: 'bg-blue-400',
    gemini: 'bg-blue-400',
    openrouter: 'bg-violet-400',
    together: 'bg-pink-400',
    groq: 'bg-cyan-400',
    mistral: 'bg-orange-300',
    cohere: 'bg-teal-400',
    deepinfra: 'bg-rose-400',
    perplexity: 'bg-indigo-400',
    ollama: 'bg-purple-400',
    lmstudio: 'bg-pink-400',
};

function ProviderBadge({ provider, label }: { provider: string; label: string }) {
    const dot = PROVIDER_DOTS[provider] ?? 'bg-slate-400';
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/40">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    );
}

function TaskPill({ task }: { task: TaskType }) {
    const meta = TASK_META[task];
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${meta.color}`}>
            <Icon size={9} />
            {meta.label}
        </span>
    );
}

// ── Static model row ─────────────────────────────────────────────────────────
function ModelRow({
    model, isSelected, isRecommended, onClick,
}: {
    model: AIProviderModel;
    isSelected: boolean;
    isRecommended: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all border
                ${isSelected
                    ? 'bg-slate-800 border-teal-500/50 shadow-[0_0_12px_-3px_rgba(20,184,166,0.2)]'
                    : 'bg-transparent border-transparent hover:bg-slate-800/60 hover:border-slate-700'
                }
                ${!isRecommended ? 'opacity-60 hover:opacity-90' : ''}
            `}
        >
            {/* Cost column */}
            <div className="flex-none w-28 text-right">
                {model.costIn ? (
                    <>
                        <p className="text-[10px] text-slate-500 font-mono">In: <span className="text-slate-300">{model.costIn}</span></p>
                        <p className="text-[10px] text-slate-500 font-mono">Out: <span className="text-slate-300">{model.costOut}</span></p>
                    </>
                ) : (
                    <p className="text-[10px] text-emerald-400 font-mono font-bold">Free</p>
                )}
            </div>

            <div className="self-stretch w-px bg-slate-700/50 flex-none mt-1" />

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{model.name}</span>
                        {isSelected && <CheckCircle2 size={13} className="text-teal-400 flex-none" />}
                        {model.badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLORS[model.badge]}`}>{model.badge}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <ProviderBadge provider={model.provider} label={model.providerLabel ?? model.provider} />
                    {model.recommendedFor.map(t => <TaskPill key={t} task={t} />)}
                </div>

                <CapabilityBadges capabilities={model.capabilities} />

                {model.description && (
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{model.description}</p>
                )}

                {model.infoUrl && (
                    <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); window.open(model.infoUrl, '_blank', 'noopener,noreferrer'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') window.open(model.infoUrl, '_blank', 'noopener,noreferrer'); }}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors mt-1 cursor-pointer"
                    >
                        <Info size={10} /> More info
                    </span>
                )}
            </div>
        </button>
    );
}

// ── Live model row ───────────────────────────────────────────────────────────
function LiveModelRow({
    model, isSelected, task, staticMeta, onClick,
}: {
    model: NormalizedModel;
    isSelected: boolean;
    task: TaskType;
    staticMeta: AIProviderModel | undefined;
    onClick: () => void;
}) {
    const costTierInfo = COST_TIER_LABELS[model.costTier];

    // Use static metadata for badge/description/recommendedFor if available, else derive from live data
    const badge = staticMeta?.badge;
    const description = staticMeta?.description ?? (model.capabilities.join(', '));
    const recommendedFor = staticMeta?.recommendedFor ?? [];
    const infoUrl = staticMeta?.infoUrl;

    const isVisionTask = task === 'vision';
    const hasVision = model.capabilities.includes('vision');
    if (isVisionTask && !hasVision) return null; // Filter vision-incapable when task=vision

    const isRecommended = recommendedFor.includes(task) ||
        (task === 'vision' && hasVision) ||
        (task === 'research' && model.capabilities.includes('web_search'));

    const isFree = model.costTier === 'free';

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all border
                ${isSelected
                    ? 'bg-slate-800 border-teal-500/50 shadow-[0_0_12px_-3px_rgba(20,184,166,0.2)]'
                    : 'bg-transparent border-transparent hover:bg-slate-800/60 hover:border-slate-700'
                }
                ${!isRecommended ? 'opacity-60 hover:opacity-90' : ''}
                ${!model.isAvailable ? 'opacity-40' : ''}
            `}
        >
            {/* Cost column */}
            <div className="flex-none w-28 text-right self-start pt-0.5">
                {isFree ? (
                    <p className="text-[10px] text-emerald-400 font-mono font-bold">Free</p>
                ) : model.pricing ? (
                    <>
                        <p className="text-[10px] text-slate-500 font-mono">
                            In: <span className="text-slate-300">${(parseFloat(model.pricing.prompt) * 1_000_000).toFixed(2)}/1M</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                            Out: <span className="text-slate-300">${(parseFloat(model.pricing.completion) * 1_000_000).toFixed(2)}/1M</span>
                        </p>
                    </>
                ) : (
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${costTierInfo?.color ?? 'text-slate-500'}`}>
                        {costTierInfo?.label ?? '?'}
                    </span>
                )}
            </div>

            <div className="self-stretch w-px bg-slate-700/50 flex-none mt-1" />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{model.name}</span>
                    {isSelected && <CheckCircle2 size={13} className="text-teal-400 flex-none" />}
                    {!model.isAvailable && (
                        <span title="No API key configured" className="flex-none">
                            <AlertTriangle size={12} className="text-amber-400" />
                        </span>
                    )}
                    {badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLORS[badge]}`}>{badge}</span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <ProviderBadge provider={model.provider} label={model.provider} />
                    {recommendedFor.map(t => <TaskPill key={t} task={t} />)}
                    {task === 'vision' && hasVision && !recommendedFor.includes('vision') && <TaskPill task="vision" />}
                    {task === 'research' && model.capabilities.includes('web_search') && !recommendedFor.includes('research') && <TaskPill task="research" />}
                </div>

                <CapabilityBadges capabilities={model.capabilities} />

                {description && (
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{description}</p>
                )}

                {infoUrl && (
                    <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); window.open(infoUrl, '_blank', 'noopener,noreferrer'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') window.open(infoUrl, '_blank', 'noopener,noreferrer'); }}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors mt-1 cursor-pointer"
                    >
                        <Info size={10} /> More info
                    </span>
                )}
            </div>
        </button>
    );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AIModelSelector({
    task,
    value,
    onChange,
    availableProviders = [],
    onlyAvailable = false,
    liveModels,
    liveLoading = false,
    liveLastUpdated,
    onRefresh,
    onRefreshProvider,
}: AIModelSelectorProps) {
    const [search, setSearch] = useState('');
    const [capFilter, setCapFilter] = useState<'all' | 'vision' | 'reasoning' | 'audio' | 'video' | 'web_search' | 'code'>('all');

    const hasLive = liveModels && Object.keys(liveModels).length > 0;

    // ── Static models (fallback) ──────────────────────────────────────────────
    const { cloudModels, localModels } = useMemo(() => {
        if (hasLive) return { cloudModels: [], localModels: [] };

        let all = [...AI_PROVIDER_MODELS];
        if (onlyAvailable && availableProviders.length > 0) {
            all = all.filter(m => availableProviders.includes(m.provider));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            all = all.filter(m =>
                m.name.toLowerCase().includes(q) ||
                m.provider.toLowerCase().includes(q) ||
                (m.description ?? '').toLowerCase().includes(q) ||
                m.recommendedFor.some(t => t.includes(q))
            );
        }

        if (capFilter !== 'all') {
            all = all.filter(m => m.capabilities.includes(capFilter));
        }
        all.sort((a, b) => {
            const aRec = a.recommendedFor.includes(task);
            const bRec = b.recommendedFor.includes(task);
            if (aRec && !bRec) return -1;
            if (!aRec && bRec) return 1;
            return 0;
        });
        return {
            cloudModels: all.filter(m => !['ollama', 'lmstudio'].includes(m.provider)),
            localModels: all.filter(m => ['ollama', 'lmstudio'].includes(m.provider)),
        };
    }, [search, task, availableProviders, onlyAvailable, hasLive, capFilter]);

    // ── Live models (grouped) ─────────────────────────────────────────────────
    const liveGroups = useMemo(() => {
        if (!hasLive || !liveModels) return {};
        const q = search.toLowerCase().trim();

        const groups: Record<string, NormalizedModel[]> = {};
        for (const [provider, models] of Object.entries(liveModels)) {
            let filtered = task === 'vision'
                ? models.filter(m => m.capabilities.includes('vision'))
                : models;

            if (capFilter !== 'all') {
                filtered = filtered.filter(m => m.capabilities.includes(capFilter));
            }

            if (q) {
                filtered = filtered.filter(m =>
                    m.name.toLowerCase().includes(q) ||
                    m.provider.toLowerCase().includes(q) ||
                    m.capabilities.some(c => c.includes(q))
                );
            }

            if (filtered.length > 0) groups[provider] = filtered;
        }
        return groups;
    }, [liveModels, search, task, hasLive, capFilter]);

    const currentModel = getModelById(value);
    const totalLive = Object.values(liveGroups).reduce((s, ms) => s + ms.length, 0);

    function renderStaticSection(label: string, icon: React.ReactNode, models: AIProviderModel[]) {
        if (models.length === 0) return null;
        return (
            <div>
                <div className="flex items-center gap-2 px-2 mb-2">
                    {icon}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                </div>
                <div className="space-y-1">
                    {models.map(model => (
                        <ModelRow
                            key={model.id}
                            model={model}
                            isSelected={value === model.id}
                            isRecommended={model.recommendedFor.includes(task)}
                            onClick={() => onChange(model.id)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">

            {/* Selected model chip */}
            {currentModel && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl">
                    <CheckCircle2 size={14} className="text-teal-400 flex-none" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{currentModel.name}</p>
                        <p className="text-[10px] text-slate-400">{currentModel.providerLabel ?? currentModel.provider}</p>
                    </div>
                    {currentModel.costIn && (
                        <div className="text-right text-[10px] font-mono text-slate-400 flex-none">
                            <p>In: {currentModel.costIn}</p>
                            <p>Out: {currentModel.costOut}</p>
                        </div>
                    )}
                    {currentModel.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-none ${BADGE_COLORS[currentModel.badge]}`}>
                            {currentModel.badge}
                        </span>
                    )}
                </div>
            )}

            {/* Panel */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl overflow-hidden">
                {/* Search + Refresh bar */}
                <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 flex-1">
                        <Search size={13} className="text-slate-500 flex-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search models..."
                            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                        />
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={liveLoading}
                            title="Refresh all providers"
                            className="flex-none p-2 rounded-xl border border-slate-700/50 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                        >
                            <RefreshCw size={13} className={liveLoading ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>

                {/* Capability filter pills */}
                <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-900/40 flex items-center gap-2 flex-wrap">
                    {(
                        [
                            { id: 'all' as const, label: 'All' },
                            { id: 'vision' as const, label: 'Vision' },
                            { id: 'reasoning' as const, label: 'Reasoning' },
                            { id: 'audio' as const, label: 'Audio' },
                            { id: 'video' as const, label: 'Video' },
                            { id: 'web_search' as const, label: 'Web Search' },
                            { id: 'code' as const, label: 'Code' },
                        ]
                    ).map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setCapFilter(p.id)}
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors
                                ${capFilter === p.id
                                    ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                    : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:text-slate-200 hover:border-slate-600/60'
                                }`}
                            title={p.id === 'all' ? 'Toon alle modellen' : `Filter op capability: ${p.label}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Live status bar */}
                {hasLive && liveLastUpdated && (
                    <div className="px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/60 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-none animate-pulse" />
                        <span className="text-[10px] text-slate-500">
                            Live data · Updated {formatTimeAgo(liveLastUpdated.toISOString())}
                            {' · '}{totalLive} models
                        </span>
                    </div>
                )}

                {/* Model lists */}
                <div className="p-3 space-y-5 max-h-[520px] overflow-y-auto custom-scrollbar">
                    {hasLive ? (
                        // Live groups by provider
                        Object.entries(liveGroups).length === 0 ? (
                            <p className="text-center text-slate-500 text-xs py-4">No models match your search</p>
                        ) : (
                            Object.entries(liveGroups).map(([provider, models]) => (
                                <div key={provider}>
                                    <div className="flex items-center gap-2 px-2 mb-2">
                                        <span className={`w-2 h-2 rounded-full flex-none ${PROVIDER_DOTS[provider] ?? 'bg-slate-400'}`} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex-1">
                                            {provider}
                                        </span>
                                        {onRefreshProvider && (
                                            <button
                                                onClick={() => onRefreshProvider(provider)}
                                                className="text-slate-600 hover:text-slate-400 transition-colors"
                                                title={`Refresh ${provider}`}
                                            >
                                                <RefreshCw size={10} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {models.map(m => (
                                            <LiveModelRow
                                                key={m.id}
                                                model={m}
                                                isSelected={value === m.id}
                                                task={task}
                                                staticMeta={getModelById(m.id)}
                                                onClick={() => onChange(m.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        // Static fallback
                        <>
                            {renderStaticSection('Cloud Providers', <Cloud size={12} className="text-slate-500" />, cloudModels)}
                            {renderStaticSection('Local Models', <Server size={12} className="text-slate-500" />, localModels)}
                            {cloudModels.length === 0 && localModels.length === 0 && (
                                <p className="text-center text-slate-500 text-xs py-4">No models match your search</p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
