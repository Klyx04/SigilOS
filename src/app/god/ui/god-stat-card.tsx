import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type GodStatStatus = "default" | "success" | "warning" | "danger" | "info";

const ACCENT_STYLES: Record<GodStatStatus, string> = {
    default: "text-foreground",
    success: "text-primary",
    warning: "text-warning",
    danger: "text-destructive",
    info: "text-info",
};

const ICON_BG: Record<GodStatStatus, string> = {
    default: "bg-muted/50 text-foreground",
    success: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
};

export function GodStatCard({ icon: Icon, label, value, status = "default", hint, className }: {
    icon: LucideIcon; label: string; value: React.ReactNode; status?: GodStatStatus; hint?: string; className?: string;
}) {
    return (
        <div className={cn(
            "relative rounded-xl border border-border bg-surface/10 p-5",
            "",
            className
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", ICON_BG[status])}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 space-y-1">
                <p className="text-caption font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-semibold tracking-tight", ACCENT_STYLES[status])}>{value}</p>
                {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            </div>
        </div>
    );
}