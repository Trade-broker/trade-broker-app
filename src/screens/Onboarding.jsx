import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { PHASES, FOCUS_PRESETS } from "../lib/phases";
import { T, SVG, IC, Btn, Input, Select, Field, Pill, Logo } from "../lib/ui.jsx";

export default function Onboarding({ session, profile, onComplete, onLogout }) {
  const userId = session.user.id;
  const [tasks, setTasks] = useState({});
  const [phase, setPhase] = useState(profile?.onboarding_step ? profile.onboarding_step + 1 : 1);
  const [focus, setFocus] = useState(profile?.focus || FOCUS_PRESETS[0]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("onboarding").select("*").eq("user_id", userId);
      const map = {};
      (data || []).forEach(r => { map[r.task_key] = r; });
      setTasks(map);
      const firstIncomplete = PHASES.find(p => !p.tasks.every(t => map[t.key]?.done));
      setPhase(firstIncomplete ? firstIncomplete.n : PHASES.length);
      setLoading(false);
    })();
  }, [userId]);

  const phaseComplete = (p) => p.tasks.every(t => tasks[t.key]?.done);
  const phaseUnlocked = (n) => {
    if (n === 1) return true;
    const prev = PHASES.find(p => p.n === n - 1);
    return phaseComplete(prev);
  };
  const allDone = PHASES.every(p => phaseComplete(p));

  const upsertTask = async (key, patch) => {
    const next = { ...(tasks[key] || {}), ...patch, task_key: key, user_id: userId, updated_at: new Date().toISOString() };
    setTasks(t => ({ ...t, [key]: next }));
    await supabase.from("onboarding").upsert(next, { onConflict: "user_id,task_key" });
  };

  const toggleTask = async (key) => {
    await upsertTask(key, { done: !tasks[key]?.done });
    await supabase.from("profiles").update({ onboarding_step: Math.max(profile?.onboarding_step || 0, phase - 1) }).eq("id", userId);
  };

  const uploadFile = async (key, file) => {
    if (!file) return;
    setBusyKey(key);
    try {
      const path = `${userId}/${key}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (error) throw error;
      await upsertTask(key, { done: true, file_path: path, file_name: file.name });
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      setBusyKey("");
    }
  };

  const saveFocusAndFinish = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ focus, onboarding_step: PHASES.length, onboarding_done: true }).eq("id", userId);
    setSaving(false);
    onComplete(focus);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: T.amber, animationDelay: `${i*150}ms` }} />)}</div>
    </div>;
  }

  const completedCount = PHASES.filter(phaseComplete).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b sticky top-0 z-10" style={{ background: "#06070d", borderColor: T.border }}>
        <Logo />
        <div className="flex-1">
          <div className="text-sm font-black text-white leading-none">Getting Set Up</div>
          <div className="text-xs mt-0.5" style={{ color: T.muted }}>Phase {completedCount} of {PHASES.length} complete</div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.muted, background: T.surface }}>
          <SVG d={IC.logout} size={12} />Log out
        </button>
      </div>

      <div className="px-5 py-3 flex gap-1.5" style={{ background: "#06070d" }}>
        {PHASES.map(p => (
          <div key={p.n} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.surface }}>
            <div className="h-full rounded-full transition-all" style={{ width: phaseComplete(p) ? "100%" : phase === p.n ? "40%" : "0%", background: p.color }} />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {!allDone && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: T.card, border: `1px solid ${T.amber}30` }}>
              <SVG d={IC.rocket} size={16} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: T.muted }}>
                Complete each phase in order to unlock the next. Your progress saves automatically — leave
                and come back anytime and you'll pick up right here. The full app unlocks once all six are done.
              </p>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {PHASES.map(p => {
              const unlocked = phaseUnlocked(p.n);
              const done = phaseComplete(p);
              return (
                <button key={p.n} onClick={() => unlocked && setPhase(p.n)} disabled={!unlocked}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl whitespace-nowrap transition-all disabled:opacity-40"
                  style={phase === p.n ? { background: p.color + "20", color: p.color, border: `1px solid ${p.color}40` } : { background: T.surface, color: done ? p.color : T.muted, border: `1px solid ${T.border}` }}>
                  {done ? <SVG d={IC.check} size={12} /> : !unlocked ? <SVG d={IC.lock} size={11} /> : <span>{p.n}</span>}
                  Phase {p.n}
                </button>
              );
            })}
          </div>

          {PHASES.filter(p => p.n === phase).map(p => (
            <div key={p.n} className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: T.card, border: `1px solid ${p.color}33` }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black" style={{ background: p.color + "20", color: p.color }}>{p.n}</div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white">{p.title}</h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>{p.intro}</p>
                </div>
                {phaseComplete(p) && <Pill label="Complete" color={p.color} />}
              </div>

              <div className="flex flex-col gap-2.5">
                {p.tasks.map(task => {
                  const state = tasks[task.key] || {};
                  return (
                    <div key={task.key} className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: T.surface, border: `1px solid ${state.done ? p.color + "40" : T.border}` }}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleTask(task.key)}
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={state.done ? { background: p.color, color: "#000" } : { border: `1.5px solid ${T.dim}` }}>
                          {state.done && <SVG d={IC.check} size={12} />}
                        </button>
                        <div className="flex-1">
                          <div className="text-sm leading-snug" style={{ color: state.done ? T.muted : T.text }}>{task.label}</div>
                          {task.link && (
                            <a href={task.link} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 mt-1" style={{ color: p.color }}>
                              Open link <SVG d={IC.arrow} size={10} />
                            </a>
                          )}
                        </div>
                      </div>

                      {task.focusInput && (
                        <div className="ml-8 flex flex-col gap-2">
                          <Select value={focus} onChange={setFocus}>
                            {FOCUS_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
                          </Select>
                          <p className="text-xs" style={{ color: T.dim }}>This sets what the AI Lead Finder hunts for. Broad = everything.</p>
                        </div>
                      )}

                      {task.upload && (
                        <div className="ml-8 flex items-center gap-2 flex-wrap">
                          <label className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                            style={{ background: p.color + "18", color: p.color, border: `1px solid ${p.color}33` }}>
                            <SVG d={IC.upload} size={12} />
                            {busyKey === task.key ? "Uploading…" : state.file_name ? "Replace file" : "Upload file"}
                            <input type="file" className="hidden" onChange={e => uploadFile(task.key, e.target.files?.[0])} />
                          </label>
                          {state.file_name && <span className="text-xs flex items-center gap-1" style={{ color: T.muted }}><SVG d={IC.file} size={11} />{state.file_name}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {phaseComplete(p) ? (
                p.n < PHASES.length
                  ? <Btn onClick={() => setPhase(p.n + 1)} color={p.color} full>Continue to Phase {p.n + 1} →</Btn>
                  : <Btn onClick={saveFocusAndFinish} disabled={saving} color={T.green} full><SVG d={IC.rocket} size={14} />{saving ? "Launching…" : "Finish & Open the App"}</Btn>
              ) : (
                <div className="text-xs text-center py-2 rounded-xl" style={{ background: T.surface, color: T.muted }}>
                  Complete all tasks in this phase to unlock the next.
                </div>
              )}
            </div>
          ))}

          {allDone && phase === PHASES.length && (
            <div className="rounded-2xl p-5 text-center flex flex-col gap-3" style={{ background: T.green + "0d", border: `1px solid ${T.green}40` }}>
              <SVG d={IC.check} size={28} style={{ color: T.green, margin: "0 auto" }} />
              <div className="text-sm font-bold text-white">All six phases complete</div>
              <p className="text-xs" style={{ color: T.muted }}>You're ready. Your AI team is standing by.</p>
              <Btn onClick={saveFocusAndFinish} disabled={saving} color={T.green} full><SVG d={IC.rocket} size={14} />{saving ? "Launching…" : "Open the App"}</Btn>
            </div>
          )}

          <p className="text-xs text-center leading-relaxed pt-2" style={{ color: T.dim }}>
            The app records that you marked steps done and attached files — it can't verify documents are
            genuine. This enforces order and discipline, not legal verification.
          </p>
        </div>
      </div>
    </div>
  );
}
