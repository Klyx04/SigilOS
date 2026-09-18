"use client";

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type TourPhase =
    | "profile"
    | "dashboard"
    | "dashboardBricks"
    | "admin"
    | "adminModules"
    | "adminSettings"
    | "adminPermissions"
    | "adminModulesMgmt"
    | "adminPresentation"
    | "adminMissions"
    | "adminValidation"
    | "adminMembers"
    | "adminLogs"
    | "adminOverview"
    | "adminPoints"
    | "adminApiKeys"
    | "adminRecruitment"
    | "adminPilotage"
    | "reactionRoles"
    | "tickets"
    // Phases des tours MODULES (rejouables, filtrées par module actif + RBAC)
    | "missions"
    | "ladder"
    | "songes"
    | "ocre"
    | "services"
    | "donjons"
    | "calendar"
    | "sondages"
    | "annuaire"
    | "quetesDofus"
    | "galerie"
    | "ressources"
    | "docs"
    | "minijeu"
    | "stats"
    | "presentation"
    | "guide"
    | "succes"
    | "marche"
    | null;

/**
 * Phases des tours « modules » : rejouables à tout moment (jamais de flag
 * "done" définitif), non bloquantes (on reste sur la page), et dont chaque
 * étape est filtrée par le module actif + requiresPerm (RBAC).
 */
export const MODULE_TOUR_PHASES = [
    "missions", "ladder", "songes", "ocre",
    "services", "donjons", "calendar", "sondages", "annuaire",
    "quetesDofus", "galerie", "ressources", "docs", "minijeu", "stats", "presentation",
    "guide", "succes",
    "marche",
] as const;

export function isReplayableTourPhase(phase: TourPhase): boolean {
    if (!phase) return false;
    return phase.startsWith("admin")
        || phase === "dashboardBricks"
        || (MODULE_TOUR_PHASES as readonly string[]).includes(phase);
}

interface TourStep {
    target: string; // Selector for document.querySelector
    title: string;
    description: string;
    placement: "top" | "bottom" | "left" | "right";
    /** Clé de permission RBAC admin (sur l'objet `user` passé au provider).
     *  Si elle vaut `false` pour l'utilisateur, la carte est MASQUÉE. */
    requiresPerm?: string;
    /** Module optionnel (ex: "missions") — la carte n'apparaît que si ce module est actif. */
    module?: string;
    /**
     * BUG-6 (constat beta) — **page où vit l'ancre**, quand ce n'est pas la page
     * courante (ex. l'éditeur de jet vit sur `/marche/nouveau`). Le provider y
     * **navigue** au lieu de sauter l'étape, ce qui coupait la suite du tutoriel.
     *
     * 🔒 Chemin **relatif** de la guilde, validé par préfixe
     * (`requestStepNavigation`) : jamais une URL fournie par l'utilisateur.
     */
    href?: string;
}

interface TourContextType {
    tourPhase: TourPhase;
    currentStep: number;
    totalSteps: number;
    isActive: boolean;
    activeStepData: TourStep | null;
    advance: () => void;
    back: () => void;
    completeTour: () => void;
    /**
     * BUG-7 — quitte le tutoriel **proprement** et **sans écran de fin** : la
     * bulle doit toujours pouvoir être passée (bouton « Passer » ou touche
     * `Échap`), sinon un utilisateur dont la bulle s'affiche mal reste bloqué.
     */
    skipTour: () => void;
    startTour: (phase: TourPhase) => void;
    isCelebrationActive: boolean;
    setCelebrationActive: (active: boolean) => void;
    /**
     * BUG-6 — demande de navigation vers la page qui porte l'ancre de l'étape
     * courante : le provider **valide le préfixe** (même guilde, module Marché)
     * avant de pousser la route. Sans ancre trouvée et sans `href`, l'overlay
     * conserve son comportement anti-centrage (skip).
     */
    requestStepNavigation: (href: string) => void;
}

const PROFILE_STEPS: TourStep[] = [
    {
        target: '[data-tour="profile-header"]',
        title: "Ton profil de guilde",
        description: "C'est ta carte d'identité visible par tous les membres de la guilde.",
        placement: "bottom"
    },
    {
        target: '[data-tour="profile-class"]',
        title: "Vérifie ton pseudo",
        description: "Utilise la 🔍 pour valider que ton pseudo Dofus est bien reconnu et synchronisé avec le Ladder Ankama.",
        placement: "bottom"
    },
    {
        target: '[data-tour="profile-tab-overview"]',
        title: "Ton profil en général",
        description: "Retrouve ta présentation, ta classe et tes informations visibles par la guilde.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-metiers"]',
        title: "Tes métiers",
        description: "Indique tes métiers actifs pour que la guilde sache à qui s'adresser pour des crafts.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-planning"]',
        title: "Tes disponibilités",
        description: "Renseigne tes créneaux horaires pour faciliter l'organisation de runs de donjons ou de songes.",
        placement: "top",
        module: "availability"
    },
    {
        target: '[data-tour="profile-tab-combat"]',
        title: "Tes builds",
        description: "Ajoute tes liens Dofusbook ou DofusCreator pour partager tes équipements et ta progression.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-dofus"]',
        title: "Quêtes Dofus",
        description: "Suis ta progression sur les quêtes des Dofus directement depuis ton profil.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-activity"]',
        title: "Présence & Feed",
        description: "Gère ta présence et consulte l'activité récente de tes compagnons.",
        placement: "right",
        module: "missions"
    },
    {
        target: '[data-tour="profile-tab-settings"]',
        title: "Tes préférences",
        description: "Personnalise la réception de tes notifications et la visibilité de ton activité.",
        placement: "right"
    }
];

const DASHBOARD_STEPS: TourStep[] = [
    {
        target: '[data-tour="sidebar-ladder"]',
        title: "Ladder des succès",
        description: "Suis ton score de succès Dofus, synchronisé automatiquement depuis le site officiel Ankama.",
        placement: "right",
        module: "ladder"
    },
    {
        // Dernière carte du tour d'arrivée : présenter la NAVBAR dans son ensemble.
        // L'étape « Missions de guilde » a été retirée (redondante avec la vue globale).
        target: '[data-tour="sidebar-root"]',
        title: "Tous vos modules",
        description: "Missions, Ladder, Quêtes Dofus, Songes, Services, Calendrier, Sondages… Tous les modules de votre guilde sont accessibles depuis cette barre latérale. Parcourez-la pour tout découvrir.",
        placement: "right"
    }
];

/**
 * Tour DASHBOARD — visite des briques/widgets de la page d'accueil.
 * Rejouable à tout moment via le bouton « Tutoriel » (DashboardAdminTourButton).
 * Cible les sections stables de la page dashboard (data-tour="dash-*").
 */
const DASHBOARD_BRICKS_STEPS: TourStep[] = [
    {
        target: '[data-tour="dash-stats"]',
        title: "Vue d'ensemble",
        description: "Les indicateurs clés de la guilde : membres en ligne et progression Dofus.",
        placement: "bottom"
    },
    {
        target: '[data-tour="dash-events"]',
        title: "Événements à venir",
        description: "Les sorties, raids et événements planifiés. Inscris-toi pour ne rien manquer.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-groups"]',
        title: "Groupes & Quêtes",
        description: "Rejoins des groupes pour les donjons et les quêtes, ou crée le tien.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-activity"]',
        title: "Activité de la guilde",
        description: "Le fil d'activité récent : validations, événements, nouveaux arrivants et actions de la guilde.",
        placement: "top"
    }
];

/**
 * Tour ADMIN — variante ONBOARDING (guilde neuve / en cours de config).
 * Cartes calquées sur getting-started.
 */
const ADMIN_ONBOARDING_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-dofus"]',
        title: "Serveur de Jeu",
        description: "Sélectionne le serveur Dofus de ta guilde. Étape obligatoire qui débloque l'accès des membres.",
        placement: "bottom"
    },
    {
        target: '[data-tour="admin-rbac"]',
        title: "Rôles & Permissions",
        description: "Attribue au moins un rôle avec l'autorisation \"Accès Dashboard\" pour sécuriser qui peut accéder.",
        placement: "bottom"
    },
    {
        target: '[data-tour="admin-discord"]',
        title: "Lier le Bot Discord",
        description: "Configure les salons de notification pour recevoir les événements de la guilde.",
        placement: "bottom"
    },
    {
        target: '[data-tour="admin-modules"]',
        title: "Configurer les Modules",
        description: "Active les fonctionnalités dont ta guilde a besoin. Rien n'est activé par défaut.",
        placement: "bottom",
        requiresPerm: "canViewSettings"
    }
];

/**
 * Tour ADMIN — variante MODULES (guilde déjà configurée).
 * Présente les briques/modules actives de la sidebar, filtrées par RBAC + module.
 */
const ADMIN_MODULES_STEPS: TourStep[] = [
    {
        target: '[data-tour="sidebar-missions"]',
        title: "Missions",
        description: "Gère les missions hebdomadaires, leurs validations et récompenses.",
        placement: "right",
        module: "missions",
        requiresPerm: "canViewMissions"
    },
    {
        target: '[data-tour="sidebar-songes"]',
        title: "Songes",
        description: "Organise les sorties songes et gère les inscriptions.",
        placement: "right",
        module: "songes",
        requiresPerm: "canViewSonges"
    },
    {
        target: '[data-tour="sidebar-ocre"]',
        title: "Quête Ocre",
        description: "Suit la progression Ocre des membres.",
        placement: "right",
        module: "ocre",
        requiresPerm: "canViewOcre"
    },
    {
        target: '[data-tour="sidebar-ladder"]',
        title: "Ladder",
        description: "Succès synchronisés automatiquement depuis Ankama.",
        placement: "right",
        module: "ladder",
        requiresPerm: "canViewLadder"
    },
    {
        target: '[data-tour="sidebar-services"]',
        title: "Services Guilde",
        description: "Prêts, coffre, boutique de services pour tes membres.",
        placement: "right",
        module: "services",
        requiresPerm: "canViewServices"
    },
    {
        target: '[data-tour="sidebar-calendar"]',
        title: "Calendrier",
        description: "Événements, raids et sorties planifiés.",
        placement: "right",
        module: "calendar",
        requiresPerm: "canViewCalendar"
    },
    {
        target: '[data-tour="sidebar-polls"]',
        title: "Sondages",
        description: "Recueille l'avis de ta guilde.",
        placement: "right",
        module: "polls",
        requiresPerm: "canViewPolls"
    }
];

/**
 * Tours ADMIN par module du Centre Admin.
 * Chaque étape est conditionnée par la permission RBAC correspondante :
 * l'admin ne verra que les étapes des modules auxquels il a réellement accès.
 * Ces phases sont REJOUABLES à tout moment depuis le Centre Admin.
 */
const ADMIN_SETTINGS_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-settings-header"]',
        title: "Paramètres Généraux",
        description: "Le centre de configuration de ta guilde. Toutes les intégrations (Discord, Metamob, Dofus) et toutes les options des modules de jeu se règlent ici. Les modifications sont enregistrées en direct.",
        placement: "bottom",
        requiresPerm: "canViewSettings"
    },
    {
        target: '[data-tour="admin-settings-nav"]',
        title: "Navigation par sections",
        description: "La colonne de gauche regroupe les réglages par thème : Système & Canaux (Annonces, Absences, Sondages), Gestion de Guilde (Serveur Dofus, Annuaire, Blacklist) et Modules de Jeu (Calendrier, Donjons, Missions, Prêts, Ocre, Galerie, Services). Clique sur une section pour ouvrir ses options.",
        placement: "right",
        requiresPerm: "canViewSettings"
    },
    {
        target: '[data-tour="admin-settings-pane"]',
        title: "Panneau de configuration",
        description: "Chaque section affiche ses propres options : salons Discord, notifications, récompenses, comportement des modules… Utilise le menu de droite pour sauter directement à un réglage précis sans navigation.",
        placement: "left",
        requiresPerm: "canViewSettings"
    }
];

const ADMIN_PERMISSIONS_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-permissions-header"]',
        title: "Rôles & Permissions",
        description: "Gestion fine des accès : définissez qui peut valider, modérer ou administrer.",
        placement: "bottom",
        requiresPerm: "canManageRBAC"
    },
    {
        target: '[data-tour="admin-permissions-matrix"]',
        title: "Matrice RBAC",
        description: "Attribuez des permissions aux rôles Discord pour contrôler l'accès au Dashboard.",
        placement: "top",
        requiresPerm: "canManageRBAC"
    }
];

const ADMIN_MODULES_MGMT_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-modules-header"]',
        title: "Gestion des Modules",
        description: "Activez ou désactivez les fonctionnalités de votre guilde.",
        placement: "bottom",
        requiresPerm: "isDiscordAdmin"
    },
    {
        target: '[data-tour="admin-modules-list"]',
        title: "Liste des modules",
        description: "Activez les modules souhaités (Missions, Songes, Ocre, Services…). Rien n'est activé par défaut.",
        placement: "top",
        requiresPerm: "isDiscordAdmin"
    }
];

const ADMIN_PRESENTATION_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-presentation-header"]',
        title: "Identité de Guilde",
        description: "Édition de la page publique, recrutement et présentation des objectifs.",
        placement: "bottom",
        requiresPerm: "canEditPresentation"
    },
    {
        target: '[data-tour="admin-presentation-editor"]',
        title: "Éditeur de présentation",
        description: "Rédigez la présentation publique visible par les candidats et les visiteurs.",
        placement: "top",
        requiresPerm: "canEditPresentation"
    }
];

const ADMIN_MISSIONS_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-missions-header"]',
        title: "Gestion des Missions",
        description: "Le quartier général de tes missions hebdomadaires : crée, prépare, publie et surtout admire le travail avant de l'envoyer aux membres.",
        placement: "bottom",
        requiresPerm: "canManageMissions"
    },
    {
        target: '[data-tour="admin-missions-builder"]',
        title: "Création & réglages",
        description: "L'éditeur de missions. Change de catégorie (Donjon, Régulation, Anomalie, Songes, Expédition…), règle le rang, et le palier global de la semaine. Chaque slot est une mission distincte.",
        placement: "top",
        requiresPerm: "canManageMissions"
    },
    {
        target: '[data-tour="admin-missions-bonus"]',
        title: "Bonus de guilde",
        description: "Configurez les bonus accordés aux membres selon la performance de la guilde. Bouton dans la barre d'outils (en haut à droite).",
        placement: "top",
        requiresPerm: "canManageMissions"
    }
];

const ADMIN_VALIDATION_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-validation-header"]',
        title: "Validation",
        description: "Le centre de tri des preuves et récompenses. Chaque type de soumission (missions, succès, dons de kamas, retours de vacances) a sa propre file, avec un indicateur de volume en attente sur chaque onglet.",
        placement: "bottom",
        requiresPerm: "canValidateMissions"
    },
    {
        target: '[data-tour="admin-validation-inbox"]',
        title: "File de validation",
        description: "Ces onglets regroupent les preuves à traiter : Missions (screens de validation), Succès (progression), Dons Kamas et Retours d'absences. Chaque entrée peut être acceptée ou refusée avec un motif que le membre verra.",
        placement: "top",
        requiresPerm: "canValidateMissions"
    }
];

const ADMIN_MEMBERS_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-members-header"]',
        title: "Gestion des Membres",
        description: "Annuaire admin, synchronisation des pseudos, archivage et relances Discord.",
        placement: "bottom",
        requiresPerm: "canManageMembers"
    },
    {
        target: '[data-tour="admin-members-table"]',
        title: "Tableau des membres",
        description: "Consultez les membres, leurs rôles, métiers et activités. Filtres et recherche inclus.",
        placement: "top",
        requiresPerm: "canManageMembers"
    },
    {
        target: '[data-tour="admin-members-tools"]',
        title: "Outils d'administration",
        description: "Synchronisation des pseudos, archivage et relances d'inactivité.",
        placement: "top",
        requiresPerm: "canManageMembers"
    }
];

const ADMIN_LOGS_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-logs-header"]',
        title: "Audit Logs",
        description: "Centre de traçabilité du staff. Chaque action sensible (validation, modération, configuration) est horodatée et reliée à son auteur. Idéal pour détecter les abus et garantir la transparence vis-à-vis des membres.",
        placement: "bottom",
        requiresPerm: "canViewAuditLogs"
    },
    {
        target: '[data-tour="admin-logs-list"]',
        title: "Journal des actions",
        description: "Filtrez par membre, type d'action ou période. Les journaux sont conservés 30 jours puis purgés automatiquement pour protéger la vie privée.",
        placement: "top",
        requiresPerm: "canViewAuditLogs"
    }
];

/**
 * Tour ADMIN — Overview du Centre Admin (page /admin).
 * Présente chaque carte/brique de supervision filtrée par RBAC.
 * Cible les cartes AdminCard via leur `tourId` (data-tour stable),
 * pas des composants internes fragiles.
 */
const ADMIN_OVERVIEW_STEPS: TourStep[] = [
    {
        target: '[data-tour="admin-overview-header"]',
            title: "Console — Supervision",
        description: "Centralise toute l'administration de ta guilde : structure, opérations, sécurité. Chaque carte ouvre un module dédié. Les cartes auxquelles tu n'as pas accès sont masquées automatiquement.",
        placement: "bottom",
        requiresPerm: "isAdmin"
    },
    {
        target: '[data-tour="admin-overview-structure"]',
        title: "Structure & Configuration",
        description: "Le socle de ta guilde : les paramètres généraux, la matrice RBAC, l'activation des modules et l'identité publique. Bien configurer cette section détermine ce que tes membres pourront voir et faire.",
        placement: "bottom",
        requiresPerm: "isDiscordAdmin"
    },
    {
        target: '[data-tour="admin-overview-card-settings"]',
        title: "Paramètres Généraux",
        description: "Règle les intégrations Discord, Metamob et Dofus, les salons de notification et la configuration globale. C'est ici que tu connectes ta guilde à l'écosystème SigilOS.",
        placement: "right",
        requiresPerm: "canViewSettings"
    },
    {
        target: '[data-tour="admin-overview-card-permissions"]',
        title: "Rôles & Permissions",
        description: "Le cœur de la sécurité : mappe les rôles Discord de ton serveur aux permissions SigilOS. Chaque rôle contrôle l'accès à tel ou tel module. Accessible aux admins Discord et aux détenteurs de la permission « Gestion des Accès » (system:rbac).",
        placement: "right",
        requiresPerm: "canManageRBAC"
    },
    {
        target: '[data-tour="admin-overview-card-modules"]',
        title: "Gestion des Modules",
        description: "Active ou désactive les modules (Missions, Songes, Ocre, Services, Calendrier…). Par défaut, tout est désactivé : compose l'expérience de ta guilde sans surcharge.",
        placement: "right",
        requiresPerm: "isDiscordAdmin"
    },
    {
        target: '[data-tour="admin-overview-card-presentation"]',
        title: "Identité de Guilde",
        description: "Édite la page publique de ta guilde (recrutement, objectifs, présentation). C'est la vitrine que découvrent les candidats avant de rejoindre le serveur.",
        placement: "right",
        requiresPerm: "canEditPresentation"
    },
    {
        target: '[data-tour="admin-overview-card-missions"]',
        title: "Gestion des Missions",
        description: "Prépare le reset hebdomadaire, crée les missions, définit les bonus et le palier. Ces missions seront visibles par tous les membres une fois publiées.",
        placement: "bottom",
        requiresPerm: "canManageMissions"
    },
    {
        target: '[data-tour="admin-overview-card-validation"]',
        title: "Validation",
        description: "Le centre de tri des preuves : missions, succès, dons de kamas, retours de vacances. Valide ou refuse avec un message pour récompenser les efforts de tes membres.",
        placement: "bottom",
        requiresPerm: "canValidateMissions"
    },
    {
        target: '[data-tour="admin-overview-card-members"]',
        title: "Gestion des Membres",
        description: "Annuaire admin complet : synchronise les pseudos, archive les comptes, gère les relances d'inactivité et les rôles. Le point d'entrée pour la gestion humaine de la guilde.",
        placement: "bottom",
        requiresPerm: "canManageMembers"
    },
    {
        target: '[data-tour="admin-overview-card-logs"]',
        title: "Audit Logs",
        description: "Consulte l'historique complet des actions du staff : qui a fait quoi et quand. Indispensable pour auditer ton équipe et détecter toute action suspecte.",
        placement: "bottom",
        requiresPerm: "canViewAuditLogs"
    }
];


// ----------------------------------------------------------------------------
// Tours MODULES (Évol 3 — « tutos partout »). Rejouables, filtrés par module
// actif + requiresPerm. Chaque step pointe un data-tour stable et réel.
// ----------------------------------------------------------------------------
const MISSIONS_STEPS: TourStep[] = [
    {
        target: '[data-tour="missions-header"]',
        title: "Missions de Guilde",
        description: "Le tableau de bord des missions hebdomadaires : relevez les défis pour faire briller votre guilde.",
        placement: "bottom",
        module: "missions",
    },
    {
        target: '[data-tour="missions-progress"]',
        title: "Progression de la guilde",
        description: "La jauge d'XP cumulée vers le prochain palier de la semaine, alimentée par les missions validées et les dons de kamas.",
        placement: "top",
        module: "missions",
    },
    {
        target: '[data-tour="missions-hall"]',
        title: "Hôtel de Guilde",
        description: "L'état de votre Hôtel de Guilde : sa position sur la carte et son rang actuel.",
        placement: "left",
        module: "missions",
    },
    {
        target: '[data-tour="missions-toolbar"]',
        title: "Barre d'outils",
        description: "Basculez entre le pool de missions et filtrez par catégorie ou par statut.",
        placement: "bottom",
        module: "missions",
    },
    {
        target: '[data-tour="missions-pool"]',
        title: "Missions Classiques / Spéciales",
        description: "Choisissez le pool : les missions Classiques hebdomadaires ou les missions Spéciales (événements).",
        placement: "bottom",
        module: "missions",
    },
    {
        target: '[data-tour="missions-grid"]',
        title: "Les cartes de mission",
        description: "Chaque carte détaille une mission : objectif, intérêts des membres et bouton pour proposer une preuve.",
        placement: "top",
        module: "missions",
    },
    {
        target: '[data-tour="sidebar-missions"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Progression.",
        placement: "right",
        module: "missions",
    },
];

const LADDER_STEPS: TourStep[] = [
    {
        target: '[data-tour="ladder-header"]',
        title: "Classement de Guilde",
        description: "Découvrez les membres les plus actifs et leur progression en jeu.",
        placement: "bottom",
        module: "ladder",
    },
    {
        target: '[data-tour="ladder-tabs"]',
        title: "Les classements",
        description: "Choisissez un classement : Activité, Contribution, Ancienneté, Succès, Général, Guildatons, Discord ou Raids.",
        placement: "bottom",
        module: "ladder",
    },
    {
        target: '[data-tour="ladder-period"]',
        title: "Période",
        description: "Ajustez la fenêtre temporelle : Cette semaine, Ce mois-ci ou Global (all-time).",
        placement: "bottom",
        module: "ladder",
    },
    {
        target: '[data-tour="ladder-list"]',
        title: "Le classement",
        description: "Chaque membre affiche son rang, son pseudo et sa valeur pour le classement sélectionné.",
        placement: "top",
        module: "ladder",
    },
    {
        target: '[data-tour="ladder-pagination"]',
        title: "Navigation",
        description: "Parcourez les pages du classement et suivez le nombre total de membres classés.",
        placement: "top",
        module: "ladder",
    },
    {
        target: '[data-tour="sidebar-ladder"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Progression.",
        placement: "right",
        module: "ladder",
    },
];


const SONGES_STEPS: TourStep[] = [
    {
        target: '[data-tour="songes-header"]',
        title: "Songes Infinis",
        description: "Suivez la progression des runs et rejoignez vos compagnons d'armes.",
        placement: "bottom",
        module: "songes",
    },
    {
        target: '[data-tour="songes-guide"]',
        title: "Guide des boss",
        description: "Ouvrez le guide des boss des Songes pour connaître les mécaniques avant de vous lancer.",
        placement: "bottom",
        module: "songes",
    },
    {
        target: '[data-tour="songes-create"]',
        title: "Créer un run",
        description: "Proposez un nouveau run de Songes Infinis et définissez vos conditions de groupe.",
        placement: "bottom",
        module: "songes",
    },
    {
        target: '[data-tour="songes-board"]',
        title: "Les runs actifs",
        description: "Chaque carte présente un run : étage visé, membres inscrits, statut de recrutement.",
        placement: "top",
        module: "songes",
    },
    {
        target: '[data-tour="sidebar-songes"]',
        title: "Accès rapide",
        description: "Retrouvez le module Songes dans la barre latérale pour y revenir à tout moment.",
        placement: "right",
        module: "songes",
    },
];

const OCRE_STEPS: TourStep[] = [
    {
        target: '[data-tour="ocre-header"]',
        title: "Quête Ocre",
        description: "Suivez votre progression sur la Quête de l'Éternelle Moisson et trouvez des partenaires d'échange.",
        placement: "bottom",
        module: "ocre",
    },
    {
        target: '[data-tour="ocre-sync"]',
        title: "Synchronisation",
        description: "Synchronisez vos données Metamob pour mettre à jour votre progression et vos monstres.",
        placement: "bottom",
        module: "ocre",
    },
    {
        target: '[data-tour="ocre-dashboard"]',
        title: "Votre progression",
        description: "Le détail de votre avancée sur la quête : monstres, archimonstres et gardiens de donjon capturés.",
        placement: "top",
        module: "ocre",
    },
    {
        target: '[data-tour="ocre-metamob"]',
        title: "Compte Metamob",
        description: "Reliez et gérez votre compte Metamob pour synchroniser automatiquement votre progression.",
        placement: "left",
        module: "ocre",
    },
    {
        target: '[data-tour="ocre-kralamoure"]',
        title: "Kralamoure",
        description: "Les prochaines apparitions de Kralamoure pour organiser les captures.",
        placement: "left",
        module: "ocre",
    },
    {
        target: '[data-tour="ocre-tips"]',
        title: "Astuces",
        description: "Quelques conseils : mettez à jour votre compte régulièrement et surveillez les apparitions de Kralamoure.",
        placement: "left",
        module: "ocre",
    },
    {
        target: '[data-tour="sidebar-ocre"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Progression.",
        placement: "right",
        module: "ocre",
    },
];


const SERVICES_STEPS: TourStep[] = [
    {
        target: '[data-tour="services-header"]',
        title: "Services & Artisans de Guilde",
        description: "Commandez des passages, crafts ou tutorats, gérez vos demandes, consultez le Livre d'or et suivez la banque de guilde.",
        placement: "bottom",
        module: "services",
    },
    {
        target: '[data-tour="services-tabs"]',
        title: "Navigation & Nouveaux Espaces",
        description: "Basculez entre la Marketplace des offres, le suivi de vos Demandes en cours, le Livre d'or des avis, les Prêts et le Coffre.",
        placement: "bottom",
        module: "services",
    },
    {
        target: '[data-tour="services-create"]',
        title: "Publier une prestation",
        description: "Proposez vos services (forgemagie, élevage, passages donjons, aide ocre...) à tous les membres de la guilde avec notification Discord automatique.",
        placement: "left",
        module: "services",
    },
    {
        target: '[data-tour="services-board"]',
        title: "Marketplace & Interaction",
        description: "Parcourez les offres disponibles, filtrez par catégorie, contactez un passeur en 1 clic ou consultez sa réputation dans le Livre d'or.",
        placement: "top",
        module: "services",
    },
    {
        target: '[data-tour="sidebar-services"]',
        title: "Accès rapide",
        description: "Retrouvez vos prestations, vos demandes et le Livre d'or à tout moment dans la barre latérale.",
        placement: "right",
        module: "services",
    },
];

const DONJONS_STEPS: TourStep[] = [
    {
        target: '[data-tour="donjons-header"]',
        title: "Donjons & Quêtes",
        description: "Cherchez des coéquipiers, ciblez des succès, et suivez votre progression.",
        placement: "bottom",
        module: "donjons",
    },
    {
        target: '[data-tour="donjons-filters"]',
        title: "Filtres",
        description: "Affinez les recherches par type de contenu ou par configuration de groupe.",
        placement: "bottom",
        module: "donjons",
    },
    {
        target: '[data-tour="donjons-list"]',
        title: "Les annonces",
        description: "Chaque annonce regroupe un donjon, les places disponibles et les participants.",
        placement: "top",
        module: "donjons",
    },
    {
        target: '[data-tour="donjons-create"]',
        title: "Créer un post",
        description: "Proposez un groupe de donjon ou de quête et invitez vos compagnons.",
        placement: "top",
        module: "donjons",
    },
    {
        target: '[data-tour="donjons-board"]',
        title: "Vue d'ensemble",
        description: "L'ensemble du tableau : filtres, annonces et création de groupes.",
        placement: "top",
        module: "donjons",
    },
    {
        target: '[data-tour="sidebar-donjons"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Outils.",
        placement: "right",
        module: "donjons",
    },
];


const CALENDAR_STEPS: TourStep[] = [
    {
        target: '[data-tour="calendar-header"]',
        title: "Calendrier des Événements",
        description: "Ne manquez aucun rendez-vous important de la vie de guilde.",
        placement: "bottom",
        module: "calendar",
    },
    {
        target: '[data-tour="calendar-view"]',
        title: "Vue Semaine / Mois",
        description: "Basculez l'affichage du calendrier entre la vue semaine et la vue mois.",
        placement: "bottom",
        module: "calendar",
    },
    {
        target: '[data-tour="calendar-events"]',
        title: "Les types d'événements",
        description: "Retrouvez les différentes catégories : événements de guilde, raids et plus.",
        placement: "bottom",
        module: "calendar",
    },
    {
        target: '[data-tour="calendar-create"]',
        title: "Créer un événement",
        description: "Planifiez un nouvel événement (si vous avez la permission de gestion).",
        placement: "top",
        module: "calendar",
    },
    {
        target: '[data-tour="calendar-board"]',
        title: "Vue d'ensemble",
        description: "Le calendrier complet de la guilde et ses prochains rendez-vous.",
        placement: "top",
        module: "calendar",
    },
    {
        target: '[data-tour="sidebar-calendar"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Informations.",
        placement: "right",
        module: "calendar",
    },
];

const SONDAGES_STEPS: TourStep[] = [
    {
        target: '[data-tour="sondages-header"]',
        title: "Sondages",
        description: "Votez et donnez votre avis sur les décisions de la guilde.",
        placement: "bottom",
        module: "polls",
    },
    {
        target: '[data-tour="sondages-create"]',
        title: "Créer un sondage",
        description: "Proposez une question à la guilde avec plusieurs options de réponse.",
        placement: "bottom",
        module: "polls",
    },
    {
        target: '[data-tour="sondages-micro"]',
        title: "Le Micro",
        description: "Prenez ou reprenez le micro pour créer un sondage : il est tenu par un seul membre à la fois.",
        placement: "bottom",
        module: "polls",
    },
    {
        target: '[data-tour="sondages-status"]',
        title: "Statut",
        description: "Filtrez les sondages par statut : en cours ou clôturés.",
        placement: "bottom",
        module: "polls",
    },
    {
        target: '[data-tour="sondages-board"]',
        title: "Les sondages",
        description: "Chaque sondage affiche la question, les options et les votes en direct.",
        placement: "top",
        module: "polls",
    },
    {
        target: '[data-tour="sidebar-polls"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Autres.",
        placement: "right",
        module: "polls",
    },
];

const ANNUAIRE_STEPS: TourStep[] = [
    {
        target: '[data-tour="annuaire-header"]',
        title: "Annuaire de Guilde",
        description: "Retrouvez les artisans et membres de votre guilde.",
        placement: "bottom",
        module: "roster",
    },
    {
        target: '[data-tour="annuaire-search"]',
        title: "Recherche",
        description: "Recherchez un membre par pseudo, métier ou classe.",
        placement: "bottom",
        module: "roster",
    },
    {
        target: '[data-tour="annuaire-filters"]',
        title: "Filtres",
        description: "Filtrez par classe, métier ou autres critères pour trouver le bon artisan.",
        placement: "bottom",
        module: "roster",
    },
    {
        target: '[data-tour="annuaire-grid"]',
        title: "Les cartes membres",
        description: "Chaque carte présente un membre, son rôle, ses métiers et sa classe.",
        placement: "top",
        module: "roster",
    },
    {
        target: '[data-tour="annuaire-board"]',
        title: "Vue d'ensemble",
        description: "L'annuaire complet de la guilde, consultable par tous les membres.",
        placement: "top",
        module: "roster",
    },
    {
        target: '[data-tour="sidebar-annuaire"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Informations.",
        placement: "right",
        module: "roster",
    },
];


const QUETESDOFUS_STEPS: TourStep[] = [
    {
        target: '[data-tour="quetes-header"]',
        title: "Quêtes Dofus",
        description: "Suivez votre progression vers chaque Dofus et comparez-vous à votre guilde.",
        placement: "bottom",
        module: "quests",
    },
    {
        target: '[data-tour="quetes-character"]',
        title: "Personnage",
        description: "Sélectionnez votre personnage principal ou vos mules pour suivre la progression.",
        placement: "bottom",
        module: "quests",
    },
    {
        target: '[data-tour="quetes-menu"]',
        title: "Le menu",
        description: "Les cartes d'accès : guides optimisés, suivi des Dofus et statistiques de la guilde.",
        placement: "top",
        module: "quests",
    },
    {
        target: '[data-tour="quetes-board"]',
        title: "Progression & guides",
        description: "Consultez votre avancée sur chaque quête et les guides pas-à-pas optimisés.",
        placement: "top",
        module: "quests",
    },
    {
        target: '[data-tour="sidebar-quetes"]',
        title: "Accès rapide",
        description: "Retrouvez le module Quêtes Dofus dans la barre latérale.",
        placement: "right",
        module: "quests",
    },
];

/**
 * Tour GUIDE — module guide plein écran (Ganymède).
 * Rejouable à tout moment (membres comme admin) via le bouton du bandeau du haut.
 * Les data-tour sont posés sur les éléments stables du module guide.
 */
const GUIDE_STEPS: TourStep[] = [
    {
        target: '[data-tour="guide-hud"]',
        title: "Le guide plein écran",
        description: "Le guide occupe tout l'écran pour rester concentré. Ce bandeau te montre la phase, le sous-guide actif et ton pourcentage.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-hud-exit"]',
        title: "Quitter le guide",
        description: "Ce bouton rouge te ramène au module Quêtes Dofus. Ta progression est conservée et tu reprends où tu en étais.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-hero-character"]',
        title: "Personnage actif",
        description: "Choisis ton personnage principal ou une mule : chacun a sa propre progression, ses jalons et sa position.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-hero-align"]',
        title: "Alignement & ordre",
        description: "Clique pour renseigner ton alignement (Bonta / Brakmar), ton ordre et ta tranche.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-hero-ocre"]',
        title: "Metamob / Ocre",
        description: "Clique pour ouvrir ta collection : Gardiens et Archis déjà en poche ou manquants, avec recherche intégrée.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-toc-btn"]',
        title: "Le sommaire",
        description: "Ouvre le sommaire (touche S) : chapitres, jalons et sous-guides. La recherche trouve n'importe quel titre et t'y amène.",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-menu-trigger"]',
        title: "Options du guide",
        description: "Toutes les actions regroupées : masquer les étapes validées, mode discret, aide, tout valider, réinitialiser…",
        placement: "bottom",
    },
    {
        target: '[data-tour="guide-footer"]',
        title: "Valider l'étape",
        description: "En bas : valider l'étape courante, marquer ta position, tout valider le guide d'un coup, ou réinitialiser ce jalon. Dans un sous-guide : bouton « Valider / Réinitialiser ce sous-guide » pour tout cocher ou décocher d'un coup.",
        placement: "top",
    },
];

const GALERIE_STEPS: TourStep[] = [
    {
        target: '[data-tour="galerie-header"]',
        title: "Galerie de Stuff",
        description: "Partagez et découvrez les équipements et tenues des membres.",
        placement: "bottom",
        module: "gallery",
    },
    {
        target: '[data-tour="galerie-search"]',
        title: "Recherche",
        description: "Recherchez un équipement ou une tenue par nom ou par mot-clé.",
        placement: "bottom",
        module: "gallery",
    },
    {
        target: '[data-tour="galerie-filters"]',
        title: "Filtres",
        description: "Filtrez par classe, type de contenu ou autre critère pour affiner la galerie.",
        placement: "bottom",
        module: "gallery",
    },
    {
        target: '[data-tour="galerie-board"]',
        title: "Les cartes",
        description: "Chaque carte présente un équipement ou une tenue proposé par un membre.",
        placement: "top",
        module: "gallery",
    },
    {
        target: '[data-tour="galerie-grid"]',
        title: "La grille",
        description: "Parcourez la galerie de builds et de tenues, triée par les membres.",
        placement: "top",
        module: "gallery",
    },
    {
        target: '[data-tour="sidebar-galerie"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Outils.",
        placement: "right",
        module: "gallery",
    },
];

const RESSOURCES_STEPS: TourStep[] = [
    {
        target: '[data-tour="ressources-header"]',
        title: "Ressources Dofus",
        description: "Hub centralisé : Almanax, actualités Ankama et outils communautaires.",
        placement: "bottom",
        module: "resources",
    },
    {
        target: '[data-tour="ressources-tabs"]',
        title: "Les onglets",
        description: "Basculez entre Almanax, Actualités, Encyclopédie, Créateurs et Liens.",
        placement: "bottom",
        module: "resources",
    },
    {
        target: '[data-tour="ressources-almanax"]',
        title: "Almanax — Hub Temporel",
        description: "Consultez les offrandes du jour et les bonus d'Almanax à venir.",
        placement: "top",
        module: "resources",
    },
    {
        target: '[data-tour="ressources-news-tab"]',
        title: "Actualités",
        description: "Suivez les nouvelles officielles d'Ankama et de Dofuspourlesnoobs depuis cet onglet.",
        placement: "bottom",
        module: "resources",
    },
    {
        target: '[data-tour="ressources-links-tab"]',
        title: "Bibliothèque de Liens",
        description: "Les liens et outils utiles (builds, simulateurs, communautés) pour la guilde.",
        placement: "bottom",
        module: "resources",
    },
    {
        target: '[data-tour="sidebar-ressources"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, section Informations.",
        placement: "right",
        module: "resources",
    },
];


const MINIJEU_STEPS: TourStep[] = [
    {
        target: '[data-tour="minijeu-header"]',
        title: "Mini-Jeux",
        description: "Sigil-Guesser & Sigil-Bomb : défiez vos alliés sur la carte du monde !",
        placement: "bottom",
        module: "minigames",
    },
    {
        target: '[data-tour="minijeu-board"]',
        title: "Les jeux",
        description: "Choisissez un mini-jeu (Géoguessr ou Bombe) et défiez la guilde.",
        placement: "top",
        module: "minigames",
    },
    {
        target: '[data-tour="sidebar-minigames"]',
        title: "Où le retrouver",
        description: "Retrouvez les Mini-Jeux dans la barre latérale, section Autres.",
        placement: "right",
        module: "minigames",
    },
];

const STATS_STEPS: TourStep[] = [
    {
        target: '[data-tour="stats-header"]',
        title: "Statistiques Guilde",
        description: "Suivez l'activité de votre guilde et de ses membres.",
        placement: "bottom",
        module: "stats",
    },
    {
        target: '[data-tour="stats-overview"]',
        title: "Indicateurs clés",
        description: "Les KPI principaux de la guilde : effectifs, activité et progression.",
        placement: "top",
        module: "stats",
    },
    {
        target: '[data-tour="stats-charts"]',
        title: "Graphiques",
        description: "L'évolution de l'activité selon les modules activés (missions, songes, services…).",
        placement: "top",
        module: "stats",
    },
    {
        target: '[data-tour="stats-board"]',
        title: "Vue d'ensemble",
        description: "L'ensemble des statistiques de la guilde sur une seule page.",
        placement: "top",
        module: "stats",
    },
    {
        target: '[data-tour="sidebar-la-guilde"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, menu « La guilde ».",
        placement: "right",
        module: "stats",
    },
];

const PRESENTATION_STEPS: TourStep[] = [
    {
        target: '[data-tour="presentation-header"]',
        title: "Présentation de la Guilde",
        description: "Informations visibles par les membres et le public.",
        placement: "bottom",
        module: "presentation",
    },
    {
        target: '[data-tour="presentation-public"]',
        title: "Page publique",
        description: "Aperçu de la page publique visible par les visiteurs et les candidats.",
        placement: "bottom",
        module: "presentation",
    },
    {
        target: '[data-tour="presentation-recrutement"]',
        title: "Recrutement",
        description: "L'état du recrutement : ouvert ou fermé, niveau et succès minimums.",
        placement: "top",
        module: "presentation",
    },
    {
        target: '[data-tour="presentation-communication"]',
        title: "Communication",
        description: "Le lien vers votre Discord et les canaux de contact de la guilde.",
        placement: "top",
        module: "presentation",
    },
    {
        target: '[data-tour="presentation-board"]',
        title: "Vue d'ensemble",
        description: "La présentation complète : histoire, équipe, recrutement et communication.",
        placement: "top",
        module: "presentation",
    },
    {
        target: '[data-tour="sidebar-la-guilde"]',
        title: "Où le retrouver",
        description: "Retrouvez ce module dans la barre latérale, menu « La guilde ».",
        placement: "right",
        module: "presentation",
    },
];

const SUCCES_STEPS: TourStep[] = [
    {
        target: '[data-tour="succes-views"]',
        title: "Navigation du Module Succès",
        description: "Sept vues complémentaires : « Mes Succès » pour cocher ta progression donjon par donjon, « Succès Commun » pour voir qui dans la guilde a validé quoi, « Fiches Boss » pour les sorts et simulations de combat, « Fiches Anomalies » pour les gardiens des anomalies temporelles (siphonnés Dofensive/DofusDB), « Fiches Titans » pour les événements krosmiques, « Quêtes & Succès » pour les quêtes associées, et « Défis » pour les événements et challenges communautaires.",
        placement: "bottom",
        module: "succes",
    },
    {
        target: '[data-tour="succes-filters"]',
        title: "Recherche et filtres",
        description: "Recherche un donjon ou un boss par nom, filtre par statut (À faire / Finis) et par tranche de niveau pour cibler rapidement tes objectifs.",
        placement: "bottom",
        module: "succes",
    },
    {
        target: '[data-tour="succes-tracker-list"]',
        title: "La liste des donjons",
        description: "Chaque donjon affiche sa progression (succès cochés / total). Clique sur un donjon pour ouvrir le détail à droite.",
        placement: "right",
        module: "succes",
    },
    {
        target: '[data-tour="succes-tracker-detail"]',
        title: "Le détail d'un donjon",
        description: "Tous les succès du donjon, avec leurs points et les guides partenaires (DPNL, Dofensive). Coche un succès pour le valider, ou utilise le bouton global « Tout cocher ».",
        placement: "left",
        module: "succes",
    },
    {
        target: '[data-tour="succes-view-defi"]',
        title: "Onglet Défis & Événements",
        description: "Découvre les défis spéciaux et événements communautaires. Valide ta participation et crée des groupes dédiés.",
        placement: "bottom",
        module: "succes",
    },
    {
        target: '[data-tour="succes-view-commun"]',
        title: "Partenaires potentiels",
        description: "Onglet « Succès Commun » : pour chaque succès que tu cherches, tu vois qui dans la guilde l'a déjà validé — contacte-les pour partir en groupe.",
        placement: "bottom",
        module: "succes",
    },
    {
        target: '[data-tour="sidebar-succes"]',
        title: "Où le retrouver",
        description: "Retrouve le module Succès dans la barre latérale (menu Progression).",
        placement: "right",
        module: "succes",
    },
];

/**
 * Tour complet du module « Marché » (D36) — étapes ancrées sur des
 * `data-tour="marche-*"` stables (jamais de sélecteur fragile), filtrées par
 * le module actif + la permission `market:trade`.
 *
 * S8.22 — ordre = parcours réel du membre : consulter, filtrer, déclarer
 * (objet + jet + **forge réelle**), publier, rouvrir sa fiche, négocier,
 * modérer (staff), retrouver ses annonces.
 */
const MARCHE_STEPS: TourStep[] = [
    {
        target: '[data-tour="marche-header"]',
        title: "Le Marché de guilde",
        description: "Publie et consulte les annonces d'équipements forgemagie et de lots de ressources entre membres. L'échange se conclut en jeu : SigilOS ne garantit pas la transaction.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
    {
        target: '[data-tour="marche-catalog"]',
        title: "Les annonces",
        description: "Chaque carte affiche l'objet, son prix, son statut (Disponible, Réservé, Vendu, Retiré) et son vendeur. Clique sur « Voir la fiche » pour le détail.",
        placement: "top",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
    {
        target: '[data-tour="marche-filters"]',
        title: "Filtrer le catalogue",
        description: "Recherche par objet ou vendeur, filtre par type et par statut, trie par prix ou par niveau, et passe en vue tableau pour une lecture dense.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
    {
        target: '[data-tour="marche-create"]',
        title: "Publier une annonce",
        description: "Choisis ton objet du catalogue (ou compose ton lot de ressources), déclare ton jet, fixe ton prix et publie en 4 étapes.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
    {
        target: '[data-tour="marche-jet"]',
        title: "L'éditeur de jet",
        description: "Les plages natives se pré-remplissent depuis le catalogue : saisis tes valeurs, clique « ✦ Jet parfait » ou ajoute un exo PA/PM/PO/invocation. Un over ou un exo est étiqueté, jamais refusé.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
        // BUG-6 — l'éditeur vit sur la page de création : on y **navigue**.
        href: "/marche/nouveau",
    },
    {
        target: '[data-tour="marche-forge"]',
        title: "La forge réelle",
        description: "Déclare l'état réel de l'objet : rune de Transcendance (qui exclut tout over/exo), élément de frappe et potion (armes), arme de chasse. « Troc accepté » ou « Kamas uniquement » se retrouve ensuite dans l'annonce.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
        href: "/marche/nouveau",
    },
    {
        target: '[data-tour="marche-publish"]',
        title: "La publication Discord",
        description: "Vérifie la destination (salon texte ou forum), choisis les rôles à mentionner (parmi ceux autorisés) et publie : l'aperçu montre exactement ce que verront les membres.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
        href: "/marche/nouveau",
    },
    {
        target: '[data-tour="marche-listing"]',
        title: "La fiche d'une annonce",
        description: "Le jet déclaré s'affiche avec les icônes officielles, le vendeur apparaît dans sa bulle profil, et les actions (réserver, faire une offre, renouveler, retirer) dépendent de ton rôle. Aucun montant d'offre n'est public.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
    {
        target: '[data-tour="marche-negotiation"]',
        title: "Négocier une offre",
        description: "Dans « Mon espace », accepte, refuse ou contre-propose une offre. Accepter réserve l'annonce et expire automatiquement les autres offres en attente ; le montant reste privé.",
        placement: "top",
        module: "marche",
        requiresPerm: "canViewMarket",
        // BUG-6 — la négociation vit dans « Mon espace » : on y **navigue**.
        href: "/marche/mes-espaces",
    },
    {
        target: '[data-tour="marche-moderation"]',
        title: "La modération (staff)",
        description: "Avec la permission de modération : traite les signalements, retire ou restaure une annonce et consulte l'historique complet de ses transitions. Chaque décision est journalisée.",
        placement: "top",
        module: "marche",
        requiresPerm: "canManageMarket",
    },
    {
        target: '[data-tour="marche-my-listings"]',
        title: "Mon espace",
        description: "Retrouve tes annonces en cours et tes archives, avec les actions de publication, de retrait et de renouvellement.",
        placement: "bottom",
        module: "marche",
        requiresPerm: "canViewMarket",
        href: "/marche/mes-espaces",
    },
    {
        target: '[data-tour="sidebar-marche"]',
        title: "Où le retrouver",
        description: "Le Marché reste accessible à tout moment depuis la barre latérale (menu Outils).",
        placement: "right",
        module: "marche",
        requiresPerm: "canViewMarket",
    },
];

export const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({
    children,
    guildId,
    modules,
    user
}: {
    children: ReactNode;
    guildId: string;
    modules?: any;
    user?: any;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [tourPhase, setTourPhase] = useState<TourPhase>(null);
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isCelebrationActive, setCelebrationActive] = useState<boolean>(false);

    const isAdmin = !!user?.isAdmin;
    const isOnboardingComplete = !!user?.isOnboardingComplete;
    // Séquence première arrivée : le tour auto des modules attend que la
    // modale de bienvenue ait été vue/fermée (sinon tour + modale s'empilent,
    // même niveau z-120). `hasSeenWelcome` vient du contexte (profil).
    const hasSeenWelcome = !!user?.hasSeenWelcome;
    // Flag serveur : true uniquement pour le TOUT PREMIER admin (non-God) de la guilde,
    // posé de façon atomique côté serveur (user-actions.ts). Un God ne reçoit jamais ce flag.
    const isFirstAdminForGuild = !!user?.isFirstAdminForGuild;
    const isSuperAdmin = !!user?.isSuperAdmin;

    // Filtre les steps selon modules actifs + permissions RBAC admin + mode vitrine
    const applyFilters = (steps: TourStep[]) => steps.filter(step => {
        if (step.module && modules && !modules[step.module]) {
            // Cas particulier : availability peut être couvert par calendar
            if (step.module === "availability" && modules.calendar) {
                // keep
            } else {
                return false;
            }
        }
        if (step.requiresPerm && user && user[step.requiresPerm] === false) return false;
        // Si le mode vitrine des missions est activé (missionVitrineMode), masquer Présence & Feed
        if (step.target === '[data-tour="profile-tab-activity"]' && (user?.missionVitrineMode || (modules && !modules.missions))) {
            return false;
        }
        return true;
    });

    const profileSteps = applyFilters(PROFILE_STEPS);
    const adminOnboardingSteps = applyFilters(ADMIN_ONBOARDING_STEPS);
    const adminModulesSteps = applyFilters(ADMIN_MODULES_STEPS);
    const dashboardSteps = applyFilters(DASHBOARD_STEPS);
    const dashboardBricksSteps = applyFilters(DASHBOARD_BRICKS_STEPS);
    const adminSettingsSteps = applyFilters(ADMIN_SETTINGS_STEPS);
    const adminPermissionsSteps = applyFilters(ADMIN_PERMISSIONS_STEPS);
    const adminModulesMgmtSteps = applyFilters(ADMIN_MODULES_MGMT_STEPS);
    const adminPresentationSteps = applyFilters(ADMIN_PRESENTATION_STEPS);
    const adminMissionsSteps = applyFilters(ADMIN_MISSIONS_STEPS);
    const adminValidationSteps = applyFilters(ADMIN_VALIDATION_STEPS);
    const adminMembersSteps = applyFilters(ADMIN_MEMBERS_STEPS);
    const adminLogsSteps = applyFilters(ADMIN_LOGS_STEPS);
    const adminOverviewSteps = applyFilters(ADMIN_OVERVIEW_STEPS);
    const missionsSteps = applyFilters(MISSIONS_STEPS);
    const ladderSteps = applyFilters(LADDER_STEPS);
    const songesSteps = applyFilters(SONGES_STEPS);
    const ocreSteps = applyFilters(OCRE_STEPS);
    const servicesSteps = applyFilters(SERVICES_STEPS);
    const donjonsSteps = applyFilters(DONJONS_STEPS);
    const calendarSteps = applyFilters(CALENDAR_STEPS);
    const sondagesSteps = applyFilters(SONDAGES_STEPS);
    const annuaireSteps = applyFilters(ANNUAIRE_STEPS);
    const quetesDofusSteps = applyFilters(QUETESDOFUS_STEPS);
    const guideSteps = applyFilters(GUIDE_STEPS);
    const galerieSteps = applyFilters(GALERIE_STEPS);
    const ressourcesSteps = applyFilters(RESSOURCES_STEPS);
    const minijeuSteps = applyFilters(MINIJEU_STEPS);
    const statsSteps = applyFilters(STATS_STEPS);
    const presentationSteps = applyFilters(PRESENTATION_STEPS);
    const succesSteps = applyFilters(SUCCES_STEPS);
    const marcheSteps = applyFilters(MARCHE_STEPS);

    const getPhaseSteps = (phase: TourPhase): TourStep[] => {
        switch (phase) {
            case "profile": return profileSteps;
            case "dashboard": return dashboardSteps;
            case "dashboardBricks": return dashboardBricksSteps;
            case "admin": return adminOnboardingSteps;
            case "adminModules": return adminModulesSteps;
            case "adminSettings": return adminSettingsSteps;
            case "adminPermissions": return adminPermissionsSteps;
            case "adminModulesMgmt": return adminModulesMgmtSteps;
            case "adminPresentation": return adminPresentationSteps;
            case "adminMissions": return adminMissionsSteps;
            case "adminValidation": return adminValidationSteps;
            case "adminMembers": return adminMembersSteps;
            case "adminLogs": return adminLogsSteps;
            case "adminOverview": return adminOverviewSteps;
            case "missions": return missionsSteps;
            case "ladder": return ladderSteps;
            case "songes": return songesSteps;
            case "ocre": return ocreSteps;
            case "services": return servicesSteps;
            case "donjons": return donjonsSteps;
            case "calendar": return calendarSteps;
            case "sondages": return sondagesSteps;
            case "annuaire": return annuaireSteps;
            case "quetesDofus": return quetesDofusSteps;
            case "guide": return guideSteps;
            case "galerie": return galerieSteps;
            case "ressources": return ressourcesSteps;
            case "minijeu": return minijeuSteps;
            case "stats": return statsSteps;
            case "presentation": return presentationSteps;
            case "succes": return succesSteps;
            case "marche": return marcheSteps;
            default: return [];
        }
    };

    const steps = getPhaseSteps(tourPhase);
    const totalSteps = steps.length;
    const activeStepData = steps[currentStep - 1] || null;

    // Auto-open sections in sidebar based on current target step
    const ensureSidebarSectionOpen = (targetSelector: string) => {
        if (typeof document === "undefined") return;
        if (targetSelector.includes("sidebar-missions") || targetSelector.includes("sidebar-ladder") || targetSelector.includes("sidebar-songes") || targetSelector.includes("sidebar-ocre") || targetSelector.includes("sidebar-quetes")) {
            const btn = document.querySelector('[data-tour-section="progression"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
        } else if (targetSelector.includes("sidebar-members") || targetSelector.includes("sidebar-calendar") || targetSelector.includes("sidebar-services") || targetSelector.includes("sidebar-annuaire") || targetSelector.includes("sidebar-ressources") || targetSelector.includes("sidebar-la-guilde")) {
            const btn = document.querySelector('[data-tour-section="informations"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
        } else if (targetSelector.includes("sidebar-polls") || targetSelector.includes("sidebar-minigames")) {
            const btn = document.querySelector('[data-tour-section-guess="others"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
        }
    };

    useEffect(() => {
        if (isActive && activeStepData) ensureSidebarSectionOpen(activeStepData.target);
    }, [isActive, activeStepData]);

    // --- AUTO-START du tour ADMIN sur le Dashboard (1ère arrivée) ---
    // Admin connecté sur son Dashboard (guilde déjà configurée) :
    // on pop UNE FOIS le tour des modules (adminModules) — filtre RBAC + modules.
    // Le tour reste rejouable à tout moment via le bouton « Revoir » (startTour).
    useEffect(() => {
        if (!isAdmin || typeof window === "undefined") return;
        // 🔒 Le tour des modules ne pop que pour le TOUT PREMIER admin (non-God) de la guilde.
        // Un God/super-admin ne reçoit JAMAIS le tour (isFirstAdminForGuild=false pour lui),
        // et un admin d'une guilde déjà visitée (firstAdminViewAt posé) non plus.
        if (!isFirstAdminForGuild) return;
        // Garde de sécurité : exclure explicitement un God/super-admin.
        if (isSuperAdmin) return;
        // Guilde pas encore configurée → redirection gérée par la page dashboard
        if (!isOnboardingComplete) return;
        // Bienvenue pas encore vue → elle pop en finale sur l'accueil ; le tour
        // attend le prochain passage (la clé `seen` n'est posée qu'au démarrage
        // effectif ci-dessous, donc pas de perte).
        if (!hasSeenWelcome) return;
        // On ne pop que sur le Dashboard admin (pas sur les sous-pages)
        if (pathname !== `/dashboard/${guildId}`) return;

        const seenKey = `sigilos-tour-admin-modules-seen-${guildId}`;
        const hasSeen = localStorage.getItem(seenKey) === "true";
        if (hasSeen) return;

        // Marque comme "vu" pour ne pas re-pop à chaque navigation vers le Dashboard
        localStorage.setItem(seenKey, "true");
        const phase: TourPhase = "adminModules";
        setTourPhase(phase);
        setCurrentStep(1);
        setIsActive(true);
        localStorage.setItem(`sigilos-tour-phase-${guildId}`, phase);
        localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
    }, [isAdmin, isOnboardingComplete, hasSeenWelcome, pathname, guildId]);

    // Load member tour state (profile/dashboard)
    useEffect(() => {
        // Tour rejouable (module / admin / dashboardBricks) lancé via startTour :
        // ne pas fermer ni réinitialiser lors d'un changement de route.
        if (tourPhase && isReplayableTourPhase(tourPhase)) {
            return;
        }
        if (!isAdmin || isOnboardingComplete) {
            const hasDoneTour = localStorage.getItem(`sigilos-tour-done-${guildId}`) === "true";
            if (hasDoneTour) {
                setIsActive(false);
                return;
            }
        }

        const tourParam = searchParams.get("tour");
        const storedPhase = localStorage.getItem(`sigilos-tour-phase-${guildId}`) as TourPhase;
        const storedStep = parseInt(localStorage.getItem(`sigilos-tour-step-${guildId}`) || "1", 10);

        if (tourParam === "1" || (storedPhase === "profile" && pathname.includes("/profile"))) {
            setTourPhase("profile");
            setCurrentStep(tourParam === "1" ? 1 : storedStep);
            setIsActive(true);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "profile");
        } else if (tourParam === "2" || (storedPhase === "dashboard" && pathname === `/dashboard/${guildId}`)) {
            setTourPhase("dashboard");
            setCurrentStep(tourParam === "2" ? 1 : storedStep);
            setIsActive(true);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "dashboard");
        }
    }, [searchParams, pathname, guildId, isAdmin, isOnboardingComplete]);

    // Save step to localStorage
    useEffect(() => {
        if (isActive && tourPhase) {
            localStorage.setItem(`sigilos-tour-step-${guildId}`, currentStep.toString());
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, tourPhase);
        }
    }, [currentStep, tourPhase, isActive, guildId]);

    const startTour = (phase: TourPhase) => {
        if (!phase) return;
        setTourPhase(phase);
        setCurrentStep(1);
        setIsActive(true);
        // Les tours admin sont REJOUABLES : on ne pose jamais de flag "done"
        // définitif pour les phases admin. On nettoie simplement l'étape en cours.
        const isAdminPhase = isReplayableTourPhase(phase);
        if (!isAdminPhase) {
            localStorage.removeItem(`sigilos-tour-done-${guildId}`);
        }
        localStorage.setItem(`sigilos-tour-phase-${guildId}`, phase);
        localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
        // Routage vers la page correspondant à la phase du tour
        switch (phase) {
            case "admin":
                router.push(`/dashboard/${guildId}/admin/getting-started`);
                break;
            case "adminModules":
            case "dashboard":
            case "dashboardBricks":
                router.push(`/dashboard/${guildId}${phase === "dashboard" ? "?tour=2" : ""}`);
                break;
            case "profile":
                router.push(`/dashboard/${guildId}/profile?tour=1`);
                break;
            case "adminSettings":
                router.push(`/dashboard/${guildId}/admin/settings`);
                break;
            case "adminPermissions":
                router.push(`/dashboard/${guildId}/admin/permissions`);
                break;
            case "adminModulesMgmt":
                router.push(`/dashboard/${guildId}/admin/modules`);
                break;
            case "adminPresentation":
                router.push(`/dashboard/${guildId}/admin/presentation`);
                break;
            case "adminMissions":
                router.push(`/dashboard/${guildId}/missions/manage`);
                break;
            case "adminValidation":
                router.push(`/dashboard/${guildId}/admin/validation`);
                break;
            case "adminMembers":
                router.push(`/dashboard/${guildId}/admin/members`);
                break;
            case "adminLogs":
                router.push(`/dashboard/${guildId}/admin/logs`);
                break;
            case "adminOverview":
                router.push(`/dashboard/${guildId}/admin`);
                break;
            case "missions":
                router.push(`/dashboard/${guildId}/missions`);
                break;
            case "ladder":
                router.push(`/dashboard/${guildId}/ladder`);
                break;
            case "songes":
                router.push(`/dashboard/${guildId}/songes`);
                break;
            case "ocre":
                router.push(`/dashboard/${guildId}/quete-ocre`);
                break;
            case "services":
                router.push(`/dashboard/${guildId}/services`);
                break;
            case "donjons":
                router.push(`/dashboard/${guildId}/donjons-et-quetes`);
                break;
            case "calendar":
                router.push(`/dashboard/${guildId}/calendar`);
                break;
            case "sondages":
                router.push(`/dashboard/${guildId}/sondages`);
                break;
            case "annuaire":
                router.push(`/dashboard/${guildId}/members`);
                break;
            case "quetesDofus":
                router.push(`/dashboard/${guildId}/quetes-dofus`);
                break;
            case "galerie":
                router.push(`/dashboard/${guildId}/galerie-stuff`);
                break;
            case "ressources":
                router.push(`/dashboard/${guildId}/ressources`);
                break;
            case "minijeu":
                router.push(`/dashboard/${guildId}/mini-jeux`);
                break;
            case "stats":
                router.push(`/dashboard/${guildId}/stats`);
                break;
            case "presentation":
                router.push(`/dashboard/${guildId}/presentation`);
                break;
            case "guide":
                // Déjà sur la page du guide (le tour se lance depuis le module).
                break;
            case "succes":
                router.push(`/dashboard/${guildId}/succes`);
                break;
            case "marche":
                router.push(`/dashboard/${guildId}/marche`);
                break;
            default:
                break;
        }
    };

    const stableAdvance = (current: number, total: number) => {
        if (current < total) return current + 1;
        return current;
    };

    const advance = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(prev => stableAdvance(prev, totalSteps));
            return;
        }
        // Toute phase admin (onboarding, modules, module dédié) → terminer
        // La phase dashboardBricks est aussi non-bloquante et rejouable → terminer également
        if (isReplayableTourPhase(tourPhase)) {
            completeTour();
        } else if (tourPhase === "profile") {
            setTourPhase("dashboard");
            setCurrentStep(1);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "dashboard");
            localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
            router.push(`/dashboard/${guildId}?tour=2`);
        } else if (tourPhase === "dashboard") {
            completeTour();
        }
    };

    const back = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
            return;
        }
        if (isReplayableTourPhase(tourPhase)) {
            return;
        } else if (tourPhase === "dashboard") {
            setTourPhase("profile");
            setCurrentStep(PROFILE_STEPS.length);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "profile");
            localStorage.setItem(`sigilos-tour-step-${guildId}`, PROFILE_STEPS.length.toString());
            router.push(`/dashboard/${guildId}/profile?tour=1`);
        }
    };

    const completeTour = () => {
        setIsActive(false);
        // IMPORTANT : on ne nulle PAS tourPhase ici — TourCompletion en a besoin
        // pour afficher le bon écran de fin (admin vs membre). setIsActive(false)
        // masque déjà le TourOverlay.
        // Les tours admin sont rejouables : on mémorise uniquement la progression
        // (pas de flag "done" définitif) pour relancer l'auto-start à la prochaine visite
        // si l'admin ne l'a pas terminé. Le bouton "Revoir" permet de relancer à tout moment.
        if (!tourPhase || !isReplayableTourPhase(tourPhase)) {
            localStorage.setItem(`sigilos-tour-done-${guildId}`, "true");
        }
        localStorage.removeItem(`sigilos-tour-step-${guildId}`);
        setCelebrationActive(true);
    };

    /**
     * BUG-7 — sortie de secours du tutoriel : on masque la bulle et on nettoie la
     * progression, **sans** écran de célébration (passer n'est pas terminer).
     *
     * Pour les tours non rejouables (profil / dashboard), on pose le flag `done`
     * exactement comme `completeTour` : sans ça, l'auto-start relancerait le tour
     * à la visite suivante et l'utilisateur « passerait » en boucle.
     */
    const skipTour = useCallback(() => {
        setIsActive(false);
        if (!tourPhase || !isReplayableTourPhase(tourPhase)) {
            localStorage.setItem(`sigilos-tour-done-${guildId}`, "true");
        }
        localStorage.removeItem(`sigilos-tour-step-${guildId}`);
    }, [guildId, tourPhase]);

    // Le tour du guide (plein écran) ne doit JAMAIS « fuir » sur une autre page :
    // dès qu'on quitte la route du guide alors qu'il est actif, on l'arrête
    // silencieusement (sans écran de célébration — ce n'est pas une fin de tour).
    useEffect(() => {
        if (tourPhase === "guide" && isActive && !pathname.includes("/quetes-dofus/guide/")) {
            setIsActive(false);
            localStorage.removeItem(`sigilos-tour-step-${guildId}`);
        }
    }, [pathname, tourPhase, isActive, guildId]);

    /**
     * BUG-6 — navigation d'étape : le chemin est **relatif au tableau de bord**
     * (`/marche/nouveau`, …) et doit rester dans **cette** guilde.
     *
     * 🔒 Allowlist stricte : caractères autorisés, refus de `//`, `..`, `:` et de
     * tout préfixe absolu ⇒ jamais une redirection ouverte, même si un `href`
     * venait un jour d'une donnée non fiable.
     *
     * `useCallback` : l'identité reste **stable**, sinon l'effet de l'overlay se
     * relancerait à chaque rendu du provider (et relancerait une navigation).
     */
    const requestStepNavigation = useCallback(
        (relativeHref: string) => {
            if (!relativeHref.startsWith("/") || relativeHref.startsWith("//")) return;
            if (relativeHref.includes("..") || relativeHref.includes(":")) return;
            if (!/^\/[A-Za-z0-9/_-]*$/.test(relativeHref)) return;
            router.push(`/dashboard/${guildId}${relativeHref}`);
        },
        [guildId, router]
    );

    return (
        <TourContext.Provider
            value={{
                tourPhase,
                currentStep,
                totalSteps,
                isActive,
                activeStepData,
                advance,
                back,
                completeTour,
                skipTour,
                startTour,
                isCelebrationActive,
                setCelebrationActive,
                requestStepNavigation
            }}
        >
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (context === undefined) {
        throw new Error("useTour must be used within a TourProvider");
    }
    return context;
}