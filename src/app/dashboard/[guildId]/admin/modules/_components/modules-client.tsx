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
    Compass,
    UserCircle,
    BarChart3,
    FileText,
    LayoutDashboard,
    BookMarked,
    Map,
    Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GuidePulse } from "@/components/dashboard/guide-pulse";

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
                description: "Tableau de bord des statistiques globales de la guilde (à venir).",
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
                icon: Compass,
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
    {
        label: "Bientôt",
        modules: [
            {
                key: "quests",
                label: "Quêtes Dofus",
                description: "Optimisation des quêtes de Dofus. Suivi de progression, quêtes en commun et matchmaking entre membres.",
                icon: BookMarked,
                color: "text-amber-400",
                bgColor: "bg-amber-500/10",
                borderColor: "border-amber-500/30",
                comingSoon: true,
            },
            {
                key: "worldmap",
                label: "Carte & Mini-Jeux",
                description: "Carte du monde interactive et mini-jeux de guilde inspirés de dofusdb.fr.",
                icon: Map,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
                comingSoon: true,
            },
            {
                key: "resources",
                label: "Ressources Communautaires",
                description: "Hub centralisé des ressources Dofus : sites communautaires, guides, actus et mises à jour.",
                icon: Library,
                color: "text-violet-400",
                bgColor: "bg-violet-500/10",
                borderColor: "border-violet-500/30",
                comingSoon: true,
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
        <div className="space-y-8">
            {/* Summary bar */}
            <div className="flex items-center justify-between px-1">
                <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">{enabledCount}</span> / {totalCount} modules actifs
                </p>
                <Badge variant="outline" className="text-xs">
                    Modifications instantanées
                </Badge>
            </div>

            {/* Groups */}
            {MODULE_GROUPS.map((group) => (
                <div key={group.label} className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                        {group.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.modules.map((mod) => {
                            const isEnabled = modules[mod.key];
                            const isLoading = pending === mod.key && isPending;
                            const Icon = mod.icon;

                            return (
                                <div
                                    key={mod.key}
                                    className={cn(
                                        "relative rounded-xl border p-5 transition-all duration-200",
                                        isEnabled
                                            ? `${mod.bgColor} ${mod.borderColor}`
                                            : "bg-card/20 border-border/50 opacity-60"
                                    )}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                isEnabled ? mod.bgColor : "bg-muted/30"
                                            )}>
                                                <Icon className={cn(
                                                    "w-5 h-5",
                                                    isEnabled ? mod.color : "text-muted-foreground"
                                                )} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className={cn(
                                                        "font-semibold text-sm",
                                                        isEnabled ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {mod.label}
                                                    </h3>
                                                    {mod.comingSoon && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-400 font-black uppercase tracking-wider">
                                                            Bientôt
                                                        </Badge>
                                                    )}
                                                    <GuidePulse
                                                        description={mod.description}
                                                        className="w-2.5 h-2.5"
                                                        side="top"
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    isEnabled ? mod.color : "text-muted-foreground/60"
                                                )}>
                                                    {isEnabled ? "Actif" : "Inactif"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Toggle */}
                                        <div className="flex items-center">
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                            ) : (
                                                <Switch
                                                    checked={isEnabled}
                                                    onCheckedChange={(val) => handleToggle(mod.key, val)}
                                                    disabled={isPending}
                                                    aria-label={`Toggle module ${mod.label}`}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {mod.description}
                                    </p>

                                    {/* Disabled overlay hint */}
                                    {!isEnabled && (
                                        <div className="absolute inset-0 rounded-xl flex items-end justify-end p-3 pointer-events-none">
                                            <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">
                                                Désactivé
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Info note */}
            <p className="text-xs text-muted-foreground/60 text-center pt-2">
                Les membres ne peuvent plus accéder aux modules désactivés. Les données sont conservées.
            </p>
        </div>
    );
}
