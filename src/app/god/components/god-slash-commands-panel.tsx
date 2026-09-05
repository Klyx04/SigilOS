"use client";

import { useState } from "react";
import { 
    Terminal, 
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { syncSlashCommandsToDiscordAction } from "@/server/actions/discord-commands-sync";

interface SyncResult {
    ok: boolean;
    guildId: string;
    error?: string;
    count?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
    DONJONS_QUETES: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    COMMUNAUTE: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    PROFIL: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    UTILITAIRE: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
};

export function GodSlashCommandsPanel() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    const handleSyncDiscordCommands = async () => {
        setIsSyncing(true);
        setSyncResults([]);
        try {
            const res = await syncSlashCommandsToDiscordAction();

            if (res.results && res.results.length > 0) {
                setSyncResults(res.results);
                setLastSyncTime(new Date().toLocaleTimeString("fr-FR"));
            }

            if (res.success) {
                const okCount = res.results.filter(r => r.ok).length;
                const failCount = res.results.filter(r => !r.ok).length;

                if (failCount === 0) {
                    toast.success(`✅ ${okCount} serveur(s) synchronisé(s) — Les commandes apparaissent instantanément dans l'autocomplete Discord !`);
                } else {
                    toast.warning(`⚠️ ${okCount} OK / ${failCount} erreur(s) — Vérifiez les logs ci-dessous`);
                }
            } else {
                toast.error(res.error || "Échec de la synchronisation");
            }
        } catch {
            toast.error("Erreur de communication avec Discord");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 sm:p-8 rounded-[2rem] border border-border bg-surface shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-accent" />
                        Commandes Slash Discord (Plateforme)
                    </h3>
                    <p className="text-muted-foreground text-caption font-medium">
                        Déploie les commandes sur tous les serveurs SigilOS — avec autocomplétion, descriptions et options exactement comme les meilleurs bots.
                    </p>
                    {lastSyncTime && (
                        <p className="text-[10px] font-mono text-emerald-500">
                            Dernière sync : {lastSyncTime}
                        </p>
                    )}
                </div>

                <Button
                    onClick={handleSyncDiscordCommands}
                    disabled={isSyncing}
                    className="h-10 px-5 rounded-xl text-xs font-black gap-2 shadow-sm shrink-0"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                    {isSyncing ? "Déploiement en cours..." : "Synchroniser Discord"}
                </Button>
            </div>

            {/* Sync Results */}
            {syncResults.length > 0 && (
                <div className="p-5 rounded-3xl bg-surface border border-border space-y-3 animate-in fade-in">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                        Résultats du Déploiement
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {syncResults.map((result) => (
                            <div key={result.guildId} className="flex items-center gap-2.5 text-xs font-mono">
                                {result.ok ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                                <span className="text-muted-foreground">{result.guildId}</span>
                                {result.ok ? (
                                    <span className="text-emerald-500 font-bold">→ {result.count} commandes enregistrées</span>
                                ) : (
                                    <span className="text-rose-500 text-[10px]">{result.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* How it works info banner */}
            <div className="p-4 rounded-2xl bg-accent-soft border border-accent/20 flex items-start gap-3">
                <Zap className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">
                        Autocomplétion native Discord — instantanée sur tous les serveurs
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        L'API <code className="font-mono bg-elevated px-1 rounded">PUT /guilds/&#123;id&#125;/commands</code> enregistre les commandes avec leurs options et autocomplete directement dans Discord. Elles apparaissent immédiatement dans le picker <kbd>/</kbd> avec le nom, la description et l'icône du bot SigilOS.
                    </p>
                </div>
            </div>

            {/* Command catalog */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SLASH_COMMANDS_CATALOG.map((cmd) => (
                    <div 
                        key={cmd.name}
                        className="p-5 rounded-3xl bg-surface border border-border flex flex-col justify-between gap-4 hover:border-accent/30 transition-colors"
                    >
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-sm font-black font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-lg">
                                    /{cmd.name}
                                </code>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                    CATEGORY_COLORS[cmd.category] || "text-muted-foreground bg-elevated border-border"
                                )}>
                                    {cmd.category.replace("_", " ")}
                                </span>
                            </div>

                            <p className="text-xs text-muted-foreground font-medium">
                                {cmd.description}
                            </p>
                        </div>

                        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-muted-foreground">{cmd.usage}</span>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Active
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
