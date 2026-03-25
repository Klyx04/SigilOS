import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { PERMISSIONS } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import Link from "next/link";
import {
    LayoutDashboard,
    Shield,
    Settings,
    FileText,
    CheckCircle,
    Swords,
    Sparkles,
    Puzzle,
    Users,
    BookOpen,
    ArrowRight,
    Activity,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type AdminCard = {
    href: string;
    icon: React.ElementType;
    title: string;
    description: string;
    accent: string; // Tailwind color token (e.g. "violet")
    permission?: keyof typeof PERMISSIONS | ((user: any) => boolean);
};

type AdminSection = {
    label: string;
    icon: React.ElementType;
    cards: AdminCard[];
};

// ============================================================================
// DATA
// ============================================================================

function buildSections(guildId: string): AdminSection[] {
    return [
        {
            label: "Configuration",
            icon: Settings,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/modules`,
                    icon: Puzzle,
                    title: "Modules",
                    description: "Activer ou désactiver les fonctionnalités disponibles pour la guilde.",
                    accent: "violet",
                    permission: (u) => u.isAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/permissions`,
                    icon: Shield,
                    title: "Permissions",
                    description: "Attribuer les droits d'accès aux rôles Discord de la guilde.",
                    accent: "blue",
                    permission: (u) => u.isAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/settings`,
                    icon: Settings,
                    title: "Paramètres",
                    description: "Intégrations Discord, Metamob, Dofus et configuration avancée.",
                    accent: "slate",
                    permission: (u) => u.isAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/presentation`,
                    icon: BookOpen,
                    title: "Page Guilde",
                    description: "Éditer la page de présentation publique et de recrutement.",
                    accent: "indigo",
                    permission: (u) => u.canEditPresentation,
                },
            ],
        },
        {
            label: "Gestion",
            icon: Swords,
            cards: [
                {
                    href: `/dashboard/${guildId}/missions/validation`,
                    icon: CheckCircle,
                    title: "Valider les Preuves",
                    description: "Accepter ou refuser les soumissions de missions des membres.",
                    accent: "green",
                    permission: (u) => u.canValidateMissions,
                },
                {
                    href: `/dashboard/${guildId}/missions/manage`,
                    icon: Swords,
                    title: "Gérer les Missions",
                    description: "Créer, modifier et archiver les missions hebdomadaires.",
                    accent: "emerald",
                    permission: (u) => u.canManageMissions,
                },
                {
                    href: `/dashboard/${guildId}/missions/manage#bonus`,
                    icon: Sparkles,
                    title: "Bonus de Guilde",
                    description: "Acheter et gérer les bonus temporaires actifs pour la guilde.",
                    accent: "amber",
                    permission: (u) => u.canManageBonus,
                },
            ],
        },
        {
            label: "Supervision",
            icon: LayoutDashboard,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/logs`,
                    icon: FileText,
                    title: "Logs d'Audit",
                    description: "Consulter l'historique complet des actions administratives.",
                    accent: "rose",
                    permission: (u) => u.isAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/settings#membres`,
                    icon: Users,
                    title: "Membres & Sync",
                    description: "Gérer les membres, archiver des comptes et synchroniser Discord.",
                    accent: "cyan",
                    permission: (u) => u.canManageMembers,
                },
                {
                    href: `/dashboard/${guildId}/admin/workers`,
                    icon: Activity,
                    title: "Workers & Sync",
                    description: "Déclencher manuellement les tâches de fond (Dofusbook, Ladder).",
                    accent: "amber",
                    permission: (u) => u.isSuperAdmin,
                },
            ],
        },
    ];
}

// Accent color map → Tailwind classes (static strings for purge safety)
const ACCENT: Record<string, { border: string; hover: string; text: string; bg: string }> = {
    violet: { border: "hover:border-violet-500/50", hover: "hover:bg-violet-500/5", text: "text-violet-400", bg: "bg-violet-500/10" },
    blue: { border: "hover:border-blue-500/50", hover: "hover:bg-blue-500/5", text: "text-blue-400", bg: "bg-blue-500/10" },
    slate: { border: "hover:border-slate-500/50", hover: "hover:bg-slate-500/5", text: "text-slate-400", bg: "bg-slate-500/10" },
    indigo: { border: "hover:border-indigo-500/50", hover: "hover:bg-indigo-500/5", text: "text-indigo-400", bg: "bg-indigo-500/10" },
    green: { border: "hover:border-green-500/50", hover: "hover:bg-green-500/5", text: "text-green-400", bg: "bg-green-500/10" },
    emerald: { border: "hover:border-emerald-500/50", hover: "hover:bg-emerald-500/5", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { border: "hover:border-amber-500/50", hover: "hover:bg-amber-500/5", text: "text-amber-400", bg: "bg-amber-500/10" },
    rose: { border: "hover:border-rose-500/50", hover: "hover:bg-rose-500/5", text: "text-rose-400", bg: "bg-rose-500/10" },
    cyan: { border: "hover:border-cyan-500/50", hover: "hover:bg-cyan-500/5", text: "text-cyan-400", bg: "bg-cyan-500/10" },
};

// ============================================================================
// PAGE
// ============================================================================

export default async function AdminPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    
    // Allow access if user is admin OR has any management permission
    const hasAnyAdminPermission = user.isAdmin || 
        user.canManageMissions || user.canValidateMissions || user.canManageBonus ||
        user.canManageMembers || user.canManageCalendar || user.canManageQuests ||
        user.canManageWorldmap || user.canManageResources || user.canModerateChat ||
        user.canEditPresentation || user.canViewAdminDocs;

    if (!hasAnyAdminPermission) {
        await logAdminAccessDenied(guildId, "/admin");
        return <AccessDenied />;
    }

    const sections = buildSections(guildId);

    return (
        <div className="space-y-10 pb-12">
            <UnifiedModuleHeader
                title="Centre Admin"
                description="Panneau de contrôle de la guilde"
                icon={LayoutDashboard}
                backHref={`/dashboard/${guildId}`}
            />

            {sections.map((section) => {
                const visibleCards = section.cards.filter(card => {
                    if (user.isSuperAdmin) return true;
                    if (typeof card.permission === 'function') return card.permission(user);
                    return user.isAdmin;
                });

                if (visibleCards.length === 0) return null;

                const SectionIcon = section.icon;
                return (
                    <div key={section.label} className="space-y-4">
                        {/* Section header */}
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                <SectionIcon className="w-3.5 h-3.5" />
                                {section.label}
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                        </div>

                        {/* Cards grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {visibleCards.map((card) => {
                                const Icon = card.icon;
                                const a = ACCENT[card.accent] ?? ACCENT.slate;
                                return (
                                    <Link key={card.href} href={card.href}>
                                        <div className={`group relative flex flex-col h-full rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all duration-200 cursor-pointer ${a.border} ${a.hover}`}>
                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-lg ${a.bg} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                                <Icon className={`w-5 h-5 ${a.text}`} />
                                            </div>

                                            {/* Text */}
                                            <h3 className={`font-bold text-sm text-foreground mb-1.5 group-hover:${a.text} transition-colors`}>
                                                {card.title}
                                            </h3>
                                            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                                                {card.description}
                                            </p>

                                            {/* Arrow */}
                                            <div className={`mt-4 flex items-center gap-1 text-xs font-semibold ${a.text} opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1`}>
                                                Accéder <ArrowRight className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
