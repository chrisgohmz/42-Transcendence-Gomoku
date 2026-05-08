import { LockKeyhole, Plus, Swords } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateRoomCard() {
  const t = useTranslations("human.createRoom");

  return (
    <Card className="border-[var(--panel-border-soft)] bg-[#08110e]/90 text-[var(--text)] shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md border border-[var(--lacquer)]/40 bg-[rgb(198_56_47_/_0.15)]">
            <Swords aria-hidden="true" className="size-5 text-[var(--danger)]" />
          </span>
          <div>
            <CardTitle className="font-serif text-2xl font-bold">{t("title")}</CardTitle>
            <CardDescription className="text-[var(--muted-text)]">
              {t("description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="room-password" className="field-label">
            {t("password")}
          </Label>
          <div className="relative">
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-text)]"
            />
            <Input
              id="room-password"
              name="roomPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t("optionalPassword")}
              className="pl-9"
            />
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button className="w-full">
          <Plus aria-hidden="true" />
          {t("submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}
