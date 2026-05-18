import { PageShell } from "@/components/gomoku-ui";

export function PageLoadingShell({ wide = true }: { wide?: boolean }) {
  return (
    <PageShell wide={wide} className="grid gap-5">
      <div className="command-panel min-h-44 animate-pulse">
        <div className="h-4 w-28 rounded-sm bg-white/[0.08]" />
        <div className="mt-6 h-12 w-full max-w-md rounded-sm bg-white/[0.08]" />
        <div className="mt-5 h-5 w-full max-w-2xl rounded-sm bg-white/[0.06]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="surface-panel min-h-80 animate-pulse">
          <div className="h-6 w-40 rounded-sm bg-white/[0.08]" />
          <div className="mt-6 grid gap-3">
            <div className="h-14 rounded-md bg-white/[0.05]" />
            <div className="h-14 rounded-md bg-white/[0.05]" />
            <div className="h-14 rounded-md bg-white/[0.05]" />
          </div>
        </div>
        <div className="surface-panel min-h-60 animate-pulse">
          <div className="h-6 w-32 rounded-sm bg-white/[0.08]" />
          <div className="mt-6 h-28 rounded-md bg-white/[0.05]" />
        </div>
      </div>
    </PageShell>
  );
}
