"use client";

import { Tv, ExternalLink, PlayCircle } from "lucide-react";

interface Creator {
    name: string;
    role: string;
    youtube?: string;
    twitch?: string;
    color: string;
    status: "live" | "video" | "offline";
}

const CREATORS: Creator[] = [
    {
        name: "Huz",
        role: "Forgemagie & Économie",
        youtube: "https://www.youtube.com/@Huzounet",
        twitch: "https://www.twitch.tv/huzounet",
        color: "#fb923c", // Orange
        status: "video",
    },
    {
        name: "Skyzio",
        role: "PvM & Astuces",
        youtube: "https://www.youtube.com/@Skyzio",
        twitch: "https://www.twitch.tv/skyzio_",
        color: "#3b82f6", // Blue
        status: "video",
    },
    {
        name: "Lanyelle",
        role: "Lore & Quêtes",
        youtube: "https://www.youtube.com/@Laniyelle",
        twitch: "https://www.twitch.tv/laniyelle",
        color: "#a855f7", // Purple
        status: "offline",
    },
    {
        name: "Barbofus",
        role: "Guides & Aventure",
        youtube: "https://www.youtube.com/@BarbeDouce-YT",
        twitch: "https://www.twitch.tv/barbe___douce",
        color: "#10b981", // Emerald
        status: "offline",
    },
    {
        name: "Sapeuh",
        role: "PvP & E-sport",
        youtube: "https://www.youtube.com/@SAPEUH1",
        twitch: "https://www.twitch.tv/sapeuh",
        color: "#ef4444", // Red
        status: "offline",
    },
    {
        name: "Liche",
        role: "Solotage & Succès",
        youtube: "https://www.youtube.com/@Liche_fr",
        twitch: "https://www.twitch.tv/lichefr",
        color: "#facc15", // Yellow
        status: "offline",
    }
];

export function CreatorsWidget() {
    return (
        <div className="rounded-2xl relative overflow-hidden flex flex-col h-full"
            style={{
                background: "linear-gradient(145deg, rgba(20,20,24,0.8) 0%, rgba(10,10,12,0.95) 100%)",
                border: "1px solid rgba(255,255,255,0.05)",
            }}
        >
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-10 pointer-events-none"
                style={{ background: "#ef4444", transform: "translate(30%, -30%)" }} />

            {/* Header */}
            <div className="px-5 py-4 relative z-10 flex items-center justify-between border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
                        <Tv className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Créateurs de Contenu</h3>
                        <p className="text-[10px] text-zinc-400 font-medium tracking-wide">Communauté Dofus</p>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 p-3 space-y-2 relative z-10 overflow-y-auto custom-scrollbar">
                {CREATORS.map((c) => (
                    <div
                        key={c.name}
                        className="group flex flex-col gap-2 p-3 rounded-xl transition-all duration-300 bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* Initials Avatar */}
                                <div
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shadow-inner relative"
                                    style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}30` }}
                                >
                                    {c.name.substring(0, 2).toUpperCase()}
                                    {c.status === "live" && (
                                        <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-[#0a0a0c] animate-pulse" />
                                    )}
                                </div>

                                <div>
                                    <div className="text-[13px] font-bold text-white leading-tight flex items-center gap-2">
                                        {c.name}
                                        {c.status === "live" && (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                En direct
                                            </span>
                                        )}
                                        {c.status === "video" && (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                                                <PlayCircle className="h-2.5 w-2.5" /> Nv. vidéo
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-medium">{c.role}</div>
                                </div>
                            </div>
                        </div>

                        {/* Links Banner */}
                        <div className="flex items-center gap-2 mt-1">
                            {c.youtube && (
                                <a
                                    href={c.youtube}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/20 transition-colors"
                                >
                                    YouTube <ExternalLink className="h-3 w-3 mb-0.5" />
                                </a>
                            )}
                            {c.twitch && (
                                <a
                                    href={c.twitch}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/20 transition-colors"
                                >
                                    Twitch <ExternalLink className="h-3 w-3 mb-0.5" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
