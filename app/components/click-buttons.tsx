"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function ClickButtons() {
  const t = useTranslations("clickButtons");
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
        {enabled ? t("on") : t("off")}
      </button>

      <button
        type="button"
        className="btn"
        onClick={handleClickCount}
        aria-label={t("incrementCounter", { count })}
      >
        {count}
      </button>
    </div>
  );
}
