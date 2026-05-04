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
    <Card className="border-white/10 bg-slate-900/70 text-white shadow-xl backdrop-blur">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-slate-300">{t("description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="room-password">{t("password")}</Label>
          <Input
            id="room-password"
            type="password"
            placeholder={t("optionalPassword")}
            className="mt-1 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button>{t("submit")}</Button>
      </CardFooter>
    </Card>
  );
}
