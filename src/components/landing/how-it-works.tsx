"use client";

import { Mic, LayoutDashboard } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

const STEPS = [
    {
        icon: DiscordIcon,
        title: "Ouvrez un ticket sur Discord",
        description: "Scellez votre alliance sur le Discord SigilOS."
    },
    {
        icon: Mic,
        title: "Échange en vocal sur vos attentes",
        description: "Un entretien vocal pour valider votre allégeance au projet."
    },
    {
        icon: LayoutDashboard,
        title: "Onboarding et accès au Dashboard",
        description: "Accédez à votre grimoire de gestion personnalisé."
    }
];

export function HowItWorks() {
    return (
        <section className="pb-24 bg-background relative overflow-hidden">
            <div className="container px-6 mx-auto">

                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 relative">
                    {/* Connecting Lines (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-accent-teal/20 to-transparent" />

                    {STEPS.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center group">
                            <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-center mb-8 transition-all group-hover:border-accent-teal/40 group-hover:bg-accent-teal/5 relative   duration-150">
                                <step.icon className="w-10 h-10 text-accent-teal group-hover:scale-110 transition-transform" />
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-bg-secondary border border-white/10 flex items-center justify-center text-[11px] font-semibold text-white ">
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
