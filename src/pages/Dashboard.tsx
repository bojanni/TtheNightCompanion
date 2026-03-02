import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Image as ImageIcon, Star, TrendingUp, Clock, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/api';
import type { Prompt, Character, GalleryItem } from '../lib/types';
import StarRating from '../components/StarRating';

interface Stats {
  promptCount: number;
  templateCount: number;
  characterCount: number;
  galleryCount: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({ promptCount: 0, templateCount: 0, characterCount: 0, galleryCount: 0 });
  const [recentPrompts, setRecentPrompts] = useState<Prompt[]>([]);
  const [recentGallery, setRecentGallery] = useState<GalleryItem[]>([]);
  const [topCharacters, setTopCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const [promptsRes, templatesRes, charsRes, galleryRes, recentPromptsRes, recentGalleryRes, topCharsRes] =
      await Promise.all([
        db.from('prompts').select('id', { count: 'exact', head: true }),
        db.from('prompts').select('id', { count: 'exact', head: true }).eq('is_template', true),
        db.from('characters').select('id', { count: 'exact', head: true }),
        db.from('gallery_items').select('id', { count: 'exact', head: true }),
        db.from('prompts').select('*').order('created_at', { ascending: false }).limit(5),
        db.from('gallery_items').select('*').order('created_at', { ascending: false }).limit(6),
        db.from('characters').select('*').order('created_at', { ascending: false }).limit(3),
      ]);

    setStats({
      promptCount: promptsRes.count ?? 0,
      templateCount: templatesRes.count ?? 0,
      characterCount: charsRes.count ?? 0,
      galleryCount: galleryRes.count ?? 0,
    });
    setRecentPrompts(recentPromptsRes.data ?? []);
    setRecentGallery(recentGalleryRes.data ?? []);
    setTopCharacters(topCharsRes.data ?? []);
    setLoading(false);
  }

  const statCards = [
    { label: t('dashboard.stats.prompts'), value: stats.promptCount, icon: Sparkles, color: 'from-amber-500 to-orange-600', link: '/prompts' },
    { label: t('dashboard.stats.templates'), value: stats.templateCount, icon: TrendingUp, color: 'from-teal-500 to-emerald-600', link: '/prompts' },
    { label: t('dashboard.stats.characters'), value: stats.characterCount, icon: Users, color: 'from-blue-500 to-cyan-600', link: '/characters' },
    { label: t('dashboard.stats.gallery'), value: stats.galleryCount, icon: ImageIcon, color: 'from-rose-500 to-pink-600', link: '/gallery' },
  ];

  return (
    <div className="space-y-8">
      <div className="min-h-[64px]">
        <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
        <p className="text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color, link }) => (
              <Link
                key={label}
                to={link}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <span className="text-3xl font-bold text-white">{value}</span>
                </div>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{label}</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock size={18} className="text-amber-400" />
                  {t('dashboard.recentPrompts')}
                </h2>
                <Link to="/prompts" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                  {t('common.viewAll')}
                </Link>
              </div>
              {recentPrompts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                  <p>{t('dashboard.noPrompts')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPrompts.map((prompt) => (
                    <Link
                      key={prompt.id}
                      to={`/prompts?open=${prompt.id}`}
                      className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">{prompt.title || 'Untitled'}</h3>
                          {prompt.is_favorite && <Heart size={12} className="text-rose-400 fill-rose-400 flex-shrink-0" />}
                          {prompt.is_template && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-teal-500/10 text-teal-400 rounded-md flex-shrink-0">
                              {t('prompts.filters.templates')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{prompt.content}</p>
                      </div>
                      <StarRating rating={prompt.rating} size={12} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Star size={18} className="text-amber-400" />
                  {t('nav.characters')}
                </h2>
                <Link to="/characters" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                  {t('common.viewAll')}
                </Link>
              </div>
              {topCharacters.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p>{t('dashboard.noCharacters')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topCharacters.map((char) => (
                    <Link key={char.id} to="/characters" className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors group">
                      {char.reference_image_url ? (
                        <img
                          src={char.reference_image_url}
                          alt={char.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                          <Users size={16} className="text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">{char.name}</h3>
                        <p className="text-xs text-slate-400 truncate">{char.description || 'No description'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-amber-400" />
                {t('dashboard.recentGallery')}
              </h2>
              <Link to="/gallery" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                {t('common.viewAll')}
              </Link>
            </div>

            {recentGallery.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p>{t('dashboard.noGallery')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {recentGallery.map((item) => (
                  <Link
                    key={item.id}
                    to={`/gallery?open=${item.id}`}
                    className="aspect-square rounded-xl overflow-hidden bg-slate-800 group relative block"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-slate-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
