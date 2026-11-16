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
    quests: [{ label: "Objectif Dofus", href: "/dashboard/{guildId}/quetes-dofus" }],
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
        <div className="mx-auto max-w-[1600px] space-y-6">
            {/* Summary bar - Technical Stats Style */}
            <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-surface/40 px-4 py-3 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground">Modules actifs</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold tabular-nums text-foreground">{enabledCount}</span>
                            <span className="text-xs font-medium text-muted-foreground">/ {totalCount}</span>
                        </div>
                    </div>
                    <div className="mx-2 hidden h-8 w-px bg-border md:block" />
                    <div className="flex h-2 w-32 overflow-hidden rounded-full bg-border">
                        <div 
                            className="h-full bg-success transition-all duration-200 ease-out"
                            style={{ width: `${(enabledCount / totalCount) * 100}%` }} 
                        />
                    </div>
                </div>
                <Badge variant="outline" className="rounded-lg border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                    Modifications appliquées instantanément
                </Badge>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                    type="text"
                    placeholder="Rechercher un module (ex: chat, missions...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors hover:border-border-strong focus:border-success/50 focus:outline-none"
                />
            </div>

            {/* Groups */}
            <div className="space-y-10">
                {MODULE_GROUPS.map((group) => {
                    const filteredModules = group.modules.filter(mod => 
                        mod.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        mod.key.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    if (filteredModules.length === 0) return null;

                    return (
                        <div key={group.label} className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <h3 className="text-sm font-semibold text-foreground">
                                {group.label}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                                            "flex h-full flex-col rounded-xl border p-4 transition-colors",
                                            isEnabled ? "border-border bg-surface/40" : "border-border bg-surface/10",
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-start gap-3">
                                                    <div className={cn(
                                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
                                                        isEnabled
                                                            ? "border-success/30 bg-success/10"
                                                            : "border-border bg-elevated"
                                                    )}>
                                                        {MODULE_DOFUS_ASSETS[mod.key] ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={`/assets/dofus/modules/${MODULE_DOFUS_ASSETS[mod.key]}`}
                                                                alt=""
                                                                className={cn(
                                                                    "h-6 w-6 object-contain",
                                                                    !isEnabled && "opacity-60"
                                                                )}
                                                            />
                                                        ) : (
                                                            <Icon className={cn(
                                                                "h-6 w-6",
                                                                isEnabled ? "text-success" : "text-muted-foreground"
                                                            )} strokeWidth={1.5} aria-hidden="true" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className={cn(
                                                                "text-sm font-semibold leading-snug",
                                                                isEnabled ? "text-foreground" : "text-muted-foreground"
                                                            )}>
                                                                {mod.label}
                                                            </h3>
                                                            {mod.comingSoon && (
                                                                <Badge variant="outline" className="h-5 border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                                                    WIP
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium">
                                                            {isLocked ? (
                                                                <>
                                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                                                                    <span className="text-info" title={state?.notice || MAINTENANCE_LABEL}>{MAINTENANCE_LABEL}</span>
                                                                </>
                                                            ) : isEnabled ? (
                                                                <>
                                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                                                                    <span className="text-success">Actif</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-muted-foreground">{GUILD_DISABLED_LABEL}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    {isLoading ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <Switch
                                                            checked={isEnabled}
                                                            onCheckedChange={(val) => handleToggle(mod.key, val)}
                                                            disabled={isPending || isLocked}
                                                            className="scale-110 data-[state=checked]:bg-success"
                                                            aria-label={`Toggle module ${mod.label}`}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                {mod.description}
                                            </p>

                                            {isLocked && state?.notice ? (
                                                <p className="mt-2 flex items-start gap-2 rounded-lg border border-info/20 bg-info/10 px-2.5 py-1.5 text-xs text-info">
                                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    <span>{state.notice}</span>
                                                </p>
                                            ) : null}

                                            {isEnabled ? (
                                                <div className="mt-3 space-y-2 border-t border-border pt-3">
                                                    {routes && routes.length > 0 ? (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="text-xs font-medium text-muted-foreground">Pages :</span>
                                                            {routes.map((r) => (
                                                                <Link
                                                                    key={r.href}
                                                                    href={r.href.replace("{guildId}", guildId)}
                                                                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-border-strong"
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
                                                                        className="rounded-lg border border-warning/25 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
                                                                    >
                                                                        {PERMISSION_LABELS[permId] || permId}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                                                    {isLocked
                                                        ? "Pages et droits associés masqués pendant la maintenance."
                                                        : "Pages et droits associés masqués tant que le module est désactivé."}
                                                </p>
                                            )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )})}
            </div>

        </div>
    );
}
