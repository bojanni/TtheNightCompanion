const PROMPT_DIVERSITY_THRESHOLD_KEY = 'nc_prompt_diversity_threshold';

export const PROMPT_DIVERSITY_THRESHOLD_DEFAULT = 0.85;
export const PROMPT_DIVERSITY_THRESHOLD_MIN = 0.5;
export const PROMPT_DIVERSITY_THRESHOLD_MAX = 0.98;

function clampThreshold(value: number): number {
    if (!Number.isFinite(value)) return PROMPT_DIVERSITY_THRESHOLD_DEFAULT;
    return Math.min(PROMPT_DIVERSITY_THRESHOLD_MAX, Math.max(PROMPT_DIVERSITY_THRESHOLD_MIN, value));
}

export function getPromptDiversityThreshold(): number {
    try {
        const stored = localStorage.getItem(PROMPT_DIVERSITY_THRESHOLD_KEY);
        if (stored == null) return PROMPT_DIVERSITY_THRESHOLD_DEFAULT;
        return clampThreshold(Number(stored));
    } catch {
        return PROMPT_DIVERSITY_THRESHOLD_DEFAULT;
    }
}

export function setPromptDiversityThreshold(value: number): number {
    const clamped = clampThreshold(value);
    localStorage.setItem(PROMPT_DIVERSITY_THRESHOLD_KEY, clamped.toString());
    return clamped;
}

export function getPromptDiversityThresholdPercent(): number {
    return Math.round(getPromptDiversityThreshold() * 100);
}
