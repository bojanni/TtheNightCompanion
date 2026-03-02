import { useState, useEffect, useRef, forwardRef } from 'react';
import { ChevronDown, Search, Info, CheckCircle2, Sparkles, Wand2, Eye, BookOpen } from 'lucide-react';
import { getModelById } from '../lib/ai-provider-models';
import type { TaskType } from '../lib/ai-provider-models';
import Modal from './Modal';

// ── Types ────────────────────────────────────────────────────────────────────
interface ModelOption {
    id: string;
    name: string;
    description?: string;
    provider: string;
    pricing?: {
        prompt: string;
        completion: string;
        image?: string;
        request?: string;
    };
    capabilities?: string[];
}

interface ProviderInfo {
    id: string;
    name: string;
    type: 'local' | 'cloud';
}

interface ModelSelectorProps {
    value: string;
    onChange: (modelId: string, providerId: string) => void;
    models: ModelOption[];
    providers: ProviderInfo[];
    className?: string;
    placeholder?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(priceStr: string | undefined): string {
    if (!priceStr) return '';
    const price = parseFloat(priceStr);
    if (isNaN(price)) return '';
    const perMillion = price * 1_000_000;
    if (perMillion < 0.01) return '<$0.01/1M';
    return `$${perMillion.toFixed(2)}/1M`;
}

// Provider dot colours
const PROVIDER_DOTS: Record<string, string> = {
    openai: 'bg-emerald-400',
    anthropic: 'bg-orange-400',
    google: 'bg-blue-400',
    gemini: 'bg-blue-400',
    openrouter: 'bg-violet-400',
    together: 'bg-pink-400',
    deepinfra: 'bg-rose-400',
    ollama: 'bg-purple-400',
    lmstudio: 'bg-pink-400',
};

function providerDot(providerId: string) {
    return PROVIDER_DOTS[providerId] ?? 'bg-slate-400';
}

// Badge colours matching AIModelSelector
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

// Task pill meta
const TASK_META: Record<TaskType, { label: string; icon: typeof Sparkles; color: string }> = {
    generate: { label: 'Generation', icon: Sparkles, color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
    improve: { label: 'Improvement', icon: Wand2, color: 'text-teal-400   bg-teal-500/10   border-teal-500/20' },
    vision: { label: 'Vision', icon: Eye, color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
    research: { label: 'Research', icon: BookOpen, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

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

// ── Model Item ─────────────────────────────────────────────────────────────
const ModelItem = forwardRef<HTMLDivElement, {
    model: ModelOption;
    providerName: string | undefined;
    isSelected: boolean;
    isActive: boolean;
    onSelect: () => void;
    onShowMore: () => void;
}>(({ model, providerName, isSelected, isActive, onSelect, onShowMore }, ref) => {
    // Cross-reference static metadata (badge, description, recommendedFor, infoUrl)
    // Try both "provider:id" and bare "id" to support OpenRouter dynamic models
    const knownMeta = getModelById(model.id);

    const description = knownMeta?.description ?? model.description;
    const badge = knownMeta?.badge;
    const recommendedFor = knownMeta?.recommendedFor ?? [];
    const infoUrl = knownMeta?.infoUrl;

    const capabilities = model.capabilities;

    const costIn = formatPrice(model.pricing?.prompt);
    const costOut = formatPrice(model.pricing?.completion);
    const isFree = model.id.includes(':free') || model.id.includes('free');
    const dot = providerDot(model.provider);

    return (
        <div
            ref={ref}
            role="option"
            aria-selected={isSelected}
            onClick={onSelect}
            className={`group rounded-xl transition-all border cursor-pointer w-full text-left flex items-start gap-0 focus:outline-none overflow-hidden
                ${isActive ? 'ring-1 ring-teal-500/50' : ''}
                ${isSelected
                    ? 'bg-slate-800 border-teal-500/40 shadow-[0_0_10px_-3px_rgba(20,184,166,0.15)]'
                    : 'hover:bg-slate-800/60 border-transparent hover:border-slate-700'
                }
            `}
        >
            {/* ── Cost column ── */}
            <div className="flex-none w-28 px-3 py-3 text-right border-r border-slate-700/40 self-stretch flex flex-col justify-center">
                {isFree ? (
                    <p className="text-[10px] font-bold text-emerald-400 font-mono">Free</p>
                ) : costIn ? (
                    <>
                        <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                            In: <span className="text-slate-300">{costIn.replace('/1M', '')}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                            Out: <span className="text-slate-300">{costOut?.replace('/1M', '') || '–'}</span>
                        </p>
                    </>
                ) : (
                    <p className="text-[10px] text-slate-600 font-mono">–</p>
                )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-w-0 px-3 py-2.5">
                {/* Name + badge + checkmark */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {model.name}
                    </span>
                    {isSelected && <CheckCircle2 size={13} className="text-teal-400 flex-none" />}
                    {badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLORS[badge]}`}>
                            {badge}
                        </span>
                    )}
                    {isFree && !badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-green-500/20 text-green-400 border-green-500/30">
                            Free
                        </span>
                    )}
                </div>

                {/* Provider badge + task pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/40">
                        <span className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`} />
                        {providerName || model.provider}
                    </span>
                    {recommendedFor.map(t => (
                        <TaskPill key={t} task={t} />
                    ))}
                </div>

                <CapabilityBadges capabilities={capabilities} />

                {/* Description */}
                {description && (
                    <div className="mb-1">
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                            {description}
                        </p>
                        <span
                            role="link"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onShowMore(); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onShowMore(); } }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors cursor-pointer"
                        >
                            Show more
                        </span>
                    </div>
                )}

                {/* More info */}
                {infoUrl && (
                    <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(infoUrl, '_blank', 'noopener,noreferrer');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') window.open(infoUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors cursor-pointer"
                    >
                        <Info size={10} />
                        More info
                    </span>
                )}
            </div>
        </div>
    );
});
ModelItem.displayName = 'ModelItem';

// ── Trigger button (closed state) ─────────────────────────────────────────
function TriggerButton({
    model,
    provider,
    isOpen,
    placeholder,
    onClick,
}: {
    model: ModelOption | undefined;
    provider: ProviderInfo | undefined;
    isOpen: boolean;
    placeholder: string;
    onClick: () => void;
}) {
    const knownMeta = model ? getModelById(model.id) : undefined;
    const badge = knownMeta?.badge;
    const costIn = model?.pricing ? formatPrice(model.pricing.prompt) : undefined;
    const costOut = model?.pricing ? formatPrice(model.pricing.completion) : undefined;
    const dot = model ? providerDot(model.provider) : 'bg-slate-500';
    const isFree = model?.id.includes(':free') || model?.id.includes('free');

    if (!model) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="w-full flex items-center justify-between bg-slate-800/50 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="text-xs text-slate-500">{placeholder}</span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-0 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50 overflow-hidden text-left
                ${isOpen
                    ? 'bg-slate-800 border-teal-500/40'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800/70'
                }
            `}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
        >
            {/* Cost mini-column */}
            <div className="flex-none px-3 py-2 border-r border-slate-700/40 text-right self-stretch flex flex-col justify-center w-24">
                {isFree ? (
                    <p className="text-[10px] font-bold text-emerald-400 font-mono">Free</p>
                ) : costIn ? (
                    <>
                        <p className="text-[10px] text-slate-500 font-mono leading-tight">
                            In: <span className="text-slate-300">{costIn.replace('/1M', '')}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono leading-tight">
                            Out: <span className="text-slate-300">{costOut?.replace('/1M', '') || '–'}</span>
                        </p>
                    </>
                ) : (
                    <span className="text-[10px] text-slate-600 italic">no price</span>
                )}
            </div>

            {/* Model info */}
            <div className="flex-1 px-2.5 py-2 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-white truncate">{model.name}</span>
                    {badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-none ${BADGE_COLORS[badge]}`}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`} />
                    <span className="text-[10px] text-slate-400 truncate">
                        {provider ? provider.name : model.provider}
                    </span>
                </div>
            </div>

            <ChevronDown size={13} className={`text-slate-500 transition-transform flex-none mr-2 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ModelSelector({
    value,
    onChange,
    models,
    providers,
    className = '',
    placeholder = 'Select a model...',
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [details, setDetails] = useState<{
        name: string;
        providerLabel: string;
        description?: string | undefined;
        costIn?: string | undefined;
        costOut?: string | undefined;
        capabilities?: string[] | undefined;
        badge?: string | undefined;
        recommendedFor?: TaskType[] | undefined;
        infoUrl?: string | undefined;
        isFree?: boolean | undefined;
    } | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Close on click outside
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setActiveIndex(-1);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectedModel = models.find(m => m.id === value);
    const selectedProvider = providers.find(p => p.id === selectedModel?.provider);

    // Filter
    const filteredModels = models.filter(m => {
        const q = searchQuery.toLowerCase();
        return (
            m.name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            (m.description ?? '').toLowerCase().includes(q)
        );
    });

    // Order alphabetically
    const allDisplay = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));

    // Sync refs array size
    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, allDisplay.length);
    }, [allDisplay.length]);

    // Scroll active into view
    useEffect(() => {
        if (isOpen && activeIndex >= 0) {
            itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    // Keyboard nav
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIsOpen(true);
                setActiveIndex(0);
            }
            return;
        }
        const total = allDisplay.length;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setActiveIndex(p => (p + 1) % total); break;
            case 'ArrowUp': e.preventDefault(); setActiveIndex(p => (p - 1 + total) % total); break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < total) {
                    const sel = allDisplay[activeIndex];
                    if (sel) { onChange(sel.id, sel.provider); setIsOpen(false); setActiveIndex(-1); }
                }
                break;
            case 'Escape': e.preventDefault(); setIsOpen(false); setActiveIndex(-1); break;
            case 'Tab': setIsOpen(false); break;
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
            {/* Trigger */}
            <TriggerButton
                model={selectedModel}
                provider={selectedProvider}
                isOpen={isOpen}
                placeholder={placeholder}
                onClick={() => { setIsOpen(v => !v); if (!isOpen) setActiveIndex(0); }}
            />

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                    style={{ minWidth: 340, maxWidth: 'min(92vw, 480px)', maxHeight: 440 }}>

                    {/* Search */}
                    <div className="p-2 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur sticky top-0">
                        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                            <Search size={12} className="text-slate-500 flex-none" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                aria-label="Search models"
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setActiveIndex(0); }}
                                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                                autoFocus
                                onKeyDown={e => {
                                    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                                        e.stopPropagation();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Model lists */}
                    <div className="overflow-y-auto flex-1 p-2 space-y-4" ref={listRef} role="listbox">
                        <div className="space-y-1">
                            {allDisplay.map((model, idx) => (
                                <ModelItem
                                    key={model.id}
                                    model={model}
                                    providerName={providers.find(p => p.id === model.provider)?.name}
                                    isSelected={value === model.id}
                                    isActive={activeIndex === idx}
                                    ref={el => (itemRefs.current[idx] = el)}
                                    onSelect={() => { onChange(model.id, model.provider); setIsOpen(false); setActiveIndex(-1); }}
                                    onShowMore={() => {
                                        const knownMeta = getModelById(model.id);
                                        const description = knownMeta?.description ?? model.description;
                                        const costIn = formatPrice(model.pricing?.prompt);
                                        const costOut = formatPrice(model.pricing?.completion);
                                        const isFree = model.id.includes(':free') || model.id.includes('free');
                                        const providerLabel = providers.find(p => p.id === model.provider)?.name ?? model.provider;

                                        setDetails({
                                            name: model.name,
                                            providerLabel,
                                            description,
                                            costIn,
                                            costOut,
                                            capabilities: model.capabilities,
                                            badge: knownMeta?.badge,
                                            recommendedFor: knownMeta?.recommendedFor,
                                            infoUrl: knownMeta?.infoUrl,
                                            isFree,
                                        });
                                        setDetailsOpen(true);
                                    }}
                                />
                            ))}
                        </div>
                        {allDisplay.length === 0 && (
                            <p className="text-center text-xs text-slate-500 py-6">No models match your search</p>
                        )}
                        <p className="text-center text-[10px] text-slate-700 pt-1">
                            {allDisplay.length} model{allDisplay.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
            )}

            <Modal
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                title={details?.name ?? 'Model details'}
                wide
            >
                <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-300">{details?.providerLabel}</span>
                        {details?.badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-none ${BADGE_COLORS[details.badge] ?? ''}`}>
                                {details.badge}
                            </span>
                        )}
                    </div>

                    <CapabilityBadges capabilities={details?.capabilities} />

                    {details?.recommendedFor && details.recommendedFor.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {details.recommendedFor.map((t) => <TaskPill key={t} task={t} />)}
                        </div>
                    )}

                    {details?.description && (
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{details.description}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3">
                            <p className="text-[10px] text-slate-500 font-mono mb-1">Pricing (in)</p>
                            <p className="text-xs text-slate-200 font-mono">
                                {details?.isFree ? 'Free' : (details?.costIn ? details.costIn.replace('/1M', '') : '–')}
                            </p>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3">
                            <p className="text-[10px] text-slate-500 font-mono mb-1">Pricing (out)</p>
                            <p className="text-xs text-slate-200 font-mono">
                                {details?.isFree ? 'Free' : (details?.costOut ? details.costOut.replace('/1M', '') : '–')}
                            </p>
                        </div>
                    </div>

                    {details?.infoUrl && (
                        <span
                            role="link"
                            tabIndex={0}
                            onClick={() => window.open(details.infoUrl, '_blank', 'noopener,noreferrer')}
                            onKeyDown={(e) => { if (e.key === 'Enter') window.open(details.infoUrl, '_blank', 'noopener,noreferrer'); }}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                        >
                            <Info size={12} /> More info
                        </span>
                    )}
                </div>
            </Modal>
        </div>
    );
}
