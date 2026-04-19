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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Library, Flame, BookOpen, Link2, Tv } from "lucide-react";

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
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
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
            <UnifiedModuleHeader
                title="Ressources Dofus"
                description="Hub centralisé : Almanax, actualités Ankama et outils communautaires."
                icon={Library}
                iconColor="#a855f7"
                backHref={`/dashboard/${guildId}`}
            />

            <Tabs defaultValue={initialTab} className="w-full">
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <TabsList className="inline-flex h-auto w-max min-w-full justify-start md:justify-center p-1.5 bg-zinc-950/50 border border-white/5 rounded-2xl gap-1 font-mono backdrop-blur-xl">
                        <TabsTrigger
                            value="almanax"
                            className="relative px-6 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500 data-[state=active]:border-amber-500/20 border border-transparent shadow-none transition-all duration-300 group
                                     after:absolute after:right-[-0.5px] after:top-[25%] after:h-[50%] after:w-px after:bg-white/5 last:after:hidden data-[state=active]:after:hidden"
                        >
                            <Flame className="w-4 h-4 mr-2 group-data-[state=active]:animate-pulse" />
                            Almanax
                        </TabsTrigger>
                        <TabsTrigger
                            value="news"
                            className="relative px-6 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 data-[state=active]:border-blue-500/20 border border-transparent shadow-none transition-all duration-300 group
                                     after:absolute after:right-[-0.5px] after:top-[25%] after:h-[50%] after:w-px after:bg-white/5 last:after:hidden data-[state=active]:after:hidden"
                        >
                            <BookOpen className="w-4 h-4 mr-2 group-data-[state=active]:animate-pulse" />
                            Actualités
                        </TabsTrigger>
                        <TabsTrigger
                            value="encyclopedia"
                            className="relative px-6 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/20 border border-transparent shadow-none transition-all duration-300 group
                                     after:absolute after:right-[-0.5px] after:top-[25%] after:h-[50%] after:w-px after:bg-white/5 last:after:hidden data-[state=active]:after:hidden"
                        >
                            <Library className="w-4 h-4 mr-2 group-data-[state=active]:animate-pulse" />
                            Encyclopédie
                        </TabsTrigger>
                        <TabsTrigger
                            value="creators"
                            className="relative px-6 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 data-[state=active]:border-red-500/20 border border-transparent shadow-none transition-all duration-300 group
                                     after:absolute after:right-[-0.5px] after:top-[25%] after:h-[50%] after:w-px after:bg-white/5 last:after:hidden data-[state=active]:after:hidden"
                        >
                            <Tv className="w-4 h-4 mr-2 group-data-[state=active]:animate-pulse" />
                            Créateurs
                        </TabsTrigger>
                        <TabsTrigger
                            value="links"
                            className="px-6 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20 border border-transparent shadow-none transition-all duration-300 group"
                        >
                            <Link2 className="w-4 h-4 mr-2 group-data-[state=active]:animate-pulse" />
                            Liens & Outils
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── Almanax ─────────────────────────────────────────────── */}
                <TabsContent value="almanax" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                    <section>
                        <SectionHeader icon={Flame} color="#f59e0b" label="Almanax — Hub Temporel" />
                        <Suspense fallback={<GenericSkeleton height="350px" />}>
                            <AlmanaxSection />
                        </Suspense>
                    </section>
                </TabsContent>

                {/* ── Actualités News ────────────────────────────────────── */}
                <TabsContent value="news" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                    <section>
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
                </TabsContent>

                {/* ── Encyclopédie Full Width ────────────────────────────── */}
                <TabsContent value="encyclopedia" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                    <section>
                        <SectionHeader icon={Library} color="#a855f7" label="Nexus Encyclopédique — Multi-Sources" />
                        <ItemSearchPanel />
                    </section>
                </TabsContent>

                {/* ── Créateurs de Contenu ────────────────────────────────── */}
                <TabsContent value="creators" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                    <section>
                        <SectionHeader icon={Tv} color="#ef4444" label="Elite Creators Hub — Live & Replay" />
                        <CreatorsWidget guildId={guildId} isSuperAdmin={user.isSuperAdmin} />
                    </section>
                </TabsContent>

                {/* ── Liens Rapides ────────────────────────────────────────── */}
                <TabsContent value="links" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                    <section>
                        <SectionHeader icon={Link2} color="#10b981" label="Bibliothèque de Liens & Outils" />
                        <UsefulLinksGrid guildId={guildId} isSuperAdmin={user.isSuperAdmin} />
                    </section>
                </TabsContent>
            </Tabs>
        </div>
    );
}
