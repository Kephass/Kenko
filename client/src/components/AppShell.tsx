"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/reset-password") return <main>{children}</main>;
  return <>
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">{children}</main>
    <BottomNav />
  </>;
}
