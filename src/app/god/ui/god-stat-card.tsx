import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type GodStatStatus = "default" | "success" | "warning" | "danger" | "info";

const ACCENT_STYLES: Record<GodStatStatus, string> = {
    default: "text-zinc-100",
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
    info: "text-blue-300",
};

const ICON_BG: Record<GodStatStatus, string> = {
    default: "bg-white/5 text-zinc-300",
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-300",
    danger: "bg-rose-500/15 text-rose-300",
    info: "bg-blue-500/15 text-blue-300",
};

export function GodStatCard({ icon: Icon, label, value, status = "default", hint, className }: {
    icon: LucideIcon; label: string; value: React.ReactNode; status?: GodStatStatus; hint?: string; className?: string;
}) {
    return (
        <div className={cn(
            "relative rounded-3xl border border-white/5 bg-zinc-900/10 backdrop-blur-xl p-5",
            "",
            className
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", ICON_BG[status])}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 space-y-1">
                <p className="text-caption font-bold uppercase tracking-widest text-zinc-500">{label}</p>
                <p className={cn("text-2xl font-black tracking-tight", ACCENT_STYLES[status])}>{value}</p>
                {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
            </div>
        </div>
    );
}