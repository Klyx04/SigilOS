"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
    startTour: (phase: TourPhase) => void;
    isCelebrationActive: boolean;
    setCelebrationActive: (active: boolean) => void;
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
        target: '[data-tour="profile-tab-metiers"]',
        title: "Tes métiers",
        description: "Indique tes métiers actifs pour que la guilde sache à qui s'adresser pour des crafts.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-planning"]',
        title: "Tes disponibilités",
        description: "Renseigne tes créneaux horaires pour faciliter l'organisation de runs de donjons ou de songes.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-combat"]',
        title: "Tes builds",
        description: "Ajoute tes liens Dofusbook ou DofusCreator pour partager tes équipements et ta progression.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-intro"]',
        title: "Présente-toi",
        description: "Écris quelques mots sur toi pour que les autres membres de la guilde apprennent à te connaître.",
        placement: "right"
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
        target: '[data-tour="sidebar-dashboard"]',
        title: "Accueil",
        description: "Retrouve ici ton résumé d'activité, les actualités et les dernières news de la guilde.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-missions"]',
        title: "Missions de guilde",
        description: "Consulte les missions disponibles, soumets tes captures et gagne des points d'XP pour faire progresser la guilde.",
        placement: "right",
        module: "missions"
    },
    {
        target: '[data-tour="sidebar-ladder"]',
        title: "Ladder des succès",
        description: "Suis ton score de succès Dofus, synchronisé automatiquement depuis le site officiel Ankama.",
        placement: "right",
        module: "ladder"
    },
    {
        target: '[data-tour="sidebar-members"]',
        title: "Annuaire",
        description: "Explore les profils de tes camarades de guilde, leurs métiers et leurs personnages.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-calendar"]',
        title: "Calendrier",
        description: "Inscris-toi aux événements, sorties et runs organisés par le staff.",
        placement: "right",
        module: "calendar"
    }
];

/**
 * Tour DASHBOARD — visite des briques/widgets de la page d'accueil.
 * Rejouable à tout moment via le bouton « Revoir le tour » (DashboardAdminTourButton).
 * Cible les sections stables de la page dashboard (data-tour="dash-*").
 */
const DASHBOARD_BRICKS_STEPS: TourStep[] = [
    {
        target: '[data-tour="dash-stats"]',
        title: "Vue d'ensemble",
        description: "Les indicateurs clés de la guilde : membres en ligne, progression Dofus, événements et actualité du haut du classement.",
        placement: "bottom"
    },
    {
        target: '[data-tour="dash-events"]',
        title: "Événements à venir",
        description: "Les sorties, raids et événements planifiés. Inscris-toi pour ne rien manquer.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-polls"]',
        title: "Sondages",
        description: "Donne ton avis sur les décisions de la guilde via les sondages actifs.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-groups"]',
        title: "Groupes & Quêtes",
        description: "Rejoins des groupes pour les donjons et les quêtes, ou crée le tien.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-gallery"]',
        title: "Galerie Stuffs",
        description: "Les derniers équipements partagés par les membres. Inspire-toi ou partage le tien.",
        placement: "top"
    },
    {
        target: '[data-tour="dash-almanax"]',
        title: "Almanax",
        description: "Le don du jour de l'Almanax et son bonus associé, mis à jour quotidiennement.",
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
        requiresPerm: "isDiscordAdmin"
    },
    {
        target: '[data-tour="admin-permissions-matrix"]',
        title: "Matrice RBAC",
        description: "Attribuez des permissions aux rôles Discord pour contrôler l'accès au Dashboard.",
        placement: "top",
        requiresPerm: "isDiscordAdmin"
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
        title: "Centre Admin — Supervision",
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
        description: "Le cœur de la sécurité : mappe les rôles Discord de ton serveur aux permissions SigilOS. Chaque rôle contrôle l'accès à tel ou tel module. Accessible uniquement aux admins Discord.",
        placement: "right",
        requiresPerm: "isDiscordAdmin"
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
];


const SERVICES_STEPS: TourStep[] = [
    {
        target: '[data-tour="services-header"]',
        title: "Services & Artisans",
        description: "Commandez des services, empruntez du kamas et gérez la banque de guilde.",
        placement: "bottom",
        module: "services",
    },
    {
        target: '[data-tour="services-summary"]',
        title: "Résumé",
        description: "Les compteurs et accès rapides de la page : services, prêts et banque de guilde.",
        placement: "bottom",
        module: "services",
    },
    {
        target: '[data-tour="services-tabs"]',
        title: "Les onglets",
        description: "Basculez entre les sections : Services, Prêts, Banque de guilde et plus selon la configuration.",
        placement: "bottom",
        module: "services",
    },
    {
        target: '[data-tour="services-create"]',
        title: "Publier une offre",
        description: "Proposez un service (craft, passage, FM) aux autres membres de la guilde.",
        placement: "left",
        module: "services",
    },
    {
        target: '[data-tour="services-board"]',
        title: "Le contenu de la section",
        description: "Consultez les offres publiées et les demandes selon l'onglet actif.",
        placement: "top",
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
];

const TourContext = createContext<TourContextType | undefined>(undefined);

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
    // Flag serveur : true uniquement pour le TOUT PREMIER admin (non-God) de la guilde,
    // posé de façon atomique côté serveur (user-actions.ts). Un God ne reçoit jamais ce flag.
    const isFirstAdminForGuild = !!user?.isFirstAdminForGuild;
    const isSuperAdmin = !!user?.isSuperAdmin;

    // Filtre les steps selon modules actifs + permissions RBAC admin
    const applyFilters = (steps: TourStep[]) => steps.filter(step => {
        if (step.module && modules && !modules[step.module]) return false;
        if (step.requiresPerm && user && user[step.requiresPerm] === false) return false;
        return true;
    });

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

    const getPhaseSteps = (phase: TourPhase): TourStep[] => {
        switch (phase) {
            case "profile": return PROFILE_STEPS;
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
            default: return [];
        }
    };

    const steps = getPhaseSteps(tourPhase);
    const totalSteps = steps.length;
    const activeStepData = steps[currentStep - 1] || null;

    // Auto-open sections in sidebar based on current target step
    const ensureSidebarSectionOpen = (targetSelector: string) => {
        if (typeof document === "undefined") return;
        if (targetSelector.includes("sidebar-missions") || targetSelector.includes("sidebar-ladder") || targetSelector.includes("sidebar-songes") || targetSelector.includes("sidebar-ocre")) {
            const btn = document.querySelector('[data-tour-section="progression"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
        } else if (targetSelector.includes("sidebar-members") || targetSelector.includes("sidebar-calendar") || targetSelector.includes("sidebar-services")) {
            const btn = document.querySelector('[data-tour-section="informations"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
        } else if (targetSelector.includes("sidebar-polls")) {
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
    }, [isAdmin, isOnboardingComplete, pathname, guildId]);

    // Load member tour state (profile/dashboard)
    useEffect(() => {
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
                startTour,
                isCelebrationActive,
                setCelebrationActive
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