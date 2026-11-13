/**
 * Gardes — **page publique d'une quête Rush** (bloc B, 12/11/2026).
 *
 * 🎯 Ce que le lot livre : une URL stable par quête **publiée**, lue sans donnée
 * privée, et un bouton de publication dans le studio.
 *
 * 🛡️ Ce fichier tient quatre invariants :
 *  ① le slug est **figé** à la première publication (jamais recalculé depuis le nom) ;
 *  ② une quête non publiée ou d'un autre guide renvoie `null` (404, fail-closed) ;
 *  ③ la page et le sitemap respectent `isPublicUnderConstruction` (`noindex`) ;
 *  ④ le studio peut publier / dépublier sans quitter l'inspecteur de bloc.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");
const READER = codeOf("src/server/public-rush-quest.ts");
const PAGE = codeOf("src/app/guides/rush-sylvestre/q/[slug]/page.tsx");
const SITEMAP = codeOf("src/app/sitemap.ts");
const STUDIO = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");

describe("publication — le slug est figé", () => {
  it("l'action existe et passe par le rate limit Rush", () => {
    expect(ACTIONS).toMatch(/export async function publishRushSequence/);
    expect(ACTIONS).toContain('requireRushWriteAccess("rush-publish"');
  });

  it("le slug n'est calculé que s'il est absent (jamais recalculé)", () => {
    expect(ACTIONS).toContain("if (input.publish && !slug)");
    expect(ACTIONS).toContain("slugifyRushQuestName(sequence.subGuideName)");
    expect(ACTIONS).toContain("uniqueRushPublicSlug(");
  });

  it("la quête doit appartenir au guide rush-sylvestre", () => {
    const start = ACTIONS.indexOf("export async function publishRushSequence");
    const body = ACTIONS.slice(start, start + 1800);
    expect(body).toContain('guide: { slug: "rush-sylvestre" }');
    expect(body).toContain("Quête introuvable dans le guide Rush");
  });

  it("l'écriture est journalisée et revalide la page publique", () => {
    expect(ACTIONS).toContain('op: input.publish ? "publish-rush-sequence" : "unpublish-rush-sequence"');
    expect(ACTIONS).toContain("revalidatePath(`/guides/rush-sylvestre/q/${slug}`)");
  });
});

describe("lecture publique — aucune donnée privée", () => {
  it("la lecture est dédupliquée et filtrée", () => {
    expect(READER).toContain("cache(async");
    expect(READER).toContain("isPublished");
    expect(READER).toContain('sequence.milestone.guide.slug !== "rush-sylvestre"');
    expect(READER).toContain("if (!sequence || !sequence.isPublished) return null");
  });

  it("elle ne sélectionne ni progression ni compte", () => {
    expect(READER).not.toContain("profileId");
    expect(READER).not.toContain("userId");
    expect(READER).not.toContain("guildId");
  });
});

describe("page publique", () => {
  it("répond 404 sur une quête absente et pose la DA Wakfu", () => {
    expect(PAGE).toContain("notFound()");
    expect(PAGE).toContain('data-da="wakfu"');
    expect(PAGE).toMatch(/export const revalidate = 3600/);
  });

  it("les métadonnées suivent le drapeau public", () => {
    expect(PAGE).toContain("generateMetadata");
    expect(PAGE).toContain("robots: quest.guideUnderConstruction");
    expect(PAGE).toContain("index: false");
    expect(PAGE).toContain("canonical:");
  });

  it("le sitemap ne publie que les quêtes publiées d'un guide ouvert", () => {
    expect(SITEMAP).toContain("/guides/rush-sylvestre/q/");
    expect(SITEMAP).toContain("isPublished: true");
    expect(SITEMAP).toContain("publicSlug: { not: null }");
  });
});

describe("studio — publier sans quitter l'inspecteur", () => {
  it("le studio appelle l'action et met à jour la ligne", () => {
    expect(STUDIO).toContain("publishRushSequence");
    expect(STUDIO).toContain("handlePublishQuest");
    expect(STUDIO).toContain("onPublishQuest");
  });

  it("la ligne de quête porte le bouton et le lien public", () => {
    expect(STUDIO).toContain("onPublishQuest(seq.id, !seq.isPublished)");
    expect(STUDIO).toContain("/guides/rush-sylvestre/q/${seq.publicSlug}");
    expect(STUDIO).toContain("<GlobeLock");
    expect(STUDIO).toContain("<Globe");
  });
});
