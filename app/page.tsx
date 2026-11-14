"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Film, Sparkles, Upload, X, ArrowLeft } from "lucide-react";
import { ZLogo } from "@/components/ZLogo";
import { NetflixSplash } from "@/components/NetflixSplash";
import { StudioDashboard } from "@/components/StudioDashboard";
import { createClient } from "@/lib/supabase/browser";
import { useOnline } from "@/lib/useOnline";
import type { EditPlan, PublicAsset, QAReport, Setup } from "@/lib/types/schema";

type Step = "upload" | "setup" | "preflight" | "processing" | "review";

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
  const { uploads } = await postJson<{ uploads: { path: string; token?: string; url?: string; name: string }[] }>(
    `/api/projects/${projectId}/sign`,
    { files: files.map((f) => ({ name: f.name, size: f.size })) },
  );
  const total = files.reduce((s, f) => s + f.size, 0);
  let done = 0;
  for (let i = 0; i < files.length; i++) {
    const upload = uploads[i];
    if (upload.url) {
      // Direct presigned S3 / Backblaze B2 PUT upload
      const res = await fetch(upload.url, {
        method: "PUT",
        headers: { "Content-Type": files[i].type || "video/mp4" },
        body: files[i],
      });
      if (!res.ok) throw new Error(`Could not upload "${files[i].name}". Please try again.`);
    } else {
      // Fallback: Supabase Storage uploadToSignedUrl
      const sb = createClient();
      const { error } = await sb.storage.from("clips").uploadToSignedUrl(upload.path, upload.token || "", files[i], {
        contentType: files[i].type || "video/mp4",
      });
      if (error) throw new Error(`Could not upload "${files[i].name}". Please try again.`);
    }
    done += files[i].size;
    onProgress(Math.round((done / total) * 100));
  }
  return postJson(`/api/projects/${projectId}/finalize`, { files: uploads.map((u) => ({ path: u.path, name: u.name })) });
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [inEditor, setInEditor] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      setProject(await uploadClips(files, setProgress));
      setStep("setup");
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

  async function handleProcess() {
    if (!project || !estimate) return;
    setStep("processing");
    setError("");
    setStage("analysing");
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.projectId, idempotencyKey: crypto.randomUUID(), approvedCeiling: estimate.ceiling, setup }),
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
    setError("");
    setSetup({ purpose: "auto", mood: "auto", platform: "auto" });
  }

  const nameOf = (id: string) => project?.assets.find((a) => a.id === id)?.originalName ?? "clip";
  const stepIdx = ["upload", "setup", "preflight", "processing", "review"].indexOf(step);

  return (
    <>
      {showSplash && <NetflixSplash onFinish={() => setShowSplash(false)} />}

      {!inEditor ? (
        <StudioDashboard
          userEmail={account?.email}
          userCredits={account?.credits ?? 100}
          onNewProject={() => setInEditor(true)}
          onSignOut={signOut}
        />
      ) : (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
          <header className="mb-8">
            <div className="flex items-center gap-3 text-cyan">
              <button
                onClick={() => setInEditor(false)}
                className="flex items-center gap-1.5 text-xs font-mono text-muted hover:text-white bg-surface border border-border px-3 py-1.5 rounded-xl transition mr-2"
              >
                <ArrowLeft size={14} />
                <span>Dashboard</span>
              </button>
              <ZLogo size={34} />
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-ink">
                  Z<span className="text-cyan">CLIP</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan">
                  STUDIO
                </span>
              </div>
              {account && (
                <span className="ml-auto flex items-center gap-3 text-sm text-muted">
                  <span className="rounded-full border border-border bg-surface px-3 py-1 text-ink">
                    {account.credits} credit{account.credits === 1 ? "" : "s"} left
                  </span>
                  <button onClick={signOut} className="hover:text-ink">
                    Sign out
                  </button>
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold sm:text-3xl text-ink">
              Upload your footage. Let ZClip do the editing.
            </h1>
            <div className="mt-5 flex gap-2" aria-label="Progress">
              {["Upload", "Setup", "Approve", "Edit", "Review"].map((label, i) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i <= stepIdx
                        ? "bg-gradient-to-r from-cyan to-[#2dbbd4] shadow-[0_0_8px_rgba(57,215,242,0.6)]"
                        : "bg-border"
                    }`}
                  />
                  <span className={`mt-1.5 block text-xs font-medium ${i <= stepIdx ? "text-cyan" : "text-muted"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </header>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {step === "upload" && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-cyan/40 bg-surface-raised px-4 py-10 text-center transition hover:border-cyan"
          >
            <Upload className="text-cyan" />
            <p className="mt-3 font-medium">Drop your clips here, or tap to choose</p>
            <p className="mt-1 text-sm text-muted">Up to {MAX_CLIPS} clips, 500 MB total. MP4, MOV, WebM, AVI.</p>
            <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <>
              <ul className="mt-4 divide-y divide-border">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-muted">
                      {fmtMB(f.size)}
                      <button aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-surface-raised">
                        <X size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">
                {files.length} clip{files.length > 1 ? "s" : ""} · {fmtMB(totalBytes)}
              </p>
              {busy && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-cyan transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <button onClick={handleUpload} disabled={busy || !online} className="mt-4 w-full rounded-xl bg-cyan px-4 py-3 font-semibold text-background transition hover:brightness-110 disabled:opacity-60">
                {busy ? `Uploading… ${progress}%` : "Continue"}
              </button>
            </>
          )}
        </section>
      )}

      {step === "setup" && project && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">
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
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-cyan bg-cyan/15 text-cyan" : "border-border bg-surface-raised text-ink hover:border-muted"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <button onClick={goPreflight} disabled={!online} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-3 font-semibold text-background transition hover:brightness-110 disabled:opacity-60">
            <Sparkles size={18} /> Review cost and edit
          </button>
          <button onClick={goPreflight} disabled={!online} className="mt-2 w-full py-2 text-sm text-muted hover:text-ink">
            Skip questions and let ZClip decide
          </button>
        </section>
      )}

      {step === "preflight" && estimate && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-medium">Review your edit</h2>
          <p className="mt-1 text-sm text-muted">
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
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            <li>We hold the maximum while the edit runs, and release whatever isn&apos;t used.</li>
            <li>You are never charged above the maximum without asking again.</li>
            <li>If the edit fails or is withheld by our checks, the credits are returned.</li>
          </ul>
          {!estimate.sufficient && (
            <p role="alert" className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              Not enough credits: this edit needs {estimate.ceiling} available and you have {estimate.available}. Try fewer or shorter clips.
            </p>
          )}
          <button onClick={handleProcess} disabled={!estimate.sufficient || !online} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-3 font-semibold text-background transition hover:brightness-110 disabled:opacity-60">
            <Sparkles size={18} /> Approve and start edit
          </button>
          <button onClick={() => setStep("setup")} className="mt-2 w-full py-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </section>
      )}

      {step === "processing" && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-medium">ZClip is editing your video</p>
          <ol className="mt-4 space-y-3">
            {STAGES.map((s, i) => {
              const cur = STAGES.findIndex((x) => x.id === stage);
              const done = i < cur;
              const active = i === cur;
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-cyan bg-cyan text-background" : active ? "border-cyan" : "border-border"}`}>
                    {done ? <Check size={14} /> : active ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan border-t-transparent" /> : null}
                  </span>
                  <span className={done || active ? "text-ink" : "text-muted"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-muted">Keep this tab open. Longer footage takes longer.</p>
        </section>
      )}

      {step === "review" && result && (
        <section className="space-y-4">
          {result.status === "ready" && result.outputUrl ? (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <video src={result.outputUrl} controls playsInline className="mx-auto max-h-[70vh] w-full rounded-lg bg-black" />
              <a href={result.downloadUrl ?? result.outputUrl} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-3 font-semibold text-background transition hover:brightness-110">
                <Download size={18} /> Download MP4
              </a>
            </div>
          ) : (
            <div role="alert" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <p className="font-medium">This video didn&apos;t pass ZClip&apos;s technical checks, so it was withheld.</p>
              <ul className="mt-2 list-disc pl-5">
                {result.qa.hardChecks.filter((c) => !c.ok).map((c) => (
                  <li key={c.name}>{c.name}: {c.detail}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <p className="text-ink">{result.plan.summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Length", fmtSec(result.metrics.outputDurationSec)],
                ["Clips used", String(new Set(result.plan.segments.map((s) => s.assetId)).size)],
                ["Edited by", result.metrics.provider === "gemini" ? "Gemini" : "Basic editor"],
                ["Render time", `${(result.metrics.renderMs / 1000).toFixed(0)}s`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {result.metrics.fallbackReason && (
              <p className="mt-3 text-xs text-warning">AI step failed, so the basic editor was used instead: {result.metrics.fallbackReason}</p>
            )}
            {result.qa.warnings.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-warning">
                {result.qa.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          {result.receipt && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <h2 className="font-display font-medium">Receipt</h2>
              <dl className="mt-3 divide-y divide-border">
                {[
                  ["Held for this edit", `${result.receipt.reserved} credits`],
                  ["Used", `${result.receipt.consumed} credits`],
                  ["Released back to you", `${result.receipt.released} credits`],
                  ["Available now", `${result.receipt.available} credits`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted">Job {result.receipt.jobId.slice(0, 8)}</p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display font-medium">Why each cut was made</h2>
            <ol className="mt-3 space-y-2">
              {result.plan.segments.map((s, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface-raised p-3 text-sm">
                  <div className="flex justify-between gap-2 text-xs text-muted">
                    <span className="truncate">{i + 1}. {nameOf(s.assetId)}</span>
                    <span className="shrink-0 font-mono">{s.startSec.toFixed(1)}s to {s.endSec.toFixed(1)}s</span>
                  </div>
                  <p className="mt-1 text-ink">{s.reason}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("preflight")} className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:border-muted">
              Try different settings
            </button>
            <button onClick={reset} className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:border-muted">
              Start a new video
            </button>
          </div>
        </section>
      )}
    </main>
    )}
    </>
  );
}
