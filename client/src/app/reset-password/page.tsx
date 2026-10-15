"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { useSession } from "@/components/Providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/utils";

export default function ResetPasswordPage() {
  const session = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  return <div className="flex min-h-svh items-center justify-center bg-[#faf9f4] px-6 py-12 text-[#263b30]">
    <div className="w-full max-w-sm space-y-6">
      <Leaf className="size-10 text-[#244c3a]" strokeWidth={1.5} />
      <h1 className="text-3xl font-semibold tracking-tight">A fresh start.</h1>
      {done ? <><p role="status">Your password has been updated.</p><Button asChild className="w-full bg-[#244c3a]"><Link href="/">Back to Kenko</Link></Button></> : !session ? <><p>This recovery link is missing or has expired. Request a new one to continue.</p><Link className="underline" href="/login">Back to sign in</Link></> : <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); if (submitting.current) return;
        if (password !== confirm) { setError("The passwords don’t match."); return; }
        submitting.current = true; setBusy(true); setError("");
        try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setDone(true); }
        catch (e) { setError(errorMessage(e)); }
        finally { submitting.current = false; setBusy(false); }
      }}>
        <Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        <Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="h-12 w-full bg-[#244c3a]" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>}
    </div>
  </div>;
}
