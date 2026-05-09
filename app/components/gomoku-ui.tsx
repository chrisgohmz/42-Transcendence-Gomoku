import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import GomokuBoard from "@/components/gomoku-board";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  wide?: boolean;
};

export function PageShell({ children, className, wide = true }: PageShellProps) {
  return <main className={cn("app-shell", wide && "app-shell-wide", className)}>{children}</main>;
}

type PageHeaderProps = {
  actions?: ReactNode;
  eyebrow: string;
  icon?: LucideIcon;
  lede?: string;
  title: string;
};

export function PageHeader({ actions, eyebrow, icon: Icon, lede, title }: PageHeaderProps) {
  return (
    <section className="command-panel mb-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
            {Icon ? (
              <span className="grid size-11 shrink-0 place-items-center rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)]">
                <Icon aria-hidden="true" className="size-5 text-[var(--brass)]" />
              </span>
            ) : null}
            <p className="eyebrow m-0">{eyebrow}</p>
          </div>
          <h1 className="page-title">{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap justify-start gap-3 md:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  icon?: LucideIcon;
};

export function Surface({ children, className, eyebrow, icon: Icon, title }: SurfaceProps) {
  return (
    <section className={cn("surface-panel", className)}>
      {title || eyebrow || Icon ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow ? <p className="eyebrow m-0 mb-2">{eyebrow}</p> : null}
            {title ? <h2 className="font-serif text-3xl leading-none font-bold">{title}</h2> : null}
          </div>
          {Icon ? <Icon aria-hidden="true" className="size-6 text-[var(--brass)]" /> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: LucideIcon;
  tone?: "brass" | "mint" | "red" | "plain";
};

export function MetricCard({ helper, icon: Icon, label, tone = "plain", value }: MetricCardProps) {
  const toneClass = {
    brass: "text-[var(--brass)]",
    mint: "text-[var(--mint)]",
    plain: "text-[var(--text)]",
    red: "text-[var(--danger)]",
  }[tone];

  return (
    <article className="kpi-card">
      {Icon ? <Icon aria-hidden="true" className={cn("mb-3 size-5", toneClass)} /> : null}
      <div className={cn("kpi-value", toneClass)}>{value}</div>
      <p className="m-0 mt-2 text-sm font-bold text-[var(--muted-text)]">{label}</p>
      {helper ? (
        <p className="m-0 mt-2 text-xs leading-5 text-[var(--muted-text)]">{helper}</p>
      ) : null}
    </article>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "brass" | "mint" | "red" | "neutral";
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const toneClass = {
    brass: "border-[var(--brass)]/35 bg-[var(--brass-soft)] text-[var(--brass)]",
    mint: "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]",
    neutral: "border-[var(--panel-border-soft)] bg-white/[0.04] text-[var(--muted-strong)]",
    red: "border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.16)] text-[var(--danger)]",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-black",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

type ActionCardProps = {
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  title: string;
  tone?: "mint" | "red" | "brass";
};

export function ActionCard({ body, cta, href, icon: Icon, title, tone = "mint" }: ActionCardProps) {
  const iconClass = {
    brass: "border-[var(--brass)]/35 bg-[var(--brass-soft)] text-[var(--brass)]",
    mint: "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]",
    red: "border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.16)] text-[var(--danger)]",
  }[tone];
  const buttonClass =
    tone === "red" ? "btn-danger" : tone === "brass" ? "btn-subtle" : "btn-primary";

  return (
    <Link
      href={href}
      className="command-panel grid min-h-48 content-between gap-5 text-inherit no-underline"
    >
      <div>
        <span className={cn("mb-5 grid size-12 place-items-center rounded-md border", iconClass)}>
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h2 className="font-serif text-3xl leading-none font-bold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{body}</p>
      </div>
      <span className={cn("btn m-0 min-h-11 justify-between", buttonClass)}>
        {cta}
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
  );
}

export function BoardShowpiece({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "board-room relative min-h-[360px] overflow-hidden p-5",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_70%_18%,rgba(216,172,89,0.2),transparent_32%),linear-gradient(145deg,transparent_0_58%,rgba(216,60,52,0.16)_58%_100%)]",
        className,
      )}
    >
      {label ? (
        <Badge tone="brass">
          <span className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" />
          {label}
        </Badge>
      ) : null}
      <GomokuBoard className="relative z-10 mx-auto mt-6 w-full max-w-[520px] rotate-1" />
    </div>
  );
}

export function AvatarToken({
  image,
  name,
  online,
  size = "md",
}: {
  image?: string | null;
  name: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    lg: "size-24 text-4xl",
    md: "size-12 text-lg",
    sm: "size-10 text-sm",
  }[size];

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border border-[var(--brass)]/35 bg-white/[0.08] font-black uppercase",
        sizeClass,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        name.charAt(0)
      )}
      {typeof online === "boolean" ? (
        <span
          className={cn(
            "absolute right-1 bottom-1 size-3 rounded-full ring-2 ring-[var(--panel-solid)]",
            online
              ? "bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]"
              : "bg-[var(--muted-dim,#7f8a82)]",
          )}
        />
      ) : null}
    </span>
  );
}

export function MiniTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
      <div
        className="grid gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid min-h-14 items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 text-sm last:border-b-0 hover:bg-white/[0.045]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <span key={cellIndex} className="min-w-0 truncate">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
