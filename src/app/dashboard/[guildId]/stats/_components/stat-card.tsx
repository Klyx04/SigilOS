"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    accent?: "violet" | "teal" | "amber" | "rose" | "emerald" | "blue" | "orange" | "pink" | "yellow" | "sky";
}

const accentColors = {
    violet: { glow: "rgba(139,92,246,0.4)", text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
    teal: { glow: "rgba(20,184,166,0.4)", text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
    amber: { glow: "rgba(245,158,11,0.4)", text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    rose: { glow: "rgba(244,63,94,0.4)", text: "text-danger", bg: "bg-danger/10", border: "border-danger/20" },
    emerald: { glow: "rgba(16,185,129,0.4)", text: "text-success", bg: "bg-success/10", border: "border-success/20" },
    blue: { glow: "rgba(59,130,246,0.4)", text: "text-info", bg: "bg-info/10", border: "border-info/20" },
    orange: { glow: "rgba(249,115,22,0.4)", text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    pink: { glow: "rgba(236,72,153,0.4)", text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    yellow: { glow: "rgba(234,179,8,0.4)", text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    sky: { glow: "rgba(14,165,233,0.4)", text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
};

export default function StatCard({ icon: Icon, label, value, accent = "violet" }: StatCardProps) {
    const a = accentColors[accent];

    return (
        <div className={`relative overflow-hidden rounded-xl border ${a.border} ${a.bg} p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group`}>
            {/* Glow effect */}
            <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: a.glow }}
            />

            <div className="relative flex items-center gap-3">
                <div className={`p-2 rounded-lg ${a.bg}`}>
                    <Icon className={`w-5 h-5 ${a.text}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{label}</p>
                    <p className="text-xl font-bold text-foreground mt-0.5">
                        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
                    </p>
                </div>
            </div>
        </div>
    );
}
