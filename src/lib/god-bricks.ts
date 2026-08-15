/**
 * 📦 Registre centralisé des briques d'accès au dashboard God (PIM).
 *
 * ⚠️ Ce fichier ne contient AUCUN secret (brickId = slug public).
 *
 * C'est la SEULE source de vérité pour savoir :
 *  - quelle page/tab correspond à quelle brique ;
 *  - quel scope global est requis (rétro-compat) ;
 *  - si un sous-god PEUT y accéder (`subGodAccess`).
 *
 * 🔒 SÉCURITÉ FAIL-CLOSED :
 *  - Un super-admin accède toujours à tout (ignoré par la logique ci-dessous).
 *  - Un sous-god ne voit une page QUE si `subGodAccess === true` ET si le scope
 *    requis est actif OU un grant de brique est actif.
 *  - Toute NOUVELLE page ajoutée SANS `subGodAccess: true` est automatiquement
 *    INTERDITE aux sous-gods → extensible sans risque.
 */
export const GOD_BRICKS = [
    // ─── Operations / Supervision (super-admin only) ───────────────────────
    { id: "overview",       label: "Command Center",        scope: null, group: "operations",  subGodAccess: false },
    { id: "telemetry",      label: "Activité Dashboard",    scope: null, group: "supervision", subGodAccess: false },
    { id: "infrastructure", label: "Système & Infra",       scope: null, group: "supervision", subGodAccess: false },
    { id: "storage",        label: "Stockage & Captures",    scope: null, group: "supervision", subGodAccess: false },
    { id: "notifications",  label: "Alertes Système",       scope: null, group: "supervision", subGodAccess: false },
    { id: "mini-games",     label: "Mini-Jeux",             scope: null, group: "supervision", subGodAccess: false },

    // ─── Administration (sécurité) ─────────────────────────────────────────
    { id: "security",       label: "Sécurité & Logs",       scope: null, group: "admin",       subGodAccess: false },
    { id: "logs",           label: "Audit Logs (Archive)",   scope: null, group: "admin",       subGodAccess: false },
    { id: "delegates",      label: "Sous-Gods (accès)",     scope: null, group: "admin",       subGodAccess: false },
    { id: "onboarding",     label: "Onboarding B2B",        scope: null, group: "admin",       subGodAccess: false },

    // ─── Guildes (sous-god partiel : whitelist + roster, SANS actions destructives) ──
    { id: "guilds",         label: "Guildes & Users",       scope: "guilds", group: "admin",    subGodAccess: true },

    // ─── Support / Ouvrable aux sous-gods ──────────────────────────────────
    { id: "tickets",        label: "Tickets Support",       scope: null, group: "admin",       subGodAccess: true },
    { id: "docs",           label: "Documents",             scope: "news", group: "tools",      subGodAccess: true },

    // ─── Game-Data (ouvrable aux sous-gods) ────────────────────────────────
    { id: "game-data",           label: "Données de Jeu",    scope: "game-data", group: "game-data", subGodAccess: true },
    { id: "game-data-quests",    label: "Base Monstres",     scope: "game-data", group: "game-data", subGodAccess: true },
    { id: "game-data-bounties",  label: "Avis de Recherche", scope: "game-data", group: "game-data", subGodAccess: true },
    { id: "game-data-quetes",    label: "Quêtes Dofus",      scope: "game-data", group: "game-data", subGodAccess: true },
    { id: "game-data-guides",    label: "Guides Optim.",     scope: "game-data", group: "game-data", subGodAccess: true },
    { id: "game-data-rush",      label: "Rush Sylvestre",    scope: "game-data", group: "game-data", subGodAccess: true },

    // ─── Fermé aux sous-gods (jamais) ──────────────────────────────────────
    { id: "bugs",           label: "Bugs & Suggs",  scope: null, group: "game-data", subGodAccess: false },
    { id: "roadmap",        label: "Roadmap Pro",   scope: null, group: "tools",     subGodAccess: false },
    { id: "changelog",      label: "Changelog",     scope: null, group: "tools",     subGodAccess: false },
] as const;

export type GodBrick = (typeof GOD_BRICKS)[number]["id"];
export type GodBrickGroup = (typeof GOD_BRICKS)[number]["group"];
export type GodBrickScope = (typeof GOD_BRICKS)[number]["scope"];

export const GOD_BRICK_GROUPS: GodBrickGroup[] = ["operations", "supervision", "admin", "game-data", "tools"];

export function getGodBrick(brickId: string) {
    return GOD_BRICKS.find((b) => b.id === brickId);
}

/**
 * Retourne la liste des briques accessibles aux SOUS-GODS (pas super-admin).
 * Une brique est accessible si `subGodAccess === true`.
 * Les administrateurs (super-admin) passent par leur propre bypass, ce helper
 * ne sert donc qu'à contenir/diffuser la liste des pages "sous-god friendly".
 */
export function getSubGodBrickIds(): string[] {
    return GOD_BRICKS.filter((b) => b.subGodAccess).map((b) => b.id);
}