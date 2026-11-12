import { Inbox, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function EmptyState({ children, icon: Icon = Inbox }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <Card className="items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="max-w-[26ch] text-balance">{children}</div>
    </Card>
  );
}
