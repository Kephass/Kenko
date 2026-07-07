"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
      className="flex size-10 items-center justify-center rounded-full bg-card shadow-soft ring-1 ring-black/[0.04] active:translate-y-px"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
