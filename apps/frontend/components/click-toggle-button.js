"use client";

import { useState } from "react";

// Minimal client component / click handler example.
export function ClickToggleButton() {
  const [enabled, setEnabled] = useState(false);

  function handleClick() {
    setEnabled((current) => !current);
  }

  return (
    <button
      type="button"
      className={`btn ${enabled ? "btn-on" : "btn-off"}`}
      aria-pressed={enabled}
      onClick={handleClick}
    >
      {enabled ? "ON" : "OFF"}
    </button>
  );
}
