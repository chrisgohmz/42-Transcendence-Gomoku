import { Eye, EyeOff, LockKeyhole, Plus, Swords, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge, Surface } from "@/components/gomoku-ui";

export default function CreateRoomCard() {
  const t = useTranslations("human.createRoom");

  return (
    <Surface eyebrow="Challenge" icon={Swords} title={t("title")}>
      <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{t("description")}</p>

      <div className="grid gap-4">
        <div className="field">
          <label htmlFor="room-name" className="field-label">
            Room name
          </label>
          <input id="room-name" name="roomName" placeholder="Quiet Fuseki" className="text-input" />
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
            Public
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3 text-sm font-black text-[var(--muted-strong)]"
          >
            <EyeOff aria-hidden="true" className="mr-2 inline size-4" />
            Private
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Badge tone="neutral">
            <Timer aria-hidden="true" className="size-3.5" />
            10m timer
          </Badge>
          <Badge tone="brass">15 x 15 board</Badge>
        </div>

        <button type="button" className="btn btn-danger m-0 w-full">
          <Plus aria-hidden="true" className="size-4" />
          {t("submit")}
        </button>
      </div>
    </Surface>
  );
}
