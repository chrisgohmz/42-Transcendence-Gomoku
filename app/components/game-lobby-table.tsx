import { LockKeyhole, LogIn, UnlockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GameLobbyEntry = {
  roomId: number;
  player: string;
  requiresPassword: boolean;
};

type GameLobbyTableProps = {
  entries: GameLobbyEntry[];
};

export default function GameLobbyTable({ entries }: GameLobbyTableProps) {
  const t = useTranslations("human.lobby");

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e]/80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("playerRoom")}</TableHead>
            <TableHead className="text-right">{t("password")}</TableHead>
            <TableHead className="text-right">{t("action")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-slate-300">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.roomId}>
                <TableCell className="font-semibold text-[var(--text)]">
                  <span className="mr-2 inline-block size-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]" />
                  {t("roomName", { player: entry.player })}
                </TableCell>
                <TableCell className="text-right">
                  {entry.requiresPassword ? (
                    <Input
                      type="password"
                      name={`room-${entry.roomId}-password`}
                      aria-label={`${t("password")} for ${entry.player}`}
                      autoComplete="off"
                      placeholder={t("password")}
                      maxLength={20}
                      className="ml-auto w-60"
                    />
                  ) : (
                    <span className="inline-flex items-center justify-end gap-2 text-[var(--mint)]">
                      <UnlockKeyhole aria-hidden="true" className="size-4" />
                      {t("publicRoom")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={entry.requiresPassword ? "outline" : "default"}>
                    {entry.requiresPassword ? (
                      <LockKeyhole aria-hidden="true" />
                    ) : (
                      <LogIn aria-hidden="true" />
                    )}
                    {t("join")}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
