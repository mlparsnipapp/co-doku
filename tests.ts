/**
 * Test suite for the Sudoku engine.
 * Run with: npx ts-node src/tests.ts
 *
 * No test framework needed — plain assertions with clear output.
 */

import { generatePuzzle, generatePuzzles } from './generator';
import { solve, hasUniqueSolution, countSolutions } from './solver';
import { gradeDifficulty } from './grader';
import { getHint } from './hints';
import { validateBoard, validateCell, verifySolution, validateGivens } from './validator';
import { printBoard, idx } from './utils';
import type { Board, CellValue, Difficulty } from './types';

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Known puzzles for deterministic tests ────────────────────────────────────

// Easy puzzle (many naked/hidden singles)
const EASY_PUZZLE: Board = [
  5,3,0, 0,7,0, 0,0,0,
  6,0,0, 1,9,5, 0,0,0,
  0,9,8, 0,0,0, 0,6,0,
  8,0,0, 0,6,0, 0,0,3,
  4,0,0, 8,0,3, 0,0,1,
  7,0,0, 0,2,0, 0,0,6,
  0,6,0, 0,0,0, 2,8,0,
  0,0,0, 4,1,9, 0,0,5,
  0,0,0, 0,8,0, 0,7,9,
] as Board;

const EASY_SOLUTION: Board = [
  5,3,4, 6,7,8, 9,1,2,
  6,7,2, 1,9,5, 3,4,8,
  1,9,8, 3,4,2, 5,6,7,
  8,5,9, 7,6,1, 4,2,3,
  4,2,6, 8,5,3, 7,9,1,
  7,1,3, 9,2,4, 8,5,6,
  9,6,1, 5,3,7, 2,8,4,
  2,8,7, 4,1,9, 6,3,5,
  3,4,5, 2,8,6, 1,7,9,
] as Board;

// Board with a deliberate conflict (two 5s in row 0)
const CONFLICT_BOARD: Board = [
  5,3,0, 0,7,0, 0,0,5, // ← two 5s in row 0
  6,0,0, 1,9,5, 0,0,0,
  0,9,8, 0,0,0, 0,6,0,
  8,0,0, 0,6,0, 0,0,3,
  4,0,0, 8,0,3, 0,0,1,
  7,0,0, 0,2,0, 0,0,6,
  0,6,0, 0,0,0, 2,8,0,
  0,0,0, 4,1,9, 0,0,5,
  0,0,0, 0,8,0, 0,7,9,
] as Board;

// ─── Solver tests ─────────────────────────────────────────────────────────────

console.log('\n── Solver ──────────────────────────────────────────────────────');

test('solves a known easy puzzle correctly', () => {
  const result = solve(EASY_PUZZLE);
  assert(result.solved, 'Solver returned solved=false');
  for (let i = 0; i < 81; i++) {
    assertEq(result.board[i], EASY_SOLUTION[i], `Cell ${i}: expected ${EASY_SOLUTION[i]}, got ${result.board[i]}`);
  }
});

test('detects unique solution', () => {
  assert(hasUniqueSolution(EASY_PUZZLE), 'Should have exactly one solution');
});

test('counts 0 solutions for unsolvable board', () => {
  // Put conflicting values to make it unsolvable
  const bad: Board = [...EASY_PUZZLE] as Board;
  bad[0] = 9; bad[1] = 9; // two 9s in row 0, cells 0 and 1
  assertEq(countSolutions(bad, 2), 0, 'Should be 0 solutions');
});

test('detects multiple solutions for under-constrained board', () => {
  const underConstrained: Board = new Array(81).fill(0) as Board;
  // A nearly empty board has many solutions
  const count = countSolutions(underConstrained, 2);
  assertEq(count, 2, 'Should detect multiple solutions');
});

// ─── Validator tests ──────────────────────────────────────────────────────────

console.log('\n── Validator ───────────────────────────────────────────────────');

test('validates a correct complete board', () => {
  const result = validateBoard(EASY_SOLUTION);
  assert(result.valid, 'Solution should be valid');
  assert(result.complete, 'Solution should be complete');
  assertEq(result.conflicts.length, 0, 'Should have no conflicts');
});

test('detects conflicts in a board with duplicate values', () => {
  const result = validateBoard(CONFLICT_BOARD);
  assert(!result.valid, 'Board with conflicts should be invalid');
  assert(result.conflicts.includes(0), 'Cell 0 should be flagged');
  assert(result.conflicts.includes(8), 'Cell 8 should be flagged');
});

test('incomplete board is valid but not complete', () => {
  const result = validateBoard(EASY_PUZZLE);
  assert(result.valid, 'Puzzle with empty cells should be valid');
  assert(!result.complete, 'Incomplete puzzle should not be complete');
});

test('validateCell returns empty array for valid placement', () => {
  const conflicts = validateCell(EASY_PUZZLE, idx(0, 2), 4); // R1C3 = 4 is correct
  assertEq(conflicts.length, 0, 'Should be no conflicts');
});

test('validateCell returns conflicting peers for invalid placement', () => {
  const conflicts = validateCell(EASY_PUZZLE, idx(0, 2), 5); // 5 already in row/col
  assert(conflicts.length > 0, 'Should detect conflict with existing 5');
});

test('verifySolution returns true for matching boards', () => {
  assert(verifySolution(EASY_SOLUTION, EASY_SOLUTION), 'Solution should verify against itself');
});

test('verifySolution returns false for wrong solution', () => {
  const wrong = [...EASY_SOLUTION] as Board;
  wrong[0] = 9;
  assert(!verifySolution(wrong, EASY_SOLUTION), 'Wrong solution should fail verification');
});

test('validateGivens detects tampered cells', () => {
  const tampered = [...EASY_SOLUTION] as Board;
  tampered[0] = 9; // cell 0 is a given (value 5) — tampered to 9
  const result = validateGivens(tampered, EASY_PUZZLE);
  assert(result.includes(0), 'Should detect tampered given at index 0');
});

// ─── Generator tests ──────────────────────────────────────────────────────────

console.log('\n── Generator ───────────────────────────────────────────────────');

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

for (const diff of DIFFICULTIES) {
  test(`generates a valid ${diff} puzzle`, () => {
    const puzzle = generatePuzzle({ difficulty: diff });

    assert(puzzle.board.length === 81, 'Board must have 81 cells');
    assert(puzzle.solution.length === 81, 'Solution must have 81 cells');

    // All given cells must match the solution
    for (let i = 0; i < 81; i++) {
      if (puzzle.board[i] !== 0) {
        assertEq(puzzle.board[i], puzzle.solution[i],
          `Given at cell ${i} doesn't match solution`);
      }
    }

    // Solution must be valid and complete
    const validation = validateBoard(puzzle.solution);
    assert(validation.valid, 'Solution must have no conflicts');
    assert(validation.complete, 'Solution must be complete');

    // Puzzle must have exactly one solution
    assert(hasUniqueSolution(puzzle.board), 'Puzzle must have a unique solution');

    // Given count must be reasonable
    const [min, max] = { easy: [33, 49], medium: [24, 38], hard: [19, 29], expert: [14, 24] }[diff];
    assert(puzzle.givenCount >= min && puzzle.givenCount <= max,
      `Given count ${puzzle.givenCount} out of expected range [${min}, ${max}] for ${diff}`);
  });
}

test('batch generates multiple puzzles', () => {
  const puzzles = generatePuzzles(5, { difficulty: 'easy' });
  assert(puzzles.length >= 4, `Expected at least 4 puzzles, got ${puzzles.length}`);
  // All should have unique solutions
  for (const p of puzzles) {
    assert(hasUniqueSolution(p.board), 'Each generated puzzle must have a unique solution');
  }
});

// ─── Grader tests ─────────────────────────────────────────────────────────────

console.log('\n── Grader ──────────────────────────────────────────────────────');

test('grades known easy puzzle as easy or medium', () => {
  const grade = gradeDifficulty(EASY_PUZZLE);
  assert(
    grade.difficulty === 'easy' || grade.difficulty === 'medium',
    `Expected easy/medium, got ${grade.difficulty} (score: ${grade.score})`
  );
  assert(grade.techniques.length > 0, 'Should report at least one technique');
  assert(grade.score > 0, 'Score should be positive');
});

test('grader reports naked_single for easy puzzles', () => {
  const grade = gradeDifficulty(EASY_PUZZLE);
  assert(
    grade.techniques.includes('naked_single') || grade.techniques.includes('hidden_single'),
    'Easy puzzle should require at least naked or hidden singles'
  );
});

test('harder puzzles have higher scores', () => {
  const easy = generatePuzzle({ difficulty: 'easy' });
  const hard = generatePuzzle({ difficulty: 'hard' });
  assert(
    hard.difficultyScore > easy.difficultyScore,
    `Hard score (${hard.difficultyScore}) should exceed easy (${easy.difficultyScore})`
  );
});

// ─── Hint engine tests ────────────────────────────────────────────────────────

console.log('\n── Hint Engine ─────────────────────────────────────────────────');

test('returns a hint for an unsolved puzzle', () => {
  const hint = getHint(EASY_PUZZLE);
  assert(hint !== null, 'Should return a hint');
  assert(hint!.explanation.length > 0, 'Hint should have an explanation');
  assert(hint!.technique.length > 0, 'Hint should name a technique');
  assert(hint!.cellIndex >= 0 && hint!.cellIndex < 81, 'Cell index must be valid');
});

test('returns null for a completed board', () => {
  const hint = getHint(EASY_SOLUTION);
  assertEq(hint, null, 'No hint should be returned for a complete board');
});

test('reveal=true includes the value', () => {
  const hint = getHint(EASY_PUZZLE, { reveal: true });
  assert(hint !== null, 'Should return a hint');
  // For naked/hidden singles, value should be non-null
  if (hint!.technique === 'naked_single' || hint!.technique === 'hidden_single') {
    assert(hint!.value !== null, 'Naked/hidden single hint should reveal value');
    assert(hint!.value! >= 1 && hint!.value! <= 9, 'Value must be 1–9');
  }
});

test('hint value matches the solution at that cell', () => {
  const hint = getHint(EASY_PUZZLE, { reveal: true });
  if (hint?.value !== null && hint?.value !== undefined) {
    assertEq(
      hint.value,
      EASY_SOLUTION[hint.cellIndex],
      `Hint value ${hint.value} doesn't match solution ${EASY_SOLUTION[hint.cellIndex]} at cell ${hint.cellIndex}`
    );
  }
});

test('related cells are valid indices', () => {
  const hint = getHint(EASY_PUZZLE);
  if (hint) {
    for (const ci of hint.relatedCells) {
      assert(ci >= 0 && ci < 81, `Related cell index ${ci} out of range`);
    }
  }
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────────────────────────────────────');
console.log(`  ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
