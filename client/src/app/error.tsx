"use client";

import { motion } from "motion/react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <motion.div
      className="pt-16"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="items-center gap-4 px-6 py-10 text-center" role="alert">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
          <TriangleAlert className="size-6" />
        </span>
        <div className="space-y-1.5">
          <p className="text-2xl font-extrabold tracking-tight">Something went wrong</p>
          <p className="text-sm text-balance break-words text-muted-foreground">{error.message}</p>
        </div>
        <Button size="lg" className="mt-2 w-full" onClick={reset}>
          <RotateCw />
          Try again
        </Button>
      </Card>
    </motion.div>
  );
}
