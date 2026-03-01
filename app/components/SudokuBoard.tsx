import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import type { Board, CellValue } from 'sudoku-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellState = 'empty' | 'given' | 'filled' | 'selected' | 'highlighted' | 'conflict';

interface SudokuBoardProps {
  board: Board;
  givens: boolean[];
  conflicts: number[];
  selectedCell: number | null;
  pencilMarks: Record<number, Set<number>>;
  readOnly?: boolean;
  onCellPress: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const COLORS = {
  background: '#1a1a2e',
  cellBg: '#16213e',
  givenBg: '#0f3460',
  selectedBg: '#4f6ef7',
  highlightedBg: '#1e3a6e',
  conflictBg: '#7f1d1d',
  border: '#2d3a5a',
  thickBorder: '#4f6ef7',
  givenText: '#e2e8f0',
  filledText: '#93c5fd',
  conflictText: '#fca5a5',
  pencilText: '#64748b',
  placeholder: '#2d3a5a',
};

// ---------------------------------------------------------------------------
// Cell component
// ---------------------------------------------------------------------------

interface CellProps {
  index: number;
  value: CellValue;
  isGiven: boolean;
  isConflict: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  pencilSet: Set<number> | undefined;
  onPress: (index: number) => void;
  cellSize: number;
}

const Cell = React.memo(function Cell({
  index,
  value,
  isGiven,
  isConflict,
  isSelected,
  isHighlighted,
  pencilSet,
  onPress,
  cellSize,
}: CellProps) {
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  // Pop-in when value changes
  const prevValue = React.useRef<CellValue>(value);
  React.useEffect(() => {
    if (value !== 0 && value !== prevValue.current) {
      scale.value = withSequence(
        withSpring(1.25, { damping: 6 }),
        withSpring(1, { damping: 10 })
      );
    }
    prevValue.current = value;
  }, [value]);

  // Shake on conflict
  const prevConflict = React.useRef(isConflict);
  React.useEffect(() => {
    if (isConflict && !prevConflict.current) {
      shakeX.value = withSequence(
        withTiming(-4, { duration: 50, easing: Easing.linear }),
        withTiming(4, { duration: 50, easing: Easing.linear }),
        withTiming(-4, { duration: 50, easing: Easing.linear }),
        withTiming(0, { duration: 50, easing: Easing.linear })
      );
    }
    prevConflict.current = isConflict;
  }, [isConflict]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  const bgColor = isConflict
    ? COLORS.conflictBg
    : isSelected
    ? COLORS.selectedBg
    : isHighlighted
    ? COLORS.highlightedBg
    : isGiven
    ? COLORS.givenBg
    : COLORS.cellBg;

  const textColor = isConflict
    ? COLORS.conflictText
    : isGiven
    ? COLORS.givenText
    : COLORS.filledText;

  const row = Math.floor(index / 9);
  const col = index % 9;

  // Thicker borders on box boundaries
  const borderRightWidth = col === 2 || col === 5 ? 2 : 0.5;
  const borderBottomWidth = row === 2 || row === 5 ? 2 : 0.5;
  const borderRightColor = col === 2 || col === 5 ? COLORS.thickBorder : COLORS.border;
  const borderBottomColor = row === 2 || row === 5 ? COLORS.thickBorder : COLORS.border;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        cell: {
          width: cellSize,
          height: cellSize,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderRightWidth,
          borderBottomWidth,
          borderRightColor,
          borderBottomColor,
        },
        valueText: {
          fontSize: cellSize * 0.52,
          fontWeight: isGiven ? '700' : '500',
          color: textColor,
        },
        pencilGrid: {
          width: cellSize,
          height: cellSize,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 1,
        },
        pencilNum: {
          width: cellSize / 3,
          height: cellSize / 3,
          textAlign: 'center',
          fontSize: cellSize * 0.18,
          color: COLORS.pencilText,
          lineHeight: cellSize / 3,
        },
      }),
    [cellSize, bgColor, textColor, borderRightWidth, borderBottomWidth, isGiven]
  );

  return (
    <Pressable onPress={() => onPress(index)} style={{ width: cellSize, height: cellSize }}>
      <Animated.View style={[styles.cell, animatedStyle]}>
        {value !== 0 ? (
          <Text style={styles.valueText}>{value}</Text>
        ) : pencilSet && pencilSet.size > 0 ? (
          <View style={styles.pencilGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Text key={n} style={styles.pencilNum}>
                {pencilSet.has(n) ? n : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export default function SudokuBoard({
  board,
  givens,
  conflicts,
  selectedCell,
  pencilMarks,
  readOnly = false,
  onCellPress,
}: SudokuBoardProps) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const cellSize = Math.floor(boardSize / 9);

  const conflictSet = React.useMemo(() => new Set(conflicts), [conflicts]);

  // Highlight cells in the same row/col/box as selected
  const highlightedSet = React.useMemo(() => {
    if (selectedCell === null) return new Set<number>();
    const row = Math.floor(selectedCell / 9);
    const col = selectedCell % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    const result = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      if (r === row || c === col || (Math.floor(r / 3) === Math.floor(row / 3) && Math.floor(c / 3) === Math.floor(col / 3))) {
        result.add(i);
      }
    }
    result.delete(selectedCell);
    return result;
  }, [selectedCell]);

  const handleCellPress = useCallback(
    (index: number) => {
      if (!readOnly) onCellPress(index);
    },
    [readOnly, onCellPress]
  );

  return (
    <View
      style={[
        styles.board,
        {
          width: cellSize * 9,
          borderWidth: 2,
          borderColor: COLORS.thickBorder,
        },
      ]}
    >
      {Array.from({ length: 9 }, (_, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {Array.from({ length: 9 }, (_, colIdx) => {
            const index = rowIdx * 9 + colIdx;
            return (
              <Cell
                key={index}
                index={index}
                value={board[index]}
                isGiven={givens[index]}
                isConflict={conflictSet.has(index)}
                isSelected={selectedCell === index}
                isHighlighted={highlightedSet.has(index)}
                pencilSet={pencilMarks[index]}
                onPress={handleCellPress}
                cellSize={cellSize}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
  },
});
