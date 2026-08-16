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
    crown: "text-warning",
    timer: "text-teal-400",
    mountain: "text-violet-400",
    flame: "text-warning",
};

export default function RecordsSection({ records, topAchievers }: RecordsSectionProps) {
    if (records.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {records.map((record) => {
                    const Icon = ICON_MAP[record.icon] || Flame;
                    const accent = ACCENT_MAP[record.icon] || "text-foreground";

                    return (
                        <div
                            key={record.label}
                            className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3 hover:bg-surface transition-colors"
                        >
                            <div className="p-2 rounded-lg bg-surface shrink-0">
                                <Icon className={`w-5 h-5 ${accent}`} strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{record.label}</p>
                                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{record.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Top Achievers (Success Points) */}
            <div className="rounded-xl border border-border bg-surface p-5">
                <h4 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                    🎖️ Top Succès (Points de Succès)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {topAchievers.map((achiever, i) => (
                        <div key={achiever.name} className="relative group">
                            <div className="p-3 rounded-lg bg-black/20 border border-border flex flex-col items-center text-center transition-all  hover:bg-black/30">
                                <span className={`text-xl font-bold mb-1 ${i === 0 ? "text-warning" : i === 1 ? "text-foreground" : i === 2 ? "text-warning" : "text-muted-foreground"}`}>
                                    #{i + 1}
                                </span>
                                <p className="text-sm font-medium text-foreground truncate w-full px-1">{achiever.name}</p>
                                <p className="text-xs text-teal-400 font-bold mt-1">{achiever.value.toLocaleString()} pts</p>
                            </div>
                        </div>
                    ))}
                    {topAchievers.length === 0 && (
                        <div className="col-span-full py-6 text-center text-muted-foreground text-sm italic">
                            Aucune donnée de succès synchronisée.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
