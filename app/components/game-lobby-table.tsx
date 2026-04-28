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
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold text-slate-200">{t("playerRoom")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-200">
              {t("password")}
            </TableHead>
            <TableHead className="text-right font-semibold text-slate-200">{t("action")}</TableHead>
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
                <TableCell>{t("roomName", { player: entry.player })}</TableCell>
                <TableCell className="text-right">
                  {entry.requiresPassword ? (
                    <Input
                      type="password"
                      placeholder={t("password")}
                      maxLength={20}
                      className="ml-auto w-60 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                  ) : (
                    <span className="text-slate-400">{t("publicRoom")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button>{t("join")}</Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
