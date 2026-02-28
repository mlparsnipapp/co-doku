/**
 * Sudoku solver using backtracking with MRV (Minimum Remaining Values)
 * heuristic. Also provides uniqueness checking.
 */

import type { Board, CellValue } from './types';
import { cloneBoard, isValidPlacement, isFilled, candidates } from './utils';

interface SolveResult {
  solved: boolean;
  board: Board;
}

/**
 * Solve a puzzle. Returns the solved board or the original if unsolvable.
 * Uses MRV: always picks the empty cell with fewest candidates next.
 */
export function solve(board: Board): SolveResult {
  const b = cloneBoard(board);
  const solved = backtrack(b);
  return { solved, board: b };
}

function backtrack(board: Board): boolean {
  // Find the empty cell with fewest candidates (MRV heuristic)
  let minCandCount = 10;
  let target = -1;

  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const cands = candidates(board, i);
    if (cands.size === 0) return false; // dead end
    if (cands.size < minCandCount) {
      minCandCount = cands.size;
      target = i;
      if (minCandCount === 1) break; // can't do better
    }
  }

  if (target === -1) return true; // all filled — solved

  const cands = candidates(board, target);
  for (const v of cands) {
    board[target] = v;
    if (backtrack(board)) return true;
    board[target] = 0;
  }

  return false;
}

/**
 * Counts solutions up to `limit` (default 2).
 * - Returns 0: unsolvable
 * - Returns 1: unique solution (valid puzzle)
 * - Returns 2: multiple solutions (invalid puzzle)
 *
 * Stopping at 2 keeps this fast even for nearly-empty boards.
 */
export function countSolutions(board: Board, limit = 2): number {
  const b = cloneBoard(board);
  let count = 0;
  countBacktrack(b, limit, (c) => { count = c; });
  return count;
}

function countBacktrack(
  board: Board,
  limit: number,
  onUpdate: (count: number) => void,
  count = { value: 0 }
): void {
  if (count.value >= limit) return;

  let minCandCount = 10;
  let target = -1;

  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const cands = candidates(board, i);
    if (cands.size === 0) return;
    if (cands.size < minCandCount) {
      minCandCount = cands.size;
      target = i;
      if (minCandCount === 1) break;
    }
  }

  if (target === -1) {
    count.value++;
    onUpdate(count.value);
    return;
  }

  const cands = candidates(board, target);
  for (const v of cands) {
    if (count.value >= limit) return;
    board[target] = v;
    countBacktrack(board, limit, onUpdate, count);
    board[target] = 0;
  }
}

/**
 * Checks that a board has exactly one solution.
 */
export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(board, 2) === 1;
}

/**
 * Solves a board and returns the solution, or null if no unique solution.
 */
export function getUniqueSolution(board: Board): Board | null {
  if (!hasUniqueSolution(board)) return null;
  const result = solve(board);
  return result.solved ? result.board : null;
}
