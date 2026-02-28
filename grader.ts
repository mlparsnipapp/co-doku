/**
 * Difficulty grader.
 *
 * Simulates a human solver, applying logical techniques in ascending
 * difficulty order. Records which techniques are needed to solve the
 * puzzle without guessing. If logic alone can't solve it, the puzzle
 * requires brute force (trial and error) — which maps to 'expert'.
 *
 * Technique difficulty scores (additive):
 *   naked_single        1
 *   hidden_single       2
 *   pointing_pair       5
 *   box_line_reduction  5
 *   naked_pair          6
 *   hidden_pair         8
 *   naked_triple        8
 *   hidden_triple       10
 *   x_wing              15
 *   swordfish           20
 *   brute_force         50 (per cell that needs guessing)
 */

import type { Board, CellValue, Difficulty, SolvingTechnique } from './types';
import { cloneBoard, allCandidates, ROWS, COLS, BOXES, PEERS, rowOf, colOf, boxOf } from './utils';

export interface GradeResult {
  difficulty: Difficulty;
  score: number;
  techniques: SolvingTechnique[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function gradeDifficulty(puzzle: Board): GradeResult {
  const result = simulateSolve(puzzle);
  const difficulty = scoreToDifficulty(result.score);
  return {
    difficulty,
    score: result.score,
    techniques: [...new Set(result.techniques)],
  };
}

// ─── Simulation ───────────────────────────────────────────────────────────────

interface SimResult {
  score: number;
  techniques: SolvingTechnique[];
}

function simulateSolve(puzzle: Board): SimResult {
  const board = cloneBoard(puzzle);
  // Persistent candidates map — shared across all technique calls so that
  // eliminations accumulate and aren't lost between iterations.
  const cands = allCandidates(board);
  const techniques: SolvingTechnique[] = [];
  let score = 0;
  let progress = true;

  while (cands.size > 0 && progress) {
    progress = false;

    // Try each technique in order. If one makes progress, restart from top.
    const steps: Array<{ name: SolvingTechnique; points: number; fn: () => boolean }> = [
      { name: 'naked_single',       points: 1,  fn: () => applyNakedSingles(board, cands) },
      { name: 'hidden_single',      points: 2,  fn: () => applyHiddenSingles(board, cands) },
      { name: 'pointing_pair',      points: 5,  fn: () => applyPointingPairs(cands) },
      { name: 'box_line_reduction', points: 5,  fn: () => applyBoxLineReduction(cands) },
      { name: 'naked_pair',         points: 6,  fn: () => applyNakedPairs(cands) },
      { name: 'hidden_pair',        points: 8,  fn: () => applyHiddenPairs(cands) },
      { name: 'naked_triple',       points: 8,  fn: () => applyNakedTriples(cands) },
      { name: 'hidden_triple',      points: 10, fn: () => applyHiddenTriples(cands) },
      { name: 'x_wing',            points: 15, fn: () => applyXWing(cands) },
      { name: 'swordfish',          points: 20, fn: () => applySwordfish(cands) },
    ];

    for (const step of steps) {
      if (step.fn()) {
        techniques.push(step.name);
        score += step.points;
        progress = true;
        break; // restart from easiest technique
      }
    }
  }

  // If unsolved, count remaining cells as brute-force
  const remaining = cands.size;
  if (remaining > 0) {
    techniques.push('brute_force');
    score += remaining * 50;
  }

  return { score, techniques };
}

/**
 * Place a value on the board and update the shared candidates map:
 * remove the cell and prune that value from all peers.
 */
function placeValue(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  i: number,
  v: CellValue,
): void {
  board[i] = v;
  cands.delete(i);
  for (const p of PEERS[i]) cands.get(p)?.delete(v);
}

// ─── Technique implementations ────────────────────────────────────────────────
// Each returns true if it made any change to the board.

/** Naked single: a cell with only one candidate → place it. */
function applyNakedSingles(board: Board, cands: Map<number, Set<CellValue>>): boolean {
  let changed = false;
  for (const [i, cs] of cands) {
    if (cs.size === 1) {
      placeValue(board, cands, i, [...cs][0]);
      changed = true;
    }
  }
  return changed;
}

/**
 * Hidden single: within a row/col/box, a digit appears as a candidate
 * in only one cell → must go there.
 */
function applyHiddenSingles(board: Board, cands: Map<number, Set<CellValue>>): boolean {
  let changed = false;
  const units = [...ROWS, ...COLS, ...BOXES];

  for (const unit of units) {
    for (let v = 1; v <= 9; v++) {
      const cells = unit.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length === 1) {
        placeValue(board, cands, cells[0], v as CellValue);
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Pointing pairs/triples: within a box, if a candidate appears only in
 * one row or column, eliminate it from the rest of that row/column.
 */
function applyPointingPairs(cands: Map<number, Set<CellValue>>): boolean {
  let changed = false;

  for (const box of BOXES) {
    for (let v = 1; v <= 9; v++) {
      const cells = box.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length < 2 || cells.length > 3) continue;

      const rows = [...new Set(cells.map(rowOf))];
      const cols = [...new Set(cells.map(colOf))];

      if (rows.length === 1) {
        // All candidates in the same row — eliminate from rest of row
        ROWS[rows[0]].forEach(i => {
          if (!box.includes(i) && cands.get(i)?.delete(v as CellValue)) changed = true;
        });
      } else if (cols.length === 1) {
        // All candidates in the same col — eliminate from rest of col
        COLS[cols[0]].forEach(i => {
          if (!box.includes(i) && cands.get(i)?.delete(v as CellValue)) changed = true;
        });
      }
    }
  }
  return changed;
}

/**
 * Box-line reduction: if a candidate in a row/col is confined to one box,
 * eliminate it from the rest of that box.
 */
function applyBoxLineReduction(cands: Map<number, Set<CellValue>>): boolean {
  let changed = false;

  for (const line of [...ROWS, ...COLS]) {
    for (let v = 1; v <= 9; v++) {
      const cells = line.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length < 2) continue;
      const boxes = [...new Set(cells.map(boxOf))];
      if (boxes.length !== 1) continue;
      // Eliminate from rest of box
      BOXES[boxes[0]].forEach(i => {
        if (!line.includes(i) && cands.get(i)?.delete(v as CellValue)) changed = true;
      });
    }
  }
  return changed;
}

/**
 * Naked pairs: two cells in a unit with identical 2-candidate sets →
 * eliminate those candidates from all other cells in the unit.
 */
function applyNakedPairs(cands: Map<number, Set<CellValue>>): boolean {
  return applyNakedSubset(cands, 2);
}

function applyNakedTriples(cands: Map<number, Set<CellValue>>): boolean {
  return applyNakedSubset(cands, 3);
}

function applyNakedSubset(cands: Map<number, Set<CellValue>>, size: number): boolean {
  let changed = false;
  const units = [...ROWS, ...COLS, ...BOXES];

  for (const unit of units) {
    const emptyCells = unit.filter(i => cands.has(i));
    const subsets = combinations(emptyCells, size);

    for (const subset of subsets) {
      const union = new Set<CellValue>();
      for (const i of subset) for (const v of cands.get(i) ?? []) union.add(v);
      if (union.size !== size) continue;

      // Found a naked subset — eliminate union values from other cells
      for (const i of unit) {
        if (subset.includes(i)) continue;
        const cell = cands.get(i);
        if (!cell) continue;
        for (const v of union) {
          if (cell.delete(v)) changed = true;
        }
      }
    }
  }
  return changed;
}

/**
 * Hidden pairs: two cells in a unit are the only ones that contain
 * two specific candidates → eliminate all other candidates from those cells.
 */
function applyHiddenPairs(cands: Map<number, Set<CellValue>>): boolean {
  return applyHiddenSubset(cands, 2);
}

function applyHiddenTriples(cands: Map<number, Set<CellValue>>): boolean {
  return applyHiddenSubset(cands, 3);
}

function applyHiddenSubset(cands: Map<number, Set<CellValue>>, size: number): boolean {
  let changed = false;
  const units = [...ROWS, ...COLS, ...BOXES];

  for (const unit of units) {
    const digitCells: Map<CellValue, number[]> = new Map();
    for (let v = 1; v <= 9; v++) {
      const cells = unit.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length >= 2 && cells.length <= size) {
        digitCells.set(v as CellValue, cells);
      }
    }

    const digits = [...digitCells.keys()];
    const digitSubsets = combinations(digits, size);

    for (const dSubset of digitSubsets) {
      const cellUnion = new Set<number>();
      for (const v of dSubset) for (const i of digitCells.get(v) ?? []) cellUnion.add(i);
      if (cellUnion.size !== size) continue;

      // Found a hidden subset — these cells should only have these candidates
      for (const i of cellUnion) {
        const cell = cands.get(i);
        if (!cell) continue;
        for (const v of cell) {
          if (!dSubset.includes(v)) {
            cell.delete(v);
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/**
 * X-Wing: if a candidate appears in exactly two cells of two different rows,
 * and those cells are in the same columns, eliminate from those columns elsewhere.
 */
function applyXWing(cands: Map<number, Set<CellValue>>): boolean {
  return applyFish(cands, 2);
}

function applySwordfish(cands: Map<number, Set<CellValue>>): boolean {
  return applyFish(cands, 3);
}

function applyFish(cands: Map<number, Set<CellValue>>, size: number): boolean {
  let changed = false;

  for (let v = 1; v <= 9; v++) {
    // Check rows → eliminate from columns
    changed = fishPass(ROWS, COLS, v as CellValue, size, cands) || changed;
    // Check cols → eliminate from rows
    changed = fishPass(COLS, ROWS, v as CellValue, size, cands) || changed;
  }
  return changed;
}

function fishPass(
  baseUnits: number[][],
  coverUnits: number[][],
  v: CellValue,
  size: number,
  cands: Map<number, Set<CellValue>>
): boolean {
  let changed = false;
  // Find base units where candidate appears in exactly 2..size cells
  const qualifying: Array<{ unit: number[]; positions: number[] }> = [];
  for (const unit of baseUnits) {
    const positions = unit.filter(i => cands.get(i)?.has(v));
    if (positions.length >= 2 && positions.length <= size) {
      qualifying.push({ unit, positions });
    }
  }

  const qSubsets = combinations(qualifying, size);
  for (const subset of qSubsets) {
    const coverIndices = new Set<number>();
    for (const { positions } of subset) {
      for (const i of positions) {
        // Find which cover unit index this cell belongs to
        for (let ci = 0; ci < coverUnits.length; ci++) {
          if (coverUnits[ci].includes(i)) { coverIndices.add(ci); break; }
        }
      }
    }
    if (coverIndices.size !== size) continue;

    // Eliminate v from all cells in cover units that aren't in the base units
    const baseSet = new Set(subset.flatMap(s => s.positions));
    for (const ci of coverIndices) {
      for (const i of coverUnits[ci]) {
        if (!baseSet.has(i) && cands.get(i)?.delete(v)) changed = true;
      }
    }
  }
  return changed;
}

// ─── Scoring → Difficulty ─────────────────────────────────────────────────────

function scoreToDifficulty(score: number): Difficulty {
  if (score <= 20)  return 'easy';
  if (score <= 45)  return 'medium';
  if (score <= 80)  return 'hard';
  return 'expert';
}

// ─── Combinatorics helper ─────────────────────────────────────────────────────

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}
