/**
 * Puzzle generator.
 *
 * Strategy:
 * 1. Fill the board with a valid complete solution (randomised backtracking).
 * 2. Remove cells one at a time in random order.
 * 3. After each removal, verify the puzzle still has a unique solution.
 * 4. Stop when the target givens count is reached or no more cells
 *    can be removed without creating ambiguity.
 *
 * This guarantees every generated puzzle has exactly one solution.
 */

import type { Board, CellValue, Difficulty, Puzzle } from './types';
import { emptyBoard, cloneBoard, isValidPlacement, ROWS, COLS, BOXES, boxOf } from './utils';
import { solve, hasUniqueSolution, getUniqueSolution } from './solver';
import { gradeDifficulty } from './grader';

// ─── Target given counts per difficulty ──────────────────────────────────────
// Ranges are inclusive. The generator aims for a random count in the range.
const GIVEN_RANGES: Record<Difficulty, [number, number]> = {
  easy:   [36, 46],
  medium: [27, 35],
  hard:   [22, 26],
  expert: [17, 21], // 17 is the proven minimum for a unique-solution Sudoku
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  difficulty?: Difficulty;
  /** Max attempts before giving up and retrying (default 100) */
  maxAttempts?: number;
}

/**
 * Generate a single puzzle of the requested difficulty.
 * Throws if it cannot produce one within maxAttempts.
 */
export function generatePuzzle(options: GeneratorOptions = {}): Puzzle {
  const difficulty = options.difficulty ?? 'medium';
  const maxAttempts = options.maxAttempts ?? 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolution();
    const puzzle = digHoles(solution, difficulty);

    if (puzzle === null) continue; // couldn't reach target — retry

    // Grade the actual puzzle (may differ slightly from requested difficulty)
    const grade = gradeDifficulty(puzzle);

    // Accept if the graded difficulty matches what was requested.
    // Allow one tier of drift (the digging process isn't perfectly precise).
    if (isAcceptableDifficulty(grade.difficulty, difficulty)) {
      return {
        board: puzzle,
        solution,
        difficulty: grade.difficulty,
        difficultyScore: grade.score,
        givenCount: puzzle.filter(v => v !== 0).length,
        techniques: grade.techniques,
      };
    }
    // Otherwise retry with a new solution
  }

  throw new Error(
    `Could not generate a ${difficulty} puzzle in ${maxAttempts} attempts. ` +
    `Try relaxing the difficulty or increasing maxAttempts.`
  );
}

/**
 * Batch-generate multiple puzzles (e.g. for seeding a DB).
 * Skips any that fail and keeps going until count is reached.
 */
export function generatePuzzles(count: number, options: GeneratorOptions = {}): Puzzle[] {
  const puzzles: Puzzle[] = [];
  let failures = 0;
  const maxFailures = count * 5;

  while (puzzles.length < count && failures < maxFailures) {
    try {
      puzzles.push(generatePuzzle(options));
    } catch {
      failures++;
    }
  }

  if (puzzles.length < count) {
    console.warn(`Warning: only generated ${puzzles.length}/${count} puzzles after ${failures} failures.`);
  }

  return puzzles;
}

// ─── Internal: solution generation ───────────────────────────────────────────

/**
 * Generate a fully filled, valid Sudoku grid using randomised backtracking.
 */
function generateSolution(): Board {
  const board = emptyBoard();
  fillBoard(board);
  return board;
}

function fillBoard(board: Board): boolean {
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;

    // Shuffle values 1–9 for randomness
    const values = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9] as CellValue[]);

    for (const v of values) {
      if (isValidPlacement(board, i, v)) {
        board[i] = v;
        if (fillBoard(board)) return true;
        board[i] = 0;
      }
    }

    return false; // backtrack
  }
  return true; // all 81 cells filled
}

// ─── Internal: hole digging ───────────────────────────────────────────────────

/**
 * Remove cells from a completed solution until the puzzle reaches the
 * target given count for the requested difficulty.
 *
 * Returns null if it's impossible to reach the target while maintaining
 * a unique solution.
 */
function digHoles(solution: Board, difficulty: Difficulty): Board | null {
  const [minGivens, maxGivens] = GIVEN_RANGES[difficulty];
  const targetGivens = randInt(minGivens, maxGivens);

  const puzzle = cloneBoard(solution);

  // Randomly ordered cell indices to try removing
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i));

  for (const i of order) {
    if (puzzle.filter(v => v !== 0).length <= targetGivens) break;

    const backup = puzzle[i];
    puzzle[i] = 0;

    if (!hasUniqueSolution(puzzle)) {
      // Removing this cell breaks uniqueness — put it back
      puzzle[i] = backup;
    }
  }

  const givenCount = puzzle.filter(v => v !== 0).length;

  // Check we're in an acceptable range (within 3 of target)
  if (Math.abs(givenCount - targetGivens) > 3) return null;

  return puzzle;
}

// ─── Difficulty acceptance ────────────────────────────────────────────────────

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

function isAcceptableDifficulty(actual: Difficulty, requested: Difficulty): boolean {
  const ai = DIFFICULTY_ORDER.indexOf(actual);
  const ri = DIFFICULTY_ORDER.indexOf(requested);
  return Math.abs(ai - ri) <= 1; // allow one tier of drift
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
