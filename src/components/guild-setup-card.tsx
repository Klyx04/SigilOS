"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2 } from "lucide-react";
import { onboardGuild } from "@/server/actions/admin-actions";
import { toast } from "sonner"; // Assuming sonner or use a simple alert if not available
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";
import { cn } from "@/lib/utils";
import { AUTONOMY_SUSPENDED_SHORT } from "@/lib/onboarding";

type GuildProps = {
    id: string;
    name: string;
    icon: string | null;
    isBotPresent?: boolean;
    clientId?: string;
};

export function GuildSetupCard({ guild, clientId, autoDeploy, autoOnboardingOn = true, guildLimitReached = false }: { guild: GuildProps, clientId?: string, autoDeploy?: boolean, autoOnboardingOn?: boolean, guildLimitReached?: boolean }) {
    // 🔒 Une seule porte fermée suffit à retirer l'offre : ouverture autonome suspendue **ou**
    // plafond de guildes atteint. Mesure du 01/11/2026 : le bandeau disait « limite atteinte »
    // pendant que la carte proposait encore « Déployer » / « Inviter le bot » ⇒ clic, refus, toast.
    const blocked = !autoOnboardingOn || guildLimitReached;
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
    const isReadyToDeploy = !needsInvite;

    return (
        <div className={cn(
            "reg-row grid-cols-[auto_minmax(0,1fr)_auto] px-4 py-3 rounded-lg transition-all",
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
                    {isReadyToDeploy && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Bot détecté · Prêt à déployer
                        </span>
                    )}
                </div>
                <p className="reg-mono mt-0.5 text-xs text-muted-foreground">
                    {blocked ? AUTONOMY_SUSPENDED_SHORT : needsInvite
                          ? "Bot absent — invitation requise"
                          : loading
                            ? "Activation en cours…"
                            : "Cliquez sur Déployer pour activer votre guilde sur SigilOS"}
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
                {/* 🔒 Kill-switch God « auto-onboarding » OFF : on ne propose **pas** le bouton
                    (il restait actif et lançait l'ouverture autonome malgré le réglage). */}
                {!blocked ? (
                    <>
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
                            <span>{loading ? "Activation…" : needsInvite ? "Inviter le bot" : "Déployer la guilde"}</span>
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
                    </>
                ) : (
                    <p className="max-w-[24rem] text-xs leading-relaxed text-muted-foreground">
                        {guildLimitReached
                            ? "Vous avez atteint le nombre maximum de guildes : quittez-en une pour en déployer une autre."
                            : "L'ouverture autonome est momentanément suspendue. Demande l'accompagnement : l'équipe ouvre ton espace avec toi."}
                    </p>
                )}
            </div>
        </div>
    );
}

