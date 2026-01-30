import { getPublicGuilds } from "@/server/actions/presentation-actions";
import Link from "next/link";
import Image from "next/image";
import { Users, Gamepad2, Compass, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";

export const metadata = {
    title: "Annuaire des Guildes | SigilOS",
    description: "Explorez les guildes d'élite alimentées par SigilOS",
};

export default async function GuildsDirectoryPage() {
    const guilds = await getPublicGuilds();

    return (
        <div className="relative min-h-screen overflow-x-hidden">
            <AuroraBackground className="fixed inset-0 z-0 opacity-40 pointer-events-none" />

            {/* Sticky Header Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020202]/40 backdrop-blur-xl border-b border-white/5 py-4 px-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 group">
                        <img src="/assets/ui/logo_sigilos_v2.png" alt="SigilOS" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] group-hover:scale-110 transition-transform" />
                        <span className="text-xl font-black tracking-widest text-white">
                            SIGIL<span className="text-purple-400">OS</span>
                        </span>
                    </Link>
                    <Button variant="ghost" className="text-zinc-400 hover:text-white" asChild>
                        <Link href="/">Accueil</Link>
                    </Button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 pt-32 pb-24 px-6">
                <div className="max-w-7xl mx-auto space-y-20">

                    {/* Hero Section */}
                    <div className="text-center space-y-6 max-w-3xl mx-auto">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 px-4 py-1.5 rounded-full uppercase tracking-[0.2em] font-black text-[10px] animate-in fade-in slide-in-from-top-4 duration-1000">
                            Réseau Global
                        </Badge>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white animate-in fade-in slide-in-from-bottom-4 duration-700">
                            Annuaire des <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-200 to-fuchsia-400">
                                Guildes d&apos;Élite
                            </span>
                        </h1>
                        <p className="text-lg text-zinc-400 animate-in fade-in zoom-in duration-1000">
                            Découvrez les communautés qui ont choisi l&apos;excellence opérationnelle.
                            Plus qu&apos;un annuaire, une vitrine du haut niveau.
                        </p>

                        <div className="pt-4 flex items-center justify-center gap-4 text-xs font-mono text-zinc-500 animate-in fade-in duration-1000 delay-500">
                            <div className="flex items-center gap-2 bg-zinc-900/50 px-4 py-1.5 rounded-full border border-white/5">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{guilds.length} ALLIANCES</span>
                            </div>
                            <div className="flex items-center gap-2 bg-zinc-900/50 px-4 py-1.5 rounded-full border border-white/5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>100% VÉRIFIÉ</span>
                            </div>
                        </div>
                    </div>

                    {/* Guild Grid */}
                    {guilds.length === 0 ? (
                        <GlassPanel intensity="high" className="text-center py-20 animate-in fade-in zoom-in duration-700">
                            <Gamepad2 className="w-16 h-16 text-zinc-700 mx-auto mb-6 opacity-50" />
                            <h2 className="text-2xl font-bold text-white mb-2">Séquenceur Vide</h2>
                            <p className="text-zinc-400 max-w-sm mx-auto">
                                Les protocoles de présentation n&apos;ont pas encore été initialisés par les commandants de guilde.
                            </p>
                        </GlassPanel>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {guilds.map((guild, idx) => (
                                <Link
                                    key={guild.id}
                                    href={`/guilds/${guild.discordGuildId}`}
                                    className="group block"
                                >
                                    <GlassPanel
                                        intensity="low"
                                        className="h-full border border-white/5 group-hover:border-purple-500/30 transition-all duration-500 overflow-hidden"
                                    >
                                        <BorderBeam className="opacity-0 group-hover:opacity-100 transition-opacity" />

                                        {/* Banner Area */}
                                        <div className="h-40 relative bg-zinc-950 overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-black z-10" />
                                            {guild.bannerUrl ? (
                                                <Image
                                                    src={guild.bannerUrl}
                                                    alt={guild.name}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60 group-hover:opacity-80"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/10 opacity-30" />
                                            )}

                                            {/* Avatar Overlay */}
                                            <div className="absolute -bottom-6 left-6 z-20">
                                                <div className="relative w-16 h-16 rounded-2xl border-[3px] border-[#10081a] shadow-2xl bg-zinc-900 flex items-center justify-center overflow-hidden">
                                                    {guild.iconUrl ? (
                                                        <Image
                                                            src={guild.iconUrl}
                                                            alt={guild.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-2xl font-black text-white">
                                                            {guild.name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="pt-10 p-6 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <h3 className="text-xl font-black tracking-tight text-white group-hover:text-purple-300 transition-colors">
                                                        {guild.name}
                                                    </h3>
                                                    {guild.server && (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-zinc-400 border border-white/5 uppercase">
                                                            <Compass className="w-3 h-3" />
                                                            {guild.server}
                                                        </div>
                                                    )}
                                                </div>
                                                {guild.isRecruiting && (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase">
                                                        Recrutement
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                                                    Protocole SigilOS
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
                                                    Vitrine
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </div>
                                            </div>
                                        </div>
                                    </GlassPanel>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Footer / Back button */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                <div className="flex flex-col items-center gap-8 pt-12 border-t border-white/5">
                    <p className="text-zinc-500 text-sm font-medium">
                        Votre guilde n&apos;apparaît pas ? Activez la présentation dans votre panel administration.
                    </p>
                    <Link href="/">
                        <Button variant="outline" className="rounded-full border-white/10 hover:bg-white/5 px-8">
                            Retour au hub principal
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
