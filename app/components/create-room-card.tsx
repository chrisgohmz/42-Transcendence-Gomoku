"use client";

import { Eye, EyeOff, LockKeyhole, Plus, Swords, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, Surface } from "@/components/gomoku-ui";

type CreateRoomCardProps = {
  error?: string | null;
  isCreating?: boolean;
  onCreateRoomAction?: (data: {
    name?: string;
    password?: string;
    visibility: "PUBLIC" | "PRIVATE";
  }) => void;
  submitLabel?: string;
};

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default function CreateRoomCard({
  error,
  isCreating = false,
  onCreateRoomAction,
  submitLabel,
}: CreateRoomCardProps) {
  const t = useTranslations("human.createRoom");
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <Surface className="h-full">
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow m-0 mb-2">{t("eyebrow")}</p>
            <h2 className="m-0 font-serif text-3xl leading-none font-bold">{t("title")}</h2>
          </div>
          <Swords aria-hidden="true" className="size-6 text-(--brass)" />
        </div>

        <p className="m-0 mb-3 text-sm leading-6 text-(--muted-text)">{t("description")}</p>
        <form
          className="flex flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isCreating) {
              return;
            }

            const formData = new FormData(event.currentTarget);
            const name = getFormString(formData, "roomName");
            const visibility = isPrivate ? "PRIVATE" : "PUBLIC";
            const password =
              visibility === "PRIVATE" ? getFormString(formData, "roomPassword") : undefined;

            if (visibility === "PRIVATE" && !password) {
              return;
            }

            onCreateRoomAction?.({ name, password, visibility });
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

          <div className={`field transition-opacity ${isPrivate ? "" : "opacity-55"}`}>
            <label htmlFor="room-password" className="field-label">
              {t("password")}
            </label>
            <div className="field-shell">
              <LockKeyhole
                aria-hidden="true"
                className={`size-4 ${isPrivate ? "text-(--brass)" : "text-(--muted-text)"}`}
              />
              <input
                id="room-password"
                name="roomPassword"
                type="password"
                autoComplete="new-password"
                placeholder={t("optionalPassword")}
                className="text-input field-input disabled:cursor-not-allowed"
                disabled={!isPrivate}
                required={isPrivate}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={`min-h-11 rounded-md border px-3 text-sm font-black transition-colors ${
                !isPrivate
                  ? "border-(--mint)/35 bg-(--mint-soft) text-(--mint)"
                  : "border-(--panel-border-soft) bg-white/3.5 text-(--muted-strong) hover:bg-white/5"
              }`}
            >
              <Eye aria-hidden="true" className="mr-2 inline size-4" />
              {t("publicRoom")}
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={`min-h-11 rounded-md border px-3 text-sm font-black transition-colors ${
                isPrivate
                  ? "border-(--brass)/35 bg-(--brass)/10 text-(--brass)"
                  : "border-(--panel-border-soft) bg-white/3.5 text-(--muted-strong) hover:bg-white/5"
              }`}
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
            <Badge tone="neutral">{t("boardSizeLabel")}</Badge>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-2">
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
              <p role="alert" className="m-0 text-sm font-bold text-(--danger)">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </Surface>
  );
}
