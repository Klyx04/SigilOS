"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

export function AccessRequestModal({ open, onClose }: AccessRequestModalProps) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-md bg-zinc-950 border-white/10">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-lg font-bold text-white">
                        Demander l&apos;accès pour votre guilde
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-400 leading-relaxed">
                        Un chef ou admin Discord ouvre un ticket sur le serveur SigilOS.
                        Après validation, vous configurez vos modules puis invitez vos membres.
                    </DialogDescription>
                </DialogHeader>

                <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 w-full h-12 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-sm transition-colors"
                >
                    <DiscordIcon className="w-5 h-5" />
                    Ouvrir un ticket sur Discord
                </a>

                <p className="text-label text-zinc-500 leading-relaxed">
                    Réponse généralement sous 24-48h. Déjà membre ? Fermez cette fenêtre et{" "}
                    <button onClick={onClose} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                        connectez-vous avec Discord
                    </button>.
                </p>
            </DialogContent>
        </Dialog>
    );
}
