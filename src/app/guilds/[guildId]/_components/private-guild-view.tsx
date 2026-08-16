"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";

type Props = {
    guild: {
        name: string;
        iconUrl: string | null;
    };
    isMember?: boolean;
};

export function PrivateGuildView({ guild, isMember }: Props) {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-accent-teal/30 font-sans flex flex-col relative overflow-hidden">
            <PublicHeader variant="standard" isMember={isMember} />

            {/* Background Effects (5% Opacity as per 2026 specs) */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.03),transparent_70%)]" />
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-5 saturate-100 blur-3xl scale-125" />

            <main className="flex-1 flex items-center justify-center p-4 relative z-10">
                <div className="relative group">
                    {/* Ambient Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition duration-300" />

                    <Card className="w-full max-w-md bg-zinc-950/40 border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-3xl overflow-hidden relative">
                        {/* Micro-texture Noise Overlay */}
                        <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

                        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                            <div className="relative">
                                <div className="absolute -inset-6 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
                                <Avatar className="h-28 w-28 border-4 border-zinc-950 shadow-2xl relative">
                                    <AvatarImage src={guild.iconUrl || undefined} />
                                    <AvatarFallback className="text-3xl font-black bg-zinc-900 text-zinc-500">
                                        {guild.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 bg-zinc-900 p-2 rounded-xl border border-white/10 shadow-lg">
                                    <ShieldAlert className="w-5 h-5 text-indigo-400" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col items-center">
                                    <span className="text-caption font-black uppercase tracking-widest text-indigo-400/80 mb-2">Contenu Privé</span>
                                    <h1 className="text-3xl font-black text-white tracking-tighter">{guild.name}</h1>
                                </div>
                                <p className="text-zinc-400 font-medium leading-relaxed max-w-[280px] mx-auto">
                                    Cette guilde n'a pas encore activé sa présentation publique ou a choisi de rester dans l'ombre.
                                </p>
                            </div>

                            <div className="pt-4 w-full">
                                <Button asChild className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-black px-6 group/btn relative overflow-hidden transition-all active:scale-95">
                                    <Link href="/guilds">
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" />
                                            Retour à l'annuaire
                                        </span>
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* Bottom Decorative Bar */}
                        <div className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full opacity-30" />
                    </Card>
                </div>
            </main>

            <GalacticFooter isMember={isMember} />
        </div>
    );
}
