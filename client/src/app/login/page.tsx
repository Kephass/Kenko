"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="mx-auto mt-16 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Kenko</h1>
      <p className="text-sm text-neutral-500">Sign in to your own data. Nothing here is shared.</p>
      <input
        className="w-full rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-green-700 px-3 py-2 text-white disabled:opacity-50"
          disabled={busy || !email || !password}
          onClick={() => submit("signIn")}
        >
          Sign in
        </button>
        <button
          className="flex-1 rounded border px-3 py-2 disabled:opacity-50 dark:border-neutral-700"
          disabled={busy || !email || !password}
          onClick={() => submit("signUp")}
        >
          Sign up
        </button>
      </div>
      {message && <p className="text-sm text-amber-700 dark:text-amber-400">{message}</p>}
    </div>
  );
}
