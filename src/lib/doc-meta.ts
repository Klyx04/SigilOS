import {
    LayoutDashboard,
    ScrollText,
    Trophy,
    Award,
    Sparkles,
    Swords,
    Star,
    Activity,
    CalendarClock,
    Compass,
    Gamepad2,
    BookOpen,
    Users,
    Calendar,
    Gavel,
    Shield,
    Settings,
    Hammer,
    UserCheck,
    CheckCircle,
    Coins,
    Ticket,
    FileText,
    Key,
    Rocket,
    LucideIcon,
    Folder
} from "lucide-react";

export interface DocMetaInfo {
    icon: LucideIcon;
    color: string; // Tailwind color class or hex
    badgeClass: string;
    textClass: string;
}

export const DOC_META_REGISTRY: Record<string, DocMetaInfo> = {
    // 🌟 Progression
    "introduction": {
        icon: LayoutDashboard,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "missions": {
        icon: ScrollText,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "quete-ocre": {
        icon: Sparkles,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "ladder": {
        icon: Trophy,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "succes": {
        icon: Award,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "quetes-dofus": {
        icon: BookOpen,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "songes": {
        icon: Sparkles,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },

    // 🛠️ Outils & Services
    "donjons-et-quetes": {
        icon: Swords,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "galerie-stuff": {
        icon: Star,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "services": {
        icon: Activity,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "planning": {
        icon: CalendarClock,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "worldmap": {
        icon: Compass,
        color: "cyan",
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        textClass: "text-cyan-400"
    },
    "mini-jeux": {
        icon: Gamepad2,
        color: "cyan",
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        textClass: "text-cyan-400"
    },
    "ressources": {
        icon: BookOpen,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },

    // 👥 Communauté
    "members": {
        icon: Users,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },
    "calendar": {
        icon: Calendar,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },
    "sondages": {
        icon: Gavel,
        color: "cyan",
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        textClass: "text-cyan-400"
    },
    "admin-presentation": {
        icon: Sparkles,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },

    // 🛡️ Administration
    "admin-getting-started": {
        icon: Rocket,
        color: "rose",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        textClass: "text-rose-400"
    },
    "admin-settings": {
        icon: Settings,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "admin-permissions": {
        icon: Shield,
        color: "rose",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        textClass: "text-rose-400"
    },
    "admin-modules": {
        icon: Hammer,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        textClass: "text-indigo-400"
    },
    "admin-members": {
        icon: Users,
        color: "cyan",
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        textClass: "text-cyan-400"
    },
    "module-recrutement-cycle-de-vie": {
        icon: UserCheck,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },
    "admin-missions": {
        icon: Swords,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },
    "admin-validation": {
        icon: CheckCircle,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        textClass: "text-emerald-400"
    },
    "admin-points": {
        icon: Coins,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "admin-reaction-roles": {
        icon: Sparkles,
        color: "purple",
        badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        textClass: "text-purple-400"
    },
    "admin-tickets": {
        icon: Ticket,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        textClass: "text-amber-400"
    },
    "admin-logs": {
        icon: FileText,
        color: "rose",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        textClass: "text-rose-400"
    },
    "admin-api-keys": {
        icon: Key,
        color: "zinc",
        badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        textClass: "text-zinc-400"
    },
};

export const CATEGORY_META: Record<string, { icon: LucideIcon; color: string; badgeClass: string }> = {
    "Progression & Objectifs": {
        icon: Trophy,
        color: "amber",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20"
    },
    "Outils & Services": {
        icon: Swords,
        color: "indigo",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
    },
    "Communauté & Guilde": {
        icon: Users,
        color: "emerald",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    },
    "Administration & Staff": {
        icon: Shield,
        color: "rose",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20"
    },
    "Spécifications Techniques": {
        icon: Key,
        color: "zinc",
        badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    }
};

export function getDocMeta(slug: string): DocMetaInfo {
    return DOC_META_REGISTRY[slug] || {
        icon: FileText,
        color: "teal",
        badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
        textClass: "text-teal-400"
    };
}
