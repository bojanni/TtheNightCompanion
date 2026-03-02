import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/constants';
import { MODELS, type ModelInfo } from '../lib/models-data';

export function useNCModels() {
  return useQuery({
    queryKey: ['nc-models'],
    queryFn: async (): Promise<ModelInfo[]> => {
      const res = await fetch(`${API_BASE_URL}/api/nc-models`);
      if (!res.ok) throw new Error('Failed to fetch NC models');
      const data = await res.json();
      
      const newModels: ModelInfo[] = data.map((m: any) => ({
        id: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: m.name,
        provider: 'NightCafe',
        description: m.description,
        artRating: m.art_rating,
        promptingRating: m.prompting_rating,
        realismRating: m.realism_rating,
        typographyRating: m.typography_rating,
        costLevel: m.cost_level,
        modelType: m.model_type,
        // Fill defaults for existing ones to satisfy typescript type ModelInfo
        strengths: [], weaknesses: [], bestFor: [], styleTags: [],
        qualityRating: Math.floor(((m.art_rating || 0) + (m.realism_rating || 0)) / 2) || 4,
        speedRating: 3, keywords: []
      }));

      // Mutate the global MODELS array in place so synchronous helper functions get the latest data
      MODELS.length = 0;
      MODELS.push(...newModels);

      return newModels;
    },
    initialData: MODELS,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
