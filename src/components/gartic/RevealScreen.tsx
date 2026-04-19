"use client";

import React, { useState, useEffect } from "react";
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

    const [visibleCount, setVisibleCount] = useState(0);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [visibleCount]);

    useEffect(() => {
        setVisibleCount(0);
        const timer = setTimeout(() => {
            setVisibleCount(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [revealIndex]);

    useEffect(() => {
        if (visibleCount > 0 && visibleCount < entries.length) {
            const timer = setTimeout(() => {
                import("@/lib/sounds").then(({ playSoundEffect }) => playSoundEffect("ding"));
                setVisibleCount(v => v + 1);
            }, 5000);
            return () => clearTimeout(timer);
        } else if (visibleCount === entries.length && isHost) {
            const timer = setTimeout(() => {
                onNextAlbum();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [visibleCount, entries.length, isHost, onNextAlbum]);



    return (
        <div className="w-full h-full max-w-[95vw] flex flex-col gap-4 animate-in fade-in duration-1000 py-4 relative">
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

                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-[4px] md:border-[6px] border-white/10 p-3 md:p-4 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto custom-scrollbar shadow-2xl shrink-0 md:shrink">
                        {albums.map((a, idx) => {
                            const name = typeof a.owner === "string" ? a.owner : a.owner?.username || "?";
                            const isActive = idx === revealIndex;
                            return (
                                <div 
                                    key={idx}
                                    className={cn(
                                        "flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl md:rounded-3xl border-b-[4px] md:border-b-[6px] transition-all shrink-0 md:shrink-0",
                                        isActive 
                                            ? "bg-[#2ed573] border-[#1e9b53] translate-x-1" 
                                            : "bg-white/90 border-[#c5b58e] opacity-80"
                                    )}
                                >
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border-2 md:border-4 border-black/10 overflow-hidden shrink-0">
                                        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${name}`} alt={name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className={cn(
                                        "font-black text-sm md:text-xl uppercase italic tracking-tight truncate max-w-[100px] md:max-w-none",
                                        isActive ? "text-white" : "text-[#3d2080]"
                                    )}>
                                        {name}
                                    </span>
                                    {isActive && (
                                        <div className="ml-auto bg-white/30 rounded-full p-1 hidden md:block">
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

                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-[6px] border-white/10 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-2xl relative" ref={scrollRef}>
                        {entries.slice(0, visibleCount).map((entry, idx) => {
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
                                        "flex-1 max-w-[85%] bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 shadow-xl border-b-[4px] md:border-b-[8px] border-black/10 flex flex-col items-center justify-center relative overflow-hidden",
                                        isText ? "min-h-0 py-4 md:min-h-[120px]" : "min-h-[150px] md:min-h-[350px]"
                                    )}>
                                        {/* Spiral decorations at the top of the "paper" */}
                                            <div className="absolute top-0 left-0 w-full flex justify-around px-12 opacity-[0.05] pointer-events-none">
                                                {Array.from({length: 8}).map((_, i) => (
                                                    <div key={i} className="w-2.5 h-8 bg-black rounded-full -mt-4 shadow-inner" />
                                                ))}
                                            </div>

                                            {isText ? (
                                                <p className="text-[#3d2080] font-black text-lg md:text-2xl lg:text-4xl text-center uppercase tracking-tight leading-tight p-2 md:p-4 relative z-10">
                                                    {entry.content}
                                                </p>
                                            ) : (
                                                    <div className="relative group/img w-full flex flex-col items-center">
                                                        <img src={entry.content} alt="Drawing" className="max-w-full max-h-[250px] md:max-h-[450px] object-contain rounded-xl relative z-10 shadow-lg" />
                                                        <div className="flex justify-center mt-4 gap-4 relative z-20">
                                                            <button 
                                                                onClick={() => {
                                                                    const link = document.createElement("a");
                                                                    link.href = entry.content;
                                                                    link.download = `sigil-phone-${ownerName.replace(/\s+/g, '-')}-${idx}.png`;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                }}
                                                                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] italic rounded-xl border-b-4 border-emerald-700 transition-all active:translate-y-1 active:border-b-0 shadow-lg"
                                                            >
                                                                <Download size={14} />
                                                                Télécharger PNG
                                                            </button>
                                                        </div>
                                                    </div>
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
                        {visibleCount === entries.length && (
                            <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in duration-500">
                                <div className="w-full h-px bg-white/20" />
                                <span className="text-white/40 font-black uppercase tracking-[0.5em] text-xs">
                                    FIN DE L'ALBUM DE {ownerName.toUpperCase()}
                                </span>
                                

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
