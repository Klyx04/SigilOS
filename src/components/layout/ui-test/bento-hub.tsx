"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    ScrollText,
    InfinityIcon,
    Bug,
    Trophy,
    Users,
    Calendar,
    ArrowUpRight
} from "lucide-react";
import Link from "next/link";

export function BentoHub({ guildId }: { guildId: string }) {
    const MODULES = [
        {
            name: "Missions",
            href: `/dashboard/${guildId}/missions`,
            icon: ScrollText,
            color: "text-primary",
            bg: "hover:bg-primary/20",
            border: "hover:border-primary/50",
            size: "col-span-2 row-span-2",
            desc: "8 missions validées sur 12 cette semaine.",
            stats: "8 / 12"
        },
        {
            name: "Songes",
            href: `/dashboard/${guildId}/songes`,
            icon: InfinityIcon,
            color: "text-amber-500",
            bg: "hover:bg-amber-500/20",
            border: "hover:border-amber-500/50",
            size: "col-span-1 row-span-1",
            desc: "3 runs actives.",
            stats: "V3"
        },
        {
            name: "Ladder",
            href: `/dashboard/${guildId}/ladder`,
            icon: Trophy,
            color: "text-purple-500",
            bg: "hover:bg-purple-500/20",
            border: "hover:border-purple-500/50",
            size: "col-span-1 row-span-1",
            desc: "Tu es classé 4ème.",
            stats: "#4"
        },
        {
            name: "Bourse Archis",
            href: `/dashboard/${guildId}/archimonstres`,
            icon: Bug,
            color: "text-emerald-500",
            bg: "hover:bg-emerald-500/20",
            border: "hover:border-emerald-500/50",
            size: "col-span-1 row-span-2",
            desc: "12 doublons échangeables.",
            stats: "+12"
        },
        {
            name: "Annuaire",
            href: `/dashboard/${guildId}/members`,
            icon: Users,
            color: "text-blue-500",
            bg: "hover:bg-blue-500/20",
            border: "hover:border-blue-500/50",
            size: "col-span-1 row-span-1",
            desc: "45 membres actifs.",
            stats: "45"
        },
        {
            name: "Calendrier",
            href: `/dashboard/${guildId}/calendar`,
            icon: Calendar,
            color: "text-rose-500",
            bg: "hover:bg-rose-500/20",
            border: "hover:border-rose-500/50",
            size: "col-span-1 row-span-1",
            desc: "Event ce soir à 21h.",
            stats: "21h"
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-3 gap-4 h-[600px]">
            {MODULES.map((mod) => (
                <Link key={mod.href} href={mod.href} className={cn("group", mod.size)}>
                    <Card className={cn(
                        "h-full p-8 bg-zinc-900/40 border-white/5 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative",
                        mod.bg,
                        mod.border
                    )}>
                        <div className="relative z-10">
                            <div className={cn("p-4 rounded-2xl bg-white/5 w-fit mb-6 transition-transform group-", mod.color)}>
                                <mod.icon className="h-8 w-8" />
                            </div>
                            <h3 className="text-2xl font-black italic tracking-tighter mb-2">{mod.name}</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed max-w-[200px]">{mod.desc}</p>
                        </div>

                        <div className="relative z-10 flex items-end justify-between">
                            <span className={cn("text-4xl font-black italic opacity-20 group-hover:opacity-100 transition-opacity", mod.color)}>
                                {mod.stats}
                            </span>
                            <div className="h-10 w-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Background element */}
                        <div className={cn(
                            "absolute -right-12 -bottom-12 h-64 w-64 blur-3xl rounded-full opacity-0 group-hover:opacity-10 transition-opacity",
                            mod.color.replace('text-', 'bg-')
                        )} />
                    </Card>
                </Link>
            ))}
        </div>
    );
}
