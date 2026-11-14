import "./setup";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const ROOT = process.env.ZCLIP_ROOT || path.resolve(__dirname, "..");

// ---------- service worker behaviour, run in a sandbox ----------
type Handler = (e: unknown) => void;
function loadSw() {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, unknown>>();
  const fetchCalls: string[] = [];
  const puts: string[] = [];
  let online = true;

  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(u, { cached: u })),
      put: async (req: { url: string }, res: unknown) => {
        puts.push(new URL(req.url).pathname);
        m.set(new URL(req.url).pathname, res);
      },
    };
  };
  const sandbox = {
    URL,
    self: { addEventListener: (t: string, h: Handler) => (handlers[t] = h), location: { origin: "https://app.test" }, skipWaiting: async () => undefined, clients: { claim: async () => undefined } },
    caches: {
      open: async (n: string) => cacheFor(n),
      keys: async () => [...stores.keys()],
      delete: async (n: string) => stores.delete(n),
      match: async (req: string | { url: string }) => {
        const p = typeof req === "string" ? req : new URL(req.url).pathname;
        for (const m of stores.values()) if (m.has(p)) return m.get(p);
        return undefined;
      },
    },
    fetch: async (req: { url: string }) => {
      fetchCalls.push(new URL(req.url).pathname);
      if (!online) throw new TypeError("offline");
      return { ok: true, status: 200, clone() { return this; }, body: "net:" + req.url };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "public/sw.js"), "utf8"), sandbox);

  const req = (url: string, o: { method?: string; mode?: string; range?: boolean } = {}) => ({
    url,
    method: o.method ?? "GET",
    mode: o.mode ?? "cors",
    headers: { has: (h: string) => h.toLowerCase() === "range" && !!o.range },
  });
  const fire = async (r: ReturnType<typeof req>) => {
    let responded: Promise<unknown> | null = null;
    handlers.fetch({ request: r, respondWith: (p: Promise<unknown>) => (responded = Promise.resolve(p)) });
    return responded ? await responded : "PASSED_THROUGH";
  };
  return { handlers, stores, install: async () => { let w: Promise<unknown> = Promise.resolve(); handlers.install({ waitUntil: (p: Promise<unknown>) => (w = p) }); await w; }, fire, req, fetchCalls, puts, setOnline: (v: boolean) => (online = v) };
}

test("service worker never touches sensitive or non-GET requests", async () => {
  const sw = loadSw();
  await sw.install();
  const O = "https://app.test";
  assert.equal(await sw.fire(sw.req(`${O}/api/account`)), "PASSED_THROUGH");
  assert.equal(await sw.fire(sw.req(`${O}/api/process`, { method: "POST" })), "PASSED_THROUGH");
  assert.equal(await sw.fire(sw.req(`${O}/auth/callback?code=1`)), "PASSED_THROUGH");
  assert.equal(await sw.fire(sw.req(`${O}/login`)), "PASSED_THROUGH");
  assert.equal(await sw.fire(sw.req("https://proj.supabase.co/storage/v1/object/sign/exports/u/p/v.mp4?token=x")), "PASSED_THROUGH", "signed media URLs");
  assert.equal(await sw.fire(sw.req(`${O}/_next/static/video.mp4`, { range: true })), "PASSED_THROUGH", "range requests");
  assert.equal(sw.puts.length, 0, "nothing was stored");
});

test("offline navigation shows the offline page; pages are never cached", async () => {
  const sw = loadSw();
  await sw.install();
  sw.setOnline(false);
  const res = (await sw.fire(sw.req("https://app.test/projects", { mode: "navigate" }))) as { cached?: string };
  assert.equal(res.cached, "/offline.html");
  sw.setOnline(true);
  await sw.fire(sw.req("https://app.test/projects", { mode: "navigate" }));
  assert.equal(sw.puts.length, 0, "HTML pages must not be stored");
});

test("static assets are cached after the first load and served from cache after", async () => {
  const sw = loadSw();
  await sw.install();
  const r = sw.req("https://app.test/_next/static/chunks/app.js");
  await sw.fire(r);
  assert.deepEqual(sw.puts, ["/_next/static/chunks/app.js"]);
  const before = sw.fetchCalls.length;
  await sw.fire(r);
  assert.equal(sw.fetchCalls.length, before, "second request is served from cache");
});

test("old caches are removed on activate", async () => {
  const sw = loadSw();
  sw.stores.set("zclip-shell-v0", new Map()); // a stale cache from a previous version
  await sw.install();
  let done: Promise<unknown> = Promise.resolve();
  sw.handlers.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
  await done;
  assert.deepEqual([...sw.stores.keys()], ["zclip-shell-v1"]);
});

// ---------- manifest and icons ----------
function pngSize(file: string) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test("manifest is installable and its icons exist with the declared sizes", async () => {
  const mod = await import("../app/manifest");
  const m = mod.default();
  assert.equal(m.short_name, "ZClip");
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  assert.equal(m.background_color, "#080B11");
  assert.equal(m.theme_color, "#080B11");
  assert.ok(m.icons!.some((i) => i.purpose === "maskable"), "has a maskable icon");
  for (const icon of m.icons!) {
    const file = path.join(ROOT, "public", icon.src);
    assert.ok(fs.existsSync(file), `${icon.src} exists`);
    const [w, h] = icon.sizes!.split("x").map(Number);
    assert.deepEqual(pngSize(file), { w, h }, `${icon.src} dimensions`);
  }
  assert.ok(m.icons!.some((i) => i.sizes === "192x192") && m.icons!.some((i) => i.sizes === "512x512"));
  assert.ok(fs.existsSync(path.join(ROOT, "public/icons/apple-touch-icon.png")));
  assert.ok(fs.existsSync(path.join(ROOT, "public/offline.html")));
});

// ---------- middleware must not intercept PWA files ----------
test("middleware matcher skips PWA files but covers pages and APIs", () => {
  const src = fs.readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
  const pattern = /matcher:\s*\["([^"]+)"\]/.exec(src)![1];
  const re = new RegExp(`^${pattern}$`);
  for (const p of ["/sw.js", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/_next/static/a.js", "/favicon.ico"])
    assert.equal(re.test(p), false, `${p} must bypass middleware`);
  for (const p of ["/", "/login", "/api/account", "/anything"]) assert.equal(re.test(p), true, `${p} must be covered`);
});

// ---------- service worker registration safety ----------
test("service worker registers only in production", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/PwaShell.tsx"), "utf8");
  assert.match(src, /process\.env\.NODE_ENV === "production"/);
});
