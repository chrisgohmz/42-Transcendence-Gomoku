"use client";

import GameLobbyTable, { type GameLobbyTableProps } from "@/components/game-lobby-table";

type GameLobbyTableClientProps = Omit<GameLobbyTableProps, "onJoin">;

export default function GameLobbyTableClient(props: GameLobbyTableClientProps) {
  return <GameLobbyTable {...props} />;
}
