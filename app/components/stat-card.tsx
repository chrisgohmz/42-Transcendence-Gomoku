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
      className="h-full w-full rounded-[1.75rem] border border-sky-200/10 bg-slate-950/70 py-0 text-slate-50 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.95)] ring-0 backdrop-blur"
    >
      <CardContent className="p-6 text-left">
        <p className="text-xs font-semibold tracking-[0.24em] text-cyan-200/70 uppercase">
          {label}
        </p>
        <div className="mt-4 text-3xl font-bold text-slate-50">{isloading ? "..." : value}</div>

        {description && <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>}
      </CardContent>
    </Card>
  );
}
