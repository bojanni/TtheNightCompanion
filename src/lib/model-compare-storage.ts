const COMPARE_STORAGE_KEY = 'nc_model_compare_selection';
const MAX_COMPARE_MODELS = 4;

function normalize(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  return unique.slice(0, MAX_COMPARE_MODELS);
}

export function loadModelCompareSelection(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalize(parsed.map((x) => String(x)));
  } catch {
    return [];
  }
}

export function saveModelCompareSelection(ids: string[]): void {
  const normalized = normalize(ids);
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalized));
}
