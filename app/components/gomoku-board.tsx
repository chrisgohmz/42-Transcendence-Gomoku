"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

const BOARD_SIZE = 15;

type Stone = {
  color: "black" | "white";
  x: number;
  y: number;
  last?: boolean;
};

const defaultStones: Stone[] = [
  { color: "black", x: 7, y: 4 },
  { color: "white", x: 8, y: 4 },
  { color: "black", x: 6, y: 5 },
  { color: "white", x: 7, y: 5 },
  { color: "black", x: 8, y: 5 },
  { color: "white", x: 9, y: 5 },
  { color: "white", x: 5, y: 6 },
  { color: "black", x: 6, y: 6 },
  { color: "white", x: 7, y: 6 },
  { color: "black", x: 8, y: 6 },
  { color: "white", x: 9, y: 6 },
  { color: "black", x: 10, y: 6 },
  { color: "black", x: 5, y: 7 },
  { color: "white", x: 6, y: 7 },
  { color: "black", x: 7, y: 7 },
  { color: "white", x: 8, y: 7 },
  { color: "black", x: 9, y: 7 },
  { color: "white", x: 10, y: 7 },
  { color: "white", x: 5, y: 8 },
  { color: "black", x: 6, y: 8 },
  { color: "black", x: 7, y: 8 },
  { color: "white", x: 8, y: 8 },
  { color: "black", x: 9, y: 8 },
  { color: "black", x: 10, y: 8 },
  { color: "white", x: 7, y: 9 },
  { color: "black", x: 8, y: 9 },
  { color: "white", x: 9, y: 9 },
  { color: "black", x: 10, y: 9 },
  { color: "white", x: 11, y: 9 },
  { color: "black", x: 7, y: 10 },
  { color: "white", x: 8, y: 10 },
  { color: "black", x: 9, y: 10 },
  { color: "white", x: 10, y: 10 },
  { color: "black", x: 11, y: 10, last: true },
];

type GomokuBoardProps = {
  className?: string;
  interactive?: boolean;
  stones?: Stone[];
};

export default function GomokuBoard({
  className,
  interactive = false,
  stones = defaultStones,
}: GomokuBoardProps) {
  const [activeCell, setActiveCell] = useState(BOARD_SIZE * 7 + 7);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stoneByPosition = new Map(stones.map((stone) => [`${stone.x}-${stone.y}`, stone]));
  const boardBackground =
    "linear-gradient(90deg, rgb(91 50 20 / 34%) 1px, transparent 1px), linear-gradient(rgb(91 50 20 / 34%) 1px, transparent 1px), linear-gradient(135deg, #efbd75, #cb833c 58%, #92531f)";
  const stoneBackground = {
    black: "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)",
    white: "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)",
  } as const;
  const moveFocus = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, BOARD_SIZE * BOARD_SIZE - 1));
    setActiveCell(boundedIndex);
    cellRefs.current[boundedIndex]?.focus();
  };

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / BOARD_SIZE);
    const column = index % BOARD_SIZE;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(Math.min(row + 1, BOARD_SIZE - 1) * BOARD_SIZE + column);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(row * BOARD_SIZE + Math.max(column - 1, 0));
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(row * BOARD_SIZE + Math.min(column + 1, BOARD_SIZE - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(Math.max(row - 1, 0) * BOARD_SIZE + column);
        break;
      case "End":
        event.preventDefault();
        moveFocus(row * BOARD_SIZE + BOARD_SIZE - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(row * BOARD_SIZE);
        break;
      default:
        break;
    }
  };

  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const x = (index % BOARD_SIZE) + 1;
    const y = Math.floor(index / BOARD_SIZE) + 1;
    const stone = stoneByPosition.get(`${x}-${y}`);
    const cellLabel = stone
      ? `${stone.color} stone at column ${x}, row ${y}${stone.last ? ", last move" : ""}`
      : `Empty intersection at column ${x}, row ${y}`;
    const cellContent = stone ? (
      <span
        className={cn(
          "rounded-full shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]",
          stone.last && "ring-2 ring-[var(--mint)] ring-offset-2 ring-offset-[var(--wood-dark)]",
        )}
        style={{
          background: stoneBackground[stone.color],
          border:
            stone.color === "black"
              ? "1px solid rgb(214 173 98 / 30%)"
              : "1px solid rgb(255 255 255 / 55%)",
          height: "72%",
          width: "72%",
        }}
      />
    ) : null;

    if (interactive) {
      return (
        <button
          key={`${x}-${y}`}
          ref={(element) => {
            cellRefs.current[index] = element;
          }}
          type="button"
          aria-label={cellLabel}
          aria-rowindex={y}
          aria-colindex={x}
          aria-current={stone?.last ? "step" : undefined}
          data-board-cell={`${x}-${y}`}
          onFocus={() => setActiveCell(index)}
          onKeyDown={(event) => handleGridKeyDown(event, index)}
          role="gridcell"
          tabIndex={activeCell === index ? 0 : -1}
          className="relative flex items-center justify-center border border-[#6c3d1d]/35 transition-[background-color,box-shadow] hover:bg-white/12 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--mint)] focus-visible:outline-none"
        >
          {cellContent}
        </button>
      );
    }

    return (
      <span
        key={`${x}-${y}`}
        aria-hidden="true"
        className="relative flex items-center justify-center border border-[#6c3d1d]/30"
      >
        {cellContent}
      </span>
    );
  });
  const rows = Array.from({ length: BOARD_SIZE }, (_, rowIndex) =>
    cells.slice(rowIndex * BOARD_SIZE, rowIndex * BOARD_SIZE + BOARD_SIZE),
  );

  return (
    <div
      className={cn(
        "aspect-square overflow-hidden rounded-md border border-[#5f3417] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.44)]",
        className,
      )}
      style={{
        background: boardBackground,
        backgroundSize:
          "calc(100% / 14) calc(100% / 14), calc(100% / 14) calc(100% / 14), 100% 100%",
      }}
    >
      {interactive ? (
        <p id="gomoku-board-instructions" className="sr-only">
          Use arrow keys to move across the Gomoku board. Press Tab to leave the board.
        </p>
      ) : null}
      <div
        aria-colcount={interactive ? BOARD_SIZE : undefined}
        aria-describedby={interactive ? "gomoku-board-instructions" : undefined}
        aria-label={interactive ? "Gomoku board" : undefined}
        aria-rowcount={interactive ? BOARD_SIZE : undefined}
        className="grid size-full grid-rows-[repeat(15,minmax(0,1fr))] border border-[#5f3417]/60"
        role={interactive ? "grid" : undefined}
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[repeat(15,minmax(0,1fr))]"
            role={interactive ? "row" : undefined}
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}
