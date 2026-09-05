"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

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

/**
 * Carte vitrine volontairement sobre : nom, serveur, membres, recrutement.
 * Les compteurs d'activité (missions, songes, % Dofus) ne sont pas affichés :
 * sur des guildes jeunes ils valent 0 et laissent croire que le produit est
 * vide. La preuve, c'est le total des membres réunis ci-dessus.
 */
export function GuildShowcaseSection({ guilds }: { guilds: ShowcaseGuild[] }) {
    if (!guilds || guilds.length === 0) return null;

    const totalMembers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    return (
        <section className="py-20 relative w-full border-t border-border">
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-14">
                    <p className="text-sm font-semibold text-success mb-5">
                        Guildes à bord
                    </p>
                    <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
                        Elles avancent ensemble.
                    </h2>
                    <p className="text-muted-foreground font-medium text-base max-w-lg mx-auto">
                        {guilds.length} guilde{guilds.length > 1 ? "s" : ""} · {totalMembers} membre{totalMembers > 1 ? "s" : ""} réuni{totalMembers > 1 ? "s" : ""}.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
                    {guilds.map((guild) => (
                        <Link key={guild.id} href={`/guilds/${guild.discordGuildId}`} className="group block h-full">
                            <div className="relative h-full rounded-2xl bg-surface/40 border border-border hover:border-success/20 hover:bg-surface/60 transition-colors duration-150 overflow-hidden p-5">
                                <div className="flex items-center gap-3">
                                    <div className="relative w-10 h-10 rounded-xl border border-border overflow-hidden bg-elevated shrink-0">
                                        {guild.iconUrl ? (
                                            <Image src={guild.iconUrl} alt={guild.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-base font-semibold text-success/60 bg-success/5">
                                                {guild.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-semibold text-foreground truncate">{guild.name}</h4>
                                        <p className="text-caption text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                                            <ShieldCheck className="w-3 h-3 text-success/70 shrink-0" />
                                            {guild.server || "Serveur privé"} · {guild.memberCount} membre{guild.memberCount > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    {guild.isRecruiting && (
                                        <span className="text-caption font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full shrink-0">
                                            Recrute
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
