/**
 * Notifications — **référentiel d'affichage unique** des catégories (source unique, pure).
 *
 * Pourquoi ce fichier existe (mesure du 15/10/2026) : la cloche
 * (`src/components/notifications/notification-bell.tsx`) et le centre de notifications
 * (`src/app/dashboard/[guildId]/notifications/page.tsx`) entretenaient **deux listes
 * différentes** — 8 catégories d'un côté (Succès, Ocre et Système **invisibles**, donc
 * infiltrables), 10 de l'autre — dans un **ordre arbitraire**, d'où une rangée de filtres
 * illisible et une catégorie qu'on ne pouvait pas isoler. Une seule vérité ici :
 *
 *  · l'**ordre canonique** des filtres (du plus utile au plus rare) ;
 *  · les **libellés FR** (la page disait « Events », le reste disait « Événements ») ;
 *  · les **assets réels du jeu** (aucun emoji, aucune illustration inventée) ;
 *  · la règle de ce qui **mérite un filtre** (`buildNotificationFilters`).
 *
 * Importable côté client **comme** côté serveur : `import type` seul pour l'enum Prisma,
 * aucun accès base — `ladder-milestones.ts` s'en sert pour l'asset d'un palier de succès.
 */

import type { NotificationCategory } from "@prisma/client";

/**
 * Ordre canonique des filtres : le volume décroissant observé en base (missions, donjons,
 * songes, marché), puis les catégories d'appoint, et le fourre-tout `SYSTEM` en dernier —
 * jamais au milieu, comme c'était le cas implicitement.
 */
export const NOTIFICATION_CATEGORY_ORDER: readonly NotificationCategory[] = [
    "MISSION",
    "DONJONS",
    "SONGES",
    "MARKET",
    "SUCCESS",
    "OCRE",
    "POLL",
    "EVENT",
    "ADMIN_ALERT",
    "SYSTEM",
] as const;

/** Libellés FR des catégories (un seul vocabulaire pour la cloche, le centre et les filtres). */
export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
    MISSION: "Missions",
    DONJONS: "Donjons",
    SONGES: "Songes",
    MARKET: "Marché",
    SUCCESS: "Succès",
    OCRE: "Ocre",
    POLL: "Sondages",
    EVENT: "Événements",
    ADMIN_ALERT: "Administration",
    SYSTEM: "Système",
};

/**
 * Icônes des catégories : **vrais assets du jeu** (aucun emoji, aucune illustration IA).
 * Source unique — partagée par la cloche, le centre de notifications et le serveur
 * (un palier de succès annoncé dans le flux porte le même picto que sa catégorie).
 */
export const NOTIFICATION_CATEGORY_ICONS: Record<string, string> = {
    ALL: "/assets/dofus/game-icons/bell-on.png",
    MISSION: "/assets/icons/icone-quete.png",
    SUCCESS: "/assets/icons/succes.png",
    SONGES: "/assets/dofus-ui/pictos/songes.png",
    DONJONS: "/assets/dofus-ui/pictos/donjon.png",
    EVENT: "/assets/missions/event.png",
    POLL: "/assets/dofus/game-icons/question-mark.png",
    OCRE: "/assets/icons/ocre.png",
    MARKET: "/assets/dofus/game-icons/shop.png",
    ADMIN_ALERT: "/assets/dofus/game-icons/shield.png",
    SYSTEM: "/assets/dofus/game-icons/bell-on.png",
};

/** Libellé d'une catégorie, robuste à une valeur inconnue (jamais de trou d'affichage). */
export function notificationCategoryLabel(category: string | null | undefined): string {
    return NOTIFICATION_CATEGORY_LABELS[category as NotificationCategory] ?? "Système";
}

/** Icône d'une catégorie, robuste à une valeur inconnue (repli sur la cloche). */
export function notificationCategoryIcon(category: string | null | undefined): string {
    return NOTIFICATION_CATEGORY_ICONS[category ?? "SYSTEM"] ?? NOTIFICATION_CATEGORY_ICONS.SYSTEM;
}

/** Identifiant de filtre : « Toutes », ou une catégorie réelle. */
export type NotificationFilterId = NotificationCategory | "ALL";

export interface NotificationFilter {
    id: NotificationFilterId;
    label: string;
}

/** Filtre « Toutes » — toujours présent, toujours en tête. */
export const NOTIFICATION_ALL_FILTER: NotificationFilter = { id: "ALL", label: "Toutes" };

/**
 * Filtres à afficher : « Toutes » d'abord, puis **uniquement les catégories qui contiennent
 * au moins une notification** — plus la catégorie active, sinon sélectionner un filtre le
 * ferait disparaître au filtre suivant.
 *
 * Afficher huit catégories à `(0)` ne renseigne personne : c'est ce qui rendait la rangée
 * illisible (constat du 15/10/2026). Un filtre vide n'est pas un filtre.
 */
export function buildNotificationFilters(
    counts: Partial<Record<NotificationCategory, number>>,
    active: NotificationFilterId,
): NotificationFilter[] {
    return [
        NOTIFICATION_ALL_FILTER,
        ...NOTIFICATION_CATEGORY_ORDER.filter(
            (category) => (counts[category] ?? 0) > 0 || category === active,
        ).map((category) => ({ id: category, label: NOTIFICATION_CATEGORY_LABELS[category] })),
    ];
}

/**
 * Types d'asset portés par une notification (`Notification.imageKind`) — ce que l'image
 * **représente**, pas d'où elle vient. Sert à choisir le rendu (un objet du jeu se pose en
 * `contain` sur fond neutre, un avatar se recadre) et à documenter la source en base.
 */
export const NOTIFICATION_IMAGE_KINDS = [
    "DUNGEON",
    "DOFUS",
    "ITEM",
    "MONSTER",
    "SUCCESS",
    "MARKET",
] as const;

export type NotificationImageKind = (typeof NOTIFICATION_IMAGE_KINDS)[number];

/** Vrai si la valeur est un type d'asset connu (fail-closed : tout le reste est ignoré). */
export function isNotificationImageKind(value: unknown): value is NotificationImageKind {
    return typeof value === "string" && (NOTIFICATION_IMAGE_KINDS as readonly string[]).includes(value);
}

/**
 * Chemin d'image accepté pour un **affichage de notification** : interne à l'application, uniquement.
 *
 * Une notification peut porter un asset du jeu (`/api/assets-dofus/items/32239`, un WebP siphonné,
 * `/assets/icons/succes.png`) mais **jamais** une URL distante : ce chemin finit dans un `<img>`
 * chez le destinataire, une URL exogène y serait un appel sortant et une fuite d'IP vers un tiers
 * (règle « zéro empreinte », `AGENTS.md` §5.11).
 *
 * **Fail-closed** : tout ce qui n'est pas un chemin relatif simple ⇒ `null`, et l'affichage
 * retombe sur le picto de la catégorie. Source **unique** de cette règle : la cloche
 * (`Notification`) et les bulles de flux (`ServiceActivityLog.metadata`) l'appliquent à
 * l'identique, sans quoi les deux affichages divergeraient.
 */
export function sanitizeNotificationImageUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 512) return null;
    if (!trimmed.startsWith("/")) return null; // chemin relatif interne uniquement
    if (trimmed.startsWith("//")) return null; // « //hôte » = URL protocol-relative
    if (trimmed.includes("\\")) return null; // ni séparateur Windows ni échappement
    if (trimmed.includes("..")) return null; // ni remontée de chemin
    return trimmed;
}
