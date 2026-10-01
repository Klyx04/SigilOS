/**
 * Calendrier — **classe affichée** des inscrits (site + embed Discord).
 *
 * Constat beta : l'embed du calendrier n'affichait que la classe **choisie** à
 * l'inscription (`p.classe ?? null`), sans repli sur celle du profil Dofus
 * (`UserProfile.classe`) et sans pictos — contrairement aux embeds Songes/DJ. Un
 * inscrit sans classe choisie tombait donc dans un field « ❔ Sans classe » alors que
 * son profil la connaît, et le site n'affichait aucune classe du tout.
 *
 * Ces tests verrouillent : ① la règle **unique** `resolveEffectiveClass` (lib partagée,
 * importable côté client), ② son application aux **deux** constructeurs d'embed avec les
 * pictos, ③ la lecture effective de la classe du profil dans les requêtes qui alimentent
 * les écrans, ④ le passage du select Discord à la fenêtre « Mes personnages ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { matchDofusClass, normalizeDofusClass, resolveEffectiveClass } from "@/lib/dofus-assets";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SERVICE_CODE = codeOnly(readFileSync("src/server/calendar-service.ts", "utf8"));
const ACTIONS_CODE = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));
const ROUTE_CODE = codeOnly(readFileSync("src/app/api/discord/interactions/route.ts", "utf8"));
const MODAL_CODE = codeOnly(readFileSync("src/components/calendar/event-detail-modal.tsx", "utf8"));

describe("resolveEffectiveClass — classe choisie, sinon celle du profil", () => {
    it("privilégie la classe choisie à l'inscription", () => {
        expect(resolveEffectiveClass("Cra", "Iop")).toBe("Cra");
    });

    it("replie sur la classe du profil quand l'inscription est vide", () => {
        expect(resolveEffectiveClass(null, "Iop")).toBe("Iop");
        expect(resolveEffectiveClass("", "Iop")).toBe("Iop");
        expect(resolveEffectiveClass("   ", "Iop")).toBe("Iop");
        expect(resolveEffectiveClass(undefined, "Iop")).toBe("Iop");
    });

    it("canonise id et nom, accents et casse compris", () => {
        expect(resolveEffectiveClass("cra", null)).toBe("Cra");
        expect(resolveEffectiveClass(null, "feca")).toBe("Féca");
        expect(resolveEffectiveClass(null, "FECA")).toBe("Féca");
        expect(resolveEffectiveClass(null, "  Xélor ")).toBe("Xélor");
    });

    it("conserve une valeur inconnue du référentiel (jamais perdue)", () => {
        expect(resolveEffectiveClass("Doudou", "Iop")).toBe("Doudou");
    });

    it("rend null quand rien n'est renseigné (« Sans classe »)", () => {
        expect(resolveEffectiveClass(null, null)).toBeNull();
        expect(resolveEffectiveClass(undefined, undefined)).toBeNull();
        expect(resolveEffectiveClass("", "")).toBeNull();
    });

    it("s'appuie sur la même source que le référentiel de classes", () => {
        expect(normalizeDofusClass("  Féca ")).toBe("feca");
        expect(matchDofusClass("xelor")).toBe("Xélor");
        expect(matchDofusClass("Sans classe")).toBeNull();
        expect(matchDofusClass(null)).toBeNull();
    });
});

describe("Embed calendrier — pictos de classe + repli profil", () => {
    it("les DEUX constructeurs (publication + rafraîchissement) appliquent la règle", () => {
        // Bornes robustes : on coupe APRÈS chaque appel (un `})` peut apparaître dans un
        // template literal, ex. `${registered.length})`).
        const segments = SERVICE_CODE.split("buildClassDispatchFields(dispatchEntries, {").slice(1);
        expect(segments.length, "publication ET rafraîchissement").toBe(2);
        for (const segment of segments) {
            expect(
                segment.slice(0, 400),
                "les pictos de classe doivent être passés au regroupement"
            ).toMatch(/emoji: emo,/);
        }

        expect(SERVICE_CODE.match(/classe: effectiveClass\(p\)/g)?.length).toBe(2);
        expect(
            SERVICE_CODE.match(/resolveEffectiveClass\(p\.classe, p\.user\?\.profiles\?\.\[0\]\?\.classe\)/g)?.length
        ).toBe(2);
        // Un seul chargement d'emojis par embed (pas de N+1 sur les inscrits).
        expect(SERVICE_CODE.match(/await loadEmojiResolver\(\)/g)?.length).toBe(2);
    });

    it("la file d'attente affiche la classe résolue elle aussi (cohérence des badges)", () => {
        expect(SERVICE_CODE.match(/const classe = effectiveClass\(p\);/g)?.length).toBe(2);
    });
});

describe("Requêtes — la classe du profil doit être lue", () => {
    it("le service (publication + rafraîchissement) sélectionne `classe`", () => {
        expect(SERVICE_CODE.match(/select: \{ discordNickname: true, classe: true \}/g)?.length).toBe(2);
    });

    it("le dashboard (liste + fiche de l'événement) sélectionne `classe`", () => {
        expect(ACTIONS_CODE.match(/select: \{ discordNickname: true, classe: true \}/g)?.length).toBe(2);
    });
});

describe("Discord — le menu classe ouvre « Mes personnages »", () => {
    it("la fenêtre est pré-remplie depuis le profil (classe + secondaires)", () => {
        expect(ROUTE_CODE).toMatch(/custom_id: `calendar:class-apply:\$\{entityId\}`/);
        expect(ROUTE_CODE, "aucun nouveau bouton : le select existant reste l'entrée").not.toMatch(
            /calendar:class-join/
        );
        expect(ROUTE_CODE).toMatch(/classeSecondaires: true/);
        expect(ROUTE_CODE).toMatch(/value: mainClass/);
    });

    it("le retour applique la classe : mise à jour si inscrit, sinon inscription", () => {
        const start = ROUTE_CODE.indexOf('else if (prefix === "calendar" && action === "class-apply")');
        expect(start, "branche `calendar:class-apply` introuvable").toBeGreaterThan(-1);
        const end = ROUTE_CODE.indexOf('} else if (prefix === "dj" && action === "join")', start);
        const branch = ROUTE_CODE.slice(start, end === -1 ? undefined : end);

        expect(branch).toMatch(/updateRegistrationClass\(guild_id, entityId, account\.userId, matchedClass\)/);
        expect(branch).toMatch(
            /processRegistration\(guild_id, entityId, account\.userId, \{ classe: matchedClass \}\)/
        );
        expect(branch, "RBAC identique aux boutons").toMatch(
            /isDiscordPrefixAuthorized\(prefix, guild_id, member\.user\.id\)/
        );
    });

    it("l'ancien select direct n'applique plus la classe à l'aveugle", () => {
        // Sous-branche `calendar` du menu classe : du test de préfixe jusqu'à la sortie
        // « menu non pris en charge » qui la referme (le type 9 est DANS cette borne).
        const start = ROUTE_CODE.indexOf('if (prefix === "calendar") {');
        expect(start, "sous-branche `calendar` du menu classe introuvable").toBeGreaterThan(-1);
        const end = ROUTE_CODE.indexOf("Menu non pris en charge ici", start);
        const branch = ROUTE_CODE.slice(start, end === -1 ? undefined : end);
        expect(branch, "le clic du select doit ouvrir une fenêtre").toMatch(/type: 9/);
        expect(branch, "plus d'application directe depuis le select").not.toMatch(/updateRegistrationClass\(/);
    });
});

describe("Dashboard — changer ma classe suit la même règle serveur", () => {
    it("l'action relit le contexte, borne la classe et refuse l'anonyme", () => {
        expect(ACTIONS_CODE).toMatch(
            /export async function updateMyRegistrationClass\(guildId: string, eventId: string, classe: string\)/
        );
        expect(ACTIONS_CODE).toMatch(
            /if \(!ctx\.isAuthenticated\) return \{ success: false, error: "Non authentifié" \}/
        );
        expect(ACTIONS_CODE).toMatch(/if \(!ctx\.isMember\) return \{ success: false, error: "Membre requis" \}/);
        expect(ACTIONS_CODE).toMatch(
            /const \{ matchDispatchClass \} = await import\("@\/server\/discord-class-dispatch"\)/
        );
        expect(ACTIONS_CODE, "jamais d'écriture aveugle d'une classe inconnue").toMatch(
            /if \(matched === null\) return \{ success: false, error: "Classe inconnue" \}/
        );
        expect(ACTIONS_CODE).toMatch(/updateRegistrationClass\(guildId, eventId, ctx\.id!, matched\)/);
    });

    it("la fiche affiche la classe résolue (inscription → profil)", () => {
        expect(MODAL_CODE).toMatch(
            /resolveEffectiveClass\(participant\.classe, participant\.user\.profiles\?\.\[0\]\?\.classe\)/
        );
        expect(MODAL_CODE, "plus de classe muette sur la ligne d'un inscrit").not.toMatch(
            /classe=\{participant\.classe\}/
        );
    });
});
