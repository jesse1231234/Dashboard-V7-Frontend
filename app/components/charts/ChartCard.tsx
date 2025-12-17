import { Card } from "@/components/ui/Card";

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          {title}
        </h2>
        {subtitle && (
          <span className="text-sm text-[var(--text-muted)]">
            {subtitle}
          </span>
        )}
      </div>

      <div className="h-[360px]">
        {children}
      </div>
    </Card>
  );
}
