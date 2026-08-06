import { cn } from "@/lib/utils";

export function GodLoadingSkeleton({ rows = 3, className }: {
    rows?: number; className?: string;
}) {
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5 border border-white/5" />
            ))}
        </div>
    );
}