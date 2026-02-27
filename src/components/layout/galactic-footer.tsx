"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, HelpCircle } from "lucide-react";

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
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-5xl px-4 pointer-events-none">
                <footer className="w-full relative rounded-2xl border border-white/10 bg-[#020202]/40 backdrop-blur-2xl saturate-150 py-3 px-6 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                    {/* Teal Glow Effect */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-accent-teal/30 to-transparent blur-[1px]" />
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-accent-teal/5 blur-[25px] rounded-full" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] sm:text-xs relative z-10">

                        {/* LEFT: BRAND */}
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="font-heading tracking-tight text-white uppercase text-sm">SigilOS</span>
                                <span className="font-mono text-zinc-500 opacity-60">V1</span>
                            </div>
                            <span className="w-px h-3 bg-white/10 hidden sm:block"></span>
                            <div className="flex items-center gap-4 font-bold uppercase tracking-[0.15em] text-zinc-400">
                                <Link href="/legal/cgu" className="hover:text-accent-teal transition-colors">CGU</Link>
                                <Link href="/legal/privacy" className="hover:text-accent-teal transition-colors">Confidentialité</Link>
                                <Link href="/legal/mentions" className="hover:text-accent-teal transition-colors">Mentions</Link>
                                <Link href="/legal/faq" className="hover:text-accent-teal transition-colors text-white">FAQ</Link>
                            </div>
                        </div>

                        {/* CENTER: STATUS */}
                        <Link
                            href="/status"
                            className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 hover:border-accent-teal/40 hover:bg-white/10 transition-all duration-500 group"
                        >
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_currentColor]",
                                systemStatus === "online" ? "text-emerald-500" : systemStatus === "degraded" ? "text-amber-500" : "text-red-500"
                            )}></div>
                            <span className={cn(
                                "font-black tracking-[0.25em] text-[9px] uppercase",
                                systemStatus === "online" ? "text-emerald-500" : systemStatus === "degraded" ? "text-amber-500" : "text-red-500"
                            )}>
                                {systemStatus === "online" ? "Système en ligne" : systemStatus === "degraded" ? "Dégradé" : "Maintenance"}
                            </span>
                            {latency && (
                                <span className="text-[9px] font-mono text-zinc-500 group-hover:text-zinc-200 transition-colors">
                                    {latency}ms
                                </span>
                            )}
                        </Link>

                        {/* RIGHT: SUPPORT */}
                        <div className="flex items-center gap-6">
                            <div className="hidden lg:flex items-center gap-2 text-zinc-500 italic opacity-60">
                                © 2026 SigilOS
                            </div>

                            <span className="w-px h-3 bg-white/10 hidden sm:block"></span>

                            <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-2 text-white hover:text-accent-teal transition-all hover:scale-105 active:scale-95 group font-bold uppercase tracking-widest"
                            >
                                <svg className="w-4 h-4 text-white group-hover:text-accent-teal transition-colors drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                <span className="hidden sm:inline">Support</span>
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }

    // STANDARD FULL FOOTER
    return (
        <footer className="w-full bg-background border-t border-white/5 pt-20 pb-10 mt-auto">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">

                    {/* Resources */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest">Ressources</h4>
                        <nav className="flex flex-col gap-3">
                            {isMember && (
                                <Link href="/docs" className="text-zinc-500 hover:text-accent-teal transition-colors text-sm">Documentation</Link>
                            )}
                            <Link
                                href="https://discord.gg/uX7G6SUDgN"
                                target="_blank"
                                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-bold group"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                Support Discord
                            </Link>
                        </nav>
                    </div>

                    {/* Legal */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest">Aide & Légal</h4>
                        <nav className="flex flex-col gap-2">
                            <Link href="/legal/faq" className="text-zinc-300 font-bold hover:text-accent-teal transition-colors text-sm flex items-center gap-2">
                                <HelpCircle className="w-4 h-4" /> FAQ & Sécurité
                            </Link>
                            <Link href="/legal/cgu" className="text-zinc-500 hover:text-accent-teal transition-colors text-sm">CGU</Link>
                            <Link href="/legal/privacy" className="text-zinc-500 hover:text-accent-teal transition-colors text-sm">Confidentialité</Link>
                            <Link href="/legal/mentions" className="text-zinc-500 hover:text-accent-teal transition-colors text-sm">Mentions Légales</Link>
                        </nav>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest">Statut</h4>
                        <Link href="/status" className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-accent-teal/30 transition-all group">
                            <div className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                systemStatus === "online" ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" :
                                    systemStatus === "degraded" ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]" :
                                        "bg-red-500 shadow-[0_0_10px_#ef4444]"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-white text-xs font-bold uppercase tracking-tight">
                                    {systemStatus === "online" ? "Tous les systèmes opérationnels" :
                                        systemStatus === "degraded" ? "Performance dégradée" :
                                            "Maintenance en cours"}
                                </span>
                                {latency && <span className="text-zinc-500 text-[10px] font-mono">{latency}ms latence</span>}
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] md:text-xs text-zinc-600 font-medium italic">
                    <div className="flex flex-col gap-1">
                        <p>© 2026 SigilOS. Fait avec passion pour Dofus par <strong>Wylan</strong>.</p>
                        <p className="opacity-50">SigilOS est un outil indépendant. Nous ne sommes pas affiliés à Ankama Games.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span>V1</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-800" />
                        <span>BETA</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
