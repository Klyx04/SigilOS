"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Crown,
    Settings,
    Users,
    MoreHorizontal,
    ArrowRight,
    ShieldAlert,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscordOwnershipModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildName: string;
}

export function DiscordOwnershipModal({ isOpen, onClose, guildName }: DiscordOwnershipModalProps) {
    const steps = [
        {
            icon: <Settings className="w-5 h-5 text-zinc-400" />,
            title: "Paramètres du serveur",
            desc: "Cliquez sur le nom de votre serveur sur Discord, puis sur l'icône de rouage."
        },
        {
            icon: <Users className="w-5 h-5 text-zinc-400" />,
            title: "Onglet Membres",
            desc: "Faites défiler tout en bas de la colonne de gauche jusqu'à 'Membres'."
        },
        {
            icon: <MoreHorizontal className="w-5 h-5 text-zinc-400" />,
            title: "Options du membre",
            desc: "Choisissez votre successeur, passez la souris sur son nom et cliquez sur les trois petits points."
        },
        {
            icon: <Crown className="w-5 h-5 text-amber-400" />,
            title: "Transférer la propriété",
            desc: "Activez le transfert. Une fois fait, vous pourrez supprimer votre compte SigilOS."
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10 text-white p-0 overflow-hidden rounded-[2rem]">
                <div className="relative p-6 space-y-6">
                    {/* Header with Icon */}
                    <DialogHeader className="space-y-4">
                        <div className="flex justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                                <div className="relative p-4 bg-red-500/10 border border-red-500/20 rounded-full">
                                    <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <DialogTitle className="text-2xl font-black text-center uppercase tracking-tight">
                            Action Bloquée !
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-center text-sm leading-relaxed">
                            Vous êtes le **Propriétaire Technique** (Crown 👑) du Discord  <span className="text-white font-bold">{guildName}</span>.
                            SigilOS protège les données de guilde : vous devez transférer la propriété avant de partir.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tutorial Steps */}
                    <div className="space-y-2 py-4">
                        <h4 className="text-caption font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 px-2">
                            Procédure de transfert (Discord)
                        </h4>

                        <div className="grid gap-3">
                            {steps.map((step, idx) => (
                                <div key={idx} className="group relative flex items-start gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all hover:bg-white/[0.07]">
                                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-caption font-black text-zinc-400 group-hover:text-white group-hover:bg-zinc-700 transition-colors">
                                        {idx + 1}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            {step.icon}
                                            <span className="text-sm font-bold text-zinc-200">{step.title}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div className="absolute -bottom-2 left-7 w-px h-2 bg-white/5" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-2 flex flex-col gap-3">
                        <Button
                            onClick={onClose}
                            className="h-12 w-full bg-white text-black font-black uppercase tracking-tight hover:bg-zinc-200 transition-all rounded-xl active:scale-95"
                        >
                            J'ai compris
                        </Button>
                        <a
                            href="https://support.discord.com/hc/fr/articles/216273938-Comment-transf%C3%A9rer-la-propri%C3%A9t%C3%A9-d-un-serveur"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-2 text-caption font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                        >
                            Voir l'aide officielle Discord
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>

                {/* Bottom decorative bar */}
                <div className="h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 opacity-50" />
            </DialogContent>
        </Dialog>
    );
}
