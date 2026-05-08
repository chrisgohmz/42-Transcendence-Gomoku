import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-[var(--panel-border-soft)] bg-[#050807]/90">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-4 py-6 text-sm text-[var(--muted-text)]">
        <div className="flex gap-6">
          <Link
            href="/terms"
            className="transition-[color] hover:text-[var(--text)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
          >
            {t("terms")}
          </Link>

          <span className="text-[var(--brass)]/45">|</span>

          <Link
            href="/privacy"
            className="transition-[color] hover:text-[var(--text)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
          >
            {t("privacy")}
          </Link>
        </div>

        <p className="text-xs text-[var(--muted-text)]" translate="no">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
