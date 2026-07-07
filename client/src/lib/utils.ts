import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
