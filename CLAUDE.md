# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`sudoku-engine` is a standalone TypeScript Sudoku puzzle library with zero runtime dependencies. It provides puzzle generation, solving, grading, validation, and a hint engine.

## Commands

```bash
npm install            # install dev dependencies (typescript, ts-node, @types/node)
npm run build          # compile to dist/
npm test               # run test suite
npm run demo           # run feature demo
```

No linter or formatter is configured.

## Architecture

All modules are at the project root. Data flows one-way through layers:

```
types.ts          — CellValue, Board, Puzzle, Hint, SolvingTechnique, etc.
utils.ts          — Board math: idx(r,c), PEERS, ROWS, COLS, BOXES, candidates()
    ↓
solver.ts         — Backtracking solver with MRV heuristic; countSolutions() for uniqueness
generator.ts      — Builds complete solution, removes cells while unique solution holds
grader.ts         — Simulates human solving step-by-step, accumulates technique scores
validator.ts      — Conflict detection, solution verification, tamper detection
hints.ts          — Returns next logical move with technique name and explanation
    ↓
index.ts          — Re-exports the full public API
```

**Board representation**: flat `CellValue[]` of length 81. Index formula: `row * 9 + col`. Value `0` = empty cell.

**Precomputed constants in `utils.ts`**: `PEERS[i]` is the set of all 20 cells that share a row, column, or box with cell `i`. `ROWS`, `COLS`, `BOXES` are arrays of 9-cell unit arrays.

## Difficulty System

`grader.ts` simulates solving by repeatedly applying techniques in ascending difficulty order. Each technique use adds to a score. Thresholds:

| Difficulty | Score range | Given count |
|------------|-------------|-------------|
| easy       | ≤ 20        | 36–46       |
| medium     | 21–45       | 27–35       |
| hard       | 46–80       | 22–26       |
| expert     | > 80        | 17–21       |

Techniques in order: `naked_single` (1pt) → `hidden_single` (2pt) → `pointing_pair` / `box_line_reduction` (5pt) → `naked_pair` (6pt) → `hidden_pair` (8pt) → `naked_triple` (8pt) → `hidden_triple` (10pt) → `x_wing` (15pt) → `swordfish` (20pt) → `brute_force` (50pt/cell).

## Key Types

```typescript
type Board = CellValue[];          // 81 elements, 0 = empty
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface Puzzle {
  board: Board;           // givens only
  solution: Board;        // unique solution
  difficulty: Difficulty;
  difficultyScore: number;
  givenCount: number;
  techniques: SolvingTechnique[];
}

interface Hint {
  cellIndex: number;      // row * 9 + col
  value: CellValue | null; // null for elimination-only hints
  technique: SolvingTechnique;
  explanation: string;    // human-readable
  relatedCells: number[];
}
```

## Test Harness

`tests.ts` uses a hand-rolled assertion harness (no external test framework). Tests cover all modules: solver, generator, grader, validator, and hints. Output is a simple pass/fail count.

## Known Bugs Fixed

**`grader.ts` infinite loop** (fixed): Elimination-only techniques (`applyPointingPairs`, `applyBoxLineReduction`, `applyNakedPairs`, etc.) previously recomputed `allCandidates(board)` locally on every call. Since they only mutated a local map without changing `board`, the outer loop detected "progress" on every iteration and looped forever for any puzzle requiring those techniques. Fix: a single `cands` map is created once in `simulateSolve` and passed to all technique functions. A `placeValue()` helper keeps it consistent when cells are placed.

**`index.ts` wrong re-export** (fixed): `HintOptions` was re-exported from `./types` but is defined in `./hints`.

## Project Context

This engine is **Phase 1** of a larger Sudoku multiplayer mobile app (React Native + Expo + Supabase). See `docs/sudoku-build-plan.html` for the full 5-phase plan and `docs/sudoku-architecture.html` for the target system architecture.
