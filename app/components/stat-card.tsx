import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  isloading?: boolean;
};

export default function StatCard({ label, value, description, isloading }: StatCardProps) {
  return (
    <Card
      size="sm"
      className="h-full w-full border-[var(--panel-border-soft)] bg-[#08110e]/90 py-0 text-[var(--text)] shadow-[0_22px_60px_rgba(0,0,0,0.32)] ring-0 backdrop-blur"
    >
      <CardContent className="p-6 text-left">
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          {label}
        </p>
        <div className="mt-4 text-3xl font-black text-[var(--text)] tabular-nums">
          {isloading ? "…" : value}
        </div>

        {description && (
          <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
