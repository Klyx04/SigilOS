"use client";

import { useState, useEffect } from "react";
import { 
    Terminal, 
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Zap,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { syncSlashCommandsToDiscordAction } from "@/server/actions/discord-commands-sync";
import {
    getGodCommandScopesAction,
    setGodCommandScopeAction,
} from "@/server/actions/god-slash-command-actions";
import type { GodCommandScopesPayload } from "@/lib/discord/command-permissions";

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

/** État + actions des portées (chargement, bascule, rechargement après succès). */
function useCommandScopes() {
    const [payload, setPayload] = useState<GodCommandScopesPayload | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pending, setPending] = useState<string | null>(null);

    const load = async () => {
        setIsLoading(true);
        try {
            setPayload(await getGodCommandScopesAction());
        } catch {
            toast.error("Impossible de lire les portées des commandes");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const toggle = async (guildId: string, guildName: string, commandName: string, enabled: boolean) => {
        const key = `${guildId}:${commandName}`;
        setPending(key);
        try {
            const res = await setGodCommandScopeAction({ guildId, commandName, enabled });
            if (!res.success) {
                toast.error(res.error || "Discord a refusé la synchronisation");
            } else if (res.permissionErrors?.length) {
                toast.warning(
                    `/${commandName} ${enabled ? "déployée" : "retirée"} sur ${guildName} — droits partiels : ${res.permissionErrors[0]}`
                );
                await load();
            } else {
                toast.success(
                    enabled
                        ? `/${commandName} déployée sur ${guildName}`
                        : `/${commandName} retirée de ${guildName}`
                );
                await load();
            }
        } catch {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setPending(null);
        }
    };

    return { payload, isLoading, pending, load, toggle };
}

/**
 * 🌍 Déploiement **guilde par guilde**. `/valider-recrue` est fermée par défaut ;
 * un clic l'autorise, la déploie sur Discord et la fait apparaître dans le dashboard
 * de la guilde. Chaque clic resynchronise et affiche le **résultat réel**.
 */
function GuildCommandScopes() {
    const { payload, isLoading, pending, load, toggle } = useCommandScopes();
    const commands =
        payload?.commands ??
        SLASH_COMMANDS_CATALOG.map((command) => ({ name: command.name, staffOnly: command.staffOnly === true }));

    return (
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-surface space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        Autorisation par guilde
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                        Une commande non autorisée n&apos;est <strong>pas enregistrée</strong> sur le serveur :
                        elle n&apos;existe nulle part (ni autocomplete, ni Intégrations).{" "}
                        <code className="font-mono">/valider-recrue</code> est fermée par défaut.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void load()}
                    disabled={isLoading}
                    className="text-xs"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1", isLoading && "animate-spin")} /> Rafraîchir
                </Button>
            </div>

            {isLoading && !payload ? (
                <p className="text-xs text-muted-foreground">Chargement des guilde(s)…</p>
            ) : payload && !payload.success ? (
                <p className="text-xs text-rose-500">{payload.error || "Lecture impossible"}</p>
            ) : (payload?.guilds?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune guilde active.</p>
            ) : (
                <div className="space-y-2">
                    {(payload?.guilds ?? []).map((guild) => (
                        <div
                            key={guild.id}
                            className="rounded-xl border border-border/60 bg-elevated/30 p-3 flex flex-col gap-2"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{guild.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    {guild.isActive ? "active" : "inactive"}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {commands.map((command) => {
                                    const deployed = guild.deployed[command.name] === true;
                                    const key = `${guild.id}:${command.name}`;
                                    return (
                                        <button
                                            key={command.name}
                                            type="button"
                                            onClick={() => void toggle(guild.id, guild.name, command.name, !deployed)}
                                            disabled={pending === key}
                                            aria-pressed={deployed}
                                            aria-label={`${deployed ? "Retirer" : "Autoriser"} /${command.name} pour ${guild.name}`}
                                            className={cn(
                                                "px-2 py-1 rounded-lg border text-[10px] font-mono transition-colors",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                deployed
                                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                                    : "border-border/60 bg-background text-muted-foreground hover:border-accent/40",
                                                pending === key && "opacity-50",
                                                command.staffOnly && !deployed && "border-warning/40 text-warning"
                                            )}
                                        >
                                            /{command.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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

            {/* Déploiement guilde par guilde (God) */}
            <GuildCommandScopes />

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
                                {cmd.staffOnly ? "Sur autorisation" : "Active"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
