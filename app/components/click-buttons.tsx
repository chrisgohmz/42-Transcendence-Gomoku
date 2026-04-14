"use client";

import { useState } from "react";

// Minimal client component / click handler example.
export function ClickButtons() {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);

  function handleClick() {
    setEnabled((current) => !current);
  }

  function increment(currentCount: number) {
    return currentCount + 1;
  }

  function handleClickCount() {
    setCount(increment);
  }

  return (
    <div>
      <button
        type="button"
        className={`btn ${enabled ? "btn-on" : "btn-off"}`}
        aria-pressed={enabled}
        onClick={handleClick}
      >
        {enabled ? "ON" : "OFF"}
      </button>

      <button
        type="button"
        className="btn"
        onClick={handleClickCount}
        aria-label={`Increment counter, current value ${count}`}
      >
        {count}
      </button>
    </div>
  );
}
