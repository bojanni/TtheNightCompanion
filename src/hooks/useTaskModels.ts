import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ai-task-models';
const TASK_MODELS_UPDATED_EVENT = 'taskModelsUpdated';

export interface TaskModels {
    generate: string;
    improve: string;
    vision: string;
    research: string;
}

const DEFAULT_MODELS: TaskModels = {
    generate: 'google:gemini-1.5-flash',
    improve: 'anthropic:claude-3-5-sonnet-20241022',
    vision: 'openai:gpt-4o',
    research: 'openai:gpt-4o',
};

/**
 * Syncs the active model for a given AI role to localStorage and dispatches a
 * custom event so any mounted `useTaskModels` hook in the same tab re-renders
 * with the updated value.
 *
 * Call this wherever an AI provider or model is activated (AI Config page).
 */
export function syncTaskModel(
    role: 'generation' | 'improvement' | 'vision',
    provider: string,
    model: string,
): void {
    const taskKey: keyof TaskModels = role === 'generation' ? 'generate'
        : role === 'improvement' ? 'improve'
        : 'vision';
    const value = `${provider}:${model}`;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const current: TaskModels = stored
            ? { ...DEFAULT_MODELS, ...JSON.parse(stored) }
            : { ...DEFAULT_MODELS };
        const updates: Partial<TaskModels> = { [taskKey]: value };
        // research mirrors the generation model
        if (role === 'generation') {
            updates.research = value;
        }
        const updated = { ...current, ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent(TASK_MODELS_UPDATED_EVENT, { detail: updated }));
    } catch (e) {
        console.error('Failed to sync task models to local storage', e);
    }
}

export function useTaskModels() {
    const [taskModels, setTaskModelsState] = useState<TaskModels>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return { ...DEFAULT_MODELS, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error('Failed to parse task models from local storage', e);
        }
        return DEFAULT_MODELS;
    });

    const setModel = useCallback((task: keyof TaskModels, id: string) => {
        setTaskModelsState((prev) => {
            const updated = { ...prev, [task]: id };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save task models to local storage', e);
            }
            return updated;
        });
    }, []);

    // Listen for changes from other tabs (storage event) and same-tab updates
    // (custom event dispatched by syncTaskModel).
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    setTaskModelsState({ ...DEFAULT_MODELS, ...JSON.parse(e.newValue) });
                } catch (err) {
                    console.error(err);
                }
            }
        };
        const handleCustomUpdate = (e: Event) => {
            const detail = (e as CustomEvent<TaskModels>).detail;
            if (detail) setTaskModelsState({ ...DEFAULT_MODELS, ...detail });
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(TASK_MODELS_UPDATED_EVENT, handleCustomUpdate);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(TASK_MODELS_UPDATED_EVENT, handleCustomUpdate);
        };
    }, []);

    return {
        generate: taskModels.generate,
        improve: taskModels.improve,
        vision: taskModels.vision,
        research: taskModels.research,
        setModel,
    };
}
