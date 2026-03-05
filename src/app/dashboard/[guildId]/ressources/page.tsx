import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { AlmanaxWidget } from "@/components/ressources/AlmanaxWidget";
import { NewsGrid } from "@/components/ressources/NewsGrid";
import { UsefulLinksGrid } from "@/components/ressources/UsefulLinksGrid";
import { ServerTimersPanel } from "@/components/ressources/ServerTimersPanel";
import { ItemSearchPanel } from "@/components/ressources/ItemSearchPanel";
import { CreatorsWidget } from "@/components/ressources/CreatorsWidget";
import { Library, Flame, BookOpen, Link2 } from "lucide-react";

export const metadata = {
    title: "Ressources Communautaires | SigilOS",
    description: "Hub centralisé : Almanax, actualités Ankama, guides, builds et outils communautaires Dofus.",
};

type Props = { params: Promise<{ guildId: string }> };

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionHeader({
    icon: Icon,
    color,
    label,
}: {
    icon: typeof Flame;
    color: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
                {label}
            </h2>
            <div className="flex-1 h-px bg-white/5" />
        </div>
    );
}

// ─── Skeleton fallback ────────────────────────────────────────────────────────

function AlmanaxSkeleton() {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-[#13171A] p-6 h-72 animate-pulse" />
            <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-white/3 animate-pulse" />
                ))}
            </div>
        </div>
    );
}

// ─── Data components (server-side) ────────────────────────────────────────────

async function AlmanaxSection() {
    const items = await getUpcomingAlmanax();
    return <AlmanaxWidget items={items} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RessourcesPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewResources) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "resources");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="space-y-10 pb-16">
            {/* ── Header ──────────────────────────────────────────────── */}
            <UnifiedModuleHeader
                title="Ressources"
                description="Hub centralisé : Almanax, actualités Ankama et outils communautaires."
                icon={Library}
                iconColor="#a855f7"
                backHref={`/dashboard/${guildId}`}
            />

            {/* ── Almanax ─────────────────────────────────────────────── */}
            <section>
                <SectionHeader icon={Flame} color="#f59e0b" label="Almanax — 7 jours & filtres 3 mois" />
                <Suspense fallback={<AlmanaxSkeleton />}>
                    <AlmanaxSection />
                </Suspense>
            </section>

            {/* ── Actualités ──────────────────────────────────────────── */}
            <section>
                <SectionHeader icon={BookOpen} color="#3b82f6" label="Actualités & Outils" />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                    <div className="lg:col-span-3">
                        <NewsGrid />
                    </div>
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <ServerTimersPanel />
                        <ItemSearchPanel />
                    </div>
                </div>
            </section>

            {/* ── Sites communautaires ──────────────────────────────────────── */}
            <section>
                <SectionHeader icon={Link2} color="#10b981" label="Sites Communautaires & Créateurs" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <div className="lg:col-span-2">
                        <UsefulLinksGrid />
                    </div>
                    <div className="lg:col-span-1 h-full">
                        <CreatorsWidget guildId={guildId} />
                    </div>
                </div>
            </section>
        </div>
    );
}
