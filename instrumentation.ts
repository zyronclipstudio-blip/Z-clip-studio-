// Starts the AI's daily homework once the server is up. Checks every 15 minutes; the database decides when a run is due.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRadar } = await import("./instrumentation-node");
    startRadar();
  }
}
