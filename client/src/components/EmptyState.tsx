import { Card } from "@/components/ui/card";

export default function EmptyState({ children }: { children: React.ReactNode }) {
  return <Card className="p-5 text-sm text-muted-foreground">{children}</Card>;
}
