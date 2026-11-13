/**
 * Repère « je suis ici » sur une quête **verrouillée** (11/11/2026).
 *
 * Décision user : un donjon requis (ou un prérequis) empêche de **valider** la quête, pas de
 * dire **où l'on en est**. Le repère doit donc rester possible sur une carte verrouillée, avec
 * sa propre DA dans l'overlay **et** les deux guides navigateur.
 *
 * Ce verrou protège aussi la lisibilité du badge Ocre des donjons : plus de pastille collée
 * sur la vignette du boss, l'asset Ocre vit dans la ligne de texte.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const OVERLAY_ROW = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const DUNGEON_CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const MEMBER = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const SERVER = "src/server/actions/optimized-guide-actions.ts";

describe("Repère « je suis ici » — possible même sur une quête verrouillée", () => {
    it("l'overlay ne refuse plus le repère à cause du verrou de validation", () => {
        const src = read(OVERLAY);
        const start = src.indexOf("const handleBookmark = useCallback(");
        const end = src.indexOf("const handleToggleMs", start);
        expect(start).toBeGreaterThan(-1);
        const block = src.slice(start, end > start ? end : start + 4000);
        expect(block).not.toContain("gate.locked");
        expect(block).toContain("Cette quête est déjà validée.");
    });

    it("l'overlay colore le repère même verrouillé, et le nomme", () => {
        const row = read(OVERLAY_ROW);
        expect(row).toContain('data-here={isBookmarked && !isDone ? "true" : "false"}');
        expect(row).toMatch(/isDone \? "Validée" : isBookmarked \? "Je suis ici" : isLocked \? "Verrouillée"/);
        // Le bouton repère n'est plus enveloppé dans `!isLocked` : il est TOUJOURS rendu.
        expect(row).not.toContain("{!isLocked && (");
        expect(row).toContain("disabled={isDone}");
    });

    it("la page publique et la page membre portent `data-here` sur la carte", () => {
        expect(read(PUBLIC)).toContain('data-here={isBookmarked ? "true" : undefined}');
        expect(read(MEMBER)).toContain('data-here={isThisBookmarked ? "true" : undefined}');
    });

    it("la carte verrouillée du guide membre garde un bouton de repère", () => {
        const member = read(MEMBER);
        const lockedStart = member.indexOf('data-state="locked"');
        const block = member.slice(lockedStart, lockedStart + 4000);
        expect(block).toContain("onBookmarkSeq(seq.id, ms)");
        expect(block).toContain("Je suis ici");
    });

    it("le serveur ne refuse pas un repère à cause d'un donjon (garde absente)", () => {
        const src = read(SERVER);
        const start = src.indexOf("export async function setRushBookmark(");
        const end = src.indexOf("export async function", start + 10);
        const block = src.slice(start, end > start ? end : start + 4000);
        expect(start).toBeGreaterThan(-1);
        expect(block).not.toMatch(/missingRequiredDungeons|donjon\(s\) requis non fait/);
    });
});

describe("Badge Ocre des donjons — l'asset vit dans la ligne, pas sur la vignette", () => {
    it("plus de pastille absolue sur l'image du boss", () => {
        const card = read(DUNGEON_CARD);
        expect(card).not.toContain("absolute -top-px -right-px");
        expect(card).toContain('src="/assets/icons/ocre.png"');
        expect(card).toContain("Ocre : capturé");
        expect(card).toContain("Ocre : à capturer");
    });
});
