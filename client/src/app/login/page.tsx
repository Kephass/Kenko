"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginView from "@/components/LoginView";
import { useSession } from "@/components/Providers";

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);
  return <LoginView />;
}
