// Starts the AI's daily homework once the server is up. Checks every 15 minutes; the database decides when a run is due.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { radarTick } = await import("./lib/scheduler");
  const tick = () => void radarTick().catch(() => undefined);
  setTimeout(tick, 60_000);
  setInterval(tick, 15 * 60_000).unref?.();
}
