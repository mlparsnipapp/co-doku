/**
 * Sudoku Engine — public API
 *
 * Usage:
 *   import { generatePuzzle, getHint, validateBoard, gradeDifficulty } from './sudoku-engine';
 */

// Types
export type {
  Board,
  CellValue,
  Difficulty,
  Puzzle,
  PencilMarks,
  SolvingTechnique,
  ValidationResult,
  Hint,
} from './types';

// Generator
export { generatePuzzle, generatePuzzles } from './generator';
export type { GeneratorOptions } from './generator';

// Solver (useful for server-side use and testing)
export { solve, hasUniqueSolution, getUniqueSolution, countSolutions } from './solver';

// Grader
export { gradeDifficulty } from './grader';
export type { GradeResult } from './grader';

// Hints
export { getHint } from './hints';
export type { HintOptions } from './hints';

// Validator
export { validateBoard, validateCell, verifySolution, validateGivens } from './validator';

// Utils (for board manipulation in UI layer)
export {
  idx,
  rowOf,
  colOf,
  boxOf,
  candidates,
  allCandidates,
  emptyBoard,
  cloneBoard,
  isFilled,
  printBoard,
  PEERS,
  ROWS,
  COLS,
  BOXES,
} from './utils';
