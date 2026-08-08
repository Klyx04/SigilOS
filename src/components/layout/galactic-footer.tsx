"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, HelpCircle } from "lucide-react";
import { BugReportButton } from "@/components/layout/bug-report-button";

type SystemStatus = "online" | "degraded" | "offline";

interface GalacticFooterProps {
    variant?: "standard" | "compact";
    isMember?: boolean;
}

export function GalacticFooter({ variant = "compact", isMember = false }: GalacticFooterProps) {
    const [latency, setLatency] = useState<number | null>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatus>("online");
    const [mounted, setMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (variant !== "compact") return;
        
        let lastScroll = 0;
        let ticking = false;

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (!target || typeof target.scrollTop !== "number") return;
            
            const currentScroll = target.scrollTop;
            
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (currentScroll > lastScroll && currentScroll > 80) {
                        setIsVisible(false);
                    } else {
                        setIsVisible(true);
                    }
                    lastScroll = currentScroll;
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener("scroll", handleScroll, true);
        return () => window.removeEventListener("scroll", handleScroll, true);
    }, [variant]);

    useEffect(() => {
        setMounted(true);
        const checkHealth = async () => {
            const start = Date.now();
            try {
                const res = await fetch('/api/health');
                const end = Date.now();
                setLatency(end - start);
                if (res.ok) {
                    const data = await res.json();
                    setSystemStatus(data.status === "healthy" ? "online" : data.status === "degraded" ? "degraded" : "offline");
                } else {
                    setSystemStatus("offline");
                }
            } catch {
                setSystemStatus("offline");
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!mounted) return null;

    const isCompact = variant === "compact";

    if (isCompact) {
        return (
            <div className={cn(
                "fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-5xl px-4 sm:px-6 pointer-events-none transition-all duration-500 ease-in-out transform",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
            )}>
                <footer className="w-full relative rounded-2xl border border-white/10 bg-[#050505]/80 backdrop-blur-2xl py-3 px-5 sm:px-8 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 transition-all hover:bg-[#050505]/95 group/footer">
                    <div className="flex items-center justify-between gap-4 sm:gap-8 relative z-10">
                        
                        {/* 1. BRAND & LEGAL */}
                        <div className="flex items-center gap-4 sm:gap-6">
                            <Link href="/" className="flex items-center gap-2.5 group/brand shrink-0">
                                <span className="font-black tracking-tighter text-white uppercase text-sm sm:text-base italic transition-transform group-hover/brand:scale-105">Sigil<span className="text-emerald-500">OS</span></span>
                            </Link>

                            <div className="h-4 w-px bg-white/10 hidden xl:block" />

                            <nav className="hidden xl:flex items-center gap-5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                <Link href="/legal/cgu" className="hover:text-white transition-colors">CGU</Link>
                                <Link href="/legal/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                                <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions</Link>
                                <Link href="/legal/faq" className="hover:text-white transition-colors text-emerald-500/80">Aide</Link>
                            </nav>
                        </div>

                        {/* 2. SYSTEM STATUS (Dynamic Pill) */}
                        <Link
                            href="/status"
                            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 group/status shrink-0"
                        >
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                systemStatus === "online" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : 
                                systemStatus === "degraded" ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" : 
                                "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                            )}></div>
                            <span className={cn(
                                "hidden lg:inline-block font-black tracking-[0.25em] text-[10px] uppercase whitespace-nowrap",
                                systemStatus === "online" ? "text-emerald-500" : 
                                systemStatus === "degraded" ? "text-amber-500" : 
                                "text-rose-500"
                            )}>
                                {systemStatus === "online" ? "Systems Active" : systemStatus === "degraded" ? "Degraded" : "Maintenance"}
                            </span>
                        </Link>

                        {/* 3. SUPPORT & INTERACTION */}
                        <div className="flex items-center gap-3 sm:gap-6">
                            <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-2.5 text-zinc-400 hover:text-white transition-all hover:scale-105 group/discord shrink-0"
                            >
                                <svg className="w-4 h-4 transition-transform group-hover/discord:rotate-12" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                <span className="hidden sm:inline-block font-black uppercase tracking-widest text-[9px]">Discord</span>
                            </Link>

                            <div className="scale-[0.85] sm:scale-90 origin-right transition-transform hover:scale-100 shrink-0">
                                <BugReportButton />
                            </div>
                        </div>
                    </div>

                    {/* Subtle scanline effect */}
                    <div className="absolute inset-0 bg-scanlines opacity-[0.02] pointer-events-none rounded-2xl" />
                </footer>
            </div>
        );
    }

    // STANDARD FULL FOOTER
    return (
        <footer className="w-full bg-[#030303] border-t border-white/5 pt-32 pb-12 mt-auto relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-7xl mx-auto px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-20">
                    {/* Brand Meta */}
                    <div className="space-y-6 flex flex-col items-start">
                         <Link href="/" className="flex items-center gap-4 group">
                            <div className="relative w-10 h-10 transition-transform group-hover:scale-110">
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-white uppercase italic">
                                Sigil<span className="text-emerald-500">OS</span>
                            </span>
                        </Link>
                        <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-[280px]">
                            L'excellence opérationnelle pour les guildes les plus ambitieuses du Monde des Douze.
                        </p>
                    </div>

                    {/* Resources */}
                    <div className="space-y-6">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Plateforme</h4>
                        <nav className="flex flex-col gap-4">
                            <Link href="/guilds" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Annuaire de Guildes</Link>
                            <Link href="/changelog" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Mises à jour</Link>
                            <Link href="/docs" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Guides & Wikis</Link>
                        </nav>
                    </div>

                    {/* Status Badge & Discord */}
                    <div className="space-y-6">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Système</h4>
                        <div className="flex flex-col gap-4 items-start">
                            <Link href="/status" className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/20 transition-all group overflow-hidden relative">
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full animate-pulse",
                                    systemStatus === "online" ? "bg-emerald-500 shadow-[0_0_15px_#10b981]" :
                                        systemStatus === "degraded" ? "bg-amber-500" : "bg-red-500"
                                )} />
                                <div className="flex flex-col">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest",
                                        systemStatus === "online" ? "text-emerald-500" : "text-white"
                                    )}>
                                        {systemStatus === "online" ? "Systems Online" : "Maintenance"}
                                    </span>
                                    {latency && <span className="text-zinc-600 text-[8px] font-mono leading-none mt-0.5">{latency}ms response</span>}
                                </div>
                                <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-emerald-500/5 blur-2xl rounded-full" />
                            </Link>
                            <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-3 text-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
                            >
                                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 127.14 96.36" fill="currentColor">
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                    </svg>
                                </div>
                                Support 24/7
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: Legal & Credits */}
                <div className="pt-8 border-t border-white/5 flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col gap-4 text-center lg:text-left w-full lg:w-auto">
                        <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                            <Link href="/legal/cgu" className="hover:text-white transition-colors">CGU</Link>
                            <Link href="/legal/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                            <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions</Link>
                            <Link href="/legal/faq" className="hover:text-white transition-colors">Aide</Link>
                        </div>
                        <p className="text-zinc-600 text-[10px] font-medium leading-relaxed max-w-xl opacity-60">
                            SigilOS est une plateforme indépendante. Dofus est une marque déposée d'Ankama Games. Données & ressources complémentaires par DofusDB (LPNC-IA 1.0) et Ganymède.
                            Tous droits réservés. © 2026 Sigil Project.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0">
                        <BugReportButton />
                    </div>
                </div>
            </div>
        </footer>
    );
}
