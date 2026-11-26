/**
 * Verrou de **surface** des fiches monstres / boss / donjons (26/11/2026).
 *
 * Demande user (verbatim) : « vérifie bien également en fonction de si on est sur un
 * rush interne / public que les fiches monstres boss etc qui proposent un lien pointent
 * bien directement dans leur fiche interne guide ou public partout sans bug ».
 *
 * Règle unique :
 *   · donjon → `dungeonFicheHref(guildId | "public", …)` ;
 *   · monstre → fiche interne (membre) ou `/bestiaire/<slug|id>` (visiteur) ;
 *   · aperçu God → aucune navigation.
 *
 * Lecture seule : aucune base, aucun rendu.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
const PANEL = "src/components/dofus-quests/rush/RushQuestDungeonsPanel.tsx";
const TAG = "src/components/dofus-quests/rush/RushTagBadge.tsx";
const CONSTRAINTS = "src/components/dofus-quests/rush/RushQuestConstraints.tsx";
const DETAIL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUB = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

describe("fiches donjons / monstres — la surface décide la destination", () => {
  it("le donjon passe par la source unique `dungeonFicheHref` et le panneau transmet sa guilde", () => {
    expect(read(CARD)).toContain('dungeonFicheHref(isPublic ? "public" : guildId, dj)');
    expect(read(PANEL)).toContain("guildId={guildId}");
  });

  it("le monstre suit le viewer : modale interne pour un membre, lien public pour un visiteur", () => {
    const src = read(CONSTRAINTS);
    expect(src).toContain('viewer === "member"');
    expect(src).toContain('viewer === "visitor"');
    expect(src).toContain("href={`/bestiaire/${monsterId}`}");
    // L'aperçu God (viewer `preview`) retombe sur une ligne non cliquable.
    expect(src).not.toMatch(/viewer === "preview"[\s\S]{0,200}(<a|<button)/);
  });

  it("le tag de monstre garde la fiche interne et le lien public séparés", () => {
    const src = read(TAG);
    expect(src).toContain('viewer === "member"');
    expect(src).toContain('viewer === "visitor"');
    expect(src).toContain("href={`/bestiaire/${monster.slug}`}");
  });

  it("le guide public transmet `guildId=\"public\"` et `viewer=\"visitor\"` à toutes ses briques", () => {
    const src = read(PUB);
    expect(src).toContain('guildId="public"');
    expect(src).toContain('viewer="visitor"');
    expect(src).not.toContain('viewer="member"');
  });

  it("le guide interne transmet sa guilde réelle et `viewer=\"member\"`", () => {
    const src = read(DASH);
    expect(src).toMatch(/guildId=\{guildId\}/);
    expect(src).toContain('viewer="member"');
    expect(src).not.toContain('viewer="visitor"');
  });

  it("l'overlay décide le viewer UNE fois et le réutilise (fiche détail incluse)", () => {
    const src = read(OVERLAY);
    expect(src).toContain('const viewer = isGuest ? "visitor" : "member"');
    expect(src).toMatch(/viewer=\{viewer\}/);
    expect(src).not.toMatch(/viewer=\{isGuest \? "visitor" : "member"\}/);
    expect(read(DETAIL)).toContain("viewer={viewer}");
  });
});
