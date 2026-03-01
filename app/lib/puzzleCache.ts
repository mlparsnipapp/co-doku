/**
 * Offline puzzle cache backed by SQLite.
 *
 * On first Wi-Fi connection: fetch 50 puzzles per difficulty from Supabase.
 * getNextPuzzle(difficulty): returns from cache; triggers background refill when < 10 remain.
 * Daily puzzle: separate table keyed by UTC date.
 */

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import type { Board, Difficulty, SolvingTechnique } from 'sudoku-engine';

const db = SQLite.openDatabaseSync('codoku.db');

const CACHE_FILL_COUNT = 50;
const REFILL_THRESHOLD = 10;

/** Initialise local cache tables (call once at app start) */
export function initPuzzleCacheDB(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS cached_puzzles (
      id               TEXT PRIMARY KEY,
      difficulty       TEXT NOT NULL,
      board_json       TEXT NOT NULL,
      solution_json    TEXT NOT NULL,
      techniques_json  TEXT NOT NULL,
      difficulty_score INTEGER NOT NULL,
      given_count      INTEGER NOT NULL,
      fetched_at       TEXT NOT NULL
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS daily_puzzle (
      date        TEXT PRIMARY KEY,
      puzzle_id   TEXT NOT NULL,
      board_json  TEXT NOT NULL,
      solution_json TEXT NOT NULL,
      techniques_json TEXT NOT NULL,
      difficulty_score INTEGER NOT NULL,
      given_count     INTEGER NOT NULL,
      fetched_at  TEXT NOT NULL
    );
  `);
  db.execSync(`
    CREATE INDEX IF NOT EXISTS cached_puzzles_difficulty_idx
      ON cached_puzzles (difficulty);
  `);
}

// Run immediately so tables exist before any function in this module is called.
initPuzzleCacheDB();

export interface CachedPuzzle {
  id: string;
  difficulty: Difficulty;
  board: Board;
  solution: Board;
  techniques: SolvingTechnique[];
  difficultyScore: number;
  givenCount: number;
}

// ---------------------------------------------------------------------------
// Puzzle fetching from Supabase
// ---------------------------------------------------------------------------

async function fetchAndCachePuzzles(difficulty: Difficulty): Promise<void> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;

  const { data, error } = await supabase
    .from('puzzles')
    .select('id, difficulty, board, solution, techniques, difficulty_score, given_count')
    .eq('difficulty', difficulty)
    .is('daily_date', null)
    .order('created_at', { ascending: false })
    .limit(CACHE_FILL_COUNT);

  if (error || !data) return;

  const now = new Date().toISOString();
  for (const p of data) {
    db.runSync(
      `INSERT OR IGNORE INTO cached_puzzles
         (id, difficulty, board_json, solution_json, techniques_json,
          difficulty_score, given_count, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id,
      p.difficulty,
      JSON.stringify(p.board),
      JSON.stringify(p.solution),
      JSON.stringify(p.techniques),
      p.difficulty_score,
      p.given_count,
      now
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the next unseen puzzle for a given difficulty.
 * Triggers a background refill when the cache is running low.
 */
export function getNextPuzzle(difficulty: Difficulty): CachedPuzzle | null {
  const row = db.getFirstSync<{
    id: string;
    difficulty: string;
    board_json: string;
    solution_json: string;
    techniques_json: string;
    difficulty_score: number;
    given_count: number;
  }>(
    `SELECT * FROM cached_puzzles WHERE difficulty = ?
     ORDER BY fetched_at ASC LIMIT 1`,
    difficulty
  );

  if (!row) {
    // Nothing cached — trigger a fill (fire and forget)
    fetchAndCachePuzzles(difficulty).catch(() => null);
    return null;
  }

  // Check if refill is needed
  const remaining = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM cached_puzzles WHERE difficulty = ?`,
    difficulty
  );

  if ((remaining?.cnt ?? 0) < REFILL_THRESHOLD) {
    fetchAndCachePuzzles(difficulty).catch(() => null);
  }

  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    board: JSON.parse(row.board_json) as Board,
    solution: JSON.parse(row.solution_json) as Board,
    techniques: JSON.parse(row.techniques_json) as SolvingTechnique[],
    difficultyScore: row.difficulty_score,
    givenCount: row.given_count,
  };
}

/** Remove a puzzle from the cache once the player starts it. */
export function consumePuzzle(id: string): void {
  db.runSync(`DELETE FROM cached_puzzles WHERE id = ?`, id);
}

// ---------------------------------------------------------------------------
// Daily puzzle
// ---------------------------------------------------------------------------

/** Fetch and cache today's daily puzzle. */
export async function fetchDailyPuzzle(): Promise<CachedPuzzle | null> {
  const today = new Date().toISOString().split('T')[0];
  const net = await NetInfo.fetch();

  if (!net.isConnected) {
    return loadCachedDailyPuzzle(today);
  }

  const { data, error } = await supabase
    .from('puzzles')
    .select('id, difficulty, board, solution, techniques, difficulty_score, given_count')
    .eq('daily_date', today)
    .single();

  if (error || !data) return loadCachedDailyPuzzle(today);

  const now = new Date().toISOString();
  db.runSync(
    `INSERT OR REPLACE INTO daily_puzzle
       (date, puzzle_id, board_json, solution_json, techniques_json,
        difficulty_score, given_count, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    today,
    data.id,
    JSON.stringify(data.board),
    JSON.stringify(data.solution),
    JSON.stringify(data.techniques),
    data.difficulty_score,
    data.given_count,
    now
  );

  return {
    id: data.id,
    difficulty: data.difficulty as Difficulty,
    board: data.board as Board,
    solution: data.solution as Board,
    techniques: data.techniques as SolvingTechnique[],
    difficultyScore: data.difficulty_score,
    givenCount: data.given_count,
  };
}

function loadCachedDailyPuzzle(date: string): CachedPuzzle | null {
  const row = db.getFirstSync<{
    puzzle_id: string;
    board_json: string;
    solution_json: string;
    techniques_json: string;
    difficulty_score: number;
    given_count: number;
  }>(`SELECT * FROM daily_puzzle WHERE date = ?`, date);

  if (!row) return null;

  return {
    id: row.puzzle_id,
    difficulty: 'medium',
    board: JSON.parse(row.board_json) as Board,
    solution: JSON.parse(row.solution_json) as Board,
    techniques: JSON.parse(row.techniques_json) as SolvingTechnique[],
    difficultyScore: row.difficulty_score,
    givenCount: row.given_count,
  };
}
