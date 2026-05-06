import PlayerBar from "@/components/player-bar";
import { Button } from "@/components/ui/button";

const BOARD_SIZE = 15;

export default function GamePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-950 px-6 py-8 text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-8">
        <div className="grid items-center gap-6 lg:grid-cols-[160px_minmax(0,1fr)_160px]">
          <aside className="flex justify-center gap-3 lg:flex-col lg:items-stretch">
            <Button disabled>Undo</Button>

            <Button disabled>Restart</Button>
          </aside>

          <div className="flex justify-center">
            <div className="aspect-square w-full max-w-[min(78vh,680px)] rounded-lg border border-amber-900/50 bg-amber-300 p-4 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.85)]">
              <div className="grid h-full w-full grid-cols-15 grid-rows-15 border border-amber-900/60">
                {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Intersection ${index + 1}`}
                    className="relative border border-amber-900/45 transition hover:bg-amber-200/45 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-cyan-300"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block" />
        </div>

        <PlayerBar blackName="Player 1" whiteName="Player 2" timer="10:00" />
      </section>
    </main>
  );
}
