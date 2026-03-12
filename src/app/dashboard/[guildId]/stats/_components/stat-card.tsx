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
    amber: { glow: "rgba(245,158,11,0.4)", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    rose: { glow: "rgba(244,63,94,0.4)", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    emerald: { glow: "rgba(16,185,129,0.4)", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    blue: { glow: "rgba(59,130,246,0.4)", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    orange: { glow: "rgba(249,115,22,0.4)", text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    pink: { glow: "rgba(236,72,153,0.4)", text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    yellow: { glow: "rgba(234,179,8,0.4)", text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    sky: { glow: "rgba(14,165,233,0.4)", text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
};

export default function StatCard({ icon: Icon, label, value, accent = "violet" }: StatCardProps) {
    const a = accentColors[accent];

    return (
        <div className={`relative overflow-hidden rounded-xl border ${a.border} ${a.bg} backdrop-blur-sm p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group`}>
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
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider truncate">{label}</p>
                    <p className="text-xl font-bold text-white mt-0.5">
                        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
                    </p>
                </div>
            </div>
        </div>
    );
}
