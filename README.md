# sudoku-engine

A standalone TypeScript Sudoku puzzle engine with zero runtime dependencies. Generates puzzles, solves them, grades difficulty, validates boards, and provides step-by-step hints using human solving techniques.

## Features

- **Generator** — produces puzzles with a guaranteed unique solution at four difficulty levels
- **Solver** — backtracking solver with MRV heuristic
- **Grader** — simulates human solving to score difficulty by technique complexity
- **Validator** — conflict detection, solution verification, tamper detection
- **Hint engine** — returns the next logical move with a human-readable explanation

## Installation

```bash
npm install
```

## Usage

```typescript
import {
  generatePuzzle,
  getHint,
  validateBoard,
  verifySolution,
  gradeDifficulty,
} from './index';

// Generate a puzzle
const puzzle = generatePuzzle({ difficulty: 'hard' });
// puzzle.board    — 81-element array, 0 = empty cell
// puzzle.solution — unique solution
// puzzle.techniques — techniques required to solve without guessing

// Get the next hint
const hint = getHint(puzzle.board, { reveal: true });
// hint.technique    — e.g. 'naked_single', 'x_wing'
// hint.explanation  — human-readable description
// hint.cellIndex    — row * 9 + col
// hint.value        — value to place (null for elimination-only hints)

// Validate a board mid-solve
const { valid, complete, conflicts } = validateBoard(playerBoard);

// Check if the player's completed board matches the solution
verifySolution(playerBoard, puzzle.solution);

// Detect if a player tampered with given cells
validateGivens(playerBoard, puzzle.board); // returns indices of tampered cells
```

## Board representation

Boards are flat `CellValue[]` arrays of length 81. Index formula: `row * 9 + col`. Value `0` means empty. The `idx(row, col)` utility converts coordinates to an index.

## Difficulty levels

| Level  | Givens | Techniques required |
|--------|--------|---------------------|
| easy   | 36–46  | naked/hidden singles |
| medium | 27–35  | + pointing pairs, naked pairs |
| hard   | 22–26  | + hidden pairs/triples, x-wing |
| expert | 17–21  | + swordfish, or brute force |

## Scripts

```bash
npm test       # run the test suite (25 tests, no framework required)
npm run demo   # run a feature walkthrough with printed output
npm run build  # compile to dist/
```
