"use client";

import React from "react";
import { Album } from "../../types/socket-events";
import { cn } from "@/lib/utils";
import { Download, ArrowRight, Home, Maximize2, Volume2, User } from "lucide-react";

interface RevealScreenProps {
    albums: Album[];
    revealIndex: number;
    isHost: boolean;
    onNextAlbum: () => void;
    onExit: () => void;
    players?: any[];
}

export const RevealScreen = ({ albums, revealIndex, isHost, onNextAlbum, onExit, players = [] }: RevealScreenProps) => {
    const album = albums[revealIndex];
    if (!album) return null;

    const ownerName = typeof album.owner === "string" ? album.owner : album.owner?.username || "?";
    
    // In Gartic Phone, all entries are revealed one by one. 
    // For simplicity and matching the "Album" feel, we'll show all entries in the current album.
    const entries = album.entries || [];

    const handleDownload = () => {
        // Simple download logic (could be improved to download as image)
        const content = JSON.stringify(album, null, 2);
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `album-${ownerName}.json`;
        a.click();
    };

    return (
        <div className="w-full h-full max-w-[95vw] flex flex-col gap-8 animate-in fade-in duration-1000 py-12 relative">
            {/* Top Bar / Navigation */}
            <div className="flex items-center justify-between w-full px-2">
                <button 
                    onClick={onExit}
                    className="group flex items-center gap-4 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-[2rem] font-black uppercase text-sm border-b-[6px] border-black/20 transition-all active:translate-y-1 active:border-b-0 backdrop-blur-md"
                >
                    <Home size={20} className="group-hover:scale-125 transition-transform" />
                    <span>QUITTER LA GALERIE</span>
                </button>

                <div className="flex items-center gap-4">
                    <button className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                        <Maximize2 size={20} />
                    </button>
                    <button className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                        <Volume2 size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left Column: Players List */}
                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                    <div className="text-center">
                        <h2 className="text-white text-3xl font-black uppercase italic tracking-tighter drop-shadow-lg">JOUEURS</h2>
                        <div className="h-1.5 w-16 bg-[#2ed573] mx-auto rounded-full mt-1" />
                    </div>

                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-[6px] border-white/10 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar shadow-2xl">
                        {albums.map((a, idx) => {
                            const name = typeof a.owner === "string" ? a.owner : a.owner?.username || "?";
                            const isActive = idx === revealIndex;
                            return (
                                <div 
                                    key={idx}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-3xl border-b-[6px] transition-all",
                                        isActive 
                                            ? "bg-[#2ed573] border-[#1e9b53] translate-x-1" 
                                            : "bg-white/90 border-[#c5b58e] opacity-80"
                                    )}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white border-4 border-black/10 overflow-hidden shrink-0">
                                        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${name}`} alt={name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className={cn(
                                        "font-black text-xl uppercase italic tracking-tight truncate",
                                        isActive ? "text-white" : "text-[#3d2080]"
                                    )}>
                                        {name}
                                    </span>
                                    {isActive && (
                                        <div className="ml-auto bg-white/30 rounded-full p-1">
                                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                                <span className="text-[10px]">👑</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Album Scroll */}
                <div className="col-span-12 md:col-span-8 flex flex-col gap-4">
                    <div className="text-center">
                        <h2 className="text-white text-3xl font-black uppercase italic tracking-tighter drop-shadow-lg">
                            ALBUM DE {ownerName.toUpperCase()}
                        </h2>
                        <div className="h-1.5 w-16 bg-[#2ed573] mx-auto rounded-full mt-1" />
                    </div>

                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-[6px] border-white/10 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-2xl relative">
                        {entries.map((entry, idx) => {
                            const author = typeof entry.author === "string" ? entry.author : (entry.author as any)?.username || "?";
                            const isOdd = idx % 2 !== 0; // Drawing is usually odd indices if we start with text
                            const isText = entry.type === "text";

                            return (
                                <div 
                                    key={idx}
                                    className={cn(
                                        "flex gap-4 w-full animate-in slide-in-from-bottom-5 duration-500",
                                        isOdd ? "flex-row-reverse" : "flex-row"
                                    )}
                                    style={{ animationDelay: `${idx * 150}ms` }}
                                >
                                    {/* Author Avatar */}
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                        <div className="w-14 h-14 rounded-full bg-white border-4 border-[#3d2080]/20 overflow-hidden shadow-lg">
                                            <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${author}`} alt={author} className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-[10px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                            {author}
                                        </span>
                                    </div>

                                    {/* Content Bubble - Notebook Style */}
                                    <div className={cn(
                                        "flex-1 max-w-[85%] bg-white rounded-[2rem] p-6 shadow-xl border-b-[8px] border-black/10 flex flex-col items-center justify-center relative overflow-hidden",
                                        isText ? "min-h-[120px]" : "min-h-[350px]"
                                    )}>
                                        {/* Spiral decorations at the top of the "paper" */}
                                        <div className="absolute top-0 left-0 w-full flex justify-around px-12 opacity-[0.05] pointer-events-none">
                                            {Array.from({length: 8}).map((_, i) => (
                                                <div key={i} className="w-2.5 h-8 bg-black rounded-full -mt-4 shadow-inner" />
                                            ))}
                                        </div>

                                        {isText ? (
                                            <p className="text-[#3d2080] font-black text-2xl md:text-4xl text-center uppercase tracking-tight leading-tight p-4 relative z-10">
                                                {entry.content}
                                            </p>
                                        ) : (
                                            <img src={entry.content} alt="Drawing" className="max-w-full max-h-[450px] object-contain rounded-xl relative z-10" />
                                        )}

                                        {/* Subtle line pattern for text */}
                                        {isText && (
                                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px)', backgroundSize: '100% 40px' }} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* End Indicator */}
                        <div className="mt-8 flex flex-col items-center gap-4">
                            <div className="w-full h-px bg-white/20" />
                            <span className="text-white/40 font-black uppercase tracking-[0.5em] text-xs">
                                FIN DE L'ALBUM DE {ownerName.toUpperCase()}
                            </span>
                            
                            <div className="flex gap-4 mt-4 w-full max-w-md">
                                <button 
                                    onClick={handleDownload}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white p-6 rounded-3xl border-b-[8px] border-black/20 transition-all active:translate-y-2 active:border-b-0 flex items-center justify-center"
                                >
                                    <Download size={32} strokeWidth={3} />
                                </button>
                                <button 
                                    onClick={onNextAlbum}
                                    disabled={!isHost && revealIndex < albums.length - 1}
                                    className={cn(
                                        "flex-[3] p-6 rounded-3xl font-black text-white text-3xl uppercase italic tracking-tighter border-b-[12px] flex items-center justify-center gap-4 transition-all shadow-2xl",
                                        (!isHost && revealIndex < albums.length - 1)
                                            ? "bg-gray-500 border-gray-700 opacity-50 cursor-not-allowed"
                                            : "bg-[#2ed573] hover:bg-[#26af5f] border-[#1e9b53] active:translate-y-3 active:border-b-0"
                                    )}
                                >
                                    {!isHost && revealIndex < albums.length - 1 ? (
                                        "EN ATTENTE..."
                                    ) : (
                                        <>
                                            <span>SUIVANT</span>
                                            <ArrowRight size={32} strokeWidth={4} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
