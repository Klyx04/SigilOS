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
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

type HubCard = {
    href: string;
    icon: any;
    title: string;
    description: string;
    accent: "emerald" | "amber" | "indigo" | "violet" | "rose" | "cyan" | "slate";
    visible: boolean;
};

// #5 — Accent unique emerald (fini l'arc-en-ciel par carte)
const ACCENT = {
    emerald: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    amber: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    indigo: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    violet: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    rose: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    cyan: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
    slate: { border: "hover:border-success/40", hover: "hover:bg-success/5", text: "text-success", bg: "bg-success/10" },
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
                actions={<ModuleHelpActions docSlug="members" docTitle="Annuaire & Information" tourPhase="annuaire" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-300">
                {cards.map((card) => {
                    const Icon = card.icon;
                    const a = ACCENT[card.accent];
                    
                    if (!card.visible) return null;

                    return (
                        <Link key={card.href} href={card.href} className="group outline-none focus-visible:ring-2 focus-visible:ring-success/50 rounded-2xl">
                            <div className={cn(
                                "relative flex flex-col h-full rounded-2xl border border-border bg-foreground/[0.02] p-8 transition-colors duration-200 hover:border-success/40 hover:bg-foreground/[0.04] overflow-hidden"
                            )}>
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className={cn(
                                            "w-14 h-14 rounded-xl flex items-center justify-center border",
                                            a.bg,
                                            a.border.replace("hover:", "")
                                        )}>
                                            <Icon className={cn("w-7 h-7", a.text)} strokeWidth={1.5} />
                                        </div>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                        <h3 className="text-title font-bold text-foreground leading-tight">
                                            {card.title}
                                        </h3>
                                        <p className="text-body-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                                            {card.description}
                                        </p>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                                        <div className={cn(
                                            "flex items-center gap-2 text-caption font-semibold",
                                            a.text,
                                            "opacity-50 group-hover:opacity-100"
                                        )}>
                                            <span className="group-hover:translate-x-0.5 transition-transform">Consulter</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
