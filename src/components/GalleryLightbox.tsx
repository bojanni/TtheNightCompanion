import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Copy, Star, Play, Pause, Maximize, Minimize, PanelTop, PanelBottom } from 'lucide-react';
import { formatDate } from '../lib/date-utils';
import type { GalleryItem } from '../lib/types';
import { toast } from 'sonner';

interface GalleryLightboxProps {
    images: GalleryItem[];
    initialIndex: number;
    isOpen: boolean;
    onClose: () => void;
    onUpdateRating?: (item: GalleryItem, rating: number) => void;
    minimal?: boolean;
    autoPlay?: boolean;
    displaySettings?: {
        title: boolean;
        rating: boolean;
        prompt: boolean;
        model: boolean;
    };
}

export default function GalleryLightbox({
    images,
    initialIndex,
    isOpen,
    onClose,
    onUpdateRating,
    minimal = false,
    autoPlay = false,
    displaySettings,
}: GalleryLightboxProps) {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zenMode, setZenMode] = useState(() => localStorage.getItem('slideshowZenMode') === 'true');
    const [overlayMode, setOverlayMode] = useState(() => localStorage.getItem('galleryOverlayMode') === 'true');
    const [promptExpanded, setPromptExpanded] = useState(false);

    useEffect(() => {
        localStorage.setItem('slideshowZenMode', String(zenMode));
    }, [zenMode]);

    useEffect(() => {
        localStorage.setItem('galleryOverlayMode', String(overlayMode));
    }, [overlayMode]);
    const [imgError, setImgError] = useState(false);
    const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const touchStartX = useRef<number | null>(null);

    const current = images[currentIndex];

    // Sync index when initialIndex changes (e.g. opening a different item)
    useEffect(() => {
        setCurrentIndex(initialIndex);
        setPromptExpanded(false);
        setImgError(false);
        setIsPlaying(autoPlay);
    }, [initialIndex, isOpen, autoPlay]);

    // Reset imgError when image changes
    useEffect(() => {
        setImgError(false);
    }, [currentIndex]);

    // Auto-scroll active thumbnail into view
    useEffect(() => {
        thumbnailRefs.current[currentIndex]?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
        });
    }, [currentIndex]);

    const navigate = useCallback((direction: 'prev' | 'next') => {
        setCurrentIndex(prev => {
            if (direction === 'prev') return prev === 0 ? images.length - 1 : prev - 1;
            return prev === images.length - 1 ? 0 : prev + 1;
        });
        setPromptExpanded(false);
    }, [images.length]);

    // Slideshow logic
    useEffect(() => {
        if (!isOpen || !isPlaying || images.length <= 1) return;

        const interval = setInterval(() => {
            navigate('next');
        }, 5000); // 5 seconds per slide

        return () => clearInterval(interval);
    }, [isOpen, isPlaying, images.length, navigate]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft') navigate('prev');
            if (e.key === 'ArrowRight') navigate('next');
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, navigate, onClose]);

    // Touch swipe
    function onTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0]?.clientX ?? 0;
    }
    function onTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current === null) return;
        const delta = touchStartX.current - (e.changedTouches[0]?.clientX ?? 0);
        if (Math.abs(delta) > 50) navigate(delta > 0 ? 'next' : 'prev');
        touchStartX.current = null;
    }

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    function handleCopyPrompt() {
        if (!current?.prompt_used) return;
        navigator.clipboard.writeText(current.prompt_used);
        toast.success('Prompt copied');
    }

    if (!isOpen || !current) return null;

    const imageUrl = current.image_url || current.thumbnail_url || '';
    const hasMultiple = images.length > 1;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center top-0 left-0 right-0 bottom-0"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* ── Layer 1: blurred background ──────────────────────────────── */}
            <div className="absolute inset-0 overflow-clip bg-slate-950">
                {!imgError && imageUrl && (
                    <img
                        key={currentIndex}
                        src={imageUrl}
                        alt=""
                        aria-hidden
                        onError={() => setImgError(true)}
                        className="absolute -top-20 -right-16 -bottom-16 -left-16 w-[calc(100%+120px)] h-[calc(100%+120px)] object-cover blur-[40px] brightness-[0.35] saturate-[1.4]"
                    />
                )}
            </div>

            {/* ── Layer 2: dark overlay ────────────────────────────────────── */}
            <div className="absolute inset-0 bg-black/40" />

            {/* ── Close button ─────────────────────────────────────────────── */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                aria-label="Close"
            >
                <X size={20} />
            </button>

            {/* ── Fullscreen button ────────────────────────────────────────── */}
            <button
                onClick={toggleFullscreen}
                className="absolute top-4 right-16 z-20 p-2.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                aria-label={isFullscreen ? t('common.exit_fullscreen') : t('common.fullscreen')}
                title={isFullscreen ? t('common.exit_fullscreen') : t('common.fullscreen')}
            >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>

            {/* ── Overlay Mode button ─────────────────────────────────────── */}
            {!zenMode && (
                <button
                    onClick={() => setOverlayMode(!overlayMode)}
                    className="absolute top-4 right-28 z-20 p-2.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                    aria-label={overlayMode ? t('gallery.show_below', { defaultValue: 'Show info below' }) : t('gallery.show_overlay', { defaultValue: 'Show info overlay' })}
                    title={overlayMode ? t('gallery.show_below', { defaultValue: 'Show info below' }) : t('gallery.show_overlay', { defaultValue: 'Show info overlay' })}
                >
                    {overlayMode ? <PanelBottom size={20} /> : <PanelTop size={20} />}
                </button>
            )}

            {/* ── Zen Mode button ─────────────────────────────────────────── */}
            <button
                onClick={() => setZenMode(!zenMode)}
                className="absolute top-4 right-40 z-20 p-2.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                aria-label={zenMode ? t('gallery.show_metadata') : t('gallery.zen_mode')}
                title={zenMode ? t('gallery.show_metadata') : t('gallery.zen_mode')}
            >
                {zenMode ? <Maximize size={20} /> : <Minimize size={20} />}
            </button>

            {/* ── Prev / Next ───────────────────────────────────────────────── */}
            {hasMultiple && (
                <>
                    <button
                        onClick={() => navigate('prev')}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                        aria-label="Previous"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={() => navigate('next')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/60 text-white transition-colors"
                        aria-label="Next"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Slideshow Control */}
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="absolute bottom-24 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-white hover:bg-black/50 transition-all hover:scale-105"
                        title={isPlaying ? t('common.pause') : t('common.play')}
                    >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        <span className="text-sm font-medium">{isPlaying ? t('common.pause') : t('common.play')}</span>
                    </button>
                </>
            )}

            {/* ── Layer 3: content ─────────────────────────────────────────── */}
            <div className={`relative z-10 flex flex-col items-center gap-4 w-full h-full px-4 sm:px-8 lg:px-16 py-6 overflow-y-auto ${overlayMode && !zenMode ? 'justify-center' : ''}`}>

                {/* Main image container */}
                <div className={`relative flex items-center justify-center w-full min-h-0 ${overlayMode && !zenMode ? 'h-full max-h-[92vh]' : 'flex-1'}`}>
                    {imgError || !imageUrl ? (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center">
                                <X size={32} />
                            </div>
                            <p className="text-sm">{t('gallery.image_unavailable', { defaultValue: 'Image unavailable' })}</p>
                        </div>
                    ) : (
                        <img
                            key={`main-${currentIndex}`}
                            src={imageUrl}
                            alt={current.title || t('common.untitled')}
                            onError={() => setImgError(true)}
                            className={`max-w-full rounded-2xl object-contain shadow-2xl animate-in fade-in zoom-in-95 duration-300 ${overlayMode && !zenMode ? 'max-h-[92vh] w-auto' : 'max-h-[70vh]'}`}
                        />
                    )}

                    {/* Overlay prompt card */}
                    {overlayMode && !zenMode && !minimal && (
                        <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm pt-4 pb-4 px-4">
                            <div className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        {(!displaySettings || displaySettings.title) && (
                                            <h3 className="text-white font-semibold text-sm truncate mb-0.5">
                                                {current.title || t('common.untitled')}
                                            </h3>
                                        )}
                                        <div className="flex items-center gap-3 text-[11px] text-slate-300">
                                            {(!displaySettings || displaySettings.model) && current.model && (
                                                <span className="truncate max-w-[160px] uppercase font-bold text-slate-400 tracking-tighter">{current.model}</span>
                                            )}
                                            <span>{formatDate(current.created_at)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-none">
                                        {/* Star rating */}
                                        {(!displaySettings || displaySettings.rating) && onUpdateRating && (
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <button
                                                        key={star}
                                                        onClick={() => onUpdateRating(current, star === current.rating ? 0 : star)}
                                                        className="p-0.5 hover:scale-110 transition-transform"
                                                        aria-label={`Rate ${star} stars`}
                                                    >
                                                        <Star
                                                            size={14}
                                                            className={star <= current.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Copy prompt */}
                                        {current.prompt_used && (
                                            <button
                                                onClick={handleCopyPrompt}
                                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                title={t('common.copy_prompt', { defaultValue: 'Copy prompt' })}
                                            >
                                                <Copy size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Prompt text */}
                                {(!displaySettings || displaySettings.prompt) && current.prompt_used && (
                                    <div>
                                        <p className={`text-[12px] text-slate-200 leading-relaxed ${promptExpanded ? '' : 'line-clamp-3'}`}>
                                            {current.prompt_used}
                                        </p>
                                        {current.prompt_used.length > 150 && (
                                            <button
                                                onClick={() => setPromptExpanded(v => !v)}
                                                className="text-[11px] text-teal-400 hover:text-teal-300 mt-1 transition-colors"
                                            >
                                                {promptExpanded ? t('common.show_less', { defaultValue: 'Show less' }) : t('common.show_more', { defaultValue: 'Show more' })}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Prompt card (below image - only when not in overlay mode) */}
                {(!zenMode && !minimal && !overlayMode) && (
                    <div className="w-full max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                {(!displaySettings || displaySettings.title) && (
                                    <h3 className="text-white font-semibold text-sm truncate mb-0.5">
                                        {current.title || t('common.untitled')}
                                    </h3>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    {(!displaySettings || displaySettings.model) && current.model && (
                                        <span className="truncate max-w-[160px] uppercase font-bold text-slate-500 tracking-tighter">{current.model}</span>
                                    )}
                                    <span>{formatDate(current.created_at)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-none">
                                {/* Star rating */}
                                {(!displaySettings || displaySettings.rating) && onUpdateRating && (
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                onClick={() => onUpdateRating(current, star === current.rating ? 0 : star)}
                                                className="p-0.5 hover:scale-110 transition-transform"
                                                aria-label={`Rate ${star} stars`}
                                            >
                                                <Star
                                                    size={14}
                                                    className={star <= current.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Copy prompt */}
                                {current.prompt_used && (
                                    <button
                                        onClick={handleCopyPrompt}
                                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                        title={t('common.copy_prompt', { defaultValue: 'Copy prompt' })}
                                    >
                                        <Copy size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Prompt text */}
                        {(!displaySettings || displaySettings.prompt) && current.prompt_used && (
                            <div>
                                <p className={`text-[12px] text-slate-300 leading-relaxed ${promptExpanded ? '' : 'line-clamp-4'}`}>
                                    {current.prompt_used}
                                </p>
                                {current.prompt_used.length > 200 && (
                                    <button
                                        onClick={() => setPromptExpanded(v => !v)}
                                        className="text-[11px] text-teal-400 hover:text-teal-300 mt-1 transition-colors"
                                    >
                                        {promptExpanded ? t('common.show_less', { defaultValue: 'Show less' }) : t('common.show_more', { defaultValue: 'Show more' })}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Minimal prompt card */}
                {minimal && current.prompt_used && (
                    <div className="w-full max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3">
                        <p className="text-[12px] text-slate-300 leading-relaxed line-clamp-3">{current.prompt_used}</p>
                    </div>
                )}

                {/* Thumbnail strip */}
                {hasMultiple && (
                    <div className="w-full max-w-2xl">
                        <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
                            {images.map((img, i) => {
                                const thumbUrl = img.image_url || img.thumbnail_url || '';
                                return (
                                    <button
                                        key={img.id}
                                        ref={el => { thumbnailRefs.current[i] = el; }}
                                        onClick={() => { setCurrentIndex(i); setPromptExpanded(false); }}
                                        className={`flex-none w-14 h-14 rounded-lg overflow-hidden transition-all duration-200 ${i === currentIndex
                                            ? 'ring-2 ring-white scale-110 shadow-lg'
                                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                                            }`}
                                    >
                                        <img
                                            src={thumbUrl}
                                            alt={img.title || ''}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
