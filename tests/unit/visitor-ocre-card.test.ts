import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const CARD = readFileSync(
    "src/app/espace-visiteur/_components/visitor-ocre-card.tsx",
    "utf8"
);
const PAGE = readFileSync("src/app/espace-visiteur/general/page.tsx", "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/&apos;/g, "'");

describe("Carte Ocre du visiteur — comme l'interne", () => {
    it("affiche l'étape, la progression, Gardiens et Archimonstres", () => {
        const card = stripComments(CARD);
        expect(card).toContain("Quête de l'Éternelle Moisson");
        expect(card).toContain("Étape actuelle");
        expect(card).toContain("Progression");
        expect(card).toContain("Gardiens");
        expect(card).toContain("Archimonstres");
    });

    it("se rafraîchit : intervalle, bouton et heure de synchro", () => {
        const card = stripComments(CARD);
        expect(card).toContain("REFRESH_MS");
        expect(card).toContain("setInterval");
        expect(card).toContain("Forcer la synchro");
        expect(card).toContain("formatDistanceToNow");
        expect(card).toContain("Synchronisé");
    });

    it("ne manipule aucune clé et n'est montée qu'avec une clé", () => {
        const card = stripComments(CARD);
        expect(card).not.toContain("metamobApiKey");
        expect(PAGE).toContain("profile.hasMetamobApiKey ?");
        expect(PAGE).toContain("<VisitorOcreCard />");
    });
});
