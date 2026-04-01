"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const HEALTH_REFRESH_MS = 10000;

type Tone = "ok" | "warn" | "down";

type PanelStatus =
  | "checking"
  | "connected"
  | "connecting"
  | "degraded"
  | "disconnected"
  | "error"
  | "ok"
  | "unreachable";

type BackendHealth = {
  status: PanelStatus;
  database?: PanelStatus;
  error?: string;
};

type FrontendHealth = {
  status: PanelStatus;
  backend?: BackendHealth;
  checkedAt?: string;
};

type StatusPanelProps = {
  socketUrl: string;
};

type WelcomePayload = {
  message: string;
};

type HeartbeatPayload = {
  timestamp: string;
};

function toneForStatus(status: PanelStatus): Tone {
  if (status === "ok" || status === "connected") {
    return "ok";
  }

  if (
    status === "degraded" ||
    status === "connecting" ||
    status === "checking"
  ) {
    return "warn";
  }

  return "down";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function StatusPanel({ socketUrl }: StatusPanelProps) {
  const [health, setHealth] = useState<FrontendHealth | null>(null);
  const [socketState, setSocketState] = useState<PanelStatus>("connecting");
  const [lastSignal, setLastSignal] = useState("Awaiting socket activity");

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as FrontendHealth;

        if (active) {
          setHealth(payload);
        }
      } catch (error) {
        if (active) {
          setHealth({
            status: "degraded",
            backend: {
              status: "unreachable",
              error: getErrorMessage(error),
            },
          });
        }
      }
    };

    void loadHealth();
    const timer = setInterval(() => {
      void loadHealth();
    }, HEALTH_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setSocketState("connected");
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketState("error");
    });

    socket.on("welcome", (payload: WelcomePayload) => {
      setLastSignal(payload.message);
    });

    socket.on("heartbeat", (payload: HeartbeatPayload) => {
      setLastSignal(`Heartbeat at ${payload.timestamp}`);
    });

    return () => {
      socket.close();
    };
  }, [socketUrl]);

  const frontendStatus = health?.status ?? "checking";
  const backendStatus = health?.backend?.status ?? "checking";
  const databaseStatus = health?.backend?.database ?? "checking";

  return (
    <section className="panel">
      <div className="panel-grid">
        <article className="card">
          <div className="label">Frontend</div>
          <div className={`value ${toneForStatus(frontendStatus)}`}>
            {frontendStatus}
          </div>
        </article>
        <article className="card">
          <div className="label">Backend</div>
          <div className={`value ${toneForStatus(backendStatus)}`}>
            {backendStatus}
          </div>
        </article>
        <article className="card">
          <div className="label">Database</div>
          <div className={`value ${toneForStatus(databaseStatus)}`}>
            {databaseStatus}
          </div>
        </article>
        <article className="card">
          <div className="label">Socket.IO</div>
          <div className={`value ${toneForStatus(socketState)}`}>
            {socketState}
          </div>
        </article>
      </div>
      <div className="meta">
        <div>Socket target: {socketUrl}</div>
        <div>Last signal: {lastSignal}</div>
        <div>
          Health checked: {health?.checkedAt ?? "Waiting for first response"}
        </div>
      </div>
    </section>
  );
}
