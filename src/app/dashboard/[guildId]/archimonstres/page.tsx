import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { ArchiHub } from "@/components/archimonstres/archi-hub";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug, AlertCircle, Link2, Gem } from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

export default async function ArchimonstresPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // RBAC: Check permission to view Archis
    const user = await getUserContext(guildId);
    if (!user.canViewOcre) {
        return <AccessDenied />;
    }

    // Fetch user's archimonster data
    const archiResponse = await getMyOcreProgress(guildId);

    // ... (inside the component)

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <UnifiedModuleHeader
                    title="Bourse aux Archimonstres"
                    description="Optimisez votre quête de l'Éternelle Moisson grâce au partage communautaire."
                    icon={Gem}
                    iconColor="#eab308"
                    backHref={`/dashboard/${guildId}`}
                />

                {/* Content */}
                {archiResponse.success && archiResponse.data ? (
                    <ArchiHub data={archiResponse.data} guildId={guildId} />
                ) : (
                    <NotLinkedState guildId={guildId} error={archiResponse.error} />
                )}
            </div>
        </div>
    );
}

// Component for when user hasn't linked their Metamob account
function NotLinkedState({ guildId, error }: { guildId: string; error?: string }) {
    const isNotLinked = error?.includes("Aucun compte Metamob");

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm max-w-2xl mx-auto">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                {isNotLinked ? (
                    <>
                        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Bug className="h-10 w-10 text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">Liez votre compte Metamob</h2>
                            <p className="text-muted-foreground max-w-md">
                                Pour accéder à la Bourse aux Archimonstres, vous devez d&apos;abord lier votre compte
                                <a
                                    href="https://www.metamob.fr"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline mx-1"
                                >
                                    Metamob
                                </a>
                                à votre profil SigilOS.
                            </p>
                        </div>
                        <Link href={`/dashboard/${guildId}/profile`}>
                            <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
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
