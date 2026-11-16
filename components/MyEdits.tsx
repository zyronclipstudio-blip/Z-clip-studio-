"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Film, LoaderCircle, Play, Search, Trash2 } from "lucide-react";
type Edit = { id: string; status: string; purpose: string; createdAt: string; outputUrl?: string; downloadUrl?: string };
const titleFor = (purpose: string) => ({ cinematic: "Cinematic edit", gym: "Gym & sports edit", business: "Business promotion", general: "Video edit", auto: "Automatic edit" }[purpose] || "Video edit");
const statusLabel = (status: string) => ({ ready: "Ready", rendering: "Rendering", analysing: "Analysing", planning: "Planning", uploading: "Uploading", qa_failed: "Quality check needed", failed: "Could not finish", unavailable: "Video unavailable" }[status] || "In progress");
export function MyEdits({ onBack }: { onBack: () => void }) {
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your edits.");
      setEdits(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load your edits."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => edits.filter((edit) => titleFor(edit.purpose).toLowerCase().includes(query.toLowerCase()) || statusLabel(edit.status).toLowerCase().includes(query.toLowerCase())), [edits, query]);
  async function removeEdit(edit: Edit) {
    if (!window.confirm("Delete this project and its saved video? This cannot be undone.")) return;
    setDeleting(edit.id); setError("");
    try {
      const response = await fetch(`/api/projects/${edit.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this project.");
      setEdits((current) => current.filter((item) => item.id !== edit.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete this project."); }
    finally { setDeleting(null); }
  }
  return <section className="relative z-10 mx-auto w-full max-w-5xl flex-1 py-7 sm:py-10">
    <button onClick={onBack} className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-[#E2CFDA] transition hover:border-[#EC8CBA]/40 hover:text-white"><ArrowLeft size={16}/> Back to studio</button>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] tracking-[0.2em] text-[#EC8CBA]">YOUR WORKSPACE</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">My Edits</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#B6A5B2]">Your finished videos and projects, together in one place.</p></div><div className="text-xs text-[#B6A5B2]">{edits.length} {edits.length === 1 ? "project" : "projects"}</div></div>
    <div className="mt-7 flex items-center gap-3 rounded-xl border border-white/10 bg-[#17121B] px-4"><Search size={17} className="shrink-0 text-[#A58E9F]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your edits" aria-label="Search your edits" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#8C788A]"/></div>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    {loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#B6A5B2]"><LoaderCircle className="animate-spin" size={18}/> Loading your projects…</div> : filtered.length === 0 ? <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#EC8CBA]/20 bg-[#17121B]/80 px-5 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EC8CBA]/25 bg-[#EC8CBA]/[0.08] text-[#E5D09A]"><Film size={24}/></div><h2 className="mt-5 text-lg font-semibold text-white">{query ? "No matching edits" : "Your edit library starts here"}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#B6A5B2]">{query ? "Try a different search." : "Once you create a project, you’ll find its progress and finished video here."}</p>{query && <button onClick={() => setQuery("")} className="mt-4 text-sm text-[#FFC3DE] hover:text-white">Clear search</button>}</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((edit) => {
      const ready = edit.status === "ready" && Boolean(edit.outputUrl);
      return <article key={edit.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#17121B] transition hover:border-[#EC8CBA]/30"><div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,rgba(236,140,186,0.18),transparent_65%),linear-gradient(145deg,#24211a,#101013_65%)]"><div className="absolute inset-0 opacity-30" style={{backgroundImage:"linear-gradient(rgba(236,140,186,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(236,140,186,.08) 1px,transparent 1px)",backgroundSize:"24px 24px"}}/><div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#FFC3DE]/40 bg-black/40 text-[#FFEAF3]"><Film size={21}/></div><span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-medium ${ready ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-[#EC8CBA]/25 bg-black/40 text-[#E5D09A]"}`}>{statusLabel(edit.status)}</span></div><div className="p-4"><h2 className="truncate text-sm font-semibold text-white">{titleFor(edit.purpose)}</h2><p className="mt-1 text-xs text-[#A58E9F]">{new Intl.DateTimeFormat("en-NG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(edit.createdAt))}</p><div className="mt-4 flex items-center gap-2">{ready ? <><a href={edit.outputUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#EC8CBA] px-3 text-xs font-semibold text-[#291521] transition hover:brightness-110"><Play size={14}/> Watch</a>{edit.downloadUrl && <a href={edit.downloadUrl} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#EC8CBA] hover:border-[#EC8CBA]/40" aria-label="Download video"><Download size={16}/></a>}</> : <span className="flex-1 text-xs text-[#B6A5B2]">No finished video is available yet.</span>}<button onClick={() => void removeEdit(edit)} disabled={deleting === edit.id} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#B6A5B2] transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50" aria-label="Delete project"><Trash2 size={15}/></button></div></div></article>;
    })}</div>}
    <p className="mt-7 text-center text-[11px] leading-5 text-[#8C788A]">Finished videos stay here until you delete them. Original footage is temporary and may be cleared after processing.</p>
  </section>;
}
