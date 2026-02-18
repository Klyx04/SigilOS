"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

type SystemStatus = "online" | "degraded" | "offline";

export function GalacticFooter() {
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
                    if (data.status === "healthy") {
                        setSystemStatus("online");
                    } else if (data.status === "degraded") {
                        setSystemStatus("degraded");
                    } else {
                        setSystemStatus("offline");
                    }
                } else {
                    setSystemStatus("offline");
                }
            } catch {
                setLatency(null);
                setSystemStatus("offline");
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const getPingColor = (ms: number) => {
        if (ms < 100) return "text-emerald-400";
        if (ms < 300) return "text-amber-400";
        return "text-red-400";
    };

    const getStatusConfig = (status: SystemStatus) => {
        switch (status) {
            case "online":
                return { color: "bg-emerald-500", textColor: "text-emerald-500", label: "Système en ligne" };
            case "degraded":
                return { color: "bg-amber-500", textColor: "text-amber-500", label: "Dégradé" };
            case "offline":
                return { color: "bg-red-500", textColor: "text-red-500", label: "Hors Ligne" };
        }
    };

    if (!mounted) return null;

    const statusConfig = getStatusConfig(systemStatus);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-5xl px-4 pointer-events-none">
            <footer className="w-full relative rounded-2xl border border-white/10 bg-[#020202]/40 backdrop-blur-2xl saturate-150 py-3 px-6 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Advanced 2026 Glow Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent blur-[1px]" />
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-purple-500/5 blur-[25px] rounded-full" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] sm:text-xs relative z-10">

                    {/* ZONE GAUCHE : IDENTITÉ & LÉGAL */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="font-black tracking-tighter text-white">SIGIL</span>
                            <span className="font-mono text-zinc-500 opacity-60">v2.5.4</span>
                        </div>
                        <span className="w-px h-3 bg-white/10 hidden sm:block"></span>
                        <div className="flex items-center gap-4 font-bold uppercase tracking-[0.15em] text-zinc-300">
                            <Link href="/legal/cgu" className="hover:text-white transition-colors">CGU</Link>
                            <Link href="/legal/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                            <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions</Link>
                        </div>
                    </div>

                    {/* ZONE CENTRE : STATUS ORBITAL */}
                    <Link
                        href="/status"
                        className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 hover:border-purple-500/40 hover:bg-white/10 transition-all duration-500 group"
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_currentColor]", statusConfig.textColor)}></div>
                        <span className={cn("font-black tracking-[0.25em] text-[9px] uppercase", statusConfig.textColor)}>
                            {statusConfig.label}
                        </span>
                        {latency && (
                            <span className="text-[9px] font-mono text-zinc-500 group-hover:text-zinc-200 transition-colors">
                                {latency}ms
                            </span>
                        )}
                        <Activity className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </Link>

                    {/* ZONE DROITE : TECH & SUPPORT */}
                    <div className="flex items-center gap-6">
                        <div className="hidden lg:flex items-center gap-2 text-zinc-500 italic opacity-60">
                            © 2026 SigilOS
                        </div>

                        <span className="w-px h-3 bg-white/10 hidden sm:block"></span>

                        {/* Support Link with Discord Icon */}
                        <Link
                            href="https://discord.gg/uX7G6SUDgN"
                            target="_blank"
                            className="flex items-center gap-2 text-white hover:text-[#5865F2] transition-all hover:scale-105 active:scale-95 group font-black uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4 text-white group-hover:text-[#5865F2] transition-colors drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(88,101,242,0.5)]" viewBox="0 0 127.14 96.36" fill="currentColor">
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
