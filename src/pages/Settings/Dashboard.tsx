import { useState, useEffect } from 'react';
import { Zap, Sparkles, Eye, Settings, AlertTriangle, ChevronDown, RefreshCw, BadgeDollarSign, BookOpen } from 'lucide-react';

import type { ApiKeyInfo, LocalEndpoint } from '../../lib/api-keys-service';
import type { ModelOption } from '../../lib/provider-models';
import { setActiveProvider } from '../../lib/api-keys-service';
import { listModels } from '../../lib/ai-service';
import { getDefaultModelForProvider } from '../../lib/provider-models';
import { toast } from 'sonner';
import { useProviderHealth } from '../../lib/provider-health';
import ModelSelector from '../../components/ModelSelector';
import { getRateLimitInfo, formatRetryWindow } from '../../lib/rate-limit';

interface DashboardProps {
    activeGen: ApiKeyInfo | LocalEndpoint | undefined;
    activeImprove: ApiKeyInfo | LocalEndpoint | undefined;
    activeVision: ApiKeyInfo | LocalEndpoint | undefined;
    activeResearch?: ApiKeyInfo | LocalEndpoint | undefined;
    onConfigure: () => void;
    configuredCount: number;
    keys: ApiKeyInfo[];
    localEndpoints: LocalEndpoint[];
    dynamicModels: Record<string, ModelOption[]>;
    setDynamicModels: React.Dispatch<React.SetStateAction<Record<string, ModelOption[]>>>;
    onRefreshData: () => Promise<void>;
    getToken: () => Promise<string>;
}

export function Dashboard({
    activeGen, activeImprove, activeVision, activeResearch, onConfigure, configuredCount,
    keys, localEndpoints, dynamicModels, setDynamicModels, onRefreshData, getToken
}: DashboardProps) {
    const allProviders = [...keys, ...localEndpoints];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">AI Configuration</h2>
                <p className="text-sm text-slate-400">Choose which AI model handles each task</p>
            </div>

            {/* 2×2 Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProviderStatusCard
                    role="generation"
                    label="Generation"
                    description="Creates prompts from your ideas using advanced reasoning."
                    icon={Zap}
                    activeProvider={activeGen}
                    allProviders={allProviders}
                    dynamicModels={dynamicModels}
                    setDynamicModels={setDynamicModels}
                    onRefreshData={onRefreshData}
                    getToken={getToken}
                    colorClass="amber"
                />
                <ProviderStatusCard
                    role="improvement"
                    label="Improvement"
                    description="Refines and enhances your prompts with expert techniques."
                    icon={Sparkles}
                    activeProvider={activeImprove}
                    allProviders={allProviders}
                    dynamicModels={dynamicModels}
                    setDynamicModels={setDynamicModels}
                    onRefreshData={onRefreshData}
                    getToken={getToken}
                    colorClass="teal"
                />
                <ProviderStatusCard
                    role="vision"
                    label="Vision"
                    description="Analyzes characters and images for style replication."
                    icon={Eye}
                    activeProvider={activeVision}
                    allProviders={allProviders}
                    dynamicModels={dynamicModels}
                    setDynamicModels={setDynamicModels}
                    onRefreshData={onRefreshData}
                    getToken={getToken}
                    colorClass="violet"
                />
                <ProviderStatusCard
                    role="research"
                    label="Research & Reasoning"
                    description="Used for style analysis, deep reasoning and recommendations."
                    icon={BookOpen}
                    activeProvider={activeResearch}
                    allProviders={allProviders}
                    dynamicModels={dynamicModels}
                    setDynamicModels={setDynamicModels}
                    onRefreshData={onRefreshData}
                    getToken={getToken}
                    colorClass="blue"
                />
            </div>

            {/* Configure Providers button */}
            <div className="flex flex-col items-center justify-center pt-4 space-y-4">
                <button
                    onClick={onConfigure}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-slate-100 hover:bg-white text-slate-900 rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)]"
                >
                    <Settings size={20} className="group-hover:rotate-45 transition-transform duration-500" />
                    Configure Providers
                </button>

                <p className="text-slate-500 text-sm">
                    {configuredCount === 0 ? (
                        <span className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle size={14} /> No providers configured yet
                        </span>
                    ) : (
                        <span>{configuredCount} provider{configuredCount !== 1 ? 's' : ''} currently configured</span>
                    )}
                </p>
            </div>

        </div>
    );
}

// ── ProviderStatusCard ───────────────────────────────────────────────────────

interface ProviderStatusCardProps {
    role: 'generation' | 'improvement' | 'vision' | 'research';
    label: string;
    description: string;
    icon: React.ElementType;
    activeProvider: ApiKeyInfo | LocalEndpoint | undefined;
    allProviders: (ApiKeyInfo | LocalEndpoint)[];
    dynamicModels: Record<string, ModelOption[]>;
    setDynamicModels: React.Dispatch<React.SetStateAction<Record<string, ModelOption[]>>>;
    onRefreshData: () => Promise<void>;
    getToken: () => Promise<string>;
    colorClass: 'amber' | 'teal' | 'violet' | 'blue';
}

function ProviderStatusCard({
    role, label, description, icon: Icon, activeProvider, allProviders,
    dynamicModels, setDynamicModels, onRefreshData, getToken, colorClass
}: ProviderStatusCardProps) {
    const [loading, setLoading] = useState(false);
    const { health, checkHealth, reportRateLimit } = useProviderHealth();

    const getProviderId = (p: ApiKeyInfo | LocalEndpoint) => {
        if ('endpoint_url' in p) return `local-${p.provider}-${p.id}`;
        return `cloud-${p.provider}`;
    };

    const currentProviderId = activeProvider ? getProviderId(activeProvider) : '';
    const providerHealth = activeProvider ? health[currentProviderId] : undefined;

    useEffect(() => {
        if (activeProvider && !providerHealth) {
            checkHealth(currentProviderId, activeProvider);
        }
    }, [activeProvider, currentProviderId, providerHealth, checkHealth]);

    const handleHealthCheck = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeProvider) checkHealth(currentProviderId, activeProvider);
    };

    const showRateLimitToast = (providerName: string, retryAfterSeconds: number | null) => {
        toast.warning(`${providerName} is tijdelijk gelimiteerd`, {
            description: `Probeer opnieuw in ${formatRetryWindow(retryAfterSeconds)} of kies een andere provider.`
        });
    };

    const getModels = (p: ApiKeyInfo | LocalEndpoint) => {
        return dynamicModels[p.provider] || [];
    };

    const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        if (!newId) return;
        const newProvider = allProviders.find(p => getProviderId(p) === newId);
        if (!newProvider) return;

        setLoading(true);
        try {
            let modelToUse = '';
            if (role === 'generation') modelToUse = newProvider.model_gen || newProvider.model_name || '';
            else if (role === 'improvement') modelToUse = newProvider.model_improve || newProvider.model_name || '';
            else if (role === 'vision') modelToUse = newProvider.model_vision || newProvider.model_name || '';
            else modelToUse = newProvider.model_gen || newProvider.model_name || '';

            if (!modelToUse) modelToUse = getDefaultModelForProvider(newProvider.provider);

            // Map 'research' to 'generation' role for backend (uses same mechanism)
            const backendRole = role === 'research' ? 'generation' : role;
            await setActiveProvider(newProvider.provider, modelToUse, true, backendRole);
            await onRefreshData();
            checkHealth(getProviderId(newProvider), newProvider);
            toast.success(`${label} provider changed to ${newProvider.provider}`);
        } catch (err) {
            toast.error('Failed to change provider');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleModelChange = async (newModel: string) => {
        if (!activeProvider) return;
        setLoading(true);
        try {
            const backendRole = role === 'research' ? 'generation' : role;
            await setActiveProvider(activeProvider.provider, newModel, true, backendRole);
            await onRefreshData();
            toast.success(`${label} model updated`);
        } catch (err) {
            toast.error('Failed to update model');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTestPricing = async () => {
        if (!activeProvider) return;
        setLoading(true);
        try {
            const token = await getToken();
            const models = await listModels(token, activeProvider.provider);
            const modelsWithPricing = models.filter(m => m.pricing);
            if (modelsWithPricing.length > 0) {
                const sample = modelsWithPricing.find(m => m.id === activeModelName) || modelsWithPricing[0];
                if (sample) {
                    const pricingInfo = sample.pricing
                        ? `Prompt: ${sample.pricing.prompt}, Completion: ${sample.pricing.completion}`
                        : 'Pricing available';
                    toast.success(`Pricing verified! Found ${modelsWithPricing.length} models with pricing.`, { description: `${sample.name}: ${pricingInfo}` });
                }
            } else {
                toast.warning('No pricing data found for this provider.');
            }
            setDynamicModels(prev => ({ ...prev, [activeProvider.provider]: models }));
        } catch (err) {
            const rl = getRateLimitInfo(err);
            if (rl.isRateLimited) {
                reportRateLimit(currentProviderId, err);
                showRateLimitToast(activeProvider.provider, rl.retryAfterSeconds);
                return;
            }
            toast.error('Failed to test pricing');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshModels = async () => {
        if (!activeProvider) return;
        setLoading(true);
        try {
            const token = await getToken();
            const models = await listModels(token, activeProvider.provider);
            setDynamicModels(prev => ({ ...prev, [activeProvider.provider]: models }));
            checkHealth(currentProviderId, activeProvider);
            toast.success('Models refreshed');
        } catch (err) {
            const rl = getRateLimitInfo(err);
            if (rl.isRateLimited) {
                reportRateLimit(currentProviderId, err);
                showRateLimitToast(activeProvider.provider, rl.retryAfterSeconds);
                return;
            }
            toast.error('Failed to refresh models');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Colour maps — added blue
    const bgColors = {
        amber: 'bg-amber-500/5  border-amber-500/20  hover:border-amber-500/40',
        teal: 'bg-teal-500/5   border-teal-500/20   hover:border-teal-500/40',
        violet: 'bg-violet-500/5 border-violet-500/20 hover:border-violet-500/40',
        blue: 'bg-blue-500/5   border-blue-500/20   hover:border-blue-500/40',
    };
    const iconBgColors = {
        amber: 'bg-amber-500/10  text-amber-400',
        teal: 'bg-teal-500/10   text-teal-400',
        violet: 'bg-violet-500/10 text-violet-400',
        blue: 'bg-blue-500/10   text-blue-400',
    };
    const activeBadgeColors = {
        amber: 'bg-amber-500/10  text-amber-500  border-amber-500/20',
        teal: 'bg-teal-500/10   text-teal-500   border-teal-500/20',
        violet: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
        blue: 'bg-blue-500/10   text-blue-400   border-blue-500/20',
    };

    // Active model name
    let activeModelName = '';
    if (role === 'generation') activeModelName = activeProvider?.model_gen || activeProvider?.model_name || '';
    else if (role === 'improvement') activeModelName = activeProvider?.model_improve || activeProvider?.model_name || '';
    else if (role === 'vision') activeModelName = activeProvider?.model_vision || activeProvider?.model_name || '';
    else activeModelName = activeProvider?.model_gen || activeProvider?.model_name || '';

    const activeModelsList = activeProvider ? getModels(activeProvider) : [];

    return (
        <div className={`relative group overflow-visible rounded-2xl border p-6 transition-all duration-300 ${activeProvider ? bgColors[colorClass] : 'bg-slate-900/40 border-slate-800 border-dashed'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${activeProvider ? iconBgColors[colorClass] : 'bg-slate-800 text-slate-500'}`}>
                    <Icon size={24} />
                </div>
                {activeProvider && (
                    <div className="flex flex-col items-end gap-1">
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${activeBadgeColors[colorClass]}`}>Active</div>

                        {providerHealth && (
                            <div
                                onClick={handleHealthCheck}
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors hover:bg-slate-800/50 ${providerHealth.status === 'ok' ? 'text-green-500' :
                                    providerHealth.status === 'error' ? 'text-red-500' :
                                        providerHealth.status === 'rate_limited' ? 'text-amber-400' : 'text-slate-500'
                                    }`}
                                title={providerHealth.error || 'Click to re-check health'}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${providerHealth.status === 'ok' ? 'bg-green-500' :
                                    providerHealth.status === 'error' ? 'bg-red-500' :
                                        providerHealth.status === 'rate_limited' ? 'bg-amber-400' : 'bg-slate-500 animate-pulse'
                                    }`} />
                                {providerHealth.status === 'loading' ? <span>checking...</span>
                                    : providerHealth.status === 'rate_limited' ? <span>limited</span>
                                    : providerHealth.status === 'error' ? <span>error</span>
                                        : <span>{providerHealth.latency}ms</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">{label}</h3>
            <p className="text-sm text-slate-400 mb-6 h-10">{description}</p>

            <div className="space-y-4">
                {/* Provider dropdown */}
                <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Provider</div>
                    <div className="relative">
                        <select
                            value={currentProviderId}
                            onChange={handleProviderChange}
                            disabled={loading}
                            aria-label={`${label} provider`}
                            title={`${label} provider`}
                            className="w-full appearance-none bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 transition-colors disabled:opacity-50"
                        >
                            {allProviders.length === 0 && <option value="">No Configured Providers</option>}
                            {allProviders.map(p => {
                                const id = getProviderId(p);
                                const name = p.provider === 'ollama' ? 'Ollama'
                                    : p.provider === 'lmstudio' ? 'LM Studio'
                                        : p.provider.charAt(0).toUpperCase() + p.provider.slice(1);
                                const lbl = 'endpoint_url' in p ? `${name} (Local)` : name;
                                return <option key={id} value={id}>{lbl}</option>;
                            })}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {/* Model dropdown — rich ModelSelector */}
                {activeProvider && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                            <span>Model</span>
                            <div className="flex items-center gap-2">
                                <button onClick={handleTestPricing} disabled={loading} className="text-slate-500 hover:text-green-400 transition-colors" title="Test Pricing">
                                    <BadgeDollarSign size={12} className={loading ? 'animate-pulse' : ''} />
                                </button>
                                <button onClick={handleRefreshModels} disabled={loading} className="text-slate-500 hover:text-white transition-colors" title="Refresh Models">
                                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        {activeModelsList.length > 0 ? (
                            <ModelSelector
                                value={activeModelName}
                                onChange={(modelId) => handleModelChange(modelId)}
                                models={activeModelsList.map(m => ({ ...m, provider: m.provider ?? activeProvider.provider }))}
                                providers={[{ id: activeProvider.provider, name: activeProvider.provider, type: 'endpoint_url' in activeProvider ? 'local' : 'cloud' }]}
                                placeholder="Select model..."
                                className="w-full"
                            />
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={activeModelName}
                                    disabled
                                    aria-label={`${label} model`}
                                    title={`${label} model`}
                                    placeholder="No model loaded"
                                    className="w-full bg-slate-900/30 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 italic"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button onClick={handleTestPricing} className="p-1 hover:bg-slate-700 rounded transition-colors" title="Test Pricing">
                                        <BadgeDollarSign size={12} className="text-slate-500 hover:text-green-400" />
                                    </button>
                                    <button onClick={handleRefreshModels} className="p-1 hover:bg-slate-700 rounded transition-colors" title="Refresh Models">
                                        <RefreshCw size={12} className={loading ? 'animate-spin text-teal-500' : 'text-slate-500'} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
