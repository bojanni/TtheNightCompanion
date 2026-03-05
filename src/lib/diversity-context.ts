import { db } from './api';
import { buildDiversityContextFromPrompts, type DiversityContext } from './diversity-scoring';

export { buildDiversityContextFromPrompts };
export type { DiversityContext };

export async function buildDiversityContext(): Promise<DiversityContext> {
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

    return buildDiversityContextFromPrompts(res.data || []);
}
