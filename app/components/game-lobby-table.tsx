import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GameLobbyEntry = {
  roomId: number;
  player: string;
  requiresPassword: boolean;
};

type GameLobbyTableProps = {
  entries: GameLobbyEntry[];
};

export default function GameLobbyTable({ entries }: GameLobbyTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold text-slate-200">Player Room</TableHead>
            <TableHead className="text-right font-semibold text-slate-200">Password</TableHead>
            <TableHead className="text-right font-semibold text-slate-200">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-slate-300">
                No rooms yet.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.roomId}>
                <TableCell>{entry.player}'s room</TableCell>
                <TableCell className="text-right">
                  {entry.requiresPassword ? (
                    <Input
                      type="password"
                      placeholder="Password"
                      maxLength={20}
                      className="ml-auto w-60 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                  ) : (
                    <span className="text-slate-400">Public room</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button>Join</Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
