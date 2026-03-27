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

export function GalacticFooter({ variant = "standard", isMember = false }: GalacticFooterProps) {
    const [latency, setLatency] = useState<number | null>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatus>("online");
    const [mounted, setMounted] = useState(false);

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
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 pointer-events-none">
                <footer className="w-full relative rounded-full border border-white/10 bg-[#020202]/60 backdrop-blur-md py-2 px-6 pointer-events-auto shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5 transition-all hover:bg-[#020202]/80">
                    <div className="flex items-center justify-between gap-4 text-[10px] relative z-10">
                        {/* LEFT: BRAND & LEGAL */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="font-heading tracking-tight text-white uppercase text-sm">SigilOS</span>
                                <span className="text-[9px] font-mono text-zinc-500 opacity-60">V1</span>
                            </div>
                            <span className="w-px h-3 bg-white/10 hidden sm:block"></span>
                            <div className="hidden sm:flex items-center gap-4 font-bold uppercase tracking-widest text-zinc-400">
                                <Link href="/legal/cgu" className="hover:text-accent-teal transition-colors text-[9px]">CGU</Link>
                                <Link href="/legal/privacy" className="hover:text-accent-teal transition-colors text-[9px]">Privacy</Link>
                                <Link href="/legal/mentions" className="hover:text-accent-teal transition-colors text-[9px]">Mentions</Link>
                                <Link href="/legal/faq" className="hover:text-accent-teal transition-colors text-white text-[9px]">FAQ</Link>
                            </div>
                        </div>

                        {/* CENTER: STATUS (Pill style) */}
                        <Link
                            href="/status"
                            className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 hover:border-accent-teal/30 hover:bg-white/10 transition-all duration-300 group"
                        >
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                systemStatus === "online" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : systemStatus === "degraded" ? "bg-amber-500" : "bg-red-500"
                            )}></div>
                            <span className={cn(
                                "font-black tracking-[0.2em] text-[9px] uppercase whitespace-nowrap",
                                systemStatus === "online" ? "text-emerald-500" : systemStatus === "degraded" ? "text-amber-500" : "text-red-500"
                            )}>
                                {systemStatus === "online" ? "En Ligne" : systemStatus === "degraded" ? "Dégradé" : "Maintenance"}
                            </span>
                        </Link>

                        {/* RIGHT: SUPPORT & BUG */}
                        <div className="flex items-center gap-5">
                            <div className="hidden lg:block text-[9px] text-zinc-500 font-medium italic opacity-40">
                                © 2026
                            </div>

                            <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-2 text-zinc-300 hover:text-white transition-all hover:scale-105"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                <span className="hidden sm:inline font-bold uppercase tracking-widest text-[9px]">Support</span>
                            </Link>

                            <div className="scale-90 origin-right">
                                <BugReportButton />
                            </div>
                        </div>
                    </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
                    {/* Brand Meta */}
                    <div className="space-y-8 flex flex-col items-start">
                         <Link href="/" className="flex items-center gap-4 group">
                            <div className="relative w-10 h-10 transition-transform group-hover:scale-110">
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-white uppercase">
                                Sigil<span className="text-emerald-500">OS</span>
                            </span>
                        </Link>
                        <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-[240px]">
                            L'excellence opérationnelle pour les guildes les plus ambitieuses du Monde des Douze.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Evolution 2026</span>
                        </div>
                    </div>

                    {/* Resources */}
                    <div className="space-y-8">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Plateforme</h4>
                        <nav className="flex flex-col gap-4">
                            <Link href="/guilds" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Annuaire de Guildes</Link>
                            <Link href="/changelog" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Journal des mises à jour</Link>
                            <Link href="/status" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Monitor System</Link>
                            <Link href="/docs" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Guides & Wikis</Link>
                        </nav>
                    </div>

                    {/* Support & Community */}
                    <div className="space-y-8">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Communauté</h4>
                        <nav className="flex flex-col gap-4">
                             <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-3 text-emerald-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest group"
                            >
                                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                    <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" fill="currentColor">
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                    </svg>
                                </div>
                                Support 24/7
                            </Link>
                            <Link href="/legal/faq" className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Centre d'aide</Link>
                            <div className="pt-2">
                                <BugReportButton />
                            </div>
                        </nav>
                    </div>

                    {/* Status Badge */}
                    <div className="space-y-8">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Système</h4>
                        <Link href="/status" className="block p-6 rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/20 transition-all group overflow-hidden relative">
                            <div className={cn(
                                "w-2 h-2 rounded-full animate-pulse mb-4",
                                systemStatus === "online" ? "bg-emerald-500 shadow-[0_0_15px_#10b981]" :
                                    systemStatus === "degraded" ? "bg-amber-500" : "bg-red-500"
                            )} />
                            <div className="flex flex-col gap-1">
                                <span className="text-white text-[11px] font-black uppercase tracking-widest">
                                    {systemStatus === "online" ? "Systèmes Online" : "Maintenance"}
                                </span>
                                {latency && <span className="text-zinc-600 text-[10px] font-mono">{latency}ms response</span>}
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/5 blur-2xl rounded-full" />
                        </Link>
                    </div>
                </div>

                {/* Bottom Bar: Legal & Credits */}
                <div className="pt-12 border-t border-white/5 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div className="flex flex-col gap-4 text-center lg:text-left">
                        <p className="text-zinc-500 text-[11px] font-medium leading-relaxed max-w-xl">
                            SigilOS est un outil indépendant. Dofus est une marque déposée d'Ankama Games. 
                            Tous droits réservés aux auteurs respectifs. Fait avec passion pour la communauté.
                        </p>
                        <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em]">
                            <Link href="/legal/cgu" className="hover:text-white transition-colors">CGU</Link>
                            <Link href="/legal/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                            <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions Légales</Link>
                        </div>
                    </div>

                    <div className="flex items-center gap-10 shrink-0">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Engine Version</span>
                            <span className="text-sm font-black text-white">V1.0.8 <span className="text-emerald-500 font-sans italic ml-1">Beta</span></span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all">
                            <Image src="/assets/ui/logo-v2.png" alt="SigilOS" width={24} height={24} />
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
