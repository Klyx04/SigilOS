import { getRoadmapItems, getPlatformConfig } from "@/server/actions/god-roadmap-actions";
import { getUserContext, getUserGuilds } from "@/server/actions/user-actions";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Rocket, CheckCircle2, Circle } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import { getAppBaseUrl } from "@/lib/utils";
import { getServerI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Roadmap | SigilOS",
    description: "Découvrez la feuille de route de SigilOS et les prochaines fonctionnalités.",
    alternates: {
        canonical: `${getAppBaseUrl()}/roadmap`,
    },
};

export default async function PublicRoadmapPage() {
    const session = await auth();
    const userContext = await getUserContext();
    const isAdmin = await isSuperAdmin();
    const { t } = await getServerI18n();

    const [itemsRes, configRes, userGuilds] = await Promise.all([
        getRoadmapItems(),
        getPlatformConfig(),
        getUserGuilds()
    ]);

    const isEnabled = configRes.success && configRes.data ? configRes.data.roadmapEnabled : false;
    const isInAnyGuild = userGuilds.length > 0;

    // Access condition:
    // 1. Super Admin bypass
    // 2. OR (Roadmap is enabled AND user belongs to at least one authorized guild)
    const hasAccess = isAdmin || (isEnabled && isInAnyGuild);

    if (!hasAccess) {
        redirect("/");
    }

    type RoadmapItem = {
        id: number;
        title: string;
        description: string;
        status: string;
        quarter: string;
        priority: string;
    };

    const allItems = (itemsRes.success ? itemsRes.data : []) as RoadmapItem[];

    // Group items by quarter
    const groupedItems = allItems.reduce((acc, item) => {
        if (!acc[item.quarter]) acc[item.quarter] = [];
        acc[item.quarter].push(item);
        return acc;
    }, {} as Record<string, RoadmapItem[]>);

    return (
        <div className="registre landing-theme relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-success/30">

            <PublicHeader user={session?.user} activePage="roadmap" isMember={userContext.isMember} />

            <main className="flex-1 pt-24 pb-12 relative z-10">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="mb-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t.roadmapPage.backHome}
                        </Link>
                    </div>

                    {/* Hero Header */}
                    <div className="relative rounded-2xl bg-surface/40 border border-border p-8 sm:p-12 mb-12">
                        <div className="relative z-10">
                            <h1 className="text-display-lg sm:text-display-xl font-bold text-foreground font-heading mb-4 flex items-center gap-3">
                                <Rocket className="h-8 w-8 text-warning" />
                                {t.roadmapPage.title}
                            </h1>
                            <p className="text-lg text-warning/80 max-w-2xl">
                                {t.roadmapPage.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Roadmap Timeline */}
                    <div className="space-y-12">
                        {Object.keys(groupedItems).length === 0 ? (
                            <div className="text-center py-16 bg-surface/30 border border-border rounded-xl">
                                <p className="text-muted-foreground text-lg">{t.roadmapPage.empty}</p>
                            </div>
                        ) : (
                            Object.entries(groupedItems).map(([quarter, items]) => (
                                <section key={quarter} className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-border/80 pb-3">
                                        <h2 className="text-2xl font-bold text-foreground tracking-tight">{quarter}</h2>
                                    </div>
                                    
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {items.map(item => (
                                            <div key={item.id} className="p-5 rounded-2xl bg-surface/60 border border-border hover:border-border transition-colors space-y-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                                                            {item.priority === "HIGH" && <span className="bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded text-caption font-semibold uppercase tracking-wider">Haut</span>}
                                                            {item.title}
                                                        </h3>
                                                    </div>
                                                    <div className="shrink-0 flex items-center">
                                                        {item.status === "DONE" && <Badge variant="outline" className="text-success border-success/30 bg-success/10 shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" />{t.roadmapPage.status.COMPLETED}</Badge>}
                                                        {item.status === "PROGRESS" && <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 shadow-none"><div className="w-2 h-2 rounded-full bg-warning mr-2 animate-pulse" />{t.roadmapPage.status.IN_PROGRESS}</Badge>}
                                                        {item.status === "TODO" && <Badge variant="outline" className="text-muted-foreground border-border bg-elevated/50 shadow-none"><Circle className="w-3 h-3 mr-1" />{t.roadmapPage.status.PLANNED}</Badge>}
                                                    </div>
                                                </div>
                                                <p className="text-muted-foreground text-sm leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
