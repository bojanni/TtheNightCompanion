import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Trash2, Edit3, Image as ImageIcon, FolderOpen,
  Save, Loader2, X, Star, MessageSquare, ExternalLink,
  ChevronLeft, ChevronRight, Link, Download, Play, Settings2, Eye, EyeOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportGalleryItems } from '../lib/export-utils';
import { formatDate } from '../lib/date-utils';
import { db } from '../lib/api';
import type { GalleryItem, Prompt } from '../lib/types';
import Modal from '../components/Modal';
import ChoiceModal from '../components/ChoiceModal';
import { GallerySkeleton } from '../components/GallerySkeleton';
import StarRating from '../components/StarRating';
import PromptSelector from '../components/PromptSelector';
import ModelSelector from '../components/ModelSelector';
import { generateFromDescription } from '../lib/ai-service';
import { toast } from 'sonner';
import GridDensitySelector from '../components/GridDensitySelector';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_MODELS } from '../lib/provider-models';
import { useGalleryState } from '../hooks/useGalleryState';
import MediaRenderer from '../components/MediaRenderer';
import GalleryLightbox from '../components/GalleryLightbox';
import { useHotkeys } from '../hooks/useHotkeys';
import useSSERefresh from '../hooks/useSSERefresh';
import { useExtension } from '../context/ExtensionContext';

interface DynamicColorElementProps {
  tag?: keyof JSX.IntrinsicElements;
  cssVars: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler;
}

const DynamicColorElement = ({
  tag = 'div',
  cssVars,
  className,
  children,
  onClick,
}: DynamicColorElementProps) => {
  const Tag = tag as React.ElementType;
  const ref = useRef<Element>(null);
  useEffect(() => {
    if (ref.current && ref.current instanceof HTMLElement) {
      Object.entries(cssVars).forEach(([key, value]) => {
        (ref.current as HTMLElement).style.setProperty(key, value);
      });
    }
  }, [cssVars]);
  return <Tag ref={ref} className={className} onClick={onClick}>{children}</Tag>;
};

const PAGE_SIZE = 24;

export default function Gallery() {
  const { t } = useTranslation();
  const {
    items, setItems,
    collections,
    loading,
    search, setSearch,
    filterCollection, setFilterCollection,
    filterRating, setFilterRating,
    currentPage, setCurrentPage,
    totalCount,
    exporting, setExporting,
    showItemEditor, setShowItemEditor,
    editingItem, setEditingItem,
    showCollectionEditor, setShowCollectionEditor,
    selectedItem, setSelectedItem,
    formTitle, setFormTitle,
    formImageUrl, setFormImageUrl,
    formPromptUsed, setFormPromptUsed,
    formRating, setFormRating,
    formCollectionId, setFormCollectionId,
    formNotes, setFormNotes,
    saving, setSaving,
    formModel, setFormModel,
    formErrors, setFormErrors,
    formTouched, setFormTouched,
    collName, setCollName,
    collDesc, setCollDesc,
    collColor, setCollColor,
    showPromptSelector, setShowPromptSelector,
    linkingImage, setLinkingImage,
    linkedPrompts,
    lightboxImage, setLightboxImage,
    allPrompts,
    promptSuggestions, setPromptSuggestions,
    showPromptSuggestions, setShowPromptSuggestions,
    promptSearchValue, setPromptSearchValue,
    formMediaType, setFormMediaType,
    formVideoUrl, setFormVideoUrl,
    formVideoLocalPath, setFormVideoLocalPath,
    formThumbnailUrl, setFormThumbnailUrl,
    formDurationSeconds, setFormDurationSeconds,
    formStorageMode, setFormStorageMode,
    autoGenerateTitle, setAutoGenerateTitle,
    generatingTitle, setGeneratingTitle,
    selectedPromptId, setSelectedPromptId,
    deleteItemConfirmId, setDeleteItemConfirmId,
    deleteCollectionConfirmId, setDeleteCollectionConfirmId,
    importingNightcafe,
    handleImportNightcafeUrl,
    loadData,
    handleDeleteItem,
    handleUpdateRating,
    handleDeleteCollection,
    searchParams, setSearchParams
  } = useGalleryState();

  const { connectionStatus } = useExtension();
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useSSERefresh((item) => {
    toast.success(`"${item.title}" toegevoegd aan gallery`);

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(0);
      loadData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [displaySettings, setDisplaySettings] = useState(() => {
    const saved = localStorage.getItem('galleryDisplaySettings');
    return saved ? JSON.parse(saved) : {
      title: true,
      rating: true,
      prompt: true,
      model: true
    };
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('galleryDisplaySettings', JSON.stringify(displaySettings));
  }, [displaySettings]);

  useHotkeys('/', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    openItemEditor(null);
  });

  const allModels = ALL_MODELS;
  const allProviders = [
    { id: 'openai', name: 'OpenAI', type: 'cloud' as const },
    { id: 'gemini', name: 'Google Gemini', type: 'cloud' as const },
    { id: 'anthropic', name: 'Anthropic Claude', type: 'cloud' as const },
    { id: 'openrouter', name: 'OpenRouter', type: 'cloud' as const },
    { id: 'together', name: 'Together AI', type: 'cloud' as const },
  ];

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  // ... (validateForm logic here)

  function validateForm(fields?: { title?: string; imageUrl?: string; model?: string }) {
    const title = fields?.title ?? formTitle;
    const imageUrl = fields?.imageUrl ?? formImageUrl;
    const model = fields?.model ?? formModel;
    const errors: Record<string, string> = {};
    if (!autoGenerateTitle && !title.trim()) {
      errors.title = 'Title is required when auto-generate is off';
    }
    if (!imageUrl.trim()) {
      errors.imageUrl = 'Image URL or upload is required';
    }
    if (!model) {
      errors.model = 'Please select a model';
    }
    return errors;
  }

  function handleFieldBlur(field: string) {
    setFormTouched(prev => ({ ...prev, [field]: true }));
    setFormErrors(validateForm());
  }

  function openItemEditor(item: GalleryItem | null) {
    setEditingItem(item);
    setFormTitle(item?.title ?? '');
    setFormImageUrl(item?.image_url ?? '');
    setFormPromptUsed(item?.prompt_used ?? '');
    setFormRating(item?.rating ?? 0);
    setFormCollectionId(item?.collection_id ?? '');
    setFormModel(item?.model ?? '');
    setFormNotes(item?.notes ?? '');
    setFormMediaType(item?.media_type ?? 'image');
    setFormVideoUrl(item?.video_url ?? '');
    setFormVideoLocalPath(item?.video_local_path ?? '');
    setFormThumbnailUrl(item?.thumbnail_url ?? '');
    setFormDurationSeconds(item?.duration_seconds);
    setFormStorageMode(item?.storage_mode ?? 'url');
    setPromptSearchValue('');
    setPromptSuggestions([]);
    setShowPromptSuggestions(false);
    setSelectedPromptId(item?.prompt_id ?? null);
    setFormErrors({});
    setFormTouched({});
    setShowItemEditor(true);
  }

  async function handleSaveItem() {
    setFormTouched({ title: true, imageUrl: true, model: true });
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemData: any = {
        title: formTitle,
        image_url: formImageUrl,
        prompt_used: formPromptUsed,
        prompt_id: selectedPromptId,
        rating: formRating,
        collection_id: formCollectionId || null,
        model: formModel || undefined,
        notes: formNotes,
        media_type: formMediaType,
        video_url: formVideoUrl || undefined,
        video_local_path: formVideoLocalPath || undefined,
        thumbnail_url: formThumbnailUrl || undefined,
        duration_seconds: formDurationSeconds,
        storage_mode: formStorageMode,
      };

      const cleanData = Object.fromEntries(
        Object.entries(itemData).filter(([, v]) => v !== undefined)
      );

      if (editingItem) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db.from('gallery_items') as any).update(cleanData).eq('id', editingItem.id);
        toast.success('Image updated successfully');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db.from('gallery_items') as any).insert(cleanData);
        toast.success('Image added to gallery');
      }
      setShowItemEditor(false);
      loadData();
    } catch {
      toast.error('Failed to save image');
    } finally {
      setSaving(false);
    }
  }





  async function handleSaveCollection() {
    if (!collName.trim()) return;
    setSaving(true);
    try {
      await db.from('collections').insert({
        name: collName.trim(),
        description: collDesc,
        color: collColor,
      });
      setSaving(false);
      setShowCollectionEditor(false);
      setCollName('');
      setCollDesc('');
      toast.success('Collection created');
      loadData();
    } catch {
      toast.error('Failed to create collection');
      setSaving(false);
    }
  }



  async function handleLinkPrompt(image: GalleryItem) {
    setLinkingImage(image);
    setShowPromptSelector(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      setFormMediaType('video');
      // For local preview of video
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormVideoUrl(reader.result as string);
        setFormTouched(prev => ({ ...prev, videoUrl: true }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormMediaType('image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImageUrl(reader.result as string);
        setFormTouched(prev => ({ ...prev, imageUrl: true }));
      };
      reader.readAsDataURL(file);
    }
  }

  function searchPrompts(query: string) {
    if (!query) {
      setPromptSuggestions(allPrompts.slice(0, 50));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allPrompts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q)
    ).slice(0, 50);
    setPromptSuggestions(filtered);
  }

  function handlePromptSearchChange(value: string) {
    setPromptSearchValue(value);
    searchPrompts(value);
  }

  function handlePromptInputFocus() {
    setShowPromptSuggestions(true);
    searchPrompts(promptSearchValue);
  }

  function selectPrompt(prompt: Prompt) {
    setFormPromptUsed(prompt.content);
    setPromptSearchValue(prompt.title);
    setShowPromptSuggestions(false);
    setSelectedPromptId(prompt.id);
    if (autoGenerateTitle) {
      generateTitle(prompt.content);
    }
  }

  async function generateTitle(promptContent: string) {
    if (!promptContent || !autoGenerateTitle) return;

    setGeneratingTitle(true);
    try {
      const title = await generateFromDescription(
        `Create a short, descriptive title (maximum 10 words) for this image prompt: "${promptContent}"`,
        {
          preferences: { maxWords: 10 }
        },
        ''
      );
      const cleanTitle = title.trim().replace(/\*\*/g, '').replace(/"/g, '');
      setFormTitle(cleanTitle);
    } catch (err) {
      console.error('Failed to generate title:', err);
      const fallbackTitle = promptContent.split(' ').slice(0, 10).join(' ');
      setFormTitle(fallbackTitle);
    } finally {
      setGeneratingTitle(false);
    }
  }

  async function handleSelectPrompt(prompt: Prompt) {
    if (!linkingImage) return;
    try {
      await db.from('gallery_items').update({ prompt_id: prompt.id }).eq('id', linkingImage.id);

      setItems(prev => prev.map(i => i.id === linkingImage.id ? { ...i, prompt_id: prompt.id } : i));
      if (selectedItem?.id === linkingImage.id) {
        setSelectedItem({ ...selectedItem, prompt_id: prompt.id });
      }
      setLinkingImage(null);
      setShowPromptSelector(false);
      toast.success('Prompt linked');
      loadData();
    } catch {
      toast.error('Failed to link prompt');
    }
  }

  function openLightbox(item: GalleryItem) {
    setLightboxImage(item);
  }

  function closeLightbox() {
    setLightboxImage(null);
    setSlideshowMode(false);
  }

  function navigateLightbox(direction: 'prev' | 'next') {
    if (!lightboxImage) return;
    const currentIndex = filtered.findIndex(i => i.id === lightboxImage.id);
    if (currentIndex === -1) return;

    let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0) newIndex = filtered.length - 1;
    if (newIndex >= filtered.length) newIndex = 0;

    const nextItem = filtered[newIndex];
    if (nextItem) setLightboxImage(nextItem);
  }

  const filtered = useMemo(() => {
    // Client-side filtering only for non-search/db filters if needed, 
    // but effectively result is already filtered by DB for search/collection/rating.
    // However, keeping local filtering for instant UI updates if items change locally without reload?
    // Actually, loadData fetches fresh data, so 'items' is the source of truth.
    // 'items' are already filtered by search/collection/rating from DB.
    // BUT wait, search is now DB side. collection/rating were already DB side.
    // So 'items' contains the correct subset.
    // We just return items.

    return items;
  }, [items]);

  function getCollectionName(id: string | null): string {
    return collections.find((c) => c.id === id)?.name ?? '';
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Handle URL query parameter to open lightbox
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && !loading) {
      // First check if item is already loaded
      const item = items.find(i => i.id === openId);
      if (item) {
        setLightboxImage(item);
        // Clear the query param to prevent re-opening on navigation
        setSearchParams({}, { replace: true });
      } else if (items.length > 0) {
        // Item not in current page, fetch it directly
        db.from('gallery_items').select('*').eq('id', openId).single()
          .then(({ data }: { data: GalleryItem | null }) => {
            if (data) {
              setLightboxImage(data);
              setSearchParams({}, { replace: true });
            }
          });
      }
    }
  }, [items, loading, searchParams, setSearchParams, setLightboxImage]);

  function handleFilterCollectionChange(collectionId: string | null) {
    setFilterCollection(collectionId);
    setCurrentPage(0);
  }

  function handleFilterRatingChange(rating: number) {
    setFilterRating(rating);
    setCurrentPage(0);
  }

  async function handleExport() {
    if (totalCount === 0) return;
    setExporting(true);
    try {
      // Fetch ALL items matching current filters (ignoring page)
      let query = db
        .from('gallery_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) query = query.like('search', search);
      if (filterCollection) query = query.eq('collection_id', filterCollection);
      if (filterRating > 0) query = query.gte('rating', filterRating);

      // We need to fetch all, let's assume limit is high enough or loop?
      // Local DB might not have hard limit, but let's set a safe high number like 1000
      const { data } = await query.limit(1000); // 1000 item limit for export for now

      if (data) {
        await exportGalleryItems(data, `gallery_expo_${new Date().toISOString().slice(0, 10)}.zip`);
      }
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  function handleStartSlideshow() {
    if (filtered.length === 0) return;
    setSlideshowMode(true);
    setLightboxImage(filtered[0] || null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between min-h-[64px]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{t('gallery.title')}</h1>
            {!loading && connectionStatus === 'connected' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1 min-h-[20px]">
            {loading ? (
              <span className="opacity-50">{t('common.loading')}</span>
            ) : (
              t('gallery.items_count', { count: totalCount, defaultValue: `${totalCount} items in your collection` })
            )}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,auto))] sm:flex sm:flex-nowrap gap-2">
          <button
            onClick={() => setShowCollectionEditor(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <FolderOpen size={14} />
            {t('gallery.new_collection')}
          </button>
          <button
            onClick={handleExport}
            disabled={totalCount === 0 || exporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t('common.export')}
          </button>
          <button
            onClick={handleStartSlideshow}
            disabled={totalCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
          >
            <Play size={14} />
            {t('gallery.slideshow')}
          </button>

          
            <button
              onClick={() => setShowDisplayOptions(!showDisplayOptions)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
              title={t('gallery.display_options')}
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">{t('gallery.display_options')}</span>
            </button>

            <AnimatePresence>
              {showDisplayOptions && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 mb-1">
                    {t('gallery.display_options')}
                  </div>
                  {[
                    { key: 'title', label: t('gallery.show_title') },
                    { key: 'rating', label: t('gallery.show_rating') },
                    { key: 'prompt', label: t('gallery.show_prompt') },
                    { key: 'model', label: t('gallery.show_model') }
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setDisplaySettings((prev: Record<string, boolean>) => ({ ...prev, [option.key]: !prev[option.key] }))}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <span>{option.label}</span>
                      {displaySettings[option.key] ? (
                        <Eye size={14} className="text-teal-400" />
                      ) : (
                        <EyeOff size={14} className="text-slate-600" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          

          <button
            onClick={() => setShowImportModal(true)}
            disabled={importingNightcafe}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 text-sm font-medium rounded-xl hover:bg-indigo-500/20 transition-colors border border-indigo-500/20 disabled:opacity-50"
          >
            {importingNightcafe ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
            {t('prompts.import.title')}
          </button>
          <button
            onClick={() => openItemEditor(null)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} />
            {t('gallery.add_item')}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('gallery.search')}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
            <Star size={14} className="text-slate-400" />
            <StarRating rating={filterRating} onChange={handleFilterRatingChange} size={16} />
          </div>
        </div>
        <GridDensitySelector storageKey="gallery-grid-density" defaultValue={3} />
      </div>

      {collections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterCollectionChange(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${!filterCollection
              ? 'bg-white/10 border-white/20 text-white'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
          >
            All
          </button>
          {collections.map((coll) => (
            <div key={coll.id} className="flex items-center gap-0.5">
              <DynamicColorElement
                tag="button"
                onClick={() => handleFilterCollectionChange(filterCollection === coll.id ? null : coll.id)}
                className={`px-3 py-1.5 rounded-l-xl text-xs font-medium transition-all border ${filterCollection === coll.id
                  ? 'border-amber-500/30 text-amber-400 dynamic-bg-color-alpha'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                cssVars={filterCollection === coll.id ? { '--bg-color': coll.color } : {}}
              >
                <DynamicColorElement
                  tag="span"
                  className="inline-block w-2 h-2 rounded-full mr-1.5 dynamic-bg-color"
                  cssVars={{ '--bg-color': coll.color }}
                />
                {coll.name}
              </DynamicColorElement>
              <button
                onClick={() => setDeleteCollectionConfirmId(coll.id)}
                className="px-1.5 py-1.5 rounded-r-xl text-xs border border-l-0 border-slate-700 text-slate-600 hover:text-red-400 transition-colors"
                aria-label="Delete collection"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="text-teal-400 animate-spin" />
        </div>
      ) : !loading && filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={28} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">
            {search || filterCollection || filterRating > 0 ? 'No matching items' : 'Gallery is empty'}
          </h3>
          <p className="text-sm text-slate-400">
            {search || filterCollection || filterRating > 0
              ? 'Try adjusting your filters'
              : 'Add your first gallery item'}
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="dynamic-grid"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item, index) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.05, 0.5),
                  layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
                }}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group w-full min-w-0"
              >
                <div className="aspect-square bg-slate-800 relative overflow-hidden cursor-pointer" onClick={() => openLightbox(item)}>
                  <MediaRenderer
                    item={item}
                    autoPlay
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openItemEditor(item);
                      }}
                      className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                      title="Edit item"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteItemConfirmId(item.id);
                      }}
                      className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-red-500/70 transition-colors"
                      title="Delete item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  {displaySettings.title && (
                    <h3 className="text-xs font-medium text-white truncate">{item.title || t('common.untitled')}</h3>
                  )}

                  {(displaySettings.rating || displaySettings.model) && (
                    <div className="flex items-center justify-between mt-1.5 overflow-hidden">
                      {displaySettings.rating && (
                        <StarRating rating={item.rating} onChange={(r) => handleUpdateRating(item, r)} size={11} />
                      )}
                      {displaySettings.model && item.model && (
                        <span className="text-[9px] text-slate-500 truncate max-w-[120px] ml-auto uppercase tracking-tighter">
                          {item.model}
                        </span>
                      )}
                      {!displaySettings.model && item.collection_id && (
                        <span className="text-[10px] text-slate-500 truncate ml-2">
                          {getCollectionName(item.collection_id)}
                        </span>
                      )}
                    </div>
                  )}

                  {displaySettings.prompt && item.prompt_id && linkedPrompts[item.prompt_id] && (
                    <div className="mt-2 pt-2 border-t border-slate-800">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                        <Link size={8} />
                        {t('common.linked_prompt', { defaultValue: 'Linked Prompt' })}
                      </p>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {linkedPrompts[item.prompt_id]?.content}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i).map((page) => {
              if (
                page === 0 ||
                page === totalPages - 1 ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${currentPage === page
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                  >
                    {page + 1}
                  </button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="text-slate-600 px-2">...</span>;
              }
              return null;
            })}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <Modal
        open={showItemEditor}
        onClose={() => setShowItemEditor(false)}
        title={editingItem ? 'Edit Gallery Item' : 'Add Gallery Item'}
        wide
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Title {!autoGenerateTitle && <span className="text-red-400">*</span>}
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoGenerateTitle}
                    onChange={(e) => setAutoGenerateTitle(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-2 focus:ring-amber-500/40"
                  />
                  Auto-generate from prompt
                </label>
              </div>
              <div className="relative">
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  onBlur={() => handleFieldBlur('title')}
                  disabled={autoGenerateTitle && generatingTitle}
                  placeholder={generatingTitle ? "Generating title..." : "Image title"}
                  maxLength={140}
                  className={`w-full px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${formTouched.title && formErrors.title ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-amber-500/40'}`}
                />
                {generatingTitle && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 animate-spin" />
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                {formTouched.title && formErrors.title ? (
                  <p className="text-xs text-red-400">{formErrors.title}</p>
                ) : <span />}
                <span className={`text-[10px] tabular-nums ${formTitle.length >= 130 ? formTitle.length >= 140 ? 'text-red-400' : 'text-amber-400' : 'text-slate-500'}`}>
                  {formTitle.length} / 140
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Collection</label>
              <select
                value={formCollectionId}
                onChange={(e) => setFormCollectionId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
                aria-label="Select collection"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Model <span className="text-red-400">*</span>
              </label>
              <ModelSelector
                value={formModel}
                onChange={(m) => { setFormModel(m); setFormTouched(prev => ({ ...prev, model: true })); setFormErrors(prev => { const next = { ...prev }; delete next.model; return next; }); }}
                models={allModels}
                providers={allProviders}
              />
              {formTouched.model && formErrors.model && (
                <p className="text-xs text-red-400 mt-1">{formErrors.model}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 p-1 bg-slate-800 rounded-xl mb-4">
            <button
              onClick={() => setFormMediaType('image')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${formMediaType === 'image' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Image
            </button>
            <button
              onClick={() => setFormMediaType('video')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${formMediaType === 'video' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Video
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {formMediaType === 'video' ? 'Video' : 'Image'} <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={formMediaType === 'video' ? formVideoUrl : formImageUrl}
                  onChange={(e) => formMediaType === 'video' ? setFormVideoUrl(e.target.value) : setFormImageUrl(e.target.value)}
                  onBlur={() => handleFieldBlur(formMediaType === 'video' ? 'videoUrl' : 'imageUrl')}
                  placeholder={formMediaType === 'video' ? "Paste video URL or upload below..." : "Paste image URL or upload below..."}
                  className={`flex-1 px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm ${(formTouched.imageUrl || formTouched.videoUrl) && (formErrors.imageUrl || formErrors.videoUrl) ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-amber-500/40'}`}
                />
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer transition-colors text-sm font-medium">
                  {formMediaType === 'video' ? <Loader2 size={16} /> : <ImageIcon size={16} />}
                  Upload
                  <input
                    type="file"
                    accept={formMediaType === 'video' ? "video/*" : "image/*"}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {formMediaType === 'video' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Thumbnail URL (optional)</label>
                    <input
                      value={formThumbnailUrl}
                      onChange={(e) => setFormThumbnailUrl(e.target.value)}
                      placeholder="Paste thumbnail URL..."
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Duration (seconds)</label>
                    <input
                      type="number"
                      min="0"
                      value={formDurationSeconds || ''}
                      onChange={(e) => setFormDurationSeconds(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      placeholder="e.g. 15"
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Storage Mode</label>
                    <select
                      value={formStorageMode}
                      onChange={(e) => setFormStorageMode(e.target.value as "url" | "local" | "both")}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
                    >
                      <option value="url">URL Only</option>
                      <option value="local">Local Only</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                </div>
              )}

              {((formMediaType === 'image' && formImageUrl) || (formMediaType === 'video' && (formVideoUrl || formThumbnailUrl))) && (
                <div className="rounded-xl overflow-hidden bg-slate-800 h-32 relative">
                  <MediaRenderer
                    item={{
                      media_type: formMediaType,
                      image_url: formImageUrl,
                      video_url: formVideoUrl,
                      thumbnail_url: formThumbnailUrl,
                    } as unknown as GalleryItem}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Prompt Used</label>
            <div className="relative">
              <input
                type="text"
                value={promptSearchValue}
                onChange={(e) => handlePromptSearchChange(e.target.value)}
                onFocus={handlePromptInputFocus}
                onBlur={() => setTimeout(() => setShowPromptSuggestions(false), 200)}
                placeholder={selectedPromptId ? "Linked to saved prompt" : "Search saved prompts..."}
                disabled={!!selectedPromptId}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {showPromptSuggestions && promptSuggestions.length > 0 && !selectedPromptId && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {promptSuggestions.map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => selectPrompt(prompt)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                    >
                      <div className="font-medium text-white text-sm mb-1">{prompt.title}</div>
                      <div className="text-xs text-slate-400 line-clamp-2">{prompt.content}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPromptId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPromptId(null);
                  setPromptSearchValue('');
                  setFormPromptUsed('');
                }}
                className="mt-2 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                Unlink prompt
              </button>
            )}
            {formPromptUsed && (
              <div className="mt-2 p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Selected Prompt:</p>
                <p className="text-sm text-slate-200">{formPromptUsed}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any notes about this image..."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Rating</label>
            <StarRating rating={formRating} onChange={setFormRating} size={20} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
            <button
              onClick={() => setShowItemEditor(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveItem}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingItem ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showCollectionEditor}
        onClose={() => setShowCollectionEditor(false)}
        title="New Collection"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <input
              value={collName}
              onChange={(e) => setCollName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={collDesc}
              onChange={(e) => setCollDesc(e.target.value)}
              placeholder="What's this collection about?"
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {['#d97706', '#dc2626', '#059669', '#2563eb', '#db2777', '#0891b2', '#65a30d', '#7c3aed'].map((c) => (
                <DynamicColorElement
                  tag="button"
                  key={c}
                  onClick={() => setCollColor(c)}
                  className={`w-7 h-7 rounded-full transition-all dynamic-bg-color ${collColor === c ? 'ring-2 ring-white scale-110' : ''}`}
                  cssVars={{ '--bg-color': c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
            <button
              onClick={() => setShowCollectionEditor(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCollection}
              disabled={saving || !collName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.title || 'Untitled'}
        wide
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-slate-700">
              <MediaRenderer
                item={selectedItem}
                controls
                className="w-full max-h-[400px] object-contain"
              />
            </div>
            <div className="flex items-center justify-between">
              <StarRating
                rating={selectedItem.rating}
                onChange={(r) => handleUpdateRating(selectedItem, r)}
                size={20}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleLinkPrompt(selectedItem)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedItem.prompt_id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                  title={selectedItem.prompt_id ? 'Linked to prompt' : 'Link to prompt'}
                >
                  <Link size={12} />
                  {selectedItem.prompt_id ? 'Linked' : 'Link Prompt'}
                </button>
                {selectedItem.collection_id && (
                  <span className="text-sm text-slate-400">
                    <FolderOpen size={13} className="inline mr-1" />
                    {getCollectionName(selectedItem.collection_id)}
                  </span>
                )}
              </div>
            </div>
            {selectedItem.prompt_used && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <MessageSquare size={12} /> Prompt Used
                </h4>
                <p className="text-sm text-slate-200 bg-slate-700/50 rounded-xl p-3">{selectedItem.prompt_used}</p>
              </div>
            )}
            {selectedItem.notes && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 mb-1">Notes</h4>
                <p className="text-sm text-slate-300">{selectedItem.notes}</p>
              </div>
            )}
            {selectedItem.image_url && (
              <a
                href={selectedItem.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <ExternalLink size={12} />
                Open full image
              </a>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showPromptSelector}
        onClose={() => {
          setShowPromptSelector(false);
          setLinkingImage(null);
        }}
        title="Select Prompt to Link"
        wide
      >
        <PromptSelector
          onSelect={handleSelectPrompt}
          onCancel={() => {
            setShowPromptSelector(false);
            setLinkingImage(null);
          }}
        />
      </Modal>

      {/* Lightbox Modal */}
      <Modal
        open={!!lightboxImage}
        onClose={closeLightbox}
        title=""
        wide
      >
        {lightboxImage && (
          <div className="relative">
            {/* Image/Video */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden group">
              {/* Background Blur Effect */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                style={{ backgroundImage: `url(${lightboxImage.image_url || lightboxImage.thumbnail_url})` }}
              />
              <MediaRenderer
                item={lightboxImage}
                controls
                className="relative z-10 w-full max-h-[70vh] object-contain transition-transform duration-500"
              />
            </div>

            {/* Navigation */}
            {filtered.length > 1 && (
              <>
                <button
                  onClick={() => navigateLightbox('prev')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  title="Previous"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => navigateLightbox('next')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  title="Next"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* Info */}
            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{lightboxImage.title || 'Untitled'}</h3>
                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                    {lightboxImage.created_at && (
                      <p>Created: {formatDate(lightboxImage.created_at)}</p>
                    )}
                    {lightboxImage.updated_at && lightboxImage.created_at &&
                      formatDate(lightboxImage.updated_at) !== formatDate(lightboxImage.created_at) && (
                        <p>Updated: {formatDate(lightboxImage.updated_at)}</p>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {lightboxImage.collection_id && (
                      <span className="text-sm text-slate-400 flex items-center gap-1">
                        <FolderOpen size={13} />
                        {getCollectionName(lightboxImage.collection_id)}
                      </span>
                    )}
                    {lightboxImage.model && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 border border-slate-600">
                        {lightboxImage.model}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StarRating
                    rating={lightboxImage.rating}
                    onChange={(r) => handleUpdateRating(lightboxImage, r)}
                    size={18}
                  />
                  <button
                    onClick={() => {
                      setSelectedItem(lightboxImage);
                      closeLightbox();
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="View details"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>

              {lightboxImage.prompt_id && linkedPrompts[lightboxImage.prompt_id] && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                    <Link size={12} />
                    Linked Prompt: {linkedPrompts[lightboxImage.prompt_id]?.title}
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {linkedPrompts[lightboxImage.prompt_id]?.content}
                  </p>
                </div>
              )}

              {lightboxImage.prompt_used && (!lightboxImage.prompt_id || !linkedPrompts[lightboxImage.prompt_id]) && (
                <div>
                  <h4 className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                    <MessageSquare size={12} />
                    Prompt Used
                  </h4>
                  <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl p-3">
                    {lightboxImage.prompt_used}
                  </p>
                </div>
              )}

              {lightboxImage.notes && (
                <div>
                  <h4 className="text-xs font-medium text-slate-400 mb-1.5">Notes</h4>
                  <p className="text-sm text-slate-300">{lightboxImage.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {/* Choice Modals */}
      <ChoiceModal
        isOpen={deleteCollectionConfirmId !== null}
        onClose={() => setDeleteCollectionConfirmId(null)}
        title="Delete Collection"
        message="Delete this collection? Items will remain in the gallery."
        choices={[
          {
            label: 'Delete',
            variant: 'danger',
            onClick: () => {
              if (deleteCollectionConfirmId) {
                handleDeleteCollection(deleteCollectionConfirmId);
                setDeleteCollectionConfirmId(null);
              }
            }
          }
        ]}
      />

      <ChoiceModal
        isOpen={deleteItemConfirmId !== null}
        onClose={() => setDeleteItemConfirmId(null)}
        title="Delete Image"
        message="Are you sure you want to delete this image?"
        choices={[
          {
            label: 'Delete',
            variant: 'danger',
            onClick: () => {
              if (deleteItemConfirmId) {
                handleDeleteItem(deleteItemConfirmId);
                setDeleteItemConfirmId(null);
              }
            }
          }
        ]}
      />

      <Modal
        open={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportUrl('');
        }}
        title="Import from NightCafe"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Paste a NightCafe creation URL here to automatically pull the image, prompt, and model into your gallery.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">NightCafe URL</label>
            <input
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://creator.nightcafe.studio/creation/..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => {
                setShowImportModal(false);
                setImportUrl('');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!importUrl) return;
                setShowImportModal(false);
                await handleImportNightcafeUrl(importUrl);
                setImportUrl('');
              }}
              disabled={!importUrl}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </Modal>
      <GalleryLightbox
        images={filtered}
        initialIndex={lightboxImage ? filtered.findIndex(i => i.id === lightboxImage.id) : 0}
        isOpen={!!lightboxImage}
        onClose={closeLightbox}
        onUpdateRating={handleUpdateRating}
        autoPlay={slideshowMode}
        displaySettings={displaySettings}
      />
    </div>
  );
}
