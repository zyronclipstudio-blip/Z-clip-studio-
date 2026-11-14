"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "confirm"
      ? "That confirmation link did not work. Try signing in, or sign up again."
      : "",
  );
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const sb = createClient();
    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      } else {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) window.location.href = "/";
        else setNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        msg.includes("Database error saving new user")
          ? "Sign-ups are currently closed or full. Please try again later."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="flex items-center gap-2 text-cyan">
        <Film size={22} />
        <span className="text-lg font-semibold tracking-wide">ZClip</span>
      </div>
      <h1 className="mt-3 font-display text-2xl font-semibold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted">Upload your footage. Let ZClip do the editing.</p>

      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5">
        <label className="block text-sm">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 outline-none focus:border-cyan" />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 outline-none focus:border-cyan" />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {notice && <p className="text-sm text-cyan">{notice}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-cyan px-4 py-3 font-semibold text-background transition hover:brightness-110 disabled:opacity-60">
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); setNotice(""); }} className="mt-4 text-sm text-muted hover:text-ink">
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
