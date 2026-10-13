/**
 * Sondages — **filtre de participation** (rôle Discord + recherche membre) et
 * **harmonisation des en-têtes / modales**, verrou du lot UI.
 *
 * 🛡️ Ce que ce test protège :
 * ① la **règle pure** : recherche insensible aux accents (pseudos Dofus), filtre
 *    par rôle, ordre conservé, et surtout le **fail-soft** — sans données de
 *    rôles Discord, on ne filtre **rien** au lieu d'afficher des listes vides
 *    (« personne n'a ce rôle » serait un mensonge) ;
 * ② le **câblage** : un seul filtre pour les deux listes (votants ET non-votants),
 *    jamais sur un sondage anonyme (il recouperait des identités masquées) ;
 * ③ les **avatars cliquables** vers la fiche profil en lecture seule, sur les
 *    deux listes ;
 * ④ l'**harmonisation** des trois boutons d'en-tête (même hauteur/padding/rayon)
 *    en gardant l'accent sur l'action principale, et la **modale responsive**
 *    (les libellés de thématique ne débordent plus de leur tuile) ;
 * ⑤ le **module staff** : mêmes règles (en-tête outillé, bouton à la même
 *    taille, aucun `console.log`).
 *
 * Lecture seule : code source + fonctions pures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { countFilterableRoles, filterPollMembers, normalizeSearch } from "@/lib/polls/member-filter";

const DETAIL = "src/components/sondages/poll-detail.tsx";
const FILTER_UI = "src/components/sondages/poll-participation-filter.tsx";
const FILTER_LIB = "src/lib/polls/member-filter.ts";
const ACTIONS = "src/server/actions/poll-actions.ts";
const CREATOR = "src/components/sondages/poll-creator.tsx";
const HELP = "src/components/doc/module-help-actions.tsx";
const SONDAGES_PAGE = "src/app/dashboard/[guildId]/sondages/page.tsx";
const STAFF_PAGE = "src/app/dashboard/[guildId]/admin/sondages-programmes/page.tsx";
const STAFF_FORM = "src/components/sondages/programmes/scheduled-poll-form.tsx";
const STAFF_BOARD = "src/components/sondages/programmes/scheduled-poll-board.tsx";

const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const member = (id: string, name: string) => ({ id, name });

describe("sondages — filtre de participation (règle pure)", () => {
    const members = [member("p1", "Azäël"), member("p2", "Bob"), member("p3", "Zoé")];
    const rolesByProfileId = { p1: ["r-admin"], p2: ["r-membre"], p3: ["r-membre", "r-raider"] };

    it("recherche insensible à la casse ET aux accents", () => {
        expect(normalizeSearch("  Azäël ")).toBe("azael");
        expect(filterPollMembers(members, { query: "AZAEL" }).map((m) => m.id)).toEqual(["p1"]);
        expect(filterPollMembers(members, { query: "zoé" }).map((m) => m.id)).toEqual(["p3"]);
        expect(filterPollMembers(members, { query: "o" }).map((m) => m.id)).toEqual(["p2", "p3"]);
    });

    it("filtre par rôle Discord, et conserve l'ORDRE d'entrée", () => {
        expect(filterPollMembers(members, { roleId: "r-membre", rolesByProfileId }).map((m) => m.id)).toEqual(["p2", "p3"]);
        expect(filterPollMembers(members, { roleId: "r-raider", rolesByProfileId }).map((m) => m.id)).toEqual(["p3"]);
        expect(filterPollMembers(members, { roleId: "r-inexistant", rolesByProfileId })).toEqual([]);
    });

    it("combine recherche et rôle", () => {
        expect(filterPollMembers(members, { query: "b", roleId: "r-membre", rolesByProfileId }).map((m) => m.id)).toEqual(["p2"]);
        expect(filterPollMembers(members, { query: "z", roleId: "r-membre", rolesByProfileId }).map((m) => m.id)).toEqual(["p3"]);
    });

    it("🔒 fail-soft : sans données de rôles, un rôle sélectionné ne vide JAMAIS la liste", () => {
        // Discord indisponible (bot sans l'intent, erreur, cache vide) : on ne
        // prétend pas « personne n'a ce rôle ».
        expect(filterPollMembers(members, { roleId: "r-membre", rolesByProfileId: {} }).map((m) => m.id))
            .toEqual(["p1", "p2", "p3"]);
        expect(filterPollMembers(members, { roleId: "r-membre", rolesByProfileId: null }).map((m) => m.id))
            .toEqual(["p1", "p2", "p3"]);
    });

    it("aucun filtre ⇒ liste intacte", () => {
        expect(filterPollMembers(members, {})).toEqual(members);
        expect(filterPollMembers([], { query: "x" })).toEqual([]);
    });

    it("compte les rôles réellement filtrables (0 = contrôle inutile)", () => {
        expect(countFilterableRoles(rolesByProfileId)).toBe(3);
        expect(countFilterableRoles({ p1: ["a", "a"], p2: ["b"] })).toBe(2);
        expect(countFilterableRoles({})).toBe(0);
        expect(countFilterableRoles(null)).toBe(0);
    });

    it("la règle ne dépend d'aucune I/O (importable côté client)", () => {
        const source = codeOnly(FILTER_LIB);
        expect(source).not.toContain("prisma");
        expect(source).not.toContain("server-only");
        expect(source).not.toContain("console.log");
    });
});


describe("sondages — câblage du filtre (un seul état, deux listes)", () => {
    it("le filtre s'applique aux votants ET aux non-votants, avec la même règle", () => {
        const detail = codeOnly(DETAIL);
        expect(detail).toContain("filterPollMembers");
        const occurrences = detail.match(/filterPollMembers/g)?.length ?? 0;
        expect(occurrences).toBeGreaterThanOrEqual(2);
        expect(detail).toContain("visibleVotesByOption");
        expect(detail).toContain("visibleNonVoters");
        expect(detail).toContain("<PollParticipationFilter");
    });

    it("jamais de filtre sur un sondage anonyme (les identités y sont masquées)", () => {
        const detail = codeOnly(DETAIL);
        expect(detail).toContain("if (poll.isAnonymous) return");
        expect(detail).toMatch(/\{!poll\.isAnonymous && \(/);
    });

    it("les avatars ouvrent la fiche profil en LECTURE SEULE (les deux listes)", () => {
        const detail = codeOnly(DETAIL);
        expect(detail).toContain("/dashboard/${guildId}/members/${profileId}");
        expect(detail).toContain("href={profileHref(");
        expect(detail).toContain("href={profileHref(member.id)}");
    });

    it("l'action des filtres est gardée (permission) et fail-soft", () => {
        const actions = codeOnly(ACTIONS);
        expect(actions).toContain("getPollParticipationFilters");
        expect(actions).toContain("ctx.canViewPolls");
        expect(actions).toContain("listGuildMembers");
        // Fail-soft : Discord en échec ⇒ listes complètes, jamais vides.
        expect(actions).toContain("const empty: PollParticipationFilters = { roles: [], rolesByProfileId: {} };");
        expect(actions).toMatch(/catch \(error\) \{[\s\S]{0,300}data: empty/);
    });

    it("l'UI du filtre reste compacte et responsive", () => {
        const ui = codeOnly(FILTER_UI);
        expect(ui).toContain("POLL_FILTER_CONTROL");
        expect(ui).toContain("sm:flex-row");
        expect(ui).toContain("roles.length > 0");
    });
});

describe("sondages — en-têtes harmonisés et modale responsive", () => {
    it("les 3 boutons de l'en-tête partagent la MÊME géométrie", () => {
        const help = codeOnly(HELP);
        expect(help).toContain("h-9");
        expect(help).toContain("px-3.5");
        expect(help).toContain("rounded-lg");
        expect(help).toContain("text-xs font-semibold");

        const creator = codeOnly(CREATOR);
        expect(creator).toContain("h-9 px-3.5 rounded-lg text-xs font-semibold");
        expect(creator).toContain("bg-info");
        expect(creator).not.toContain("shadow-lg shadow-cyan-900/20");
        expect(creator).not.toContain("h-11 px-6");
    });

    it("la page module aligne les boutons sans empilement bancal", () => {
        expect(codeOnly(SONDAGES_PAGE)).toContain("flex flex-wrap items-center gap-2");
    });

    it("la modale de création ne laisse plus les libellés sortir de leur tuile", () => {
        // Les tuiles vivent dans un composant PARTAGÉ par les deux modales.
        const tiles = codeOnly("src/components/sondages/poll-category-tiles.tsx");
        expect(tiles).toContain("grid-cols-3 sm:grid-cols-5");
        expect(tiles).not.toContain("grid-cols-2 sm:grid-cols-5");
        expect(tiles).toContain("overflow-hidden min-w-0");
        const creator = codeOnly(CREATOR);
        expect(creator).toContain("PollCategoryTiles");
        expect(creator).toContain("w-[95vw]");
    });

    it("le module staff reçoit les mêmes traitements", () => {
        expect(codeOnly(STAFF_PAGE)).toContain("ModuleHelpActions");
        expect(codeOnly(STAFF_BOARD)).toContain("h-9 px-3.5 rounded-lg text-xs font-semibold");
        expect(codeOnly(STAFF_FORM)).toContain("h-9 px-3.5 rounded-lg text-xs font-semibold");
        expect(codeOnly(STAFF_FORM)).toContain("w-[95vw]");
        for (const path of [STAFF_PAGE, STAFF_BOARD, STAFF_FORM, FILTER_UI]) {
            expect(codeOnly(path), path).not.toContain("console.log");
        }
    });
});
