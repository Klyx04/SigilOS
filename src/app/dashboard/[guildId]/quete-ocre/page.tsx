import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { OcreDashboard, KralamoureWidget } from "@/components/ocre";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, AlertCircle, Link2, Sparkles, Crown } from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

export const dynamic = "force-dynamic";

export default async function QueteOcrePage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // RBAC: Check permission to view Archis (TODO: Rename to OCRE_VIEW when permissions updated)
    const user = await getUserContext(guildId);
    if (!user.canViewArchis) {
        return <AccessDenied />;
    }

    // Fetch user's Quête Ocre data
    const ocreResponse = await getMyOcreProgress(guildId);

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
                />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    {/* Main Content */}
                    <div className="space-y-6">
                        {ocreResponse.success && ocreResponse.data ? (
                            <OcreDashboard data={ocreResponse.data} guildId={guildId} />
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

// Component for when user hasn't linked their Metamob account
function NotLinkedState({ guildId, error }: { guildId: string; error?: string }) {
    const isNotLinked = error?.includes("Aucun compte Metamob") || error?.includes("Profil Metamob non lié.");

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm max-w-2xl mx-auto">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                {isNotLinked ? (
                    <>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                            <Bug className="h-10 w-10 text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">Liez votre compte Metamob</h2>
                            <p className="text-muted-foreground max-w-md">
                                Pour accéder à la Quête Ocre, vous devez lier votre compte Metamob à votre profil SigilOS.
                                <br /><br />
                                <span className="text-sm italic">
                                    Allez sur votre profil, onglet <strong>"Général"</strong>, et cliquez sur <strong>"Connecter Metamob"</strong>.
                                </span>
                            </p>
                        </div>
                        <Link href={`/dashboard/${guildId}/profile`}>
                            <Button className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-medium">
                                <Link2 className="h-4 w-4" />
                                Aller à mon profil
                            </Button>
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">Erreur de chargement</h2>
                            <p className="text-muted-foreground max-w-md">
                                {error || "Impossible de charger vos données Metamob. Réessayez plus tard."}
                            </p>
                        </div>
                        <Link href={`/dashboard/${guildId}/profile`}>
                            <Button variant="outline">
                                Retour au profil
                            </Button>
                        </Link>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

