import { getGuildStorageUsage } from "@/server/actions/guild-storage-actions";
import { HardDrive, AlertTriangle, FileImage, Coins, Trophy, Image as ImageIcon, Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const BREAKDOWN_LINK: Record<string, string> = {
    MISSIONS: "/missions",
    KAMA_LOANS: "/services?tab=prets",
    ACHIEVEMENT: "/ladder",
    PRESENTATION: "/presentation",
    ASSETS: "/presentation",
};

const BREAKDOWN_ICON: Record<string, { icon: React.ElementType; color: string }> = {
    MISSIONS: { icon: FileImage, color: "text-rose-400" },
    KAMA_LOANS: { icon: Coins, color: "text-amber-400" },
    ACHIEVEMENT: { icon: Trophy, color: "text-purple-400" },
    PRESENTATION: { icon: Building2, color: "text-emerald-400" },
    ASSETS: { icon: ImageIcon, color: "text-sky-400" },
};

/**
 * Carte « Stockage de la guilde » visible par l'admin guilde (Paramètres).
 * Lecture seule, guild-isolée : consommation vs seuil fixé par God.
 */
export async function GuildStorageCard({ guildId }: { guildId: string }) {
    const res = await getGuildStorageUsage(guildId);
    if (!res.success || !res.data) return null;
    const d = res.data;

    const barColor = d.overLimit ? "bg-red-500" : d.usagePercent > 80 ? "bg-amber-500" : "bg-emerald-500";

    return (
        <div className={cn(
            "rounded-3xl border p-5 md:p-6 backdrop-blur-xl space-y-4",
            d.overLimit ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/5 bg-zinc-900/40"
        )}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl border", d.overLimit ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-blue-500/10 border-blue-500/20 text-blue-400")}>
                        <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            Stockage de la guilde
                            {d.overLimit && (
                                <span className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                                    <AlertTriangle className="w-3 h-3" /> Seuil dépassé
                                </span>
                            )}
                        </p>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {d.totalFiles} fichier(s) en stock
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xl font-black text-white tracking-tight font-mono">
                        {formatBytes(d.totalBytes)} <span className="text-zinc-500 text-sm">/ {formatBytes(d.limitBytes)}</span>
                    </p>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", d.overLimit ? "text-red-500" : "text-zinc-400")}>
                        {d.usagePercent}% utilisé
                    </p>
                </div>
            </div>

            {/* Barre d'utilisation */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, d.usagePercent)}%` }} />
            </div>

            {/* Répartition par type de capture — cliquable vers la page concernée */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {d.breakdown.map((b) => {
                    const cfg = BREAKDOWN_ICON[b.key] ?? { icon: FileImage, color: "text-zinc-400" };
                    const Icon = cfg.icon;
                    const href = `${BREAKDOWN_LINK[b.key] || "/dashboard"}`;
                    return (
                        <Link
                            key={b.key}
                            href={`/dashboard/${guildId}${href}`}
                            className="group rounded-xl bg-black/30 border border-white/5 px-3 py-2.5 flex items-center gap-2.5 hover:border-white/15 hover:bg-black/50 transition-all"
                        >
                            <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest truncate">{b.label}</p>
                                <p className="text-[11px] font-mono font-black text-zinc-200">{formatBytes(b.bytes)}</p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-white transition-colors shrink-0" />
                        </Link>
                    );
                })}
            </div>

            {/* Nettoyage automatique : ce qui disparaît vs ce qui est conservé */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mr-1">Nettoyage auto :</span>
                <span className="text-[9px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded-lg px-2 py-1">⏱ 24h — preuves non validées (missions, succès, kamas)</span>
                <span className="text-[9px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded-lg px-2 py-1">⏱ 7 jours — preuves prêts &amp; coffre</span>
                <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2 py-1">🛡 Conservées — présentation, icône &amp; bannière</span>
            </div>
        </div>
    );
}