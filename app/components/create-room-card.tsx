"use client";

import { Eye, EyeOff, LockKeyhole, Plus, Swords, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge, Surface } from "@/components/gomoku-ui";

type CreateRoomCardProps = {
  error?: string | null;
  isCreating?: boolean;
  onCreateRoom?: () => void;
  submitLabel?: string;
};

export default function CreateRoomCard({
  error,
  isCreating = false,
  onCreateRoom,
  submitLabel,
}: CreateRoomCardProps) {
  const t = useTranslations("human.createRoom");

  return (
    <Surface eyebrow={t("eyebrow")} icon={Swords} title={t("title")}>
      <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{t("description")}</p>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isCreating) {
            return;
          }
          onCreateRoom?.();
        }}
      >
        <div className="field">
          <label htmlFor="room-name" className="field-label">
            {t("roomNameLabel")}
          </label>
          <input
            id="room-name"
            name="roomName"
            placeholder={t("roomNamePlaceholder")}
            className="text-input"
          />
        </div>

        <div className="field">
          <label htmlFor="room-password" className="field-label">
            {t("password")}
          </label>
          <div className="field-shell">
            <LockKeyhole aria-hidden="true" className="size-4 text-[var(--brass)]" />
            <input
              id="room-password"
              name="roomPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t("optionalPassword")}
              className="text-input field-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-11 rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] px-3 text-sm font-black text-[var(--mint)]"
          >
            <Eye aria-hidden="true" className="mr-2 inline size-4" />
            {t("publicRoom")}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3 text-sm font-black text-[var(--muted-strong)]"
          >
            <EyeOff aria-hidden="true" className="mr-2 inline size-4" />
            {t("privateRoom")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Badge tone="neutral">
            <Timer aria-hidden="true" className="size-3.5" />
            {t("timerLabel")}
          </Badge>
          <Badge tone="brass">{t("boardSizeLabel")}</Badge>
        </div>

        <button
          type="submit"
          className="btn btn-danger m-0 w-full"
          disabled={isCreating}
          aria-busy={isCreating}
        >
          <Plus aria-hidden="true" className="size-4" />
          {submitLabel ?? t("submit")}
        </button>

        {error ? (
          <p role="alert" className="m-0 text-sm font-bold text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </form>
    </Surface>
  );
}
