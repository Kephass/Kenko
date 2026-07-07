"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(mode: "signIn" | "signUp") {
    setBusy(true);
    setMessage(null);
    const { error } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (mode === "signUp") {
      setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-5">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Kenko</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your food, your data. Nothing here is shared.
        </p>
      </div>
      <div className="space-y-3">
        <Input
          className="h-12 rounded-xl bg-card shadow-soft"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          className="h-12 rounded-xl bg-card shadow-soft"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Button
          className="h-12 w-full rounded-full"
          disabled={busy || !email || !password}
          onClick={() => submit("signIn")}
        >
          Sign in
        </Button>
        <Button
          variant="secondary"
          className="h-12 w-full rounded-full bg-card shadow-soft"
          disabled={busy || !email || !password}
          onClick={() => submit("signUp")}
        >
          Sign up
        </Button>
      </div>
      {message && <p className="text-center text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
