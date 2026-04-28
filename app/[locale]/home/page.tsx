import Image from "next/image";

import StatCard from "@/components/stat-card";

// Create more objects to increase the number of cards on the right
const stats = [
  {
    label: "Players Online",
    value: "128",
    description: "",
  },
  {
    label: "Waiting Rooms",
    value: "09",
    description: "",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
      <section className="mx-auto grid max-w-7xl gap-8 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-stretch">
        <article className="relative min-h-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.95)]">
          <Image
            src="/icons/Gomoku.svg"
            alt="Gomoku board artwork"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />

          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.28em] text-cyan-200/75 uppercase">
              五目並べヒーロー
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Play to win attractive prizes
            </h1>
          </div>
        </article>

        <aside className="flex flex-col justify-center rounded-[2rem] border border-white/10 bg-slate-900/55 p-6 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.95)] backdrop-blur sm:p-8">
          <div className="mt-8 grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
