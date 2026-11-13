/**
 * « Stand-by » d'un groupe (30/10/2026) — règle **pure**.
 *
 * Ce que ces cas verrouillent :
 *  ① une pause **illisible** compte quand même comme une pause (fail-closed : pas de ping) ;
 *  ② une valeur écrite vient **toujours** de `buildStandBy` (pseudo borné, `User.id` vérifié) ;
 *  ③ l'embed dit qui a suspendu et quand, sans jamais inventer d'horodatage ;
 *  ④ seul le créateur ou un admin peut basculer l'état.
 */

import { describe, it, expect } from "vitest";
import {
    buildStandBy,
    canToggleStandBy,
    isStandByActive,
    readStandBy,
    standByAuthorName,
    standByButtonLabel,
    standByEmbedLine,
    standBySince,
    STAND_BY_MAX_NAME,
} from "@/lib/group-standby";

const AT = new Date("2026-10-30T18:24:00.000Z");
const VALID = { at: AT, userId: "usr_abc123", name: "Klyx" };

describe("isStandByActive — fail-closed", () => {
    it("une colonne NULL (ou absente) signifie « actif »", () => {
        expect(isStandByActive(null)).toBe(false);
        expect(isStandByActive(undefined)).toBe(false);
    });

    it("toute valeur non nulle compte comme une pause, même illisible", () => {
        // Le cas qui protège : un `standBy` corrompu en base ne doit JAMAIS réveiller le cron.
        expect(isStandByActive({})).toBe(true);
        expect(isStandByActive({ at: "pas-une-date" })).toBe(true);
        expect(isStandByActive("n'importe quoi")).toBe(true);
        expect(isStandByActive(buildStandBy(VALID))).toBe(true);
    });
});

describe("buildStandBy — la seule écriture acceptée", () => {
    it("normalise l'auteur et fige l'instantané en ISO", () => {
        expect(buildStandBy(VALID)).toEqual({
            at: "2026-10-30T18:24:00.000Z",
            userId: "usr_abc123",
            name: "Klyx",
        });
    });

    it("refuse un auteur inexploitable (jamais de pause anonyme)", () => {
        expect(buildStandBy({ ...VALID, userId: "" })).toBeNull();
        expect(buildStandBy({ ...VALID, userId: "  " })).toBeNull();
        expect(buildStandBy({ ...VALID, userId: "avec espace" })).toBeNull();
        expect(buildStandBy({ ...VALID, at: new Date("nope") })).toBeNull();
    });

    it("rejette un identifiant de contrôle à CHAQUE appel (pas seulement au premier)", () => {
        // Régression : avec un `RegExp` global, `lastIndex` survivait au 1er match et le
        // 2ᵉ identifiant invalide passait.
        expect(buildStandBy({ ...VALID, userId: "a\u0000" })).toBeNull();
        expect(buildStandBy({ ...VALID, userId: "b\u0000" })).toBeNull();
        expect(buildStandBy({ ...VALID, userId: "usr_abc123" })).not.toBeNull();
    });

    it("replie un pseudo vide sur « un membre » et borne la longueur", () => {
        expect(buildStandBy({ ...VALID, name: "" })?.name).toBe("un membre");
        expect(buildStandBy({ ...VALID, name: "  " })?.name).toBe("un membre");
        expect(buildStandBy({ ...VALID, name: "x".repeat(200) })?.name).toHaveLength(STAND_BY_MAX_NAME);
    });

    it("compacte les espaces et retire les caractères de contrôle", () => {
        expect(buildStandBy({ ...VALID, name: "  Klyx\n\t le  Retour  " })?.name).toBe("Klyx le Retour");
        expect(buildStandBy({ ...VALID, name: "Klyx\u0000" })?.name).toBe("Klyx");
    });
});

describe("readStandBy — forme stricte, jamais d'exception", () => {
    it("relit ce que `buildStandBy` a écrit", () => {
        const written = buildStandBy(VALID);
        expect(readStandBy(written)).toEqual(written);
    });

    it("refuse tout ce qui n'est pas un objet plat complet", () => {
        expect(readStandBy(null)).toBeNull();
        expect(readStandBy(undefined)).toBeNull();
        expect(readStandBy("2026-10-30")).toBeNull();
        expect(readStandBy([VALID])).toBeNull();
        expect(readStandBy({})).toBeNull();
        expect(readStandBy({ at: AT.toISOString(), userId: "usr_abc123" })).toBeNull();
        expect(readStandBy({ at: "pas-une-date", userId: "usr_abc123", name: "Klyx" })).toBeNull();
        expect(readStandBy({ at: AT.toISOString(), userId: "usr abc", name: "Klyx" })).toBeNull();
    });

    it("expose l'auteur et l'instant, ou `null` si la valeur est illisible", () => {
        expect(standByAuthorName(buildStandBy(VALID))).toBe("Klyx");
        expect(standByAuthorName({})).toBeNull();
        expect(standBySince(buildStandBy(VALID))?.toISOString()).toBe(AT.toISOString());
        expect(standBySince({ at: "nope", userId: "x", name: "y" })).toBeNull();
    });
});

describe("standByEmbedLine — ce que le Discord affiche", () => {
    it("rien quand le groupe est actif", () => {
        expect(standByEmbedLine(null)).toBeNull();
    });

    it("nomme l'auteur et horodate avec un timestamp Discord relatif", () => {
        const line = standByEmbedLine(buildStandBy(VALID));
        const startTs = Math.floor(AT.getTime() / 1000);
        expect(line).toContain("Mis en stand-by par Klyx");
        expect(line).toContain(`<t:${startTs}:R>`);
    });

    it("une valeur corrompue affiche « auteur inconnu » et n'invente pas de date", () => {
        const line = standByEmbedLine({ foo: "bar" });
        expect(line).toBe("⏸️ **Mis en stand-by** — auteur inconnu");
        expect(line).not.toContain("<t:");
    });

    it("le bouton bascule de libellé selon l'état", () => {
        expect(standByButtonLabel(null)).toBe("Stand-by");
        expect(standByButtonLabel(buildStandBy(VALID))).toBe("Reprendre");
    });
});

describe("canToggleStandBy — créateur ou administrateur, rien d'autre", () => {
    it("matrice complète", () => {
        expect(canToggleStandBy({ isCreator: true, isAdmin: false })).toBe(true);
        expect(canToggleStandBy({ isCreator: false, isAdmin: true })).toBe(true);
        expect(canToggleStandBy({ isCreator: false, isAdmin: false })).toBe(false);
        expect(canToggleStandBy({ isCreator: true, isAdmin: true })).toBe(true);
    });
});
