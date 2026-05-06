import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

type PlayerBarProps = {
  blackName: string;
  whiteName: string;
  timer: string;
};

export default function PlayerBar({ blackName, whiteName, timer }: PlayerBarProps) {
  return (
    <footer className="mx-auto w-full max-w-4xl">
      <Card className="grid grid-cols-3 items-center rounded-lg bg-slate-900/80 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>B</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200/70 uppercase">
              Black
            </p>
            <p className="mt-1 text-lg font-semibold">{blackName}</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.22em] text-slate-400 uppercase">Timer</p>
          <p className="mt-1 font-mono text-3xl font-bold text-cyan-200">{timer}</p>
        </div>

        <div className="flex items-center justify-end gap-3 text-right">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200/70 uppercase">
              White
            </p>
            <p className="mt-1 text-lg font-semibold">{whiteName}</p>
          </div>
          <Avatar>
            <AvatarFallback>W</AvatarFallback>
          </Avatar>
        </div>
      </Card>
    </footer>
  );
}
