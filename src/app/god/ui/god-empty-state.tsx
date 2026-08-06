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
            "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 bg-zinc-900/5 p-10 text-center",
            className
        )}>
            {Icon ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                    <Icon className="h-6 w-6 text-zinc-400" />
                </div>
            ) : null}
            <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-300">{title}</p>
                {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
            </div>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}