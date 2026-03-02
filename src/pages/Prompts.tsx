import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, BookTemplate, Heart, Search, Filter, SlidersHorizontal, Plus, Link, Trash2, Edit3, Lock, Zap, Calendar, Clock, Wand2, Copy, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '../lib/date-utils';
import { db } from '../lib/api';
import type { Prompt, GalleryItem } from '../lib/types';
import { MODELS, type ModelInfo } from '../lib/models-data';
import Modal from '../components/Modal';
import PromptEditor from '../components/PromptEditor';
import VariationGenerator from '../components/VariationGenerator';
import { PromptHistory } from '../components/PromptHistory';
import { PromptImprover } from '../components/PromptImprover';
import PromptOptimizer from '../components/PromptOptimizer';
import StarRating from '../components/StarRating';
import TagBadge from '../components/TagBadge';
import ImageSelector from '../components/ImageSelector';
import { handleError, showSuccess } from '../lib/error-handler';
import { toast } from 'sonner';
import GridDensitySelector from '../components/GridDensitySelector';
import { motion, AnimatePresence } from 'framer-motion';
import PromptDetailOverlay from '../components/PromptDetailOverlay';
import { usePromptsState } from '../hooks/usePromptsState';
import ChoiceModal from '../components/ChoiceModal';
import { useHotkeys } from '../hooks/useHotkeys';
import useSSERefresh from '../hooks/useSSERefresh';
import { useExtension } from '../context/ExtensionContext';

const PAGE_SIZE = 20;

interface GalleryItemData { id: string; image_url: string; title: string; rating: number; model?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ImageCarousel({ images, onUnlink, onImageClick, t }: { images: GalleryItemData[], onUnlink: (imgId: string) => void, onImageClick: (img: GalleryItemData) => void, t: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImg = images[currentIndex];

  if (!currentImg) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-0 bg-slate-800 rounded-xl overflow-hidden cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onImageClick(currentImg);
        }}
        title={t('common.view', { defaultValue: `View ${currentImg.title || 'Untitled'}` })}
      >
        <img
          src={currentImg.image_url}
          alt={currentImg.title}
          className="w-full h-full object-cover transition-transform hover:scale-[1.02] absolute inset-0"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlink(currentImg.id);
            }}
            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/80 rounded-lg text-white transition-colors opacity-0 group-hover/carousel:opacity-100 z-10"
            title={t('common.unlink', { defaultValue: 'Unlink image' })}
          >
            <X size={12} />
          </button>
          <div className="absolute bottom-1 left-1 right-1">
            <p className="text-[10px] text-white truncate flex items-center gap-1">
              <Lock size={9} />
              {currentImg.title || t('common.linkedImage', { defaultValue: 'Linked Image' })}
            </p>
          </div>
          {currentImg.model && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-slate-300 backdrop-blur-sm border border-white/10">
              {currentImg.model}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 pointer-events-none">
        <button
          onClick={handlePrevious}
          aria-label="Previous image"
          className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-sm transition-all pointer-events-auto"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={handleNext}
          aria-label="Next image"
          className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-sm transition-all pointer-events-auto"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {images.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'w-3 bg-amber-400' : 'w-1 bg-white/40'
              }`}
          />
        ))}
      </div>
    </>
  );
}

export default function Prompts() {
  const { t } = useTranslation();
  const {
    searchParams, setSearchParams,
    prompts, setPrompts,
    tags,
    loading,
    search, setSearch,
    filterTag, setFilterTag,
    filterType, setFilterType,
    showEditor, setShowEditor,
    editingPrompt, setEditingPrompt,
    showVariations, setShowVariations,
    variationBase, setVariationBase,
    copiedId, setCopiedId,
    showFilters, setShowFilters,
    currentPage, setCurrentPage,
    totalCount,
    showHistory, setShowHistory,
    historyPrompt, setHistoryPrompt,
    showImprover, setShowImprover,
    improverPrompt, setImproverPrompt,
    showOptimizer, setShowOptimizer,
    optimizerPrompt, setOptimizerPrompt,
    showImageSelector, setShowImageSelector,
    linkingPrompt, setLinkingPrompt,
    linkedImages, setLinkedImages,
    lightboxImage, setLightboxImage,
    detailViewIndex, setDetailViewIndex,
    deleteConfirmId, setDeleteConfirmId,
    filtered,
    loadData,
    handleDelete,
    handleRatePrompt,
    handleToggleFavorite,
    importingNightcafe,
    handleImportNightcafeUrl,
    getTagsForPrompt,
  } = usePromptsState();

  const { connectionStatus } = useExtension();
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useSSERefresh((item) => {
    toast.success(`Nieuw prompt geïmporteerd: "${item.title}"`);

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(0);
      loadData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useHotkeys('/', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    setEditingPrompt(null);
    setShowEditor(true);
  });

  useEffect(() => {
    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle deep linking
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && prompts.length > 0 && detailViewIndex === null) {
      const index = prompts.findIndex(p => p.id === openId);
      if (index !== -1) {
        setDetailViewIndex(index);
        // Remove the param from URL using setSearchParams to ensure react-router knows about the change
        setSearchParams(params => {
          const newParams = new URLSearchParams(params);
          newParams.delete('open');
          return newParams;
        }, { replace: true });
      }
    }
  }, [prompts, searchParams, detailViewIndex, setSearchParams, setDetailViewIndex]);







  async function handleCopy(content: string, id: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showSuccess('Copied to clipboard!');
    } catch (err) {
      handleError(err, 'CopyPrompt', { promptId: id });
    }
  }



  async function handleRestoreVersion(content: string) {
    if (historyPrompt) {
      try {
        const { error } = await db
          .from('prompts')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', historyPrompt.id);

        if (error) throw error;

        setShowHistory(false);
        loadData();
        showSuccess('Version restored successfully!');
      } catch (err) {
        handleError(err, 'RestoreVersion', { promptId: historyPrompt.id });
      }
    }
  }

  async function handleApplyImprovement(content: string) {
    if (improverPrompt) {
      try {
        const { error } = await db
          .from('prompts')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', improverPrompt.id);

        if (error) throw error;

        setShowImprover(false);
        loadData();
        showSuccess('Improvement applied successfully!');
      } catch (err) {
        handleError(err, 'ApplyImprovement', { promptId: improverPrompt.id });
      }
    }
  }

  async function handleApplyOptimization(content: string) {
    if (optimizerPrompt) {
      try {
        const { error } = await db
          .from('prompts')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', optimizerPrompt.id);

        if (error) throw error;

        setShowOptimizer(false);
        loadData();
        showSuccess('Optimization applied successfully!');
      } catch (err) {
        handleError(err, 'ApplyOptimization', { promptId: optimizerPrompt.id });
      }
    }
  }

  async function handleLinkImage(prompt: Prompt) {
    setLinkingPrompt(prompt);
    setShowImageSelector(true);
  }

  async function handleSelectImage(image: { id: string; image_url: string; title: string; rating: number; model?: string }) {
    if (!linkingPrompt) return;
    try {
      // Check if already linked
      const currentImages = linkedImages[linkingPrompt.id] || [];
      if (currentImages.find(img => img.id === image.id)) {
        setShowImageSelector(false);
        setLinkingPrompt(null);
        return;
      }

      const currentRating = linkingPrompt.rating || 0;
      await db.from('gallery_items').update({ prompt_id: linkingPrompt.id, rating: currentRating }).eq('id', image.id);

      setLinkedImages(prev => ({
        ...prev,
        [linkingPrompt.id]: [
          ...(prev[linkingPrompt.id] || []),
          {
            id: image.id,
            image_url: image.image_url,
            title: image.title,
            rating: currentRating,
            ...(image.model ? { model: image.model } : {})
          }
        ]
      }));

      setShowImageSelector(false);
      setLinkingPrompt(null);
      showSuccess('Image linked successfully!');
    } catch (err) {
      handleError(err, 'LinkImage', { promptId: linkingPrompt.id, imageId: image.id });
    }
  }

  async function handleUnlinkImage(promptId: string, imageId: string) {
    try {
      await db.from('gallery_items').update({ prompt_id: null }).eq('id', imageId);
      setLinkedImages(prev => {
        const newMap = { ...prev };
        if (newMap[promptId]) {
          newMap[promptId] = newMap[promptId].filter(img => img.id !== imageId);
          if (newMap[promptId].length === 0) {
            delete newMap[promptId];
          }
        }
        return newMap;
      });
      showSuccess('Image unlinked successfully!');
    } catch (err) {
      handleError(err, 'UnlinkImage', { promptId, imageId });
    }
  }

  async function handleUpdateGalleryItemRating(imageId: string, rating: number) {
    try {
      const { error } = await db.from('gallery_items').update({ rating }).eq('id', imageId);
      if (error) throw error;

      // Find which prompt this image belongs to
      let parentPromptId: string | null = null;
      setLinkedImages(prev => {
        const newMap = { ...prev };
        for (const promptId in newMap) {
          const imageIndex = newMap[promptId]!.findIndex(img => img.id === imageId);
          if (imageIndex !== -1) {
            parentPromptId = promptId;
            const newImages = [...(newMap[promptId] || [])];
            newImages[imageIndex] = { ...newImages[imageIndex]!, rating };
            newMap[promptId] = newImages;
            break;
          }
        }
        return newMap;
      });

      // If it belongs to a prompt, sync the prompt and other sibling images
      if (parentPromptId) {
        // Sync parent prompt
        await db.from('prompts').update({ rating }).eq('id', parentPromptId);
        setPrompts(prev => prev.map(p => p.id === parentPromptId ? { ...p, rating } : p));

        // Sync sibling images (including this one, but that's okay)
        await db.from('gallery_items').update({ rating }).eq('prompt_id', parentPromptId);

        // Update local state for all sibling images
        setLinkedImages(prev => ({
          ...prev,
          [parentPromptId!]: prev[parentPromptId!]!.map(img => ({ ...img, rating }))
        }));
      }

      // Update lightbox image if open
      if (lightboxImage && lightboxImage.id === imageId) {
        setLightboxImage({ ...lightboxImage, rating });
      }
    } catch (err) {
      handleError(err, 'RateGalleryItem', { imageId });
    }
  }

  function handleImageAdded(promptId: string, image: { id: string; image_url: string; title: string; rating: number; model?: string }) {
    setLinkedImages(prev => ({
      ...prev,
      [promptId]: [
        ...(prev[promptId] || []),
        image
      ]
    }));
  }



  const navigateDetail = (direction: 'next' | 'prev') => {
    if (detailViewIndex === null) return;
    let newIndex = direction === 'next' ? detailViewIndex + 1 : detailViewIndex - 1;
    if (newIndex < 0) newIndex = filtered.length - 1;
    if (newIndex >= filtered.length) newIndex = 0;
    setDetailViewIndex(newIndex);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleFilterChange(type: 'all' | 'templates' | 'favorites') {
    setFilterType(type);
    setCurrentPage(0);
  }

  function handleTagFilterChange(tagId: string | null) {
    setFilterTag(tagId);
    setCurrentPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between min-h-[64px]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Prompts</h1>
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
              t('prompts.subtitle', { count: totalCount, defaultValue: `${totalCount} prompts in your library` })
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            disabled={importingNightcafe}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 text-sm font-medium rounded-xl hover:bg-indigo-500/20 transition-colors border border-indigo-500/20 disabled:opacity-50"
          >
            {importingNightcafe ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
            Import From NightCafe
          </button>
          <button
            onClick={() => {
              setEditingPrompt(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} />
            New Prompt
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('prompts.search')}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${showFilters || filterTag
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <Filter size={14} />
              {t('prompts.filters.title', { defaultValue: 'Filters' })}
            </button>
            {(['all', 'templates', 'favorites'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filterType === type
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
              >
                {type === 'templates' && <BookTemplate size={13} />}
                {type === 'favorites' && <Heart size={13} />}
                {type === 'all' && <SlidersHorizontal size={13} />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <GridDensitySelector storageKey="prompts-grid-density" defaultValue={3} />
      </div>

      {showFilters && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => handleTagFilterChange(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!filterTag
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            {t('prompts.filters.allTags')}
          </button>
          {tags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onClick={() => handleTagFilterChange(filterTag === tag.id ? null : tag.id)}
              selected={filterTag === tag.id}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="text-teal-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wand2 size={28} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">
            {search || filterTag || filterType !== 'all' ? t('prompts.empty.noMatching') : t('prompts.empty.noPrompts')}
          </h3>
          <p className="text-sm text-slate-400">
            {search || filterTag || filterType !== 'all'
              ? t('prompts.empty.adjustFilters')
              : t('prompts.empty.createFirst')}
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="dynamic-grid"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((prompt, index) => {
              const promptTags = getTagsForPrompt(prompt.id);
              const promptImages = linkedImages[prompt.id];
              return (
                <motion.div
                  layout
                  key={prompt.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(index * 0.05, 0.5),
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
                  }}
                  onClick={() => setDetailViewIndex(index)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col hover:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group w-full min-w-0 overflow-hidden cursor-pointer"
                >
                  <div className="p-5 pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{prompt.title || 'Untitled'}</h3>
                        {prompt.is_template && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-teal-500/10 text-teal-400 rounded-md flex-shrink-0">
                            Template
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(prompt); }}
                        className="flex-shrink-0 ml-2"
                        title={prompt.is_favorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart
                          size={16}
                          className={
                            prompt.is_favorite
                              ? 'fill-rose-400 text-rose-400'
                              : 'text-slate-600 hover:text-rose-400 transition-colors'
                          }
                        />
                      </button>
                    </div>



                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-2">
                      <span className="flex items-center gap-1" title={`Created: ${formatDate(prompt.created_at)}`}>
                        <Calendar size={10} />
                        {formatDate(prompt.created_at).split(' ')[0]}
                      </span>
                      {prompt.updated_at !== prompt.created_at && (
                        <span className="flex items-center gap-1" title={`Updated: ${formatDate(prompt.updated_at)}`}>
                          <Clock size={10} />
                          {formatDate(prompt.updated_at).split(' ')[1]}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-3 h-[3.75rem]">{prompt.content}</p>

                    <div className="h-20 overflow-hidden mb-4">
                      <div className="flex flex-wrap gap-1">
                        {promptTags.length > 0 ? (
                          promptTags.slice(0, 15).map((tag) => (
                            <TagBadge key={tag.id} tag={tag} />
                          ))
                        ) : (
                          <span className="text-xs text-slate-600 italic py-0.5">No tags</span>
                        )}
                      </div>
                    </div>

                    {prompt.model && (
                      <div className="flex items-center gap-3 mb-3 pt-2 border-t border-slate-800/50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Zap size={12} className="text-amber-500 shrink-0" />
                          <span className="text-[10px] font-medium text-slate-400 truncate" title={prompt.model}>
                            {prompt.model}
                          </span>
                        </div>
                        {prompt.suggested_model && prompt.model !== prompt.suggested_model && (
                          <div className="flex items-center gap-1.5 min-w-0 pl-3 border-l border-slate-800/50">
                            <Sparkles size={12} className="text-teal-500 shrink-0" />
                            <span className="text-[10px] font-medium text-slate-400 truncate" title={`Suggested: ${prompt.suggested_model}`}>
                              {(() => {
                                try {
                                  if (prompt.suggested_model?.startsWith('{')) {
                                    const parsed = JSON.parse(prompt.suggested_model);
                                    return parsed.name || parsed.id || prompt.suggested_model;
                                  }
                                  // Look up model by ID if it's just an ID
                                  const modelInfo = MODELS?.find((m: ModelInfo) => m.id === prompt.suggested_model);
                                  return modelInfo ? modelInfo.name : prompt.suggested_model;
                                } catch {
                                  return prompt.suggested_model;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 pb-5">
                    {promptImages && promptImages.length > 0 && (
                      <div className="relative mb-3 group/carousel">
                        {/* Carousel Container */}
                        <div className="relative w-full aspect-square bg-slate-800 rounded-xl overflow-hidden cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Find current index state, or default to 0
                            // Just open the first item for now if clicked on the image directly
                            if (promptImages[0]) setLightboxImage(promptImages[0]);
                          }}
                        >
                          <img
                            src={promptImages[0]?.image_url}
                            alt={promptImages[0]?.title}
                            className="w-full h-full object-cover transition-transform hover:scale-[1.02]"
                          />

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkImage(prompt.id, promptImages[0]!.id);
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/80 rounded-lg text-white transition-colors opacity-0 group-hover/carousel:opacity-100 z-10"
                              title={t('common.unlink', { defaultValue: 'Unlink image' })}
                            >
                              <X size={12} />
                            </button>
                            <div className="absolute bottom-1 left-1 right-1">
                              <p className="text-[10px] text-white truncate flex items-center gap-1">
                                <Lock size={9} />
                                {promptImages[0]?.title || t('common.linkedImage', { defaultValue: 'Linked Image' })}
                              </p>
                            </div>
                            {promptImages[0]?.model && (
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-slate-300 backdrop-blur-sm border border-white/10">
                                {promptImages[0]?.model}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Render custom component for Carousel logic to keep it clean */}
                        {promptImages.length > 1 && (
                          <ImageCarousel images={promptImages} onUnlink={(imgId) => handleUnlinkImage(prompt.id, imgId)} onImageClick={(img) => setLightboxImage(img)} t={t} />
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <StarRating
                        rating={prompt.rating}
                        onChange={(newRating) => handleRatePrompt(prompt.id, newRating)}
                        size={13}
                      />
                      <div className="flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content, prompt.id); }}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-all"
                          title={t('prompts.actions.copy')}
                        >
                          {copiedId === prompt.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLinkImage(prompt); }}
                          className={`p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 transition-all ${promptImages?.length ? 'text-amber-400 hover:text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-slate-400 hover:text-amber-400 hover:border-slate-600 hover:bg-slate-800'}`}
                          title={promptImages?.length ? t('prompts.actions.linked') : t('prompts.actions.link')}
                        >
                          <Link size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOptimizerPrompt(prompt);
                            setShowOptimizer(true);
                          }}
                          disabled={!!promptImages?.length}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-purple-400 hover:border-slate-600 hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title={promptImages?.length ? t('prompts.actions.locked') : t('prompts.actions.optimize')}
                        >
                          <Zap size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImproverPrompt(prompt);
                            setShowImprover(true);
                          }}
                          disabled={!!promptImages?.length}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-orange-400 hover:border-slate-600 hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title={promptImages?.length ? t('prompts.actions.locked') : t('prompts.actions.improve')}
                        >
                          <Sparkles size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryPrompt(prompt);
                            setShowHistory(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-blue-400 hover:border-slate-600 hover:bg-slate-800 transition-all"
                          title={t('prompts.actions.history')}
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVariationBase(prompt.content);
                            setShowVariations(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-amber-400 hover:border-slate-600 hover:bg-slate-800 transition-all"
                          title={t('prompts.actions.variations')}
                        >
                          <Wand2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPrompt(prompt);
                            setShowEditor(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-all"
                          title={promptImages?.length ? t('prompts.actions.editRestricted') : t('common.edit')}
                        >
                          {promptImages && promptImages.length > 0 ? <Lock size={14} className="text-amber-500/80" /> : <Edit3 size={14} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(prompt.id); }}
                          className="p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/20 transition-all"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )
      }

      {
        totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              {t('common.previous')}
            </button>
            <span className="text-sm text-slate-500 font-medium">
              {t('generator.slider.words', { count: currentPage + 1 })} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('common.next')}
              <ChevronRight size={16} />
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
        )
      }

      <Modal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        title={editingPrompt ? 'Edit Prompt' : 'New Prompt'}
        wide
      >
        <PromptEditor
          prompt={editingPrompt}
          isLinked={!!(editingPrompt && linkedImages[editingPrompt.id]?.length)}
          onSave={() => {
            setShowEditor(false);
            loadData();
          }}
          onCancel={() => setShowEditor(false)}
        />
      </Modal>

      <Modal
        open={showVariations}
        onClose={() => setShowVariations(false)}
        title="Variation Generator"
        wide
      >
        <VariationGenerator
          basePrompt={variationBase}
          onSaved={loadData}
        />
      </Modal>

      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title={`Version History: ${historyPrompt?.title || 'Untitled'}`}
        wide
      >
        {historyPrompt && (
          <PromptHistory
            promptId={historyPrompt.id}
            currentContent={historyPrompt.content}
            onRestore={handleRestoreVersion}
          />
        )}
      </Modal>

      <Modal
        open={showImprover}
        onClose={() => setShowImprover(false)}
        title={`AI Prompt Improvement: ${improverPrompt?.title || 'Untitled'}`}
        wide
      >
        {improverPrompt && (
          <PromptImprover
            prompt={improverPrompt.content}
            onApply={handleApplyImprovement}
          />
        )}
      </Modal>

      <Modal
        open={showOptimizer}
        onClose={() => setShowOptimizer(false)}
        title={`Prompt Optimizer: ${optimizerPrompt?.title || 'Untitled'}`}
        wide
      >
        {optimizerPrompt && (
          <PromptOptimizer
            prompt={optimizerPrompt.content}
            onApply={handleApplyOptimization}
          />
        )}
      </Modal>

      <Modal
        open={showImageSelector}
        onClose={() => {
          setShowImageSelector(false);
          setLinkingPrompt(null);
        }}
        title="Select Image to Link"
        wide
      >
        <ImageSelector
          onSelect={handleSelectImage}
          onCancel={() => {
            setShowImageSelector(false);
            setLinkingPrompt(null);
          }}
        />
      </Modal>

      <AnimatePresence>
        {detailViewIndex !== null && filtered[detailViewIndex] && (
          <PromptDetailOverlay
            prompt={filtered[detailViewIndex]}
            tags={getTagsForPrompt(filtered[detailViewIndex].id)}
            images={(linkedImages[filtered[detailViewIndex].id] || []) as unknown as GalleryItem[]}
            onClose={() => setDetailViewIndex(null)}
            onNext={() => navigateDetail('next')}
            onPrev={() => navigateDetail('prev')}
            onRate={(rating) => {
              const p = filtered[detailViewIndex as number];
              if (p) handleRatePrompt(p.id, rating);
            }}
            onImageUploaded={(image) => {
              const p = filtered[detailViewIndex as number];
              if (p) handleImageAdded(p.id, image);
            }}
          />
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <Modal
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        title=""
        wide
      >
        {lightboxImage && (() => {
          // Find the prompt that owns this image to show/edit PROMPT rating instead of IMAGE rating
          const lightboxPrompt = prompts.find(p => linkedImages[p.id]?.some(img => img.id === lightboxImage.id));

          return (
            <div className="relative bg-slate-950 rounded-xl overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                style={{ backgroundImage: `url(${lightboxImage.image_url})` }}
              />
              <img
                src={lightboxImage.image_url}
                alt={lightboxImage.title}
                className="w-full max-h-[70vh] object-contain rounded-xl"
              />
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{lightboxImage.title}</h3>
                  {lightboxPrompt && lightboxPrompt.title !== lightboxImage.title && (
                    <p className="text-xs text-slate-500">Linked to: {lightboxPrompt.title}</p>
                  )}
                </div>
                <StarRating
                  rating={lightboxPrompt ? lightboxPrompt.rating : lightboxImage.rating}
                  onChange={(r) => {
                    if (lightboxPrompt) {
                      handleRatePrompt(lightboxPrompt.id, r);
                    } else {
                      handleUpdateGalleryItemRating(lightboxImage!.id, r);
                    }
                  }}
                  size={24}
                />
              </div>
            </div>
          );
        })()}
      </Modal>

      <ChoiceModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Prompt"
        message="Are you sure you want to delete this prompt? This action cannot be undone."
        choices={[
          {
            label: 'Delete',
            variant: 'danger',
            onClick: () => {
              if (deleteConfirmId) {
                handleDelete(deleteConfirmId);
                setDeleteConfirmId(null);
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
            Paste a NightCafe creation URL here to automatically pull the image, prompt, and model into your library.
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
    </div >
  );
}
