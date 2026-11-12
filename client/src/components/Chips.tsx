"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: React.ReactNode };

/** Pill group whose selection glides between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-muted p-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 rounded-full px-3 font-semibold whitespace-nowrap capitalize transition-colors duration-200",
              size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
              selected ? "text-background" : "text-muted-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segmented-${id}`}
                className="absolute inset-0 rounded-full bg-linear-to-b from-[oklch(0.32_0_0)] to-[oklch(0.16_0_0)] shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_2px_8px_oklch(0_0_0/0.18)]"
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Single toggle chip for filters and shortcuts. */
export function Chip({ selected, className, ...props }: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
        selected ? "bg-foreground text-background" : "bg-card text-foreground shadow-soft ring-1 ring-black/[0.04]",
        className,
      )}
      {...props}
    />
  );
}
