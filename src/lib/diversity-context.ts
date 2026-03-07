import { db } from './api';
import { API_BASE_URL } from './constants';
import { buildDiversityContextFromPrompts, type DiversityContext } from './diversity-scoring';

export { buildDiversityContextFromPrompts };
export type { DiversityContext };

type GreylistReason = 'manual' | 'auto' | 'diversity';

const LEGACY_GREYLIST_KEY = 'prompt_greylist';
const LEGACY_MIGRATED_MARKER_KEY = 'prompt_greylist_migrated_to_db';

let promptGreylistSet = new Set<string>();
let greylistInitialized = false;
let greylistInitPromise: Promise<void> | null = null;

async function fetchGreylist(pathname: string): Promise<Array<{ prompt_id: string }>> {
    const res = await fetch(`${API_BASE_URL}${pathname}`);
    if (!res.ok) {
        throw new Error(`Greylist request failed: ${res.status}`);
    }

    const body = await res.json();
    const rows = Array.isArray(body?.result) ? body.result : [];
    return rows
        .filter((row): row is { prompt_id: string } => !!row && typeof row.prompt_id === 'string');
}

function getLegacyGreylistPromptIds(): string[] {
    try {
        const raw = localStorage.getItem(LEGACY_GREYLIST_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } catch {
        return [];
    }
}

async function migrateLegacyGreylistToDb(): Promise<void> {
    try {
        if (localStorage.getItem(LEGACY_MIGRATED_MARKER_KEY) === 'true') return;

        const legacyIds = getLegacyGreylistPromptIds();
        if (legacyIds.length === 0) {
            localStorage.setItem(LEGACY_MIGRATED_MARKER_KEY, 'true');
            return;
        }

        await Promise.all(legacyIds.map((promptId) =>
            fetch(`${API_BASE_URL}/api/greylist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt_id: promptId, reason: 'manual' })
            })
        ));

        localStorage.removeItem(LEGACY_GREYLIST_KEY);
        localStorage.setItem(LEGACY_MIGRATED_MARKER_KEY, 'true');
    } catch (error) {
        // Keep compatibility: if DB/API is unavailable, do not break generation flows.
        console.error('Greylist migration failed; keeping in-memory fallback only.', error);
    }
}

async function ensurePromptGreylistInitialized(): Promise<void> {
    if (greylistInitialized) return;
    if (greylistInitPromise) return greylistInitPromise;

    greylistInitPromise = (async () => {
        await migrateLegacyGreylistToDb();

        try {
            const rows = await fetchGreylist('/api/greylist/active');
            promptGreylistSet = new Set(rows.map((row) => row.prompt_id));
        } catch (error) {
            // Keep compatibility: silently fall back to in-memory only.
            console.error('Failed to load prompt greylist from DB; using in-memory fallback.', error);
            const legacyIds = getLegacyGreylistPromptIds();
            if (legacyIds.length > 0) {
                promptGreylistSet = new Set(legacyIds);
            }
        }

        greylistInitialized = true;
    })();

    try {
        await greylistInitPromise;
    } finally {
        greylistInitPromise = null;
    }
}

export async function getPromptGreylistSet(): Promise<Set<string>> {
    await ensurePromptGreylistInitialized();
    return new Set(promptGreylistSet);
}

export async function addPromptToGreylist(promptId: string, reason: GreylistReason = 'manual', expiresAt?: string | null): Promise<void> {
    if (!promptId) return;
    await ensurePromptGreylistInitialized();

    // Fast local path first for UI consistency.
    promptGreylistSet.add(promptId);

    try {
        await fetch(`${API_BASE_URL}/api/greylist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_id: promptId, reason, expires_at: expiresAt ?? null })
        });
    } catch (error) {
        console.error('Failed to persist greylist entry; kept in-memory value.', error);
    }
}

export async function removePromptFromGreylist(promptId: string): Promise<void> {
    if (!promptId) return;
    await ensurePromptGreylistInitialized();

    promptGreylistSet.delete(promptId);

    try {
        await fetch(`${API_BASE_URL}/api/greylist/${encodeURIComponent(promptId)}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Failed to remove greylist entry in DB; kept in-memory value.', error);
    }
}

export async function isPromptGreylisted(promptId: string): Promise<boolean> {
    if (!promptId) return false;
    await ensurePromptGreylistInitialized();
    return promptGreylistSet.has(promptId);
}

export async function buildDiversityContext(): Promise<DiversityContext> {
    await ensurePromptGreylistInitialized();

    const res = await db.from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
    
    if (res.error) {
        console.error('Error fetching prompts for diversity:', res.error);
        return {
            diversityScore: 100,
            dominantThemes: [],
            overusedKeywords: [],
            underusedAreas: []
        };
    }

    const filteredPrompts = (res.data || []).filter((prompt: Record<string, unknown>) => {
        const promptId = typeof prompt.id === 'string' ? prompt.id : '';
        return !promptId || !promptGreylistSet.has(promptId);
    });

    return buildDiversityContextFromPrompts(filteredPrompts);
}
