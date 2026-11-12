import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 pt-1" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-9 w-40 rounded-full" />
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
}
