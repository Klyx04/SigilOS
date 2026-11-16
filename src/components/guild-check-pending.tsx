"use client";

/**
 * Portail `/dashboard` — **état d'attente** de la vérification Discord.
 *
 * Pourquoi cet écran existe : quand Discord ne répond pas (429, 5xx, réseau), le
 * portail ne sait **pas** si le compte a une guilde. Il ne doit donc pas afficher
 * « Accès restreint / Aucune guilde » — un verdict qu'il n'a pas mesuré — ni
 * proposer « installer ma guilde » pendant qu'il vérifie.
 *
 * La reprise est un **rafraîchissement serveur** (`router.refresh()`), pas un
 * rechargement complet : pas de flash, pas de perte de scroll. Le calendrier et
 * le plafond vivent dans `src/lib/onboarding-gating.ts` (règle pure, testée).
 */

import { RefreshCw, ShieldAlert } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guildLookupRetryDelayMs } from "@/lib/onboarding-gating";

const ATTEMPTS_KEY = "sigilos-guild-lookup-attempts";
const ATTEMPTS_WINDOW_MS = 5 * 60 * 1000;

function readAttempts(): number {
    try {
        const raw = sessionStorage.getItem(ATTEMPTS_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as { count: number; ts: number };
        if (Date.now() - parsed.ts > ATTEMPTS_WINDOW_MS) return 0;
        return parsed.count || 0;
    } catch {
        return 0;
    }
}

function writeAttempts(count: number): void {
    try {
        sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count, ts: Date.now() }));
    } catch {
        /* stockage indisponible — un essai de trop est inoffensif */
    }
}

export function GuildCheckPending({ needsReconnect }: { needsReconnect: boolean }) {
    const router = useRouter();
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        setAttempts(readAttempts());
    }, []);

    const delay = guildLookupRetryDelayMs({ needsReconnect, attempts });

    useEffect(() => {
        if (delay === null) return;
        const timer = setTimeout(() => {
            const next = attempts + 1;
            writeAttempts(next);
            setAttempts(next);
            router.refresh();
        }, delay);
        return () => clearTimeout(timer);
    }, [attempts, delay, router]);

    const retryNow = () => {
        const next = attempts + 1;
        writeAttempts(next);
        // Avancer le compteur remet le calendrier en route et arme l'essai suivant.
        setAttempts(next);
        if (delay === null) {
            // Après le plafond, navigation complète : elle suit à coup sûr une
            // éventuelle redirection serveur (portail → espace visiteur).
            window.location.assign("/dashboard");
            return;
        }
        router.refresh();
    };

    const reconnectWithGuildsScope = () => {
        // Re-consentement explicite : Discord réaffiche l'écran d'autorisation
        // (avec la liste des serveurs) au lieu de réutiliser l'ancienne
        // autorisation sans scope `guilds`.
        void signIn("discord", { callbackUrl: "/dashboard" }, { prompt: "consent" });
    };

    return (
        <div className="max-w-[56rem]">
            <p className="reg-eyebrow">Première connexion</p>
            <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                Ton espace se prépare.
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                On vérifie les serveurs Discord où tu peux administrer SigilOS. Ça prend quelques secondes.
            </p>

            {needsReconnect ? (
                <div className="reg-callout mt-6 border-danger/40">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                    <div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Discord n&apos;a pas partagé ta liste de serveurs (autorisation incomplète). Inutile de
                            recharger : reconnecte-toi en cochant l&apos;accès aux serveurs.
                        </p>
                        <button type="button" onClick={reconnectWithGuildsScope} className="reg-link mt-2 text-sm">
                            Reconnecter avec l&apos;accès serveurs
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <ol className="mt-6 space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                            <span className="text-success" aria-hidden="true">✓</span>
                            Compte Discord connecté
                        </li>
                        <li className="flex items-center gap-2">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                            Vérification de tes serveurs…
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-muted-foreground" aria-hidden="true">·</span>
                            Ton espace : portail de guilde ou espace visiteur
                        </li>
                    </ol>

                    <p className="mt-4 max-w-[62ch] text-xs text-muted-foreground leading-relaxed">
                        Aucun serveur à administrer ? Ton espace visiteur s&apos;ouvrira tout seul dès que la
                        vérification sera terminée.
                    </p>

                    <button type="button" onClick={retryNow} className="reg-link mt-4 text-sm">
                        {delay === null ? "Relancer la vérification" : "Vérifier maintenant"}
                    </button>
                    {delay === null && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Discord met plus de temps que prévu. Tu peux réessayer dans un instant.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
