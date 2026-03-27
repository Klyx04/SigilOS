"use client";

import React, { useState } from "react";
import { useGarticSocket } from "../hooks/useGarticSocket";
import { Loader2, AlertTriangle, Users, Play, Crown, Trophy, ArrowRight } from "lucide-react";
// Import the phase components later. For now let's just create stubs or simple inline versions 
import { GarticCanvas, GarticCanvasRef } from "./Canvas/GarticCanvas";
import { DrawTool } from "@/types/socket-events";

interface GarticGameProps {
    guildId: string;
    user: any;
}

export function GarticGame({ guildId, user }: GarticGameProps) {
    const { socket, isConnected, gameState, createRoom, joinRoom, startGame, leaveRoom, submitText, submitDraw } = useGarticSocket();
    // State & Refs at the top (Hook Rule)
    const [roomIdToJoin, setRoomIdToJoin] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [inputText, setInputText] = useState("");
    const [brushColor, setBrushColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(5);
    const [brushTool, setBrushTool] = useState<DrawTool>("pencil");
    const [brushOpacity, setBrushOpacity] = useState(1);
    const canvasRef = React.useRef<GarticCanvasRef>(null);

    // Clear input on phase change
    React.useEffect(() => {
        if (gameState?.phase) setInputText("");
    }, [gameState?.phase]);

    React.useEffect(() => {
        if (!socket) return;
        const onError = (data: { message: string }) => setError(data.message);
        socket.on("gartic:error", onError);
        return () => { socket.off("gartic:error", onError); };
    }, [socket]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-full text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
                <p className="font-dofus text-base animate-pulse">Connexion au Zaap...</p>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="p-8 max-w-lg mx-auto w-full h-full flex flex-col justify-center">
                <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                    <div className="text-center space-y-2">
                        <h2 className="text-4xl font-black text-amber-400 font-dofus tracking-widest drop-shadow-lg italic">Sigil-Phone</h2>
                        <p className="text-zinc-500 text-sm font-medium uppercase tracking-tighter">Édition Dofusienne</p>
                    </div>
                    
                    {error && (
                        <div className="p-4 bg-red-950/30 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <button
                            onClick={() => { setError(null); createRoom({ maxRounds: 10, maxPlayers: 10, mode: "NORMAL", userId: user.id, userName: user.name, userAvatar: user.image }); }}
                            className="w-full group relative px-8 py-5 bg-gradient-to-br from-amber-600 to-amber-900 hover:from-amber-500 hover:to-amber-800 text-white font-black rounded-2xl transition-all border border-amber-500/20 flex justify-center items-center shadow-[0_10px_30px_rgba(180,83,9,0.3)] hover:shadow-amber-500/20 active:scale-95 overflow-hidden"
                        >
                            <span className="relative z-10 text-xl font-dofus tracking-wider">CRÉER UN SALON</span>
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest font-black"><span className="bg-zinc-900 px-4 text-zinc-600">OU</span></div>
                    </div>

                    <div className="flex gap-3 h-14">
                        <input
                            type="text"
                            placeholder="Code du salon..."
                            value={roomIdToJoin}
                            onChange={(e) => setRoomIdToJoin(e.target.value.toUpperCase())}
                            className="flex-1 bg-zinc-950 border-2 border-zinc-800 rounded-xl px-5 text-white focus:outline-none focus:border-amber-500/50 transition-all uppercase font-mono tracking-widest text-lg placeholder:text-zinc-700"
                        />
                        <button
                            disabled={!roomIdToJoin || roomIdToJoin.length < 5}
                            onClick={() => { setError(null); joinRoom(roomIdToJoin, user.name); }}
                            className="px-6 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:grayscale text-white font-bold rounded-xl transition-all border border-zinc-700 shadow-lg active:scale-95"
                        >
                            <Users className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { phase, timer, maxTimer, currentRound, maxRounds, task } = gameState;
    const isHost = gameState.hostId === user.id;
    const hasSubmitted = gameState.players.find(p => p.id === socket?.id)?.hasSubmitted;

    // Timer logic for camembert
    const timerPercentage = maxTimer > 0 ? (timer / maxTimer) * 100 : 100;
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (timerPercentage / 100) * circumference;

    if (phase === "LOBBY") {
        return (
            <div className="p-4 md:p-8 max-w-5xl mx-auto w-full h-full flex flex-col justify-start md:justify-center overflow-y-auto custom-scrollbar pb-24">
                <div className="bg-zinc-900/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-zinc-800 shadow-2xl animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-12 gap-6 md:gap-8">
                        <div className="space-y-1 md:space-y-2">
                             <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-zinc-500 text-xs font-black uppercase tracking-[0.2em]">En Ligne - Salon Ouvert</span>
                             </div>
                             <h2 className="text-3xl md:text-5xl font-black text-white font-dofus tracking-tighter drop-shadow-sm">
                                Code <span className="text-amber-500 bg-amber-500/10 px-3 md:px-6 py-0.5 md:py-1 rounded-2xl border border-amber-500/20 ml-2 font-mono tracking-widest">{gameState.id}</span>
                            </h2>
                        </div>
                        
                        <div className="flex items-center gap-4">
                             <button 
                                onClick={leaveRoom}
                                className="px-6 py-4 bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 text-zinc-400 font-bold rounded-2xl transition-all active:scale-95"
                             >
                                 Quitter
                             </button>
                             {isHost && (
                                <button
                                    onClick={startGame}
                                    disabled={gameState.players.length < 2}
                                    className="px-10 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:grayscale text-white font-black rounded-2xl transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(22,163,74,0.2)] active:scale-95 group font-dofus"
                                >
                                    <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                                    LANCER LA PARTIE
                                </button>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {gameState.players.map((player) => (
                            <div key={player.id} className="group relative bg-zinc-950/40 p-6 rounded-[2rem] flex flex-col items-center gap-4 border border-zinc-800/50 hover:bg-zinc-950/80 hover:border-amber-500/30 transition-all duration-300">
                                {gameState.hostId === player.id && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 px-3 py-1 rounded-full shadow-lg z-10 flex items-center gap-1 scale-90">
                                        <Crown className="w-4 h-4 fill-current" />
                                        <span className="text-[10px] font-black uppercase">Chef</span>
                                    </div>
                                )}
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-900 border-4 border-zinc-800 group-hover:border-amber-500/50 transition-colors shadow-2xl relative">
                                    <img src={`https://sigilos.fr/images/classes/${player.dofusClass || '1'}_1.png`} alt="Classe Dofus" className="w-full h-full object-cover scale-110 object-top group-hover:scale-125 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <span className="font-bold text-zinc-400 group-hover:text-amber-400 text-base truncate w-full text-center font-dofus transition-colors">
                                    {player.username}
                                </span>
                            </div>
                        ))}
                        {Array.from({ length: Math.max(0, 1) }).map((_, i) => (
                             <div key={i} className="bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[2rem] flex flex-col items-center justify-center p-6 text-zinc-700 min-h-[160px]">
                                  <Users className="w-8 h-8 opacity-20 mb-2" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-center">Place Libre</span>
                             </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }


    const colors = [
        "#000000", "#666666", "#aaaaaa", "#ffffff", 
        "#ff0000", "#ff6600", "#ffcc00", "#ffff00", 
        "#00ff00", "#00ff99", "#00ffff", "#0099ff", 
        "#0000ff", "#6600ff", "#ff00ff", "#ff0099",
        "#553300", "#aa5500", "#ffaa00", "#ffddaa",
        "#003300", "#006600", "#00aa00", "#66cc66",
        "#000033", "#000066", "#0000aa", "#6666ff",
        "#330033", "#660066", "#aa00aa", "#ff66ff",
        "#ffcccc", "#ff9999", "#ff6666", "#cc0000"
    ];

    const tools: { id: DrawTool, icon: string, label: string }[] = [
        { id: "pencil", icon: "✏️", label: "Crayon" },
        { id: "eraser", icon: "⌫", label: "Gomme" },
        { id: "rect-outline", icon: "□", label: "Carré Vide" },
        { id: "circle-outline", icon: "○", label: "Cercle Vide" },
        { id: "rect-fill", icon: "■", label: "Carré Plein" },
        { id: "circle-fill", icon: "●", label: "Cercle Plein" },
        { id: "bucket", icon: "🪣", label: "Remplir" },
    ];

    if (phase === "STARTING") {
        return (
             <div className="flex flex-col items-center justify-center h-full bg-[#c83d5a] px-4 overflow-hidden relative"
                  style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                  <div className="space-y-8 md:space-y-12 text-center animate-in zoom-in duration-700 relative z-10">
                       <h2 className="text-6xl md:text-9xl font-black text-white font-dofus drop-shadow-[0_10px_40px_rgba(0,0,0,0.3)] italic tracking-tighter uppercase">
                           PRÊTS ?
                       </h2>
                       <div className="flex flex-col items-center gap-4">
                           <div className="w-24 h-24 md:w-40 md:h-40 bg-white rounded-full flex items-center justify-center shadow-2xl relative">
                                <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                                     <circle cx="80" cy="80" r="75" className="stroke-zinc-100 fill-none" strokeWidth="10" />
                                     <circle 
                                        cx="80" 
                                        cy="80" 
                                        r="75" 
                                        className="stroke-amber-500 fill-none transition-all duration-1000" 
                                        strokeWidth="10" 
                                        strokeDasharray={2 * Math.PI * 75}
                                        strokeDashoffset={ (2 * Math.PI * 75) - ( (timer / maxTimer) * (2 * Math.PI * 75) ) }
                                        strokeLinecap="round"
                                     />
                                </svg>
                                <span className="text-7xl font-black text-amber-500 font-mono relative z-10">{timer}</span>
                           </div>
                           <p className="text-white font-black uppercase tracking-[0.6em] text-xl mt-8">Départ imminent...</p>
                       </div>
                  </div>
             </div>
        );
    }

    if (phase === "INTERMISSION") {
        return (
             <div className="flex flex-col items-center justify-center h-full bg-[#c83d5a] px-4 relative overflow-hidden"
                  style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                  <div className="space-y-12 text-center animate-in zoom-in duration-700 relative z-10">
                       <h2 className="relative text-7xl md:text-9xl font-black text-white font-dofus drop-shadow-[0_10px_40px_rgba(0,0,0,0.3)] italic tracking-tighter">
                           TOUR {currentRound + 1}
                       </h2>
                       <div className="flex flex-col items-center gap-4">
                           <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl relative">
                                <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                                     <circle cx="48" cy="48" r="42" className="stroke-zinc-50 fill-none" strokeWidth="8" />
                                     <circle 
                                        cx="48" 
                                        cy="48" 
                                        r="42" 
                                        className="stroke-amber-500 fill-none transition-all duration-1000" 
                                        strokeWidth="8" 
                                        strokeDasharray={2 * Math.PI * 42}
                                        strokeDashoffset={ (2 * Math.PI * 42) - ( (timer / maxTimer) * (2 * Math.PI * 42) ) }
                                        strokeLinecap="round"
                                     />
                                </svg>
                                <span className="text-3xl font-black text-amber-500 font-mono relative z-10">{timer}</span>
                           </div>
                       </div>
                  </div>
             </div>
        );
    }

    if (hasSubmitted) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-[#c83d5a] relative overflow-hidden"
                 style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                 <div className="bg-white p-10 md:p-16 rounded-[4rem] flex flex-col items-center shadow-2xl relative scale-75 md:scale-100">
                     <Loader2 className="w-12 h-12 md:w-20 md:h-20 animate-spin text-amber-500 mb-8" />
                     <h2 className="text-4xl md:text-6xl font-black text-[#c83d5a] mb-4 font-dofus italic uppercase">TERMINÉ !</h2>
                     <p className="text-zinc-400 font-bold text-lg md:text-xl uppercase tracking-widest">En attente de la guilde...</p>
                 </div>
                <button onClick={leaveRoom} className="absolute bottom-12 text-white/60 font-black uppercase tracking-widest">Quitter</button>
            </div>
        );
    }

    if (phase === "REVEAL") {
        return (
            <div className="h-full bg-[#c83d5a] overflow-y-auto custom-scrollbar relative px-4 py-12"
                 style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                <div className="max-w-6xl mx-auto w-full space-y-32 pb-48">
                    <div className="text-center animate-in slide-in-from-top-12 duration-1000">
                        <div className="inline-block bg-white/20 backdrop-blur-md px-12 py-6 rounded-[3rem] border border-white/30 shadow-2xl">
                             <h2 className="text-8xl font-black text-white font-dofus italic uppercase tracking-widest">ALBUM DE GUILDE</h2>
                        </div>
                    </div>

                    <div className="space-y-48">
                        {gameState.albums?.map((album, idx) => (
                            <div key={idx} className="space-y-16 animate-in fade-in slide-in-from-bottom-24 duration-1000" style={{ animationDelay: `${idx * 400}ms` }}>
                                <div className="flex items-center gap-10">
                                    <div className="h-[6px] flex-1 bg-white/20 rounded-full shadow-inner"></div>
                                    <div className="flex flex-col items-center">
                                         <span className="text-white/50 text-xs font-black uppercase tracking-[0.6em] mb-3">L'histoire de</span>
                                         <h3 className="text-6xl font-black text-white font-dofus italic tracking-tight drop-shadow-xl">{album.owner}</h3>
                                    </div>
                                    <div className="h-[6px] flex-1 bg-white/20 rounded-full shadow-inner"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                                    {album.entries.map((entry: any, eIdx: number) => (
                                        <div key={eIdx} className="group flex flex-col scale-100 hover:scale-[1.03] transition-all duration-500">
                                             <div className="text-[11px] text-[#c83d5a] mb-0 flex justify-between font-black uppercase tracking-[0.2em] bg-white px-6 py-3 rounded-t-[2.5rem] border-b border-zinc-100 font-dofus italic">
                                                 <span>{entry.author}</span>
                                                 <span className="opacity-30">{eIdx + 1}</span>
                                             </div>
                                            <div className="bg-white p-8 rounded-b-[2.5rem] rounded-tr-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden h-[360px] flex flex-col justify-center relative border-4 border-white ring-1 ring-black/5">
                                                {entry.type === 'text' ? (
                                                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                                                        <p className="text-4xl font-black text-[#c83d5a] font-dofus leading-tight italic drop-shadow-sm">
                                                            "{entry.content}"
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 rounded-2xl overflow-hidden bg-white">
                                                        <img src={entry.content} alt="" className="w-full h-full object-contain" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex gap-6">
                        <button onClick={leaveRoom} className="px-12 py-6 bg-black/40 text-white font-black rounded-2xl">BUREAU</button>
                        {isHost && <button onClick={startGame} className="px-16 py-6 bg-white text-[#c83d5a] font-black rounded-2xl text-3xl font-dofus uppercase">REJOUER !</button>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#c83d5a] gap-0 w-full overflow-hidden relative"
             style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
            
            {/* Header - Now spans full width or has internal padding */}
            <div className="w-full bg-black/10 backdrop-blur-md px-8 py-4 border-b border-white/10 shadow-lg relative z-30">
                <div className="flex items-center justify-between">
                     <div className="flex flex-col shrink-0">
                        <h1 className="text-2xl md:text-4xl font-black text-white font-dofus italic uppercase drop-shadow-md">SIGIL-PHONE</h1>
                        <span className="text-white/60 text-[8px] md:text-[10px] uppercase font-black tracking-[0.4em]">Version Dofusienne</span>
                     </div>
                     <div className="flex items-center gap-6">
                         <div className="flex -space-x-3">
                            {gameState.players.map(p => (
                                <div key={p.id} className={`w-12 h-12 rounded-full border-4 ${p.hasSubmitted ? 'border-green-400 scale-110 z-10' : 'border-white/10 opacity-40'} overflow-hidden transition-all duration-500 shadow-xl`}>
                                    <img src={`https://sigilos.fr/images/classes/${p.dofusClass || '1'}_1.png`} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                         </div>
                         <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl relative">
                            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                                <circle cx="40" cy="40" r="35" className="stroke-zinc-100 fill-none" strokeWidth="6" />
                                <circle 
                                    cx="40" cy="40" r="35" 
                                    className="stroke-amber-500 fill-none transition-all duration-300" strokeWidth="6" 
                                    strokeDasharray={2 * Math.PI * 35}
                                    strokeDashoffset={(2 * Math.PI * 35) - ( (timer / maxTimer) * (2 * Math.PI * 35) )}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className={`font-black text-2xl font-mono ${timer < 10 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>{timer}</span>
                         </div>
                         <button onClick={leaveRoom} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white backdrop-blur-md transition-all">
                            <ArrowRight className="w-6 h-6 rotate-180" />
                         </button>
                     </div>
                </div>

                {/* Assignment Box */}
                {(phase === 'DRAWING' || phase === 'GUESSING') && task && (
                    <div className="bg-[#5c2a7e]/80 backdrop-blur-md rounded-[3rem] p-8 text-center shadow-2xl animate-in slide-in-from-top-8 border-b-8 border-black/20 mt-4 mx-8">
                        {phase === 'DRAWING' ? (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.6em] italic">DESSINE MAINTENANT :</span>
                                <h2 className="text-3xl md:text-6xl font-black text-white font-dofus italic uppercase tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)] truncate max-w-full">
                                    {task.content}
                                </h2>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.6em] italic">QUE VOIS-TU ?</span>
                                <h2 className="text-4xl font-black text-white font-dofus italic uppercase tracking-tighter opacity-80">
                                    OBSERVE LE DESSIN ET DEVINNE !
                                </h2>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Area - Use flex-1 to fill all remaining space */}
            <div className="flex-1 w-full max-w-[1800px] mx-auto flex gap-6 min-h-0 relative px-6 pb-6 mt-4">
                
                {/* DRAW PHASE UI */}
                {phase === 'DRAWING' && (
                    <div className="flex flex-1 w-full gap-6 animate-in fade-in duration-500">
                        
                        {/* LEFT: COLORS */}
                        <div className="w-48 bg-[#2d1b33]/40 backdrop-blur-md p-4 rounded-[2.5rem] flex flex-col gap-4 border border-white/10 shadow-2xl overflow-y-auto custom-scrollbar">
                             <div className="grid grid-cols-3 gap-2">
                                {colors.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => setBrushColor(c)}
                                        className={`w-10 h-10 rounded-lg border-2 transition-all ${brushColor === c ? 'border-white scale-110 shadow-lg' : 'border-black/20 hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                             </div>
                             <div className="mt-auto bg-black/20 p-2 rounded-xl flex flex-col items-center gap-2">
                                <div className="w-10 h-10 rounded-lg border-2 border-white shadow-xl" style={{ backgroundColor: brushColor }} />
                             </div>
                        </div>

                        {/* CENTER: CANVAS */}
                        <div className="flex-1 flex flex-col">
                            <GarticCanvas 
                                ref={canvasRef} 
                                isDrawing={true} 
                                onStrokeSubmit={() => {}}
                                brushColor={brushColor}
                                brushSize={brushSize}
                                brushTool={brushTool}
                                brushOpacity={brushOpacity}
                            />
                        </div>

                        {/* RIGHT: TOOLS */}
                        <div className="w-48 bg-[#2d1b33]/40 backdrop-blur-md p-4 rounded-[2.5rem] flex flex-col gap-3 border border-white/10 shadow-2xl overflow-y-auto custom-scrollbar">
                             <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                                {tools.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => setBrushTool(t.id)}
                                        className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-lg md:text-xl transition-all ${brushTool === t.id ? 'bg-white text-zinc-900 shadow-xl scale-110' : 'bg-black/20 text-white/60 hover:bg-black/40'}`}
                                        title={t.label}
                                    >
                                        {t.icon}
                                    </button>
                                ))}
                             </div>
                             <div className="h-px bg-white/10 my-2" />
                             <div className="grid grid-cols-1 gap-2">
                                <button onClick={() => canvasRef.current?.undo()} className="w-full py-3 bg-black/20 text-white rounded-xl hover:bg-black/40">↩️</button>
                                <button onClick={() => canvasRef.current?.redo()} className="w-full py-3 bg-black/20 text-white rounded-xl hover:bg-black/40">↪️</button>
                                <button onClick={() => canvasRef.current?.clear()} className="w-full py-3 bg-red-900/40 text-red-200 rounded-xl hover:bg-red-900/60 mt-4">🗑️</button>
                             </div>
                        </div>

                        {/* BOTTOM: BRUSH & FINISH */}
                         <div className="absolute bottom-2 md:-bottom-2 inset-x-4 md:inset-x-0 bg-[#2d1b33]/80 backdrop-blur-3xl px-4 md:px-12 py-3 md:py-5 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center justify-between shadow-[0_20px_60px_rgba(0,0,0,0.5)] z-20 gap-4 md:gap-0">
                              <div className="flex items-center gap-4 md:gap-12 flex-1 w-full justify-between md:justify-start">
                                 <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                     {[2, 5, 10, 20, 40].map(s => (
                                         <button 
                                             key={s} 
                                             onClick={() => setBrushSize(s)}
                                             className={`rounded-full transition-all ${brushSize === s ? 'bg-white scale-125' : 'bg-white/20 hover:bg-white/40'}`}
                                             style={{ width: 8 + s/6, height: 8 + s/6 }}
                                         />
                                     ))}
                                 </div>
                                 <div className="flex-1 max-w-[120px] md:max-w-xs flex flex-col gap-1">
                                     <input type="range" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="accent-white h-1 cursor-pointer" />
                                     <div className="flex justify-between text-[8px] md:text-[10px] font-black text-white/40 uppercase"><span>Fin</span><span>Epais</span></div>
                                 </div>
                              </div>
 
                              <button 
                                 onClick={() => canvasRef.current?.getImageData() && submitDraw(canvasRef.current.getImageData())}
                                 className="w-full md:w-auto px-6 md:px-12 py-4 md:py-6 bg-gradient-to-r from-green-500 to-green-600 border-b-6 md:border-b-8 border-green-800 text-white font-black text-xl md:text-3xl rounded-xl md:rounded-[2rem] shadow-2xl active:scale-95 transition-all font-dofus uppercase flex items-center justify-center gap-3 md:gap-4 group shrink-0"
                              >
                                  <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center text-green-600 transition-transform group-hover:rotate-12">✓</div>
                                  <span>TERMINÉ !</span>
                              </button>
                         </div>
                    </div>
                )}

                {/* WRITING PHASE UI */}
                {phase === 'WRITING' && (
                    <div className="flex flex-1 flex-col items-center justify-center bg-white/5 backdrop-blur-xl rounded-[4rem] p-12 animate-in fade-in duration-700 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none" />
                         
                         <div className="relative mb-16 scale-110">
                             <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-all duration-1000" />
                             <div className="bg-white p-10 rounded-[4rem] shadow-2xl relative z-10 border-4 border-white">
                                 <img src={`https://sigilos.fr/images/classes/11_1.png`} alt="" className="w-64 h-64 object-contain animate-float" />
                             </div>
                         </div>

                         <div className="text-center mb-12 space-y-4">
                             <h2 className="text-7xl font-black text-white font-dofus italic uppercase tracking-tighter drop-shadow-lg">
                                 ÉCRIS TON HISTOIRE
                             </h2>
                             <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs">Plus c'est bizarre, plus c'est drôle !</p>
                         </div>

                         <div className="w-full max-w-4xl flex flex-col gap-4">
                              <div className="flex flex-col md:flex-row gap-4">
                                  <div className="relative flex-1 group">
                                      <input 
                                         type="text"
                                         className="w-full bg-white border-none rounded-[1.5rem] md:rounded-[2.5rem] px-6 md:px-12 py-6 md:py-10 text-xl md:text-4xl text-zinc-900 placeholder-zinc-200 font-dofus italic shadow-2xl focus:outline-none transition-all focus:ring-8 focus:ring-white/10"
                                         placeholder="Un Pandawa bourré qui..."
                                         autoFocus
                                         value={inputText}
                                         onChange={(e) => setInputText(e.target.value)}
                                         onKeyDown={(e) => e.key === 'Enter' && inputText.trim() && submitText(inputText)}
                                      />
                                      <button 
                                         onClick={() => {
                                             const prompts = ["Un Tofu géant divin", "Prysmaratus en slip", "Un Iop essayant de lire", "Le Comte Harebourg en vacances", "Un Bouftou rose pailleté"];
                                             setInputText(prompts[Math.floor(Math.random() * prompts.length)]);
                                         }}
                                         className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 md:w-16 md:h-16 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-3xl transition-transform hover:rotate-12 active:scale-90 shadow-md"
                                         title="Inspiration aléatoire"
                                      >
                                          🎲
                                      </button>
                                  </div>
 
                                  <button 
                                     onClick={() => inputText.trim() && submitText(inputText)}
                                     className="w-full md:w-auto px-10 md:px-16 py-6 md:py-10 bg-[#33A1FF] hover:bg-[#1E88E5] text-white font-black text-2xl md:text-3xl rounded-[1.5rem] md:rounded-[2.5rem] transition-all shadow-[0_20px_40px_rgba(51,161,255,0.3)] active:scale-95 font-dofus uppercase border-b-8 border-[#1E88E5] active:border-b-0 active:translate-y-2"
                                  >
                                     PRÊT !
                                  </button>
                              </div>
                          </div>
                    </div>
                )}

                {/* GUESSING PHASE UI */}
                {phase === 'GUESSING' && task && (
                    <div className="flex flex-1 flex-col items-center justify-center p-8 gap-8 animate-in fade-in duration-500">
                         <div className="flex-1 bg-white rounded-[3rem] p-8 shadow-2xl max-w-5xl w-full border-b-[12px] border-black/10">
                              <img src={task.content} alt="" className="w-full h-full object-contain" />
                         </div>
                         <div className="w-full max-w-4xl flex gap-4">
                             <input 
                                type="text"
                                className="flex-1 bg-white border-none rounded-[2rem] px-12 py-10 text-4xl text-zinc-900 placeholder-zinc-200 font-dofus italic shadow-2xl focus:outline-none"
                                placeholder="Ta devinette..."
                                autoFocus
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputText.trim() && submitText(inputText)}
                             />
                             <button 
                                onClick={() => inputText.trim() && submitText(inputText)}
                                className="px-16 py-10 bg-[#33A1FF] hover:bg-[#1E88E5] text-white font-black text-3xl rounded-[2rem] transition-all shadow-2xl active:scale-95 font-dofus uppercase border-b-8 border-[#1E88E5]"
                             >
                                TERMINÉ !
                             </button>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
}
