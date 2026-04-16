import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  isloading?: boolean;
};

export default function StatCard({ label, value, description, isloading }: StatCardProps) {
  return (
    <Card size="sm" className="mx-auto w-full max-w-sm">
      <CardContent className="p-6 text-center">
        <div className="text-3xl font-bold text-slate-50">{isloading ? "..." : value}</div>

        <p className="mt-1 text-sm text-slate-300">{label}</p>

        {description && <p className="mt-2 text-xs text-slate-400">{description}</p>}
      </CardContent>
    </Card>
  );
}
