import Link from "next/link";
import StatCard from "@/components/stat-card";

export default function HomePage() {
  return (
    <main className="p-6">
      {/* Outer layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT SIDE */}
        <div>
          <h1 className="text-2xl font-bold">Home</h1>
          <p className="mt-2 text-slate-600">
            Some content on the left side
          </p>
        </div>

        {/* RIGHT SIDE (stat cards) */}
        <div className="grid grid-cols-2 gap-4">
          
          <StatCard label="Players Online" value={128} />
          <StatCard label="Matches Active" value={32} />
          <StatCard label="Total Games" value={5421} />
          <StatCard label="Win Rate" value="64%" />

        </div>

      </div>
    </main>
  );
}