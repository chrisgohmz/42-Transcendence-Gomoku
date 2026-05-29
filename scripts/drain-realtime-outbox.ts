import { drainMatchRealtimeOutbox } from "../app/lib/matches/realtime-publisher";

const limit = Number(process.env["REALTIME_OUTBOX_DRAIN_LIMIT"] ?? 25);

const summary = await drainMatchRealtimeOutbox({
  limit: Number.isInteger(limit) && limit > 0 ? limit : 25,
});

console.log(JSON.stringify(summary));
