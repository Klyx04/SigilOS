import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { OcreDashboard, KralamoureWidget, NotLinkedState, OcreSyncButton, OcreTradeInbox } from "@/components/ocre";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, AlertCircle, Link2, Sparkles, Crown } from "lucide-react";
import { db } from "@/lib/prisma";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { EmptyState } from "@/components/ui/empty-state";
import { isModuleEnabled } from "@/server/actions/module-actions";

export const dynamic = "force-dynamic";

export default async function QueteOcrePage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Module guard
    if (!await isModuleEnabled(guildId, "ocre")) {
        redirect(`/dashboard/${guildId}`);
    }

    // RBAC: Check permission to view Archis (TODO: Rename to OCRE_VIEW when permissions updated)
    const user = await getUserContext(guildId);
    if (!user.canViewArchis) {
        return <AccessDenied />;
    }


    // Fetch user's Quête Ocre data
    const ocreResponse = await getMyOcreProgress(guildId);

    // Fetch if guild has Ocre discord channel
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { ocreNotifyChannelId: true } as any
    }) as any;
    const hasOcreChannel = !!guildConfig?.ocreNotifyChannelId;

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <UnifiedModuleHeader
                    title="Quête Ocre"
                    description="Suivez votre progression sur la Quête de l'Éternelle Moisson et trouvez des partenaires d'échange."
                    icon={Crown}
                    iconColor="#f59e0b"
                    backHref={`/dashboard/${guildId}`}
                    actions={<OcreSyncButton guildId={guildId} />}
                />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    {/* Main Content */}
                    <div className="space-y-6">
                        {ocreResponse.success && ocreResponse.data ? (
                            <div className="space-y-6">
                                <OcreTradeInbox guildId={guildId} />
                                <OcreDashboard data={ocreResponse.data} guildId={guildId} hasOcreChannel={hasOcreChannel} />
                            </div>
                        ) : (
                            <NotLinkedState guildId={guildId} error={ocreResponse.error} />
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="hidden lg:block space-y-6">
                        <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
                            <KralamoureWidget guildId={guildId} canManageCalendar={user.canManageCalendar} />
                        </Suspense>

                        {/* Quick Tips */}
                        <Card className="bg-card/30 backdrop-blur-sm border-white/10">
                            <CardContent className="p-4 space-y-3">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-400" />
                                    Astuces
                                </h3>
                                <ul className="text-xs text-muted-foreground space-y-2">
                                    <li className="flex gap-2">
                                        <span className="text-amber-500">•</span>
                                        Mettez à jour votre compte Metamob régulièrement
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-emerald-500">•</span>
                                        Les monstres verts peuvent être échangés par des guildeux
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-purple-500">•</span>
                                        Surveillez les apparitions de Kralamoure
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    );
}

