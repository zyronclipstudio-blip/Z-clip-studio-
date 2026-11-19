export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The running build's id. The app compares it with the id baked into the page it loaded.
export async function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
