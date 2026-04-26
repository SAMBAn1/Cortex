import { useEffect, useState } from "react";
import { getSupabase, isCloudMode } from "../lib/storage";
import { Mail, Loader2, ArrowRight, LogOut } from "lucide-react";

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

  useEffect(() => {
    if (!cloud) return;
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const { data } = await sb.client.auth.getSession();
      setSignedIn(!!data.session);
      setUserEmail(data.session?.user.email ?? null);
      setReady(true);
    })();
    const { data: sub } = sb.client.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      setUserEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
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

  return (
    <>
      {children}
      {cloud && userEmail && <SignOutCorner email={userEmail} />}
    </>
  );
}

function SignOutCorner({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  async function out() {
    const sb = getSupabase();
    if (sb) await sb.client.auth.signOut();
  }
  return (
    <div className="fixed bottom-3 left-3 z-40">
      {open ? (
        <div className="panel p-2 flex items-center gap-2 text-xs animate-fade-in">
          <span className="text-fg-muted">{email}</span>
          <button onClick={out} className="icon-btn h-7 px-2 text-danger hover:bg-danger/10 w-auto"><LogOut size={12} /> Sign out</button>
          <button onClick={() => setOpen(false)} className="icon-btn h-7 w-7">×</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="icon-btn h-7 w-7 opacity-40 hover:opacity-100">
          <LogOut size={12} />
        </button>
      )}
    </div>
  );
}
