import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import Dashboard from './pages/Dashboard';
import Prompts from './pages/Prompts';
import Characters from './pages/Characters';
import Gallery from './pages/Gallery';
import Models from './pages/Models';
import Generator from './pages/Generator';
import Settings from './pages/Settings';
import AIConfig from './pages/AIConfig';
import StyleProfile from './pages/StyleProfile';
import NCModels from './pages/NCModels';
import BatchTesting from './pages/BatchTesting';
import Tools from './pages/Tools';
import Timeline from './pages/Timeline';
import Statistics from './pages/Statistics';

import ImportHub from './pages/ImportHub';
import UsageDashboard from './pages/UsageDashboard';
import ModelEnrichmentManager from './pages/ModelEnrichmentManager';

import { ExtensionProvider } from './context/ExtensionContext';
import { AITimeoutProvider } from './context/AITimeoutContext';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={
          <ErrorBoundary>
            <AITimeoutProvider>
              <ExtensionProvider>
                <Layout />
              </ExtensionProvider>
            </AITimeoutProvider>
          </ErrorBoundary>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/models" element={<Models />} />
          <Route path="/nc-models" element={<NCModels />} />
          <Route path="/batch-testing" element={<BatchTesting />} />
          <Route path="/style" element={<StyleProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai-config" element={<AIConfig />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/import-hub" element={<ImportHub />} />
          <Route path="/usage" element={<UsageDashboard />} />
          <Route path="/model-enrichment" element={<ModelEnrichmentManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
