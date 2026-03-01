/**
 * Seed the Supabase puzzles table using the local sudoku engine.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed
 *
 * The service role key is in Supabase dashboard → Project Settings → API.
 * It bypasses RLS so it can insert into the puzzles table.
 */

import { generatePuzzles } from '../index';
import type { Difficulty } from '../types';

const SUPABASE_URL = 'https://epxifgorxaqlttawjcve.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  console.error('  Example: SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed');
  process.exit(1);
}

const COUNTS: Record<Difficulty, number> = {
  easy:   25,
  medium: 25,
  hard:   20,
  expert: 15,
};

async function insertBatch(puzzles: object[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/puzzles`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(puzzles),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Insert failed (${res.status}): ${body}`);
  }
}

async function seed(): Promise<void> {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

  for (const difficulty of difficulties) {
    const count = COUNTS[difficulty];
    process.stdout.write(`Generating ${count} ${difficulty} puzzles `);

    const puzzles = generatePuzzles(count, { difficulty });
    const batch = puzzles.map((puzzle) => ({
      difficulty:       puzzle.difficulty,
      board:            puzzle.board,
      solution:         puzzle.solution,
      techniques:       puzzle.techniques,
      difficulty_score: puzzle.difficultyScore,
      given_count:      puzzle.givenCount,
    }));
    process.stdout.write('.'.repeat(count));

    console.log('');
    await insertBatch(batch);
    console.log(`✓ Inserted ${count} ${difficulty} puzzles`);
  }

  console.log('\nDone — puzzles table seeded.');
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
