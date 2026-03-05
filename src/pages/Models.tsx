import { useState } from 'react';
import { Compass, BarChart3 } from 'lucide-react';
import SmartModelRecommender from '../components/SmartModelRecommender';
import ModelTracker from '../components/ModelTracker';
import Modal from '../components/Modal';
import type { ModelInfo } from '../lib/models-data';

const TABS = [
  { id: 'advisor', label: 'Advisor', icon: Compass, description: 'Get model suggestions for your prompt' },
  { id: 'tracker', label: 'My Performance', icon: BarChart3, description: 'Track which models work best for you' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Models() {
  const [activeTab, setActiveTab] = useState<TabId>('advisor');
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Model Advisor</h1>
        <p className="text-slate-400 mt-1">Find the right model for every creation</p>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === id
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-500 -mt-3">
        {TABS.find((t) => t.id === activeTab)?.description}
      </div>

      {activeTab === 'advisor' && (
        <SmartModelRecommender onSelectModel={setSelectedModel} defaultExpanded={true} />
      )}

      {activeTab === 'tracker' && (
        <ModelTracker />
      )}

      <Modal
        open={!!selectedModel}
        onClose={() => setSelectedModel(null)}
        title={selectedModel?.name ?? ''}
        wide
      >
        {selectedModel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 bg-slate-700 text-slate-300 rounded-md">
                {selectedModel.provider}
              </span>

            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{selectedModel.description}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-emerald-400 mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {selectedModel.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-red-400 mb-2">Weaknesses</h4>
                <ul className="space-y-1">
                  {selectedModel.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-slate-400 mb-2">Best For</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedModel.bestFor.map((cat) => (
                  <span
                    key={cat}
                    className="text-[11px] px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded-full"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
