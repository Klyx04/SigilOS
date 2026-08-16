"use client";

import { useState, useEffect } from "react";
import { Clock, Wrench, RefreshCw, AlertCircle, Zap, ShieldAlert } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Obtenir l'heure courante à Paris */
function getParisTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

/** Formater hh:mm:ss */
function formatTimeLeft(ms: number) {
    if (ms <= 0) return "En cours...";
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 1000 / 60) % 60);
    const h = Math.floor((ms / 1000 / 60 / 60) % 24);
    const d = Math.floor(ms / 1000 / 60 / 60 / 24);

    if (d > 0) return `${d}j ${h}h ${m}m`;
    return `${h}h ${m}m ${s}s`;
}

/** Prochaine occurence d'un jour donné (0=Dim, 1=Lun, 2=Mar...) à une heure donnée (en Paris time) */
function getNextDayTime(dayOfWeek: number, hour: number, minute: number = 0) {
    const now = getParisTime();
    const result = new Date(now);
    result.setHours(hour, minute, 0, 0);

    // Si on est déjà passé ou que c'est pas le bon jour
    if (now.getDay() !== dayOfWeek || now.getTime() >= result.getTime()) {
        const offset = (dayOfWeek + 7 - now.getDay()) % 7;
        const daysToAdd = offset === 0 ? 7 : offset;
        result.setDate(result.getDate() + daysToAdd);
    }
    return result;
}

/** Prochaine occurrence de minuit (Paris time) */
function getNextMidnight() {
    const now = getParisTime();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0); // Passe au lendemain minuit
    return next;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServerTimersPanel() {
    const [now, setNow] = useState<Date | null>(null);

    // Refresh every second
    useEffect(() => {
        setNow(getParisTime());
        const i = setInterval(() => setNow(getParisTime()), 1000);
        return () => clearInterval(i);
    }, []);

    if (!now) return <div className="min-h-[420px]" />; // SSR / hydration wait

    // Timers targets
    const tNextMidnight = getNextMidnight().getTime() - now.getTime();
    const tNextMaintenance = getNextDayTime(2, 8, 0).getTime() - now.getTime(); // Mardi 8h00
    const isMaintenanceTime = now.getDay() === 2 && now.getHours() >= 8 && now.getHours() < 11; // Grosso modo

    return (
        <div
            className="flex flex-col rounded-2xl overflow-hidden shadow-2xl relative"
            style={{
                background: "linear-gradient(160deg, #13171a 0%, #0d1012 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: 420,
            }}
        >
            {/* Decos */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 bg-success pointer-events-none" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100" y2="100" stroke="#fff" strokeWidth="0.5" />
                <line x1="0" y1="100" x2="100" y2="0" stroke="#fff" strokeWidth="0.5" />
            </svg>

            {/* Header = Real Time Server Clock */}
            <div className="px-6 py-5 flex items-center justify-between relative z-10"
                style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                    <h3 className="text-caption font-black uppercase tracking-widest text-success mb-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Heure Dofus (Paris)
                    </h3>
                    <div className="text-3xl font-black text-foreground tracking-widest tabular-nums leading-none">
                        {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                </div>
                {/* Petit pulse vert = serveur UP */}
                <div className="flex items-center gap-2 bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    <span className="text-caption font-bold uppercase tracking-widest text-success">En ligne</span>
                </div>
            </div>

            {/* Timers List */}
            <div className="flex-1 p-5 space-y-3 relative z-10 overflow-hidden">
                <div className="text-caption font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    Échéances du moment
                </div>

                {/* Maintenance Mardi */}
                <div className="group relative overflow-hidden rounded-xl p-4 transition-all hover:bg-surface border border-border">
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10 bg-fuchsia-500 transition-opacity group-hover:opacity-20 pointer-events-none" />
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-md bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20">
                                    <Wrench className="h-3 w-3 text-fuchsia-400" />
                                </div>
                                <span className="text-caption font-black uppercase tracking-widest text-fuchsia-400">
                                    Maintenance
                                </span>
                            </div>
                            <div className="text-sm font-semibold text-foreground">Sauvegarde Dofus</div>
                            <div className="text-caption text-muted-foreground mt-0.5">Mardi, estimé 08:00 - 10:30</div>
                        </div>
                        <div className="text-right">
                            <div className="text-caption text-muted-foreground uppercase tracking-widest mb-1 font-bold">Dans :</div>
                            <div className="text-lg font-black text-fuchsia-300 tabular-nums">
                                {isMaintenanceTime ? "En cours ⏳" : formatTimeLeft(tNextMaintenance)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reset Journalier */}
                <div className="group relative overflow-hidden rounded-xl p-4 transition-all hover:bg-surface border border-border">
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10 bg-warning transition-opacity group-hover:opacity-20 pointer-events-none" />
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center border border-warning/20">
                                    <RefreshCw className="h-3 w-3 text-warning" />
                                </div>
                                <span className="text-caption font-black uppercase tracking-widest text-warning">
                                    Quotidien
                                </span>
                            </div>
                            <div className="text-sm font-semibold text-foreground">Reset Journalier</div>
                            <div className="text-caption text-muted-foreground mt-0.5">Almanax, Dopeuls, Quêtes répétables</div>
                        </div>
                        <div className="text-right">
                            <div className="text-caption text-muted-foreground uppercase tracking-widest mb-1 font-bold">Dans :</div>
                            <div className="text-lg font-black text-warning tabular-nums">
                                {formatTimeLeft(tNextMidnight)}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Note en bas */}
            <div className="px-5 py-3 border-t border-border text-caption text-muted-foreground flex items-center justify-center gap-1.5 bg-black/20">
                <ShieldAlert className="w-3 h-3 text-muted-foreground" />
                Les durées de maintenance sont approximatives selon Ankama.
            </div>
        </div>
    );
}
