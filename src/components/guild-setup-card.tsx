"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2 } from "lucide-react";
import { onboardGuild } from "@/server/actions/admin-actions";
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
            // Scope "bot applications.commands" (défaut) : "bot" seul priverait
            // les nouvelles installations des commandes slash.
            const inviteUrl = buildDiscordBotInviteUrl(clientId, {
                guildId: guild.id,
                redirectUri: `${window.location.origin}/onboarding/success`,
                scope: "bot applications.commands",
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

    // Auto-refresh quand le bot est autorisé dans l'autre onglet.
    // PAS de reload au retour du focus : chaque alt-tab rechargeait la page
    // et remplaçait le portail plein par un état vide au moindre 429
    // (« la page apparaît puis disparaît »). L'utilisateur vérifie
    // explicitement via le bouton ci-dessous.
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "sigilos-bot-invited" && event.origin === window.location.origin) {
                window.location.reload();
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Ligne de liste (pas une carte) : ce composant vit dans la liste
    // « Déploiement » d'un panneau `.reg-panel`, aux côtés des guildes actives
    // et des serveurs en attente. Le cadre en pointillés sur fond noir faisait
    // doublon avec le panneau qui l'accueille.
    return (
        <div className="reg-row grid-cols-[auto_minmax(0,1fr)_auto] px-4">
            <Avatar className="h-10 w-10 rounded-md border border-border opacity-70">
                <AvatarImage src={guild.icon || ""} alt={guild.name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                    {guild.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{guild.name}</h3>
                <p className="reg-mono mt-1 text-xs text-muted-foreground">
                    {needsInvite
                        ? "Bot absent — invitation requise"
                        : loading
                          ? "Activation en cours…"
                          : "Prêt pour déploiement"}
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
                <button
                    type="button"
                    onClick={handleSetup}
                    disabled={loading}
                    className="reg-btn reg-btn-primary min-h-9 px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{loading ? "Activation…" : needsInvite ? "Inviter le bot" : "Déployer"}</span>
                </button>

                {needsInvite && inviteStarted && !loading && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="reg-link-quiet text-xs"
                    >
                        J&apos;ai invité le bot, vérifier
                    </button>
                )}
            </div>
        </div>
    );
}

