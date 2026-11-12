import BackButton from "@/components/BackButton";

/** Shared screen header: optional back button, title, trailing action. */
export default function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: React.ReactNode; back?: boolean; action?: React.ReactNode }) {
  return (
    <header className="space-y-3 pt-1">
      {(back || action) && (
        <div className="flex min-h-10 items-center justify-between">
          {back ? <BackButton /> : <span />}
          {action}
        </div>
      )}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}
