"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2 } from "lucide-react";
import { onboardGuild } from "@/server/actions/admin-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // Assuming sonner or use a simple alert if not available
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";

type GuildProps = {
    id: string;
    name: string;
    icon: string | null;
    isBotPresent?: boolean;
    clientId?: string;
};

export function GuildSetupCard({ guild, clientId, autoDeploy }: { guild: GuildProps, clientId?: string, autoDeploy?: boolean }) {
    const [loading, setLoading] = useState(false);
    const [inviteStarted, setInviteStarted] = useState(false);
    const autoDeployTried = useRef(false);

    // If bot is missing, we need to invite it first
    const needsInvite = guild.isBotPresent === false;

    const handleSetup = async () => {
        if (needsInvite) {
            // Redirect to Discord OAuth2
            if (!clientId) {
                toast.error("Configuration Discord manquante (Client ID)");
                return;
            }

            // Using window.location.origin ensures we redirect back to the correct environment (localhost/beta/prod)
            // #223 P2 — bitmask minimal (plus de permissions=8 Administrateur).
            const inviteUrl = buildDiscordBotInviteUrl(clientId, {
                guildId: guild.id,
                redirectUri: `${window.location.origin}/onboarding/success`,
                scope: "bot",
            });

            if (!inviteUrl) return; // fail-closed (clientId déjà vérifié, garde TS)

            // Open in a new tab to keep the context, but we list for completion.
            // Si le bloqueur de popup refuse l'onglet, on bascule dans l'onglet
            // courant (même URL de retour /onboarding/success → /dashboard).
            setInviteStarted(true);
            const popup = window.open(inviteUrl, "_blank");
            if (!popup || popup.closed || typeof popup.closed === "undefined") {
                window.location.href = inviteUrl;
            }
            return;
        }

        setLoading(true);
        try {
            const result = await onboardGuild(guild.id);
            if (result.success) {
                // Force a hard reload to ensure state is absolutely fresh
                window.location.reload();
            } else {
                console.error(result.error);
                toast.error("Erreur lors du déploiement: " + result.error);
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur inattendue");
            setLoading(false);
        }
    };

    // Activation automatique : bot déjà présent + un seul serveur éligible =
    // on déploie sans exiger le clic (comme les autres bots : invité =
    // fonctionnel). `onboardGuild` est idempotente + rate-limitée côté serveur,
    // donc un double déclenchement (StrictMode) est sans effet de bord.
    useEffect(() => {
        if (!autoDeploy || needsInvite || autoDeployTried.current) return;
        autoDeployTried.current = true;
        setLoading(true);
        onboardGuild(guild.id).then((result) => {
            if (result.success) {
                window.location.reload();
            } else {
                toast.error("Erreur lors de l'activation : " + result.error);
                setLoading(false);
            }
        }).catch(() => {
            toast.error("Erreur inattendue");
            setLoading(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDeploy, needsInvite, guild.id]);

    // Auto-refresh when bot is authorized in the other tab.
    // + reload au retour du focus (cas popup fermée à la main ou bascule
    // même-onglet : sans cela la carte reste "Bot absent" jusqu'au F5 manuel).
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "sigilos-bot-invited" && event.origin === window.location.origin) {
                window.location.reload();
            }
        };
        // Reload au retour du focus UNIQUEMENT après un clic "Inviter"
        // (cas popup fermée à la main : sans cela la carte reste
        // "Bot absent" jusqu'au F5 manuel).
        const handleFocus = () => {
            if (inviteStarted) window.location.reload();
        };

        window.addEventListener("message", handleMessage);
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("message", handleMessage);
            window.removeEventListener("focus", handleFocus);
        };
    }, [inviteStarted]);

    return (
        <Card className="bg-black/20 border-border border-dashed hover:border-border-strong transition-all cursor-default">
            <CardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Avatar className="h-12 w-12 border-2 border-border grayscale opacity-70">
                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                            {guild.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden opacity-70">
                        <h3 className="font-bold truncate text-foreground">
                            {guild.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {needsInvite
                                ? "Bot absent - Invitation requise"
                                : loading ? "Activation en cours…" : "Prêt pour déploiement"}
                        </p>
                    </div>
                </div>

                <Button
                    size="sm"
                    variant={needsInvite ? "secondary" : "outline"}
                    className={needsInvite
                        ? "bg-info/20 text-info hover:bg-info/40"
                        : "border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                    }
                    onClick={handleSetup}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {loading ? "..." : (needsInvite ? "Inviter le Bot" : "Déployer")}
                </Button>
            </CardContent>
        </Card>
    );
}
