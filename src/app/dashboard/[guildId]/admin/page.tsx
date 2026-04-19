import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { cn } from "@/lib/utils";
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
    Bell,
    Activity,
    ShieldAlert,
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
                },
                {
                    href: `/dashboard/${guildId}/admin/permissions`,
                    icon: Shield,
                    title: "Rôles & Permissions",
                    description: "Gestion fine des accès. Définissez qui peut valider, modérer ou administrer.",
                    accent: "blue",
                    permission: (u) => u.isDiscordAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/modules`,
                    icon: Puzzle,
                    title: "Gestion des Modules",
                    description: "Activez ou désactivez les fonctionnalités (Chat, Songe, Ocre, etc.) pour votre guilde.",
                    accent: "violet",
                    permission: (u) => u.isDiscordAdmin,
                },
                {
                    href: `/dashboard/${guildId}/admin/presentation`,
                    icon: BookOpen,
                    title: "Identité de Guilde",
                    description: "Édition de la page publique, recrutement et présentation des objectifs.",
                    accent: "indigo",
                    permission: (u) => u.canEditPresentation,
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
                    permission: (u) => u.canManageMissions,
                },
                {
                    href: `/dashboard/${guildId}/admin/validation`,
                    icon: CheckCircle,
                    title: "Validation Preuves",
                    description: "Centre de tri des screens. Récompensez les efforts de vos membres.",
                    accent: "green",
                    permission: (u) => u.canValidateMissions,
                },
                {
                    href: `/dashboard/${guildId}/admin/members`,
                    icon: Users,
                    title: "Gestion des Membres",
                    description: "Annuaire admin, synchronisation des pseudos, archivage et relances Discord.",
                    accent: "cyan",
                    permission: (u) => u.canManageMembers || u.canManageRelance,
                },
                {
                    href: `/dashboard/${guildId}/admin/bounties`,
                    icon: ShieldAlert,
                    title: "Gestion des Avis",
                    description: "Édition des mécaniques, doplons, zones et visuels des avis de recherche.",
                    accent: "rose",
                    permission: (u) => u.canManageMissions || u.isDiscordAdmin,
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
    
    const sections = buildSections(guildId);
    
    // Check if any management card is visible for this user
    const hasVisibleCards = sections.some(section => 
        section.cards.some(card => {
            if (user.isSuperAdmin) return true;
            if (typeof card.permission === 'function') return card.permission(user);
            return user.isAdmin;
        })
    );

    // Allow access if user is admin OR has at least one visible management tool
    const hasAnyAdminPermission = user.isAdmin || hasVisibleCards;

    if (!hasAnyAdminPermission) {
        await logAdminAccessDenied(guildId, "/admin");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-16 pb-32 max-w-[1600px] mx-auto pt-10 px-6">
            <UnifiedModuleHeader
                title="Supervision"
                description="Administration centrale de la guilde • Contrôle des systèmes et monitoring des opérations."
                icon={Shield}
                iconColor="#f43f5e"
                backHref={`/dashboard/${guildId}`}
            />

            <div className="space-y-24">
                {sections.map((section) => {
                    const visibleCards = section.cards.filter(card => {
                        if (user.isSuperAdmin) return true;
                        if (typeof card.permission === 'function') return card.permission(user);
                        return user.isAdmin;
                    });

                    if (visibleCards.length === 0) return null;

                    const SectionIcon = section.icon;
                    return (
                        <div key={section.label} className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Section header: Industrial Tech Style */}
                            <div className="flex items-center gap-6">
                                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                                    <SectionIcon className="w-5 h-5 text-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-500/80">
                                        {section.label}
                                    </h2>
                                    <div className="h-0.5 w-24 bg-gradient-to-r from-rose-500 to-transparent" />
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
                            </div>

                            {/* Cards grid: High-End HUD Slots */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {visibleCards.map((card) => {
                                    const Icon = card.icon;
                                    const a = ACCENT[card.accent] ?? ACCENT.slate;
                                    
                                    return (
                                        <Link key={card.href} href={card.href} className="group outline-none">
                                            <div className={cn(
                                                "relative flex flex-col h-full rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 transition-all duration-700 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden",
                                                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.05] before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-700"
                                            )}>
                                                {/* Card Accent Glow */}
                                                <div className={cn(
                                                    "absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 rounded-full z-0",
                                                    a.bg
                                                )} />

                                                <div className="relative z-10 flex flex-col h-full">
                                                    {/* Header: Icon & Tech ID */}
                                                    <div className="flex items-center justify-between mb-8">
                                                        <div className={cn(
                                                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border group-hover:scale-110 group-hover:rotate-3 shadow-xl",
                                                            a.bg,
                                                            a.border.replace("hover:", "")
                                                        )}>
                                                            <Icon className={cn("w-7 h-7", a.text)} strokeWidth={1.5} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-white/10 uppercase tracking-widest font-mono">
                                                            {card.accent === 'rose' ? 'SEC.V4' : 'INT.GEN'}
                                                        </span>
                                                    </div>

                                                    {/* Body: Title & Intro */}
                                                    <div className="space-y-4 flex-1">
                                                        <h3 className="text-xl font-black text-white tracking-tighter uppercase leading-tight">
                                                            {card.title}
                                                        </h3>
                                                        <p className="text-[13px] text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">
                                                            {card.description}
                                                        </p>
                                                    </div>

                                                    {/* Footer: Action & Decoration */}
                                                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                                        <div className={cn(
                                                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                                                            a.text,
                                                            "opacity-40 group-hover:opacity-100"
                                                        )}>
                                                            <span className="group-hover:translate-x-1 transition-transform">Accès Panel</span>
                                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                                        </div>
                                                        
                                                        {/* Industrial Corner Detail */}
                                                        <div className="flex gap-1">
                                                            {[...Array(3)].map((_, i) => (
                                                                <div key={i} className="h-1 w-1 rounded-full bg-white/5 group-hover:bg-white/20 transition-colors" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Corner Decoration */}
                                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                                                    <div className="h-[1px] w-12 bg-white/40" />
                                                    <div className="h-12 w-[1px] bg-white/40 absolute top-3 right-3" />
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

            {/* Platform Terminal Status */}
            <div className="max-w-2xl mx-auto pt-20">
                <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.01] backdrop-blur-sm relative overflow-hidden group">
                    <div className="flex flex-col items-center gap-6 text-center relative z-10">
                        <div className="h-1 w-12 bg-rose-500/40 rounded-full" />
                        <div className="space-y-2">
                             <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">SigilOS Command Center</h4>
                             <p className="text-xs text-zinc-600 font-bold uppercase tracking-tight italic">Toutes les actions administratives sont tracées dans l'Audit Log.</p>
                        </div>
                        <div className="flex items-center gap-8">
                             <div className="flex flex-col items-center">
                                 <span className="text-[10px] font-black text-zinc-700 uppercase mb-1">Status</span>
                                 <span className="text-[9px] font-black text-emerald-500 px-2 py-0.5 border border-emerald-500/20 rounded-md bg-emerald-500/5 animate-pulse">ESTABLISHED</span>
                             </div>
                             <div className="flex flex-col items-center">
                                 <span className="text-[10px] font-black text-zinc-700 uppercase mb-1">Version</span>
                                 <span className="text-[9px] font-bold text-zinc-500">v4.2.0-STABLE</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
