"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-5 pt-8">
      <Card className="space-y-3 p-6 text-center">
        <p className="text-lg font-extrabold">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button className="h-11 w-full rounded-full" onClick={reset}>
          Try again
        </Button>
      </Card>
    </div>
  );
}
