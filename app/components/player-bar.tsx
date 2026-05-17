type PlayerBarProps = {
  blackName: string;
  whiteName: string;
  timer: string;
};

export default function PlayerBar({ blackName, whiteName, timer }: PlayerBarProps) {
  const blackStone = "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)";
  const whiteStone = "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-(--panel-border-soft) bg-[#08110e]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-11 w-11 shrink-0 rounded-full border border-(--brass)/30 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
            style={{ background: blackStone }}
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-(--brass) uppercase">Black</p>
            <p className="mt-1 truncate text-lg font-bold">{blackName}</p>
          </div>
        </div>

        <div className="rounded-md border border-(--mint)/30 bg-(--mint-soft) px-6 py-4 text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-(--muted-strong) uppercase">
            Timer
          </p>
          <p className="mt-1 text-4xl font-black text-(--mint) tabular-nums">{timer}</p>
        </div>

        <div className="flex min-w-0 items-center gap-3 text-left">
          <span
            className="h-11 w-11 shrink-0 rounded-full border border-white/55 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
            style={{ background: whiteStone }}
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-(--brass) uppercase">White</p>
            <p className="mt-1 truncate text-lg font-bold">{whiteName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
