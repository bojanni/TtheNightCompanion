import { useState } from 'react';
import type { ModelEnrichment } from '../lib/model-enrichment-service';

interface ModelEnrichmentBadgeProps {
  enrichment: ModelEnrichment | null;
}

export default function ModelEnrichmentBadge({ enrichment }: ModelEnrichmentBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!enrichment) return null;

  const isEnriched = enrichment.enrichment_status === 'enriched';
  const likes = enrichment.hf_likes ?? 0;
  const downloads = enrichment.hf_downloads ?? 0;
  const strengths = enrichment.strengths ?? [];

  return (
    <span
      className="relative inline-flex items-center gap-1.5 text-xs text-slate-300"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Status dot */}
      <span
        className={`inline-block w-2 h-2 rounded-full ${isEnriched ? 'bg-green-400' : 'bg-slate-500'}`}
        aria-label={isEnriched ? 'Enriched' : 'Pending'}
      />

      {isEnriched && (
        <>
          <span title="Likes">❤️ {likes.toLocaleString()}</span>
          <span title="Downloads">⬇️ {downloads >= 1000 ? `${(downloads / 1000).toFixed(1)}K` : downloads}</span>
        </>
      )}

      {/* Tooltip with strengths */}
      {showTooltip && strengths.length > 0 && (
        <span className="absolute bottom-full left-0 mb-1 z-50 w-56 rounded-md bg-slate-800 border border-slate-700 p-2 shadow-lg text-slate-200 text-xs whitespace-normal pointer-events-none">
          <span className="font-semibold text-amber-400 block mb-1">Strengths</span>
          <ul className="list-disc list-inside space-y-0.5">
            {strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
