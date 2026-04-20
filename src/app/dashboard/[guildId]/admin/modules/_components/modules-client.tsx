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
    MessageCircle,
    Palette,
    Search,
    Gamepad2,
    Camera,
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
                key: "minigames",
                label: "Mini-Jeux & Carte",
                description: "Défiez vos amis sur SigilGuesser (Geo), Sigil-Gartic (Dessin) et explorez la carte du monde.",
                icon: Map,
                color: "text-cyan-400",
                bgColor: "bg-cyan-500/10",
                borderColor: "border-cyan-500/30",
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
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Système de Capacités</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{enabledCount}</span>
                            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-tighter">/ {totalCount} Modules Déployés</span>
                        </div>
                    </div>
                    <div className="h-10 w-px bg-white/10 mx-2 hidden md:block" />
                    <div className="flex h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out" 
                            style={{ width: `${(enabledCount / totalCount) * 100}%` }} 
                        />
                    </div>
                </div>
                <Badge variant="outline" className="bg-white/5 border-white/10 text-white/40 font-black uppercase tracking-widest text-[9px] py-1 px-3 rounded-lg backdrop-blur-md">
                    Modifications Instantanées • Sync Temps Réel
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
                        <div key={group.label} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-4 px-2">
                             <div className="h-0.5 w-8 bg-gradient-to-r from-emerald-500 to-transparent" />
                            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 drop-shadow-sm">
                                {group.label}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {filteredModules.map((mod) => {
                                const isEnabled = modules[mod.key];
                                const isLoading = pending === mod.key && isPending;
                                const Icon = mod.icon;

                                return (
                                    <div
                                        key={mod.key}
                                        className={cn(
                                            "group relative rounded-[2rem] border transition-all duration-500 overflow-hidden",
                                            isEnabled
                                                ? "bg-[#09090b]/80 border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
                                                : "bg-black/40 border-white/5 opacity-50 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 hover:border-white/10"
                                        )}
                                    >
                                        {/* Dynamic Glow Layer */}
                                        {isEnabled && (
                                            <div className={cn(
                                                "absolute -inset-[100px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 blur-[100px] pointer-events-none",
                                                mod.bgColor.replace("/10", "/100")
                                            )} />
                                        )}

                                        <div className="relative z-10 p-6 flex flex-col h-full">
                                            {/* Top Row: Icon & Toggle */}
                                            <div className="flex items-start justify-between gap-4 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "relative h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                                                        isEnabled 
                                                            ? `bg-white/[0.03] ${mod.borderColor} shadow-[0_0_20px_rgba(255,255,255,0.02)]`
                                                            : "bg-white/[0.01] border-white/5"
                                                    )}>
                                                        <Icon className={cn(
                                                            "w-7 h-7 transition-all duration-500",
                                                            isEnabled ? mod.color : "text-zinc-600"
                                                        )} strokeWidth={1.5} />
                                                        
                                                        {isEnabled && (
                                                            <div className={cn(
                                                                "absolute -inset-2 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity",
                                                                mod.bgColor
                                                            )} />
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col">
                                                         <div className="flex items-center gap-2">
                                                            <h3 className={cn(
                                                                "font-black text-base tracking-tighter uppercase",
                                                                isEnabled ? "text-white" : "text-zinc-500"
                                                            )}>
                                                                {mod.label}
                                                            </h3>
                                                            {mod.comingSoon && (
                                                                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/20 text-amber-400 font-black uppercase tracking-widest">
                                                                    WIP
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isEnabled ? (
                                                                <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />
                                                                    Active
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-bold text-zinc-600">OFFLINE</span>
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
                                                    "text-[13px] leading-relaxed font-medium transition-colors duration-500",
                                                    isEnabled ? "text-zinc-400" : "text-zinc-600"
                                                )}>
                                                    {mod.description}
                                                </p>
                                            </div>

                                            {/* Meta Footer */}
                                            <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-center justify-between">
                                                <div className="flex -space-x-1">
                                                    {/* Decorative user icons or stats placeholder */}
                                                    {[...Array(2)].map((_, i) => (
                                                        <div key={i} className="h-5 w-5 rounded-full border border-zinc-950 bg-zinc-900 flex items-center justify-center">
                                                            <div className="h-1 w-1 rounded-full bg-zinc-600" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <button 
                                                    className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                                    onClick={() => {}}
                                                >
                                                    Configs
                                                    <span className="text-zinc-700">→</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* HUD Border Decoration */}
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                                            <div className="h-px w-8 bg-white" />
                                            <div className="h-8 w-px bg-white absolute top-2 right-2" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )})}
            </div>

            {/* Support Note */}
            <div className="pt-20 pb-10 text-center space-y-4">
                <div className="h-px w-32 bg-white/5 mx-auto" />
                <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] opacity-40">
                    Infrastructure Modules • v4.2.0-stabilized
                </p>
            </div>
        </div>
    );
}
