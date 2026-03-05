export interface DiversityContext {
  diversityScore: number;
  dominantThemes: { name: string; percentage: number }[];
  overusedKeywords: string[];
  underusedAreas: string[];
}

export interface DiversityPromptInput {
  auto_keywords?: unknown;
  content?: unknown;
  prompt?: unknown;
  prompt_text?: unknown;
}

function tokenizePromptText(promptText: string): string[] {
  if (!promptText || typeof promptText !== 'string') {
    return [];
  }

  return promptText
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .slice(0, 40);
}

export function buildDiversityContextFromPrompts(prompts: DiversityPromptInput[]): DiversityContext {
  if (prompts.length === 0) {
    return {
      diversityScore: 100,
      dominantThemes: [],
      overusedKeywords: [],
      underusedAreas: ['fantasy', 'sci-fi', 'portrait', 'landscape']
    };
  }

  // Aggregate keywords with fallback to tokenized prompt text when auto_keywords is absent/empty.
  const keywords: string[] = [];
  prompts.forEach((p) => {
    const autoKeywords = Array.isArray(p.auto_keywords)
      ? p.auto_keywords
        .map((k) => (typeof k === 'string' ? k.toLowerCase().trim() : ''))
        .filter((k) => k.length > 2)
      : [];

    if (autoKeywords.length > 0) {
      keywords.push(...autoKeywords);
      return;
    }

    const fallbackText = [p.content, p.prompt, p.prompt_text]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? '';

    keywords.push(...tokenizePromptText(fallbackText));
  });

  const frequency: Record<string, number> = {};
  keywords.forEach((k) => {
    frequency[k] = (frequency[k] || 0) + 1;
  });

  const sortedKeywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const totalKeywords = keywords.length;
  let diversityScore = 100;

  if (totalKeywords > 0) {
    const simpsonIndex = sortedKeywords.reduce((acc, curr) => {
      const p = curr.count / totalKeywords;
      return acc + (p * p);
    }, 0);

    const rawScore = (1 - simpsonIndex) * 100 * 1.2;
    diversityScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  }

  const dominantThemes = sortedKeywords.slice(0, 4).map((k) => ({
    name: k.name,
    percentage: Math.round((k.count / totalKeywords) * 100)
  }));

  const overusedKeywords = sortedKeywords
    .filter((k) => (k.count / totalKeywords) > 0.1 && k.count > 2)
    .map((k) => k.name);

  const genericThemes = [
    'cyberpunk', 'fantasy', 'portrait', 'landscape',
    'sci-fi', 'watercolor', 'oil painting', 'minimalist',
    'maximalist', 'dark fantasy', 'anime', 'photorealistic',
    'surrealism', 'steampunk', 'concept art', 'neon', 'cinematic'
  ];

  const keywordSet = new Set(keywords);
  const underusedAreas = genericThemes
    .filter((t) => !keywordSet.has(t))
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);

  return {
    diversityScore,
    dominantThemes,
    overusedKeywords,
    underusedAreas
  };
}
