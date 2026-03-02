import { API_BASE_URL } from './constants';

export interface ModelEnrichment {
  id: number;
  nightcafe_model_id: string;
  hf_model_id: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  best_for: string[] | null;
  keywords: string[] | null;
  technical_details: string | null;
  hf_downloads: number | null;
  hf_likes: number | null;
  hf_tags: string[] | null;
  last_enriched_at: string | null;
  enrichment_status: 'pending' | 'enriched' | 'not_on_hf' | 'error';
}

const BASE = `${API_BASE_URL}/api/models`;

export async function getAllEnrichments(): Promise<ModelEnrichment[]> {
  const res = await fetch(`${BASE}/enrichments`);
  if (!res.ok) throw new Error(`Failed to fetch enrichments: ${res.statusText}`);
  return res.json();
}

export async function getModelEnrichment(modelId: string): Promise<ModelEnrichment | null> {
  const all = await getAllEnrichments();
  return all.find(e => e.nightcafe_model_id === modelId) ?? null;
}

export async function triggerEnrichment(modelId: string): Promise<void> {
  const res = await fetch(`${BASE}/enrich/${encodeURIComponent(modelId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Enrichment failed: ${res.statusText}`);
  }
}
