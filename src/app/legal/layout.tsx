import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Scale } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";

export default async function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-400 font-sans selection:bg-purple-500/30 flex flex-col">
            <PublicHeader user={session?.user} backHref="/" backLabel="Retour à l'accueil" />

            <div className="flex-1 max-w-4xl mx-auto w-full p-6 pt-32 pb-32 space-y-12">
                <UnifiedModuleHeader
                    title="Documents Légaux"
                    description="Informations légales et contractuelles"
                    icon={Scale}
                    backHref="/"
                />
                <div className="bg-zinc-900/40 p-8 md:p-12 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl mb-24">
                    {children}
                </div>
            </div>

            <GalacticFooter />
        </div>
    );
}
