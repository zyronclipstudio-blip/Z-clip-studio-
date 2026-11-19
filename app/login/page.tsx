"use client";

import { useEffect, useState } from "react";
import { ZLogo } from "@/components/ZLogo";
import { NetflixSplash } from "@/components/NetflixSplash";
import { createClient } from "@/lib/supabase/browser";
import { ArrowRight, Lock, Mail } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "confirm"
      ? "That confirmation link did not work. Try signing in, or sign up again."
      : "",
  );
  const [notice, setNotice] = useState("");
  const [splash, setSplash] = useState(false);
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("zc_splash")) {
        sessionStorage.setItem("zc_splash", "1");
        setSplash(true);
      }
    } catch {
      setSplash(true);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up" && !agree) {
      setError("Please agree to the Terms of Use and Privacy Policy to create your account.");
      return;
    }
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
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden bg-background">
      {splash && <NetflixSplash onFinish={() => setSplash(false)} />}
      {/* Studio Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gold/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-gold-muted/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <ZLogo size={64} animated />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-[0.24em] pl-[0.24em] text-[#f3eee2]">
              Z<span className="text-gold">CLIP</span>
            </h1>
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-[#8d97a8]">ZYRON CLIP STUDIO</p>
          <p className="mt-2 text-sm text-muted max-w-xs font-sans">
            Tell ZClip what you're creating. Upload your footage. Let ZClip do the editing.
          </p>
        </div>

        {/* Card Container */}
        <div className="relative rounded-[20px] border border-border bg-surface/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Subtle Top Accent line */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

          <div className="flex items-center justify-between pb-6 mb-6 border-b border-border">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                {mode === "in" ? "Welcome back" : "Join ZClip"}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {mode === "in" ? "Sign in to your projects" : "Create your creator studio account"}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/90 mb-1.5">
                Email
              </label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-muted pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-raised/90 pl-10 pr-3.5 py-3 text-sm text-ink placeholder:text-muted/60 outline-none transition duration-200 focus:border-gold focus:ring-1 focus:ring-gold/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/90 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-muted pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-raised/90 pl-10 pr-3.5 py-3 text-sm text-ink placeholder:text-muted/60 outline-none transition duration-200 focus:border-gold focus:ring-1 focus:ring-gold/50"
                />
              </div>
            </div>

            {mode === "up" && (
              <label className="flex items-start gap-3 text-xs leading-5 text-muted">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#d9b45b]"
                />
                <span>
                  I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="text-gold underline underline-offset-4">Terms of Use</a> and{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-gold underline underline-offset-4">Privacy Policy</a>.
                </span>
              </label>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-xs text-danger flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                {error}
              </div>
            )}

            {notice && (
              <div className="p-3 rounded-xl border border-gold/30 bg-gold/10 text-xs text-gold flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                {notice}
              </div>
            )}

            <button
              disabled={busy}
              className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(180deg,#ecd083,#b88f38)] px-4 text-[15px] font-bold text-[#17120a] shadow-[0_0_28px_rgba(217,180,91,0.22)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <span>One moment…</span>
              ) : (
                <>
                  <span>{mode === "in" ? "Sign in" : "Create account"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 pt-5 border-t border-border/80 text-center">
            <button
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError("");
                setNotice("");
              }}
              className="text-xs text-muted hover:text-gold transition duration-150 inline-flex items-center gap-1.5"
            >
              {mode === "in" ? (
                <>New to ZClip? <span className="text-gold font-medium underline underline-offset-4">Create account</span></>
              ) : (
                <>Already have an account? <span className="text-gold font-medium underline underline-offset-4">Sign in</span></>
              )}
            </button>
          </div>
        </div>

        {/* Studio Footer Info */}
        <p className="mt-6 text-center font-mono text-[11px] text-muted/60 tracking-wider">
          Proudly by Zyron
        </p>
      </div>
    </main>
  );
}
