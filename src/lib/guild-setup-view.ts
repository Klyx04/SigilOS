/**
 * Carte « Déploiement » du portail — **une seule règle d'affichage** pour ses deux portes fermées.
 *
 * 🐛 Mesure du 01/11/2026 (capture utilisateur) : au plafond de guildes, la carte affichait encore
 * « Bot détecté · Prêt à déployer » **et** le texte du kill-switch (« Ouverture autonome suspendue »)
 * alors que l'ouverture autonome était active — trois signaux pour un seul état, dont un faux. Et le
 * paragraphe d'explication, posé dans la 3ᵉ colonne `auto` d'une grille `auto | 1fr | auto` large de
 * ~110 px à cet endroit, écrasait la colonne du titre (un mot par ligne) avant de déborder de la carte.
 *
 * ⇒ Règle : **une porte fermée = aucune offre**. La carte n'énonce que l'état, en une phrase courte,
 * dans la colonne du titre ; l'explication longue vit au bandeau de la page, une seule fois.
 */
import { AUTONOMY_SUSPENDED_MESSAGE } from "@/lib/onboarding";

/** Phrase d'état de la carte quand le plafond de guildes est atteint (l'action est au bandeau). */
export const GUILD_LIMIT_CARD_HINT =
    "Plafond de guildes atteint — quittez une guilde pour en déployer une autre.";

/** Pourquoi l'offre est retirée : plafond du compte, ou réglage momentané de la plateforme. */
export type GuildSetupBlockReason = "limit" | "suspended" | null;

/** Action proposée par la carte : inviter le bot, déployer, ou **aucune**. */
export type GuildSetupCta = "invite" | "deploy" | null;

export type GuildSetupView = {
    /** Une porte est fermée : la carte ne doit proposer **aucune** action. */
    blocked: boolean;
    blockReason: GuildSetupBlockReason;
    cta: GuildSetupCta;
    ctaLabel: string;
    /** Badge « prêt à déployer » : jamais quand une porte est fermée (il promettait l'inverse). */
    showReadyBadge: boolean;
    /** État en une phrase, affiché sous le nom du serveur. */
    subtitle: string;
};

/**
 * Décide ce que la carte montre. Fonction **pure** : aucun accusé de réception serveur, aucune
 * vérité inventée — le refus réel reste la garde G2.
 *
 * Le **plafond passe avant le kill-switch** : c'est un état du compte, pas un réglage de la
 * plateforme, et les deux phrases ne disent pas la même chose à l'utilisateur.
 */
export function resolveGuildSetupView(input: {
    autoOnboardingOn: boolean;
    guildLimitReached: boolean;
    hasBot: boolean;
    loading: boolean;
}): GuildSetupView {
    const blockReason: GuildSetupBlockReason = input.guildLimitReached
        ? "limit"
        : !input.autoOnboardingOn
          ? "suspended"
          : null;

    if (blockReason) {
        return {
            blocked: true,
            blockReason,
            cta: null,
            ctaLabel: "",
            showReadyBadge: false,
            subtitle: blockReason === "limit" ? GUILD_LIMIT_CARD_HINT : AUTONOMY_SUSPENDED_MESSAGE,
        };
    }

    if (!input.hasBot) {
        return {
            blocked: false,
            blockReason: null,
            cta: "invite",
            ctaLabel: "Inviter le bot",
            showReadyBadge: false,
            subtitle: "Bot absent — invitation requise",
        };
    }

    return {
        blocked: false,
        blockReason: null,
        cta: "deploy",
        ctaLabel: input.loading ? "Activation…" : "Déployer la guilde",
        showReadyBadge: true,
        subtitle: input.loading
            ? "Activation en cours…"
            : "Cliquez sur Déployer pour activer votre guilde sur SigilOS",
    };
}
