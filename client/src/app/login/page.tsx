"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Droplets, Eye, EyeOff, Leaf, LoaderCircle, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/Providers";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/utils";
import styles from "./login.module.css";

type Mode = "signIn" | "signUp" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const router = useRouter();
  const session = useSession();
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);

  function changeMode(next: Mode) { setMode(next); setMessage(""); setError(""); }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setMessage(""); setError("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("If an account uses this email, you’ll receive a link to reset your password. Check your inbox.");
      } else {
        const { data, error } = mode === "signIn"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } });
        if (error) throw error;
        if (data.session) router.replace("/");
        else setMessage("You’re almost in. Check your email to confirm your account, then come back to sign in.");
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="Welcome to Kenko">
        <Image src="/images/kenko-table.webp" alt="Jollof rice, grilled plantain, fresh greens and a glass of water on a sunlit table" fill sizes="(max-width: 760px) 100vw, 55vw" className={styles.photo} preload />
        <div className={styles.heroShade} />
        <div className={styles.brand}><span className={styles.brandMark}><Leaf size={22} strokeWidth={1.7} /></span><span>kenko<span className={styles.brandDot}>.</span></span></div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A little more balance, every day</p>
          <h1>Your food.<br /><em>Your rhythm.</em></h1>
          <p>Make room for the food you love.<br />Build habits that feel like you.</p>
        </div>
        <div className={styles.heroFooter}><span className={styles.smallLeaf}><Leaf size={15} /></span> Good things start with the everyday.</div>
      </section>

      <section className={styles.formSide} aria-labelledby="auth-heading">
        <div className={styles.topNote}><span className={styles.dot} /> YOUR EVERYDAY COMPANION</div>
        <div className={styles.formWrap}>
          <div className={styles.welcomeMark}><Leaf size={25} strokeWidth={1.5} /></div>
          <p className={styles.kicker}>{mode === "signUp" ? "LET’S BEGIN" : mode === "reset" ? "A FRESH START" : "PICK UP WHERE YOU LEFT OFF"}</p>
          <h2 id="auth-heading">{mode === "signUp" ? "A healthier kind of habit." : mode === "reset" ? "Forgot your password?" : "Welcome back."}</h2>
          <p className={styles.intro}>{mode === "signUp" ? "Your familiar foods. Your daily water. A little progress, at your own pace." : mode === "reset" ? "It happens. We’ll send you a link to get back to your day." : "Your next small step starts here. Sign in to your food and water diary."}</p>

          {mode !== "reset" && <div className={styles.tabs} aria-label="Account access">
            <Button type="button" variant="ghost" aria-pressed={mode === "signIn"} className={mode === "signIn" ? styles.activeTab : ""} disabled={busy} onClick={() => changeMode("signIn")}>Sign in</Button>
            <Button type="button" variant="ghost" aria-pressed={mode === "signUp"} className={mode === "signUp" ? styles.activeTab : ""} disabled={busy} onClick={() => changeMode("signUp")}>Create account</Button>
          </div>}

          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-busy={busy}>
            <div className={styles.field}>
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} className={styles.input} />
            </div>
            {mode !== "reset" && <div className={styles.field}>
              <div className={styles.labelRow}><Label htmlFor="password">Password</Label>{mode === "signIn" && <button type="button" className={styles.textButton} disabled={busy} onClick={() => changeMode("reset")}>Forgot password?</button>}</div>
              <div className={styles.password}>
                <Input id="password" type={visible ? "text" : "password"} autoComplete={mode === "signUp" ? "new-password" : "current-password"} minLength={mode === "signUp" ? 8 : undefined} required placeholder={mode === "signUp" ? "At least 8 characters" : "Enter your password"} value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} className={styles.input} />
                <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} className={styles.eye}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>}
            {error && <div role="alert" className={styles.error}>{error}</div>}
            {message && <div role="status" className={styles.success}><Check size={18} /><span>{message}</span></div>}
            <Button type="submit" className={styles.primary} disabled={busy}>
              {busy ? <><LoaderCircle size={18} className="animate-spin" /> One moment…</> : <>{mode === "signUp" ? "Start your journey" : mode === "reset" ? "Send reset link" : "Sign in to Kenko"}<ArrowRight size={18} /></>}
            </Button>
          </form>
          {mode === "reset" && <button type="button" className={styles.back} disabled={busy} onClick={() => changeMode("signIn")}>Back to sign in</button>}
          <div className={styles.benefits}><span><Utensils size={16} /> Familiar food</span><span><Droplets size={16} /> Daily water</span><span><Leaf size={16} /> Your pace</span></div>
        </div>
        <p className={styles.footer}>Less overthinking. More living well.<span>KENKO · 健康</span></p>
      </section>
    </div>
  );
}
