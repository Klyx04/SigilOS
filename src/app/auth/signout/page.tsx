import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SignOutPage({
    searchParams
}: {
    searchParams: Promise<{ reason?: string }>
}) {
    const session = await auth();
    const { reason } = await searchParams;

    if (!session) {
        redirect("/");
    }

    // SECURITY FIX: Auto-signout for expired Discord OAuth tokens
    // Triggered by the JWT callback when Discord token expires
    if (reason === "token_expired") {
        await signOut({ redirectTo: "/login?info=session_expired" });
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-accent-teal/30 font-sans flex flex-col relative overflow-hidden landing-theme">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
                <AuroraBackground className="h-full w-full pointer-events-none" />
            </div>
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />

            <PublicHeader user={session.user} variant="standard" backHref="/" backLabel="Retour" />

            <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-20">
                <div className="max-w-md w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />

                    <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <LogOut className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]" />
                        </div>

                        <h1 className="text-3xl font-black text-white mb-4 tracking-tighter">
                            Confirmation de déconnexion
                        </h1>
                        <p className="text-zinc-400 font-medium mb-10 leading-relaxed text-lg">
                            Êtes-vous sûr de vouloir quitter votre session SigilOS ? Tous vos accès sécurisés seront réinitialisés.
                        </p>

                        <div className="flex flex-col gap-4">
                            <form
                                action={async () => {
                                    "use server";
                                    await signOut({ redirectTo: "/" });
                                }}
                            >
                                <Button
                                    type="submit"
                                    className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                                >
                                    Se déconnecter
                                </Button>
                            </form>

                            <Button
                                asChild
                                variant="ghost"
                                className="w-full h-14 text-zinc-500 hover:text-white hover:bg-white/5 font-bold rounded-2xl transition-all"
                            >
                                <Link href="/dashboard" className="flex items-center justify-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                    Annuler et retourner au QG
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
