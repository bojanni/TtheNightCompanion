const PROMPT_DIVERSITY_THRESHOLD_KEY = 'nc_prompt_diversity_threshold';
const BACKUP_REMINDER_SESSION_INTERVAL_KEY = 'nc_backup_reminder_session_interval';
const BACKUP_REMINDER_DAY_INTERVAL_KEY = 'nc_backup_reminder_day_interval';
const BACKUP_REMINDER_ENABLED_KEY = 'nc_backup_reminder_enabled';
const BACKUP_REMINDER_LAST_PROMPT_AT_KEY = 'nc_backup_reminder_last_prompt_at';
const BACKUP_REMINDER_LAST_PROMPT_SESSION_KEY = 'nc_backup_reminder_last_prompt_session';
const BACKUP_REMINDER_LAST_BACKUP_AT_KEY = 'nc_backup_reminder_last_backup_at';
const APP_SESSION_COUNT_KEY = 'nc_app_session_count';
const APP_FIRST_SEEN_AT_KEY = 'nc_app_first_seen_at';

export const PROMPT_DIVERSITY_THRESHOLD_DEFAULT = 0.85;
export const PROMPT_DIVERSITY_THRESHOLD_MIN = 0.5;
export const PROMPT_DIVERSITY_THRESHOLD_MAX = 0.98;

export const BACKUP_REMINDER_SESSION_INTERVAL_DEFAULT = 10;
export const BACKUP_REMINDER_SESSION_INTERVAL_MIN = 1;
export const BACKUP_REMINDER_SESSION_INTERVAL_MAX = 200;

export const BACKUP_REMINDER_DAY_INTERVAL_DEFAULT = 7;
export const BACKUP_REMINDER_DAY_INTERVAL_MIN = 1;
export const BACKUP_REMINDER_DAY_INTERVAL_MAX = 365;

export type BackupReminderReason = 'sessions' | 'days';

export interface BackupReminderSettings {
    enabled: boolean;
    everySessions: number;
    everyDays: number;
}

export interface BackupReminderEvaluation {
    shouldPrompt: boolean;
    reason: BackupReminderReason | null;
}

function clampThreshold(value: number): number {
    if (!Number.isFinite(value)) return PROMPT_DIVERSITY_THRESHOLD_DEFAULT;
    return Math.min(PROMPT_DIVERSITY_THRESHOLD_MAX, Math.max(PROMPT_DIVERSITY_THRESHOLD_MIN, value));
}

function clampBackupSessionInterval(value: number): number {
    if (!Number.isFinite(value)) return BACKUP_REMINDER_SESSION_INTERVAL_DEFAULT;
    const rounded = Math.round(value);
    return Math.min(BACKUP_REMINDER_SESSION_INTERVAL_MAX, Math.max(BACKUP_REMINDER_SESSION_INTERVAL_MIN, rounded));
}

function clampBackupDayInterval(value: number): number {
    if (!Number.isFinite(value)) return BACKUP_REMINDER_DAY_INTERVAL_DEFAULT;
    const rounded = Math.round(value);
    return Math.min(BACKUP_REMINDER_DAY_INTERVAL_MAX, Math.max(BACKUP_REMINDER_DAY_INTERVAL_MIN, rounded));
}

function readNumber(key: string): number | null {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeNumber(key: string, value: number) {
    localStorage.setItem(key, String(value));
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

export function getBackupReminderSettings(): BackupReminderSettings {
    try {
        const everySessionsRaw = readNumber(BACKUP_REMINDER_SESSION_INTERVAL_KEY);
        const everyDaysRaw = readNumber(BACKUP_REMINDER_DAY_INTERVAL_KEY);
        const enabledRaw = localStorage.getItem(BACKUP_REMINDER_ENABLED_KEY);

        return {
            enabled: enabledRaw == null ? true : enabledRaw === 'true',
            everySessions: clampBackupSessionInterval(everySessionsRaw ?? BACKUP_REMINDER_SESSION_INTERVAL_DEFAULT),
            everyDays: clampBackupDayInterval(everyDaysRaw ?? BACKUP_REMINDER_DAY_INTERVAL_DEFAULT),
        };
    } catch {
        return {
            enabled: true,
            everySessions: BACKUP_REMINDER_SESSION_INTERVAL_DEFAULT,
            everyDays: BACKUP_REMINDER_DAY_INTERVAL_DEFAULT,
        };
    }
}

export function setBackupReminderSessionInterval(value: number): number {
    const clamped = clampBackupSessionInterval(value);
    writeNumber(BACKUP_REMINDER_SESSION_INTERVAL_KEY, clamped);
    return clamped;
}

export function setBackupReminderDayInterval(value: number): number {
    const clamped = clampBackupDayInterval(value);
    writeNumber(BACKUP_REMINDER_DAY_INTERVAL_KEY, clamped);
    return clamped;
}

export function setBackupReminderEnabled(enabled: boolean): boolean {
    localStorage.setItem(BACKUP_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
    return enabled;
}

export function markBackupReminderPromptShown(currentSessionCount?: number, nowMs?: number) {
    const now = nowMs ?? Date.now();
    const sessionCount = currentSessionCount ?? readNumber(APP_SESSION_COUNT_KEY) ?? 0;
    writeNumber(BACKUP_REMINDER_LAST_PROMPT_AT_KEY, now);
    writeNumber(BACKUP_REMINDER_LAST_PROMPT_SESSION_KEY, sessionCount);
}

export function markBackupCompletedNow(nowMs?: number) {
    const now = nowMs ?? Date.now();
    writeNumber(BACKUP_REMINDER_LAST_BACKUP_AT_KEY, now);
}

function getDaysSince(timestampMs: number, nowMs: number): number {
    const diff = nowMs - timestampMs;
    if (diff <= 0) return 0;
    return diff / (1000 * 60 * 60 * 24);
}

export function evaluateBackupReminderOnSessionStart(nowMs?: number): BackupReminderEvaluation {
    const now = nowMs ?? Date.now();
    const settings = getBackupReminderSettings();

    if (!settings.enabled) {
        return { shouldPrompt: false, reason: null };
    }

    const previousSessionCount = readNumber(APP_SESSION_COUNT_KEY) ?? 0;
    const currentSessionCount = previousSessionCount + 1;
    writeNumber(APP_SESSION_COUNT_KEY, currentSessionCount);

    const firstSeenAt = readNumber(APP_FIRST_SEEN_AT_KEY);
    if (firstSeenAt == null) {
        writeNumber(APP_FIRST_SEEN_AT_KEY, now);
    }

    const lastPromptSession = readNumber(BACKUP_REMINDER_LAST_PROMPT_SESSION_KEY) ?? 0;
    const sessionsSincePrompt = currentSessionCount - lastPromptSession;
    const sessionsTriggered = sessionsSincePrompt >= settings.everySessions;

    const lastReferenceAt =
        readNumber(BACKUP_REMINDER_LAST_BACKUP_AT_KEY)
        ?? readNumber(BACKUP_REMINDER_LAST_PROMPT_AT_KEY)
        ?? readNumber(APP_FIRST_SEEN_AT_KEY)
        ?? now;

    const daysTriggered = getDaysSince(lastReferenceAt, now) >= settings.everyDays;

    if (sessionsTriggered) {
        return { shouldPrompt: true, reason: 'sessions' };
    }

    if (daysTriggered) {
        return { shouldPrompt: true, reason: 'days' };
    }

    return { shouldPrompt: false, reason: null };
}
