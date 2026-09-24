import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { cn } from "@/lib/utils";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { PERMISSIONS } from "@/lib/permissions";
import { db } from "@/lib/prisma";
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
    Bell,
    Activity,
    ShieldAlert,
    Coins,
    Ticket,
    Key,
    UserCheck,
    Terminal,
} from "lucide-react";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

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
    /**
     * Refonte onboarding §9 — module(s) de guilde requis pour afficher la carte.
     * Absent = carte structurelle (toujours affichée si la permission passe).
     * Au moins un des modules doit être effectif (toggle guilde + verrou God).
     */
    modules?: string | string[];
    /** Identifiant stable pour le tour admin (data-tour). */
    tourId?: string;
    /** Official Dofus 2x UI asset path (e.g. /assets/dofus/modules/guild.png) */
    dofusAsset?: string;
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
            label: "Structure & Configuration",
            icon: Settings,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/settings`,
                    icon: Settings,
                    title: "Paramètres Généraux",
                    description: "Intégrations Discord, Metamob, Dofus et configuration globale de la plateforme.",
                    accent: "amber",
                    permission: (u) => u.canViewSettings,
                    tourId: "admin-overview-card-settings",
                    dofusAsset: "/assets/dofus/modules/guildBonus.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/permissions`,
                    icon: Shield,
                    title: "Rôles & Permissions",
                    description: "Gestion fine des accès. Définissez qui peut valider, modérer ou administrer.",
                    accent: "blue",
                    permission: (u) => u.canManageRBAC,
                    tourId: "admin-overview-card-permissions",
                    dofusAsset: "/assets/dofus/modules/guildShop.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/modules`,
                    icon: Puzzle,
                    title: "Gestion des Modules",
                    description: "Activez ou désactivez les fonctionnalités (Chat, Songe, Ocre, etc.) pour votre guilde.",
                    accent: "violet",
                    permission: (u) => u.isDiscordAdmin,
                    tourId: "admin-overview-card-modules",
                    dofusAsset: "/assets/dofus/modules/build.png",
                },
                {
                    href: `/dashboard/${guildId}/reaction-roles`,
                    icon: Sparkles,
                    title: "Rôles par Réaction (Reaction Roles)",
                    description: "Panneaux de sélection de rôles interactifs avec boutons, menus déroulants et icônes pour Discord.",
                    accent: "violet",
                    modules: "reactionRoles",
                    permission: (u) => u.canManageReactionRoles,
                    tourId: "admin-overview-card-reaction-roles",
                    dofusAsset: "/assets/dofus/modules/starShield.png",
                },
                {
                    href: `/dashboard/${guildId}/tickets`,
                    icon: Ticket,
                    title: "Bot Tickets & Support Discord",
                    description: "Gestion des formulaires d'intake, réclamations staff, notes internes et transcripts.",
                    accent: "amber",
                    modules: "tickets",
                    permission: (u) => u.canManageTickets,
                    tourId: "admin-overview-card-tickets",
                    dofusAsset: "/assets/dofus/modules/ticket.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/commandes`,
                    icon: Terminal,
                    title: "Commandes Slash Discord",
                    description: "Gestion des commandes bot : restrictions par salon Discord, rôles autorisés et activation.",
                    accent: "emerald",
                    permission: (u) => u.canManageRBAC || u.isAdmin,
                    tourId: "admin-overview-card-slash-commands",
                    dofusAsset: "/assets/dofus/modules/chat.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/presentation`,
                    icon: BookOpen,
                    title: "Identité de Guilde",
                    description: "Édition de la page publique, recrutement et présentation des objectifs.",
                    accent: "indigo",
                    modules: "presentation",
                    permission: (u) => u.canEditPresentation,
                    tourId: "admin-overview-card-presentation",
                    dofusAsset: "/assets/dofus/modules/guild.png",
                },
            ],
        },
        {
            label: "Opérations & Gestion",
            icon: Swords,
            cards: [
                {
                    href: `/dashboard/${guildId}/missions/manage`,
                    icon: Swords,
                    title: "Gestion des Missions",
                    description: "Préparation du reset hebdomadaire, création des missions et bonus de guilde.",
                    accent: "emerald",
                    modules: "missions",
                    permission: (u) => u.canManageMissions,
                    tourId: "admin-overview-card-missions",
                    dofusAsset: "/assets/dofus/modules/guildatons.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/validation`,
                    icon: CheckCircle,
                    title: "Validation",
                    description: "Centre de tri des screens. Récompensez les efforts de vos membres.",
                    accent: "green",
                    modules: "missions",
                    permission: (u) => u.canValidateMissions,
                    tourId: "admin-overview-card-validation",
                    dofusAsset: "/assets/dofus/modules/success.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/members`,
                    icon: Users,
                    title: "Audit & Gestion des Membres",
                    description: "Audit Discord vs Dashboard, synchronisation des pseudos, archivage et relances Discord.",
                    accent: "cyan",
                    modules: "roster",
                    permission: (u) => u.canManageMembers || u.canManageRelance,
                    tourId: "admin-overview-card-members",
                    dofusAsset: "/assets/dofus/modules/social.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/members?tab=registre`,
                    icon: UserCheck,
                    title: "Recrutement & Cycle de Vie",
                    description: "Registre du staff, périodes d'essai J-X, mules et historique des départs (onglet du module Membres).",
                    accent: "emerald",
                    modules: "roster",
                    permission: (u) => u.canManageMembers,
                    tourId: "admin-overview-card-recruitment",
                    dofusAsset: "/assets/dofus/modules/character.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/points`,
                    icon: Coins,
                    title: "Points de Contribution",
                    description: "Personnalisez les points de la clôture des posts DJ / quêtes et des runs Songes.",
                    accent: "amber",
                    modules: ["missions", "donjons"],
                    permission: (u) => u.canManagePoints,
                    tourId: "admin-overview-card-points",
                    dofusAsset: "/assets/dofus/modules/kama.png",
                },
            ],
        },
        {
            label: "Supervision & Sécurité",
            icon: Shield,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/logs`,
                    icon: FileText,
                    title: "Audit Logs",
                    description: "Traçabilité totale des actions du staff pour une sécurité maximale.",
                    accent: "slate",
                    permission: (u) => u.canViewAuditLogs,
                    tourId: "admin-overview-card-logs",
                    dofusAsset: "/assets/dofus/modules/hourglass.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/api-keys`,
                    icon: Key,
                    title: "Clés d'API & Dev",
                    description: "Générez des jetons d'accès programmatiques sécurisés (Bearer Token) pour vos applications tierces.",
                    accent: "amber",
                    permission: (u) => u.isAdmin,
                    tourId: "admin-overview-card-api-keys",
                    dofusAsset: "/assets/dofus/modules/key.png",
                },
            ],
        },
    ];
}

// Accent color map → Tailwind classes (static strings for purge safety)
// #5 — Accent unique emerald (fini l'arc-en-ciel par carte admin)
const ACCENT: Record<string, { border: string; hover: string; text: string; bg: string }> = {
    violet: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    blue: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    slate: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    indigo: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    green: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    emerald: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    amber: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    rose: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    cyan: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
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

    // Hard gate: must be a real member to even attempt admin access
    if (!user.isMember) {
        await logAdminAccessDenied(guildId, "/admin");
        return <AccessDenied />;
    }

    // Fetch configurations
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { dofusServerId: true, rolesMapping: true }
    });
    const isDofusConfigured = !!guild?.dofusServerId;

    // Helper unique (fail-closed : @everyone exclu), cohérent getting-started
    // + /admin/modules — le test inline historique divergeait (pas d'exclusion).
    const { isRbacConfigured } = await import("@/lib/onboarding-gating");
    const rbacConfigured = isRbacConfigured(
        (guild?.rolesMapping as Record<string, string[]>) || {},
        guildId
    );

    const sections = buildSections(guildId);

    // Refonte onboarding §9 — filtre modules : une carte liée à des modules tous
    // désactivés (toggle guilde OFF ou verrou God) disparaît du panel.
    const { getGuildModules } = await import("@/server/actions/module-actions");
    const effectiveModules = await getGuildModules(guildId).catch(() => null) as unknown as Record<string, boolean> | null;
    const cardVisibleFor = (card: AdminCard): boolean => {
        if (!user.isSuperAdmin) {
            if (typeof card.permission === 'function') {
                if (!card.permission(user)) return false;
            } else if (!user.isAdmin) {
                return false;
            }
        }
        if (!card.modules) return true;
        if (!effectiveModules) return true;
        const keys = Array.isArray(card.modules) ? card.modules : [card.modules];
        return keys.some((k) => !!effectiveModules[k]);
    };

    // Check if any management card is visible for this user
    const hasVisibleCards = sections.some(section =>
        section.cards.some(card => cardVisibleFor(card))
    );

    // Allow access if user is admin OR has at least one visible management tool.
    // NOTE: isAdmin requires either Discord admin bit OR explicit SYSTEM_GOD in RBAC —
    // it is never granted via the noRolesConfigured fallback.
    const hasAnyAdminPermission = user.isAdmin || hasVisibleCards;

    if (!hasAnyAdminPermission) {
        // 🛡️ NOTE: Member is authenticated but lacks admin/management permissions.
        // This is normal (member without any staff role) — no need to log as a security event.
        return <AccessDenied />;
    }


    return (
        <div className="space-y-16 pb-32 max-w-[1600px] mx-auto pt-10 px-6">
            <div data-tour="admin-overview-header">
                <UnifiedModuleHeader
                    title="Staff"
                    description="Vos modules et outils de modération — filtrés par vos droits et les modules activés."
                    icon={Shield}
                    iconColor="#f43f5e"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleHelpActions docSlug="admin-getting-started" docTitle="Guide de Démarrage Admin" tourPhase="adminOverview" />}
                />
            </div>

            <div className="space-y-24">
                {sections.map((section) => {
                    const visibleCards = section.cards.filter(card => cardVisibleFor(card));

                    if (visibleCards.length === 0) return null;

                    const SectionIcon = section.icon;
                    const sectionTourId = section.label === "Structure & Configuration"
                        ? "admin-overview-structure"
                        : section.label === "Opérations & Gestion"
                            ? "admin-overview-operations"
                            : "admin-overview-supervision";

                    return (
                        <div key={section.label} data-tour={sectionTourId} className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-300">
                            {/* Section header: Industrial Tech Style */}
                            <div className="flex items-center gap-6">
                                <div className="p-2.5 rounded-2xl bg-danger/10 border border-danger/20 ">
                                    <SectionIcon className="w-5 h-5 text-danger" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-caption font-black uppercase tracking-widest text-danger/80">
                                        {section.label}
                                    </h2>
                                    <div className="h-0.5 w-24 bg-gradient-to-r from-danger to-transparent" />
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
                            </div>

                            {/* Cards grid: High-End HUD Slots */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {visibleCards.map((card) => {
                                    let warningBadge: string | undefined;
                                    if (card.title === "Paramètres Généraux" && !isDofusConfigured) {
                                        warningBadge = "Config. Requise";
                                    }
                                    if (card.title === "Rôles & Permissions" && !rbacConfigured) {
                                        warningBadge = "Rôle Requis";
                                    }

                                    return (
                                        <AdminCard
                                            key={card.href}
                                            href={card.href}
                                            iconName={(card.icon as any).displayName || (card.icon as any).name}
                                            title={card.title}
                                            description={card.description}
                                            accent={card.accent}
                                            guildId={guildId}
                                            initialPinned={user.pinnedNavItems?.includes(card.href) || false}
                                            warningBadge={warningBadge}
                                            tourId={card.tourId}
                                            dofusAsset={card.dofusAsset}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Platform Terminal Status */}
            <div className="max-w-2xl mx-auto pt-20">
                <div className="p-8 rounded-[2rem] border border-border bg-surface backdrop-blur-sm relative overflow-hidden group">
                    <div className="flex flex-col items-center gap-6 text-center relative z-10">
                        <div className="h-1 w-12 bg-danger/40 rounded-full" />
                        <div className="space-y-2">
                             <h4 className="text-caption font-black text-muted-foreground uppercase tracking-widest">SigilOS Command Center</h4>
                             <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight italic">Toutes les actions administratives sont tracées dans l'Audit Log.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
