/**
 * Classement des erreurs Discord d'édition — « le message n'existe plus ».
 *
 * Défaut mesuré le 22/10/2026 (Sentry `JAVASCRIPT-NEXTJS-23`) : la règle ne lisait que
 * le **texte** de l'erreur. `updateChannelMessage` lève un `DiscordApiError` portant le
 * statut 404 mais un message traduit (« Salon ou message introuvable ») : un message
 * d'objet supprimé à la main n'était pas reconnu, faisait échouer tout le lot de
 * synchronisation et se rejouait à chaque passe du cron.
 *
 * La règle lit désormais le **statut porté par l'erreur** (source de vérité) et retombe
 * sur le texte pour les chemins qui n'ont que la chaîne (`MarketDiscordResult.error`).
 */

import { describe, it, expect } from "vitest";
import { DiscordApiError, isDiscordMessageGoneError } from "@/lib/discord-api-errors";

describe("isDiscordMessageGoneError", () => {
    it("reconnaît un 404 porté par l'erreur, même si son texte ne dit pas 404", () => {
        const error = new DiscordApiError("Salon ou message introuvable", 404);
        expect(isDiscordMessageGoneError(error)).toBe(true);
    });

    it("reconnaît le texte traduit d'une édition en échec (résultat sérialisé)", () => {
        expect(isDiscordMessageGoneError("Salon ou message introuvable")).toBe(true);
    });

    it("reconnaît le message natif « Unknown Message »", () => {
        expect(isDiscordMessageGoneError("Unknown Message")).toBe(true);
    });

    it("reconnaît l'ancien format « Discord Update Error: 404 »", () => {
        expect(isDiscordMessageGoneError("Discord Update Error: 404 Not Found")).toBe(true);
    });

    it("ne classe pas un refus de permission comme un message disparu", () => {
        expect(
            isDiscordMessageGoneError(new DiscordApiError("Le bot n'a pas accès à ce salon (Permission bloquée)", 403))
        ).toBe(false);
    });

    it("ne classe pas un 500 comme un message disparu (rejouable)", () => {
        expect(isDiscordMessageGoneError(new DiscordApiError("Discord a refusé la demande", 500))).toBe(false);
    });

    it("ne classe pas un texte sans rapport", () => {
        expect(isDiscordMessageGoneError("Envoi dans le post du lot refusé")).toBe(false);
    });

    it("ne classe rien quand il n'y a rien à lire", () => {
        expect(isDiscordMessageGoneError(null)).toBe(false);
        expect(isDiscordMessageGoneError(undefined)).toBe(false);
        expect(isDiscordMessageGoneError("")).toBe(false);
        expect(isDiscordMessageGoneError({})).toBe(false);
    });

    it("reste aligné sur le contrat du marché : une erreur 404 sans texte suffit", () => {
        const error = Object.assign(new Error(""), { status: 404 });
        expect(isDiscordMessageGoneError(error)).toBe(true);
    });
});
