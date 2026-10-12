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
    LucideIcon
} from "lucide-react";

/**
 * Métadonnée d'un document — l'icône Lucide associée au slug.
 *
 * Les palettes par catégorie (`color` / `badgeClass` / `textClass`) ont été
 * retirées le 16/09/2026 : le registre ne porte plus de couleur, la teinte
 * vient des tokens du thème dans les pages.
 */
export interface DocMetaInfo {
    icon: LucideIcon;
}

export const DOC_META_REGISTRY: Record<string, DocMetaInfo> = {
    // 🌟 Progression
    "introduction": {
        icon: LayoutDashboard,
    },
    "missions": {
        icon: ScrollText,
    },
    "quete-ocre": {
        icon: Sparkles,
    },
    "ladder": {
        icon: Trophy,
    },
    "succes": {
        icon: Award,
    },
    "quetes-dofus": {
        icon: BookOpen,
    },
    "songes": {
        icon: Sparkles,
    },

    // 🛠️ Outils & Services
    "donjons-et-quetes": {
        icon: Swords,
    },
    "galerie-stuff": {
        icon: Star,
    },
    "services": {
        icon: Activity,
    },
    "planning": {
        icon: CalendarClock,
    },
    "worldmap": {
        icon: Compass,
    },
    "mini-jeux": {
        icon: Gamepad2,
    },
    "ressources": {
        icon: BookOpen,
    },

    // 👥 Communauté
    "members": {
        icon: Users,
    },
    "calendar": {
        icon: Calendar,
    },
    "sondages": {
        icon: Gavel,
    },
    "admin-presentation": {
        icon: Sparkles,
    },

    // 🛡️ Administration
    "admin-getting-started": {
        icon: Rocket,
    },
    "admin-settings": {
        icon: Settings,
    },
    "admin-permissions": {
        icon: Shield,
    },
    "admin-modules": {
        icon: Hammer,
    },
    "admin-members": {
        icon: Users,
    },
    "module-recrutement-cycle-de-vie": {
        icon: UserCheck,
    },
    "admin-missions": {
        icon: Swords,
    },
    "admin-validation": {
        icon: CheckCircle,
    },
    "admin-points": {
        icon: Coins,
    },
    "admin-reaction-roles": {
        icon: Sparkles,
    },
    "admin-tickets": {
        icon: Ticket,
    },
    "admin-logs": {
        icon: FileText,
    },
    "admin-api-keys": {
        icon: Key,
    },
};

export const CATEGORY_META: Record<string, { icon: LucideIcon }> = {
    "Progression & Objectifs": {
        icon: Trophy,
    },
    "Outils & Services": {
        icon: Swords,
    },
    "Communauté & Guilde": {
        icon: Users,
    },
    "Administration & Staff": {
        icon: Shield,
    },
    "Spécifications Techniques": {
        icon: Key,
    }
};

export function getDocMeta(slug: string): DocMetaInfo {
    return DOC_META_REGISTRY[slug] || {
        icon: FileText,
    };
}
