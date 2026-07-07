"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/Providers";

const links = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Log" },
  { href: "/weight", label: "Weight" },
  { href: "/measurements", label: "Body" },
  { href: "/water", label: "Water" },
  { href: "/dishes", label: "Dishes" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const session = useSession();
  if (!session) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t bg-white dark:bg-neutral-900 dark:border-neutral-700">
      <div className="mx-auto flex max-w-lg justify-between px-4 py-2 text-xs">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-1.5 py-1 rounded ${
              pathname === l.href ? "font-semibold text-green-700 dark:text-green-400" : "text-neutral-500"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
