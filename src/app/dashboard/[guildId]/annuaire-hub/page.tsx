import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import Link from "next/link";
import { 
    Users, 
    Sparkles, 
    BookOpen, 
    Hammer, 
    ArrowRight, 
    Info,
    FileText,
    Library
} from "lucide-react";
import { cn } from "@/lib/utils";

type HubCard = {
    href: string;
    icon: any;
    title: string;
    description: string;
    accent: "emerald" | "amber" | "indigo" | "violet" | "rose" | "cyan" | "slate";
    visible: boolean;
};

const ACCENT = {
    emerald: { border: "hover:border-emerald-500/50", hover: "hover:bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { border: "hover:border-amber-500/50", hover: "hover:bg-amber-500/5", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    indigo: { border: "hover:border-indigo-500/50", hover: "hover:bg-indigo-500/5", text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    violet: { border: "hover:border-violet-500/50", hover: "hover:bg-violet-500/5", text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
    rose: { border: "hover:border-rose-500/50", hover: "hover:bg-rose-500/5", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
    cyan: { border: "hover:border-cyan-500/50", hover: "hover:bg-cyan-500/5", text: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10" },
    slate: { border: "hover:border-slate-500/50", hover: "hover:bg-slate-500/5", text: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10" },
};

export default async function AnnuaireHubPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    const cards: HubCard[] = [
        {
            href: `/dashboard/${guildId}/welcome`,
            icon: Sparkles,
            title: "Bienvenue",
            description: "Module d'onboarding pour les nouveaux membres. Découvrez les bases de la guilde.",
            accent: "emerald",
            visible: !!user.canViewWelcome,
        },
        {
            href: `/dashboard/${guildId}/presentation`,
            icon: BookOpen,
            title: "Présentation",
            description: "Histoire, objectifs et valeurs de la guilde. Comprenez qui nous sommes.",
            accent: "indigo",
            visible: !!(user.isMember && user.canViewPresentation),
        },
        {
            href: `/dashboard/${guildId}/stats`,
            icon: Hammer,
            title: "Stats Guilde",
            description: "Indicateurs de performance, activité globale et progression de la guilde.",
            accent: "amber",
            visible: !!(user.isMember && user.canViewStats),
        },
        {
            href: `/docs`,
            icon: Library,
            title: "Documentation",
            description: "Wiki complet de SigilOS. Guides techniques et manuel d'utilisation.",
            accent: "cyan",
            visible: !!(user.isMember && user.canViewDocs),
        },
        {
            href: `/dashboard/${guildId}/members`,
            icon: Users,
            title: "Annuaire des Membres",
            description: "Liste complète des membres, leurs métiers et leur date d'arrivée.",
            accent: "violet",
            visible: !!(user.isMember && user.canViewRoster),
        }
    ];

    return (
        <div className="space-y-16 pb-32 max-w-[1600px] mx-auto pt-10 px-6">
            <UnifiedModuleHeader
                title="Annuaire & Information"
                description="Centre de connaissances de la guilde • Tout ce qu'il faut savoir pour bien s'intégrer."
                icon={Info}
                iconColor="#10b981"
                backHref={`/dashboard/${guildId}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-300">
                {cards.map((card) => {
                    const Icon = card.icon;
                    const a = ACCENT[card.accent];
                    
                    if (!card.visible) return null;

                    return (
                        <Link key={card.href} href={card.href} className="group outline-none">
                            <div className={cn(
                                "relative flex flex-col h-full rounded-[2.5rem] border border-border bg-foreground/[0.02] p-8 transition-all duration-300 hover:border-border hover:bg-foreground/[0.04] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden",
                                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-foreground/[0.05] before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-300"
                            )}>
                                <div className={cn(
                                    "absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-full z-0",
                                    a.bg
                                )} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border group- group-hover:rotate-3 shadow-xl",
                                            a.bg,
                                            a.border.replace("hover:", "")
                                        )}>
                                            <Icon className={cn("w-7 h-7", a.text)} strokeWidth={1.5} />
                                        </div>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                        <h3 className="text-xl font-black text-foreground tracking-tighter uppercase leading-tight">
                                            {card.title}
                                        </h3>
                                        <p className="text-body-sm text-muted-foreground font-black leading-relaxed group-hover:text-foreground transition-colors italic">
                                            {card.description}
                                        </p>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                                        <div className={cn(
                                            "flex items-center gap-2 text-caption font-black uppercase tracking-[0.2em] transition-all",
                                            a.text,
                                            "opacity-40 group-hover:opacity-100"
                                        )}>
                                            <span className="group-hover:translate-x-1 transition-transform">Consulter</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
