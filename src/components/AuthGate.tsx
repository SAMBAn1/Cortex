import { useEffect, useState } from "react";
import { getSupabase, isCloudMode } from "../lib/storage";
import { Mail, Loader2, ArrowRight } from "lucide-react";

interface Props { children: React.ReactNode }

export default function AuthGate({ children }: Props) {
  const cloud = isCloudMode();
  const [ready, setReady] = useState(!cloud);
  const [signedIn, setSignedIn] = useState(!cloud);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    (async () => {
      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), 8000)
        );
        const { data } = await Promise.race([sb.client.auth.getSession(), timeout]) as Awaited<ReturnType<typeof sb.client.auth.getSession>>;
        if (cancelled) return;
        setSignedIn(!!data.session);
        setUserEmail(data.session?.user.email ?? null);
        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setBackendError(e?.message === "timeout"
          ? "Couldn't reach the backend (timed out). It may be waking up — try refreshing in a minute."
          : `Couldn't reach the backend: ${e?.message ?? "unknown error"}`);
        setReady(true);
      }
    })();
    const { data: sub } = sb.client.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      setUserEmail(session?.user.email ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [cloud]);

  async function sendLink() {
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setBusy(true); setError(null);
    const { error } = await sb.client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (!ready) {
    return <div className="h-full flex items-center justify-center text-fg-subtle text-sm">Loading…</div>;
  }

  if (backendError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-sm panel p-6 space-y-3 text-sm">
          <div className="font-medium">Cortex is offline</div>
          <p className="text-fg-muted">{backendError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full text-sm px-3 py-2 rounded-md bg-accent text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-sm panel p-6 space-y-4 animate-slide-up">
          <div>
            <div className="w-10 h-10 rounded-lg bg-accent text-white flex items-center justify-center font-bold">C</div>
            <h1 className="text-xl font-medium mt-3">Welcome to Cortex</h1>
            <p className="text-sm text-fg-muted mt-1">Sign in to access your second brain.</p>
          </div>
          {sent ? (
            <div className="text-sm bg-accent-muted/30 border border-accent/30 rounded-lg p-3">
              <Mail size={16} className="inline mr-1 text-accent" />
              Check your inbox at <span className="text-accent">{email}</span> for a magic link.
              <button className="block text-xs text-fg-subtle mt-2 underline" onClick={() => { setSent(false); setEmail(""); }}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs text-fg-subtle">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendLink()}
                  placeholder="you@example.com"
                  className="w-full bg-bg-panel border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              {error && <div className="text-xs text-danger">{error}</div>}
              <button
                onClick={sendLink}
                disabled={busy || !email.trim()}
                className="w-full text-sm px-3 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send magic link <ArrowRight size={12} />
              </button>
              <p className="text-[11px] text-fg-subtle text-center">No password. We'll email you a link.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Expose for the Account section in Settings.
  if (typeof window !== "undefined") (window as any).__userEmail = userEmail;
  return <>{children}</>;
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.client.auth.signOut();
}

export function getUserEmail(): string | null {
  return (typeof window !== "undefined" && (window as any).__userEmail) || null;
}
