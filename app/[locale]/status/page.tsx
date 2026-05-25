import {
  Activity,
  Clock3,
  Database,
  HardDriveDownload,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { Link } from "@/i18n/navigation";
import {
  getSystemHealth,
  type HealthCheckId,
  type HealthCheckResult,
  type HealthStatus,
  type SystemHealthPayload,
  type SystemStatus,
} from "@/lib/operations/system-health";
import { cn } from "@/lib/utils";

type StatusPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const checkIcons = {
  app: ServerCog,
  database: Database,
  realtime: RadioTower,
} as const satisfies Record<HealthCheckId, typeof ServerCog>;

function formatCheckedAt(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatInterval(seconds: number) {
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${seconds} seconds`;
}

function toneForStatus(status: HealthStatus | SystemStatus): "brass" | "mint" | "red" {
  if (status === "ok") {
    return "mint";
  }

  if (status === "degraded" || status === "not_configured") {
    return "brass";
  }

  return "red";
}

function textForStatus(status: HealthStatus | SystemStatus) {
  return status.replace("_", " ");
}

function statusClass(status: HealthStatus | SystemStatus) {
  if (status === "ok") return "text-[var(--mint)]";
  if (status === "degraded" || status === "not_configured") return "text-[#ffd37a]";
  return "text-[var(--danger)]";
}

function StatusDot({ status }: { status: HealthStatus | SystemStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 rounded-full shadow-[0_0_16px_currentColor]",
        statusClass(status),
        status === "ok" ? "bg-[var(--mint)]" : "",
        status === "degraded" || status === "not_configured" ? "bg-[#ffd37a]" : "",
        status === "unhealthy" || status === "unreachable" ? "bg-[var(--danger)]" : "",
      )}
    />
  );
}

function CheckCard({ check, locale }: { check: HealthCheckResult; locale: string }) {
  const Icon = checkIcons[check.id];

  return (
    <article className="surface-card grid min-h-[250px] content-between gap-5">
      <div>
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.05]">
            <Icon aria-hidden="true" className="size-6 text-[var(--brass)]" />
          </span>
          <Badge tone={toneForStatus(check.status)}>
            <StatusDot status={check.status} />
            <span className="capitalize">{textForStatus(check.status)}</span>
          </Badge>
        </div>
        <h2 className="mt-5 font-serif text-3xl leading-none font-bold">{check.label}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{check.role}</p>
      </div>

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="label m-0 mb-1">Target</dt>
          <dd className="m-0 break-all text-[var(--muted-strong)]">{check.target}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="label m-0 mb-1">Latency</dt>
            <dd className="m-0 font-black text-[var(--text)] tabular-nums">
              {check.responseTimeMs} ms
            </dd>
          </div>
          <div>
            <dt className="label m-0 mb-1">Checked</dt>
            <dd className="m-0 text-[var(--muted-strong)]">
              {formatCheckedAt(check.checkedAt, locale)}
            </dd>
          </div>
        </div>
        <div>
          <dt className="label m-0 mb-1">Detail</dt>
          <dd className="m-0 text-[var(--muted-strong)]">{check.detail}</dd>
        </div>
      </dl>
    </article>
  );
}

function RecoveryLine({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: typeof ShieldCheck;
  label: string;
}) {
  const Icon = icon;

  return (
    <article className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3">
      <span className="grid size-10 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.05]">
        <Icon aria-hidden="true" className="size-5 text-[var(--brass)]" />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-xs font-black tracking-[0.12em] text-[var(--brass)] uppercase">
          {label}
        </p>
        <div className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">{children}</div>
      </div>
    </article>
  );
}

export default function StatusPage({ params }: StatusPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <StatusPageContent params={params} />
    </Suspense>
  );
}

async function StatusPageContent({ params }: StatusPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();

  const health = await getSystemHealth();

  return <StatusDashboard health={health} locale={locale} />;
}

function StatusDashboard({ health, locale }: { health: SystemHealthPayload; locale: string }) {
  const unhealthyCount = health.summary.unreachable + health.summary.degraded;

  return (
    <PageShell className="grid gap-5">
      <PageHeader
        eyebrow="Operations"
        icon={Activity}
        title="System status"
        lede="Current service health, backup schedule, and recovery readiness for the local production-style stack."
        actions={
          <>
            <Badge tone={toneForStatus(health.status)}>
              <StatusDot status={health.status} />
              <span className="capitalize">{textForStatus(health.status)}</span>
            </Badge>
            <Link href="/status" className="btn btn-subtle m-0 min-h-10">
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Link>
          </>
        }
      />

      <section className="grid gap-5 lg:grid-cols-3">
        <MetricCard
          icon={ShieldCheck}
          label="Healthy checks"
          tone="mint"
          value={health.summary.ok}
        />
        <MetricCard
          icon={Activity}
          label="Needs attention"
          tone={unhealthyCount > 0 ? "red" : "brass"}
          value={unhealthyCount}
        />
        <MetricCard
          icon={Clock3}
          label="Last scan"
          tone="brass"
          value={
            <span className="block text-[1.2rem] leading-tight">
              {formatCheckedAt(health.checkedAt, locale)}
            </span>
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {health.checks.map((check) => (
          <CheckCard key={check.id} check={check} locale={locale} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)]">
        <Surface eyebrow="Backup Schedule" icon={HardDriveDownload} title="PostgreSQL artifacts">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Schedule"
              tone={health.backup.scheduled ? "mint" : "red"}
              value={health.backup.scheduled ? "Active" : "Disabled"}
            />
            <MetricCard
              label="Interval"
              tone="brass"
              value={formatInterval(health.backup.intervalSeconds)}
            />
            <MetricCard label="Retention" value={`${health.backup.retentionDays} days`} />
            <MetricCard
              label="Artifact directory"
              tone="brass"
              value={<span className="text-[1.35rem] break-all">{health.backup.directory}</span>}
            />
          </div>
        </Surface>

        <Surface eyebrow="Recovery" icon={RotateCcw} title="Restore readiness">
          <div className="grid gap-3">
            <RecoveryLine icon={HardDriveDownload} label="Backup format">
              Timestamped PostgreSQL custom-format dumps with SHA-256 checksum sidecars.
            </RecoveryLine>
            <RecoveryLine icon={RotateCcw} label="Restore procedure">
              docs/operations/health-backup-disaster-recovery.md
            </RecoveryLine>
            <RecoveryLine icon={ShieldCheck} label="Drill record">
              docs/operations/restore-drill-log.md
            </RecoveryLine>
          </div>
        </Surface>
      </section>
    </PageShell>
  );
}
