"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2 } from "lucide-react";
import { onboardGuild } from "@/server/actions/admin-actions";
import { toast } from "sonner"; // Assuming sonner or use a simple alert if not available
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";
import { cn } from "@/lib/utils";
import { resolveGuildSetupView } from "@/lib/guild-setup-view";

type GuildProps = {
    id: string;
    name: string;
    icon: string | null;
    isBotPresent?: boolean;
    clientId?: string;
};

export function GuildSetupCard({ guild, clientId, autoDeploy, autoOnboardingOn = true, guildLimitReached = false }: { guild: GuildProps, clientId?: string, autoDeploy?: boolean, autoOnboardingOn?: boolean, guildLimitReached?: boolean }) {
    const [loading, setLoading] = useState(false);
    const [inviteStarted, setInviteStarted] = useState(false);
    const autoDeployTried = useRef(false);

    // If bot is missing, we need to invite it first
    const needsInvite = guild.isBotPresent === false;

    // 🔒 Une seule porte fermée suffit à retirer l'offre : ouverture autonome suspendue **ou**
    // plafond de guildes atteint. Mesure du 01/11/2026 : le bandeau disait « limite atteinte »
    // pendant que la carte proposait encore « Déployer » / « Inviter le bot » ⇒ clic, refus, toast.
    // Le détail (état, badge, libellé, phrase) vit dans `resolveGuildSetupView`, testé à part.
    const view = resolveGuildSetupView({
        autoOnboardingOn,
        guildLimitReached,
        hasBot: !needsInvite,
        loading,
    });
    const blocked = view.blocked;

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
        // Une porte fermée (plafond ou kill-switch) n'appelle **pas** le serveur : le refus est
        // certain et l'utilisateur n'a rien demandé. C'est ce qui faisait « cliquer pour rien ».
        if (!autoDeploy || needsInvite || blocked || autoDeployTried.current) return;
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
    }, [autoDeploy, needsInvite, blocked, guild.id]);

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
    const isReadyToDeploy = !blocked && !needsInvite;

    return (
        <div className={cn(
            "reg-row px-4 py-3 rounded-lg transition-all",
            // Sans 3ᵉ colonne quand l'offre est retirée : la grille n'a plus qu'un avatar et le
            // texte. C'est ce qui empêchait la colonne du titre d'être écrasée (mesure 01/11/2026).
            blocked ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)_auto]",
            isReadyToDeploy
                ? "bg-emerald-500/[0.05] border border-emerald-500/30 shadow-sm"
                : "border-transparent"
        )}>
            <Avatar className={cn(
                "h-10 w-10 rounded-md border",
                isReadyToDeploy ? "border-emerald-500/50 opacity-100 shadow-sm" : "border-border opacity-70"
            )}>
                <AvatarImage src={guild.icon || ""} alt={guild.name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                    {guild.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground truncate">{guild.name}</h3>
                    {view.showReadyBadge && (
                        <span className="reg-tag border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                            Bot détecté · Prêt à déployer
                        </span>
                    )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {view.subtitle}
                </p>
            </div>

            {/* Porte fermée ⇒ **aucune** offre : ni bouton, ni texte long dans la 3ᵉ colonne
                (il écrasait le titre et débordait de la carte). L'explication est au bandeau. */}
            {!blocked && (
                <div className="flex shrink-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSetup}
                        disabled={loading}
                        className={cn(
                            "min-h-9 px-4 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-60",
                            isReadyToDeploy
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
                                : "reg-btn reg-btn-primary"
                        )}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Plus className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{view.ctaLabel}</span>
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
            )}
        </div>
    );
}

