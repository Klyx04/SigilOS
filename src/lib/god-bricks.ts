/**
 * Briques d'accès granulaire au dashboard God (PIM — Pilier D).
 * ⚠️ Ce fichier ne contient AUCUN secret (brickId = slug public).
 */
export const GOD_BRICKS = [
    { id: "overview", label: "Command Center", scope: "guilds", group: "operations" },
    { id: "live-stats", label: "Statistiques Live", scope: "guilds", group: "operations" },
    { id: "telemetry", label: "Activité Dashboard", scope: "guilds", group: "supervision" },
    { id: "system-health", label: "Santé Système", scope: "maintenance", group: "supervision" },
    { id: "notifications", label: "Alertes Système", scope: "maintenance", group: "supervision" },
    { id: "guilds", label: "Guildes & Users", scope: "guilds", group: "admin" },
    { id: "delegates", label: "Sous-Gods (accès)", scope: "users", group: "admin" },
    { id: "security-audit", label: "Logs d'Audit", scope: "logs", group: "admin" },
    { id: "security-firewall", label: "Firewall & Lifecycle", scope: "users", group: "admin" },
    { id: "tickets", label: "Tickets Support", scope: "guilds", group: "admin" },
    { id: "game-data-quests", label: "Données de Jeu", scope: "game-data", group: "game-data" },
    { id: "game-data-bounties", label: "Avis de Recherche", scope: "game-data", group: "game-data" },
    { id: "game-data-quetes", label: "Quêtes Dofus", scope: "game-data", group: "game-data" },
    { id: "game-data-guides", label: "Guides Optim.", scope: "game-data", group: "game-data" },
    { id: "game-data-rush", label: "Rush Sylvestre", scope: "game-data", group: "game-data" },
    { id: "game-data-bugs", label: "Bugs & Suggs", scope: "guilds", group: "game-data" },
    { id: "storage", label: "Stockage", scope: "maintenance", group: "tools" },
    { id: "mini-games", label: "Mini-Jeux", scope: "guilds", group: "tools" },
    { id: "roadmap", label: "Roadmap", scope: "guilds", group: "tools" },
    { id: "changelog", label: "Changelog", scope: "news", group: "tools" },
    { id: "docs", label: "Documents", scope: "news", group: "tools" },
    { id: "onboarding", label: "Onboarding", scope: "guilds", group: "tools" },
] as const;

export type GodBrick = (typeof GOD_BRICKS)[number]["id"];
export type GodBrickGroup = (typeof GOD_BRICKS)[number]["group"];

export const GOD_BRICK_GROUPS: GodBrickGroup[] = ["operations", "supervision", "admin", "game-data", "tools"];

export function getGodBrick(brickId: string) {
    return GOD_BRICKS.find((b) => b.id === brickId);
}