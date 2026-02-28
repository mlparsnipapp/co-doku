/**
 * Validator.
 *
 * Two use cases:
 * 1. Mid-game validation: find conflict cells in a partially filled board.
 * 2. Completion check: is the board fully and correctly solved?
 */

import type { Board, CellValue, ValidationResult } from './types';
import { ROWS, COLS, BOXES, PEERS, rowOf, colOf } from './utils';

/**
 * Validate a board (full or partial).
 *
 * - `conflicts`: indices of cells that violate Sudoku rules.
 * - `complete`: true only when all 81 cells are filled with no conflicts.
 *
 * Note: a cell is flagged as a conflict if it shares a unit with another
 * cell of the same value. Both cells are flagged (not just one).
 */
export function validateBoard(board: Board): ValidationResult {
  const conflicts = new Set<number>();

  // Check all units (rows, cols, boxes)
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    const seen = new Map<number, number>(); // value → first cell index
    for (const i of unit) {
      const v = board[i];
      if (v === 0) continue;
      if (seen.has(v)) {
        conflicts.add(i);
        conflicts.add(seen.get(v)!);
      } else {
        seen.set(v, i);
      }
    }
  }

  const complete = conflicts.size === 0 && board.every(v => v !== 0);

  return {
    valid: conflicts.size === 0,
    conflicts: [...conflicts],
    complete,
  };
}

/**
 * Validate a single cell placement.
 * Returns the conflicting peer indices (empty array = valid placement).
 */
export function validateCell(board: Board, cellIndex: number, value: CellValue): number[] {
  if (value === 0) return [];
  return PEERS[cellIndex].filter(p => board[p] === value);
}

/**
 * Check whether a completed board matches the expected solution.
 * Use this server-side to verify a submitted answer.
 */
export function verifySolution(playerBoard: Board, solution: Board): boolean {
  if (playerBoard.length !== 81 || solution.length !== 81) return false;
  return playerBoard.every((v, i) => v === solution[i]);
}

/**
 * Validate that a given set of "givens" hasn't been modified.
 * Returns indices of tampered cells.
 * Use server-side to detect cheating.
 */
export function validateGivens(
  playerBoard: Board,
  originalPuzzle: Board
): number[] {
  const tampered: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (originalPuzzle[i] !== 0 && playerBoard[i] !== originalPuzzle[i]) {
      tampered.push(i);
    }
  }
  return tampered;
}
