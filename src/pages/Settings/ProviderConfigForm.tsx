import { useState, useEffect } from 'react';
import {
    Key, ExternalLink, Loader2, Zap, Eye, EyeOff, RefreshCw, Server
} from 'lucide-react';
import { saveApiKey, deleteApiKey, setActiveProvider, updateModels } from '../../lib/api-keys-service';
import type { ApiKeyInfo } from '../../lib/api-keys-service';
import { ApiKeySchema } from '../../lib/validation-schemas';
import { getModelsForProvider, getDefaultModelForProvider } from '../../lib/provider-models';
import type { ModelOption } from '../../lib/provider-models';
import { listModels } from '../../lib/ai-service';
import ModelSelector from '../../components/ModelSelector';
import { toast } from 'sonner';
import { useProviderHealth } from '../../lib/provider-health';
import { getRateLimitInfo, formatRetryWindow } from '../../lib/rate-limit';
import { syncTaskModel } from '../../hooks/useTaskModels';

export interface ProviderConfigFormProps {
    provider: {
        id: string;
        name: string;
        description: string;
        docsUrl: string;
        placeholder: string;
    };
    keyInfo: ApiKeyInfo | null | undefined;
    actionLoading: string | null;
    setActionLoading: (id: string | null) => void;
    loadKeys: () => Promise<void>;
    loadLocalEndpoints: () => Promise<void>;
    dynamicModels: ModelOption[];
    setDynamicModels: React.Dispatch<React.SetStateAction<Record<string, ModelOption[]>>>;
    getToken: () => Promise<string>;
    isGlobalActive: boolean;
}

export function ProviderConfigForm({
    provider, keyInfo, actionLoading, setActionLoading, loadKeys, loadLocalEndpoints, dynamicModels, setDynamicModels, getToken, isGlobalActive
}: ProviderConfigFormProps) {
    const [inputValue, setInputValue] = useState('');
    const [selectedModelGen, setSelectedModelGen] = useState(
        keyInfo?.model_gen || keyInfo?.model_name || getDefaultModelForProvider(provider.id)
    );
    const [selectedModelImprove, setSelectedModelImprove] = useState(
        keyInfo?.model_improve || keyInfo?.model_name || getDefaultModelForProvider(provider.id)
    );
    // Vision model state - defaulting to main model or generic
    const [selectedModelVision, setSelectedModelVision] = useState(
        keyInfo?.model_name || getDefaultModelForProvider(provider.id)
    );

    const [showKey, setShowKey] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const { health, reportRateLimit } = useProviderHealth();
    const providerHealthId = `cloud-${provider.id}`;
    const providerHealth = health[providerHealthId];

    useEffect(() => {
        if (keyInfo) {
            const serverGen = keyInfo.model_gen || keyInfo.model_name || getDefaultModelForProvider(provider.id);
            const serverImprove = keyInfo.model_improve || keyInfo.model_name || getDefaultModelForProvider(provider.id);
            const serverVision = keyInfo.model_vision || keyInfo.model_name || getDefaultModelForProvider(provider.id);
            setSelectedModelGen(serverGen);
            setSelectedModelImprove(serverImprove);
            setSelectedModelVision(serverVision);
        } else {
            // Reset if no key info (e.g. removed)
            setSelectedModelGen(getDefaultModelForProvider(provider.id));
            setSelectedModelImprove(getDefaultModelForProvider(provider.id));
            setSelectedModelVision(getDefaultModelForProvider(provider.id));
        }
    }, [keyInfo?.model_gen, keyInfo?.model_improve, keyInfo?.model_vision, keyInfo?.model_name, provider.id, keyInfo]);

    const staticModels = getModelsForProvider(provider.id);
    const allModels = dynamicModels && dynamicModels.length > 0 ? dynamicModels : staticModels;

    const header = (
        <div className="flex items-start justify-between mb-6">
            <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    {provider.name} Configuration
                    {isGlobalActive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Zap size={10} /> Active
                        </span>
                    )}
                </h3>
                <p className="text-sm text-slate-400 mt-1">{provider.description}</p>
                {providerHealth?.status === 'rate_limited' && (
                    <div
                        className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300"
                        title={providerHealth.error || 'Provider rate limit reached'}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Rate limited</span>
                    </div>
                )}
                <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 mt-2 transition-colors"
                >
                    Get API Key <ExternalLink size={10} />
                </a>
            </div>
        </div>
    );

    // Create providerInfo for ModelSelector - we only pass THIS provider
    const providersInfo = [{ id: provider.id, name: provider.name, type: 'cloud' as const }];
    // Filter models to only this provider's models (redundant if allModels is correct but safe)
    const selectorModels = allModels.filter((m: ModelOption) => m.provider === provider.id || !m.provider).map((m: ModelOption) => ({ ...m, provider: provider.id }));

    const isSaving = actionLoading === provider.id;
    const isDeleting = actionLoading === `${provider.id}-delete`;
    const isFetching = actionLoading === `${provider.id}-fetch`;
    const canFetch = ['openrouter', 'together', 'openai', 'gemini', 'deepinfra'].includes(provider.id);

    const handleSave = async () => {
        setActionLoading(provider.id);
        try {
            const validated = ApiKeySchema.parse({
                provider: provider.id,
                api_key: inputValue,
                is_active: true,
            });

            await saveApiKey(validated.provider, validated.api_key, selectedModelGen);
            await updateModels(provider.id, selectedModelGen, selectedModelImprove, selectedModelVision);

            await loadKeys();
            toast.success(`${provider.name} key saved successfully`);
            setIsEditing(false);
            setInputValue('');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to save key');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        setActionLoading(`${provider.id}-delete`);
        try {
            await deleteApiKey(provider.id);
            await loadKeys();
            toast.success(`${provider.name} key removed`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete key');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSetActive = async (role: 'generation' | 'improvement' | 'vision') => {
        setActionLoading(`${provider.id}-${role}`);
        try {
            let currentModel = '';
            if (role === 'generation') currentModel = selectedModelGen;
            else if (role === 'improvement') currentModel = selectedModelImprove;
            else if (role === 'vision') currentModel = selectedModelVision;

            // Determine if this provider AND the selected model are currently active for this role
            let isActuallyActive = false;
            if (role === 'generation') {
                isActuallyActive = !!(keyInfo?.is_active_gen && (keyInfo?.model_gen || keyInfo?.model_name) === selectedModelGen);
            } else if (role === 'improvement') {
                isActuallyActive = !!(keyInfo?.is_active_improve && (keyInfo?.model_improve || keyInfo?.model_name) === selectedModelImprove);
            } else if (role === 'vision') {
                isActuallyActive = !!(keyInfo?.is_active_vision && (keyInfo?.model_vision || keyInfo?.model_name) === selectedModelVision);
            }

            await setActiveProvider(provider.id, currentModel, !isActuallyActive, role);
            // Keep localStorage in sync so the Generator page picks up the new model
            if (!isActuallyActive && currentModel) {
                syncTaskModel(role, provider.id, currentModel);
            }
            toast.success(`${provider.name} ${role} ${isActuallyActive ? 'deactivated' : 'activated'}`);
            await loadKeys();
            await loadLocalEndpoints();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Failed to update ${provider.name}`);
        } finally {
            setActionLoading(null);
        }
    }

    const handleFetchModels = async () => {
        setActionLoading(`${provider.id}-fetch`);
        try {
            const apiKeyToUse = (isEditing && inputValue) ? inputValue : undefined;
            const token = await getToken();
            const models = await listModels(token, provider.id, apiKeyToUse);
            setDynamicModels((prev: Record<string, ModelOption[]>) => ({
                ...prev,
                [provider.id]: models
            }));
            toast.success('Models list updated');
            console.log(`Fetched ${models.length} models for ${provider.id}`, models);
        } catch (e) {
            const rl = getRateLimitInfo(e);
            if (rl.isRateLimited) {
                reportRateLimit(providerHealthId, e);
                toast.warning(`${provider.name} is tijdelijk gelimiteerd`, {
                    description: `Probeer opnieuw in ${formatRetryWindow(rl.retryAfterSeconds)} of kies een andere provider.`
                });
                return;
            }
            toast.error(e instanceof Error ? e.message : 'Failed to fetch models');
        } finally {
            setActionLoading(null);
        }
    }

    const handleModelChange = async (genId: string, improveId: string, visionId: string) => {
        if (!isEditing && keyInfo) {
            try {
                await updateModels(provider.id, genId, improveId, visionId);
                // Sync localStorage for roles where this provider is currently active
                if (keyInfo.is_active_gen) syncTaskModel('generation', provider.id, genId);
                if (keyInfo.is_active_improve) syncTaskModel('improvement', provider.id, improveId);
                if (keyInfo.is_active_vision) syncTaskModel('vision', provider.id, visionId);
                toast.success('Model preferences updated');
                await loadKeys();
            } catch (e) {
                console.error(e);
            }
        }
    }

    const handleTestConnection = async () => {
        // If not editing and no saved key, or editing and no input
        if ((!isEditing && !keyInfo) || (isEditing && !inputValue)) {
            toast.error('Please enter an API key first');
            return;
        }

        setActionLoading(`${provider.id}-test`);
        try {
            // Use the key from input, or undefined to let backend use saved key
            const apiKeyToUse = (isEditing && inputValue) ? inputValue : undefined;
            const token = await getToken();
            await listModels(token, provider.id, apiKeyToUse);
            toast.success('Connection successful! API key is valid.');
        } catch (e) {
            console.error(e);
            const rl = getRateLimitInfo(e);
            if (rl.isRateLimited) {
                reportRateLimit(providerHealthId, e);
                toast.warning(`${provider.name} is tijdelijk gelimiteerd`, {
                    description: `Probeer opnieuw in ${formatRetryWindow(rl.retryAfterSeconds)} of test een andere provider.`
                });
                return;
            }
            toast.error(e instanceof Error ? e.message : 'Connection failed. Please check your API key.');
        } finally {
            setActionLoading(null);
        }
    };

    if (!keyInfo && !isEditing) {
        return (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                {header}
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Key size={24} className="text-slate-500" />
                    </div>
                    <h4 className="text-white font-medium mb-2">Not Configured</h4>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                        Enter your API key to start using {provider.name} for prompt generation and improvement.
                    </p>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg transition-colors"
                    >
                        Configure {provider.name}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 w-full animate-in fade-in slide-in-from-left-4 duration-300">
            {header}
            {/* API Key Input */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                {isEditing ? (
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={provider.placeholder}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all"
                        />
                        <button
                            onClick={handleTestConnection}
                            disabled={actionLoading === `${provider.id}-test`}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 border border-slate-700 hover:border-slate-600"
                            title="Test Connection"
                        >
                            {actionLoading === `${provider.id}-test` ? <Loader2 size={14} className="animate-spin" /> : 'Test'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !inputValue}
                            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Save Key'}
                        </button>
                        {keyInfo && (
                            <button
                                onClick={() => { setIsEditing(false); setInputValue(''); }}
                                className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
                        <div className="flex-1 font-mono text-sm text-slate-400">
                            {showKey ? keyInfo?.key_hint : '••••••••••••••••••••••••'}
                        </div>
                        <button onClick={() => setShowKey(!showKey)} className="text-slate-500 hover:text-slate-300 p-1">
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        <button
                            onClick={handleTestConnection}
                            disabled={actionLoading === `${provider.id}-test`}
                            className="text-slate-400 hover:text-white text-xs font-medium px-2 flex items-center gap-1"
                            title="Test Connection"
                        >
                            {actionLoading === `${provider.id}-test` ? <Loader2 size={12} className="animate-spin" /> : 'Test'}
                        </button>
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        <button
                            onClick={() => { setIsEditing(true); setInputValue(''); }}
                            className="text-teal-400 hover:text-teal-300 text-xs font-medium px-2"
                        >
                            Change
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="text-red-400 hover:text-red-300 text-xs font-medium px-2 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}
                        </button>
                    </div>
                )}
            </div>

            {/* Models Configuration */}
            {(keyInfo || isEditing) && (
                <div className="space-y-4 pt-4 border-t border-slate-800/50">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                            <Server size={14} className="text-teal-500" />
                            Model Selection
                        </h4>

                        {canFetch && (
                            <button
                                onClick={handleFetchModels}
                                disabled={isFetching}
                                className="text-xs text-slate-500 hover:text-teal-400 flex items-center gap-1.5 transition-colors"
                                aria-label="Refresh Models"
                            >
                                {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Refresh Models
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2">Generation Model</label>
                            <ModelSelector
                                value={selectedModelGen}
                                onChange={(id) => {
                                    setSelectedModelGen(id);
                                    handleModelChange(id, selectedModelImprove, selectedModelVision);
                                }}
                                models={selectorModels}
                                providers={providersInfo}
                                placeholder="Select generation model..."
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-2">Improvement Model</label>
                            <ModelSelector
                                value={selectedModelImprove}
                                onChange={(id) => {
                                    setSelectedModelImprove(id);
                                    handleModelChange(selectedModelGen, id, selectedModelVision);
                                }}
                                models={selectorModels}
                                providers={providersInfo}
                                placeholder="Select improvement model..."
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-2">Vision Model</label>
                            <ModelSelector
                                value={selectedModelVision}
                                onChange={(id) => {
                                    setSelectedModelVision(id);
                                    handleModelChange(selectedModelGen, selectedModelImprove, id);
                                }}
                                models={selectorModels.filter(m =>
                                    m.capabilities?.includes('vision') ||
                                    m.id.toLowerCase().includes('vision') ||
                                    m.name.toLowerCase().includes('vision') ||
                                    // Fallback for known vision families if capabilities missing
                                    m.id.toLowerCase().includes('gpt-4') ||
                                    m.id.toLowerCase().includes('claude-3') ||
                                    m.id.toLowerCase().includes('gemini')
                                )}
                                providers={providersInfo}
                                placeholder="Select vision model..."
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Role Toggles */}
            {keyInfo && !isEditing && (
                <div className="pt-6 mt-4 border-t border-slate-800/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <button
                            onClick={() => handleSetActive('generation')}
                            disabled={actionLoading === `${provider.id}-generation`}
                            className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 font-medium text-xs transition-all border ${(keyInfo?.is_active_gen && (keyInfo?.model_gen || keyInfo?.model_name) === selectedModelGen)
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                                : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
                                }`}
                        >
                            <Zap size={16} className={actionLoading === `${provider.id}-generation` ? 'animate-spin' : ''} />
                            {(keyInfo?.is_active_gen) ? 'Active Gen' : 'Set Gen'}
                        </button>

                        <button
                            onClick={() => handleSetActive('improvement')}
                            disabled={actionLoading === `${provider.id}-improvement`}
                            className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 font-medium text-xs transition-all border ${(keyInfo?.is_active_improve && (keyInfo?.model_improve || keyInfo?.model_name) === selectedModelImprove)
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20'
                                : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
                                }`}
                        >
                            <Zap size={16} className={actionLoading === `${provider.id}-improvement` ? 'animate-spin' : ''} />
                            {(keyInfo?.is_active_improve) ? 'Active Improve' : 'Set Improve'}
                        </button>

                        <button
                            onClick={() => handleSetActive('vision')}
                            disabled={actionLoading === `${provider.id}-vision`}
                            className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 font-medium text-xs transition-all border ${(keyInfo?.is_active_vision)
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
                                : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
                                }`}
                        >
                            <Eye size={16} className={actionLoading === `${provider.id}-vision` ? 'animate-spin' : ''} />
                            {(keyInfo?.is_active_vision) ? 'Active Vision' : 'Set Vision'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
