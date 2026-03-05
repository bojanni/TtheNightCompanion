import { useState } from 'react';
import { ChevronDown, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataManagement } from '../components/DataManagement';
import {
  getPromptDiversityThreshold,
  setPromptDiversityThreshold,
  PROMPT_DIVERSITY_THRESHOLD_MIN,
  PROMPT_DIVERSITY_THRESHOLD_MAX,
} from '../lib/user-settings';

export default function Settings() {
  const { t } = useTranslation();
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [apiLogging, setApiLogging] = useState(() => localStorage.getItem('nc_api_logging_enabled') === 'true');
  const [diversityThreshold, setDiversityThreshold] = useState(() => getPromptDiversityThreshold());

  const toggleApiLogging = () => {
    const newValue = !apiLogging;
    setApiLogging(newValue);
    localStorage.setItem('nc_api_logging_enabled', String(newValue));
  };

  const onDiversityThresholdChange = (value: number) => {
    const saved = setPromptDiversityThreshold(value);
    setDiversityThreshold(saved);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-8">

        {/* Advanced Settings */}
        <div className="pt-4 border-b border-slate-800/50 pb-8">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center justify-between w-full group"
          >
            <h2 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors uppercase tracking-wider text-sm opacity-50 px-1">
              Advanced Settings
            </h2>
            <ChevronDown
              className={`text-slate-500 group-hover:text-teal-400 transition-all duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={`grid transition-all duration-300 ease-in-out ${isAdvancedOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
            <div className="overflow-hidden">
              <div className="max-w-4xl mx-auto">
                <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Terminal className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-white">API Request Logging</h2>
                        <button
                          onClick={toggleApiLogging}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${apiLogging ? 'bg-teal-500' : 'bg-slate-700'}`}
                          title="Toggle API Logging"
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${apiLogging ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <p className="text-sm text-slate-400">
                        Log all raw outbound AI requests and responses (system prompts, usage stats) to the terminal console and Browser DevTools. Enable this for troubleshooting prompt generation or LLM issues.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-6 mt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-300 font-bold">%</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-white">Prompt Repetition Sensitivity</h2>
                        <span className="text-sm font-semibold text-teal-300">{Math.round(diversityThreshold * 100)}%</span>
                      </div>
                      <p className="text-sm text-slate-400 mb-4">
                        Stel in vanaf welke similarity een prompt als te repetitief wordt beschouwd bij opslaan in Generator.
                        Lager = strenger, hoger = toleranter.
                      </p>
                      <input
                        type="range"
                        min={PROMPT_DIVERSITY_THRESHOLD_MIN}
                        max={PROMPT_DIVERSITY_THRESHOLD_MAX}
                        step={0.01}
                        value={diversityThreshold}
                        onChange={(e) => onDiversityThresholdChange(parseFloat(e.target.value))}
                        className="w-full accent-teal-500"
                        aria-label="Prompt repetition sensitivity"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{Math.round(PROMPT_DIVERSITY_THRESHOLD_MIN * 100)}% (streng)</span>
                        <span>{Math.round(PROMPT_DIVERSITY_THRESHOLD_MAX * 100)}% (tolerant)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="pt-4">
          <button
            onClick={() => setIsDataManagementOpen(!isDataManagementOpen)}
            className="flex items-center justify-between w-full group"
          >
            <h2 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors uppercase tracking-wider text-sm opacity-50 px-1">
              {t('settings.dataManagement')}
            </h2>
            <ChevronDown
              className={`text-slate-500 group-hover:text-teal-400 transition-all duration-300 ${isDataManagementOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={`grid transition-all duration-300 ease-in-out ${isDataManagementOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
            <div className="overflow-hidden">
              <DataManagement />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
