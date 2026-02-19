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
        title: "Pacte de Discord",
        description: "Scellez votre alliance sur le Discord SigilOS."
    },
    {
        icon: Mic,
        title: "Rite d'Admission",
        description: "Un entretien vocal pour valider votre allégeance au projet."
    },
    {
        icon: LayoutDashboard,
        title: "Éveil du Dashboard",
        description: "Accédez à votre grimoire de gestion personnalisé."
    }
];

export function HowItWorks() {
    return (
        <section className="pb-24 bg-background relative overflow-hidden">
            <div className="container px-6 mx-auto">
                {/* Chef de Guilde Banner */}
                <div className="max-w-5xl mx-auto mb-32">
                    <div className="relative group p-10 md:p-16 rounded-[3rem] bg-accent-teal/5 border border-accent-teal/10 overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-10 transition-all hover:bg-accent-teal/[0.07] hover:border-accent-teal/20 backdrop-blur-sm">
                        {/* High-end decorative lights */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-teal/10 blur-[120px] -z-10 rounded-full" />
                        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-accent-gold/5 blur-[100px] -z-10 rounded-full" />

                        <div className="flex flex-col md:flex-row items-center gap-8 text-left relative z-10">
                            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-accent-teal to-emerald-600 flex items-center justify-center text-bg-primary shadow-2xl shadow-accent-teal/20 group-hover:scale-110 transition-transform duration-700">
                                <Crown className="w-10 h-10" />
                            </div>
                            <div className="space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/20 border border-accent-teal/30 text-[10px] font-black uppercase tracking-widest text-accent-teal">
                                    Protocoles de Gestion
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black text-white font-heading italic">Meneur de Guilde ?</h3>
                                <p className="text-zinc-400 font-medium max-w-md text-lg leading-relaxed">
                                    Érigez une cité numérique pour vos membres. Automatisez vos quêtes et régnez sur votre communauté avec sagesse.
                                </p>
                            </div>
                        </div>

                        <Link
                            href="https://discord.gg/uX7G6SUDgN"
                            target="_blank"
                            className="shrink-0 px-10 py-5 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:scale-105 transition-all group/link shadow-2xl shadow-white/5 active:scale-95"
                        >
                            <MessageSquare className="w-5 h-5 group-hover/link:rotate-12 transition-transform duration-500" />
                            Accès PRIVÉ
                            <ChevronRight className="w-4 h-4 group-hover/link:translate-x-2 transition-transform" />
                        </Link>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 relative">
                    {/* Connecting Lines (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-accent-teal/20 to-transparent" />

                    {STEPS.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center group">
                            <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-center mb-8 transition-all group-hover:border-accent-teal/40 group-hover:bg-accent-teal/5 relative shadow-2xl group-hover:scale-105 duration-500">
                                <step.icon className="w-10 h-10 text-accent-teal group-hover:scale-110 transition-transform" />
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-bg-secondary border border-white/10 flex items-center justify-center text-[11px] font-black text-white shadow-xl">
                                    0{idx + 1}
                                </div>
                            </div>
                            <h3 className="text-white font-heading text-2xl mb-4 italic tracking-tight">{step.title}</h3>
                            <p className="text-zinc-500 font-medium leading-relaxed max-w-[240px]">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
