import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `
        bg-[var(--surface)]
        rounded-[var(--radius-lg)]
        p-6
        border border-[var(--border-subtle)]
        shadow-[0_20px_40px_rgba(0,0,0,0.35)]
        `,
        className
      )}
    >
      {children}
    </div>
  );
}
