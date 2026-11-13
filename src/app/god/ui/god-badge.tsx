import { cn } from "@/lib/utils";

export type GodBadgeVariant = "info" | "success" | "warning" | "danger";

const VARIANT_STYLES: Record<GodBadgeVariant, string> = {
    info: "bg-info/15 text-info border-info/30",
    success: "bg-primary/15 text-primary border-primary/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
};

export function GodBadge({ variant = "info", className, children }: {
    variant?: GodBadgeVariant; className?: string; children: React.ReactNode;
}) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-bold uppercase tracking-wide",
            VARIANT_STYLES[variant],
            className
        )}>
            {children}
        </span>
    );
}