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
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-400 font-sans selection:bg-accent-teal/30 flex flex-col landing-theme overflow-hidden relative">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>
            <PublicHeader user={session?.user} backHref="/" backLabel="Retour à l'accueil" isMember={userContext.isMember} />

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

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
