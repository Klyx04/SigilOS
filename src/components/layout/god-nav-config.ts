import {
    Terminal,
    Activity,
    Gamepad2,
    Settings2,
    HardDrive,
    Bell,
    Ticket,
    Database,
    ShieldAlert,
    Shield,
    Sparkles,
    Bug,
    Map,
    History,
    Zap,
    Navigation,
    LayoutDashboard,
    Ban,
    Server,
    BookOpen,
    UserPlus,
    Library,
    Clock,
    Image as ImageIcon,
    Award,
    Key,
    type LucideIcon
} from "lucide-react";

export interface GodNavItem {
    id: string;
    name: string;
    icon: LucideIcon;
    color: string;
    group: "operations" | "supervision" | "administration" | "game-data" | "tools";
    sub?: string;
    /** Query ajoutée au sous-route (ex: "sub=GUESSER" pour ouvrir la blacklist géoguesser). */
    query?: string;
    scope: string; // "all" = super-admin seulement
    scopeLabel?: string;
    /** 🔄 P2 — id de la brique dans le registre `god-bricks.ts` (source de vérité du PIM). */
    brickId: string;
}

export const GOD_NAV_GROUPS: { key: GodNavItem["group"]; label: string; icon: LucideIcon }[] = [
    { key: "operations", label: "Operations", icon: Terminal },
    { key: "supervision", label: "Supervision", icon: Activity },
    { key: "administration", label: "Administration", icon: Shield },
    { key: "game-data", label: "Données de Jeu", icon: Database },
    { key: "tools", label: "Outils", icon: Server },
];

export const CONSOLE_PAGES: GodNavItem[] = [
    // Operations (super-admin)
    { id: "overview", name: "Command Center", icon: LayoutDashboard, color: "text-info", group: "operations", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
    { id: "telemetry", name: "Activité Dashboard", icon: Activity, color: "text-violet-400", group: "supervision", scope: "all", scopeLabel: "Toutes", brickId: "telemetry" },

    // Administration
    { id: "guilds", name: "Guildes & Users", icon: Settings2, color: "text-success", group: "administration", scope: "guilds", scopeLabel: "Guildes", brickId: "guilds" },
    { id: "delegates", name: "Sous-Gods", sub: "delegates", icon: Shield, color: "text-violet-400", group: "administration", scope: "users", scopeLabel: "Users", brickId: "delegates" },
    { id: "api-keys", name: "Clés d'API & Dev", icon: Key, color: "text-amber-400", group: "administration", scope: "all", scopeLabel: "Toutes", brickId: "api-keys" },
    { id: "slash-commands", name: "Commandes Slash", icon: Terminal, color: "text-accent", group: "administration", scope: "all", scopeLabel: "Toutes", brickId: "slash-commands" },
    { id: "security", name: "Sécurité & Logs", icon: ShieldAlert, color: "text-muted-foreground", group: "administration", scope: "logs", scopeLabel: "Logs", brickId: "security" },
    { id: "logs", name: "Audit Logs", sub: "logs", icon: History, color: "text-violet-400", group: "administration", scope: "all", scopeLabel: "Toutes", brickId: "logs" },
    { id: "tickets", name: "Tickets Support", icon: Ticket, color: "text-info", group: "administration", scope: "all", scopeLabel: "Toutes", brickId: "tickets" },

    // Supervision
    { id: "infrastructure", name: "Système & Infra", icon: HardDrive, color: "text-warning", group: "supervision", scope: "maintenance", scopeLabel: "Maintenance", brickId: "infrastructure" },
    { id: "cron-status", name: "Tâches CRON", icon: Clock, color: "text-warning", group: "supervision", scope: "maintenance", scopeLabel: "Maintenance", brickId: "infrastructure" },
    { id: "storage", name: "Stockage & Captures", icon: HardDrive, color: "text-info", group: "supervision", scope: "all", scopeLabel: "Toutes", brickId: "storage" },
    { id: "notifications", name: "Alertes Système", icon: Bell, color: "text-danger", group: "supervision", scope: "all", scopeLabel: "Toutes", brickId: "notifications" },
    { id: "mini-games", name: "Mini-Jeux", icon: Gamepad2, color: "text-warning", group: "supervision", sub: "mini-games", scope: "all", scopeLabel: "Toutes", brickId: "mini-games" },
    { id: "geo-blacklist", name: "Blacklist Géoguesser", icon: Map, color: "text-danger", group: "supervision", sub: "mini-games", query: "sub=GUESSER", scope: "all", scopeLabel: "Toutes", brickId: "mini-games" },

    // Données de Jeu (sous-god friendly)
    { id: "game-data", name: "Données de Jeu", icon: Database, color: "text-info", group: "game-data", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data" },
    { id: "resources", name: "Ressources & Créateurs", icon: Library, color: "text-purple-400", group: "game-data", sub: "resources", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data-resources" },
    { id: "bounties", name: "Avis de Recherche", icon: Ban, color: "text-danger", group: "game-data", sub: "game-data/bounties", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data-bounties" },
    { id: "quetes-dofus", name: "Quêtes Dofus", icon: Sparkles, color: "text-info", group: "game-data", sub: "quetes-dofus", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data-quetes" },
    { id: "dofus-guides", name: "Guides Optim.", icon: Navigation, color: "text-success", group: "game-data", sub: "dofus-guides", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data-guides" },
    { id: "rush-sylvestre", name: "Rush Sylvestre", icon: Zap, color: "text-success", group: "game-data", sub: "rush-sylvestre", scope: "game-data", scopeLabel: "Game Data", brickId: "game-data-rush" },
    { id: "bugs", name: "Bugs & Suggs", icon: Bug, color: "text-danger", group: "game-data", sub: "bugs", scope: "all", scopeLabel: "Toutes", brickId: "bugs" },

    // Outils
    { id: "roadmap", name: "Roadmap Pro", icon: Map, color: "text-warning", group: "tools", sub: "roadmap", scope: "all", scopeLabel: "Toutes", brickId: "roadmap" },
    { id: "changelog", name: "Changelog Engine", icon: History, color: "text-info", group: "tools", sub: "changelog", scope: "all", scopeLabel: "Toutes", brickId: "changelog" },
    { id: "docs", name: "Documents", icon: BookOpen, color: "text-info", group: "tools", sub: "docs", scope: "all", scopeLabel: "Toutes", brickId: "docs" },
    { id: "reaction-roles", name: "Packs Reaction Roles", icon: Sparkles, color: "text-purple-400", group: "tools", sub: "reaction-roles", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
    { id: "ticket-bot", name: "Bot Tickets Flotte", icon: Ticket, color: "text-amber-400", group: "tools", sub: "ticket-bot", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
    { id: "onboarding", name: "Onboarding B2B", icon: UserPlus, color: "text-success", group: "tools", sub: "onboarding", scope: "all", scopeLabel: "Toutes", brickId: "onboarding" },
    { id: "landing", name: "Landing Screens", icon: Sparkles, color: "text-purple-400", group: "tools", sub: "landing", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
    { id: "module-icons", name: "Icônes Modules", icon: ImageIcon, color: "text-warning", group: "tools", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
    { id: "badges", name: "Studio Badges", icon: Award, color: "text-amber-400", group: "tools", sub: "badges", scope: "all", scopeLabel: "Toutes", brickId: "overview" },
];

export const ALL_SCOPES_COUNT = 6;