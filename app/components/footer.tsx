import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-slate-700/40 bg-[#0b182d]/85">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-sm text-slate-300">
        <div className="flex gap-6">
          <Link href="/terms" className="transition hover:text-white">
            {t("terms")}
          </Link>

          <span className="text-slate-500">|</span>

          <Link href="/privacy" className="transition hover:text-white">
            {t("privacy")}
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
