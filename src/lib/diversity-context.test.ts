import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDiversityContextFromPrompts } from './diversity-scoring.ts';

test('uses prompt text tokens when auto_keywords are empty', () => {
  const prompts = [
    {
      auto_keywords: [],
      content: 'Forest forest forest moon'
    },
    {
      auto_keywords: [],
      content: 'Forest fog'
    },
    {
      auto_keywords: ['portrait', 'cinematic']
    }
  ];

  const result = buildDiversityContextFromPrompts(prompts);

  assert.ok(result.dominantThemes.some((theme) => theme.name === 'forest'));
  assert.ok(result.overusedKeywords.includes('forest'));
  assert.ok(result.diversityScore < 100);
});

test('returns defaults when there are no prompts', () => {
  const result = buildDiversityContextFromPrompts([]);

  assert.equal(result.diversityScore, 100);
  assert.deepEqual(result.dominantThemes, []);
  assert.deepEqual(result.overusedKeywords, []);
  assert.deepEqual(result.underusedAreas, ['fantasy', 'sci-fi', 'portrait', 'landscape']);
});
