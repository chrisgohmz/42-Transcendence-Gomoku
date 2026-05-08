import { LockKeyhole, Radio, UnlockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LobbyEntry = {
  roomId: number;
  player: string;
  requiresPassword: boolean;
};

type GameLobbyTableProps = {
  entries: LobbyEntry[];
};

export default function GameLobbyTable({ entries }: GameLobbyTableProps) {
  const t = useTranslations("human.lobby");

  return (
    <div className="grid gap-3">
      {entries.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] text-[var(--muted-text)]">
          {t("empty")}
        </div>
      ) : (
        entries.map((entry) => (
          <article
            key={entry.roomId}
            className="grid gap-4 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.04] p-4 transition-[background-color,border-color] hover:border-[var(--brass)]/45 hover:bg-white/[0.07] md:grid-cols-[1fr_minmax(240px,0.7fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <Radio aria-hidden="true" className="size-4 text-[var(--mint)]" />
                <h3 className="truncate font-serif text-xl font-bold">
                  {t("roomName", { player: entry.player })}
                </h3>
              </div>
              <p className="m-0 text-sm text-[var(--muted-text)]">15 x 15 / Standard / 10m</p>
            </div>

            <div>
              {entry.requiresPassword ? (
                <div className="field-shell">
                  <LockKeyhole aria-hidden="true" className="size-4 text-[var(--brass)]" />
                  <Input
                    aria-label={t("password")}
                    type="password"
                    autoComplete="off"
                    className="field-input h-10"
                  />
                </div>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-3 py-2 text-sm font-black text-[var(--mint)]">
                  <UnlockKeyhole aria-hidden="true" className="size-4" />
                  {t("publicRoom")}
                </span>
              )}
            </div>

            <Button className="md:justify-self-end">{t("join")}</Button>
          </article>
        ))
      )}
    </div>
  );
}
