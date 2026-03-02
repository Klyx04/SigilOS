"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ShieldCheck,
    AlertCircle,
    MessageCircle,
    ShieldAlert,
    ExternalLink,
    Zap,
    Clock,
    History
} from "lucide-react";

interface ChatTransparencyModalProps {
    open: boolean;
    onClose: () => void;
}

export function ChatTransparencyModal({ open, onClose }: ChatTransparencyModalProps) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-white/10 text-white overflow-hidden p-0 gap-0">
                <div className="absolute top-0 left-0 w-full h-[150px] bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

                <DialogHeader className="p-6 pb-2 relative">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                        </div>
                        <DialogTitle className="text-2xl font-black tracking-tight uppercase tracking-widest bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            Transparence & Règles
                        </DialogTitle>
                    </div>
                    <p className="text-zinc-500 text-sm font-medium">
                        Le système de modération SigilOS est conçu pour assurer une ambiance saine et sécurisée pour tous les joueurs.
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin relative z-10">
                    {/* Section: Le Moteur */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            Filtrage Temps Réel
                        </h3>
                        <div className="grid gap-3">
                            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 group hover:bg-white/[0.05] transition-colors">
                                <span className="text-sm font-bold text-zinc-200">🛡️ Contenu bloqué</span>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Toutes les insults majeures, slurs, et schémas de <span className="text-zinc-300">phishing/scam</span> sont filtrés automatiquement. Votre message ne partira jamais s'il est considéré comme nuisible.
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 group hover:bg-white/[0.05] transition-colors">
                                <span className="text-sm font-bold text-zinc-200">🔗 URLs Sécurisées</span>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Seuls les domaines de confiance sont autorisés (SigilOS, Dofus, Discord whitelisted). Toute autre URL bloque instantanément l'envoi du message.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section: Sanctions */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                            Système de Sanctions
                        </h3>
                        <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
                            <div className="flex gap-4">
                                <div className="p-2 h-fit rounded-lg bg-red-500/10 text-red-400">
                                    <AlertCircle className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-sm font-black text-red-200 uppercase tracking-tight">Le Strike System</span>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Tentatives d'envoi de contenu bloqué :
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 3 ? "bg-red-500" : "bg-red-500/30"}`} />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-red-400/80 font-bold mt-1">
                                        3 messages bloqués en 5 minutes = Suspension temporaire.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2 border-t border-red-500/10">
                                <div className="p-2 h-fit rounded-lg bg-red-500/10 text-red-400">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-sm font-black text-red-200 uppercase tracking-tight">Suspension (15min)</span>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        En cas de récidive, votre chat sera grisé et inutilisable pendant 15 minutes. Un compte à rebours s'affichera sur votre écran.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: Audit */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-500" />
                            Traçabilité Immuable
                        </h3>
                        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 group hover:bg-blue-500/[0.08] transition-all">
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Chaque tentative de bloquage est consignée dans un <span className="text-blue-300 font-bold">journal d'audit immuable</span> consultable par les administrateurs de votre guilde. Cela inclut le contenu incriminé, même s'il n'a jamais été publié.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-900/50 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600 font-mono">SigilOS Moderation Engine v2.0</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition-colors"
                    >
                        Completé
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
