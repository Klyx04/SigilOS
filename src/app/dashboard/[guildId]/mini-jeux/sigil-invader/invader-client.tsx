"use client";

import { useState, useEffect } from "react";
import { InvaderRoom, createInvaderRoom, joinInvaderRoom, startInvaderGame } from "@/server/actions/sigil-invader-actions";
import { InvaderLobby } from "@/components/sigil-invader/InvaderLobby";
import dynamic from "next/dynamic";
import { Loader2, Rocket, Users, Play, Plus, Compass } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const SigilInvaderGame = dynamic(() => import("@/components/sigil-invader/SigilInvaderGame"), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black rounded-[2.5rem] gap-4">
            <Loader2 className="animate-spin text-indigo-400" size={48} />
            <span className="text-white/20 font-black uppercase tracking-widest text-xs">Chargement du moteur...</span>
        </div>
    )
});

export default function InvaderClient({ initialRoom, guildId, user }: { initialRoom: InvaderRoom | null, guildId: string, user: any }) {
    const [room, setRoom] = useState<InvaderRoom | null>(initialRoom);
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();
    const isSoloRequest = searchParams.get('solo') === 'true';
    const isSpectator = searchParams.get('spectate') === 'true';

    useEffect(() => {
        if (initialRoom && initialRoom.state === 'LOBBY' && !isSpectator) {
            // Auto join if room provided in URL and not spectating
            joinInvaderRoom(initialRoom.roomId, guildId).catch(err => {
                toast.error(err.message);
                setRoom(null);
            });
        } else if (initialRoom && isSpectator) {
            // Just show it
            setRoom(initialRoom);
        } else if (!initialRoom && isSoloRequest) {
            handleSolo();
        }
    }, [initialRoom, guildId, isSoloRequest]);

    const handleCreate = async () => {
        setIsLoading(true);
        try {
            const res = await createInvaderRoom(guildId);
            if (res.success) {
                // Refresh room
                const { getInvaderRoom } = await import("@/server/actions/sigil-invader-actions");
                const freshRoom = await getInvaderRoom(res.roomId);
                setRoom(freshRoom);
            }
        } catch (err) {
            toast.error("Erreur à la création");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSolo = async () => {
        setIsLoading(true);
        try {
            const res = await createInvaderRoom(guildId);
            if (res.success) {
                await startInvaderGame(res.roomId);
                const { getInvaderRoom } = await import("@/server/actions/sigil-invader-actions");
                const freshRoom = await getInvaderRoom(res.roomId);
                setRoom(freshRoom);
                toast.success("Mode Solo activé !");
            }
        } catch (err) {
            toast.error("Erreur lancement solo");
        } finally {
            setIsLoading(false);
        }
    };

    if (!room) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8">
                <div className="max-w-md w-full text-center space-y-12">
                    <div className="relative inline-block">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-2xl shadow-indigo-500/20 animate-bounce group hover:scale-110 transition-transform cursor-pointer">
                            <Rocket size={56} className="group-hover:rotate-12 transition-transform" />
                        </div>
                        <div className="absolute -bottom-4 -right-4 w-12 h-12 rounded-2xl bg-black border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                            <Users size={20} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter">Sigil-Invader</h2>
                        <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-[0.3em] opacity-60">Défense Spatiale de la Guilde</p>
                        <p className="text-white/30 text-sm font-medium px-4">
                            Embarquez dans votre Balafreux, formez une escouade et repoussez l'invasion de Tofus Célestes à travers l'Hormonde.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleCreate}
                            disabled={isLoading}
                            className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase italic tracking-widest text-lg hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/40 flex items-center justify-center gap-3 active:scale-95"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : <><Plus /> Créer une Escouade</>}
                        </button>
                        
                        <button 
                            onClick={handleSolo}
                            disabled={isLoading}
                            className="w-full py-4 rounded-xl bg-white/5 text-white/60 font-black uppercase text-[10px] italic border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Compass size={14} /> Jouer Solo</>}
                        </button>

                        <div className="text-white/10 font-bold uppercase text-[10px] flex items-center justify-center gap-4 pt-4">
                            <div className="h-px w-10 bg-white/5" />
                            Ou rejoignez un salon actif via la carte
                            <div className="h-px w-10 bg-white/5" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (room.state === 'PLAYING') {
        return (
            <div className="w-full h-full p-4 md:p-8">
                <SigilInvaderGame room={room} guildId={guildId} isSolo={isSoloRequest} isSpectator={isSpectator} />
            </div>
        );
    }

    return (
        <InvaderLobby 
            room={room} 
            guildId={guildId} 
            onStart={() => setRoom(prev => prev ? { ...prev, state: 'PLAYING' } : null)} 
        />
    );
}
