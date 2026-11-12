"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, GlassWater } from "lucide-react";
import { useSession } from "@/components/Providers";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/Toaster";
import AnimatedNumber from "@/components/AnimatedNumber";
import { pourWater, POUR_LANDS_S } from "@/components/WaterDrops";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import { useWaterForDay, useWriteWater, waterTotal } from "@/hooks/useWaterLogs";
import { quickWaterEntry } from "@/lib/quickWater";
import { formatWater, waterFromMl, waterUnitLabel } from "@/lib/waterUnits";
import { errorMessage } from "@/lib/utils";

/** Water at a glance with one-tap container buttons. */
export default function QuickWater({ day, goalMl }: { day: string; goalMl: number }) {
  const session = useSession();
  const { preferences } = useWaterPreferences(session?.user.id);
  const water = useWaterForDay(day);
  const write = useWriteWater();
  const total = waterTotal(water.data);
  const ratio = goalMl > 0 ? Math.min(1, total / goalMl) : 0;

  const edge = useRef<HTMLSpanElement>(null);
  // Counts pours so the fill waits for the drops and then sloshes.
  const [pour, setPour] = useState(0);
  const reached = goalMl > 0 && total >= goalMl;

  function add(ml: number, button: HTMLElement) {
    try {
      const input = quickWaterEntry(session?.user.id ?? "", day, ml);
      // Rain lands along the stretch of bar this drink is about to fill.
      const track = edge.current?.parentElement;
      const gain = goalMl > 0 ? Math.max(0, Math.min(1, (total + ml) / goalMl) - ratio) : 0;
      if (edge.current && track) pourWater(button, edge.current, { spread: track.getBoundingClientRect().width * gain });
      setPour((count) => count + 1);
      write.mutate(input);
      toast(`${formatWater(ml, preferences.unit)} of water added`, { label: "Undo", onClick: () => write.mutate({ operation: "delete", row: input.row }) });
    } catch (error) { toast(errorMessage(error)); }
  }

  return (
    <Card className="gap-3 p-4" aria-label="Water">
      <Link href={`/water?date=${day}`} className="press flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/10 text-water">
          <GlassWater className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold tabular-nums">
            {water.isError ? "Unavailable" : <><AnimatedNumber value={waterFromMl(total, preferences.unit)} decimals={preferences.unit === "ml" ? 0 : 1} /> {waterUnitLabel(preferences.unit)}</>}
            <span className="font-medium text-muted-foreground"> / {formatWater(goalMl, preferences.unit)}</span>
          </p>
          <p className={`text-xs ${reached ? "font-semibold text-water" : "text-muted-foreground"}`}>{reached ? "Water goal reached" : "Water"}</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
      <div className="relative h-2.5 rounded-full bg-water/12 shadow-[inset_0_1px_2px_oklch(0_0_0/0.06)]">
        <motion.div
          className="relative h-full min-w-0 overflow-hidden rounded-full bg-linear-to-r from-[oklch(0.8_0.09_228)] to-water"
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ type: "spring", damping: 16, stiffness: 70, delay: pour ? POUR_LANDS_S : 0 }}
        >
          <span className="absolute inset-x-1 top-px h-0.5 rounded-full bg-white/35" />
          {[0, 1, 2].map((bubble) => (
            <motion.span
              key={bubble}
              className="absolute top-1/2 -mt-[1.5px] size-[3px] rounded-full bg-white/60"
              initial={{ left: "-5%", y: 0, opacity: 0 }}
              animate={{ left: "105%", y: [1, -1.5, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 3.2 + bubble, repeat: Infinity, delay: bubble * 1.1, ease: "linear" }}
            />
          ))}
        </motion.div>
        <motion.span
          ref={edge}
          key={pour}
          className="absolute top-1/2 -mt-2.5 -ml-2.5 size-5 rounded-full"
          style={{ left: `${ratio * 100}%` }}
          initial={false}
          animate={pour ? { scale: [1, 1.5, 1], backgroundColor: ["oklch(0.72 0.11 230 / 0)", "oklch(0.72 0.11 230 / 0.35)", "oklch(0.72 0.11 230 / 0)"] } : undefined}
          transition={{ duration: 0.6, delay: POUR_LANDS_S }}
        />
      </div>
      <div className="flex gap-2">
        {preferences.containers.slice(0, 3).map((container, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Add ${container.name}, ${formatWater(container.ml, preferences.unit)}`}
            className="press min-w-0 flex-1 rounded-2xl bg-water/10 px-2 py-2 text-center"
            onClick={(event) => add(container.ml, event.currentTarget)}
          >
            <span className="block text-sm font-bold text-water tabular-nums">+{formatWater(container.ml, preferences.unit)}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{container.name}</span>
          </button>
        ))}
      </div>
      {write.isError && <p role="alert" className="text-xs text-destructive">{errorMessage(write.error)}</p>}
    </Card>
  );
}
