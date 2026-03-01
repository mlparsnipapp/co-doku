/**
 * Game session helpers: save/restore active game to/from SQLite,
 * submit completion to Supabase, drain the offline sync queue.
 */

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import type { Board, CellValue } from 'sudoku-engine';

const db = SQLite.openDatabaseSync('codoku.db');

/** Initialise local tables (call once at app start) */
export function initGameSessionDB(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS active_game (
      puzzle_id   TEXT PRIMARY KEY,
      board_json  TEXT NOT NULL,
      pencil_json TEXT NOT NULL,
      timer_ms    INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      payload_json TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `);
}

// Run immediately so tables exist before any function in this module is called.
initGameSessionDB();

// ---------------------------------------------------------------------------
// Active game persistence
// ---------------------------------------------------------------------------

export interface SavedGame {
  puzzleId: string;
  board: Board;
  /** Pencil marks: cellIndex → sorted number array */
  pencilMarks: Record<number, number[]>;
  timerMs: number;
  errorCount: number;
}

export function saveActiveGame(game: SavedGame): void {
  db.runSync(
    `INSERT OR REPLACE INTO active_game
       (puzzle_id, board_json, pencil_json, timer_ms, error_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    game.puzzleId,
    JSON.stringify(game.board),
    JSON.stringify(game.pencilMarks),
    game.timerMs,
    game.errorCount,
    new Date().toISOString()
  );
}

export function loadActiveGame(puzzleId: string): SavedGame | null {
  const row = db.getFirstSync<{
    board_json: string;
    pencil_json: string;
    timer_ms: number;
    error_count: number;
  }>(
    `SELECT board_json, pencil_json, timer_ms, error_count
     FROM active_game WHERE puzzle_id = ?`,
    puzzleId
  );

  if (!row) return null;

  return {
    puzzleId,
    board: JSON.parse(row.board_json) as Board,
    pencilMarks: JSON.parse(row.pencil_json) as Record<number, number[]>,
    timerMs: row.timer_ms,
    errorCount: row.error_count,
  };
}

export function clearActiveGame(puzzleId: string): void {
  db.runSync(`DELETE FROM active_game WHERE puzzle_id = ?`, puzzleId);
}

// ---------------------------------------------------------------------------
// Completion: record locally + try to sync
// ---------------------------------------------------------------------------

interface CompletionPayload {
  userId: string;
  puzzleId: string;
  solveTimeMs: number;
  errorCount: number;
  completedAt: string;
}

/**
 * Record a puzzle completion. Tries to push to Supabase immediately;
 * falls back to the sync queue if offline.
 */
export async function recordCompletion(payload: CompletionPayload): Promise<void> {
  const net = await NetInfo.fetch();

  if (net.isConnected) {
    const { error } = await supabase.from('completed_puzzles').insert({
      user_id: payload.userId,
      puzzle_id: payload.puzzleId,
      solve_time_ms: payload.solveTimeMs,
      error_count: payload.errorCount,
      completed_at: payload.completedAt,
    });

    if (!error) return;
    // If online insert failed for non-auth reasons, fall through to queue
  }

  // Offline or error → queue for later
  db.runSync(
    `INSERT INTO sync_queue (payload_json, created_at) VALUES (?, ?)`,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

/**
 * Drain the sync queue: push all pending completions to Supabase.
 * Call this when NetInfo reports the device is back online.
 */
export async function drainSyncQueue(): Promise<void> {
  const rows = db.getAllSync<{ id: number; payload_json: string }>(
    `SELECT id, payload_json FROM sync_queue ORDER BY id ASC LIMIT 50`
  );

  if (rows.length === 0) return;

  for (const row of rows) {
    const payload: CompletionPayload = JSON.parse(row.payload_json);
    const { error } = await supabase.from('completed_puzzles').insert({
      user_id: payload.userId,
      puzzle_id: payload.puzzleId,
      solve_time_ms: payload.solveTimeMs,
      error_count: payload.errorCount,
      completed_at: payload.completedAt,
    });

    if (!error) {
      db.runSync(`DELETE FROM sync_queue WHERE id = ?`, row.id);
    }
  }
}
