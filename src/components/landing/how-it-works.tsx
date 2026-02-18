"use client";

import { Mic, LayoutDashboard, Crown, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

const STEPS = [
    {
        icon: DiscordIcon,
        title: "Discord & Candidature",
        description: "Postulez directement sur le Discord SigilOS."
    },
    {
        icon: Mic,
        title: "Entretien Vocal",
        description: "Un échange en vocal pour voir si l'outil peut vraiment vous intéresser."
    },
    {
        icon: LayoutDashboard,
        title: "Accès Dashboard",
        description: "Validation de l'accès et accès directement à votre dashboard de guilde."
    }
];

export function HowItWorks() {
    return (
        <section className="pb-24 bg-background relative overflow-hidden">
            <div className="container px-6 mx-auto">
                {/* Chef de Guilde Banner */}
                <div className="max-w-4xl mx-auto mb-20">
                    <div className="relative group p-8 md:p-12 rounded-[2.5rem] bg-accent-gold/5 border border-accent-gold/10 overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:bg-accent-gold/[0.07] hover:border-accent-gold/20">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-gold/5 blur-[80px] -z-10" />

                        <div className="flex flex-col md:flex-row items-center gap-6 text-left">
                            <div className="p-4 rounded-2xl bg-accent-gold/10 border border-accent-gold/20 text-accent-gold">
                                <Crown className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-heading text-white mb-2 italic">Chef de Guilde ?</h3>
                                <p className="text-zinc-400 font-medium max-w-sm">
                                    Automatisez vos missions et centralisez la gestion de vos membres en quelques minutes.
                                </p>
                            </div>
                        </div>

                        <Link
                            href="https://discord.gg/uX7G6SUDgN"
                            target="_blank"
                            className="shrink-0 px-8 py-4 rounded-2xl bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-accent-gold hover:text-bg-primary transition-all group/link shadow-lg active:scale-95"
                        >
                            <MessageSquare className="w-5 h-5 group-hover/link:rotate-12 transition-transform duration-500" />
                            Accès BETA
                            <ChevronRight className="w-4 h-4 group-hover/link:translate-x-2 transition-transform" />
                        </Link>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                    {/* Connecting Lines (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-accent-gold/20 to-transparent" />

                    {STEPS.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center group">
                            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-6 transition-all group-hover:border-accent-gold/40 group-hover:bg-accent-gold/5 relative">
                                <step.icon className="w-10 h-10 text-accent-gold" />
                                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-bg-secondary border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                    0{idx + 1}
                                </div>
                            </div>
                            <h3 className="text-white font-heading text-xl mb-3">{step.title}</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
