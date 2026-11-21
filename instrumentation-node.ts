import { radarTick } from "./lib/scheduler";

export function startRadar(): void {
  if (process.env.NODE_ENV !== "production") return;
  const tick = () => void radarTick().catch(() => undefined);
  setTimeout(tick, 60_000);
  setInterval(tick, 15 * 60_000).unref?.();
}
