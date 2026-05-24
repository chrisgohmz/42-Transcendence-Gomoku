import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
// import Link from "next/link";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16 text-center font-sans">
      <div className="max-w-md">
        <h1 className="font-serif text-5xl leading-none font-bold text-[var(--text)]">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted-text)]">
          {t("description")}
        </p>
        <Link
          href="/en"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--primary)]/50 bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] no-underline shadow-[0_14px_32px_rgb(121_220_138_/_14%)] transition-colors hover:bg-[var(--primary)]/90 focus-visible:ring-3 focus-visible:ring-[var(--ring)]/25 focus-visible:outline-none"
        >
          {t("returnHome")}
        </Link>
      </div>
    </main>
  );
}
