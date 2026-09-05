"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loginWithDiscord } from "@/server/actions/auth-actions";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
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
            <DialogContent className="max-w-lg bg-surface border-border text-foreground rounded-2xl p-6 md:p-8">
                <DialogHeader className="text-left space-y-2">
                    <p className="text-sm font-semibold text-success">
                        Créer l&apos;espace de ta guilde
                    </p>
                    <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight">
                        Deux façons de nous rejoindre
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                        En autonomie si tu administres ton Discord, ou accompagné par notre équipe.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2">
                    {/* Option 1 : autonome */}
                    <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
                        <p className="text-sm font-bold text-foreground">
                            En autonomie <span className="font-medium text-muted-foreground">· immédiat et gratuit</span>
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Chef de guilde ou admin Discord ? Connecte-toi et déploie
                            ta guilde en 30 secondes.
                        </p>
                        <Button
                            onClick={() => loginWithDiscord()}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl"
                        >
                            <DiscordIcon className="w-4 h-4 mr-2" />
                            Déployer mon serveur en 1 clic
                        </Button>
                    </div>

                    {/* Option 2 : accompagné */}
                    <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
                        <p className="text-sm font-bold text-foreground">
                            Accompagné <span className="font-medium text-muted-foreground">· alliance et support</span>
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Configuration multi-guildes, alliance ou questions avant
                            de te lancer ? Ouvre un ticket, on s&apos;en occupe.
                        </p>
                        <a
                            href={discordInvite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-elevated hover:bg-muted border border-border text-foreground font-bold text-sm transition-colors"
                        >
                            <DiscordIcon className="w-4 h-4" />
                            Ouvrir un ticket sur Discord
                        </a>
                    </div>
                </div>

                <div className="text-center pt-1 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                        Déjà membre d&apos;une guilde active ?{" "}
                        <button onClick={onClose} className="text-success hover:underline font-semibold">
                            Ferme et connecte-toi
                        </button>.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
