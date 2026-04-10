"use client";

import { useState } from "react";
import { RoomCreateButton } from "../../components/proto/RoomCreateButton";

type Room = {
  id: string;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export default function ProtoPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  async function loadRooms() {
    try {
      const response = await fetch("/api/rooms", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorPayload = (await response
          .json()
          .catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          `Request failed with status ${response.status}`;

        setListError(message);
        setRooms([]);
        return;
      }

      const data = (await response.json()) as Room[];
      setRooms(data);
      setListError(null);
    } catch {
      setListError("Network error while loading rooms");
      setRooms([]);
    }
  }

  // Memo: if we want to use useEffect for loadRooms
  // Put this at the top of this code
  // import { useState } from "react";
  //
  // and activate these hundler
  // useEffect(() => {
  //   void loadRooms();
  // }, []);

  function handleSuccess(nextRoomId: string) {
    setRoomId(nextRoomId);
    setError(null);
  }

  function handleError(message: string) {
    setError(message);
    setRoomId(null);
  }

  return (
    <main className="shell">
      <section className="panel">
        <article className="card">
          <RoomCreateButton onSuccess={handleSuccess} onError={handleError} />
          {roomId ? <p>roomId: {roomId}</p> : null}
          {error ? <p role="alert">error: {error}</p> : null}
        </article>

        <article className="card">
          <button type="button" className="btn" onClick={loadRooms}>
            Load Rooms
          </button>
          <p>rooms:</p>
          {listError ? <p role="alert">error: {listError}</p> : null}
          <ul>
            {rooms.map((room) => (
              <li key={room.id}>
                {room.id}
                {room.id === roomId ? " <- just created" : ""}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
