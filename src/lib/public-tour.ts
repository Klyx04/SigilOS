/**
 * Tours PUBLICS — règles pures des deux visites guidées du site public :
 *
 *  1. `visitorSpace` — première arrivée dans l'espace visiteur (une seule fois par
 *     navigateur, rejouable depuis Réglages) ;
 *  2. `rushPublic` — visite complète du guide Rush Sylvestre, **connecté ou non** :
 *     le tronc commun décrit les briques du guide, les étapes `visitor` ajoutent ce
 *     qu'un compte apporte (Metamob, Rush Live), l'étape `anonymous` termine sur
 *     l'invitation à créer un profil.
 *
 * Aucun JSX ici : le provider (`src/components/tour/tour-provider.tsx`) consomme ces
 * listes, et `tests/unit/public-tour.test.ts` vérifie que chaque cible `data-tour`
 * existe réellement dans la surface qu'elle vise (aucun pointeur mort).
 */

export type PublicTourPlacement = "top" | "bottom" | "left" | "right";

/** `visitor` = réservée aux comptes ; `anonymous` = réservée aux visiteurs sans profil. */
export type PublicTourAudience = "all" | "visitor" | "anonymous";

export interface PublicTourStep {
    target: string;
    title: string;
    description: string;
    placement: PublicTourPlacement;
    audience?: PublicTourAudience;
}

/** Drapeau de la visite de première arrivée (navigateur, jamais le serveur). */
export const VISITOR_TOUR_STORAGE_KEY = "sigilos:visitor-tour-seen";
/** Paramètre de rejeu explicite : `/espace-visiteur/general?tour=1`. */
export const VISITOR_TOUR_QUERY_PARAM = "tour";
export const VISITOR_TOUR_QUERY_VALUE = "1";

/**
 * La visite de l'espace visiteur s'ouvre **une seule fois** par navigateur.
 * Le paramètre `?tour=1` la rejoue à la demande (bouton « Revoir le tour »).
 */
export function shouldAutoStartVisitorTour(
    stored: string | null,
    requested: string | null
): boolean {
    if (requested === VISITOR_TOUR_QUERY_VALUE) return true;
    return stored !== "1";
}

/** Filtre d'audience : un anonyme ne voit jamais une étape `visitor`, et inversement. */
export function filterPublicTourSteps(
    steps: readonly PublicTourStep[],
    audience: { connected: boolean }
): PublicTourStep[] {
    return steps.filter((step) => {
        if (!step.audience || step.audience === "all") return true;
        return step.audience === "visitor" ? audience.connected : !audience.connected;
    });
}

function target(name: string): string {
    return `[data-tour="${name}"]`;
}

type Locale = "fr" | "en";

/**
 * Visite du guide Rush Sylvestre.
 *
 * L'ordre suit la lecture réelle de la page : bandeau → tuiles → outils →
 * progression → par Dofus → chapitres → rail des donjons. Les deux étapes
 * `visitor` s'insèrent après l'alignement (là où vivent les tuiles du compte) ;
 * l'invitation au profil ferme la visite d'un anonyme.
 */
export function buildRushPublicSteps({
    connected,
    locale = "fr",
}: {
    connected: boolean;
    locale?: Locale;
}): PublicTourStep[] {
    const fr = locale !== "en";

    const steps: PublicTourStep[] = [
        {
            target: target("rush-public-hero"),
            title: fr ? "Bienvenue dans le guide" : "Welcome to the guide",
            description: fr
                ? "Tout le rush Sylvestre est ici : les chapitres dans l'ordre, les trajets /travel, les prérequis, les donjons et les ressources. La lecture est libre, même sans compte."
                : "The whole Sylvan Rush lives here: chapters in order, /travel routes, prerequisites, dungeons and resources. Reading is free, even without an account.",
            placement: "bottom",
        },
        {
            target: target("rush-public-character"),
            title: fr ? "Ton personnage" : "Your character",
            description: connected
                ? fr
                    ? "Ton personnage de compte est déjà là. Tu peux changer de personnage ou passer sur une mule : la progression suit celui qui est actif."
                    : "Your account character is already here. Switch character or mule: progress follows the active one."
                : fr
                    ? "Choisis ta classe ici. La progression reste dans ce navigateur tant que tu n'as pas de profil visiteur."
                    : "Pick your class here. Progress stays in this browser until you create a visitor profile.",
            placement: "bottom",
        },
        {
            target: target("rush-public-alignment"),
            title: fr ? "Ton alignement" : "Your alignment",
            description: fr
                ? "Bontarien, Neutre ou Brâkmarien : la cité pilote la route des quêtes. Tu peux la changer à tout moment, elle ne bloque jamais la lecture."
                : "Bontarian, Neutral or Brakmarian: the city drives the quest route. Change it any time; it never blocks reading.",
            placement: "bottom",
        },
        {
            target: target("rush-public-overlay"),
            title: fr ? "L'overlay en jeu" : "The in-game overlay",
            description: fr
                ? "Ouvre la mini-fenêtre toujours au premier plan : tu coches tes étapes par-dessus Dofus, sans alt-tab. Elle lit la même progression que cette page."
                : "Open the always-on-top mini-window: tick your steps over Dofus without alt-tabbing. It reads the same progress as this page.",
            placement: "bottom",
        },
        {
            target: target("rush-public-search"),
            title: fr ? "Rechercher une quête" : "Search a quest",
            description: fr
                ? "Tape un nom de quête, un monstre ou un donjon : le guide filtre tous les chapitres, pas seulement celui qui est ouvert."
                : "Type a quest, monster or dungeon name: the guide searches every chapter, not only the open one.",
            placement: "bottom",
        },
        {
            target: target("rush-public-options"),
            title: fr ? "Options" : "Options",
            description: fr
                ? "Densité (masquer les étapes faites), accueil de première arrivée, ma cité, export/import de la progression locale et visite guidée."
                : "Density (hide completed steps), first-arrival welcome, my city, local progress export/import and the guided tour.",
            placement: "bottom",
        },
        {
            target: target("rush-public-progress"),
            title: fr ? "Ta progression" : "Your progress",
            description: fr
                ? "Une seule barre : le pourcentage et les étapes validées. La remise à zéro demande une confirmation, elle n'efface jamais par accident."
                : "One bar only: percentage and completed steps. Resetting asks for confirmation, so nothing is erased by accident.",
            placement: "bottom",
        },
        {
            target: target("rush-public-dofus-progress"),
            title: fr ? "Ta progression par Dofus" : "Your progress per Dofus",
            description: connected
                ? fr
                    ? "Chaque Dofus ouvre sa fiche : quêtes validées, en cours, à faire. L'Ocre y montre deux mesures (blocs et captures Metamob) et l'onglet Communauté lit ton serveur."
                    : "Each Dofus opens its detail: completed, in-progress and remaining quests. Ocre shows two measures (blocks and Metamob captures) and the Community tab reads your server."
                : fr
                    ? "Chaque Dofus ouvre sa fiche : quêtes validées, en cours, à faire. L'Ocre y montre deux mesures, blocs du guide et captures Metamob."
                    : "Each Dofus opens its detail: completed, in-progress and remaining quests. Ocre shows two measures: guide blocks and Metamob captures.",
            placement: "bottom",
        },
        {
            target: target("rush-public-chapters"),
            title: fr ? "Le détail, chapitre par chapitre" : "The detail, chapter by chapter",
            description: fr
                ? "Chaque bloc se déplie : quêtes, étapes, tags, donjons et ressources. La flèche replie le bloc ouvert sans quitter la page."
                : "Each block expands: quests, steps, tags, dungeons and resources. The arrow collapses the open block without leaving the page.",
            placement: "bottom",
        },
        {
            target: target("rush-public-block"),
            title: fr ? "Un bloc de quêtes" : "A quest block",
            description: fr
                ? "Coche une étape : la progression, les ressources restantes et les donjons requis se recalculent tout de suite. Un donjon non fait bloque la validation, jamais le repère « j'en suis là »."
                : "Tick a step: progress, remaining resources and required dungeons update immediately. An unfinished dungeon blocks validation, never the 'I am here' marker.",
            placement: "bottom",
        },
        {
            target: target("rush-public-dungeons"),
            title: fr ? "Donjons et métiers à prévoir" : "Dungeons and professions to plan",
            description: fr
                ? "Le rail de droite liste les donjons requis et les métiers : coche-les pour débloquer la validation des quêtes concernées."
                : "The right rail lists required dungeons and professions: tick them to unlock validation of the related quests.",
            placement: "left",
        },
        {
            target: target("rush-public-resources"),
            title: fr ? "Ressources à prévoir" : "Resources to prepare",
            description: fr
                ? "La liste se recalcule à partir de tes étapes validées et de tes coches manuelles : rien à recopier dans un tableur."
                : "The list recomputes from your completed steps and manual checks: nothing to copy into a spreadsheet.",
            placement: "bottom",
        },
    ];

    if (connected) {
        // Insérées après l'alignement : ce sont des tuiles du compte, au même endroit.
        steps.splice(
            3,
            0,
            {
                target: target("rush-public-metamob"),
                title: fr ? "Metamob" : "Metamob",
                description: fr
                    ? "Ton pseudo Metamob et sa vérification : les captures d'Archimonstres alimentent la progression Ocre. Une clé refusée ne remplace jamais celle qui marchait."
                    : "Your Metamob nickname and its verification: Archimonster captures feed Ocre progress. A rejected key never replaces the one that worked.",
                placement: "bottom",
                audience: "visitor",
            },
            {
                target: target("rush-public-rush-live"),
                title: fr ? "Rush Live" : "Rush Live",
                description: fr
                    ? "Les visiteurs de ton serveur qui sont en ligne. Tu n'apparais que si tu as donné ton consentement dans Réglages — être vu est un choix."
                    : "Visitors from your server who are online. You only appear if you consented in Settings — being seen is a choice.",
                placement: "bottom",
                audience: "visitor",
            }
        );
    } else {
        steps.push({
            target: target("rush-public-cta"),
            title: fr ? "Créer ton profil visiteur" : "Create your visitor profile",
            description: fr
                ? "Facultatif : il sauvegarde ta progression d'un appareil à l'autre, débloque la vue Communauté de ton serveur, le Rush Live et le suivi Metamob."
                : "Optional: it saves your progress across devices and unlocks your server's Community view, Rush Live and Metamob tracking.",
            placement: "bottom",
            audience: "anonymous",
        });
    }

    return filterPublicTourSteps(steps, { connected });
}

/**
 * Visite de première arrivée dans l'espace visiteur.
 *
 * Elle reste sur `/espace-visiteur/general` : les neuf premiers pas décrivent la
 * navigation (commune à toutes les pages), les deux derniers les panneaux de la
 * page Général. Aucune cible conditionnelle (l'Ocre n'apparaît qu'avec une clé
 * Metamob) : la visite ne saute donc jamais une étape par absence d'ancre.
 */
export function buildVisitorSpaceSteps(): PublicTourStep[] {
    return [
        {
            target: target("visitor-nav"),
            title: "Ton espace visiteur",
            description:
                "Huit onglets, un par section. Chacun a sa propre adresse : le retour arrière, les favoris et les liens partagés fonctionnent.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-general"),
            title: "Général",
            description:
                "Ton identité Dofus, ton serveur, ta classe et ta guilde déclarée. C'est la seule page qui accepte un profil encore vide.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-notifications"),
            title: "Notifications",
            description:
                "Les réponses à tes signalements, le changelog et les news. La pastille compte les non-lues.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-mules"),
            title: "Mules",
            description:
                "Ajoute tes mules : elles apparaissent dans le guide et dans la vue Communauté de ton serveur.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-presentation"),
            title: "Présentation",
            description:
                "Ce que les autres visiteurs lisent de toi : un texte libre, jamais d'image de guilde.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-succes"),
            title: "Succès",
            description:
                "Boss, titans et avis : ce que tu as fait, ce qui te reste et les succès en commun avec ton serveur.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-metiers"),
            title: "Métiers",
            description:
                "Tes métiers et leurs niveaux : ils alimentent le filtre de l'annuaire et les besoins de craft.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-community"),
            title: "Communauté SigilOS",
            description:
                "L'annuaire des visiteurs de ton serveur. Il n'est visible que par les visiteurs connectés.",
            placement: "bottom",
        },
        {
            target: target("visitor-nav-settings"),
            title: "Réglages",
            description:
                "Visibilité dans l'annuaire, présence Rush Live, notifications, export et suppression de tes données. La visite guidée s'y rejoue aussi.",
            placement: "bottom",
        },
        {
            target: target("visitor-identity"),
            title: "Ton identité Dofus",
            description:
                "Pseudo, classe, serveur et guilde déclarée : la base de tout ton espace. La guilde n'affiche son nom que si elle est déjà publique.",
            placement: "top",
        },
        {
            target: target("visitor-metamob"),
            title: "Metamob",
            description:
                "Vérifie ton pseudo pour prouver tes captures d'Archimonstres. Une clé refusée ne remplace jamais celle qui marchait ; tu peux la remplacer ou la délier ici.",
            placement: "top",
        },
    ];
}
