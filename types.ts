/**
 * Core types for the Sudoku engine.
 * A board is a flat 81-element array. Index = row * 9 + col.
 * Value 0 means empty.
 */

export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Board = CellValue[];                 // length 81
export type PencilMarks = (Set<CellValue>)[];    // length 81

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** A fully described puzzle ready to hand to the client */
export interface Puzzle {
  /** The starting board — 0 = empty cell */
  board: Board;
  /** The unique solution */
  solution: Board;
  difficulty: Difficulty;
  /** Numeric score used for difficulty grading (higher = harder) */
  difficultyScore: number;
  /** Number of given (pre-filled) cells */
  givenCount: number;
  /** Techniques required to solve without guessing */
  techniques: SolvingTechnique[];
}

/**
 * Solving techniques in rough ascending difficulty order.
 * The grader records which ones are needed for each puzzle.
 */
export type SolvingTechnique =
  | 'naked_single'
  | 'hidden_single'
  | 'naked_pair'
  | 'naked_triple'
  | 'hidden_pair'
  | 'hidden_triple'
  | 'pointing_pair'
  | 'box_line_reduction'
  | 'x_wing'
  | 'swordfish'
  | 'brute_force'; // only used if logic alone can't solve

/** Result from the validator */
export interface ValidationResult {
  valid: boolean;
  /** Which cells have conflicts (index into flat board) */
  conflicts: number[];
  complete: boolean;
}

/** A single hint — what to do next and why */
export interface Hint {
  /** Cell index (row * 9 + col) */
  cellIndex: number;
  row: number;
  col: number;
  box: number;
  /** The value to place (0 if technique only eliminates candidates) */
  value: CellValue | null;
  technique: SolvingTechnique;
  /** Human-readable explanation */
  explanation: string;
  /** Related cells that justify this hint */
  relatedCells: number[];
}
