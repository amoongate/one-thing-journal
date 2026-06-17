// BUILD: app-phase1-v29-20260617
import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { DEFAULT_QUOTES, DEFAULT_CATS, DEFAULT_GOAL_CATS, DEFAULT_GOALS } from "./assets";
import { mountApp } from "./engine";
import * as db from "./supabase";

const BUILD = "app-phase1-v29-20260617";
if (typeof window !== "undefined") window.__OTJ_BUILD = BUILD;

function toISO(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

const check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#1B1A15" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4 4L19 7" />
  </svg>
);

function MarkMini() {
  return (
    <div className="mm">
      <div className="mmw">
        <span className="mmhl"></span>
        <span className="mm-top"></span>
      </div>
      <div className="mm-l"></div>
      <div className="mm-l short"></div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.4-4.6 7.1l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16.1z" />
      <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.1-5.5c-2 1.3-4.6 2.1-8.4 2.1-6.3 0-11.6-3.6-13.5-8.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function Footer() {
  return (
    <div style={{ padding: "18px 0 26px", textAlign: "center" }}>
      <div style={{ fontFamily: '"Spectral",serif', fontWeight: 600, fontSize: 14, color: "#1B1A15" }}>
        One Thing Journal
      </div>
      <div style={{ fontSize: 11, color: "#928E80", marginTop: 2 }}>
        Brought to you by ListWithRalph.com
      </div>
    </div>
  );
}

function Loading() {
  return <div className="loadwrap">Loading...</div>;
}

function Landing({ onStart, onSignIn }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="land">
          <div className="badge"><MarkMini /></div>
          <h1>One Thing Journal</h1>
          <div className="tag">Helping you finish what matters most.</div>
          <div className="pts">
            <div className="pt"><div className="k">{check}</div><div className="x"><b>Name the one thing.</b> Every day starts with the single task that matters most.</div></div>
            <div className="pt"><div className="k">{check}</div><div className="x"><b>Plan and track time.</b> Estimate your day, then see how the real hours landed.</div></div>
            <div className="pt"><div className="k">{check}</div><div className="x"><b>Watch your accuracy grow.</b> Your journal shows how your planning sharpens over time.</div></div>
          </div>
          <div className="cta">
            <button className="bigbtn" onClick={onStart}>Create your free account</button>
            <button className="bigbtn ghost" onClick={onSignIn}>I already have an account</button>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}

function Auth({ initialMode, onBack }) {
  const [mode, setMode] = useState(initialMode || "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = () => { setErr(""); setOk(""); };

  const submit = async () => {
    clear();
    if (mode === "forgot") {
      if (!email) { setErr("Enter your email."); return; }
      setBusy(true);
      const { error } = await db.sendReset(email);
      setBusy(false);
      if (error) setErr(error.message);
      else setOk("Check your email for a reset link.");
      return;
    }
    if (!email || !pw) { setErr("Email and password are required."); return; }
    if (mode === "signup" && pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await db.signUpEmail(email, pw, name);
      setBusy(false);
      if (error) { setErr(error.message); return; }
      if (!data.session) { setOk("Account created. Check your email to confirm, then sign in."); setMode("signin"); }
    } else {
      const { error } = await db.signInEmail(email, pw);
      setBusy(false);
      if (error) { setErr(error.message); return; }
    }
  };

  const google = async () => {
    clear();
    const { error } = await db.signInGoogle();
    if (error) setErr(error.message);
  };

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back";
  const sub = mode === "signup" ? "Free, and yours to keep." : mode === "forgot" ? "We will email you a reset link." : "Sign in to your journal.";

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="authbox">
          <h2>{title}</h2>
          <div className="sub">{sub}</div>
          {err && <div className="err">{err}</div>}
          {ok && <div className="ok">{ok}</div>}
          {mode !== "forgot" && (
            <>
              <button className="gbtn" onClick={google}><GoogleIcon /> Continue with Google</button>
              <div className="authsep">or</div>
            </>
          )}
          {mode === "signup" && (
            <div className="fld">
              <label>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div className="fld">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          {mode !== "forgot" && (
            <div className="fld">
              <label>Password</label>
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
              <button className="pwtoggle" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
            </div>
          )}
          <button className="bigbtn" onClick={submit} disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
          <div className="authfoot">
            {mode === "signin" && (
              <>
                <button className="authlink" onClick={() => { clear(); setMode("signup"); }}>New here? Create an account</button>
                <br />
                <button className="authlink" onClick={() => { clear(); setMode("forgot"); }}>Forgot password?</button>
              </>
            )}
            {mode === "signup" && (
              <button className="authlink" onClick={() => { clear(); setMode("signin"); }}>Already have an account? Sign in</button>
            )}
            {mode === "forgot" && (
              <button className="authlink" onClick={() => { clear(); setMode("signin"); }}>Back to sign in</button>
            )}
            <br />
            <button className="authlink" onClick={onBack}>Back to start</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Recovery({ onDone }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 8) { setMsg("Use at least 8 characters."); return; }
    setBusy(true);
    const { error } = await db.updatePassword(pw);
    setBusy(false);
    if (error) setMsg(error.message);
    else { setMsg("Password updated."); setTimeout(onDone, 900); }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="authbox">
          <h2>Set a new password</h2>
          <div className="sub">Enter a new password for your account.</div>
          {msg && <div className="ok">{msg}</div>}
          <div className="fld">
            <label>New password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button className="bigbtn" onClick={submit} disabled={busy}>{busy ? "Saving..." : "Update password"}</button>
        </div>
      </div>
    </div>
  );
}

function AppHost({ session }) {
  const [data, setData] = useState(null);
  const ref = useRef(null);
  const destroyRef = useRef(null);

  useEffect(() => {
    let on = true;
    db.loadData(session.user.id, session.user.email)
      .then((d) => { if (on) setData(d); })
      .catch((e) => {
        console.error("load failed", e);
        if (on) setData({ user: { name: "", title: "", email: session.user.email, phone: "", restDay: "" }, quotes: DEFAULT_QUOTES, categories: DEFAULT_CATS, goalCategories: DEFAULT_GOAL_CATS, goals: DEFAULT_GOALS, entries: {} });
      });
    return () => { on = false; };
  }, [session.user.id]);

  useEffect(() => {
    if (!data || !ref.current) return;
    const today = toISO(new Date());
    const destroy = mountApp(ref.current, {
      today,
      data,
      onChange: async (snap) => {
        const uid = session.user.id;
        try {
          for (const date in snap.entries) {
            await db.saveEntry(uid, date, snap.entries[date]);
          }
          await db.saveProfile(uid, snap.user, snap.quotes, snap.categories, snap.goalCategories, snap.goals);
        } catch (e) {
          console.error("save failed", e);
        }
      },
      onSignOut: async () => { await db.signOut(); },
    });
    destroyRef.current = destroy;
    return () => { if (destroyRef.current) destroyRef.current(); };
  }, [data]);

  if (!data) return <Loading />;
  return (
    <div className="app" ref={ref}>
      <div className="screen" tabIndex={-1}></div>
      <nav className="bottomnav" aria-label="Main"></nav>
      <div className="sheet-host"></div>
    </div>
  );
}

function UpdateBar({ onDismiss }) {
  const refresh = () => {
    window.location.replace(window.location.pathname + "?u=" + Date.now());
  };
  return (
    <div className="updatebar" role="status">
      <span>New version ready</span>
      <button className="ub-refresh" onClick={refresh}>Refresh</button>
      <button className="ub-x" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [view, setView] = useState("landing");
  const [authMode, setAuthMode] = useState("signin");
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    db.getSession().then((s) => setSession(s || null));
    const { data: sub } = db.onAuth((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s || null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEffect(() => {
    const cur = (() => {
      const s = document.querySelector('script[src*="/assets/index-"]');
      const m = s && s.getAttribute("src").match(/assets\/index-[A-Za-z0-9_-]+\.js/);
      return m ? m[0] : null;
    })();
    if (!cur) return;
    let stop = false;
    const check = async () => {
      if (stop || document.hidden) return;
      try {
        const r = await fetch(window.location.pathname + "?_otjv=" + Date.now(), { cache: "no-store" });
        if (!r.ok) return;
        const html = await r.text();
        const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
        if (m && m[0] !== cur) setUpdateReady(true);
      } catch (e) {}
    };
    const first = setTimeout(check, 8000);
    const iv = setInterval(check, 60000);
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; clearTimeout(first); clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  let content;
  if (session === undefined) content = <Loading />;
  else if (recovery) content = <Recovery onDone={() => setRecovery(false)} />;
  else if (!session) {
    content = view === "auth"
      ? <Auth initialMode={authMode} onBack={() => setView("landing")} />
      : (
        <Landing
          onStart={() => { setAuthMode("signup"); setView("auth"); }}
          onSignIn={() => { setAuthMode("signin"); setView("auth"); }}
        />
      );
  } else {
    content = <AppHost session={session} />;
  }

  return (
    <>
      {content}
      {updateReady && !updateDismissed && (
        <UpdateBar onDismiss={() => setUpdateDismissed(true)} />
      )}
    </>
  );
}
