"use client";

import { useState } from "react";
import { useSession } from "@/components/Providers";
import { Button } from "@/components/ui/button";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import { useWriteWater } from "@/hooks/useWaterLogs";
import type { WaterWrite } from "@/lib/waterMutations";
import { quickWaterEntry } from "@/lib/quickWater";
import { formatWater } from "@/lib/waterUnits";
import { errorMessage, localDateISO } from "@/lib/utils";

export default function QuickWater({ day }: { day: string }) {
  const session = useSession();
  const { preferences } = useWaterPreferences(session?.user.id);
  const write = useWriteWater();
  const [lastAdded, setLastAdded] = useState<WaterWrite["row"] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <section className="space-y-2" aria-label="Quick water logging">
    <p className="text-sm font-semibold">Add water</p>
    <div className="grid grid-cols-3 gap-2">{preferences.containers.map((container, index) => <Button key={index} variant="secondary" className="h-auto min-h-12 whitespace-normal py-2" disabled={write.isPending && !write.isPaused} onClick={() => {
      try {
        setError("");
        const input = quickWaterEntry(session?.user.id ?? "", day, container.ml);
        write.mutate(input);
        setLastAdded(input.row);
        setMessage(`${formatWater(container.ml, preferences.unit)} added.`);
      } catch (error) { setError(errorMessage(error)); }
    }}><span><span className="block">+ {container.name}</span><span className="block text-xs font-normal">{formatWater(container.ml, preferences.unit)}</span></span></Button>)}</div>
    {day !== localDateISO() && <p className="text-xs text-muted-foreground">Adds to {day} at 12:00. Change the time in the water diary.</p>}
    {(error || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error)}</p>}
    {lastAdded && !write.isError && <Button size="sm" variant="ghost" disabled={write.isPending && !write.isPaused} onClick={() => {
      write.mutate({ operation: "delete", row: lastAdded });
      setLastAdded(null); setMessage("Last water addition removed.");
    }}>Undo last water addition</Button>}
    {message && !write.isError && <p role="status" className="text-xs text-muted-foreground">{write.isPaused ? `${message} Waiting to sync.` : write.isPending ? "Saving water change…" : message}</p>}
  </section>;
}
