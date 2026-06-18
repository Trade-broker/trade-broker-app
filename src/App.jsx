import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { T } from "./lib/ui.jsx";
import Auth from "./screens/Auth.jsx";
import Onboarding from "./screens/Onboarding.jsx";
import MainApp from "./screens/MainApp.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      setLoading(true);
      let prof = null;
      for (let i = 0; i < 5 && !prof; i++) {
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        prof = data;
        if (!prof) await new Promise(r => setTimeout(r, 400));
      }
      if (!prof) {
        await supabase.from("profiles").insert({ id: session.user.id });
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        prof = data;
      }
      if (active) { setProfile(prof); setLoading(false); }
    })();
    return () => { active = false; };
  }, [session]);

  const refreshProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(data);
  };

  const logout = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: T.amber, animationDelay: `${i*150}ms` }} />)}</div>
      </div>
    );
  }

  if (!session) return <Auth />;

  if (profile && !profile.onboarding_done) {
    return <Onboarding session={session} profile={profile} onLogout={logout}
      onComplete={async () => { await refreshProfile(); }} />;
  }

  return <MainApp session={session} profile={profile} onLogout={logout} refreshProfile={refreshProfile} />;
}
