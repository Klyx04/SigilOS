"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGuildModules } from "@/server/actions/module-actions";
import { type GuildModulesState, type ModuleKey } from "@/lib/module-types";
import { MAINTENANCE_LABEL, GUILD_DISABLED_LABEL, type ModuleLockState } from "@/lib/module-lock";
import { MODULE_GROUPS, MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";
import { getPermissionsForGuildModule, PERMISSION_LABELS } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Catalogue centralisé (libellés, descriptions, assets) : src/lib/module-catalog.ts
// — source unique aussi consommée par le wizard d'onboarding.

/**
 * Pages / paramètres concernés par chaque module (#66) — rendus en clair sur la
 * carte pour que l'admin sache EXACTEMENT ce que le toggle active/désactive.
 * `{guildId}` est remplacé au rendu ; `/docs` est global (hors guilde).
 */
const MODULE_ROUTES: Partial<Record<ModuleKey, { label: string; href: string }[]>> = {
    presentation: [{ label: "Présentation", href: "/dashboard/{guildId}/presentation" }],
    roster: [{ label: "Annuaire", href: "/dashboard/{guildId}/members" }],
    stats: [{ label: "Stats Guilde", href: "/dashboard/{guildId}/stats" }],
    calendar: [{ label: "Calendrier", href: "/dashboard/{guildId}/calendar" }],
    missions: [
        { label: "Missions", href: "/dashboard/{guildId}/missions" },
        { label: "Gestion Missions", href: "/dashboard/{guildId}/missions/manage" },
    ],
    songes: [{ label: "Songes", href: "/dashboard/{guildId}/songes" }],
    ocre: [{ label: "Quête Ocre", href: "/dashboard/{guildId}/quete-ocre" }],
    ladder: [{ label: "Classement", href: "/dashboard/{guildId}/ladder" }],
    succes: [{ label: "Mes Succès", href: "/dashboard/{guildId}/succes" }],
    gallery: [{ label: "Galerie Guilde", href: "/dashboard/{guildId}/galerie-stuff" }],
    ladderSync: [{ label: "Classement (Ladder Ankama)", href: "/dashboard/{guildId}/ladder" }],
    manualLadderSync: [{ label: "Classement (Ladder Analyse OC)", href: "/dashboard/{guildId}/ladder" }],
    services: [{ label: "Services Guilde", href: "/dashboard/{guildId}/services" }],
    marche: [{ label: "Marché", href: "/dashboard/{guildId}/marche" }],
    donjons: [{ label: "Donjons & Quêtes", href: "/dashboard/{guildId}/donjons-et-quetes" }],
    docs: [{ label: "Documentation (Wiki)", href: "/docs" }],
    polls: [{ label: "Sondages", href: "/dashboard/{guildId}/sondages" }],
    availability: [
        { label: "Planning de Guilde", href: "/dashboard/{guildId}/planning" },
        { label: "Profil (Planning)", href: "/dashboard/{guildId}/profile?tab=planning" },
    ],
    minigames: [{ label: "Mini-Jeux", href: "/dashboard/{guildId}/mini-jeux" }],
    quests: [{ label: "Quêtes Dofus", href: "/dashboard/{guildId}/quetes-dofus" }],
    worldmap: [{ label: "Carte du Monde", href: "/dashboard/{guildId}/worldmap" }],
    resources: [{ label: "Ressources Dofus", href: "/dashboard/{guildId}/ressources" }],
    profile: [
        { label: "Profil Membre", href: "/dashboard/{guildId}/profile" },
        { label: "Annuaire", href: "/dashboard/{guildId}/members" },
    ],
    logs: [{ label: "Audit Logs", href: "/dashboard/{guildId}/admin/logs" }],
    reactionRoles: [{ label: "Rôles par Réaction", href: "/dashboard/{guildId}/reaction-roles" }],
    commandes: [{ label: "Commandes Bot Discord", href: "/dashboard/{guildId}/commandes" }],
};

// ============================================================================
// COMPONENT
// ============================================================================
// ============================================================================
// COMPONENT
// ============================================================================

type Props = {
    guildId: string;
    /**
     * Toggles **bruts** de la guilde — c'est ce payload qui part à
     * `updateGuildModules`. Un module verrouillé conserve son toggle en BDD :
     * l'afficher ou l'écraser ferait échouer l'enregistrement des autres modules.
     */
    initialModules: GuildModulesState;
    /**
     * État **effectif** de chaque module : origine du verrou (plateforme/guilde)
     * et message de maintenance éventuel. Source unique `resolveModuleGrid`.
     */
    moduleStates: Record<ModuleKey, ModuleLockState>;
};

export function ModulesClient({ guildId, initialModules, moduleStates }: Props) {
    const [modules, setModules] = useState<GuildModulesState>(initialModules);
    const [pending, setPending] = useState<ModuleKey | null>(null);
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState("");

    const allModules = MODULE_GROUPS.flatMap(g => g.modules);
    const enabledCount = allModules.filter(m => moduleStates[m.key]?.enabled ?? modules[m.key]).length;
    const totalCount = allModules.length;

    async function handleToggle(key: ModuleKey, value: boolean) {
        const state = moduleStates[key];
        // Verrou (plateforme ou guilde) : le toggle est INERTE et le serveur
        // refuserait de toute façon (`updateGuildModules`).
        if (state?.lockedBy) {
            toast.error(state.notice || MAINTENANCE_LABEL);
            return;
        }
        const previous = modules[key];
        setModules((prev) => ({ ...prev, [key]: value }));
        setPending(key);

        startTransition(async () => {
            const result = await updateGuildModules(guildId, { ...modules, [key]: value });
            if (!result.success) {
                setModules((prev) => ({ ...prev, [key]: previous }));
                toast.error(result.error || "Erreur lors de la mise à jour");
            } else {
                const label = allModules.find(m => m.key === key)?.label;
                toast.success(`Module "${label}" ${value ? "activé" : "désactivé"}`);
            }
            setPending(null);
        });
    }

    return (
        <div className="space-y-12 max-w-[1600px] mx-auto">
            {/* Summary bar - Technical Stats Style */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-2 py-4 border-b border-border bg-surface rounded-2xl">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Système de Capacités</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-foreground">{enabledCount}</span>
                            <span className="text-muted-foreground font-medium text-xs">/ {totalCount} modules</span>
                        </div>
                    </div>
                    <div className="h-10 w-px bg-surface mx-2 hidden md:block" />
                    <div className="flex h-2 w-32 bg-surface rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-success transition-all duration-200 ease-out"
                            style={{ width: `${(enabledCount / totalCount) * 100}%` }} 
                        />
                    </div>
                </div>
                <Badge variant="outline" className="bg-surface border-border text-muted-foreground font-medium text-xs py-1 px-3 rounded-lg">
                    Modifications appliquées instantanément
                </Badge>
            </div>

            {/* Search Bar */}
            <div className="relative px-2 mt-4 max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Rechercher un module (ex: chat, missions...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50 hover:border-border-strong transition-all font-medium"
                />
            </div>

            {/* Groups */}
            <div className="space-y-16">
                {MODULE_GROUPS.map((group) => {
                    const filteredModules = group.modules.filter(mod => 
                        mod.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        mod.key.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    if (filteredModules.length === 0) return null;

                    return (
                        <div key={group.label} className="space-y-8">
                        <div className="flex items-center gap-4 px-2">
                             <div className="h-0.5 w-8 bg-elevated" />
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {group.label}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {filteredModules.map((mod) => {
                                const state = moduleStates[mod.key];
                                const isLocked = Boolean(state?.lockedBy);
                                // Affichage = état EFFECTIF : un module verrouillé est OFF
                                // même si son toggle est conservé à `true` en BDD.
                                const isEnabled = state ? state.enabled : modules[mod.key];
                                const isLoading = pending === mod.key && isPending;
                                const Icon = mod.icon;
                                const routes = MODULE_ROUTES[mod.key];

                                return (
                                    <div
                                        key={mod.key}
                                        className={cn(
                                            "group relative rounded-2xl border transition-all duration-200 overflow-hidden",
                                            isEnabled
                                                ? "bg-surface/60 border-border shadow-sm"
                                                : "bg-black/40 border-border opacity-50 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 hover:border-border"
                                        )}
                                    >
                                        <div className="relative z-10 p-6 flex flex-col h-full">
                                            {/* Top Row: Icon & Toggle */}
                                            <div className="flex items-start justify-between gap-4 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "relative h-14 w-14 rounded-2xl flex items-center justify-center border transition-colors duration-200",
                                                        isEnabled 
                                                            ? "bg-success/[0.06] border-success/30"
                                                            : "bg-surface border-border"
                                                    )}>
                                                        {MODULE_DOFUS_ASSETS[mod.key] ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={`/assets/dofus/modules/${MODULE_DOFUS_ASSETS[mod.key]}`}
                                                                alt={mod.label}
                                                                className={cn(
                                                                    "w-8 h-8 object-contain transition-all duration-200",
                                                                    !isEnabled && "opacity-50 grayscale"
                                                                )}
                                                            />
                                                        ) : (
                                                            <Icon className={cn(
                                                                "w-7 h-7 transition-colors duration-200",
                                                                isEnabled ? "text-success" : "text-muted-foreground"
                                                            )} strokeWidth={1.5} />
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col">
                                                         <div className="flex items-center gap-2">
                                                            <h3 className={cn(
                                                                "font-semibold text-base tracking-tight",
                                                                isEnabled ? "text-foreground" : "text-muted-foreground"
                                                            )}>
                                                                {mod.label}
                                                            </h3>
                                                            {mod.comingSoon && (
                                                                <Badge variant="outline" className="text-xs px-2 py-0.5 h-5 bg-warning/10 border-warning/20 text-warning font-medium">
                                                                    WIP
                                                                </Badge>
                                                            )}
                                                            {isLocked && (
                                                                <Badge variant="outline" className="text-xs px-2 py-0.5 h-5 bg-info/10 border-info/30 text-info font-medium" title={state?.notice || MAINTENANCE_LABEL}>
                                                                    {MAINTENANCE_LABEL}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isLocked ? (
                                                                <span className="flex items-center gap-1.5 text-xs font-medium text-info">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-info" />
                                                                    {MAINTENANCE_LABEL}
                                                                </span>
                                                            ) : isEnabled ? (
                                                                <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                                                    Actif
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-muted-foreground">{GUILD_DISABLED_LABEL}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center shrink-0">
                                                    {isLoading ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <Switch
                                                            checked={isEnabled}
                                                            onCheckedChange={(val) => handleToggle(mod.key, val)}
                                                            disabled={isPending || isLocked}
                                                            className="data-[state=checked]:bg-success scale-125"
                                                            aria-label={`Toggle module ${mod.label}`}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Description Card */}
                                            <div className="flex-1 space-y-4">
                                                <p className={cn(
                                                    "text-sm leading-relaxed transition-colors duration-200",
                                                    isEnabled ? "text-muted-foreground" : "text-muted-foreground"
                                                )}>
                                                    {mod.description}
                                                </p>
                                                {state?.notice && (
                                                    <p className="flex items-start gap-2 text-xs font-medium text-info bg-info/10 border border-info/20 rounded-lg px-3 py-2">
                                                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                                        <span>{state.notice}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* Pages concernées (#66) */}
                                            <div className="mt-6 pt-5 border-t border-border space-y-3">
                                                {routes && routes.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-medium text-muted-foreground">Pages :</span>
                                                        {routes.map((r) => (
                                                            <Link
                                                                key={r.href}
                                                                href={r.href.replace("{guildId}", guildId)}
                                                                className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-medium text-foreground hover:text-foreground hover:bg-surface hover:border-border-strong transition-colors"
                                                            >
                                                                {r.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Page dédiée à venir</span>
                                                )}
                                                {(() => {
                                                    const linked = getPermissionsForGuildModule(mod.key);
                                                    if (linked.length === 0) return null;
                                                    return (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="text-xs font-medium text-muted-foreground">RBAC :</span>
                                                            {linked.map((permId) => (
                                                                <Link
                                                                    key={permId}
                                                                    href={`/dashboard/${guildId}/admin/permissions`}
                                                                    title="Voir dans la matrice RBAC"
                                                                    className="px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/25 text-xs font-bold text-warning hover:bg-warning/20 transition-colors"
                                                                >
                                                                    {PERMISSION_LABELS[permId] || permId}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )})}
            </div>

            {/* Support Note */}
            <div className="pt-16 pb-10 text-center space-y-4">
                <div className="h-px w-32 bg-surface mx-auto" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Modules de la guilde
                </p>
            </div>
        </div>
    );
}
