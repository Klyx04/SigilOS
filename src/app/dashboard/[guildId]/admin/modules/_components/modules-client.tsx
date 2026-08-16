"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGuildModules } from "@/server/actions/module-actions";
import { type GuildModulesState, type ModuleKey } from "@/lib/module-types";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Swords,
    Star,
    Flame,
    CalendarDays,
    Trophy,
    BookOpen,
    Loader2,
    Users,
    Key,
    UserCircle,
    BarChart3,
    FileText,
    LayoutDashboard,
    BookMarked,
    Map,
    Library,
    Palette,
    Search,
    Gamepad2,
    Camera,
    Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ============================================================================
// MODULE DEFINITIONS
// ============================================================================

type ModuleDef = {
    key: ModuleKey;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    comingSoon?: boolean;
};

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
    gallery: [{ label: "Galerie Guilde", href: "/dashboard/{guildId}/galerie-stuff" }],
    ladderSync: [{ label: "Classement (sync auto)", href: "/dashboard/{guildId}/ladder" }],
    manualLadderSync: [{ label: "Classement (sync manuelle)", href: "/dashboard/{guildId}/ladder" }],
    services: [{ label: "Services Guilde", href: "/dashboard/{guildId}/services" }],
    donjons: [{ label: "Donjons & Quêtes", href: "/dashboard/{guildId}/donjons-et-quetes" }],
    docs: [{ label: "Documentation (Wiki)", href: "/docs" }],
    polls: [{ label: "Sondages", href: "/dashboard/{guildId}/sondages" }],
    minigames: [{ label: "Mini-Jeux", href: "/dashboard/{guildId}/mini-jeux" }],
    quests: [{ label: "Quêtes Dofus", href: "/dashboard/{guildId}/quetes-dofus" }],
    worldmap: [{ label: "Carte du Monde", href: "/dashboard/{guildId}/worldmap" }],
    resources: [{ label: "Ressources Dofus", href: "/dashboard/{guildId}/ressources" }],
    profile: [
        { label: "Profil Membre", href: "/dashboard/{guildId}/profile" },
        { label: "Annuaire", href: "/dashboard/{guildId}/members" },
    ],
    logs: [{ label: "Audit Logs", href: "/dashboard/{guildId}/admin/logs" }],
};

type ModuleGroup = {
    label: string;
    modules: ModuleDef[];
};

const MODULE_GROUPS: ModuleGroup[] = [
    {
        label: "Général",
        modules: [
            {
                key: "presentation",
                label: "Présentation",
                description: "Page de présentation publique de la guilde. Recrutement, histoire et valeurs.",
                icon: LayoutDashboard,
                color: "text-blue-400",
                bgColor: "bg-blue-500/10",
                borderColor: "border-blue-500/30",
            },
            {
                key: "roster",
                label: "Annuaire",
                description: "Répertoire des membres avec leurs personnages, rôles et statistiques Dofus.",
                icon: Users,
                color: "text-blue-400",
                bgColor: "bg-blue-500/10",
                borderColor: "border-blue-500/30",
            },
            {
                key: "stats",
                label: "Stats Guilde",
                description: "Tableau de bord des statistiques globales de la guilde (activité, missions, songes).",
                icon: BarChart3,
                color: "text-blue-400",
                bgColor: "bg-blue-500/10",
                borderColor: "border-blue-500/30",
            },
            {
                key: "calendar",
                label: "Calendrier",
                description: "Événements de guilde, inscriptions, rappels Discord et gestion des récurrences.",
                icon: CalendarDays,
                color: "text-green-400",
                bgColor: "bg-green-500/10",
                borderColor: "border-green-500/30",
            },
        ],
    },
    {
        label: "Fonctionnalités",
        modules: [
            {
                key: "missions",
                label: "Missions",
                description: "Missions hebdomadaires, soumissions de preuves et validation admin. Le cœur de l'activité guilde.",
                icon: Swords,
                color: "text-emerald-400",
                bgColor: "bg-emerald-500/10",
                borderColor: "border-emerald-500/30",
            },
            {
                key: "songes",
                label: "Songes",
                description: "Organisation de runs Songes avec gestion des équipes, candidatures et embeds Discord.",
                icon: Star,
                color: "text-purple-400",
                bgColor: "bg-purple-500/10",
                borderColor: "border-purple-500/30",
            },
            {
                key: "ocre",
                label: "Quête Ocre",
                description: "Suivi de la quête Ocre via Metamob. Matching automatique des doublons et partenaires d'échange.",
                icon: Flame,
                color: "text-orange-400",
                bgColor: "bg-orange-500/10",
                borderColor: "border-orange-500/30",
            },
            {
                key: "ladder",
                label: "Classement",
                description: "Classement des membres par points de succès Dofus, synchronisé depuis dofus.com.",
                icon: Trophy,
                color: "text-yellow-400",
                bgColor: "bg-yellow-500/10",
                borderColor: "border-yellow-500/30",
            },
            {
                key: "gallery",
                label: "Galerie Guilde",
                description: "Partagez et consultez les builds de stuff Dofusbook des membres. Intégration API Dofusbook.",
                icon: Palette,
                color: "text-pink-400",
                bgColor: "bg-pink-500/10",
                borderColor: "border-pink-500/30",
            },
            {
                key: "ladderSync",
                label: "Succès 2.0",
                description: "Synchronisation automatique des points de succès via le ladder officiel (Cloudflare Worker).",
                icon: Trophy,
                color: "text-amber-400",
                bgColor: "bg-amber-500/10",
                borderColor: "border-amber-500/30",
            },
            {
                key: "manualLadderSync",
                label: "Sync Manuelle",
                description: "Permet aux membres de synchroniser leurs points via capture d'écran (Backup OCR).",
                icon: Camera,
                color: "text-zinc-400",
                bgColor: "bg-white/5",
                borderColor: "border-white/10",
            },
        ],
    },
    {
        label: "Outils",
        modules: [
            {
                key: "services",
                label: "Services Guilde",
                description: "Passages de donjon et services entre membres. Coordination et suivi des échanges.",
                icon: Key,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "donjons",
                label: "Donjons & Quêtes",
                description: "Recherche de partenaires pour donjons et quêtes. Outil de matching communautaire.",
                icon: Swords,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },

            {
                key: "docs",
                label: "Documentation",
                description: "Wiki interne de la guilde. Éditeur TipTap avec images, accès contrôlé par rôle Discord.",
                icon: BookOpen,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "polls",
                label: "Sondages",
                description: "Sondages de guilde (suggestions, améliorations, événements) avec votes et archives.",
                icon: Gavel,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "minigames",
                label: "Mini-Jeux",
                description: "Jeux arcade en ligne (Invader, etc). Gagnez des points pour le ladder et défiez les membres.",
                icon: Gamepad2,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "quests",
                label: "Quêtes Dofus",
                description: "Optimisation des quêtes de Dofus. Suivi de progression, quêtes en commun et matchmaking entre membres.",
                icon: BookMarked,
                color: "text-amber-400",
                bgColor: "bg-amber-500/10",
                borderColor: "border-amber-500/30",
            },
            {
                key: "worldmap",
                label: "Carte du Monde",
                description: "Carte interactive de Dofus avec zones, ressources et points d'intérêt. Navigation géographique avancée.",
                icon: Map,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "resources",
                label: "Ressources",
                description: "Hub d'informations Dofus: Almanax, actualités Ankama, encyclopédie et outils communautaires.",
                icon: Library,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
            {
                key: "profile",
                label: "Profil Membre",
                description: "Page de profil personnalisée par membre avec statistiques et historique d'activité.",
                icon: UserCircle,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
            },
        ],
    },
    {
        label: "Administration",
        modules: [
            {
                key: "logs",
                label: "Logs d'Audit",
                description: "Journal des actions administratives. Traçabilité complète des modifications de configuration.",
                icon: FileText,
                color: "text-rose-400",
                bgColor: "bg-rose-500/10",
                borderColor: "border-rose-500/30",
            },
        ],
    },
];

// ============================================================================
// COMPONENT
// ============================================================================

type Props = {
    guildId: string;
    initialModules: GuildModulesState;
};

export function ModulesClient({ guildId, initialModules }: Props) {
    const [modules, setModules] = useState<GuildModulesState>(initialModules);
    const [pending, setPending] = useState<ModuleKey | null>(null);
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState("");

    const allModules = MODULE_GROUPS.flatMap(g => g.modules);
    const enabledCount = allModules.filter(m => modules[m.key]).length;
    const totalCount = allModules.length;

    async function handleToggle(key: ModuleKey, value: boolean) {
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-2 py-4 border-b border-white/5 bg-white/[0.01] rounded-2xl">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Système de Capacités</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{enabledCount}</span>
                            <span className="text-zinc-500 font-medium text-xs">/ {totalCount} modules</span>
                        </div>
                    </div>
                    <div className="h-10 w-px bg-white/10 mx-2 hidden md:block" />
                    <div className="flex h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                            style={{ width: `${(enabledCount / totalCount) * 100}%` }} 
                        />
                    </div>
                </div>
                <Badge variant="outline" className="bg-white/5 border-white/10 text-zinc-400 font-medium text-xs py-1 px-3 rounded-lg">
                    Modifications appliquées instantanément
                </Badge>
            </div>

            {/* Search Bar */}
            <div className="relative px-2 mt-4 max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Rechercher un module (ex: chat, missions...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-all font-medium"
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
                             <div className="h-0.5 w-8 bg-white/15" />
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                                {group.label}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {filteredModules.map((mod) => {
                                const isEnabled = modules[mod.key];
                                const isLoading = pending === mod.key && isPending;
                                const Icon = mod.icon;
                                const routes = MODULE_ROUTES[mod.key];

                                return (
                                    <div
                                        key={mod.key}
                                        className={cn(
                                            "group relative rounded-2xl border transition-all duration-200 overflow-hidden",
                                            isEnabled
                                                ? "bg-zinc-900/60 border-white/10 shadow-sm"
                                                : "bg-black/40 border-white/5 opacity-50 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 hover:border-white/10"
                                        )}
                                    >
                                        <div className="relative z-10 p-6 flex flex-col h-full">
                                            {/* Top Row: Icon & Toggle */}
                                            <div className="flex items-start justify-between gap-4 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "relative h-14 w-14 rounded-2xl flex items-center justify-center border transition-colors duration-200",
                                                        isEnabled 
                                                            ? "bg-emerald-500/[0.06] border-emerald-500/30"
                                                            : "bg-white/[0.01] border-white/5"
                                                    )}>
                                                        <Icon className={cn(
                                                            "w-7 h-7 transition-colors duration-200",
                                                            isEnabled ? "text-emerald-400" : "text-zinc-600"
                                                        )} strokeWidth={1.5} />
                                                    </div>

                                                    <div className="flex flex-col">
                                                         <div className="flex items-center gap-2">
                                                            <h3 className={cn(
                                                                "font-semibold text-base tracking-tight",
                                                                isEnabled ? "text-white" : "text-zinc-500"
                                                            )}>
                                                                {mod.label}
                                                            </h3>
                                                            {mod.comingSoon && (
                                                                <Badge variant="outline" className="text-xs px-2 py-0.5 h-5 bg-amber-500/10 border-amber-500/20 text-amber-400 font-medium">
                                                                    WIP
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isEnabled ? (
                                                                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                    Actif
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-zinc-500">Désactivé</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center shrink-0">
                                                    {isLoading ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                                                    ) : (
                                                        <Switch
                                                            checked={isEnabled}
                                                            onCheckedChange={(val) => handleToggle(mod.key, val)}
                                                            disabled={isPending}
                                                            className="data-[state=checked]:bg-emerald-500 scale-125"
                                                            aria-label={`Toggle module ${mod.label}`}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Description Card */}
                                            <div className="flex-1 space-y-4">
                                                <p className={cn(
                                                    "text-sm leading-relaxed transition-colors duration-200",
                                                    isEnabled ? "text-zinc-400" : "text-zinc-600"
                                                )}>
                                                    {mod.description}
                                                </p>
                                            </div>

                                            {/* Pages concernées (#66) */}
                                            <div className="mt-6 pt-5 border-t border-white/[0.05]">
                                                {routes && routes.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-medium text-zinc-500">Pages :</span>
                                                        {routes.map((r) => (
                                                            <Link
                                                                key={r.href}
                                                                href={r.href.replace("{guildId}", guildId)}
                                                                className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-colors"
                                                            >
                                                                {r.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-zinc-500">Page dédiée à venir</span>
                                                )}
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
                <div className="h-px w-32 bg-white/5 mx-auto" />
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-widest">
                    Modules de la guilde
                </p>
            </div>
        </div>
    );
}
