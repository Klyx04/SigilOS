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
import { ItemSearchPanel } from "@/components/ressources/ItemSearchPanel";
import { CreatorsWidget } from "@/components/ressources/CreatorsWidget";
import { Library, Flame, BookOpen, Link2, Tv } from "lucide-react";
import { ResourcesTabs } from "@/components/ressources/ResourcesTabs";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

export const metadata = {
    title: "Ressources Dofus | SigilOS",
    description: "Hub centralisé : Almanax, actualités Ankama, guides, builds et outils communautaires Dofus.",
};

type Props = { 
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ tab?: string }>;
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionHeader({
    icon: Icon,
    color,
    label,
}: {
    icon: any;
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
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                {label}
            </h2>
            <div className="flex-1 h-px bg-white/5" />
        </div>
    );
}

// ─── Skeleton fallback ────────────────────────────────────────────────────────

function GenericSkeleton({ height = "200px" }: { height?: string }) {
    return (
        <div
            className="w-full rounded-2xl border border-white/5 bg-[#13171A] p-6 animate-pulse"
            style={{ height }}
        />
    );
}

// ─── Data components (server-side) ────────────────────────────────────────────

async function AlmanaxSection() {
    const items = await getUpcomingAlmanax();
    return <AlmanaxWidget items={items} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RessourcesPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { tab } = await searchParams;
    const initialTab = tab || "almanax";

    const user = await getUserContext(guildId);
    if (!user.canViewResources) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "resources");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="space-y-12 pb-24">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div data-tour="ressources-header">
                <UnifiedModuleHeader
                    title="Ressources Dofus"
                    description="Hub centralisé : Almanax, actualités Ankama et outils communautaires."
                    icon={Library}
                    iconColor="#a855f7"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="ressources" />}
                />
            </div>

            <ResourcesTabs 
                initialTab={initialTab}
                guildId={guildId}
                isSuperAdmin={user.isSuperAdmin}
                almanaxSection={
                    <section data-tour="ressources-almanax">
                        <SectionHeader icon={Flame} color="#f59e0b" label="Almanax — Hub Temporel" />
                        <Suspense fallback={<GenericSkeleton height="350px" />}>
                            <AlmanaxSection />
                        </Suspense>
                    </section>
                }
                newsSection={
                    <section data-tour="ressources-news">
                        <SectionHeader icon={BookOpen} color="#3b82f6" label="Actualités des Mondes — Ankama & DPLN" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Left: Ankama News */}
                            <NewsGrid defaultFeed="news" title="Official Ankama News" maxItems={6} showKralamoure={false} />
                            {/* Right: DPLN */}
                            <NewsGrid defaultFeed="dpln" title="Dofuspourlesnoobs (DPLN)" maxItems={6} showKralamoure={false} />
                        </div>

                        {/* Bottom: Patch Notes Full Width */}
                        <div className="mt-12 pt-12 border-t border-white/10">
                            <NewsGrid defaultFeed="changelog" title="Dofus Patch Notes & Correctifs" maxItems={5} layout="list" />
                        </div>
                    </section>
                }
                encyclopediaSection={
                    <section>
                        <SectionHeader icon={Library} color="#a855f7" label="Nexus Encyclopédique — Multi-Sources" />
                        <ItemSearchPanel />
                    </section>
                }
                creatorsSection={
                    <section>
                        <SectionHeader icon={Tv} color="#ef4444" label="Elite Creators Hub — Live & Replay" />
                        <CreatorsWidget guildId={guildId} isSuperAdmin={user.isSuperAdmin} />
                    </section>
                }
                linksSection={
                    <section data-tour="ressources-links">
                        <SectionHeader icon={Link2} color="#10b981" label="Bibliothèque de Liens & Outils" />
                        <UsefulLinksGrid guildId={guildId} isSuperAdmin={user.isSuperAdmin} />
                    </section>
                }
            />
        </div>
    );
}
