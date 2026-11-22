import { radarTick } from "./lib/scheduler";
import { practiceTick } from "./lib/practice";

export function startRadar(): void {
  if (process.env.NODE_ENV !== "production") return;
  const tick = () => void radarTick().catch(() => undefined);
  const practice = () => void practiceTick().catch(() => undefined);
  setTimeout(tick, 60_000);
  setTimeout(practice, 5 * 60_000);
  setInterval(practice, 15 * 60_000).unref?.();
  setInterval(tick, 15 * 60_000).unref?.();
}
