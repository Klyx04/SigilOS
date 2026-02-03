"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, Bug, MessageCircle } from "lucide-react";

export function GalacticFooter() {
    const [latency, setLatency] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkPing = async () => {
            const start = Date.now();
            try {
                await fetch('/api/health'); // Simple endpoint or just root
                const end = Date.now();
                setLatency(end - start);
            } catch (e) {
                setLatency(null);
            }
        };

        checkPing();
        const interval = setInterval(checkPing, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const getPingColor = (ms: number) => {
        if (ms < 100) return "text-emerald-400";
        if (ms < 300) return "text-amber-400";
        return "text-red-400";
    };

    if (!mounted) return null;

    return (
        <footer className="w-full border-t border-white/5 bg-black/40 backdrop-blur-md pb-safe-offset">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-[10px] sm:text-xs">

                {/* ZONE GAUCHE : IDENTITÉ & LÉGAL */}
                <div className="flex items-center gap-4 text-zinc-500 font-mono">
                    <span className="hidden sm:inline">SIGILOS v2.4</span>
                    <span className="hidden sm:inline">•</span>
                    <span>© 2026 Stellium</span>
                    <span className="w-px h-3 bg-white/10 hidden sm:block"></span>
                    <div className="flex items-center gap-3">
                        <Link href="/legal/cgu" className="hover:text-white transition-colors">CGU</Link>
                        <Link href="/legal/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                        <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions</Link>
                    </div>
                </div>

                {/* ZONE CENTRE : AMBIANCE (Hidden on mobile) */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="font-black tracking-[0.2em] text-[10px] text-emerald-500 uppercase">System Online</span>
                </div>

                {/* ZONE DROITE : TECH & SUPPORT */}
                <div className="flex items-center gap-4 sm:gap-6">
                    {/* Ping Meter */}
                    <div className="flex items-center gap-2 font-mono" title="Latence client-serveur">
                        <Activity className="w-3 h-3 text-zinc-600" />
                        <span className={cn("font-bold transition-colors", latency ? getPingColor(latency) : "text-zinc-600")}>
                            {latency ? `${latency}ms` : "--"}
                        </span>
                    </div>

                    <div className="w-px h-3 bg-white/10"></div>

                    {/* Support Link with Discord Icon */}
                    <Link
                        href="https://discord.gg/stellium"
                        target="_blank"
                        className="flex items-center gap-2 text-zinc-400 hover:text-[#5865F2] transition-colors group"
                    >
                        <svg className="w-4 h-4 text-zinc-500 group-hover:text-[#5865F2] transition-colors" viewBox="0 0 127.14 96.36" fill="currentColor">
                            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                        </svg>
                        <span className="hidden sm:inline font-semibold">Support</span>
                    </Link>
                </div>
            </div>
        </footer>
    );
}
