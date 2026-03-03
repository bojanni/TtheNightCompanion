import { useState, useEffect, useRef, useMemo } from 'react';
import { FolderPlus, CheckCircle, Plus, Loader2, Save, X, Upload, ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Prompt, Tag as TagType, GalleryItem } from '../lib/types';
import { TAG_CATEGORIES, TAG_COLORS } from '../lib/types';
import { db } from '../lib/api';
import { API_BASE_URL } from '../lib/constants';
import { trackKeywordsFromPrompt } from '../lib/style-analysis';
import { PromptSchema } from '../lib/validation-schemas';
import { generateTitle, suggestTags, triggerKeywordExtraction } from '../lib/ai-service';
import { handleAIError } from '../lib/error-handler';
import { MODELS, analyzePrompt } from '../lib/models-data';
import { useNCModels } from '../hooks/useNCModels';
import ModelSelector from './ModelSelector';
import StarRating from './StarRating';
import TagBadge from './TagBadge';
import CollectionManager from './CollectionManager';


interface PromptEditorProps {
  prompt: Prompt | null;
  initialData?: Partial<Prompt>;
  isLinked?: boolean;
  mode?: 'save' | 'edit'; // 'save' = from Generator (simplified), 'edit' = from Prompt Library (full)
  onSave: () => void;
  onCancel: () => void;
}

export default function PromptEditor({ prompt, initialData, isLinked = false, mode = 'edit', onSave, onCancel }: PromptEditorProps) {
  const isSaveMode = mode === 'save';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [model, setModel] = useState('');
  const [suggestedModel, setSuggestedModel] = useState<string | undefined>(undefined);
  const [isTemplate, setIsTemplate] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);

  const ncModelsQuery = useNCModels();

  // Form validation state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});

  // Enhanced Fields
  const [revisedPrompt, setRevisedPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [useCustomAspectRatio, setUseCustomAspectRatio] = useState(false);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string | null>(null);
  const [startImage, setStartImage] = useState<string | null>(null);

  // AI Auto-Generation State
  const [autoGenerateTitle, setAutoGenerateTitle] = useState(true);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagCategory, setNewTagCategory] = useState<string>(TAG_CATEGORIES[0]);

  // Image Upload & Gallery State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadModels, setUploadModels] = useState<string[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [managingCollectionFor, setManagingCollectionFor] = useState<string | null>(null); // gallery_item_id

  // Models State - Derived from static data
  const modelsForDropdown = ncModelsQuery.data ?? MODELS;

  const availableModels = useMemo(() => modelsForDropdown.map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    description: m.description
  })), [modelsForDropdown]);

  const availableProviders = useMemo(() => {
    const uniqueProviders = Array.from(new Set(modelsForDropdown.map(m => m.provider)));
    return uniqueProviders.map(p => ({
      id: p,
      name: p,
      type: 'cloud' as const
    }));
  }, [modelsForDropdown]);

  const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'];

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await db.from('tags').select('*').order('name');
      setAllTags(data ?? []);

      if (prompt) {
        const { data: ptData } = await db
          .from('prompt_tags')
          .select('tag_id')
          .eq('prompt_id', prompt.id);
        setSelectedTagIds(ptData?.map((pt: { tag_id: string }) => pt.tag_id) ?? []);

        // Load linked gallery items
        const { data: gData } = await db
          .from('gallery_items')
          .select('*')
          .eq('prompt_id', prompt.id)
          .order('created_at', { ascending: false });
        setGalleryItems(gData || []);
      }
    };

    if (prompt) {
      setTitle(prompt.title || '');
      setContent(prompt.content || '');
      setNotes(prompt.notes || '');
      setRating(Number(prompt.rating) || 0);
      setModel(prompt.model || '');
      setIsTemplate(!!prompt.is_template);
      setIsFavorite(!!prompt.is_favorite);
      setRevisedPrompt(prompt.revised_prompt || '');
      setNegativePrompt(prompt.negative_prompt || '');
      setSeed(prompt.seed);
      setAspectRatio(prompt.aspect_ratio || '1:1');
      setUseCustomAspectRatio(prompt.use_custom_aspect_ratio || false);
      setStartImage(prompt.start_image || null);
      setAutoGenerateTitle(false); // Don't auto-gen on edit
    } else {
      // New prompt default values
      const lastModel = localStorage.getItem('lastUsedModel');
      if (lastModel) setModel(lastModel);

      if (initialData) {
        if (initialData.title != null) {
          setTitle(String(initialData.title));
          setAutoGenerateTitle(false);
        }
        if (initialData.content != null) setContent(String(initialData.content));
        if (initialData.notes != null) setNotes(String(initialData.notes));
        if (initialData.model != null) setModel(String(initialData.model));
        if (initialData.suggested_model != null) setSuggestedModel(String(initialData.suggested_model));
        if (initialData.rating != null) setRating(Number(initialData.rating) || 0);
        if (initialData.is_template !== undefined) setIsTemplate(initialData.is_template);
        if (initialData.is_favorite !== undefined) setIsFavorite(initialData.is_favorite);
        if (initialData.revised_prompt != null) setRevisedPrompt(String(initialData.revised_prompt));
        if (initialData.negative_prompt != null) setNegativePrompt(String(initialData.negative_prompt));
      }
    }

    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);
  const suggestedModelObj = useMemo(() => {
    return content.trim() ? analyzePrompt(content)[0]?.model : null;
  }, [content]);

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const { data } = await db
      .from('tags')
      .insert({ name: newTagName.trim(), color: newTagColor, category: newTagCategory })
      .select()
      .maybeSingle();
    if (data) {
      setAllTags((prev) => [...prev, data]);
      setSelectedTagIds((prev) => [...prev, data.id]);
      setNewTagName('');
      setShowNewTag(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles: File[] = [];

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped non-image: ${file.name}`);
        return;
      }
      newFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFilePreviews(prev => [...prev, result]);
        setUploadModels(prev => [...prev, model]);

        // Auto-detect aspect ratio from first image if not set
        if (newFiles.indexOf(file) === 0 && !detectedAspectRatio) {
          const img = new Image();
          img.onload = () => {
            const ratio = img.width / img.height;
            // Find closest standard ratio
            let closest = '1:1';
            let minDiff = Infinity;
            const standardRatios = { '1:1': 1, '16:9': 16 / 9, '9:16': 9 / 16, '4:3': 4 / 3, '3:4': 3 / 4, '3:2': 3 / 2, '2:3': 2 / 3, '21:9': 21 / 9 };
            for (const [key, val] of Object.entries(standardRatios)) {
              const diff = Math.abs(ratio - val);
              if (diff < minDiff) { minDiff = diff; closest = key; }
            }
            setDetectedAspectRatio(closest);
            if (!useCustomAspectRatio) setAspectRatio(closest);
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }



  async function handleSetMainImage(galleryItemId: string) {
    if (!prompt) return;
    try {
      const { error } = await db.from('prompts').update({ gallery_item_id: galleryItemId }).eq('id', prompt.id);
      if (error) throw error;
      toast.success('Main image updated');
      onSave(); // Reload parent
    } catch {
      toast.error('Failed to update main image');
    }
  }

  async function handleAddToCollection(collectionId: string) {
    if (!managingCollectionFor) return;
    try {
      // If collectionId is empty string, it means remove from collection
      const colId = collectionId || null;
      const { error } = await db.from('gallery_items').update({ collection_id: colId }).eq('id', managingCollectionFor);
      if (error) throw error;

      setGalleryItems(prev => prev.map(item => item.id === managingCollectionFor ? { ...item, collection_id: colId } : item));
      toast.success(colId ? 'Added to collection' : 'Removed from collection');
      setManagingCollectionFor(null);
      setShowCollectionManager(false);
    } catch {
      toast.error('Failed to update collection');
    }
  }


  async function handleDeleteGalleryItem(itemId: string) {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await db.from('gallery_items').delete().eq('id', itemId);
      if (error) throw error;
      
      // Update local state to remove the deleted item
      setGalleryItems(prev => prev.filter(item => item.id !== itemId));
      
      // If this was the main image for the prompt, remove the reference
      if (prompt && prompt.gallery_item_id === itemId) {
        await db.from('prompts').update({ gallery_item_id: null }).eq('id', prompt.id);
      }
      
      toast.success('Image deleted successfully');
    } catch (err) {
      console.error('Failed to delete gallery item:', err);
      toast.error('Failed to delete image');
    }
  }




  async function generateTags() {
    if (isGeneratingTags || !content.trim()) return;

    setIsGeneratingTags(true);
    try {
      const tagString = await suggestTags(content, 'dummy-token');
      if (tagString) {
        const suggestedTags = tagString.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

        // Find existing tags that match
        const existingTagsMap = new Map(allTags.map(t => [t.name.toLowerCase(), t]));
        const newTagIds = [...selectedTagIds];
        const tagsToCreate: string[] = [];

        suggestedTags.forEach(tagName => {
          const existing = existingTagsMap.get(tagName);
          if (existing) {
            if (!newTagIds.includes(existing.id)) newTagIds.push(existing.id);
          } else {
            tagsToCreate.push(tagName);
          }
        });

        // Create new tags if they don't exist
        if (tagsToCreate.length > 0) {
          const createdTags = await Promise.all(tagsToCreate.map(async (name) => {
            const { data } = await db
              .from('tags')
              .insert({
                name: name,
                color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
                category: 'General'
              })
              .select()
              .maybeSingle();
            return data;
          }));

          createdTags.forEach(tag => {
            if (tag) {
              newTagIds.push(tag.id);
              // Update local formatted cache to avoid refetch
              setAllTags(prev => [...prev, tag]);
            }
          });
        }

        setSelectedTagIds(newTagIds);
      }
    } catch (e) {
      handleAIError(e);
    } finally {
      setIsGeneratingTags(false);
    }
  }

  async function handlePromptBlur() {
    if (!content.trim()) return;

    // Generate Title
    if (autoGenerateTitle && !title && !isGeneratingTitle) {
      setIsGeneratingTitle(true);
      try {
        const newTitle = await generateTitle(content, 'dummy-token');
        if (newTitle) setTitle(newTitle.replace(/^"|"$/g, '').trim()); // Remove quotes if present
      } catch (e) {
        console.error('Failed to generate title:', e);
        // Silent fail for title auto-gen
      } finally {
        setIsGeneratingTitle(false);
      }
    }

    // Generate Tags - Auto-suggest removed
  }

  function validatePromptForm() {
    const errors: Record<string, string> = {};
    if (!autoGenerateTitle && !title.trim()) {
      errors.title = 'Title is required when auto-generate is off';
    }
    if (!content.trim()) {
      errors.content = 'Prompt content is required';
    }
    // Only require model in edit mode (not in save mode from Generator)
    if (!isSaveMode && !model) {
      errors.model = 'Please select a model';
    }
    return errors;
  }

  function handleValidationBlur(field: string) {
    setFormTouched(prev => ({ ...prev, [field]: true }));
    setFormErrors(validatePromptForm());
  }

  async function handleSave() {
    // Mark all required fields as touched
    setFormTouched({ title: true, content: true, model: true });
    const errors = validatePromptForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);

    try {
      const validated = PromptSchema.parse({
        content,
        title: title.trim() || 'Untitled',
        is_template: isTemplate,
        rating: Number(rating) || 0,
        tags: [],
        negative_prompt: negativePrompt.trim() || undefined
      });

      // Get suggested model - either from initialData (AI tools) or from prompt analysis
      let suggestedModelIdToSave: string | undefined;
      if (suggestedModel) {
        suggestedModelIdToSave = suggestedModel;
      } else {
        const topSuggestion = analyzePrompt(validated.content)[0];
        suggestedModelIdToSave = topSuggestion ? topSuggestion.model.id : undefined;
      }

      const payload = {
        title: validated.title,
        content: validated.content,
        notes: isSaveMode ? null : notes,
        rating: isSaveMode ? 0 : (rating ?? 0),
        model: model || null,
        is_template: isSaveMode ? false : validated.is_template,
        is_favorite: isSaveMode ? false : isFavorite,
        revised_prompt: isSaveMode ? null : (revisedPrompt.trim() || null),
        negative_prompt: isSaveMode ? (negativePrompt.trim() || null) : (negativePrompt.trim() || null),
        seed: isSaveMode ? null : (seed || null),
        aspect_ratio: isSaveMode ? null : aspectRatio,
        use_custom_aspect_ratio: isSaveMode ? false : useCustomAspectRatio,
        start_image: isSaveMode ? null : startImage,
        suggested_model: suggestedModelIdToSave,
        updated_at: new Date().toISOString(),
      };

      let promptId = prompt?.id;

      if (prompt) {
        const { error } = await db.from('prompts').update(payload).eq('id', prompt.id);
        if (error) throw error;

        // Broadcast rating update to linked gallery items
        await db.from('gallery_items').update({ rating: payload.rating }).eq('prompt_id', prompt.id);
      } else {
        const { data, error } = await db.from('prompts').insert(payload).select().maybeSingle();
        if (error) {
          console.error('Error creating prompt:', error);
          throw error;
        }
        promptId = data?.id;

      }

      if (promptId) {
        await db.from('prompt_tags').delete().eq('prompt_id', promptId);
        if (selectedTagIds.length > 0) {
          const { error: tagError } = await db
            .from('prompt_tags')
            .insert(selectedTagIds.map((tag_id) => ({ prompt_id: promptId!, tag_id })));
          if (tagError) console.error('Error saving tags:', tagError);
        }

        // Handle Multiple Image Uploads & Linking
        if (selectedFiles.length > 0) {
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            if (!file) continue;
            const formData = new FormData();
            formData.append('image', file);

            try {
              const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
              if (uploadRes.ok) {
                const { url } = await uploadRes.json();

                const { data: galleryItem } = await db.from('gallery_items').insert({
                  title: validated.title || `Prompt Image ${i + 1}`,
                  image_url: url,
                  prompt_used: validated.content,
                  prompt_id: promptId,
                  rating: 0,
                  model: uploadModels[i] || model || null,
                  notes: 'Uploaded via Prompt Editor',
                  created_at: new Date().toISOString()
                }).select().maybeSingle();

                if (galleryItem && i === 0 && !prompt?.gallery_item_id) {
                  // Set first uploaded image as main if none exists
                  await db.from('prompts').update({ gallery_item_id: galleryItem.id }).eq('id', promptId);
                }
              }
            } catch (e) {
              console.error('Upload failed for file', i, e);
            }
          }
          toast.success(`${selectedFiles.length} images processed`);
        }
      }

      if (validated.content.trim()) {
        trackKeywordsFromPrompt(validated.content).catch(() => { });
        if (promptId) {
          triggerKeywordExtraction(promptId, validated.content);
        }
      }

      setSaving(false);
      
      // Show toast for save mode (from Generator)
      if (isSaveMode) {
        toast.success('Prompt saved! Edit details in Prompt Library.');
      }
      
      onSave();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save prompt. Please check all fields.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-sm font-medium text-slate-300">
            Title {!autoGenerateTitle && <span className="text-red-400">*</span>}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <button
              onClick={async () => {
                if (!content.trim()) return;
                setIsGeneratingTitle(true);
                try {
                  const newTitle = await generateTitle(content, 'dummy-token');
                  if (newTitle) setTitle(newTitle.replace(/^"|"$/g, '').trim());
                } catch (e) {
                  handleAIError(e);
                } finally {
                  setIsGeneratingTitle(false);
                }
             
             
             
              
             
             
             
             
             
             
             
             
              }}
              disabled={isGeneratingTitle || !content.trim()}
              className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Wand2 size={12} />
              Regenerate
            </button>
            <div className="w-px h-3 bg-slate-700 mx-1" />
            <input
              type="checkbox"
              checked={autoGenerateTitle}
              onChange={(e) => setAutoGenerateTitle(e.target.checked)}
              className="w-3.5 h-3.5 bg-slate-700 border-slate-600 rounded text-amber-500 focus:ring-amber-500/40"
            />
            <span className="text-xs text-slate-400">Auto-generate</span>
            {isGeneratingTitle && <Loader2 size={12} className="animate-spin text-amber-500 ml-1" />}
          </label>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => handleValidationBlur('title')}
          placeholder="A descriptive name for this prompt"
          maxLength={140}
          className={`w-full px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm ${formTouched.title && formErrors.title ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-amber-500/40'}`}
        />
        <div className="flex items-center justify-between mt-1">
          {formTouched.title && formErrors.title ? (
            <p className="text-xs text-red-400">{formErrors.title}</p>
          ) : <span />}
          <span className={`text-[10px] tabular-nums ${title.length >= 130 ? title.length >= 140 ? 'text-red-400' : 'text-amber-400' : 'text-slate-500'}`}>
            {title.length} / 140
          </span>
        </div>
      </div>

      {/* Model - Show dropdown in edit mode, read-only label in save mode */}
      {!isSaveMode ? (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-slate-300">
              Model <span className="text-red-400">*</span>
            </label>
            {suggestedModelObj && (
              <button
                onClick={() => setModel(suggestedModelObj.id)}
                className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                title="Click to apply suggested model"
              >
                <Wand2 size={12} /> Suggested: {suggestedModelObj.name}
              </button>
            )}
          </div>
          <ModelSelector
            value={model}
            onChange={(id) => { setModel(id); setFormTouched(prev => ({ ...prev, model: true })); setFormErrors(prev => { const next = { ...prev }; delete next.model; return next; }); }}
            models={availableModels}
            providers={availableProviders}
          />
          {formTouched.model && formErrors.model && (
            <p className="text-xs text-red-400 mt-1">{formErrors.model}</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Suggested Model
          </label>
          <div className="px-4 py-2.5 bg-slate-700/30 border border-slate-600 rounded-xl text-amber-400 text-sm flex items-center gap-2">
            <Wand2 size={14} />
            {suggestedModel ? suggestedModel : (suggestedModelObj ? suggestedModelObj.name : 'No suggestion available')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">You can select a model later in Prompt Library</p>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-sm font-medium text-slate-300">
            Prompt {!isSaveMode && <span className="text-red-400">*</span>}
          </label>
          {isLinked && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Linked to image - content locked
            </span>
          )}
        </div>
        {isSaveMode ? (
          <div className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-slate-300 text-sm resize-none whitespace-pre-wrap">
            {content || 'No prompt content'}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Your full prompt text..."
            rows={5}
            onBlur={() => { handlePromptBlur(); handleValidationBlur('content'); }}
            disabled={isLinked}
            className={`w-full px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm resize-none ${isLinked ? 'opacity-50 cursor-not-allowed' : ''} ${formTouched.content && formErrors.content ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-amber-500/40'}`}
          />
        )}
        {formTouched.content && formErrors.content && (
          <p className="text-xs text-red-400 mt-1">{formErrors.content}</p>
        )}
      </div>

      {/* Negative Prompt - Show in save mode if there's a negative prompt */}
      {isSaveMode && negativePrompt && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-red-300">
              Negative Prompt
            </label>
            <span className={`text-[10px] font-mono ${negativePrompt.length > 900 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
              {negativePrompt.length}/1000
            </span>
          </div>
          <div className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-red-200 text-sm resize-none whitespace-pre-wrap">
            {negativePrompt}
          </div>
        </div>
      )}

      {/* Advanced Settings - Only show in edit mode */}
      {!isSaveMode && (
        <div className="pt-2 border-t border-slate-700/50">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-4"
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Advanced Prompt Settings
          </button>

          {showAdvanced && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Seed</label>
              <input
                type="number"
                value={seed ?? ''}
                onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Random (-1)"
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1">Set a fixed seed for reproducible results.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Enhanced prompt (by NC)</label>
              <textarea
                value={revisedPrompt}
                onChange={(e) => setRevisedPrompt(e.target.value)}
                placeholder="Model-specific version of the prompt..."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-700/30 border border-slate-700 rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm resize-none font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Image (Optional)</label>
              {startImage ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-600 group">
                  <img src={startImage} alt="Start" className="w-full h-full object-cover" />
                  <button
                    title="Remove start image"
                    onClick={() => setStartImage(null)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <X className="text-white w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => document.getElementById('start-image-upload')?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <Upload size={14} />
                    Upload Image
                  </button>
                  <input
                    id="start-image-upload"
                    title="Upload start image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const formData = new FormData();
                      formData.append('image', file);

                      try {
                        const res = await fetch(`${API_BASE_URL}/api/upload`, {
                          method: 'POST',
                          body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                          setStartImage(data.url);
                          toast.success('Start image uploaded');
                        }
                      } catch {
                        toast.error('Failed to upload start image');
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      {/* Notes - Only show in edit mode */}
      {!isSaveMode && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What worked well? What to try next time?"
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm resize-none"
          />
        </div>
      )}

      {/* Rating, Template, Favorite - Only show in edit mode */}
      {!isSaveMode && (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Rating</label>
            <StarRating rating={rating} onChange={setRating} size={20} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-amber-500 focus:ring-amber-500/40"
            />
            <span className="text-sm text-slate-300">Template</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-amber-500 focus:ring-amber-500/40"
            />
            <span className="text-sm text-slate-300">Favorite</span>
          </label>
        </div>
      )}

      {/* Tags - Only show in edit mode */}
      {!isSaveMode && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-slate-300">Tags</label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <button
                onClick={generateTags}
                disabled={isGeneratingTags || !content.trim()}
                className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Wand2 size={12} />
                (Re)Generate Tags
              </button>
              {isGeneratingTags && <Loader2 size={12} className="animate-spin text-amber-500 ml-1" />}
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allTags.filter(t => selectedTagIds.includes(t.id)).map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                onClick={() => toggleTag(tag.id)}
                selected={true}
              />
            ))}
            <button
              onClick={() => setShowNewTag(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              <Plus size={12} /> Add Tag
            </button>
          </div>

          {showNewTag && (
            <div className="p-3 bg-slate-700/30 rounded-xl space-y-3">
              <div className="flex flex-col gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Search or Create Tag</label>
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Type tag name..."
                    className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                    autoFocus
                  />

                  {/* Autocomplete Suggestions Container */}
                  {newTagName.trim() && (
                    <div className="mt-2 p-2 bg-slate-800/80 border border-slate-700/50 rounded-lg max-h-40 overflow-y-auto">
                      {allTags.filter(t => t.name.toLowerCase().includes(newTagName.toLowerCase()) && !selectedTagIds.includes(t.id)).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allTags
                            .filter(t => t.name.toLowerCase().includes(newTagName.toLowerCase()) && !selectedTagIds.includes(t.id))
                            .slice(0, 15)
                            .map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => { toggleTag(tag.id); setNewTagName(''); }}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 rounded-md text-xs text-white transition-all flex items-center gap-1.5"
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#64748b' }} />
                                {tag.name}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic px-1 py-0.5">No existing tags match "{newTagName}". You can create it below.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/50 mt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">New Tag Color</label>
                    <div className="flex gap-1">
                      {TAG_COLORS.map((c) => {
                        const colorMap: Record<string, string> = {
                          '#d97706': 'bg-amber-600',
                          '#dc2626': 'bg-red-600',
                          '#059669': 'bg-emerald-600',
                          '#2563eb': 'bg-blue-600',
                          '#7c3aed': 'bg-violet-600',
                          '#db2777': 'bg-pink-600',
                          '#0891b2': 'bg-cyan-600',
                          '#65a30d': 'bg-lime-600'
                        };
                        return (
                          <button
                            key={c}
                            onClick={() => setNewTagColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${newTagColor === c ? 'ring-2 ring-white scale-110' : ''} ${colorMap[c] || 'bg-slate-600'}`}
                            aria-label={`Select color ${c}`}
                            title={`Select color ${c}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category</label>
                    <select
                      value={newTagCategory}
                      onChange={(e) => setNewTagCategory(e.target.value)}
                      className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none"
                      aria-label="Select tag category"
                    >
                      {TAG_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 mt-2">
                  <button onClick={() => setShowNewTag(false)} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || allTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase() && selectedTagIds.includes(t.id))}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create New Tag
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Aspect Ratio - Only show in edit mode */}
      {!isSaveMode && (
        <div className="flex justify-between items-center mb-1.5 opacity-100">
          <label className="block text-sm font-medium text-slate-300">Aspect Ratio</label>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-700/50 p-1 rounded-xl border border-slate-600">
              <button
                onClick={() => {
                  setUseCustomAspectRatio(false);
                  if (detectedAspectRatio) setAspectRatio(detectedAspectRatio);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!useCustomAspectRatio ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Auto
              </button>
              <button
                onClick={() => setUseCustomAspectRatio(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${useCustomAspectRatio ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Custom
              </button>
            </div>

            {useCustomAspectRatio ? (
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                aria-label="Select aspect ratio"
              >
                {ASPECT_RATIOS.map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-slate-700/30 border border-slate-700 rounded-xl text-slate-400 text-sm italic min-w-[100px] text-center">
                {detectedAspectRatio ? `${detectedAspectRatio} (Detected)` : '1:1 (Default)'}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Gallery Images - Only show in edit mode */}
      {!isSaveMode && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">Gallery Images</label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Existing Gallery Items */}
          {galleryItems.map((item) => (
            <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800/50">
              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />

              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                {prompt?.gallery_item_id === item.id ? (
                  <span className="text-[10px] text-green-400 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                    <CheckCircle size={10} /> Main Image
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetMainImage(item.id)}
                    className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded-lg border border-slate-600 w-full"
                  >
                    Make Main
                  </button>
                )}

                <button
                  onClick={() => { setManagingCollectionFor(item.id); setShowCollectionManager(true); }}
                  className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded-lg border border-slate-600 w-full flex items-center justify-center gap-1"
                >
                  <FolderPlus size={10} /> Collection
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }}
                  className="text-[10px] bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded-lg border border-red-600 w-full flex items-center justify-center gap-1"
                >
                  <X size={10} /> Delete
                </button>

                {item.collection_id && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 truncate max-w-full">
                    In Collection
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* New Upload Previews */}
          {filePreviews.map((preview, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800/50 flex flex-col">
              <img src={preview} alt="Upload preview" className="w-full h-full object-cover opacity-75" />
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 flex flex-col gap-1 z-10">
                <select
                  value={uploadModels[idx] || model || ''}
                  onChange={(e) => {
                    const newModels = [...uploadModels];
                    newModels[idx] = e.target.value;
                    setUploadModels(newModels);
                  }}
                  className="w-full text-[10px] bg-slate-800 border border-slate-600 rounded px-1 py-1 text-slate-200 focus:outline-none focus:border-amber-500"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select model for uploaded image"
                >
                  <option value="">No Model</option>
                  {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-6">
                <span className="text-xs font-medium text-white drop-shadow-md">Queued</span>
              </div>
              <button
                title="Remove image"
                onClick={() => {
                  setFilePreviews(prev => prev.filter((_, i) => i !== idx));
                  setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                  setUploadModels(prev => prev.filter((_, i) => i !== idx));
                }}
                className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-20"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Upload Button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-800/30 hover:bg-slate-800/50 gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
              <Plus size={16} />
            </div>
            <span className="text-xs text-slate-400 font-medium">Add Image</span>
          </div>
        </div>

        <input
          title="Upload image"
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
          multiple
        />
      </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {prompt ? 'Update' : 'Create'} Prompt
        </button>
      </div>
      {/* Collection Manager Modal Overlay */}
      {
        showCollectionManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCollectionManager(false); setManagingCollectionFor(null); }}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Manage Collection</h3>
                <button title="Close" onClick={() => { setShowCollectionManager(false); setManagingCollectionFor(null); }} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <CollectionManager
                onSelect={(colId) => handleAddToCollection(colId)}
                selectedId={galleryItems.find(g => g.id === managingCollectionFor)?.collection_id ?? null}
              />
            </div>
          </div>
        )
      }
    </div >
  );
}
