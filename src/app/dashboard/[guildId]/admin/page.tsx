import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { PERMISSIONS } from "@/lib/permissions";
import { db } from "@/lib/prisma";
import Link from "next/link";
import {
    Shield,
    Settings,
    FileText,
    CheckCircle,
    Swords,
    Sparkles,
    Users,
    BookOpen,
    ArrowRight,
    Coins,
    Ticket,
    Key,
    Terminal,
    CalendarClock,
    ChevronLeft,
} from "lucide-react";
import { AdminCard } from "@/components/admin/admin-card";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

// ============================================================================
// TYPES
// ============================================================================

type AdminCardDef = {
    href: string;
    icon: React.ElementType;
    title: string;
    description: string;
    accent: string; // Conservé pour compatibilité — rendu unique (norme registre).
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
    hint: string;
    icon: React.ElementType;
    cards: AdminCardDef[];
};

// ============================================================================
// DATA
// ============================================================================

function buildSections(guildId: string): AdminSection[] {
    return [
        {
            label: "Structure & configuration",
            hint: "Accès, salons, identité — les fondations avant tout le reste.",
            icon: Settings,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/settings`,
                    icon: Settings,
                    title: "Paramètres généraux",
                    description: "Intégrations Discord, Metamob, Dofus et configuration globale de la plateforme.",
                    accent: "amber",
                    permission: (u) => u.canViewSettings,
                    tourId: "admin-overview-card-settings",
                    dofusAsset: "/assets/dofus/modules/guildBonus.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/permissions`,
                    icon: Shield,
                    title: "Rôles & permissions",
                    description: "Gestion fine des accès. Définissez qui peut valider, modérer ou administrer.",
                    accent: "blue",
                    permission: (u) => u.canManageRBAC,
                    tourId: "admin-overview-card-permissions",
                    dofusAsset: "/assets/dofus/modules/guildShop.png",
                },
                {
                    href: `/dashboard/${guildId}/reaction-roles`,
                    icon: Sparkles,
                    title: "Rôles par réaction",
                    description: "Panneaux de sélection de rôles interactifs avec boutons, menus déroulants et icônes pour Discord.",
                    accent: "violet",
                    modules: "reactionRoles",
                    permission: (u) => u.canManageReactionRoles,
                    tourId: "admin-overview-card-reaction-roles",
                    dofusAsset: "/assets/dofus/modules/starShield.png",
                },
                {
                    // Module **staff** : sa place est ici, dans le Centre de contrôle, jamais
                    // dans la navigation des membres. La permission `staff:scheduled_polls`
                    // suffit à ouvrir la carte (et donc le bouton « Staff » de la sidebar).
                    href: `/dashboard/${guildId}/admin/sondages-programmes`,
                    icon: CalendarClock,
                    title: "Sondages programmés",
                    description: "Programmez un sondage (date, heure et minute) : publication automatique dans le salon Discord choisi, 3 créneaux maximum.",
                    accent: "cyan",
                    modules: "scheduledPolls",
                    permission: (u) => u.canSchedulePolls,
                    tourId: "admin-overview-card-scheduled-polls",
                    dofusAsset: "/assets/dofus/modules/chat.png",
                },
                {
                    href: `/dashboard/${guildId}/tickets`,
                    icon: Ticket,
                    title: "Tickets & support Discord",
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
                    title: "Commandes slash Discord",
                    description: "Gestion des commandes bot : restrictions par salon Discord, rôles autorisés et activation.",
                    accent: "emerald",
                    permission: (u) => u.canManageRBAC || u.isAdmin,
                    tourId: "admin-overview-card-slash-commands",
                    dofusAsset: "/assets/dofus/modules/chat.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/presentation`,
                    icon: BookOpen,
                    title: "Identité de guilde",
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
            label: "Opérations & gestion",
            hint: "Le quotidien du staff : missions, validation, membres, points.",
            icon: Swords,
            cards: [
                {
                    href: `/dashboard/${guildId}/missions/manage`,
                    icon: Swords,
                    title: "Gestion des missions",
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
                    title: "Membres & recrutement",
                    description: "Audit Discord vs Dashboard, registre du staff, essais, mules, archivage et relances Discord.",
                    accent: "cyan",
                    modules: "roster",
                    permission: (u) => u.canManageMembers || u.canManageRelance,
                    tourId: "admin-overview-card-members",
                    dofusAsset: "/assets/dofus/modules/social.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/points`,
                    icon: Coins,
                    title: "Points de contribution",
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
            label: "Supervision & sécurité",
            hint: "Traçabilité et accès programmatiques — le strict nécessaire.",
            icon: Shield,
            cards: [
                {
                    href: `/dashboard/${guildId}/admin/logs`,
                    icon: FileText,
                    title: "Audit logs",
                    description: "Traçabilité totale des actions du staff pour une sécurité maximale.",
                    accent: "slate",
                    permission: (u) => u.canViewAuditLogs,
                    tourId: "admin-overview-card-logs",
                    dofusAsset: "/assets/dofus/modules/hourglass.png",
                },
                {
                    href: `/dashboard/${guildId}/admin/api-keys`,
                    icon: Key,
                    title: "Clés d'API & dev",
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
    const cardVisibleFor = (card: AdminCardDef): boolean => {
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

    const visibleSections = sections
        .map((section) => ({
            ...section,
            visibleCards: section.cards.filter((card) => cardVisibleFor(card)),
        }))
        .filter((section) => section.visibleCards.length > 0);

    const totalVisible = visibleSections.reduce((n, s) => n + s.visibleCards.length, 0);
    const pendingSetup: { title: string; href: string }[] = [];
    if (!isDofusConfigured) {
        const settingsCard = visibleSections.flatMap((s) => s.visibleCards).find((c) => c.title === "Paramètres généraux");
        if (settingsCard) pendingSetup.push({ title: "Serveur Dofus à renseigner", href: settingsCard.href });
    }
    if (!rbacConfigured) {
        const rbacCard = visibleSections.flatMap((s) => s.visibleCards).find((c) => c.title === "Rôles & permissions");
        if (rbacCard) pendingSetup.push({ title: "Rôles staff à mapper", href: rbacCard.href });
    }

    return (
        <div className="reg-shell py-10 lg:py-14 space-y-10">
            {/* 1. Fil d'Ariane + en-tête sobre (norme registre) */}
            <div data-tour="admin-overview-header">
                <Link
                    href={`/dashboard/${guildId}`}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                    <span className="h-7 w-7 rounded-lg border border-border bg-surface/60 flex items-center justify-center">
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Dashboard
                </Link>

                <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <p className="reg-eyebrow">Centre de contrôle · Staff</p>
                        <h1 className="mt-2 text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight tracking-tight text-foreground">
                            Outils de modération
                        </h1>
                        <p className="mt-2 max-w-[42rem] text-sm text-muted-foreground leading-relaxed">
                            {totalVisible} panneau{totalVisible > 1 ? "x" : ""} accessible{totalVisible > 1 ? "s" : ""} — filtrés par vos droits et les modules activés.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <ModuleHelpActions docSlug="admin-getting-started" docTitle="Guide de Démarrage Admin" tourPhase="adminOverview" />
                    </div>
                </div>
            </div>

            {/* 2. À configurer — factuel, pas de badge dispersé */}
            {pendingSetup.length > 0 && (
                <div className="reg-panel p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <p className="text-sm text-foreground">
                        <span className="reg-mono text-xs font-semibold text-accent uppercase">À configurer · {pendingSetup.length}</span>
                        <span className="block mt-1 text-muted-foreground text-xs leading-relaxed">
                            {pendingSetup.map((s) => s.title).join(" — ")}. Sans cela, certains panneaux restent limités.
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        {pendingSetup.map((s) => (
                            <Link
                                key={s.href}
                                href={s.href}
                                className="reg-btn reg-btn-secondary !min-h-0 !py-1.5 !px-3 !text-xs"
                            >
                                {s.title}
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Sections — eyebrow + compteur mono + filet, grille sobre */}
            <div className="space-y-10">
                {visibleSections.map((section) => {
                    const sectionTourId =
                        section.label === "Structure & configuration"
                            ? "admin-overview-structure"
                            : section.label === "Opérations & gestion"
                                ? "admin-overview-operations"
                                : "admin-overview-supervision";

                    return (
                        <section key={section.label} data-tour={sectionTourId} aria-labelledby={`admin-${sectionTourId}`}>
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-border">
                                <div>
                                    <h2 id={`admin-${sectionTourId}`} className="reg-eyebrow">
                                        {section.label}
                                    </h2>
                                    <p className="mt-1 text-xs text-muted-foreground">{section.hint}</p>
                                </div>
                                <p className="reg-mono text-[11px] text-muted-foreground shrink-0">
                                    {section.visibleCards.length} panneau{section.visibleCards.length > 1 ? "x" : ""}
                                </p>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                                {section.visibleCards.map((card) => {
                                    let warningBadge: string | undefined;
                                    if (card.title === "Paramètres généraux" && !isDofusConfigured) {
                                        warningBadge = "Config. requise";
                                    }
                                    if (card.title === "Rôles & permissions" && !rbacConfigured) {
                                        warningBadge = "Rôle requis";
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
                                            tag={section.label.split(" ")[0]}
                                        />
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* 4. Traçabilité — une ligne factuelle + lien, pas un panneau marketing */}
            <p className="reg-mono pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Toutes les actions administratives sont tracées.</span>
                {visibleSections.flatMap((s) => s.visibleCards).some((c) => c.title === "Audit logs") ? (
                    <Link href={`/dashboard/${guildId}/admin/logs`} className="reg-link-quiet !text-accent hover:!text-foreground">
                        Voir l&apos;audit log
                    </Link>
                ) : null}
            </p>
        </div>
    );
}
