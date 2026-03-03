import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wrench, Clock, ChevronLeft, ChevronRight,
  LayoutDashboard, Wand2, Sparkles, Users, Image as ImageIcon,
  Compass, FlaskConical, Fingerprint, Settings,
  Moon, Sun, BarChart2, Loader2, Info, Download, Wifi, WifiOff
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useExtension } from '../context/ExtensionContext';
import { db } from '../lib/api';
import { toast } from 'sonner';
import SidebarCostWidget from './SidebarCostWidget';
import { RateLimitWidget } from './RateLimitWidget';
import { BudgetAlertWidget } from './BudgetAlertWidget';
import { RateLimitAlertWidget } from './RateLimitAlertWidget';
import { useUsageDashboard } from '../hooks/useUsage';

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/generator', icon: Wand2, labelKey: 'nav.generator' },
  { to: '/prompts', icon: Sparkles, labelKey: 'nav.prompts' },
  { to: '/characters', icon: Users, labelKey: 'nav.characters' },
  { to: '/gallery', icon: ImageIcon, labelKey: 'nav.gallery' },
  { to: '/models', icon: Compass, labelKey: 'nav.models' },
  { to: '/batch-testing', icon: FlaskConical, labelKey: 'nav.batchTesting' },
  { to: '/style', icon: Fingerprint, labelKey: 'nav.styleProfile' },
  { to: '/import-hub', icon: Download, labelKey: 'Import Hub' },
];

const infoItems = [
  { to: '/nc-models', icon: Info, labelKey: 'nav.ncModels', fallbackLabel: 'NC Models Guide' },
  { to: '/usage', icon: BarChart2, labelKey: 'AI Usage', fallbackLabel: 'AI Usage' },
  { to: '/statistics', icon: BarChart2, labelKey: 'nav.statistics' },
  { to: '/timeline', icon: Clock, labelKey: 'nav.timeline' },
];

const settingsItems = [
  { to: '/ai-config', icon: Settings, labelKey: 'nav.settings' },
  { to: '/settings', icon: Wrench, labelKey: 'nav.generalSettings' },
];

// Full-width: these pages use all available horizontal space
const FULL_WIDTH_PAGES = ['/', '/prompts', '/gallery', '/timeline'];
export default function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isFullWidthPage = FULL_WIDTH_PAGES.includes(location.pathname);

  function UsageBadge() {
    const { data } = useUsageDashboard();
    if (!data || !data.providers || data.providers.length === 0) return null;
    const max = Math.max(...data.providers.map(p => Number(p.current_window.percent_used || 0)));
    if (!isFinite(max) || max <= 0) return null;
    const color = max >= 85 ? 'bg-red-500/20 text-red-400 border-red-500/20' : max >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-teal-500/20 text-teal-400 border-teal-500/20';
    return (
      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${color}`}>
        {max.toFixed(0)}%
      </span>
    );
  }

  const { theme, setTheme } = useTheme();
  const { connectionStatus, lastSyncTime } = useExtension();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; }
    catch { return false; }
  });
  const [savingLang, setSavingLang] = useState(false);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const changeLanguage = async (lng: string) => {
    setSavingLang(true);
    try {
      await i18n.changeLanguage(lng);
      const { error } = await db
        .from('user_profiles')
        .upsert({ email: 'local@user.com', language: lng }, { onConflict: 'email' });

      if (error) {
        console.error('Failed to save language to DB:', error);
      } else {
        toast.success(t('settings.language.saveSuccess'));
      }
    } catch (e) {
      console.error('Failed to change language:', e);
    } finally {
      setSavingLang(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Sidebar ── */}
      <aside className={`bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-40 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'}`}>

        <div className={`px-6 py-5 border-b border-slate-800 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/logo.webp" alt="Nightcafe Companion Logo" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <h1 className="text-base font-bold text-white tracking-tight truncate">NightCafe</h1>
                <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase truncate">Companion</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className={`text-slate-500 hover:text-white transition-colors ${collapsed ? 'absolute left-1/2 -translate-x-1/2 top-20' : 'block'}`}
            title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Theme & Language Toggles */}
        <div className={`px-3 py-2 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-800 w-full ${collapsed ? 'justify-center w-10 h-10 p-0' : ''}`}
            title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {!collapsed && (
              <span className="animate-in fade-in slide-in-from-left-2 duration-300">
                {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              </span>
            )}
          </button>

          {/* Inline Language Switcher */}
          <div className={`flex items-center gap-1 p-1 bg-slate-950/50 rounded-xl border border-slate-800/50 ${collapsed ? 'flex-col' : ''}`}>
            {[
              { id: 'nl', label: 'NL', title: 'Nederlands' },
              { id: 'en', label: 'EN', title: 'English' }
            ].map(lang => (
              <button
                key={lang.id}
                onClick={() => changeLanguage(lang.id)}
                disabled={savingLang}
                title={lang.title}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all
                  ${i18n.language === lang.id
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  } ${collapsed ? 'w-8 h-8' : ''}`}
              >
                {savingLang && i18n.language !== lang.id ? <Loader2 size={10} className="animate-spin" /> : lang.label}
              </button>
            ))}
          </div>

          {/* Extension Sync Indicator */}
          <div className={`flex items-center gap-2 p-1.5 mt-1 bg-slate-950/40 rounded-xl border border-slate-800/50 ${collapsed ? 'justify-center' : 'px-3'}`} title={connectionStatus === 'connected' ? 'Connected to NC Extension' : 'Waiting for connection...'}>
            {connectionStatus === 'connected' ? (
              <Wifi size={14} className="text-emerald-400 shrink-0" />
            ) : connectionStatus === 'checking' ? (
              <Loader2 size={14} className="text-amber-400 shrink-0 animate-spin" />
            ) : (
              <WifiOff size={14} className="text-red-400 shrink-0" />
            )}
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className={`text-[10px] font-bold tracking-wide uppercase ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {connectionStatus === 'connected' ? 'Sync Active' : 'Offline'}
                </span>
                <span className="text-[9px] text-slate-500 truncate">
                  {lastSyncTime ? `Last: ${lastSyncTime.toLocaleTimeString()}` : 'No events yet'}
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Cost / Usage Widget */}
        <RateLimitWidget collapsed={collapsed} />
        <SidebarCostWidget collapsed={collapsed} />
        <BudgetAlertWidget />
        <RateLimitAlertWidget />
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-x-hidden">
          <div className="space-y-1">
            {navItems.map(({ to, icon: Icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                  ${isActive ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                  ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? t(labelKey) : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="animate-in fade-in slide-in-from-left-2 duration-300">{t(labelKey)}</span>
                )}
              </NavLink>
            ))}
          </div>

          <div>
            {!collapsed && <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Info & History</div>}
            <div className="space-y-1">
              {infoItems.map(({ to, icon: Icon, labelKey, fallbackLabel }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                     ${isActive ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                     ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? (t(labelKey) !== labelKey ? t(labelKey) : fallbackLabel || t(labelKey)) : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && (
                    <span className="animate-in fade-in slide-in-from-left-2 duration-300">
                      {t(labelKey) !== labelKey ? t(labelKey) : fallbackLabel || t(labelKey)}
                      {to === '/usage' && <UsageBadge />}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
          <div>
            {!collapsed && <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Settings</div>}
            <div className="space-y-1">
              {settingsItems.map(({ to, icon: Icon, labelKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                     ${isActive ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                     ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? t(labelKey) : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && (
                    <span className="animate-in fade-in slide-in-from-left-2 duration-300">
                      {t(labelKey)}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

      </aside>

      {/* ── Main ── */}
      <main className={`flex-1 min-h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${collapsed ? 'ml-20' : 'ml-64'}`}>
        {isFullWidthPage ? (
          /* Full-width: Generator, Prompts, Gallery, Timeline */
          <div className="w-full p-8">
            <Outlet />
          </div>
        ) : (
          /* Centered: all other pages — max 1400px, centered, min 1200px */
          <div className="w-full p-8">
            <div className="max-w-[1200px] min-w-[900px] mx-auto">
              <Outlet />
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
