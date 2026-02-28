/**
 * Demo: shows all engine features with real output.
 * Run: npx ts-node src/demo.ts
 */

import { generatePuzzle, getHint, validateBoard, validateCell, gradeDifficulty, printBoard, idx } from './index';
import type { Difficulty } from './types';

const sep = () => console.log('─'.repeat(50));

// ── 1. Generate puzzles at each difficulty ────────────────
sep();
console.log('GENERATING PUZZLES\n');

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

for (const diff of difficulties) {
  const start = Date.now();
  const puzzle = generatePuzzle({ difficulty: diff });
  const ms = Date.now() - start;

  console.log(`[${diff.toUpperCase()}]  givens: ${puzzle.givenCount}  score: ${puzzle.difficultyScore}  time: ${ms}ms`);
  console.log(`  techniques: ${puzzle.techniques.join(', ')}`);
}

// ── 2. Show a generated easy puzzle ───────────────────────
sep();
console.log('EASY PUZZLE\n');
const puzzle = generatePuzzle({ difficulty: 'easy' });
console.log('Puzzle:');
printBoard(puzzle.board);
console.log('\nSolution:');
printBoard(puzzle.solution);

// ── 3. Hints ──────────────────────────────────────────────
sep();
console.log('HINTS (first 3 steps)\n');
import { cloneBoard } from './utils';

let board = cloneBoard(puzzle.board);
for (let step = 1; step <= 3; step++) {
  const hint = getHint(board, { reveal: true });
  if (!hint) { console.log('Board solved!'); break; }

  console.log(`Step ${step}: [${hint.technique}]`);
  console.log(`  Cell R${hint.row + 1}C${hint.col + 1} → ${hint.value ?? '(elimination)'}`);
  console.log(`  ${hint.explanation}`);

  // Apply the hint if it places a value
  if (hint.value !== null) board[hint.cellIndex] = hint.value;
  console.log();
}

// ── 4. Validation ─────────────────────────────────────────
sep();
console.log('VALIDATION\n');

// Valid incomplete board
const partialResult = validateBoard(puzzle.board);
console.log(`Partial board → valid: ${partialResult.valid}, complete: ${partialResult.complete}, conflicts: ${partialResult.conflicts.length}`);

// Introduce a conflict
const conflicted = cloneBoard(puzzle.board);
// Find a given cell and put a conflicting value in an empty neighbour
const givenIdx = conflicted.findIndex(v => v !== 0);
const emptyNeighbour = conflicted.findIndex((v, i) => v === 0 && i !== givenIdx);
conflicted[emptyNeighbour] = conflicted[givenIdx]; // duplicate value
const conflictResult = validateBoard(conflicted);
console.log(`Conflicted board → valid: ${conflictResult.valid}, conflicts: [${conflictResult.conflicts.join(', ')}]`);

// Completed solution
const solutionResult = validateBoard(puzzle.solution);
console.log(`Solution board  → valid: ${solutionResult.valid}, complete: ${solutionResult.complete}`);

sep();
console.log('All demos complete.\n');
