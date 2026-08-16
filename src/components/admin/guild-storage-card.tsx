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
    MISSIONS: "/admin/validation",
    KAMA_LOANS: "/admin/validation?tab=kamas",
    ACHIEVEMENT: "/admin/validation?tab=succes",
    PRESENTATION: "/presentation",
    ASSETS: "/presentation",
};

const BREAKDOWN_ICON: Record<string, { icon: React.ElementType; color: string }> = {
    MISSIONS: { icon: FileImage, color: "text-danger" },
    KAMA_LOANS: { icon: Coins, color: "text-warning" },
    ACHIEVEMENT: { icon: Trophy, color: "text-info" },
    PRESENTATION: { icon: Building2, color: "text-success" },
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

    const barColor = d.overLimit ? "bg-danger" : d.usagePercent > 80 ? "bg-warning" : "bg-success";

    return (
        <div className={cn(
            "rounded-3xl border p-5 md:p-6 backdrop-blur-xl space-y-4",
            d.overLimit ? "border-danger/30 bg-danger/[0.04]" : "border-border bg-surface/40"
        )}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl border", d.overLimit ? "bg-danger/10 border-danger/20 text-danger" : "bg-info/10 border-info/20 text-info")}>
                        <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                            Stockage de la guilde
                            {d.overLimit && (
                                <span className="inline-flex items-center gap-1 bg-danger/10 border border-danger/30 text-danger text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                                    <AlertTriangle className="w-3 h-3" /> Seuil dépassé
                                </span>
                            )}
                        </p>
                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            {d.totalFiles} fichier(s) en stock
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xl font-black text-foreground tracking-tight font-mono">
                        {formatBytes(d.totalBytes)} <span className="text-muted-foreground text-sm">/ {formatBytes(d.limitBytes)}</span>
                    </p>
                    <p className={cn("text-caption font-black uppercase tracking-widest", d.overLimit ? "text-danger" : "text-muted-foreground")}>
                        {d.usagePercent}% utilisé
                    </p>
                </div>
            </div>

            {/* Barre d'utilisation */}
            <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, d.usagePercent)}%` }} />
            </div>

            {/* Répartition par type de capture — cliquable vers la page concernée */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {d.breakdown.map((b) => {
                    const cfg = BREAKDOWN_ICON[b.key] ?? { icon: FileImage, color: "text-muted-foreground" };
                    const Icon = cfg.icon;
                    const href = `${BREAKDOWN_LINK[b.key] || "/dashboard"}`;
                    return (
                        <Link
                            key={b.key}
                            href={`/dashboard/${guildId}${href}`}
                            className="group rounded-xl bg-black/30 border border-border px-3 py-2.5 flex items-center gap-2.5 hover:border-border-strong hover:bg-black/50 transition-all"
                        >
                            <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                            <div className="min-w-0 flex-1">
                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest truncate">{b.label}</p>
                                <p className="text-caption font-mono font-black text-foreground">{formatBytes(b.bytes)}</p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                        </Link>
                    );
                })}
            </div>

            {/* Nettoyage automatique : ce qui disparaît vs ce qui est conservé */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mr-1">Nettoyage auto :</span>
                <span className="text-caption font-medium text-muted-foreground bg-surface border border-border rounded-lg px-2 py-1">⏱ 24h — preuves non validées (missions, succès, kamas)</span>
                <span className="text-caption font-medium text-muted-foreground bg-surface border border-border rounded-lg px-2 py-1">⏱ 7 jours — preuves prêts &amp; coffre</span>
                <span className="text-caption font-medium text-success bg-success/5 border border-success/20 rounded-lg px-2 py-1">🛡 Conservées — présentation, icône &amp; bannière</span>
            </div>
        </div>
    );
}