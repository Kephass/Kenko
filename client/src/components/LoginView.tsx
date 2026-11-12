"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/Chips";
import LoginScene from "@/components/LoginScene";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/utils";

type Mode = "signIn" | "signUp" | "reset";
const TABS = [{ value: "signIn", label: "Sign in" }, { value: "signUp", label: "Create account" }] as const;
const COPY: Record<Mode, { title: string; action: string }> = {
  signIn: { title: "Welcome back.", action: "Sign in" },
  signUp: { title: "Start your first day.", action: "Create account" },
  reset: { title: "Reset your password.", action: "Send reset link" },
};

/** The sign-in screen: the day scene beside one short form. */
export default function LoginView() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const router = useRouter();

  function changeMode(next: Mode) { setMode(next); setMessage(""); setError(""); }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setMessage(""); setError("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("If an account uses this email, a reset link is on its way.");
      } else {
        const { data, error } = mode === "signIn"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } });
        if (error) throw error;
        if (data.session) router.replace("/");
        else setMessage("Almost there. Confirm your email, then come back to sign in.");
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center gap-8 px-6 py-8 md:flex-row md:items-center md:gap-20">
      <div className="mx-auto w-full max-w-md md:flex-1">
        <p className="mb-5 flex items-baseline gap-2 text-xl font-extrabold tracking-tight">
          kenko <span className="text-xs font-medium tracking-[0.3em] text-muted-foreground">健康</span>
        </p>
        <LoginScene />
      </div>

      <section className="mx-auto w-full max-w-md rounded-[2rem] bg-card p-6 shadow-soft ring-1 ring-black/[0.04] md:max-w-sm md:flex-1 md:p-8" aria-labelledby="auth-heading">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={mode}
            id="auth-heading"
            className="text-3xl font-extrabold tracking-tight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {COPY[mode].title}
          </motion.h1>
        </AnimatePresence>

        {mode !== "reset" && <Segmented className="mt-5 [&_button]:normal-case" label="Account access" options={TABS} value={mode} onChange={changeMode} />}

        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-busy={busy}>
          <Input aria-label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="Email" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "reset" && (
            <div className="relative">
              <Input
                className="pr-12"
                aria-label="Password"
                type={visible ? "text" : "password"}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                minLength={mode === "signUp" ? 8 : undefined}
                required
                placeholder={mode === "signUp" ? "Password, 8+ characters" : "Password"}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground">
                {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm font-medium text-fiber">{message}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <><LoaderCircle className="size-5 animate-spin" />One moment…</> : <>{COPY[mode].action}<ArrowRight className="size-5" /></>}
          </Button>
        </form>

        <button type="button" className="mt-4 w-full text-center text-sm font-medium text-muted-foreground" disabled={busy} onClick={() => changeMode(mode === "reset" ? "signIn" : "reset")}>
          {mode === "reset" ? "Back to sign in" : "Forgot password?"}
        </button>
      </section>
    </div>
  );
}
