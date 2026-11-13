/**
 * Carte « Déploiement » + bandeau du plafond — **comportement d'affichage** (LG-3, correctif du
 * 01/11/2026).
 *
 * 🐛 Ce qui est réellement en jeu : au plafond de guildes, la carte affichait encore « Prêt à
 * déployer », employait le texte du kill-switch (« Ouverture autonome suspendue ») alors que
 * l'ouverture autonome était active, et son paragraphe d'explication écrasait la colonne du titre
 * avant de déborder de la carte. Trois signaux pour un seul état, dont un faux.
 *
 * ⇒ Une porte fermée = **aucune offre** ; l'état tient en une phrase ; l'explication longue reste
 * au bandeau de la page, aligné dans la colonne de lecture.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GUILD_LIMIT_CARD_HINT, resolveGuildSetupView } from "@/lib/guild-setup-view";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const CARD = read("src/components/guild-setup-card.tsx");
const PAGE = read("src/app/dashboard/page.tsx");

const OUVERTE = { autoOnboardingOn: true, guildLimitReached: false, hasBot: true, loading: false };

describe("plafond atteint — la carte ne propose plus rien", () => {
    it("retire l'offre, le badge « prêt à déployer » et le texte du kill-switch", () => {
        const vue = resolveGuildSetupView({ ...OUVERTE, guildLimitReached: true });

        expect(vue.blocked).toBe(true);
        expect(vue.blockReason).toBe("limit");
        expect(vue.cta).toBeNull();
        expect(vue.showReadyBadge).toBe(false);
        expect(vue.subtitle).toBe(GUILD_LIMIT_CARD_HINT);
        expect(vue.subtitle).not.toContain("Ouverture autonome suspendue");
    });

    it("le plafond du compte passe avant le kill-switch (état du compte ≠ réglage)", () => {
        const vue = resolveGuildSetupView({
            ...OUVERTE,
            autoOnboardingOn: false,
            guildLimitReached: true,
        });

        expect(vue.blockReason).toBe("limit");
    });
});

describe("kill-switch God — la carte garde le texte d'accompagnement", () => {
    it("retire l'offre et demande l'ouverture accompagnée", () => {
        const vue = resolveGuildSetupView({ ...OUVERTE, autoOnboardingOn: false });

        expect(vue.blocked).toBe(true);
        expect(vue.blockReason).toBe("suspended");
        expect(vue.cta).toBeNull();
        expect(vue.subtitle).toContain("l'équipe ouvre ton espace avec toi");
    });
});

describe("carte ouverte — l'offre reste explicite", () => {
    it("bot absent : inviter, jamais « prêt à déployer »", () => {
        const vue = resolveGuildSetupView({ ...OUVERTE, hasBot: false });

        expect(vue.cta).toBe("invite");
        expect(vue.ctaLabel).toBe("Inviter le bot");
        expect(vue.showReadyBadge).toBe(false);
    });

    it("bot présent : déployer, badge affiché", () => {
        const vue = resolveGuildSetupView(OUVERTE);

        expect(vue.blocked).toBe(false);
        expect(vue.cta).toBe("deploy");
        expect(vue.ctaLabel).toBe("Déployer la guilde");
        expect(vue.showReadyBadge).toBe(true);
    });

    it("activation en cours : le libellé le dit, le badge reste", () => {
        const vue = resolveGuildSetupView({ ...OUVERTE, loading: true });

        expect(vue.ctaLabel).toBe("Activation…");
        expect(vue.showReadyBadge).toBe(true);
    });
});

describe("garde de mise en page — le défaut mesuré du 01/11/2026", () => {
    it("la carte n'a plus de paragraphe long dans la 3ᵉ colonne", () => {
        expect(CARD).not.toContain("max-w-[24rem]");
        expect(CARD).toContain("{!blocked && (");
        expect(CARD).toContain('blocked ? "grid-cols-[auto_minmax(0,1fr)]"');
    });

    it("la carte ne s'auto-déploie pas quand une porte est fermée", () => {
        expect(CARD).toContain(
            "if (!autoDeploy || needsInvite || blocked || autoDeployTried.current) return;",
        );
    });

    it("le bandeau vit dans la colonne de lecture, pas en barre pleine largeur", () => {
        const shell = PAGE.indexOf('className="reg-shell py-10 lg:py-14 space-y-10"');
        const bandeau = PAGE.indexOf("{guildLimitReached && (");

        expect(PAGE).not.toContain("px-4 pt-6 md:px-8");
        expect(shell).toBeGreaterThan(-1);
        expect(bandeau).toBeGreaterThan(shell);
    });
});
