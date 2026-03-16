"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const HEALTH_REFRESH_MS = 10000;

function toneForStatus(status) {
  // Healthy states
  if (status === "ok" || status === "connected") {
    return "ok";
  }

  // Degraded but not failed
  if (
    status === "degraded" ||
    status === "connecting" ||
    status === "checking"
  ) {
    return "warn";
  }

  // Explicit failure or unknown/unsupported states
  // e.g., "disconnected", "error", "unreachable", etc.
  return "down";
}

export function StatusPanel({ socketUrl }) {
  const [health, setHealth] = useState(null);
  const [socketState, setSocketState] = useState("connecting");
  const [lastSignal, setLastSignal] = useState("Awaiting socket activity");

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = await response.json();

        if (active) {
          setHealth(payload);
        }
      } catch (error) {
        if (active) {
          setHealth({
            status: "degraded",
            backend: {
              status: "unreachable",
              error: error.message,
            },
          });
        }
      }
    }

    loadHealth();
    const timer = setInterval(loadHealth, HEALTH_REFRESH_MS);

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

    socket.on("welcome", (payload) => {
      setLastSignal(payload.message);
    });

    socket.on("heartbeat", (payload) => {
      setLastSignal(`Heartbeat at ${payload.timestamp}`);
    });

    return () => {
      socket.close();
    };
  }, [socketUrl]);

  const frontendStatus = health?.status || "checking";
  const backendStatus = health?.backend?.status || "checking";
  const databaseStatus = health?.backend?.database || "checking";

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
          <div className={`value ${toneForStatus(socketState)}`}>{socketState}</div>
        </article>
      </div>
      <div className="meta">
        <div>Socket target: {socketUrl}</div>
        <div>Last signal: {lastSignal}</div>
        <div>Health checked: {health?.checkedAt || "Waiting for first response"}</div>
      </div>
    </section>
  );
}
