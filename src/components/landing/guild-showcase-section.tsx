"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Users, ShieldCheck, Moon, Sparkles } from "lucide-react";

export interface ShowcaseGuild {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    server: string | null;
    isRecruiting: boolean;
    bannerType: string | null;
    bannerUrl: string | null;
    memberCount: number;
    missionsValidated: number;
    songesCompleted: number;
    dofusCompletionRate: number;
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: string | number; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-[13px] font-bold text-white tabular-nums">{value}</span>
            <span className="text-[11px] text-zinc-500">{label}</span>
        </div>
    );
}

export function GuildShowcaseSection({ guilds }: { guilds: ShowcaseGuild[] }) {
    if (!guilds || guilds.length === 0) return null;

    return (
        <section className="py-20 relative w-full border-t border-white/5">
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5 font-medium text-[11px] text-emerald-400 uppercase tracking-wider">
                        En action
                    </div>
                    <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
                        Des guildes déjà <span className="text-emerald-400 font-bold">au combat.</span>
                    </h2>
                    <p className="text-zinc-500 font-medium text-base max-w-lg mx-auto">
                        Un aperçu des statistiques réelles des guildes qui utilisent SigilOS.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
                    {guilds.map((guild, idx) => (
                        <motion.div
                            key={guild.id}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.08, duration: 0.4 }}
                        >
                            <Link href={`/guilds/${guild.discordGuildId}`} className="group block h-full">
                                <div className="relative h-full rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/20 hover:bg-zinc-900/60 transition-colors duration-150 overflow-hidden p-5 flex flex-col gap-4">
                                    {/* Header */}
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10 rounded-xl border border-white/10 overflow-hidden bg-zinc-800 shrink-0">
                                            {guild.iconUrl ? (
                                                <Image src={guild.iconUrl} alt={guild.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-base font-semibold text-emerald-500/60 bg-emerald-500/5">
                                                    {guild.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-semibold text-foreground truncate">{guild.name}</h4>
                                            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider font-medium mt-0.5">
                                                <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
                                                {guild.server || "Serveur Privé"}
                                            </p>
                                        </div>
                                        {guild.isRecruiting && (
                                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                Recrute
                                            </span>
                                        )}
                                    </div>

                                    {/* Mini-dashboard stats */}
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-white/[0.04]">
                                        <Stat icon={Users} value={guild.memberCount} label="membres" />
                                        <Stat icon={Sparkles} value={`${guild.dofusCompletionRate}%`} label="Dofus" />
                                        <Stat icon={Moon} value={guild.songesCompleted} label="songes" />
                                        <Stat icon={ShieldCheck} value={guild.missionsValidated} label="missions" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
