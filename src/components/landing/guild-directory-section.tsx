"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface GuildTeaser {
    id: string;
    name: string;
    iconUrl: string | null;
    server: string | null;
    isRecruiting: boolean;
    discordGuildId: string;
}

export function GuildDirectorySection({ guilds }: { guilds: GuildTeaser[] }) {
    const featuredGuilds = guilds.slice(0, 3);

    if (featuredGuilds.length === 0) return null;

    return (
        <div className="w-full relative">
            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                {featuredGuilds.map((guild, idx) => (
                    <motion.div
                        key={guild.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.08 + 0.1, duration: 0.5 }}
                    >
                        <Link href={`/guilds/${guild.discordGuildId}`} className="group block h-full">
                            <div className="relative h-full rounded-3xl bg-zinc-900/60 border border-white/5 group-hover:border-amber-500/20 group-hover:bg-zinc-900/80 transition-all duration-500 overflow-hidden p-6 flex flex-col gap-5">
                                {/* Ambient glow on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-transparent group-hover:from-amber-500/5 transition-all duration-700 pointer-events-none" />

                                {/* Header */}
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="relative w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-zinc-800 shrink-0 shadow-lg">
                                        {guild.iconUrl ? (
                                            <Image src={guild.iconUrl} alt={guild.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg font-black text-amber-500/60 bg-amber-500/5">
                                                {guild.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-base font-black text-white truncate group-hover:text-amber-400 transition-colors tracking-tight">
                                            {guild.name}
                                        </h4>
                                        <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider font-bold mt-0.5">
                                            <ShieldCheck className="w-3 h-3 text-amber-500/70 shrink-0" />
                                            Verified Elite
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between relative z-10 mt-auto pt-4 border-t border-white/[0.04]">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                        <Users className="w-3 h-3" />
                                        {guild.server || "Serveur Privé"}
                                    </div>
                                    {guild.isRecruiting ? (
                                        <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
                                            Recrute
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                            Fermé
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* CTA Explorer */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mt-12 flex justify-center"
            >
                <Link
                    href="/guilds"
                    className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-white/[0.04] border border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 text-zinc-400 hover:text-white transition-all font-bold text-sm uppercase tracking-widest"
                >
                    Explorer tout l&apos;annuaire
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </motion.div>
        </div>
    );
}
