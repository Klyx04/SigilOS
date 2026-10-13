/**
 * Sondages — **réglages du vote** partagés par les deux modales de création.
 *
 * 🛡️ Ce que ce test protège :
 * ① la règle pure : les durées proposées sont exactement 24 h / 48 h / 7 j / 30 j
 *    et restent **dans les bornes serveur** (`MIN_DURATION_HOURS` ..
 *    `MAX_DURATION_HOURS`) — un preset hors bornes serait un bug affiché ;
 * ② l'**honnêteté** de l'affichage : une valeur courante hors presets (défaut de
 *    guilde à 12 h, ancien créneau enregistré à 30 h) apparaît comme un choix à
 *    part entière au lieu de disparaître — l'écran n'affiche jamais « expiration
 *    activée » sans durée surlignée ;
 * ③ la fin du **champ libre** côté staff : la durée se choisit d'un clic, et
 *    `null` reste la seule façon de dire « sans date de fin » ;
 * ④ l'**unicité** : un seul composant sert les deux modales (zéro duplication) et
 *    l'anonymat du module staff n'a pas été perdu dans l'extraction ;
 * ⑤ aucun `console.log` dans les surfaces neuves.
 *
 * Lecture seule : code source + fonctions pures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    DURATION_PRESETS,
    MAX_DURATION_HOURS,
    MIN_DURATION_HOURS,
    durationChoices,
} from "@/lib/polls/scheduling";

const SETTINGS_UI = "src/components/sondages/poll-vote-settings.tsx";
const CREATOR = "src/components/sondages/poll-creator.tsx";
const STAFF_FORM = "src/components/sondages/programmes/scheduled-poll-form.tsx";

const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("sondages — durées de vote proposées (règle pure)", () => {
    it("quatre durées, toutes dans les bornes du serveur", () => {
        expect(DURATION_PRESETS.map((preset) => preset.hours)).toEqual([24, 48, 168, 720]);
        expect(DURATION_PRESETS.map((preset) => preset.label)).toEqual(["24h", "48h", "7j", "30j"]);
        for (const preset of DURATION_PRESETS) {
            expect(preset.hours, preset.label).toBeGreaterThanOrEqual(MIN_DURATION_HOURS);
            expect(preset.hours, preset.label).toBeLessThanOrEqual(MAX_DURATION_HOURS);
        }
    });

    it("une valeur hors presets reste proposée (jamais remplacée en silence)", () => {
        // Le défaut de guilde est libre : 12 h doit rester visible et sélectionnable.
        expect(durationChoices(12).map((choice) => choice.hours)).toEqual([12, 24, 48, 168, 720]);
        expect(durationChoices(12)[0]).toMatchObject({ hours: 12, label: "12h" });
        // Une valeur déjà proposée n'est jamais dupliquée (48 h reste 48 h).
        expect(durationChoices(48).filter((choice) => choice.hours === 48)).toHaveLength(1);
        expect(durationChoices(48).map((choice) => choice.hours)).toEqual([24, 48, 168, 720]);
    });

    it("sans durée, ou hors bornes, il ne reste que les presets", () => {
        for (const empty of [null, undefined, Number.NaN]) {
            expect(durationChoices(empty).map((choice) => choice.hours)).toEqual([24, 48, 168, 720]);
        }
        // 99 999 h est ramené au plafond (720 = « 30j ») : un preset, pas un 5ᵉ choix.
        expect(durationChoices(99999).map((choice) => choice.hours)).toEqual([24, 48, 168, 720]);
        // 12,4 h est arrondi : jamais un libellé « 12.4h ».
        expect(durationChoices(12.4)[0]).toMatchObject({ hours: 12, label: "12h" });
    });
});

describe("sondages — un seul composant de réglages pour les deux modales", () => {
    it("les deux modales consomment `PollVoteSettings`", () => {
        expect(codeOnly(CREATOR)).toContain("PollVoteSettings");
        expect(codeOnly(STAFF_FORM)).toContain("PollVoteSettings");
        const ui = codeOnly(SETTINGS_UI);
        expect(ui).toContain('"use client"');
        expect(ui).toContain("export function PollVoteSettings");
        // Les durées viennent de la règle partagée, jamais d'une liste locale.
        expect(ui).toContain("durationChoices");
        expect(ui).toContain("Lien externe");
        expect(ui).not.toContain("console.log");
    });

    it("aucune modale ne recopie les durées ni leurs libellés", () => {
        for (const path of [CREATOR, STAFF_FORM]) {
            const source = codeOnly(path);
            expect(source, path).not.toContain("⏳");
            expect(source, path).not.toContain('{ value: 24');
            expect(source, path).not.toContain("MAX_EXPIRY_HOURS = 720");
        }
    });

    it("⛔ l'anonymat est RETIRÉ : aucune case, aucun état dans les deux modales", () => {
        // Le composant partagé ne porte plus la moindre trace du réglage…
        const ui = codeOnly(SETTINGS_UI);
        expect(ui).not.toContain("isAnonymous");
        expect(ui).not.toContain("Votes anonymes");
        expect(ui).not.toContain("Votants masqués");
        // … et aucune des deux modales ne peut l'activer.
        expect(codeOnly(CREATOR)).not.toContain("isAnonymous");
        expect(codeOnly(STAFF_FORM)).not.toContain("isAnonymous");
    });

    it("le staff ne saisit plus un nombre d'heures à la main", () => {
        const form = codeOnly(STAFF_FORM);
        expect(form).not.toContain("Durée du vote une fois publié");
        expect(form).not.toMatch(/type="number"[\s\S]{0,200}durationHours/);
        // Rien de saisi ⇒ `null` = sondage sans date de fin (fermé à 30 j par le cron).
        expect(form).toContain("durationHours: hasExpiry ? expiryHours : null");
        // Le défaut est la première durée proposée, pas un « 24 » recopié.
        expect(form).toContain("DURATION_PRESETS[0].hours");
    });
});

/**
 * ⛔ Anonymat retiré (14/10/2026, demande du propriétaire de guilde) — le verrou
 * protège les **deux** moitiés de la décision :
 * ① plus rien ne peut l'activer (champ absent des schémas `.strict()`, serveur
 *    qui écrit `false`, aucune trace dans les modales) ;
 * ② la **lecture** des sondages **anciens** reste intacte : tant que les colonnes
 *    existent, un sondage anonyme d'avant le retrait continue de masquer ses
 *    votants (on ne « nettoie » pas une garde de confidentialité par réflexe).
 */
describe("sondages — anonymat retiré (écriture) et anciens sondages préservés (lecture)", () => {
    const POLL_ACTIONS = "src/server/actions/poll-actions.ts";
    const SCHED_ACTIONS = "src/server/actions/scheduled-poll-actions.ts";
    const CORE = "src/server/scheduled-polls-core.ts";
    const PUBLISH = "src/server/polls/publish.ts";

    it("les schémas d'entrée n'acceptent plus le champ (`.strict()`)", () => {
        const polls = codeOnly(POLL_ACTIONS);
        expect(polls).not.toContain("isAnonymous: z.boolean()");
        const scheduled = codeOnly(SCHED_ACTIONS);
        expect(scheduled).not.toContain("isAnonymous: z.boolean()");
    });

    it("le serveur écrit `false` : création, modification, publication et occurrence suivante", () => {
        for (const path of [POLL_ACTIONS, SCHED_ACTIONS, CORE]) {
            const source = codeOnly(path);
            expect(source, path).toContain("isAnonymous: false");
            expect(source, path).not.toContain("isAnonymous: data.isAnonymous");
            expect(source, path).not.toContain("isAnonymous: slot.isAnonymous");
        }
    });

    it("la lecture des anciens sondages reste masquante (aucune donnée révélée)", () => {
        // Gardes de masquage conservées : elles lisent des lignes d'avant le retrait.
        expect(codeOnly(POLL_ACTIONS)).toContain("if (!poll.isAnonymous)");
        expect(codeOnly(PUBLISH)).toContain("if (poll.isAnonymous)");
        expect(codeOnly(PUBLISH)).toContain("if (!poll.isAnonymous && o.votes");
    });
});
