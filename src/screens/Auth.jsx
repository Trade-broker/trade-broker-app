import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T, SVG, IC, Btn, Input, Field, Logo } from "../lib/ui.jsx";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setError(""); setInfo("");
    if (!email || !password) { setError("Enter your email and password."); return; }
    if (mode === "signup" && password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").update({ owner_name: name || email.split("@")[0] }).eq("id", data.user.id);
        }
        if (!data.session) {
          setInfo("Account created. Check your email to confirm, then log in.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (String(error.message).toLowerCase().includes("invalid")) {
            setError("No account found with those details, or wrong password. Create an account?");
          } else throw error;
        }
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={12} />
          <div>
            <div className="text-lg font-black text-white leading-none">OPPORTUNITY</div>
            <div className="text-lg font-black leading-none" style={{ color: T.amber }}>COMMAND AI</div>
          </div>
          <p className="text-sm" style={{ color: T.muted }}>Your autonomous AI trade-broker team.</p>
        </div>

        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: T.card, border: `1px solid ${T.border2}` }}>
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: T.surface }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setInfo(""); }}
                className="flex-1 text-xs font-semibold py-2 rounded-lg transition-all capitalize"
                style={mode === m ? { background: T.amber + "20", color: T.amber } : { color: T.muted }}>
                {m === "login" ? "Log In" : "Create Account"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <Field label="Your Name"><Input value={name} onChange={setName} placeholder="Your name" /></Field>
          )}
          <Field label="Email"><Input value={email} onChange={setEmail} type="email" placeholder="you@email.com" /></Field>
          <Field label="Password">
            <Input value={password} onChange={setPassword} type="password" placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </Field>

          {error && <div className="text-xs leading-relaxed rounded-xl px-3 py-2" style={{ background: T.red + "12", color: T.red, border: `1px solid ${T.red}33` }}>{error}</div>}
          {info && <div className="text-xs leading-relaxed rounded-xl px-3 py-2" style={{ background: T.green + "12", color: T.green, border: `1px solid ${T.green}33` }}>{info}</div>}

          <Btn onClick={submit} disabled={busy} color={T.amber} full>
            {busy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
          </Btn>

          {mode === "login"
            ? <p className="text-xs text-center" style={{ color: T.muted }}>New here? <button onClick={() => setMode("signup")} className="font-semibold" style={{ color: T.amber }}>Create an account</button></p>
            : <p className="text-xs text-center" style={{ color: T.muted }}>Already have one? <button onClick={() => setMode("login")} className="font-semibold" style={{ color: T.amber }}>Log in</button></p>}
        </div>

        <p className="text-xs text-center leading-relaxed" style={{ color: T.dim }}>
          Your account and data are private to you and follow you across devices. AI-proposed leads are
          researched candidates, not confirmed buyers — not financial or legal advice.
        </p>
      </div>
    </div>
  );
}
