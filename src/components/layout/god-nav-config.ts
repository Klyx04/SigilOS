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
    type LucideIcon
} from "lucide-react";

export interface GodNavItem {
    id: string;
    name: string;
    icon: LucideIcon;
    color: string;
    group: "operations" | "supervision" | "administration" | "game-data" | "tools";
    sub?: string;
    scope: string; // "all" = super-admin seulement
    scopeLabel?: string;
}

export const GOD_NAV_GROUPS: { key: GodNavItem["group"]; label: string; icon: LucideIcon }[] = [
    { key: "operations", label: "Operations", icon: Terminal },
    { key: "supervision", label: "Supervision", icon: Activity },
    { key: "administration", label: "Administration", icon: Shield },
    { key: "game-data", label: "Données de Jeu", icon: Database },
    { key: "tools", label: "Outils", icon: Server },
];

export const CONSOLE_PAGES: GodNavItem[] = [
    // Operations
    { id: "overview", name: "Command Center", icon: LayoutDashboard, color: "text-blue-400", group: "operations", scope: "all", scopeLabel: "Toutes" },
    { id: "telemetry", name: "Activité Dashboard", icon: Activity, color: "text-violet-400", group: "supervision", scope: "all", scopeLabel: "Toutes" },

    // Administration
    { id: "guilds", name: "Guildes & Users", icon: Settings2, color: "text-emerald-400", group: "administration", scope: "guilds", scopeLabel: "Guildes" },
    { id: "delegates", name: "Sous-Gods", sub: "delegates", icon: Shield, color: "text-violet-400", group: "administration", scope: "users", scopeLabel: "Users" },
    { id: "security", name: "Sécurité & Logs", icon: ShieldAlert, color: "text-zinc-400", group: "administration", scope: "logs", scopeLabel: "Logs" },
    { id: "tickets", name: "Tickets Support", icon: Ticket, color: "text-indigo-400", group: "administration", scope: "all", scopeLabel: "Toutes" },

    // Supervision
    { id: "infrastructure", name: "Système & Infra", icon: HardDrive, color: "text-amber-400", group: "supervision", scope: "maintenance", scopeLabel: "Maintenance" },
    { id: "notifications", name: "Alertes Système", icon: Bell, color: "text-rose-400", group: "supervision", scope: "all", scopeLabel: "Toutes" },
    { id: "mini-games", name: "Mini-Jeux", icon: Gamepad2, color: "text-amber-500", group: "supervision", sub: "mini-games", scope: "all", scopeLabel: "Toutes" },

    // Données de Jeu
    { id: "game-data", name: "Données de Jeu", icon: Database, color: "text-cyan-400", group: "game-data", scope: "game-data", scopeLabel: "Game Data" },
    { id: "bounties", name: "Avis de Recherche", icon: Ban, color: "text-rose-500", group: "game-data", sub: "game-data/bounties", scope: "game-data", scopeLabel: "Game Data" },
    { id: "quetes-dofus", name: "Quêtes Dofus", icon: Sparkles, color: "text-purple-400", group: "game-data", sub: "quetes-dofus", scope: "game-data", scopeLabel: "Game Data" },
    { id: "dofus-guides", name: "Guides Optim.", icon: Navigation, color: "text-emerald-400", group: "game-data", sub: "dofus-guides", scope: "game-data", scopeLabel: "Game Data" },
    { id: "rush-sylvestre", name: "Rush Sylvestre", icon: Zap, color: "text-emerald-400", group: "game-data", sub: "rush-sylvestre", scope: "game-data", scopeLabel: "Game Data" },
    { id: "bugs", name: "Bugs & Suggs", icon: Bug, color: "text-rose-400", group: "game-data", sub: "bugs", scope: "all", scopeLabel: "Toutes" },

    // Outils
    { id: "roadmap", name: "Roadmap Pro", icon: Map, color: "text-amber-400", group: "tools", sub: "roadmap", scope: "all", scopeLabel: "Toutes" },
    { id: "changelog", name: "Changelog Engine", icon: History, color: "text-indigo-400", group: "tools", sub: "changelog", scope: "all", scopeLabel: "Toutes" },
    { id: "docs", name: "Documents", icon: BookOpen, color: "text-blue-400", group: "tools", sub: "docs", scope: "all", scopeLabel: "Toutes" },
    { id: "onboarding", name: "Onboarding", icon: UserPlus, color: "text-emerald-400", group: "tools", sub: "onboarding", scope: "all", scopeLabel: "Toutes" },
];

export const ALL_SCOPES_COUNT = 6;