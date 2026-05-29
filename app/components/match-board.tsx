"use client";

/* oxlint-disable jsx-a11y/prefer-tag-over-role */

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import type { Cell, Seat } from "../../shared/match-events";

const coordinateLabels = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
];

export function formatBoardPoint(position: { x: number; y: number }) {
  return `${coordinateLabels[position.x] ?? position.x + 1}${position.y + 1}`;
}

function clampCellIndex(index: number, boardSize: number) {
  return Math.max(0, Math.min(index, boardSize * boardSize - 1));
}

type MatchBoardProps = {
  board: Cell[][];
  className?: string;
  disabled: boolean;
  label?: string;
  lastMove: { x: number; y: number } | null;
  nextTurnSeat: Seat | null;
  onCellSelect: (x: number, y: number) => void;
  playerSeat: Seat | null;
  testId?: string;
};

export default function MatchBoard({
  board,
  className,
  disabled,
  label = "Gomoku board",
  lastMove,
  nextTurnSeat,
  onCellSelect,
  playerSeat,
  testId = "match-board",
}: MatchBoardProps) {
  const boardSize = board.length;
  const labels = coordinateLabels.slice(0, boardSize);
  const centerIndex = Math.floor(boardSize / 2) * boardSize + Math.floor(boardSize / 2);
  const [activeCell, setActiveCell] = useState(centerIndex);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    const boundedIndex = clampCellIndex(index, boardSize);
    setActiveCell(boundedIndex);
    cellRefs.current[boundedIndex]?.focus();
  };

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / boardSize);
    const column = index % boardSize;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(Math.min(row + 1, boardSize - 1) * boardSize + column);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(row * boardSize + Math.max(column - 1, 0));
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(row * boardSize + Math.min(column + 1, boardSize - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(Math.max(row - 1, 0) * boardSize + column);
        break;
      case "End":
        event.preventDefault();
        moveFocus(row * boardSize + boardSize - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(row * boardSize);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-[min(78vh,820px)]", className)} data-testid={testId}>
      <p id={`${testId}-instructions`} className="sr-only">
        Use arrow keys to move across the Gomoku board. Press Enter or Space to play a legal
        intersection.
      </p>
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] grid-rows-[1.5rem_minmax(0,1fr)] gap-1 sm:grid-cols-[2rem_minmax(0,1fr)] sm:grid-rows-[2rem_minmax(0,1fr)]">
        <span aria-hidden="true" />
        <div
          aria-hidden="true"
          className="grid auto-cols-fr grid-flow-col text-center text-[0.62rem] font-black text-[var(--muted-text)] sm:text-xs"
        >
          {labels.map((columnLabel) => (
            <span key={columnLabel} className="self-center">
              {columnLabel}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid auto-rows-fr text-center text-[0.62rem] font-black text-[var(--muted-text)] sm:text-xs"
        >
          {board.map((_, index) => (
            <span key={index} className="self-center tabular-nums">
              {index + 1}
            </span>
          ))}
        </div>
        <div
          aria-colcount={boardSize}
          aria-describedby={`${testId}-instructions`}
          aria-label={label}
          aria-rowcount={boardSize}
          className="grid aspect-square auto-rows-fr overflow-hidden rounded-md border border-[#5f3417] bg-[linear-gradient(135deg,#f2c77f,#ca843e_58%,#8c4e1d)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.44)]"
          role="grid"
        >
          {board.map((row, y) => (
            <div key={y} className="grid min-h-0 auto-cols-fr grid-flow-col" role="row">
              {row.map((cell, x) => {
                const index = y * boardSize + x;
                const isLastMove = lastMove?.x === x && lastMove.y === y;
                const canPlay =
                  !disabled &&
                  !cell.occupied &&
                  playerSeat !== null &&
                  nextTurnSeat !== null &&
                  playerSeat === nextTurnSeat;
                const cellLabel = cell.occupied
                  ? `${cell.seat} stone at ${formatBoardPoint({ x, y })}`
                  : `Empty intersection ${formatBoardPoint({ x, y })}`;

                return (
                  <button
                    key={`${x}-${y}`}
                    ref={(element) => {
                      cellRefs.current[index] = element;
                    }}
                    type="button"
                    aria-colindex={x + 1}
                    aria-current={isLastMove ? "step" : undefined}
                    aria-disabled={!canPlay}
                    aria-label={cellLabel}
                    aria-rowindex={y + 1}
                    className={cn(
                      "group relative grid min-h-0 place-items-center border border-[#6c3d1d]/35 outline-none transition-[background-color,box-shadow]",
                      canPlay
                        ? "cursor-pointer hover:bg-white/16 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--mint)]"
                        : "cursor-default focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--brass)]/75",
                    )}
                    onClick={() => {
                      if (canPlay) {
                        onCellSelect(x, y);
                      }
                    }}
                    onFocus={() => setActiveCell(index)}
                    onKeyDown={(event) => handleGridKeyDown(event, index)}
                    role="gridcell"
                    tabIndex={activeCell === index ? 0 : -1}
                  >
                    {cell.occupied ? (
                      <span
                        className={cn(
                          "stone grid size-[72%] place-items-center text-[0.55rem] font-black tabular-nums sm:text-[0.65rem]",
                          cell.seat === "BLACK"
                            ? "stone-black text-white/70"
                            : "stone-white text-black/60",
                          isLastMove &&
                            "ring-2 ring-[var(--mint)] ring-offset-2 ring-offset-[var(--wood-dark)]",
                        )}
                      >
                        {cell.moveNumber}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-[22%] rounded-full bg-[var(--mint)] opacity-0 shadow-[0_0_14px_var(--mint)] transition-opacity",
                          canPlay && "group-hover:opacity-70 group-focus-visible:opacity-90",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
