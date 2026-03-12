"use client";

import { Crown, Timer, Mountain, Flame } from "lucide-react";

interface RecordsSectionProps {
    records: { label: string; value: string; icon: string }[];
    topAchievers: { name: string; value: number }[];
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

export default function RecordsSection({ records, topAchievers }: RecordsSectionProps) {
    if (records.length === 0) return null;

    return (
        <div className="space-y-6">
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

            {/* Top Achievers (Success Points) */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h4 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    🎖️ Top Succès (Points de Succès)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {topAchievers.map((achiever, i) => (
                        <div key={achiever.name} className="relative group">
                            <div className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col items-center text-center transition-all hover:scale-105 hover:bg-black/30">
                                <span className={`text-xl font-bold mb-1 ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-orange-400" : "text-zinc-500"}`}>
                                    #{i + 1}
                                </span>
                                <p className="text-sm font-medium text-white truncate w-full px-1">{achiever.name}</p>
                                <p className="text-xs text-teal-400 font-bold mt-1">{achiever.value.toLocaleString()} pts</p>
                            </div>
                        </div>
                    ))}
                    {topAchievers.length === 0 && (
                        <div className="col-span-full py-6 text-center text-zinc-600 text-sm italic">
                            Aucune donnée de succès synchronisée.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
