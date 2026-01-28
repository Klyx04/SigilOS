import { BentoHub } from "@/components/layout/ui-test/bento-hub";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserContext } from "@/server/actions/user-actions";
import { LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default async function BentoTestPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    return (
        <div className="min-h-screen bg-[#080808] text-white p-6 md:p-12 font-sans overflow-hidden">
            {/* Minimal Header for Bento View */}
            <header className="max-w-7xl mx-auto flex items-center justify-between mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="flex items-center gap-6">
                    <Avatar className="h-12 w-12 border-2 border-primary/50 p-1 bg-primary/10">
                        <AvatarImage src={user?.image} />
                        <AvatarFallback>US</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">Connecté en tant que</span>
                        <span className="text-xl font-bold italic tracking-tight">{user?.name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/${guildId}`} className="h-12 px-6 rounded-full border border-white/10 flex items-center gap-3 text-sm font-bold hover:bg-white hover:text-black transition-all group">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard Classique
                    </Link>
                    <button className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-all">
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                <BentoHub guildId={guildId} />

                <div className="mt-12 flex items-center justify-between border-t border-white/5 pt-8">
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white/20">BENTO HUB CONCEPT</h2>
                        <p className="text-zinc-600 text-sm">Le dashboard devient le menu principal. Pas de navigation persistante, focus total sur l'action.</p>
                    </div>

                    <div className="flex gap-8">
                        <div className="flex flex-col text-right">
                            <span className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest mb-1">Status Système</span>
                            <span className="text-emerald-500/50 font-mono text-xs">ONLINE / SECURED</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
