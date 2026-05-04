"use client";

import { useTranslations } from "next-intl";
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

type AppHealth = {
  status: PanelStatus;
  database?: PanelStatus;
  error?: string;
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

  if (status === "degraded" || status === "connecting" || status === "checking") {
    return "warn";
  }

  return "down";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function StatusPanel({ socketUrl }: StatusPanelProps) {
  const t = useTranslations("statusPanel");
  const awaitingSocket = t("awaitingSocket");
  const unknownError = t("unknownError");
  const [health, setHealth] = useState<AppHealth | null>(null);
  const [socketState, setSocketState] = useState<PanelStatus>("connecting");
  const [lastSignal, setLastSignal] = useState(awaitingSocket);

  useEffect(() => {
    setLastSignal(awaitingSocket);
  }, [awaitingSocket]);

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as AppHealth;

        if (active) {
          setHealth(payload);
        }
      } catch (error) {
        if (active) {
          setHealth({
            status: "degraded",
            database: "unreachable",
            error: getErrorMessage(error, unknownError),
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
  }, [unknownError]);

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setSocketState("connected");
      setLastSignal(t("connected"));
    });

    socket.on("disconnect", (reason) => {
      setSocketState("disconnected");
      setLastSignal(t("disconnected", { reason }));
    });

    socket.on("connect_error", (error) => {
      setSocketState("error");
      setLastSignal(
        t("connectionError", {
          message: getErrorMessage(error, unknownError),
        }),
      );
    });

    socket.on("welcome", (payload: WelcomePayload) => {
      setLastSignal(payload.message);
    });

    socket.on("heartbeat", (payload: HeartbeatPayload) => {
      setLastSignal(t("heartbeat", { timestamp: payload.timestamp }));
    });

    return () => {
      socket.close();
    };
  }, [socketUrl, t, unknownError]);

  const appStatus = health?.status ?? "checking";
  const databaseStatus = health?.database ?? "checking";

  return (
    <section className="panel">
      <div className="panel-grid">
        <article className="card">
          <div className="label">{t("app")}</div>
          <div className={`value ${toneForStatus(appStatus)}`}>{t(`statuses.${appStatus}`)}</div>
        </article>
        <article className="card">
          <div className="label">{t("database")}</div>
          <div className={`value ${toneForStatus(databaseStatus)}`}>
            {t(`statuses.${databaseStatus}`)}
          </div>
        </article>
        <article className="card">
          <div className="label">{t("socket")}</div>
          <div className={`value ${toneForStatus(socketState)}`}>
            {t(`statuses.${socketState}`)}
          </div>
        </article>
      </div>
      <div className="meta">
        <div>{t("socketTarget", { socketUrl })}</div>
        <div>{t("lastSignal", { signal: lastSignal })}</div>
        {health?.error ? <div>{t("lastHealthError", { error: health.error })}</div> : null}
        <div>
          {t("healthChecked", {
            checkedAt: health?.checkedAt ?? t("waitingForFirstResponse"),
          })}
        </div>
      </div>
    </section>
  );
}
