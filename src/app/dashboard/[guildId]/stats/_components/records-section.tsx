"use client";

import { Crown, Timer, Mountain, Flame } from "lucide-react";

interface RecordsSectionProps {
    records: { label: string; value: string; icon: string }[];
}

const ICON_MAP: Record<string, typeof Crown> = {
    crown: Crown,
    timer: Timer,
    mountain: Mountain,
    flame: Flame,
};

const ACCENT_MAP: Record<string, string> = {
    crown: "text-amber-400",
    timer: "text-teal-400",
    mountain: "text-violet-400",
    flame: "text-orange-400",
};

export default function RecordsSection({ records }: RecordsSectionProps) {
    if (records.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {records.map((record) => {
                const Icon = ICON_MAP[record.icon] || Flame;
                const accent = ACCENT_MAP[record.icon] || "text-white";

                return (
                    <div
                        key={record.label}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start gap-3 hover:bg-white/[0.07] transition-colors"
                    >
                        <div className="p-2 rounded-lg bg-white/5 shrink-0">
                            <Icon className={`w-5 h-5 ${accent}`} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{record.label}</p>
                            <p className="text-sm font-semibold text-white mt-0.5 truncate">{record.value}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
