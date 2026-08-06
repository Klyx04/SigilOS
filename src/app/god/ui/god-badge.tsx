import { cn } from "@/lib/utils";

export type GodBadgeVariant = "info" | "success" | "warning" | "danger";

const VARIANT_STYLES: Record<GodBadgeVariant, string> = {
    info: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function GodBadge({ variant = "info", className, children }: {
    variant?: GodBadgeVariant; className?: string; children: React.ReactNode;
}) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
            VARIANT_STYLES[variant],
            className
        )}>
            {children}
        </span>
    );
}