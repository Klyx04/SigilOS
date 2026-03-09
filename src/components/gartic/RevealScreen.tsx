"use client";

import React, { useState } from "react";
import { Album, AlbumEntry, PublicPlayer } from "../../types/socket-events";
import { cn } from "@/lib/utils";

interface RevealScreenProps {
    albums: Album[];
    currentPlayerIndex: number;
    onNext: () => void;
}

export const RevealScreen = ({ albums, currentPlayerIndex, onNext }: RevealScreenProps) => {
    const album = albums[currentPlayerIndex];
    const [currentEntryIndex, setCurrentEntryIndex] = useState(0);

    if (!album) return null;

    const handleCopyAlbum = () => {
        const summary = album.entries.map(e => `${e.author.username}: ${e.type === 'text' ? `"${e.content}"` : '[DESSIN]'}`).join('\n');
        navigator.clipboard.writeText(`--- ALBUM DE ${album.owner.username} ---\n${summary}`);
        // toast is available via parent normally, or use alert for now if toast not imported
        alert("Album copié !");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-4 h-full">
            {/* Liste joueurs gauche */}
            <div className="col-span-1 border border-white/20 bg-black/20 rounded-2xl p-4 backdrop-blur-sm self-start hidden md:block">
                <h2 className="text-green-400 text-xl font-black mb-6 text-center tracking-widest drop-shadow-md">
                    ALBUMS
                </h2>
                <div className="space-y-3">
                    {albums.map((a, i) => (
                        <div
                            key={a.ownerId}
                            className={cn(
                                "px-4 py-3 rounded-xl font-bold transition-all border",
                                i === currentPlayerIndex ? "bg-white/30 border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.3)] scale-105" :
                                    i < currentPlayerIndex ? "bg-green-500/20 border-green-500/30 text-green-200" :
                                        "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            {a.owner.username}
                        </div>
                    ))}
                </div>
            </div>

            {/* Album central */}
            <div className="col-span-1 md:col-span-3 flex flex-col bg-black/20 rounded-3xl border border-white/20 backdrop-blur-md shadow-2xl p-8 relative min-h-[600px]">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-yellow-400 text-4xl font-black drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                        L'ALBUM DE {album.owner.username.toUpperCase()}
                    </h2>
                    <button
                        onClick={handleCopyAlbum}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all font-black text-[10px] tracking-widest border border-white/10 uppercase"
                    >
                        📋 Copier l'album
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-24">
                    {album.entries.map((entry, i) => (
                        <AlbumEntryCard
                            key={i}
                            entry={entry}
                            visible={i <= currentEntryIndex}
                            onVisible={() => setCurrentEntryIndex(Math.max(currentEntryIndex, i + 1))}
                        />
                    ))}
                </div>

                {/* Bouton Next fixe en bas */}
                {currentEntryIndex >= album.entries.length - 1 && (
                    <div className="absolute bottom-6 left-0 right-0 text-center animate-slide-up bg-black/50 p-6 backdrop-blur-md rounded-b-3xl border-t border-white/20">
                        <button
                            onClick={onNext}
                            className="px-8 py-4 bg-white hover:bg-gray-100 text-black rounded-3xl font-black text-xl shadow-[0_4px_0_#9ca3af] active:shadow-[0_0px_0_#9ca3af] active:translate-y-1 transition-all"
                        >
                            {currentPlayerIndex < albums.length - 1 ? "👉 ALBUM SUIVANT" : "🏆 SCORES FINAUX"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const AlbumEntryCard = ({ entry, visible, onVisible }: { entry: AlbumEntry; visible: boolean, onVisible?: () => void }) => {
    if (!visible) return null;

    return (
        <div className={cn(
            "bg-white/10 border-2 border-white/20 rounded-2xl p-6",
            "flex flex-col gap-4 animate-bounce-in shadow-xl",
        )}>
            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    👤
                </div>
                <div className="text-white/80 font-black tracking-widest text-lg">
                    {entry.author.username.toUpperCase()}
                </div>
            </div>

            <div className="flex justify-center bg-black/30 rounded-xl p-4 min-h-[100px] border border-black/50">
                {entry.type === "drawing" ? (
                    <img
                        src={entry.content}
                        alt="dessin"
                        className="rounded-xl border-4 border-white object-contain max-h-[400px] bg-white shadow-2xl"
                    />
                ) : (
                    <div className="bg-white text-black px-8 py-6 rounded-2xl text-4xl font-black text-center shadow-lg transform rotate-1 border-4 border-dashed border-gray-300">
                        "{entry.content.toUpperCase()}"
                    </div>
                )}
            </div>
        </div>
    );
};
