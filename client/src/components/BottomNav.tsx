"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, ChartColumn, UtensilsCrossed, Settings, Plus, type LucideIcon } from "lucide-react";
import { useSession } from "@/components/Providers";

const left = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/history", label: "Progress", Icon: ChartColumn },
];
const right = [
  { href: "/dishes", label: "Dishes", Icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", Icon: Settings },
];
// Focused flows own the whole screen.
const HIDDEN = new Set(["/log", "/onboarding"]);

function Tab({ href, label, Icon, active }: { href: string; label: string; Icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition-colors duration-200 ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-full bg-foreground/[0.06]"
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
        />
      )}
      <Icon className="relative size-5" strokeWidth={active ? 2.4 : 1.9} />
      <span className="relative">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const session = useSession();
  if (!session || HIDDEN.has(pathname)) return null;

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-safe">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="pointer-events-auto mx-auto flex max-w-sm items-center gap-1 rounded-full bg-card/80 p-1.5 shadow-float ring-1 ring-black/[0.05] backdrop-blur-xl"
      >
        {left.map((link) => <Tab key={link.href} {...link} active={pathname === link.href} />)}
        <Link
          href="/log"
          aria-label="Log food"
          className="press mx-1 flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[oklch(0.34_0_0)] to-[oklch(0.14_0_0)] text-background shadow-[inset_0_1px_0_oklch(1_0_0/0.18),0_8px_20px_oklch(0_0_0/0.28)]"
        >
          <Plus className="size-6" strokeWidth={2.6} />
        </Link>
        {right.map((link) => <Tab key={link.href} {...link} active={pathname === link.href} />)}
      </motion.div>
    </nav>
  );
}
