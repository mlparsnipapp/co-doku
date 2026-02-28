import type { Board, CellValue } from './types';

// ─── Indexing helpers ────────────────────────────────────────────────────────

export const idx = (row: number, col: number): number => row * 9 + col;
export const rowOf = (i: number): number => Math.floor(i / 9);
export const colOf = (i: number): number => i % 9;
export const boxOf = (i: number): number =>
  Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** All 81 cell indices grouped by row */
export const ROWS: number[][] = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => idx(r, c))
);

/** All 81 cell indices grouped by column */
export const COLS: number[][] = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (_, r) => idx(r, c))
);

/** All 81 cell indices grouped by 3×3 box (row-major) */
export const BOXES: number[][] = Array.from({ length: 9 }, (_, b) => {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const cells: number[] = [];
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      cells.push(idx(r, c));
  return cells;
});

/**
 * Precomputed peer sets: for each cell, the 20 other cells that share
 * a row, column, or box with it.
 */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const r = rowOf(i), c = colOf(i), b = boxOf(i);
  const peers = new Set<number>();
  ROWS[r].forEach(x => peers.add(x));
  COLS[c].forEach(x => peers.add(x));
  BOXES[b].forEach(x => peers.add(x));
  peers.delete(i);
  return [...peers];
});

// ─── Board helpers ────────────────────────────────────────────────────────────

export const emptyBoard = (): Board => new Array(81).fill(0) as Board;

export const cloneBoard = (board: Board): Board => [...board] as Board;

/**
 * Returns the set of values (1–9) that are valid candidates for cell i.
 * Returns empty set if cell is already filled.
 */
export function candidates(board: Board, i: number): Set<CellValue> {
  if (board[i] !== 0) return new Set();
  const used = new Set<number>();
  for (const p of PEERS[i]) if (board[p] !== 0) used.add(board[p]);
  const result = new Set<CellValue>();
  for (let v = 1; v <= 9; v++) if (!used.has(v)) result.add(v as CellValue);
  return result;
}

/**
 * Returns a candidates map (cell index → candidate set) for the whole board.
 */
export function allCandidates(board: Board): Map<number, Set<CellValue>> {
  const map = new Map<number, Set<CellValue>>();
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) map.set(i, candidates(board, i));
  }
  return map;
}

/** Quick validity check: no two peers share the same non-zero value */
export function isValidPlacement(board: Board, i: number, v: CellValue): boolean {
  for (const p of PEERS[i]) if (board[p] === v) return false;
  return true;
}

/** Is the board completely filled? */
export const isFilled = (board: Board): boolean => board.every(v => v !== 0);

/** Shallow board equality */
export const boardsEqual = (a: Board, b: Board): boolean =>
  a.every((v, i) => v === b[i]);

/**
 * Pretty-print a board to the console (useful for debugging).
 */
export function printBoard(board: Board): void {
  for (let r = 0; r < 9; r++) {
    if (r > 0 && r % 3 === 0) console.log('------+-------+------');
    const row = Array.from({ length: 9 }, (_, c) => {
      const v = board[idx(r, c)];
      const s = v === 0 ? '.' : String(v);
      return c > 0 && c % 3 === 0 ? '| ' + s : s;
    });
    console.log(row.join(' '));
  }
}
