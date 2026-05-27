type PlayerBarProps = {
  blackName: string;
  whiteName: string;
  timer: string;
};

export default function PlayerBar({ blackName, whiteName, timer }: PlayerBarProps) {
  return (
    <div className="mx-auto w-full max-w-5xl min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border border-(--panel-border-soft) bg-[#08110e]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="stone stone-black h-11 w-11 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-(--brass) uppercase">Black</p>
            <p className="mt-1 truncate text-lg font-bold">{blackName}</p>
          </div>
        </div>

        <div className="min-w-0 rounded-md border border-(--mint)/30 bg-(--mint-soft) px-4 py-4 text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-(--muted-strong) uppercase">
            Timer
          </p>
          <p className="mt-1 text-4xl font-black text-(--mint) tabular-nums">{timer}</p>
        </div>

        <div className="flex min-w-0 items-center gap-3 text-left">
          <span className="stone stone-white h-11 w-11 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-(--brass) uppercase">White</p>
            <p className="mt-1 truncate text-lg font-bold">{whiteName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
