/**
 * Hint engine.
 *
 * Given the current board state (partially filled by the player), returns
 * the next logical deduction — the same move a human solver would make next
 * using the simplest available technique.
 *
 * The hint does NOT reveal the solution directly — it explains the technique
 * and which cells justify the move, so the player still has to think.
 * Set `reveal = true` to also return the actual value (for a full hint).
 */

import type { Board, CellValue, Hint, SolvingTechnique } from './types';
import {
  allCandidates,
  ROWS, COLS, BOXES,
  rowOf, colOf, boxOf,
  idx
} from './utils';

export interface HintOptions {
  /** If true, include the value in the hint. If false, only explain the technique. */
  reveal?: boolean;
}

/**
 * Find the next hint for a player's current board state.
 * Returns null if the board is already complete or unsolvable.
 */
export function getHint(board: Board, options: HintOptions = {}): Hint | null {
  const reveal = options.reveal ?? true;
  const cands = allCandidates(board);

  if (cands.size === 0) return null; // board is complete

  return (
    findNakedSingle(board, cands, reveal) ??
    findHiddenSingle(board, cands, reveal) ??
    findPointingPair(board, cands, reveal) ??
    findNakedPair(board, cands, reveal) ??
    findHiddenPair(board, cands, reveal) ??
    findXWing(board, cands, reveal) ??
    fallbackHint(board, cands, reveal)
  );
}

// ─── Technique finders ────────────────────────────────────────────────────────

function findNakedSingle(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  for (const [i, cs] of cands) {
    if (cs.size === 1) {
      const value = [...cs][0];
      const r = rowOf(i), c = colOf(i), b = boxOf(i);
      return {
        cellIndex: i, row: r, col: c, box: b,
        value: reveal ? value : null,
        technique: 'naked_single',
        explanation:
          `Cell R${r + 1}C${c + 1} has only one possible candidate: ${value}. ` +
          `All other digits are already present in its row, column, or box.`,
        relatedCells: peersWithValue(board, i, value),
      };
    }
  }
  return null;
}

function findHiddenSingle(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  const units = [
    ...ROWS.map((u, i) => ({ cells: u, name: `Row ${i + 1}`, type: 'row' as const })),
    ...COLS.map((u, i) => ({ cells: u, name: `Column ${i + 1}`, type: 'col' as const })),
    ...BOXES.map((u, i) => ({ cells: u, name: `Box ${i + 1}`, type: 'box' as const })),
  ];

  for (const unit of units) {
    for (let v = 1; v <= 9; v++) {
      const cells = unit.cells.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length === 1) {
        const i = cells[0];
        const r = rowOf(i), c = colOf(i), b = boxOf(i);
        return {
          cellIndex: i, row: r, col: c, box: b,
          value: reveal ? v as CellValue : null,
          technique: 'hidden_single',
          explanation:
            `In ${unit.name}, the digit ${v} can only go in R${r + 1}C${c + 1}. ` +
            `Every other cell in the ${unit.type} already contains ${v} or can't hold it.`,
          relatedCells: unit.cells.filter(x => x !== i),
        };
      }
    }
  }
  return null;
}

function findPointingPair(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  for (let b = 0; b < 9; b++) {
    const box = BOXES[b];
    for (let v = 1; v <= 9; v++) {
      const cells = box.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length < 2 || cells.length > 3) continue;

      const rows = [...new Set(cells.map(rowOf))];
      const cols = [...new Set(cells.map(colOf))];

      if (rows.length === 1) {
        const rowCells = ROWS[rows[0]].filter(i => !box.includes(i));
        const affected = rowCells.filter(i => cands.get(i)?.has(v as CellValue));
        if (affected.length > 0) {
          const i = affected[0];
          return {
            cellIndex: i, row: rowOf(i), col: colOf(i), box: boxOf(i),
            value: null, // elimination hint — no single cell is filled
            technique: 'pointing_pair',
            explanation:
              `In Box ${b + 1}, the digit ${v} can only appear in Row ${rows[0] + 1}. ` +
              `Therefore, ${v} can be eliminated from all other cells in Row ${rows[0] + 1} outside the box.`,
            relatedCells: [...cells, ...affected],
          };
        }
      } else if (cols.length === 1) {
        const colCells = COLS[cols[0]].filter(i => !box.includes(i));
        const affected = colCells.filter(i => cands.get(i)?.has(v as CellValue));
        if (affected.length > 0) {
          const i = affected[0];
          return {
            cellIndex: i, row: rowOf(i), col: colOf(i), box: boxOf(i),
            value: null,
            technique: 'pointing_pair',
            explanation:
              `In Box ${b + 1}, the digit ${v} can only appear in Column ${cols[0] + 1}. ` +
              `Therefore, ${v} can be eliminated from all other cells in Column ${cols[0] + 1} outside the box.`,
            relatedCells: [...cells, ...affected],
          };
        }
      }
    }
  }
  return null;
}

function findNakedPair(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    const emptyCells = unit.filter(i => cands.has(i));
    for (let a = 0; a < emptyCells.length; a++) {
      for (let b = a + 1; b < emptyCells.length; b++) {
        const ca = cands.get(emptyCells[a])!;
        const cb = cands.get(emptyCells[b])!;
        if (ca.size !== 2 || cb.size !== 2) continue;
        const union = new Set([...ca, ...cb]);
        if (union.size !== 2) continue;

        // Found a naked pair — find a cell in the unit that would be affected
        const pair = [emptyCells[a], emptyCells[b]];
        const affected = unit.filter(i => !pair.includes(i) && [...union].some(v => cands.get(i)?.has(v)));
        if (affected.length === 0) continue;

        const digits = [...union].join(' and ');
        return {
          cellIndex: affected[0],
          row: rowOf(affected[0]), col: colOf(affected[0]), box: boxOf(affected[0]),
          value: null,
          technique: 'naked_pair',
          explanation:
            `Cells R${rowOf(pair[0]) + 1}C${colOf(pair[0]) + 1} and ` +
            `R${rowOf(pair[1]) + 1}C${colOf(pair[1]) + 1} can only contain ${digits}. ` +
            `These digits can be eliminated from all other cells in the same unit.`,
          relatedCells: [...pair, ...affected],
        };
      }
    }
  }
  return null;
}

function findHiddenPair(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    const digitCells: Map<CellValue, number[]> = new Map();
    for (let v = 1; v <= 9; v++) {
      const cells = unit.filter(i => cands.get(i)?.has(v as CellValue));
      if (cells.length === 2) digitCells.set(v as CellValue, cells);
    }
    const digits = [...digitCells.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        const ca = digitCells.get(digits[a])!;
        const cb = digitCells.get(digits[b])!;
        if (ca[0] !== cb[0] || ca[1] !== cb[1]) continue;

        // Hidden pair found — check if eliminations are possible
        const pair = ca;
        const pairDigits = new Set([digits[a], digits[b]]);
        const hasExtra = pair.some(i =>
          [...(cands.get(i) ?? [])].some(v => !pairDigits.has(v))
        );
        if (!hasExtra) continue;

        return {
          cellIndex: pair[0],
          row: rowOf(pair[0]), col: colOf(pair[0]), box: boxOf(pair[0]),
          value: null,
          technique: 'hidden_pair',
          explanation:
            `Digits ${digits[a]} and ${digits[b]} can only appear in cells ` +
            `R${rowOf(pair[0]) + 1}C${colOf(pair[0]) + 1} and ` +
            `R${rowOf(pair[1]) + 1}C${colOf(pair[1]) + 1} within this unit. ` +
            `All other candidates can be eliminated from those two cells.`,
          relatedCells: pair,
        };
      }
    }
  }
  return null;
}

function findXWing(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  for (let v = 1; v <= 9; v++) {
    // Rows with exactly 2 candidate positions
    const qualRows: Array<{ row: number; cols: number[] }> = [];
    for (let r = 0; r < 9; r++) {
      const cols = ROWS[r].filter(i => cands.get(i)?.has(v as CellValue)).map(colOf);
      if (cols.length === 2) qualRows.push({ row: r, cols });
    }
    for (let a = 0; a < qualRows.length; a++) {
      for (let b = a + 1; b < qualRows.length; b++) {
        const ra = qualRows[a], rb = qualRows[b];
        if (ra.cols[0] !== rb.cols[0] || ra.cols[1] !== rb.cols[1]) continue;
        // X-Wing found — any eliminations?
        const xCols = ra.cols;
        const baseRows = new Set([ra.row, rb.row]);
        const affected = xCols.flatMap(c =>
          COLS[c].filter(i => !baseRows.has(rowOf(i)) && cands.get(i)?.has(v as CellValue))
        );
        if (affected.length === 0) continue;

        return {
          cellIndex: affected[0],
          row: rowOf(affected[0]), col: colOf(affected[0]), box: boxOf(affected[0]),
          value: null,
          technique: 'x_wing',
          explanation:
            `X-Wing pattern for digit ${v}: rows ${ra.row + 1} and ${rb.row + 1} each have ` +
            `candidates only in columns ${xCols[0] + 1} and ${xCols[1] + 1}. ` +
            `Digit ${v} can be eliminated from all other cells in those columns.`,
          relatedCells: [
            ...xCols.map(c => idx(ra.row, c)),
            ...xCols.map(c => idx(rb.row, c)),
            ...affected,
          ],
        };
      }
    }
  }
  return null;
}

/** Last resort: tell the player which cell to look at without revealing why */
function fallbackHint(
  board: Board,
  cands: Map<number, Set<CellValue>>,
  reveal: boolean
): Hint | null {
  // Pick the cell with fewest candidates
  let minSize = 10, target = -1;
  for (const [i, cs] of cands) {
    if (cs.size < minSize) { minSize = cs.size; target = i; }
  }
  if (target === -1) return null;

  const r = rowOf(target), c = colOf(target), b = boxOf(target);
  return {
    cellIndex: target, row: r, col: c, box: b,
    value: null,
    technique: 'brute_force',
    explanation:
      `This puzzle may require trial and error. ` +
      `R${r + 1}C${c + 1} has the fewest candidates (${minSize}) — try starting there.`,
    relatedCells: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns peer cell indices that already contain value v (justify the elimination) */
function peersWithValue(board: Board, i: number, v: CellValue): number[] {
  const r = rowOf(i), c = colOf(i), b = boxOf(i);
  return [
    ...ROWS[r].filter(x => x !== i && board[x] === v),
    ...COLS[c].filter(x => x !== i && board[x] === v),
    ...BOXES[b].filter(x => x !== i && board[x] === v),
  ];
}
