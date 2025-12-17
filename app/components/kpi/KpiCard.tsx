import { Card } from "../ui/Card";

export function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-[var(--text-muted)]">
          {label}
        </span>

        <span className="text-3xl font-semibold tracking-tight">
          {value}
        </span>

        {delta && (
          <span
            className={`text-xs ${
              deltaPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {deltaPositive ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>
    </Card>
  );
}
