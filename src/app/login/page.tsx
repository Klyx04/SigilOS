import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Shield, LogIn } from "lucide-react";

export const metadata = {
    title: "Connexion — SigilOS",
    description: "Connectez-vous à SigilOS via Discord pour accéder à votre tableau de bord de guilde.",
};

// SECURITY: This page is the custom signIn page for NextAuth.
// It replaces the default /api/auth/signin route which was flagged by Google Safe Browsing
// for the Open Redirect vulnerability in the callbackUrl param.
// The redirect callback in auth.ts now validates callbackUrl (same-origin only).
export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string }>;
}) {
    const session = await auth();

    // Already logged in — redirect to dashboard
    if (session?.user) {
        redirect("/");
    }

    const { callbackUrl } = await searchParams;

    // SECURITY: Only allow relative callbackUrls to prevent Open Redirect
    const safeCallbackUrl =
        callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";

    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 font-sans flex flex-col relative overflow-hidden landing-theme">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0">
                <AuroraBackground className="h-full w-full pointer-events-none opacity-20" />
            </div>
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-500/5 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            <PublicHeader variant="standard" backHref="/" backLabel="Accueil" />

            <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-20">
                <div className="relative z-10 max-w-md w-full group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-violet-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />

                    <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-violet-500/20 rounded-3xl p-10 text-center shadow-2xl">
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <Shield className="w-10 h-10 text-violet-400 drop-shadow-[0_0_15px_rgba(139,92,246,0.4)]" />
                        </div>

                        <div className="space-y-3 mb-10">
                            <h1 className="text-3xl font-black text-white tracking-tighter">
                                Connexion requise
                            </h1>
                            <p className="text-zinc-400 font-medium leading-relaxed">
                                Connectez-vous via Discord pour accéder au tableau de bord de votre guilde.
                            </p>
                        </div>

                        {/* Server Action Sign In */}
                        <form
                            action={async () => {
                                "use server";
                                await signIn("discord", { redirectTo: safeCallbackUrl });
                            }}
                        >
                            <Button
                                type="submit"
                                className="w-full h-14 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl gap-3"
                            >
                                <LogIn className="w-5 h-5" />
                                Se connecter avec Discord
                            </Button>
                        </form>

                        <p className="mt-6 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                            Seuls les membres des guildes partenaires peuvent accéder au Dashboard.
                        </p>
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
