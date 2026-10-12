"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
    /**
     * Kill-switch God (PlatformConfig.autoOnboardingEnabled) : OFF = on masque
     * le bloc "En autonomie" (file God uniquement). Défaut true.
     */
    autoOnboardingOn?: boolean;
    /** Client ID Discord pour le lien direct d'ajout du bot. Sans lui, repli login. */
    clientId?: string;
}

export function AccessRequestModal({ open, onClose, autoOnboardingOn = true, clientId = "" }: AccessRequestModalProps) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

    const addBotDirect = () => {
        if (!clientId) {
            void loginWithDiscord();
            return;
        }
        const inviteUrl = buildDiscordBotInviteUrl(clientId, {
            scope: "bot applications.commands",
        });
        if (!inviteUrl) return;
        const popup = window.open(inviteUrl, "_blank");
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
            window.location.href = inviteUrl;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="reg-panel max-w-lg border-border p-6 text-foreground md:p-8">
                <DialogHeader className="text-left space-y-2">
                    <p className="reg-eyebrow">Créer l&apos;espace de ta guilde</p>
                    <DialogTitle className="text-lg font-bold tracking-tight md:text-xl">
                        Deux façons de commencer
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                        En autonomie si tu administres ton Discord, ou accompagné pas à pas.
                    </DialogDescription>
                </DialogHeader>

                <div className="my-2 space-y-4">
                    {/* Option 1 : autonome (masquée si kill-switch God OFF) */}
                    {autoOnboardingOn && (
                    <div className="rounded-md border border-border bg-background p-5">
                        <p className="text-sm font-semibold text-foreground">
                            En autonomie <span className="font-normal text-muted-foreground">· immédiat et gratuit</span>
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Chef de guilde ou admin Discord ? Ajoute le bot
                            à ton serveur en 1 clic.
                        </p>
                        <button type="button" onClick={addBotDirect} className="reg-btn reg-btn-primary mt-4 w-full">
                            <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                            Ajouter le bot à mon serveur
                        </button>
                    </div>
                    )}

                    {/* Option 2 : accompagné */}
                    <div className="rounded-md border border-border bg-background p-5">
                        <p className="text-sm font-semibold text-foreground">
                            Accompagné <span className="font-normal text-muted-foreground">· aide personnelle</span>
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Une question avant de te lancer, ou besoin d&apos;aide
                            pour installer ? Ouvre un ticket, je t&apos;accompagne.
                        </p>
                        <a
                            href={discordInvite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="reg-btn reg-btn-secondary mt-4 w-full"
                        >
                            <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                            Ouvrir un ticket sur Discord
                        </a>
                    </div>
                </div>

                <div className="border-t border-border pt-3 text-center">
                    <p className="text-xs text-muted-foreground">
                        Déjà membre d&apos;une guilde active ?{" "}
                        <button type="button" onClick={onClose} className="reg-link text-xs">
                            Ferme et connecte-toi
                        </button>.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

