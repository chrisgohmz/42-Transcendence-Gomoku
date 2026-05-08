import { LockKeyhole, Plus, Swords } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CreateRoomCard() {
  const t = useTranslations("human.createRoom");

  return (
    <section className="command-panel">
      <div className="flex items-start gap-3">
        <span className="grid size-12 place-items-center rounded-md border border-[var(--lacquer)]/40 bg-[rgb(198_56_47_/_0.15)]">
          <Swords aria-hidden="true" className="size-6 text-[var(--danger)]" />
        </span>
        <div>
          <p className="label m-0">Challenge</p>
          <h2 className="font-serif text-3xl font-bold">{t("title")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">{t("description")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
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

        <button type="button" className="btn m-0 w-full">
          <Plus aria-hidden="true" className="size-4" />
          {t("submit")}
        </button>
      </div>
    </section>
  );
}
