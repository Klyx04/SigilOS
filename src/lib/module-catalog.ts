// ============================================================================
// MODULE CATALOG — source unique des modules de guilde (libellé + description
// réelles + icône). Consommé par la page /admin/modules ET par le wizard
// d'onboarding : une seule vérité, aucune description inventée.
// ============================================================================

import type { ModuleKey } from "@/lib/module-types";
import {
    Swords,
    Star,
    Flame,
    CalendarDays,
    Trophy,
    BookOpen,
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
    Gamepad2,
    Camera,
    Gavel,
    CalendarClock,
    Sparkles,
    Ticket,
    Terminal,
    Store,
} from "lucide-react";

export type ModuleDef = {
    key: ModuleKey;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    comingSoon?: boolean;
    /** Official Dofus 2x UI asset filename (in /assets/dofus/modules/) */
    dofusAsset?: string;
};

/**
 * Mapping ModuleKey → official Dofus 2x UI asset filename.
 * Files live in public/assets/dofus/modules/.
 */
export const MODULE_DOFUS_ASSETS: Partial<Record<ModuleKey, string>> = {
    presentation: "guild.png",
    roster: "social.png",
    stats: "guildActivity.png",
    calendar: "calendar.png",
    availability: "calendar.png",
    commandes: "chat.png",
    missions: "guildatons.png",
    songes: "songes_run.png",
    ocre: "dofus_ocre.png",
    ladder: "ladder.png",
    succes: "success.png",
    gallery: "cosmetics.png",
    ladderSync: "ladder.png",
    manualLadderSync: "ladder.png",
    services: "key.png",
    marche: "kama.png",
    donjons: "dofus.png",
    docs: "encyclopedia_2x.png",
    polls: "guild.png",
    minigames: "dice.png",
    quests: "quest.png",
    worldmap: "world_map.png",
    resources: "resources.png",
    profile: "character.png",
    reactionRoles: "starShield.png",
    tickets: "ticket.png",
    logs: "hourglass.png",
};

export type ModuleGroup = {
    label: string;
    modules: ModuleDef[];
};

export const MODULE_GROUPS: ModuleGroup[] = [
    {
        label: "Général",
        modules: [
            {
                key: "presentation",
                label: "Présentation",
                description: "Page de présentation publique de la guilde. Recrutement, histoire et valeurs.",
                icon: LayoutDashboard,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "roster",
                label: "Annuaire",
                description: "Répertoire des membres avec leurs personnages, rôles et statistiques Dofus.",
                icon: Users,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "stats",
                label: "Stats Guilde",
                description: "Tableau de bord des statistiques globales de la guilde (activité, missions, songes).",
                icon: BarChart3,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
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
            {
                key: "availability",
                label: "Disponibilités",
                description: "Planning hebdomadaire des membres (onglet Disponibilités de l'annuaire + onglet Planning du profil). Rappel doux une fois par semaine si non rempli.",
                icon: CalendarClock,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "commandes",
                label: "Commandes Bot Discord",
                description: "Catalogue des commandes slash : syntaxe, salons et rôles autorisés.",
                icon: Terminal,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
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
                color: "text-success",
                bgColor: "bg-success/10",
                borderColor: "border-success/30",
            },
            {
                key: "songes",
                label: "Songes",
                description: "Organisation de runs Songes avec gestion des équipes, candidatures et embeds Discord.",
                icon: Star,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "ocre",
                label: "Quête Ocre",
                description: "Suivi de la quête Ocre via Metamob. Matching automatique des doublons et partenaires d'échange.",
                icon: Flame,
                color: "text-warning",
                bgColor: "bg-warning/10",
                borderColor: "border-warning/30",
            },
            {
                key: "ladder",
                label: "Classement",
                description: "Classement des membres par points de succès Dofus, synchronisé depuis dofus.com.",
                icon: Trophy,
                color: "text-warning",
                bgColor: "bg-warning/10",
                borderColor: "border-warning/30",
            },
            {
                key: "succes",
                label: "Succès",
                description: "Checklist personnelle des succès de donjons et annuaire « qui a quoi » dans la guilde. Liée aux posts Donjons & Quêtes (validation de groupe à la clôture).",
                icon: Trophy,
                color: "text-warning",
                bgColor: "bg-warning/10",
                borderColor: "border-warning/30",
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
                label: "Ladder Ankama",
                description: "Synchronisation automatique des points de succès via le ladder officiel (Cloudflare Worker).",
                icon: Trophy,
                color: "text-warning",
                bgColor: "bg-warning/10",
                borderColor: "border-warning/30",
            },
            {
                key: "manualLadderSync",
                label: "Ladder Analyse OC",
                description: "Permet aux membres de synchroniser leurs points via capture d'écran (Backup OCR).",
                icon: Camera,
                color: "text-muted-foreground",
                bgColor: "bg-surface",
                borderColor: "border-border",
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
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "marche",
                label: "Marché",
                description: "Catalogue d'annonces FM (équipements et lots de ressources) entre membres — publication Discord, cycle de vie 7/15/20 j, lots simples et composites.",
                icon: Store,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "donjons",
                label: "Donjons & Quêtes",
                description: "Recherche de partenaires pour donjons et quêtes. Outil de matching communautaire.",
                icon: Swords,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },

            {
                key: "docs",
                label: "Documentation",
                description: "Wiki interne de la guilde. Éditeur TipTap avec images, accès contrôlé par rôle Discord.",
                icon: BookOpen,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "polls",
                label: "Sondages",
                description: "Sondages de guilde (suggestions, améliorations, événements) avec votes et archives.",
                icon: Gavel,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "minigames",
                label: "Mini-Jeux",
                description: "Jeux arcade en ligne (Invader, etc). Gagnez des points pour le ladder et défiez les membres.",
                icon: Gamepad2,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "quests",
                label: "Quêtes Dofus",
                description: "Optimisation des quêtes de Dofus. Suivi de progression, quêtes en commun et matchmaking entre membres.",
                icon: BookMarked,
                color: "text-warning",
                bgColor: "bg-warning/10",
                borderColor: "border-warning/30",
            },
            {
                key: "worldmap",
                label: "Carte du Monde",
                description: "Carte interactive de Dofus avec zones, ressources et points d'intérêt. Navigation géographique avancée.",
                icon: Map,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "resources",
                label: "Ressources",
                description: "Hub d'informations Dofus: Almanax, actualités Ankama, encyclopédie et outils communautaires.",
                icon: Library,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
            {
                key: "profile",
                label: "Profil Membre",
                description: "Page de profil personnalisée par membre avec statistiques et historique d'activité.",
                icon: UserCircle,
                color: "text-info",
                bgColor: "bg-info/10",
                borderColor: "border-info/30",
            },
        ],
    },
    {
        label: "Administration",
        modules: [
            {
                key: "reactionRoles",
                label: "Rôles par Réaction (Reaction Roles)",
                description: "Panneaux de sélection de rôles Discord interactifs avec boutons, menus déroulants, swap automatique et packs d'icônes.",
                icon: Sparkles,
                color: "text-violet-400",
                bgColor: "bg-violet-500/10",
                borderColor: "border-violet-500/30",
            },
            {
                key: "tickets",
                label: "Bot Tickets & Support",
                description: "Système complet de support Discord avec formulaires d'intake personnalisés, claim staff, notes internes, auto-close, SLA et transcripts.",
                icon: Ticket,
                color: "text-amber-400",
                bgColor: "bg-amber-500/10",
                borderColor: "border-amber-500/30",
            },
            {
                key: "logs",
                label: "Logs d'Audit",
                description: "Journal des actions administratives. Traçabilité complète des modifications de configuration.",
                icon: FileText,
                color: "text-danger",
                bgColor: "bg-danger/10",
                borderColor: "border-danger/30",
            },
        ],
    },
];
