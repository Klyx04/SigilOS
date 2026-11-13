import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function GodEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/5 p-10 text-center",
            className
        )}>
            {Icon ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
            ) : null}
            <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">{title}</p>
                {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
            </div>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}