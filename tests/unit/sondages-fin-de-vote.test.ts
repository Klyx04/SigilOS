import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatPollEnd } from "@/lib/poll-format";

/**
 * Sondages — **fin de vote** et réglages du vote, sur les 3 surfaces.
 *
 * 🐞 Retour user du 13/10/2026 (capture de l'embed Discord) : « réapplique ça dans les sondages,
 * on ne le voit plus dans l'embed » puis « indique choix multiple et … en direct, date de fin ».
 *
 * 🔍 Mesure : l'embed Discord portait bien les trois informations (`**📊 Choix :**`, `**Expire**`,
 * `**Votes multiples**`), mais côté **app** :
 *   ① les réglages du vote étaient **cachés dans une infobulle** (icône `Lock`/`Users`) ;
 *   ② la **fin de vote** n'apparaissait **que pour un sondage actif** (`poll.expiresAt && isActive`)
 *      et **à l'heure près** (« Fin 21:30 », sans date) ⇒ invisible dès la clôture ;
 *   ③ le relatif était recopié **quatre fois** (fiche, carte, liste ×2, embed).
 *
 * 🛡️ Ce que ce test verrouille : une **règle unique** (`src/lib/poll-format.ts`), des réglages
 * **dits**, une fin de vote **toujours** affichée (date + heure + écart), et l'embed Discord
 * inchangé (référence visuelle de l'utilisateur). Lecture seule.
 */

const DETAIL = "src/components/sondages/poll-detail.tsx";
const CARD = "src/components/sondages/poll-card.tsx";
const ACTIONS = "src/server/actions/poll-actions.ts";
/**
 * L'embed ne vit plus dans le fichier d'actions : il a été **extrait** dans
 * `src/server/polls/publish.ts` pour être partagé avec le module « Sondages
 * programmés » (une seule fabrique, un seul embed). Le verrou suit la source de
 * vérité — il ne s'affaiblit pas, il change de fichier.
 */
const PUBLISH = "src/server/polls/publish.ts";

describe("sondages — règle unique de fin de vote", () => {
    const now = new Date("2026-10-13T12:00:00.000Z");

    it("rend une échéance absolue (date + heure), quel que soit le fuseau", () => {
        const end = formatPollEnd("2026-10-16T12:00:00.000Z", now);
        expect(end).not.toBeNull();
        expect(end?.absolute).toContain("2026");
        expect(end?.absolute).toContain("à");
    });

    it("dit l'écart dans le futur, au singulier comme au pluriel", () => {
        expect(formatPollEnd("2026-10-16T12:00:00.000Z", now)?.relative).toBe("dans 3 jours");
        expect(formatPollEnd("2026-10-13T13:00:00.000Z", now)?.relative).toBe("dans 1 heure");
        expect(formatPollEnd("2026-10-12T12:00:00.000Z", now)?.relative).toBe("il y a 1 jour");
        expect(formatPollEnd("2026-08-13T12:00:00.000Z", now)?.relative).toBe("il y a 2 mois");
    });

    it("marque l'échéance passée et le « à l'instant »", () => {
        expect(formatPollEnd("2026-10-12T12:00:00.000Z", now)?.expired).toBe(true);
        expect(formatPollEnd("2026-10-16T12:00:00.000Z", now)?.expired).toBe(false);
        expect(formatPollEnd("2026-10-13T12:00:20.000Z", now)?.relative).toBe("à l'instant");
    });

    it("ne fabrique rien sans date (et ignore une date invalide)", () => {
        expect(formatPollEnd(null, now)).toBeNull();
        expect(formatPollEnd(undefined, now)).toBeNull();
        expect(formatPollEnd("pas une date", now)).toBeNull();
    });
});

describe("sondages — les deux surfaces consomment la règle", () => {
    it("la fiche affiche la fin de vote MÊME clôturée (plus de garde `isActive`)", () => {
        const detail = readFileSync(DETAIL, "utf8");
        expect(detail).toContain("formatPollEnd");
        expect(detail).toContain("Fin de vote");
        expect(detail).not.toContain("poll.expiresAt && isActive");
    });

    it("la fiche dit les réglages du vote au lieu de les cacher", () => {
        const detail = readFileSync(DETAIL, "utf8");
        expect(detail).toContain("Choix multiple");
        expect(detail).toContain("Choix unique");
        expect(detail).toContain("Votes anonymes");
        expect(detail).toContain("En direct");
    });

    it("la carte n'a plus de compteur maison", () => {
        const card = readFileSync(CARD, "utf8");
        expect(card).toContain("formatPollEnd");
        expect(card).not.toContain("function getTimeLeft");
        expect(card).toContain("Choix multiple");
    });

    it("l'embed Discord garde les trois informations de la capture", () => {
        const publish = readFileSync(PUBLISH, "utf8");
        expect(publish).toContain("**📊 Choix :**");
        expect(publish).toContain("**Expire**");
        expect(publish).toContain("**Votes multiples**");
        expect(publish).toContain("**Vote unique**");
        // Et l'action du module Sondages consomme bien cette fabrique unique.
        expect(readFileSync(ACTIONS, "utf8")).toContain("@/server/polls/publish");
    });
});
