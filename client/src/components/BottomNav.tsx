"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChartColumn, UtensilsCrossed, Settings, Plus } from "lucide-react";
import { useSession } from "@/components/Providers";

const links = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/weight", label: "Progress", Icon: ChartColumn },
  { href: "/dishes", label: "Dishes", Icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const session = useSession();
  if (!session) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] ${
              pathname === href ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" strokeWidth={pathname === href ? 2.4 : 1.8} />
            {label}
          </Link>
        ))}
        <Link
          href="/log"
          aria-label="Log a meal"
          className="flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
        >
          <Plus className="size-6" strokeWidth={2.4} />
        </Link>
      </div>
    </nav>
  );
}
