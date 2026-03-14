"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Crown, LogOut, Play, Plus, Trophy, Clock, Swords, ChevronLeft, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";

import { CardComponent, CardBack, Card } from "./cards/CardComponent";
import { ParticleCanvas, BonusType } from "./ParticleCanvas";

// ─── Types ────────────────────────────────────────────────────
type Suit = "fire" | "water" | "air" | "earth" | "stasis";

interface PlayedCard { playerId: string; card: Card; sramChoice?: "incarnation" | "pandawa"; }

interface PlayerState {
    odKey: string;
    userName: string;
    userAvatar?: string;
    score: number;
    bid: number | "hidden" | null;
    tricksWon: number;
    handCount: number;
    isConnected: boolean;
    isSpectator: boolean;
    seatIndex: number;
    isCurrentTurn: boolean;
    hasBid: boolean;
}

interface GameState {
    id: string;
    phase: "LOBBY" | "BIDDING" | "PLAYING" | "ROUND_END" | "GAME_END";
    round: number;
    maxRounds: number;
    settings: { advancedCards: boolean; stormMode: boolean; maxRounds: number; timeoutBid: number; timeoutPlay: number };
    currentPlayerIndex: number;
    dealerIndex: number;
    timeLeft: number;
    hostId: string | null;
    currentTrick: { cards: PlayedCard[]; leadSuit: Suit | null };
    tricksThisRound: number;
    roundResults: any[];
    players: PlayerState[];
    localHand: Card[];
    localPlayerId: string;
}

// ─── Seat positions around oval table (tighter so avatars stay inside) ──────
function getSeatPosition(index: number, total: number): React.CSSProperties {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const rx = 38; // horizontal radius %
    const ry = 28; // vertical radius %
    return {
        position: "absolute",
        left: `${50 + rx * Math.cos(angle)}%`,
        top:  `${50 + ry * Math.sin(angle)}%`,
        transform: "translate(-50%, -50%)",
    };
}

// ─── Bid Modal ────────────────────────────────────────────────
function BidModal({ round, onSubmit, submitted }: { round: number; onSubmit: (n: number) => void; submitted: boolean }) {
    const [bid, setBid] = useState(0);
    return (
        <motion.div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Darker overlay only around the modal center, not whole screen */}
            <div className="absolute inset-x-0 top-0 bottom-[160px] bg-black/40 backdrop-blur-sm pointer-events-auto" />
            
            <motion.div className="bg-[#0d111a] border border-amber-500/30 rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-[0_30px_80px_rgba(0,0,0,0.9)] relative overflow-hidden pointer-events-auto"
                initial={{ scale: 0.7, rotateX: -20, y: 60 }} animate={{ scale: 1, rotateX: 0, y: 0 }}
                exit={{ scale: 0.7, rotateX: 20, y: 60 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                style={{ perspective: "600px" }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg mx-auto mb-5 rotate-3 border-2 border-amber-500/30">
                    <img src="/images/sigil-king/assets-table/kamas.png" className="w-full h-full object-cover" alt="Kamas" />
                </div>
                <h2 className="text-white font-black text-3xl md:text-4xl uppercase italic tracking-tighter mb-1" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Votre Mise</h2>
                <p className="text-amber-500 text-xs font-black uppercase tracking-[0.2em] mb-8">Manche {round} — Combien de plis ?</p>
                {!submitted ? (
                    <>
                        <div className="flex items-center justify-center gap-6 mb-8">
                            <button onClick={() => setBid(b => Math.max(0, b - 1))} className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white text-3xl font-black hover:bg-white/20 transition-all active:scale-95 shadow-lg shadow-white/5">−</button>
                            <motion.div key={bid} initial={{ scale: 1.5, rotate: 10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                className="relative flex items-center justify-center">
                                <img src="/images/sigil-king/assets-table/kamas.png" className="absolute w-24 h-24 opacity-20 blur-xl animate-pulse" alt="" />
                                <span className="text-7xl font-black italic text-white min-w-[70px] text-center relative z-10 drop-shadow-2xl">
                                    {bid}
                                </span>
                            </motion.div>
                            <button onClick={() => setBid(b => Math.min(round, b + 1))} className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white text-3xl font-black hover:bg-white/20 transition-all active:scale-95 shadow-lg shadow-white/5">+</button>
                        </div>
                        <button onClick={() => onSubmit(bid)} className="w-full py-4 rounded-xl bg-amber-500 text-black font-black uppercase text-sm italic shadow-lg shadow-amber-500/30 hover:bg-amber-400 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2">
                            <img src="/images/sigil-king/assets-table/kamas.png" className="w-5 h-5 object-contain" alt="" />
                            Miser {bid} pli{bid !== 1 ? "s" : ""}
                        </button>
                        {bid === 0 && <p className="text-amber-500/80 text-[10px] font-black uppercase mt-4 italic">⚠️ Mise 0 = Gain de points bonus si réussi !</p>}
                    </>
                ) : (
                    <div className="py-4">
                        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/60 font-black uppercase text-xs tracking-widest">En attente des autres joueurs…</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// ─── Sram Choice ──────────────────────────────────────────────
function SramModal({ onChoice }: { onChoice: (c: "incarnation" | "pandawa") => void }) {
    return (
        <motion.div className="fixed inset-0 z-[3500] bg-black/70 backdrop-blur-lg flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="bg-[#0d111a] border border-purple-500/30 rounded-[2rem] p-8 max-w-xs w-full text-center"
                initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="text-4xl mb-4">🗡️</div>
                <h3 className="text-white font-black text-xl uppercase italic mb-2">Le Sram choisit</h3>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-6">Quelle identité jouer ce tour ?</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onChoice("incarnation")} className="py-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-black uppercase text-xs hover:bg-red-500/30 transition-all active:scale-95">⚔️ Incarnation</button>
                    <button onClick={() => onChoice("pandawa")} className="py-4 rounded-xl bg-slate-500/20 border border-slate-500/40 text-slate-400 font-black uppercase text-xs hover:bg-slate-500/30 transition-all active:scale-95">🍶 Pandawa</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Rules Panel ─────────────────────────────────────────────
const RULES_SECTIONS = [
    {
        title: "🎯 Le But",
        content: "Devinez combien de \"plis\" vous allez remporter chaque manche. Si vous trouvez juste, vous gagnez des points. Trop ou pas assez = pénalité."
    },
    {
        title: "🃏 Hiérarchie des cartes",
        items: [
            { icon: "💫", label: "Éniripsa", desc: "Bat TOUT. La plus forte." },
            { icon: "👑", label: "Ogrest", desc: "Bat toutes les Incarnations." },
            { icon: "⚔️", label: "Incarnations (Iop, Sacri…)", desc: "Battent toutes les cartes normales." },
            { icon: "✨", label: "Stasis", desc: "Atout universel — bat la couleur demandée." },
            { icon: "🎨", label: "Couleur demandée", desc: "La première couleur jouée dans le pli." },
            { icon: "🍶", label: "Pandawa", desc: "Perd toujours. Sauf si tout le monde joue Pandawa." },
        ]
    },
    {
        title: "📏 Règle de couleur",
        content: "Tu DOIS jouer la couleur demandée si tu en as. Si tu n'en as pas, tu joues ce que tu veux (Stasis, spéciale, autre couleur)."
    },
    {
        title: "🗡️ Le Sram",
        content: "Quand tu joues le Sram, tu choisis : jouer comme une Incarnation (fort) ou comme un Pandawa (perdant volontaire)."
    },
    {
        title: "💰 Les Points",
        items: [
            { icon: "✅", label: "Bonne mise", desc: "+20 pts × manche, +10 pts par pli remporté." },
            { icon: "❌", label: "Mauvaise mise", desc: "-10 pts pour chaque pli d'écart." },
            { icon: "🎲", label: "Mise 0 réussie", desc: "+30 pts × manche. Très risqué !" },
            { icon: "💀", label: "Dévastateur", desc: "Annule le pli (personne ne gagne)." },
        ]
    },
];

function RulesPanel({ onClose }: { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4500] bg-black/70 backdrop-blur-md flex items-center justify-end p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="bg-[#0d111a] border border-amber-500/20 rounded-[2rem] w-full max-w-sm h-full max-h-[90vh] overflow-y-auto flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.8)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#0d111a]/95 backdrop-blur-sm flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-white font-black text-xl uppercase italic" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>📖 Règles du Jeu</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                        <X size={14} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-6">
                    {RULES_SECTIONS.map((section, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <h3 className="text-amber-400 font-black text-sm uppercase tracking-wider mb-2">{section.title}</h3>
                            {section.content && (
                                <p className="text-white/70 text-xs font-medium leading-relaxed bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                    {section.content}
                                </p>
                            )}
                            {section.items && (
                                <div className="space-y-1.5">
                                    {section.items.map((item, j) => (
                                        <div key={j} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                            <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                                            <div>
                                                <span className="text-white font-black text-xs">{item.label}</span>
                                                <span className="text-white/50 text-xs"> — {item.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {/* Footer tip */}
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <p className="text-amber-400/80 text-[10px] font-black uppercase tracking-widest text-center">
                            💡 Faites défiler pour voir toutes les règles
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Round Scoreboard ─────────────────────────────────────────
function RoundScoreBoard({ results, round, players, onNext }: { results: any[]; round: number; players: PlayerState[]; onNext: () => void }) {
    return (
        <motion.div className="fixed inset-0 z-[2500] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-[#0d111a] border border-amber-500/20 rounded-[2.5rem] p-8 max-w-lg w-full"
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-white font-black text-2xl uppercase italic" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Manche {round} terminée</h2>
                    <Trophy className="text-amber-400 w-6 h-6" />
                </div>
                <div className="space-y-3 mb-6">
                    {[...results].sort((a, b) => b.roundScore - a.roundScore).map((r: any) => {
                        const p = players.find(pl => pl.odKey === r.playerId);
                        const isPos = r.roundScore >= 0;
                        const exact = r.bid === r.tricksWon;
                        return (
                            <motion.div key={r.playerId}
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                className={`flex items-center justify-between p-4 rounded-2xl border ${exact ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.03] border-white/5"}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden border border-white/10 flex-shrink-0">
                                        {p?.userAvatar ? <img src={p.userAvatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white/30 font-black">{p?.userName?.[0]}</div>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-black text-base italic">{p?.userName || r.playerId}</div>
                                        <div className="flex items-center gap-2 text-white/60 text-[10px] font-black uppercase">
                                            <div className="flex items-center gap-0.5">
                                                <img src="/images/sigil-king/assets-table/kamas.png" className="w-3 h-3 object-contain" alt="" />
                                                <span>Misé {r.bid}</span>
                                            </div>
                                            <span>• {r.tricksWon} pli{r.tricksWon !== 1 ? "s" : ""}</span>
                                            {r.bonusPoints > 0 && <span className="text-amber-400"> • +{r.bonusPoints} bonus</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-black text-xl italic ${isPos ? "text-emerald-400" : "text-red-400"}`}>{isPos ? "+" : ""}{r.roundScore}</div>
                                    <div className="text-white/50 text-xs font-black">{r.totalScore} pts</div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
                <p className="text-white/40 text-[10px] font-black uppercase text-center animate-pulse">Prochaine manche dans quelques secondes…</p>
            </motion.div>
        </motion.div>
    );
}

// ─── Game Over ────────────────────────────────────────────────
function GameOverScreen({ data, onLeave }: { data: any; onLeave: () => void }) {
    return (
        <motion.div className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="bg-[#0d111a] border border-amber-500/30 rounded-[3rem] p-12 max-w-lg w-full text-center"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                <motion.div className="text-6xl mb-6" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }}>👑</motion.div>
                <h2 className="text-amber-400 font-black text-4xl uppercase italic tracking-tighter mb-2" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Victoire !</h2>
                <p className="text-white font-black text-xl mb-8">{data?.players?.[0]?.userName} remporte la couronne !</p>
                <div className="space-y-3 mb-8">
                    {data?.players?.map((p: any, i: number) => (
                        <motion.div key={p.playerId} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                            className={`flex items-center justify-between p-4 rounded-2xl border ${i === 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.03] border-white/5"}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-slate-300 text-slate-900" : i === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-white/40"}`}>{i + 1}</div>
                                {p.userAvatar && <img src={p.userAvatar} className="w-10 h-10 rounded-xl object-cover" alt="" />}
                                <span className={`font-black uppercase italic text-sm ${i === 0 ? "text-amber-400" : "text-white"}`}>{p.userName}</span>
                            </div>
                            <span className={`font-black text-lg italic ${i === 0 ? "text-amber-400" : "text-white"}`}>{p.score} pts</span>
                        </motion.div>
                    ))}
                </div>
                <button onClick={onLeave} className="px-10 py-4 rounded-2xl bg-amber-500 text-black font-black uppercase text-sm italic hover:bg-amber-400 transition-all">Retour au Menu</button>
            </motion.div>
        </motion.div>
    );
}

// ─── Lobby Screen ─────────────────────────────────────────────
function LobbyScreen({ gameState, localPlayerId, socket, onStart, onLeave }: {
    gameState: GameState; localPlayerId: string; socket: Socket | null; onStart: () => void; onLeave: () => void;
}) {
    const isHost = gameState.hostId === localPlayerId;
    const activePlayers = gameState.players.filter(p => !p.isSpectator);
    const spectators = gameState.players.filter(p => p.isSpectator);
    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/5 p-6 bg-black/30 flex flex-col justify-between relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex-1">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_#f59e0b]" />
                        <h2 className="text-white font-black text-2xl uppercase italic" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Salon</h2>
                    </div>
                    <div className="space-y-5">
                        <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] font-black uppercase italic w-fit">
                            {activePlayers.length} / 6 Joueurs
                        </div>
                        {spectators.length > 0 && (
                            <div className="pt-2">
                                <span className="text-white/20 text-[8px] font-black uppercase tracking-widest block mb-2 px-1">Spectateurs ({spectators.length})</span>
                                <div className="flex flex-wrap gap-1.5 px-1">
                                    {spectators.map(s => (
                                        <div key={s.odKey} className="w-6 h-6 rounded-lg overflow-hidden border border-white/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title={s.userName}>
                                            <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.userName}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isHost && (
                            <>
                        <div className="pt-4 border-t border-white/10">
                                    <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] block mb-3">Nombre de Manches</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[5, 8, 10].map(r => (
                                            <button key={r} onClick={() => socket?.emit("sk:room:settings", { maxRounds: r })}
                                                className={`py-2 rounded-xl text-xs font-black transition-all ${gameState.settings.maxRounds === r ? "bg-amber-500 text-black" : "bg-white/10 text-white/50 hover:bg-white/20"}`}>{r}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/10">
                                    <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] block mb-3">Options</span>
                                    {[
                                        { key: "stormMode", label: "Mode Storm (×2 si all-in réussi)" },
                                        { key: "advancedCards", label: "Cartes avancées (Dévastateur + Alma Mater)" },
                                    ].map(({ key, label }) => (
                                        <button key={key} onClick={() => socket?.emit("sk:room:settings", { [key]: !(gameState.settings as any)[key] })}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black border transition-all mb-2 ${(gameState.settings as any)[key] ? "bg-amber-500/15 border-amber-500/40 text-amber-200" : "bg-white/[0.05] border-white/10 text-white/40 hover:bg-white/[0.1]"}`}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${(gameState.settings as any)[key] ? "bg-amber-500 border-amber-500" : "border-white/30"}`}>
                                                {(gameState.settings as any)[key] && <div className="w-2 h-2 bg-black rounded-sm" />}
                                            </div>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="relative z-10 pt-4 space-y-2">
                    {isHost && (
                        <button onClick={onStart} disabled={activePlayers.length < 2}
                            className={`w-full py-4 rounded-xl font-black uppercase text-sm italic flex items-center justify-center gap-2 transition-all ${activePlayers.length >= 2 ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/30" : "bg-white/5 text-white/20 cursor-not-allowed"}`}>
                            <Play size={16} fill="currentColor" /> Lancer la Partie
                        </button>
                    )}
                    <button onClick={onLeave} className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-black uppercase text-[10px] italic border border-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                        <LogOut size={12} /> Quitter
                    </button>
                </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="text-white/40 font-black uppercase text-xs tracking-[0.3em] mb-4">Autour de la table</div>
                <div className="grid grid-cols-2 gap-3">
                    {activePlayers.map(p => (
                        <div key={p.odKey} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3 hover:bg-amber-500/5 hover:border-amber-500/20 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 overflow-hidden flex-shrink-0">
                                {p.userAvatar ? <img src={p.userAvatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-amber-400 font-black text-lg">{p.userName[0]}</div>}
                            </div>
                            <div>
                                <div className="text-white font-black text-base italic">{p.userName}</div>
                                {p.odKey === gameState.hostId && <div className="text-amber-400 text-xs font-black uppercase flex items-center gap-1"><Crown size={10} /> Hôte</div>}
                                {!p.isConnected && <div className="text-red-400 text-xs font-black uppercase">Déconnecté</div>}
                            </div>
                        </div>
                    ))}
                    {Array.from({ length: Math.max(0, 6 - activePlayers.length) }).map((_, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-white/[0.01] border border-dashed border-white/10 flex items-center gap-3 opacity-30">
                            <div className="w-12 h-12 rounded-xl border border-dashed border-white/20" />
                            <span className="text-white/40 font-black uppercase text-xs">Libre</span>
                        </div>
                    ))}
                </div>
                <div className="mt-8 p-6 rounded-3xl bg-white/[0.04] border border-white/10 shadow-inner">
                    <div className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="text-lg">📖</span> Hiérarchie des cartes
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {[
                            { label: "💫 Éniripsa (bat tout)", color: "text-cyan-400" },
                            { label: "👑 Ogrest (bat Incarnations)", color: "text-amber-400" },
                            { label: "⚔️ Incarnations", color: "text-red-400" },
                            { label: "✨ Stasis (atout)", color: "text-purple-400" },
                            { label: "🎨 Couleur demandée", color: "text-white/60" },
                            { label: "🍶 Pandawa (perd toujours)", color: "text-slate-400" }
                        ].map((item, i) => (
                            <div key={i} className={`px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 ${item.color} text-[11px] font-black shadow-sm`}>
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Dealing Animation (Croupier style) ─────────────────────
function DealingAnimation({ cardCount, round, previewDuration, onDone }: {
    cardCount: number; round: number; previewDuration: number; onDone: () => void;
}) {
    const [phase, setPhase] = useState<"announce" | "dealing" | "preview">("announce");
    const [dealtCount, setDealtCount] = useState(0);
    const [countdown, setCountdown] = useState(Math.ceil(previewDuration / 1000));

    useEffect(() => {
        // 1) Announce for 1.5s
        const t1 = setTimeout(() => setPhase("dealing"), 1500);
        return () => clearTimeout(t1);
    }, []);

    useEffect(() => {
        if (phase !== "dealing") return;
        // 2) Deal cards one by one
        let i = 0;
        const deal = () => {
            if (i >= cardCount) {
                setPhase("preview");
                return;
            }
            setDealtCount(c => c + 1);
            i++;
            setTimeout(deal, 180);
        };
        const t = setTimeout(deal, 100);
        return () => clearTimeout(t);
    }, [phase, cardCount]);

    useEffect(() => {
        if (phase !== "preview") return;
        // 3) Countdown until bid modal
        const remaining = Math.ceil(previewDuration / 1000) - Math.ceil((previewDuration - 1500 - cardCount * 180) / 1000);
        let secs = Math.max(3, Math.ceil((previewDuration - 1500 - cardCount * 200) / 1000));
        setCountdown(secs);
        const interval = setInterval(() => {
            secs--;
            setCountdown(secs);
            if (secs <= 0) {
                clearInterval(interval);
                onDone();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, previewDuration, cardCount, onDone]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-[3800] flex flex-col items-center justify-center pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)" }}
        >
            {/* Round Banner */}
            <AnimatePresence>
                {phase === "announce" && (
                    <motion.div
                        key="announce"
                        initial={{ scale: 0.4, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.3, opacity: 0, y: -20 }}
                        transition={{ type: "spring", stiffness: 180, damping: 16 }}
                        className="text-center"
                    >
                        <div className="text-amber-400/50 text-xs font-black uppercase tracking-[0.5em] mb-3">⚔️ Début de la</div>
                        <div className="text-white font-black uppercase italic drop-shadow-[0_0_30px_rgba(255,200,0,0.5)]"
                            style={{ fontSize: "clamp(3rem, 10vw, 7rem)", fontFamily: "'Cinzel', Georgia, serif" }}>
                            Manche {round}
                        </div>
                        <div className="text-amber-400/40 text-[11px] font-black uppercase tracking-[0.3em] mt-3">
                            {cardCount} carte{cardCount > 1 ? "s" : ""} à distribuer
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dealing phase — deck + flying cards */}
            {phase === "dealing" && (
                <div className="relative flex flex-col items-center">
                    {/* Announce text */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-10">
                        <div className="text-white/60 text-xs font-black uppercase tracking-[0.3em]">Distribution en cours…</div>
                        <div className="text-amber-400 font-black text-lg mt-1">{dealtCount}/{cardCount}</div>
                    </motion.div>

                    {/* Central deck */}
                    <div className="relative w-20 h-28">
                        {Array.from({ length: Math.min(5, cardCount - dealtCount + 1) }).map((_, i) => (
                            <div key={i} className="absolute inset-0 rounded-xl overflow-hidden border-2 border-amber-900/60 shadow-2xl"
                                style={{ transform: `rotate(${(i - 2) * 2}deg) translateY(${-i * 1.5}px)`, zIndex: i }}>
                                <img src="/images/sigil-king/assets-table/card-back.png" className="w-full h-full object-cover" alt="" />
                            </div>
                        ))}
                    </div>

                    {/* Cards flying to bottom */}
                    <div className="absolute" style={{ top: 0, left: -30 }}>
                        {Array.from({ length: dealtCount }).map((_, i) => (
                            <motion.div key={i}
                                initial={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
                                animate={{
                                    x: (i - dealtCount / 2) * 18,
                                    y: 280,
                                    rotate: (i - dealtCount / 2) * 5,
                                    scale: 0.9,
                                    opacity: 1,
                                }}
                                transition={{ duration: 0.3, type: "spring", stiffness: 240, damping: 24 }}
                                className="absolute w-14 h-20 rounded-lg overflow-hidden border border-amber-900/40 shadow-xl"
                            >
                                <img src="/images/sigil-king/assets-table/card-back.png" className="w-full h-full object-cover" alt="" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview phase — "Analysez votre jeu" + countdown */}
            {phase === "preview" && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="text-center"
                >
                    <div className="text-2xl mb-3">👀</div>
                    <div className="text-white font-black text-lg uppercase italic mb-1" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>
                        Analysez votre jeu !
                    </div>
                    <div className="text-white/50 text-xs font-black uppercase tracking-wider mb-5">
                        La mise s'ouvre dans…
                    </div>
                    {/* Circular countdown */}
                    <div className="relative w-16 h-16 mx-auto">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                            <motion.circle cx="32" cy="32" r="28" fill="none" stroke="#f59e0b" strokeWidth="4"
                                strokeLinecap="round" strokeDasharray={175.9}
                                initial={{ strokeDashoffset: 0 }}
                                animate={{ strokeDashoffset: 175.9 }}
                                transition={{ duration: Math.max(3, countdown), ease: "linear" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-amber-400 font-black text-xl">
                            {countdown}
                        </div>
                    </div>
                    <div className="text-amber-400/50 text-[10px] font-black uppercase tracking-widest mt-4">
                        Regardez vos cartes en bas ↓
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

// ─── Game Board (2.5D) ───────────────────────────────────────
function GameBoardView({ gameState, localPlayerId, socket, onPlayCard, onBid, onSramChoice, bidSubmitted, sramPendingCardId, bonus, onBonusDone }: {
    gameState: GameState; localPlayerId: string; socket: Socket | null;
    onPlayCard: (cardId: string, sramChoice?: "incarnation" | "pandawa") => void;
    onBid: (n: number) => void;
    onSramChoice: (cardId: string, choice: "incarnation" | "pandawa") => void;
    bidSubmitted: boolean;
    sramPendingCardId: string | null;
    bonus: BonusType;
    onBonusDone: () => void;
}) {
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [showRules, setShowRules] = useState(false);
    const [showHand, setShowHand] = useState(false);
    const [dealingData, setDealingData] = useState<{ cardCount: number; round: number; previewDuration: number } | null>(null);
    const activePlayers = gameState.players.filter(p => !p.isSpectator);
    const localPlayer = gameState.players.find(p => p.odKey === localPlayerId);
    const isMyTurn = localPlayer?.isCurrentTurn && gameState.phase === "PLAYING";
    const leadSuit = gameState.currentTrick.leadSuit;

    // Listen for dealing event from server
    useEffect(() => {
        if (!socket) return;
        const handler = (data: { round: number; cardCount: number; previewDuration: number }) => {
            setDealingData(data);
        };
        socket.on("sk:dealing:start", handler);
        return () => { socket.off("sk:dealing:start", handler); };
    }, [socket]);

    const canPlay = useCallback((card: Card) => {
        if (!isMyTurn) return false;
        if (card.type !== "elemental" || !leadSuit) return true;
        if ((card as any).suit === leadSuit) return true;
        const hasLead = gameState.localHand.some(c => c.type === "elemental" && (c as any).suit === leadSuit);
        return !hasLead;
    }, [isMyTurn, leadSuit, gameState.localHand]);

    const handleCardClick = useCallback((card: Card) => {
        if (!isMyTurn) return;
        if (!canPlay(card)) { toast.error("Vous devez jouer la couleur demandée !"); return; }
        
        if (card.type === "sram") {
            // Sram play is handled through the onSramChoice modal/buttons
            setSelectedCard(card.id);
            return;
        }

        // Simplifié : Un seul clic pour jouer (plus fluide pour un jeu web)
        onPlayCard(card.id);
        setSelectedCard(null);
    }, [isMyTurn, canPlay, onPlayCard]);

    const SUIT_LABELS: Record<string, string> = { fire: "🔥 Feu", water: "💧 Eau", air: "🌪️ Air", earth: "🌿 Terre", stasis: "✨ Stasis" };

    return (
        <div className="relative w-full h-full overflow-hidden">
            {/* ── Layer 1: Background taverne 2.5D ── */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: "url('/images/table-sigil-king.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
                }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

            {/* ── Layer 2: Invisible Table Logic Area ── */}
            <div className="absolute inset-0 z-[10] flex items-center justify-center">
                <div
                    className="relative"
                    style={{
                        width: "clamp(300px, 85vw, 1100px)",
                        aspectRatio: "14/9",
                    }}
                >
                    {/* Lobby Overlay on the table */}
                    {gameState.phase === "LOBBY" && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center p-6 z-[100]"
                        >
                            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 text-center max-w-sm shadow-2xl">
                                <h3 className="text-white font-black text-xl uppercase italic mb-2">En attente des Titans</h3>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-6">{activePlayers.length} / 6 joueurs</p>
                                
                                {gameState.hostId === localPlayerId ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-center gap-2 mb-4">
                                            {[5, 8, 10].map(r => (
                                                <button key={r} onClick={() => socket?.emit("sk:room:settings", { maxRounds: r })}
                                                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${gameState.settings.maxRounds === r ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30" : "bg-white/5 text-white/40"}`}>{r}</button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => socket?.emit("sk:game:start")}
                                            disabled={activePlayers.length < 2}
                                            className={`w-full py-4 rounded-xl font-black uppercase text-sm italic flex items-center justify-center gap-2 transition-all ${activePlayers.length >= 2 ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/30" : "bg-white/5 text-white/20 cursor-not-allowed"}`}
                                        >
                                            <Play size={16} fill="currentColor" /> Lancer la Partie
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                        <p className="text-amber-400/60 text-[10px] font-black uppercase italic tracking-widest">L'hôte prépare les cartes...</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Layer 3: Player Seats ── */}
                    {activePlayers.map((p, i) => {
                        const style = getSeatPosition(i, activePlayers.length);
                        const isLocal = p.odKey === localPlayerId;
                        const trickCard = gameState.currentTrick.cards.find(c => c.playerId === p.odKey);
                        return (
                            <div key={p.odKey} style={style} className="flex flex-col items-center gap-1">
                                {/* Avatar */}
                                <motion.div
                                    animate={p.isCurrentTurn ? { filter: "drop-shadow(0 0 12px rgba(255,215,0,0.9))" } : { filter: "none" }}
                                    transition={{ duration: 0.4 }}
                                    className={`relative w-12 h-12 rounded-2xl border-2 overflow-hidden flex-shrink-0 ${p.isCurrentTurn ? "border-amber-400" : isLocal ? "border-emerald-400/60" : "border-white/20"} ${!p.isConnected ? "opacity-40 grayscale" : ""}`}
                                    style={{
                                        animation: p.isCurrentTurn
                                            ? "avatar-pulse 0.8s ease-in-out infinite alternate"
                                            : "avatar-idle 3s ease-in-out infinite alternate",
                                    }}
                                >
                                    {p.userAvatar ? <img src={p.userAvatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white/40 font-black text-lg">{p.userName[0]}</div>}
                                    <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[7px] font-black px-1 rounded-tl">{p.handCount}</div>
                                </motion.div>

                                {/* Nameplate */}
                                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight max-w-[90px] truncate text-center shadow-lg
                                    ${isLocal ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/50" : "bg-black/70 text-white/70 border border-white/10"}`}>
                                    {p.userName}
                                </div>

                                {/* Bid chip */}
                                <AnimatePresence>
                                    {p.bid !== null && p.bid !== "hidden" && (
                                        <motion.div initial={{ scale: 0, y: -8, rotate: -15 }} animate={{ scale: 1, y: 0, rotate: 0 }} exit={{ scale: 0 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                            className="group relative flex items-center justify-center">
                                            <img src="/images/sigil-king/assets-table/kamas.png" className="w-10 h-10 object-contain drop-shadow-xl" alt="" />
                                            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-[12px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                                {p.bid}
                                            </span>
                                            {/* Glow for high bids */}
                                            {Number(p.bid) >= 5 && <div className="absolute inset-0 bg-amber-400/20 blur-md rounded-full animate-pulse px-4" />}
                                        </motion.div>
                                    )}
                                    {p.bid === "hidden" && p.hasBid && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-emerald-400 text-[8px] font-black uppercase italic">Misé</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Card played in trick */}
                                <AnimatePresence>
                                    {trickCard && (
                                        <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}>
                                            <CardComponent card={trickCard.card} size="sm" sramChoice={trickCard.sramChoice} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Tricks won stack */}
                                {p.tricksWon > 0 && (
                                    <div className="flex gap-[-4px]">
                                        {Array.from({ length: Math.min(p.tricksWon, 5) }).map((_, j) => (
                                            <div key={j} className="w-4 h-6 bg-[#1B4D1B] border border-[#8B6914] rounded-sm -ml-1"
                                                style={{ transform: `rotate(${(j - 2) * 6}deg) translateY(${-j * 1}px)` }} />
                                        ))}
                                        <span className="text-[10px] text-amber-400 font-bold ml-1 drop-shadow-md">{p.tricksWon}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ── Layer 4: Center HUD ── */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1.5">
                        <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Manche {gameState.round}/{gameState.maxRounds}</div>
                        {leadSuit && <div className="text-[11px] text-white/70 font-black bg-black/40 px-3 py-0.5 rounded-full border border-white/5 backdrop-blur-sm">{SUIT_LABELS[leadSuit]}</div>}
                        {gameState.timeLeft > 0 && (
                            <div className={`flex items-center gap-1.5 text-[11px] font-black px-2 py-0.5 rounded-md bg-black/30 ${gameState.timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-white/60"}`}>
                                <Clock size={12} /> {gameState.timeLeft}s
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Layer 5: Particles ── */}
            <ParticleCanvas bonus={bonus} onDone={onBonusDone} />

            {/* ── HUD Top bar ── */}
            <div className="absolute top-0 inset-x-0 z-[20] flex items-center justify-between px-4 py-2 bg-black/50 backdrop-blur-sm border-b border-white/5">
                <div className="flex items-center gap-2">
                    {gameState.phase === "PLAYING" && isMyTurn && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            <span className="text-amber-400 text-[10px] font-black uppercase">Votre tour !</span>
                        </motion.div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {/* Scoreboard mini */}
                    {[...gameState.players].filter(p => !p.isSpectator).sort((a, b) => b.score - a.score).slice(0, 3).map((p, i) => (
                        <div key={p.odKey} className={`text-xs font-black flex items-center gap-1.5 ${p.odKey === localPlayerId ? "text-amber-400" : "text-white/50"}`}>
                            <span className="opacity-50">{i + 1}.</span>
                            <span>{p.userName.slice(0, 8)}</span>
                            <span className={p.odKey === localPlayerId ? "text-amber-200" : "text-white/80"}>{p.score}</span>
                        </div>
                    ))}
                    {/* Rules toggle + Hand viewer buttons */}
                    <button
                        onClick={() => setShowRules(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                            showRules
                                ? "bg-amber-500 text-black border-amber-400"
                                : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <HelpCircle size={12} /> Règles
                    </button>
                    {(gameState.phase === "PLAYING" || gameState.phase === "BIDDING") && (
                        <button
                            onClick={() => setShowHand(v => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                                showHand
                                    ? "bg-emerald-500 text-black border-emerald-400"
                                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            🃏 Mon Jeu
                        </button>
                    )}
                </div>
            </div>

            {/* ── Rules Panel ── */}
            <AnimatePresence>
                {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
            </AnimatePresence>

            {/* ── Dealing Animation Overlay ── */}
            <AnimatePresence>
                {dealingData && (
                    <DealingAnimation
                        cardCount={dealingData.cardCount}
                        round={dealingData.round}
                        previewDuration={dealingData.previewDuration}
                        onDone={() => setDealingData(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── Layer 6: Player hand ── */}
            <div
                className="absolute bottom-0 inset-x-0 z-[30] flex flex-col items-center pb-2 cursor-pointer"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)", minHeight: "160px", justifyContent: "flex-end", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
                {gameState.phase === "BIDDING" && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 animate-pulse bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                        Analysez vos cartes avant de miser...
                    </motion.p>
                )}
                {isMyTurn && gameState.phase === "PLAYING" && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 animate-pulse bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-emerald-500/20">
                        C'est à vous de jouer !
                    </motion.p>
                )}
                <LayoutGroup>
                    <div className="flex items-end justify-center gap-1 overflow-x-auto px-4 py-2">
                        {gameState.localHand.map((card, i) => {
                            const playable = canPlay(card);
                            const isSelected = selectedCard === card.id;
                            const isSramSelected = card.type === "sram" && isSelected;
                            return (
                                <div
                                    key={card.id}
                                    className="relative flex-shrink-0"
                                    style={{ zIndex: isSelected ? 10 : i, marginTop: isSelected ? -20 : 0, transition: "margin-top 0.15s" }}
                                    onClick={() => handleCardClick(card)}
                                >
                                    <CardComponent
                                        card={card}
                                        size="md"
                                        playable={gameState.phase === "BIDDING" || playable || !isMyTurn}
                                        selected={isSelected}
                                    />
                                    {/* Sram inline choice */}
                                    {isSramSelected && (
                                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                            className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 whitespace-nowrap z-20">
                                            <button onClick={(e) => { e.stopPropagation(); onSramChoice(card.id, "incarnation"); setSelectedCard(null); }}
                                                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[8px] font-black uppercase shadow-lg">⚔️</button>
                                            <button onClick={(e) => { e.stopPropagation(); onSramChoice(card.id, "pandawa"); setSelectedCard(null); }}
                                                className="px-2 py-1 rounded-lg bg-slate-600 text-white text-[8px] font-black uppercase shadow-lg">🍶</button>
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })}
                        {gameState.localHand.length === 0 && gameState.phase === "PLAYING" && (
                            <p className="text-white/10 font-black uppercase text-[10px] italic py-6">Main vide</p>
                        )}
                    </div>
                </LayoutGroup>
            </div>

            {/* Bid Modal — only show once dealing animation is done */}
            <AnimatePresence>
                {gameState.phase === "BIDDING" && !dealingData && (
                    <BidModal round={gameState.round} onSubmit={onBid} submitted={bidSubmitted} />
                )}
            </AnimatePresence>

            {/* Sram choice from server */}
            <AnimatePresence>
                {sramPendingCardId && (
                    <SramModal onChoice={(c) => onSramChoice(sramPendingCardId, c)} />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Genre CSS animations (idle avatar) ──────────────────────
const IDLE_STYLE = `
@keyframes avatar-idle {
    0%   { transform: translateY(0px) scale(1); }
    100% { transform: translateY(-4px) scale(1.01); }
}
@keyframes avatar-pulse {
    0%   { transform: translateY(-2px) scale(1.02); filter: brightness(1.1); }
    100% { transform: translateY(-6px) scale(1.05); filter: brightness(1.25); }
}
`;

// ─── Main Component ───────────────────────────────────────────
interface Props {
    guildId: string; userId: string; userName: string;
    userAvatar?: string; initialRoomId?: string; isSpectator?: boolean;
}

export function SigilKingGame({ guildId, userId, userName, userAvatar, initialRoomId, isSpectator }: Props) {
    const router = useRouter();
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [inRoom, setInRoom] = useState(!!initialRoomId);
    const [rooms, setRooms] = useState<any[]>([]);
    const [bidSubmitted, setBidSubmitted] = useState(false);
    const [sramPendingCardId, setSramPendingCardId] = useState<string | null>(null);
    const [gameOverData, setGameOverData] = useState<any>(null);
    const [lastRoundResult, setLastRoundResult] = useState<{ results: any[]; round: number } | null>(null);
    const [bonus, setBonus] = useState<BonusType>(null);

    useEffect(() => {
        const wsUrl = buildWsUrl();
        const s = io(wsUrl, { query: { guildId }, transports: ["websocket"], path: "/socket.io/" });
        socketRef.current = s;
        setSocket(s);

        s.on("sk:state", (state: GameState) => {
            setGameState(state);
            if (state.phase === "BIDDING") setBidSubmitted(false);
        });
        s.on("sk:room:list", (list: any[]) => setRooms(list));
        s.on("sk:round:end", (data: any) => {
            setLastRoundResult(data);
            setTimeout(() => setLastRoundResult(null), 8000);
        });
        s.on("sk:game:over", (data: any) => setGameOverData(data));
        s.on("sk:sram:choose", ({ cardId }: { cardId: string }) => setSramPendingCardId(cardId));
        s.on("sk:trick:resolved", ({ bonusTriggered }: { bonusTriggered: BonusType }) => {
            if (bonusTriggered) setBonus(bonusTriggered);
        });
        s.on("sk:error", (err: any) => toast.error(err.message));
        s.on("sk:chat", (msg: any) => {
            if (msg.type === "bonus") toast.success(msg.text);
        });
        s.on("sk:room:created", ({ roomId }: { roomId: string }) => {
            s.emit("sk:room:join", { roomId, playerObj: { userName, userId, userAvatar } });
            setInRoom(true);
        });
        s.on("connect", () => {
            s.emit("sk:room:list");
            if (initialRoomId) {
                s.emit("sk:room:join", { roomId: initialRoomId, playerObj: { userName, userId, userAvatar, isSpectator } });
            }
        });

        return () => { s.disconnect(); };
    }, [guildId]);

    const handleCreate = useCallback(() => {
        socketRef.current?.emit("sk:room:create", { userName, userId, userAvatar });
    }, [userName, userId, userAvatar]);

    const handleJoin = useCallback((roomId: string, spectate = false) => {
        socketRef.current?.emit("sk:room:join", { roomId, playerObj: { userName, userId, userAvatar, isSpectator: spectate } });
        setInRoom(true);
    }, [userName, userId, userAvatar]);

    const handleLeave = useCallback(() => {
        socketRef.current?.emit("sk:room:leave");
        setInRoom(false);
        setGameState(null);
        setGameOverData(null);
        setLastRoundResult(null);
        socketRef.current?.emit("sk:room:list");
    }, []);

    const handleBid = useCallback((amount: number) => {
        socketRef.current?.emit("sk:bid:submit", { amount });
        setBidSubmitted(true);
    }, []);

    const handlePlayCard = useCallback((cardId: string, sramChoice?: "incarnation" | "pandawa") => {
        socketRef.current?.emit("sk:card:play", { cardId, sramChoice });
    }, []);

    const handleSramChoice = useCallback((cardId: string, choice: "incarnation" | "pandawa") => {
        socketRef.current?.emit("sk:card:play", { cardId, sramChoice: choice });
        setSramPendingCardId(null);
    }, []);

    // ──────────────────── LOBBY SELECTION ──────────────────────
    if (!inRoom || !gameState) {
        return (
            <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#080b12] flex flex-col overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#92400e15_0%,transparent_60%)] pointer-events-none" />
                <style>{IDLE_STYLE}</style>
                <div className="p-4 md:p-8 flex-1 overflow-y-auto relative z-10">
                    <button onClick={() => router.push(`/dashboard/${guildId}/mini-jeux#mini-jeux`)}
                        className="flex items-center gap-2 text-white/30 hover:text-white text-[10px] font-black uppercase tracking-widest mb-8 transition-colors">
                        <ChevronLeft size={14} /> Retour
                    </button>
                    <div className="flex items-center gap-5 mb-10">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">👑</div>
                        <div>
                            <h1 className="text-white font-black text-3xl md:text-5xl uppercase italic tracking-tighter" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Sigil King</h1>
                            <p className="text-amber-500/80 text-xs font-black uppercase tracking-[0.3em]">"Le Roi des Titans attend son adversaire"</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                        {[{ emoji: "🎴", label: "2–6 joueurs" }, { emoji: "🔟", label: `${rooms[0]?.rounds || 10} manches` }, { emoji: "🃏", label: "66 cartes" }, { emoji: "🏆", label: "Skull King" }]
                            .map(({ emoji, label }) => (
                                <div key={label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                                    <div className="text-2xl mb-1">{emoji}</div>
                                    <div className="text-white font-black text-xs uppercase italic">{label}</div>
                                </div>
                            ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mb-8">
                        <button onClick={handleCreate} className="w-full py-5 rounded-2xl bg-amber-500 text-black font-black uppercase text-sm italic shadow-lg shadow-amber-500/30 hover:bg-amber-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                            <Plus size={18} /> Créer un Salon
                        </button>
                        {rooms.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-white/40 text-xs font-black uppercase tracking-widest mb-3">Salons disponibles</div>
                                {rooms.map(r => (
                                    <div key={r.roomId} className="p-4 rounded-xl bg-white/[0.04] border border-amber-500/10 flex items-center justify-between hover:bg-amber-500/5 transition-all">
                                        <div>
                                            <div className="text-white font-black text-sm italic">{r.hostName}</div>
                                            <div className="text-amber-500/40 text-[9px] font-black uppercase">{r.playerCount}/6 • {r.rounds} manches</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleJoin(r.roomId)} className="px-4 py-2 rounded-lg bg-amber-500 text-black font-black uppercase text-[10px] hover:bg-amber-400 transition-all">Rejoindre</button>
                                            <button onClick={() => handleJoin(r.roomId, true)} className="px-3 py-2 rounded-lg bg-white/5 text-white/30 hover:text-white font-black uppercase text-[10px] transition-all">Watch</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (gameOverData) {
        return <GameOverScreen data={gameOverData} onLeave={() => { handleLeave(); router.push(`/dashboard/${guildId}/mini-jeux#mini-jeux`); }} />;
    }

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] flex flex-col bg-[#080b12] overflow-hidden">
            <style>{IDLE_STYLE}</style>

            {/* Header */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-white/5 bg-black/30 backdrop-blur-md flex items-center justify-between z-[50]">
                <div className="flex items-center gap-3">
                    <span className="text-amber-400 text-lg">👑</span>
                    <div>
                        <h1 className="text-white font-black text-base uppercase italic" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Sigil King</h1>
                        <span className="text-amber-500/80 text-[10px] font-black uppercase tracking-wider">
                            {gameState.phase === "LOBBY" ? "Lobby" : gameState.phase === "BIDDING" ? "Mises en cours..." : gameState.phase === "PLAYING" ? `Manche ${gameState.round}/${gameState.maxRounds}` : gameState.phase === "ROUND_END" ? "Fin de manche" : "Fin de partie"}
                        </span>
                    </div>

                    {/* Spectators bubbles in header */}
                    {gameState.players.filter(p => p.isSpectator).length > 0 && (
                        <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-white/5">
                            <span className="text-white/20 text-[8px] font-black uppercase tracking-widest italic">Spectateurs</span>
                            <div className="flex -space-x-2">
                                {gameState.players.filter(p => p.isSpectator).slice(0, 5).map(s => (
                                    <div key={s.odKey} className="w-6 h-6 rounded-lg border border-black/40 bg-zinc-900 overflow-hidden grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:z-10 transition-all cursor-help" title={s.userName}>
                                        <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.userName}`} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                                {gameState.players.filter(p => p.isSpectator).length > 5 && (
                                    <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-[8px] font-black text-white/40">
                                        +{gameState.players.filter(p => p.isSpectator).length - 5}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={handleLeave} className="flex items-center gap-1.5 text-white/20 hover:text-red-400 transition-colors text-[9px] font-black uppercase">
                    <LogOut size={12} /> Quitter
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden relative">
                <GameBoardView
                    gameState={gameState}
                    localPlayerId={userId}
                    socket={socket}
                    onPlayCard={handlePlayCard}
                    onBid={handleBid}
                    onSramChoice={handleSramChoice}
                    bidSubmitted={bidSubmitted}
                    sramPendingCardId={sramPendingCardId}
                    bonus={bonus}
                    onBonusDone={() => setBonus(null)}
                />
            </div>

            {/* Round Score Overlay */}
            <AnimatePresence>
                {lastRoundResult && gameState.phase === "ROUND_END" && (
                    <RoundScoreBoard
                        results={lastRoundResult.results}
                        round={lastRoundResult.round}
                        players={gameState.players}
                        onNext={() => setLastRoundResult(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
