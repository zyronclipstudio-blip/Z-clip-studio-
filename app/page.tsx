"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Film, Share2, Sparkles, Upload, X } from "lucide-react";
import { NetflixSplash } from "@/components/NetflixSplash";
import { StudioDashboard } from "@/components/StudioDashboard";
import { AppShell, type Tab } from "@/components/AppShell";
import { ManualEditor } from "@/components/ManualEditor";
import { PLATFORM_CAP_SECONDS } from "@/lib/caps";
import { EditPlanSchema } from "@/lib/types/schema";
import { createClient } from "@/lib/supabase/browser";
import { useOnline } from "@/lib/useOnline";
import type { EditPlan, PublicAsset, QAReport, Setup } from "@/lib/types/schema";

type Step = "upload" | "setup" | "canvas" | "preflight" | "processing" | "review";
type Mode = "auto" | "manual";
const CANVASES: [EditPlan["aspectRatio"], string, string][] = [["9:16", "Vertical", "TikTok, Reels, Shorts"], ["1:1", "Square", "Feed posts"], ["16:9", "Wide", "YouTube, laptop"]];

interface Metrics {
  provider: "gemini" | "deterministic";
  model?: string;
  fallbackReason?: string;
  renderMs: number;
  outputDurationSec: number;
  clipCount: number;
}
interface Estimate {
  totalSeconds: number;
  estimated: number;
  ceiling: number;
  available: number;
  afterEstimate: number;
  afterCeiling: number;
  sufficient: boolean;
}
interface Receipt {
  jobId: string;
  reserved: number;
  consumed: number;
  released: number;
  available: number;
}
interface Result {
  status: "ready" | "withheld";
  plan: EditPlan;
  qa: QAReport;
  outputUrl?: string;
  downloadUrl?: string;
  credits?: number;
  receipt?: Receipt;
  metrics: Metrics;
}

const MAX_CLIPS = 20;
const MAX_BYTES = 500 * 1024 * 1024;

const STAGES = [
  { id: "analysing", label: "Checking your footage" },
  { id: "planning", label: "Planning the edit" },
  { id: "rendering", label: "Rendering the video" },
  { id: "inspecting", label: "Inspecting the result" },
] as const;

const QUESTIONS: { key: keyof Setup; title: string; options: [string, string][] }[] = [
  {
    key: "purpose",
    title: "What are you creating?",
    options: [["cinematic", "Cinematic video"], ["gym", "Gym or sports edit"], ["business", "Business promotion"], ["general", "General video"], ["auto", "Let ZClip understand my footage"]],
  },
  {
    key: "mood",
    title: "What feeling should it have?",
    options: [["energetic", "Energetic"], ["cinematic", "Cinematic"], ["calm", "Calm"], ["professional", "Professional"], ["auto", "Let ZClip decide"]],
  },
  {
    key: "platform",
    title: "Where will you use it?",
    options: [["shorts", "TikTok / Reels / Shorts"], ["youtube", "YouTube"], ["other", "Other platforms"], ["auto", "Not sure yet"]],
  },
];

const fmtMB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

// Create project -> get server-approved upload paths -> upload straight to private storage -> server verifies.
async function uploadClips(files: File[], onProgress: (pct: number) => void): Promise<{ projectId: string; assets: PublicAsset[] }> {
  const { projectId } = await postJson<{ projectId: string }>("/api/projects", {});
  const { uploads } = await postJson<{ uploads: { path: string; token?: string; url?: string; name: string; contentType: string }[] }>(
    `/api/projects/${projectId}/sign`,
    { files: files.map((f) => ({ name: f.name, size: f.size })) },
  );
  const total = files.reduce((s, f) => s + f.size, 0);
  let done = 0;
  for (let i = 0; i < files.length; i++) {
    const upload = uploads[i];
    if (upload.url) {
      // Direct presigned S3 / Backblaze B2 PUT upload
      let ok = false;
      let status = 0;
      try {
        const res = await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType },
          body: files[i],
        });
        ok = res.ok;
        status = res.status;
      } catch {
        // This browser or network can't reach storage directly. Send it through ZClip instead.
        try {
          const prox = await fetch(`/api/projects/${projectId}/upload-proxy?path=${encodeURIComponent(upload.path)}`, {
            method: "POST",
            headers: { "Content-Type": upload.contentType },
            body: files[i],
          });
          ok = prox.ok;
          status = prox.status;
          if (!prox.ok) {
            const d = await prox.json().catch(() => null);
            if (d?.error) throw new Error(d.error);
          }
        } catch (e) {
          if (e instanceof Error && e.message && !/fetch|network/i.test(e.message)) throw e;
          throw new Error("Could not upload. Please check your internet connection and try again. Code: UPLOAD_NETWORK");
        }
      }
      if (!ok) throw new Error(`Could not upload "${files[i].name}". Storage answered ${status}. Please try again.`);
    } else {
      // Fallback: Supabase Storage uploadToSignedUrl
      const sb = createClient();
      const { error } = await sb.storage.from("clips").uploadToSignedUrl(upload.path, upload.token || "", files[i], {
        contentType: upload.contentType,
      });
      if (error) throw new Error(`Could not upload "${files[i].name}". Please try again.`);
    }
    done += files[i].size;
    onProgress(Math.round((done / total) * 100));
  }
  const fin = await postJson<{ projectId?: string; assets?: PublicAsset[] }>(`/api/projects/${projectId}/finalize`, {
    files: uploads.map((u) => ({ path: u.path, name: u.name })),
  });
  return { projectId, assets: Array.isArray(fin.assets) ? fin.assets : [] };
}

// Opens the phone's own share sheet (WhatsApp, TikTok, Instagram, Telegram, Gmail, ...) with the real video file.
async function shareVideo(url: string) {
  if (!url) return;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], "zclip-video.mp4", { type: "video/mp4" });
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: "My ZClip video", text: "Made with ZClip (Zyron Clip Studio)" });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return; // the person closed the share sheet
  }
  // Fallback: share the link, or copy it.
  if (nav.share) await nav.share({ title: "My ZClip video", url }).catch(() => undefined);
  else await navigator.clipboard?.writeText(url).catch(() => undefined);
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [inEditor, setInEditor] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [canvas, setCanvas] = useState<EditPlan["aspectRatio"]>("9:16");
  const [tab, setTab] = useState<Tab>("home");
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Tells the quiet auto-updater not to reload while an upload or render is running.
  useEffect(() => {
    (window as unknown as { __zclipBusy?: boolean }).__zclipBusy = busy;
    return () => { (window as unknown as { __zclipBusy?: boolean }).__zclipBusy = false; };
  }, [busy]);
  const [project, setProject] = useState<{ projectId: string; assets: PublicAsset[] } | null>(null);
  const [setup, setSetup] = useState<Setup>({ purpose: "auto", mood: "auto", platform: "auto" });
  const [stage, setStage] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const [account, setAccount] = useState<{ email: string; credits: number } | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => a && setAccount({ email: a.email, credits: a.credits }))
      .catch(() => undefined);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const videos = Array.from(list).filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi)$/i.test(f.name));
    const next = [...files, ...videos];
    if (next.length > MAX_CLIPS) return setError(`You can add up to ${MAX_CLIPS} clips.`);
    if (next.reduce((s, f) => s + f.size, 0) > MAX_BYTES) return setError("That is more than 500 MB in total. Remove a clip or two.");
    setError("");
    setFiles(next);
  }

  async function handleUpload() {
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const uploaded = await uploadClips(files, setProgress);
      setProject(uploaded);
      if (mode === "manual") setStep("canvas");
      else await autoStart(uploaded.projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function goPreflight() {
    if (!project) return;
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.projectId}/estimate`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not estimate the cost.");
      setEstimate(data);
      setStep("preflight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not estimate the cost.");
    }
  }

  // Auto edit: no questions. Work out the cost, and if the person has enough credits just start.
  async function autoStart(projectId: string) {
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not estimate the cost.");
      setEstimate(data);
      if (data.sufficient) await handleProcess(projectId, data);
      else setStep("preflight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the edit.");
      setStep("upload");
    }
  }

  // Manual edit: no AI, no questions. Every clip whole, in order, on the chosen canvas.
  function openManual() {
    if (!project) return;
    const segments = project.assets.map((a) => ({
      assetId: a.id,
      startSec: 0,
      endSec: Math.round(a.durationSec * 100) / 100,
      reason: "Your clip, kept as shot.",
      confidence: 1,
      transition: "cut" as const,
    }));
    const plan = EditPlanSchema.parse({
      version: 1,
      source: "deterministic",
      aspectRatio: canvas,
      pacing: "medium",
      targetDurationSec: segments.reduce((t, g) => t + g.endSec - g.startSec, 0),
      summary: "Manual edit. Cut, arrange and export it yourself.",
      segments,
    });
    setVersions([]);
    setResult({ status: "ready", plan, qa: { passed: true, hardChecks: [], warnings: [] }, metrics: { provider: "deterministic", renderMs: 0, outputDurationSec: plan.targetDurationSec, clipCount: project.assets.length } } as Result);
    setStep("review");
  }

  async function handleProcess(pid?: string, est?: Estimate) {
    const projectId = pid ?? project?.projectId;
    const estimateNow = est ?? estimate;
    if (!projectId || !estimateNow) return;
    setStep("processing");
    setError("");
    setStage("analysing");
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idempotencyKey: crypto.randomUUID(), approvedCeiling: estimateNow.ceiling, setup }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start the edit.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "stage") setStage(ev.stage);
          if (ev.type === "error") throw new Error(ev.message);
          if (ev.type === "done") {
            if (typeof ev.credits === "number") setAccount((a) => (a ? { ...a, credits: ev.credits } : a));
            setResult(ev);
            setStep("review");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep("preflight");
    }
  }

  function reset() {
    setStep("upload");
    setFiles([]);
    setProject(null);
    setResult(null);
    setVersions([]);
    setError("");
    setSetup({ purpose: "auto", mood: "auto", platform: "auto" });
  }

  const [versions, setVersions] = useState<{ version: number; createdAt: string; plan: EditPlan }[]>([]);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");

  async function handleOpen(projectId: string) {
    setOpening(true);
    setOpenError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/open`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not open this edit.");
      setMode("auto");
      setProject({ projectId: d.projectId, assets: d.assets });
      setSetup((prev) => ({ ...prev, purpose: d.purpose ?? prev.purpose, mood: d.mood ?? prev.mood, platform: d.platform ?? "auto" }));
      if (d.resume) {
        // Unfinished project: continue from setup with the clips already uploaded.
        setVersions([]);
        setResult(null);
        setEstimate(null);
        setStep("setup");
        setInEditor(true);
        return;
      }
      setVersions(d.versions ?? []);
      setResult({
        status: "ready",
        plan: d.plan,
        qa: { passed: true, hardChecks: [], warnings: [] },
        outputUrl: d.outputUrl,
        downloadUrl: d.downloadUrl,
        metrics: { provider: "deterministic", renderMs: 0, outputDurationSec: d.plan.targetDurationSec, clipCount: d.assets.length },
      } as Result);
      setStep("review");
      setInEditor(true);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "Could not open this edit.");
    } finally {
      setOpening(false);
    }
  }

  const [rerendering, setRerendering] = useState(false);
  const [rerenderError, setRerenderError] = useState("");

  async function handleRerender(plan: EditPlan) {
    if (!project) return;
    setRerendering(true);
    setRerenderError("");
    try {
      const res = await fetch("/api/rerender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.projectId, idempotencyKey: crypto.randomUUID(), plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not render that change.");
      setVersions((v) => [{ version: (v[0]?.version ?? 0) + 1, createdAt: new Date().toISOString(), plan: data.plan }, ...v].slice(0, 15));
      setResult((prev) => (prev ? { ...prev, status: data.status, plan: data.plan, qa: data.qa, outputUrl: data.outputUrl ?? prev.outputUrl, downloadUrl: data.downloadUrl ?? prev.downloadUrl, metrics: { ...prev.metrics, ...data.metrics } } : prev));
    } catch (e) {
      setRerenderError(e instanceof Error ? e.message : "Could not render that change.");
    } finally {
      setRerendering(false);
    }
  }

  const labels = mode === "manual" ? ["Upload", "Canvas", "Edit"] : ["Upload", "Edit", "Review"];
  const stepIdx = mode === "manual"
    ? { upload: 0, canvas: 1, review: 2 }[step as "upload" | "canvas" | "review"] ?? 0
    : { upload: 0, setup: 1, preflight: 1, processing: 1, canvas: 1, review: 2 }[step];

  return (
    <>
      {showSplash && <NetflixSplash onFinish={() => setShowSplash(false)} />}

      <AppShell
        wide={inEditor && step === "review" && Boolean(result)}
        tab={inEditor ? "new" : tab}
        onTab={(t) => {
          if (t === "new") { setMode("auto"); setInEditor(true); }
          else {
            setInEditor(false);
            setTab(t);
          }
        }}
        credits={account?.credits}
        email={account?.email}
        onSignOut={signOut}
      >
      {!inEditor ? (
        <StudioDashboard
          view={tab === "edits" ? "edits" : "home"}
          userCredits={account?.credits}
          onNewProject={(m) => { setMode(m); if (step !== "upload" || result) reset(); setInEditor(true); }}
          onOpenProject={handleOpen}
          onShowEdits={() => setTab("edits")}
          onBackHome={() => setTab("home")}
          opening={opening}
          openError={openError}
        />
      ) : (
        <main className="relative w-full text-[#eceff4]">
          <header className="mb-6">
            <h1 className="mt-5 font-display text-[24px] font-semibold leading-tight sm:text-3xl text-[#eceff4]">
              {mode === "manual" ? "Manual edit" : "Auto edit"}
            </h1>
            <div className="mt-5 flex gap-2" aria-label="Progress">
              {labels.map((label, i) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i <= stepIdx
                        ? "bg-gradient-to-r from-[#d9b45b] to-[#ecd083] shadow-[0_0_8px_rgba(217,180,91,0.6)]"
                        : "bg-border"
                    }`}
                  />
                  <span className={`mt-1.5 block text-[11px] font-medium ${i <= stepIdx ? "text-[#d9b45b]" : "text-[#8d97a8]"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </header>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === "upload" && (
        <section className="zy-card p-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#d9b45b]/40 bg-[#181c25] px-4 py-10 text-center transition hover:border-[#d9b45b]"
          >
            <Upload className="text-[#d9b45b]" />
            <p className="mt-3 font-medium">Drop your clips here, or tap to choose</p>
            <p className="mt-1 text-sm text-[#8d97a8]">Up to {MAX_CLIPS} clips, 500 MB total. MP4, MOV, WebM, AVI.</p>
            <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <>
              <ul className="mt-4 divide-y divide-border">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-[#8d97a8]">
                      {fmtMB(f.size)}
                      <button aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-[#181c25]">
                        <X size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-[#8d97a8]">
                {files.length} clip{files.length > 1 ? "s" : ""} · {fmtMB(totalBytes)}
              </p>
              {busy && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-gradient-to-r from-[#ecd083] to-[#b88f38] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <button onClick={handleUpload} disabled={busy || !online} className="mt-4 w-full zy-btn-gold rounded-[14px] min-h-14 px-4 py-3 text-base transition active:scale-[0.99] disabled:opacity-60">
                {busy ? `Uploading… ${progress}%` : "Continue"}
              </button>
            </>
          )}
        </section>
      )}

      {step === "canvas" && project && (
        <section className="zy-card p-5">
          <p className="text-sm text-[#8d97a8]">
            {project.assets.length} clip{project.assets.length > 1 ? "s" : ""} · {fmtSec(project.assets.reduce((s, a) => s + a.durationSec, 0))}. Pick your canvas. You can trim, split, arrange and add effects next.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {CANVASES.map(([ratio, name, hint]) => (
              <button key={ratio} type="button" aria-pressed={canvas === ratio} onClick={() => setCanvas(ratio)} className={`flex flex-col items-center gap-2 rounded-[16px] border p-3 text-center transition ${canvas === ratio ? "border-[#d9b45b] bg-[#d9b45b]/10" : "border-[#242a35] bg-[#11141b]"}`}>
                <span className="border border-[#d9b45b]/60 bg-black/40" style={{ aspectRatio: ratio.replace(":", " / "), width: ratio === "16:9" ? 56 : ratio === "1:1" ? 38 : 28 }} />
                <b className="text-[13px] font-semibold">{ratio}</b>
                <span className="text-[11px] leading-4 text-[#8d97a8]">{name}<br />{hint}</span>
              </button>
            ))}
          </div>
          <button onClick={openManual} className="mt-6 flex w-full items-center justify-center gap-2 zy-btn-gold rounded-[14px] min-h-14 px-4 py-3 text-base transition active:scale-[0.99]">Open editor</button>
        </section>
      )}

      {step === "setup" && project && (
        <section className="zy-card p-5">
          <p className="text-sm text-[#8d97a8]">
            {project.assets.length} clip{project.assets.length > 1 ? "s" : ""} ready · {fmtSec(project.assets.reduce((s, a) => s + a.durationSec, 0))} of footage. Every question is optional.
          </p>
          {QUESTIONS.map((q) => (
            <fieldset key={q.key} className="mt-5">
              <legend className="mb-2 font-medium">{q.title}</legend>
              <div className="flex flex-wrap gap-2">
                {q.options.map(([value, label]) => {
                  const active = setup[q.key] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSetup({ ...setup, [q.key]: value })}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-[#d9b45b] bg-[#d9b45b]/15 text-[#d9b45b]" : "border-white/10 bg-[#181c25] text-[#eceff4] hover:border-muted"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <button onClick={goPreflight} disabled={!online} className="mt-6 flex w-full items-center justify-center gap-2 zy-btn-gold rounded-[14px] min-h-14 px-4 py-3 text-base transition active:scale-[0.99] disabled:opacity-60">
            <Sparkles size={18} /> Review cost and edit
          </button>
          <button onClick={goPreflight} disabled={!online} className="mt-2 w-full py-2 text-sm text-[#8d97a8] hover:text-[#eceff4]">
            Skip questions and let ZClip decide
          </button>
        </section>
      )}

      {step === "preflight" && estimate && (
        <section className="zy-card p-5">
          <h2 className="font-display text-lg font-medium">Review your edit</h2>
          <p className="mt-1 text-sm text-[#8d97a8]">
            Based on {fmtSec(estimate.totalSeconds)} of footage. You approve the cost before anything starts.
          </p>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              ["Available now", `${estimate.available} credits`],
              ["Expected for this edit", `${estimate.estimated} credits`],
              ["Maximum you authorise", `${estimate.ceiling} credits`],
              ["Remaining after (expected)", `${estimate.afterEstimate} credits`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-[#8d97a8]">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-1 text-sm text-[#8d97a8]">
            <li>We hold the maximum while the edit runs, and release whatever isn&apos;t used.</li>
            <li>You are never charged above the maximum without asking again.</li>
            <li>If the edit fails or is withheld by our checks, the credits are returned.</li>
          </ul>
          {!estimate.sufficient && (
            <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              Not enough credits: this edit needs {estimate.ceiling} available and you have {estimate.available}. Try fewer or shorter clips.
            </p>
          )}
          <button onClick={() => void handleProcess()} disabled={!estimate.sufficient || !online} className="mt-5 flex w-full items-center justify-center gap-2 zy-btn-gold rounded-[14px] min-h-14 px-4 py-3 text-base transition active:scale-[0.99] disabled:opacity-60">
            <Sparkles size={18} /> Approve and start edit
          </button>
          <button onClick={() => setStep("setup")} className="mt-2 w-full py-2 text-sm text-[#8d97a8] hover:text-[#eceff4]">
            Cancel
          </button>
        </section>
      )}

      {step === "processing" && (
        <section className="zy-card p-5">
          <p className="font-medium">ZClip is editing your video</p>
          <ol className="mt-4 space-y-3">
            {STAGES.map((s, i) => {
              const cur = STAGES.findIndex((x) => x.id === stage);
              const done = i < cur;
              const active = i === cur;
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-[#d9b45b] bg-[#d9b45b] text-[#05060a]" : active ? "border-[#d9b45b]" : "border-white/10"}`}>
                    {done ? <Check size={14} /> : active ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#d9b45b] border-t-transparent" /> : null}
                  </span>
                  <span className={done || active ? "text-[#eceff4]" : "text-[#8d97a8]"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-[#8d97a8]">Keep this tab open. Longer footage takes longer.</p>
        </section>
      )}

      {step === "review" && result && (
        <section className="space-y-4 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:sticky lg:top-4">
          {mode === "manual" && !result.outputUrl ? null : result.status === "ready" && result.outputUrl ? (
            <div className="zy-card p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="zy-icon green flex h-10 w-10 items-center justify-center rounded-xl"><Check size={18} /></span>
                <div>
                  <p className="font-semibold text-[#eceff4]">Your video is ready</p>
                  <p className="text-xs text-[#8d97a8]">Watch it, download it, or fix anything below.</p>
                </div>
              </div>
              <video src={result.outputUrl} controls playsInline className="mx-auto max-h-[70vh] w-full rounded-lg bg-black" />
              <a href={result.downloadUrl ?? result.outputUrl} className="mt-4 flex w-full items-center justify-center gap-2 zy-btn-gold rounded-[14px] min-h-14 px-4 py-3 text-base transition active:scale-[0.99]">
                <Download size={18} /> Download MP4
              </a>
              <button
                type="button"
                onClick={() => void shareVideo(result.downloadUrl ?? result.outputUrl ?? "")}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-[#242a35] bg-[#11141b] px-4 text-sm font-medium transition hover:border-[#d9b45b]/50"
              >
                <Share2 size={17} className="text-[#d9b45b]" /> Share
              </button>
            </div>
          ) : (
            <div role="alert" className="rounded-2xl border border-[#ff6171]/35 bg-[#ff6171]/10 p-4 text-sm text-[#ffb3bb]">
              <p className="font-semibold">We couldn&apos;t make your video this time.</p>
              <p className="mt-1 text-xs text-[#ffb3bb]/80">Nothing was lost. Tap &ldquo;Try different settings&rdquo; below to run it again.</p>
              <ul className="mt-2 list-disc pl-5">
                {result.qa.hardChecks.filter((c) => !c.ok).map((c) => (
                  <li key={c.name}>{c.name}: {c.detail}</li>
                ))}
              </ul>
            </div>
          )}

          {!(mode === "manual" && !result.outputUrl) && <div className="zy-card p-4 text-sm">
            <p className="text-[#eceff4]">{result.plan.summary}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["Length", fmtSec(result.metrics.outputDurationSec), ""],
                ["Clips used", String(new Set(result.plan.segments.map((s) => s.assetId)).size), "green"],
                ["Edited by", result.metrics.provider === "gemini" ? "Gemini" : "Quick cut", "blue"],
                ["Render time", `${(result.metrics.renderMs / 1000).toFixed(0)}s`, "rose"],
              ] as const).map(([k, v, tone]) => (
                <div key={k} className={`zy-kpi ${tone}`}>
                  <b className={k === "Edited by" ? "!text-base" : ""}>{v}</b>
                  <small>{k}</small>
                </div>
              ))}
            </dl>
            {result.metrics.fallbackReason && (
              <p className="mt-3 text-xs text-amber-200">AI step failed, so the basic editor was used instead: {result.metrics.fallbackReason}</p>
            )}
            {result.qa.warnings.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-amber-200">
                {result.qa.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>}

          {result.receipt && (
            <div className="zy-card p-4 text-sm">
              <h2 className="font-display font-medium">Receipt</h2>
              <dl className="mt-3 divide-y divide-border">
                {[
                  ["Held for this edit", `${result.receipt.reserved} credits`],
                  ["Used", `${result.receipt.consumed} credits`],
                  ["Released back to you", `${result.receipt.released} credits`],
                  ["Available now", `${result.receipt.available} credits`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-[#8d97a8]">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-[#8d97a8]">Job {result.receipt.jobId.slice(0, 8)}</p>
            </div>
          )}

          </div>
          <div className="space-y-4">
          {project && (
            <ManualEditor
              key={result.outputUrl ?? "plan"}
              projectId={project.projectId}
              plan={result.plan}
              assets={project.assets}
              capSec={PLATFORM_CAP_SECONDS[setup.platform]}
              busy={rerendering}
              error={rerenderError}
              onRender={handleRerender}
              versions={versions}
            />
          )}

          <div className="flex gap-3">
            {mode === "auto" && <button onClick={() => setStep("setup")} className="flex-1 rounded-[14px] border border-[#242a35] bg-[#11141b] min-h-12 px-4 py-3 text-sm font-medium hover:border-[#d9b45b]/50">
              Try different settings
            </button>}
            <button onClick={reset} className="flex-1 rounded-[14px] border border-[#242a35] bg-[#11141b] min-h-12 px-4 py-3 text-sm font-medium hover:border-[#d9b45b]/50">
              Start a new video
            </button>
          </div>
          </div>
        </section>
      )}
    </main>
    )}
      </AppShell>
    </>
  );
}
