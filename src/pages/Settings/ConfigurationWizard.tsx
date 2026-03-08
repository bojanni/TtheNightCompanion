import { useState } from 'react';
import { Check, Cpu, ArrowLeft } from 'lucide-react';
import { PROVIDERS as PROVIDER_LIST } from '../../lib/providers';
import { ProviderConfigForm } from './ProviderConfigForm';
import { LocalEndpointCard } from '../../components/LocalEndpointCard';
import type { ApiKeyInfo, LocalEndpoint } from '../../lib/api-keys-service';
import { setActiveProvider } from '../../lib/api-keys-service';
import type { ModelOption } from '../../lib/provider-models';
import { toast } from 'sonner';
import { LOCAL_PROVIDERS, AIRole } from '../../lib/constants';
import { syncTaskModel } from '../../hooks/useTaskModels';

interface ConfigurationWizardProps {
    keys: ApiKeyInfo[];
    localEndpoints: LocalEndpoint[];
    onComplete: () => void;
    onBack: () => void;
    loadKeys: () => Promise<void>;
    loadLocalEndpoints: () => Promise<void>;
    getToken: () => Promise<string>;
    dynamicModels: Record<string, ModelOption[]>;
    setDynamicModels: React.Dispatch<React.SetStateAction<Record<string, ModelOption[]>>>;
}

// Helper to get the model for a given role from a provider entry
function getModelForRole(endpoint: LocalEndpoint | ApiKeyInfo | undefined, role: string): string | undefined {
    if (!endpoint) return undefined;
    if (role === 'generation' && endpoint.model_gen) return endpoint.model_gen;
    if (role === 'improvement' && endpoint.model_improve) return endpoint.model_improve;
    if (role === 'vision' && endpoint.model_vision) return endpoint.model_vision;
    return endpoint.model_name;
}

export function ConfigurationWizard({
    keys, localEndpoints, onComplete, onBack, loadKeys, loadLocalEndpoints, getToken, dynamicModels, setDynamicModels
}: ConfigurationWizardProps) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Top-left back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors mb-6 -ml-1"
            >
                <ArrowLeft size={16} /> Back to AI Configuration
            </button>

            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white">Configure your Providers</h2>
                <p className="text-slate-400 text-sm mt-2">Enter API keys or connection details for your chosen providers.</p>
            </div>

            <div className="space-y-8">

                {/* Cloud providers */}
                <div className="space-y-4">
                    {PROVIDER_LIST.map(provider => {
                        const keyInfo = keys.find(k => k.provider === provider.id);
                        return (
                            <div key={provider.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                                <ProviderConfigForm
                                    provider={provider}
                                    keyInfo={keyInfo}
                                    actionLoading={actionLoading}
                                    setActionLoading={setActionLoading}
                                    loadKeys={loadKeys}
                                    loadLocalEndpoints={loadLocalEndpoints}
                                    dynamicModels={dynamicModels[provider.id] || []}
                                    setDynamicModels={setDynamicModels}
                                    getToken={getToken}
                                    isGlobalActive={keyInfo?.is_active || false}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Local providers */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Cpu size={20} className="text-amber-400" /> Local Providers
                    </h3>
                    <div className="space-y-6">
                        <LocalEndpointCard
                            type={LOCAL_PROVIDERS.OLLAMA}
                            endpoint={localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.OLLAMA)}
                            actionLoading={actionLoading}
                            onSave={async (url, mGen, mImp, mVis) => {
                                setActionLoading('ollama');
                                try {
                                    const { db } = await import('../../lib/api');
                                    const existing = localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.OLLAMA);
                                    await db.from('user_local_endpoints').delete().eq('provider', LOCAL_PROVIDERS.OLLAMA);
                                    await db.from('user_local_endpoints').insert({
                                        provider: LOCAL_PROVIDERS.OLLAMA, endpoint_url: url, model_name: mGen,
                                        model_gen: mGen, model_improve: mImp, model_vision: mVis,
                                        is_active: existing?.is_active ?? false,
                                        is_active_gen: existing?.is_active_gen ?? false,
                                        is_active_improve: existing?.is_active_improve ?? false,
                                        is_active_vision: existing?.is_active_vision ?? false
                                    });
                                    await loadLocalEndpoints();
                                    toast.success('Ollama config saved');
                                } catch { toast.error('Failed to save Ollama'); }
                                finally { setActionLoading(null); }
                            }}
                            onDelete={async () => {
                                setActionLoading('ollama-delete');
                                try {
                                    const { db } = await import('../../lib/api');
                                    await db.from('user_local_endpoints').delete().eq('provider', LOCAL_PROVIDERS.OLLAMA);
                                    await loadLocalEndpoints();
                                    toast.success('Ollama removed');
                                } catch { toast.error('Failed to remove'); }
                                finally { setActionLoading(null); }
                            }}
                            onSetActive={async (role) => {
                                setActionLoading(`ollama-${role}`);
                                try {
                                    const endpoint = localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.OLLAMA);
                                    const model = getModelForRole(endpoint, role);
                                    const isRoleActive = role === 'generation' ? endpoint?.is_active_gen
                                        : role === 'improvement' ? endpoint?.is_active_improve
                                            : endpoint?.is_active_vision;
                                    await setActiveProvider(LOCAL_PROVIDERS.OLLAMA, model || '', !isRoleActive, role as AIRole);
                                    // Keep localStorage in sync so the Generator page picks up the new model
                                    if (!isRoleActive && model) syncTaskModel(role, LOCAL_PROVIDERS.OLLAMA, model);
                                    await loadKeys(); await loadLocalEndpoints();
                                } catch { toast.error('Failed to toggle'); }
                                finally { setActionLoading(null); }
                            }}
                        />
                        <LocalEndpointCard
                            type={LOCAL_PROVIDERS.LMSTUDIO}
                            endpoint={localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.LMSTUDIO)}
                            actionLoading={actionLoading}
                            onSave={async (url, mGen, mImp, mVis) => {
                                setActionLoading('lmstudio');
                                try {
                                    const { db } = await import('../../lib/api');
                                    const existing = localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.LMSTUDIO);
                                    await db.from('user_local_endpoints').delete().eq('provider', LOCAL_PROVIDERS.LMSTUDIO);
                                    await db.from('user_local_endpoints').insert({
                                        provider: LOCAL_PROVIDERS.LMSTUDIO, endpoint_url: url, model_name: mGen,
                                        model_gen: mGen, model_improve: mImp, model_vision: mVis,
                                        is_active: existing?.is_active ?? false,
                                        is_active_gen: existing?.is_active_gen ?? false,
                                        is_active_improve: existing?.is_active_improve ?? false,
                                        is_active_vision: existing?.is_active_vision ?? false
                                    });
                                    await loadLocalEndpoints();
                                    toast.success('LM Studio config saved');
                                } catch { toast.error('Failed to save LM Studio'); }
                                finally { setActionLoading(null); }
                            }}
                            onDelete={async () => {
                                setActionLoading('lmstudio-delete');
                                try {
                                    const { db } = await import('../../lib/api');
                                    await db.from('user_local_endpoints').delete().eq('provider', LOCAL_PROVIDERS.LMSTUDIO);
                                    await loadLocalEndpoints();
                                    toast.success('LM Studio removed');
                                } catch { toast.error('Failed to remove'); }
                                finally { setActionLoading(null); }
                            }}
                            onSetActive={async (role) => {
                                setActionLoading(`lmstudio-${role}`);
                                try {
                                    const endpoint = localEndpoints.find(e => e.provider === LOCAL_PROVIDERS.LMSTUDIO);
                                    const model = getModelForRole(endpoint, role);
                                    const isRoleActive = role === 'generation' ? endpoint?.is_active_gen
                                        : role === 'improvement' ? endpoint?.is_active_improve
                                            : endpoint?.is_active_vision;
                                    await setActiveProvider(LOCAL_PROVIDERS.LMSTUDIO, model || '', !isRoleActive, role as AIRole);
                                    // Keep localStorage in sync so the Generator page picks up the new model
                                    if (!isRoleActive && model) syncTaskModel(role, LOCAL_PROVIDERS.LMSTUDIO, model);
                                    await loadKeys(); await loadLocalEndpoints();
                                } catch { toast.error('Failed to toggle'); }
                                finally { setActionLoading(null); }
                            }}
                        />
                    </div>
                </div>

                {/* Done button */}
                <div className="flex justify-end pt-6 border-t border-slate-800">
                    <button
                        onClick={onComplete}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20"
                    >
                        <Check size={18} />
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
