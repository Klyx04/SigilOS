"use client";

import { motion } from "framer-motion";
import { Users, ArrowRight, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";

interface GuildTeaser {
    id: string;
    name: string;
    iconUrl: string | null;
    server: string | null;
    isRecruiting: boolean;
    discordGuildId: string;
}

export function GuildDirectorySection({ guilds }: { guilds: GuildTeaser[] }) {
    // Show only 3-4 guilds as a teaser
    const featuredGuilds = guilds.slice(0, 3);

    return (
        <div className="w-full relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex flex-col items-center">

                <div className="flex flex-wrap justify-center gap-8 w-full">
                    {featuredGuilds.map((guild, idx) => (
                        <motion.div
                            key={guild.id}
                            className="w-full md:w-[calc(33.333%-1.5rem)] max-w-sm"
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            whileInView={{ opacity: 1, scale: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 + 0.3 }}
                        >
                            <Link href={`/guilds/${guild.discordGuildId}`} className="group block">
                                <GlassPanel className="p-6 border border-white/5 group-hover:border-purple-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-14 h-14 rounded-xl border border-white/10 overflow-hidden bg-zinc-900 shrink-0">
                                            {guild.iconUrl ? (
                                                <Image src={guild.iconUrl} alt={guild.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-zinc-600">
                                                    {guild.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-lg font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                                                {guild.name}
                                            </h4>
                                            <p className="text-xs text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-semibold">
                                                <ShieldCheck className="w-3 h-3 text-purple-500" />
                                                Verified Elite
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex items-center justify-between">
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase">
                                            {guild.server || "Serveur Privé"}
                                        </div>
                                        {guild.isRecruiting && (
                                            <div className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                Recrutement
                                            </div>
                                        )}
                                    </div>
                                </GlassPanel>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className="mt-16"
                >
                    <Button asChild variant="outline" className="rounded-full border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 hover:text-white px-8 group">
                        <Link href="/guilds" className="flex items-center gap-2">
                            Explorer tout l&apos;annuaire
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </motion.div>
            </div>
        </div>
    );
}
