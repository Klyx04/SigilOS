/**
 * Garde — navigation des guides par **BLOC** (12/11/2026).
 *
 * 🎯 Demande user : « je veux que dans les guides navigateurs on ait tous ces fameux blocs
 * comme dans l'overlay […] supprime le "tout" pour ne conserver que le mode paginé ».
 *
 * 📏 Mesure : une page = UN chapitre montait jusqu'à **89 quêtes** d'un coup, et « Tout »
 * rendait les **54 blocs** de la route d'affilée. Une page = UN bloc (ce que faisaient déjà
 * le guide public et l'overlay) + sommaire plat numéroté + suppression du mode « Tout ».
 *
 * 🛡️ Le rang vient de `rushChapterNumbers` — le même que l'en-tête des blocs et l'overlay.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const NAV = "src/components/dofus-quests/rush/RushChapterNav.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

/** Code sans commentaires : un commentaire qui cite l'ancien mode ne doit pas faire échouer. */
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const NAVC = codeOf(NAV);
const DASH = codeOf(DASHBOARD);
const PUB = codeOf(PUBLIC);

describe("sommaire — liste PLATE des blocs, comme l'overlay", () => {
  it("numérote avec la règle partagée, pas avec un index de chapitre", () => {
    expect(NAVC).toMatch(/rushChapterNumbers\(milestones\)/);
    expect(NAVC).not.toMatch(/selectedChapter/);
    expect(NAVC).toMatch(/selectedMilestoneId/);
    expect(NAVC).toMatch(/onSelectMilestone/);
  });

  it("garde le chapitre en mention secondaire", () => {
    expect(NAVC).toMatch(/da-guide-nav-sub/);
    expect(NAVC).toMatch(/chapterLabel/);
  });

  it("les deux guides lisent la même API", () => {
    for (const [name, code] of [["interne", DASH], ["public", PUB]] as const) {
      expect(code, `${name} ne passe pas le bloc sélectionné`).toMatch(/selectedMilestoneId=/);
      expect(code, `${name} ne branche pas la sélection`).toMatch(/onSelectMilestone=/);
    }
  });
});

describe("dashboard — une page = UN bloc, plus de mode « Tout »", () => {
  it("construit une page par bloc (sans en-tête de chapitre répété)", () => {
    expect(DASH).toMatch(/const blockPages = useMemo/);
    expect(DASH).toMatch(/showHeader: false/);
    expect(DASH).not.toMatch(/chapterPages/);
  });

  it("le mode « Tout » et son état ont disparu", () => {
    expect(DASH).not.toMatch(/isAllChapters/);
    expect(DASH).not.toMatch(/showEveryChapter/);
    expect(DASH).not.toMatch(/>Tout</);
    expect(DASH).not.toMatch(/Paginé/);
  });

  it("le pager compte les blocs", () => {
    expect(DASH).toMatch(/blockPages\.length/);
    expect(DASH).toMatch(/pageIndex \+ 1\} \/ \{blockPages\.length/);
  });

  it("la recherche et le filtre Dofus affichent tout le guide, sans pager", () => {
    expect(DASH).toMatch(/const showEveryBlock = !!searchResults \|\| !!dofusFilter;/);
  });
});

describe("public — la pagination était déjà par bloc", () => {
  it("une page porte UN milestone et ses bannières", () => {
    expect(PUB).toMatch(/const chapterPages = useMemo/);
    expect(PUB).toMatch(/out\.push\(\{ ms, index, lead, tail: \[\] \}\)/);
  });

  it("la sélection du sommaire vise le bloc affiché", () => {
    expect(PUB).toMatch(/selectedMilestoneId=\{currentPage\?\.ms\.id \?\? null\}/);
  });
});
