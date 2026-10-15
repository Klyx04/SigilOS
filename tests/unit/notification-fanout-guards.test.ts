/**
 * Notifications — verrous de non-régression du lot « fan-out, rétention, interrupteurs »
 * (15/10/2026).
 *
 * **Mesure d'origine** (base bêta : 2 guildes, 126 membres, 11 722 lignes `Notification`) :
 * **10 767 lignes — 92 % de la table —** venaient de **deux** fan-outs (une ligne par membre
 * actif) pour des informations **déjà affichées** ailleurs et **impossibles à couper** (aucune
 * préférence `SYSTEM`) :
 *   · 9 443 « ✨ Arrivée d'un nouveau membre » (à chaque arrivée) ;
 *   · 1 324 « 🎯 Nouvel objectif hebdomadaire » (à chaque publication de semaine).
 * Et **66 lignes sur 11 722** seulement étaient lues ⇒ la purge « lues > 30 j » ne couvrait que
 * **0,56 %** de la table : elle ne pouvait pas mordre.
 *
 * Ces gardes tiennent la correction dans le temps : un `createNotification` remis dans une
 * boucle `userProfile.findMany` ramènerait le défaut **en silence** (aucun test de
 * comportement ne le verrait — c'est une propriété de **forme** du code).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GUILD_ACTIVITY_KINDS, buildGuildActivityCopy } from "@/lib/guild-activity";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

/**
 * Retire commentaires de bloc et de ligne avant de chercher un motif : les commentaires de ce lot
 * **citent** les titres retirés (« 🎯 Nouvel objectif hebdomadaire », 1 324 lignes mesurées) pour
 * la traçabilité de la mesure — un garde qui lit le brut les prendrait pour du code. Patron déjà
 * utilisé par les gardes du dépôt (`god-market-logs-tab.test.ts`, `missions-member-deslop.test.ts`…).
 */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("les deux fan-outs par membre sont retirés", () => {
    it("l'arrivée d'un membre ne crée plus de notification par membre", () => {
        const code = codeOnly(read("src/server/actions/onboarding-actions.ts"));

        expect(code).not.toContain("Arrivée d'un nouveau membre");
        expect(code, "aucune notification par membre dans l'accueil").not.toContain("createNotification");
        // L'annonce reste portée par le flux : la ligne `GuildActivity` NEW_MEMBER est intacte.
        expect(code).toContain("NEW_MEMBER");
    });

    it("la publication des objectifs passe par UNE ligne de flux (plus de copie par membre)", () => {
        const code = codeOnly(read("src/server/actions/mission-actions.ts"));

        expect(code).not.toContain("Nouvel objectif hebdomadaire");
        // La boucle de notification par membre a disparu : plus de `map` sur les profils ACTIFS.
        expect(code, "plus de fan-out sur les profils actifs").not.toMatch(
            /activeProfiles\.map\([^)]*createNotification/s
        );
        // Le remplacement existe bien : une seule ligne, avec l'interrupteur `objectifs`.
        expect(code).toContain('kind: "objectifs"');
    });
});

describe("rétention des notifications : la table décroît enfin", () => {
    it("le nettoyage quotidien purge AUSSI les non lues (> 90 j), par lots", () => {
        const source = read("src/workers/metamob-worker.ts");

        // L'ancienne purge (lues > 30 j) est conservée…
        expect(source).toContain("read: true");
        // …et la nouvelle borne le reste : les non lues meurent au bout de trois mois.
        expect(source).toMatch(/read: false, createdAt: \{ lt: unreadCutoff \}/);
        expect(source, "purge par lots, pas un deleteMany global").toContain("BATCH_SIZE");
        expect(source, "nombre de passes borné (pas de boucle infinie sur la prod)").toContain("MAX_PASSES");
    });

    it("les deux fan-outs retirés sont nommés dans le code (traçabilité de la mesure)", () => {
        expect(read("src/server/actions/onboarding-actions.ts")).toContain("9 443");
        expect(read("src/server/actions/mission-actions.ts")).toContain("1 324");
    });
});

describe("les trois interrupteurs morts sont branchés", () => {
    it("« Succès validés » émet sur les DEUX chemins de validation (dashboard ET Discord)", () => {
        expect(read("src/server/actions/profile-actions.ts")).toContain('kind: "succes"');
        expect(read("src/server/actions/discord-validation-actions.ts")).toContain('kind: "succes"');
    });

    it("« Agenda » émet à la création d'un événement (saisie manuelle ET import Metamob)", () => {
        const code = codeOnly(read("src/server/actions/calendar-actions.ts"));
        const occurrences = code.match(/kind: "events"/g) ?? [];
        expect(occurrences.length).toBe(2);
    });

    it("« Ladder succès » émet depuis la passe ladder, qui seule connaît l'avant/après", () => {
        expect(read("src/app/api/cron/ladder-sync/route.ts")).toContain("emitLadderTopEntry");
        expect(read("src/server/ladder-milestones.ts")).toContain("resolveLadderTopEntry");
    });
});

describe("copie des annonces de flux", () => {
    it("CHAQUE type a une copie non vide (aucun interrupteur ne mène à un message muet)", () => {
        for (const kind of GUILD_ACTIVITY_KINDS) {
            const copy = buildGuildActivityCopy({ kind, memberName: "wylan", detail: "Dofus Émeraude", points: 1000 });
            expect(copy.title.trim().length, kind).toBeGreaterThan(0);
            expect(copy.message.trim().length, kind).toBeGreaterThan(10);
        }
    });

    it("l'annonce des objectifs nomme l'auteur et la semaine", () => {
        const copy = buildGuildActivityCopy({ kind: "objectifs", memberName: "wylan", detail: "12" });
        expect(copy.message).toContain("wylan");
        expect(copy.message).toContain("12");
    });
});
