import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { OcreDashboard, KralamoureWidget, NotLinkedState, OcreSyncButton } from "@/components/ocre";
import { MetamobLink } from "@/components/profile/metamob-link";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Crown } from "lucide-react";
import { db } from "@/lib/prisma";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

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

    // RBAC
    const user = await getUserContext(guildId);
    if (!user.canViewOcre) {
        return <AccessDenied />;
    }

    // Fetch user's Quête Ocre data
    const ocreResponse = await getMyOcreProgress(guildId);

    // Fetch user profile for Metamob info (required for linking state)
    // Note: use guild.discordGuildId (not guildId: user.id which is the userId) so the query
    // resolves correctly via the GuildConfig relation, identical to getMyOcreProgress.
    const profile = await db.userProfile.findFirst({
        where: {
            userId: session.user.id,
            guild: { discordGuildId: guildId },
            status: "ACTIVE"
        },
        select: {
            metamobPseudo: true,
            metamobVerified: true,
            metamobLastSync: true
        }
    });

    // Fetch if guild has Ocre discord channel
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { ocreNotifyChannelId: true }
    });
    const hasOcreChannel = !!guildConfig?.ocreNotifyChannelId;

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <div data-tour="ocre-header">
                    <UnifiedModuleHeader
                        title="Quête Ocre"
                        description="Suivez votre progression sur la Quête de l'Éternelle Moisson et trouvez des partenaires d'échange."
                        icon={Crown}
                        iconColor="#f59e0b"
                        backHref={`/dashboard/${guildId}`}
                        actions={
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <div data-tour="ocre-sync">
                                    <OcreSyncButton guildId={guildId} lastSync={ocreResponse.data?.lastSync} />
                                </div>
                                <ModuleTourReplayButton phase="ocre" />
                            </div>
                        }
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    {/* Main Content */}
                    <div className="space-y-6">
                        {ocreResponse.success && ocreResponse.data ? (
                            <div data-tour="ocre-dashboard">
                                <OcreDashboard data={ocreResponse.data} guildId={guildId} hasOcreChannel={hasOcreChannel} />
                            </div>
                        ) : (
                            <NotLinkedState 
                                guildId={guildId} 
                                error={ocreResponse.error}
                                metamobPseudo={profile?.metamobPseudo}
                                metamobVerified={profile?.metamobVerified}
                                metamobLastSync={profile?.metamobLastSync}
                            />
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="hidden lg:block space-y-6">
                        {ocreResponse.success && ocreResponse.data && (
                            <div data-tour="ocre-metamob">
                                <MetamobLink 
                                    guildId={guildId}
                                    metamobPseudo={profile?.metamobPseudo}
                                    metamobVerified={profile?.metamobVerified}
                                    metamobLastSync={profile?.metamobLastSync}
                                    progressData={ocreResponse.data}
                                />
                            </div>
                        )}

                        <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
                            <div data-tour="ocre-kralamoure">
                                <KralamoureWidget guildId={guildId} canManageCalendar={user.canManageCalendar} />
                            </div>
                        </Suspense>

                        {/* Quick Tips */}
                        <Card className="bg-card/30 backdrop-blur-sm border-white/10" data-tour="ocre-tips">
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

