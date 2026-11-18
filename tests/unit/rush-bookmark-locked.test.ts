/**
 * Repère « je suis ici » et quête **verrouillée** — décision du **18/11/2026**.
 *
 * ⚠️ Ce fichier **renverse** la décision du 11/11/2026 (« le repère reste possible sur une
 * carte verrouillée »). Retour user : une quête verrouillée n'est **pas jouable**, on n'y
 * pose donc plus de repère — dans le navigateur comme dans l'overlay. S'il en existait un
 * avant le verrou, il reste **retirable** (sinon il serait collé pour toujours).
 *
 * Le second bloc (badge Ocre des donjons) est inchangé : l'asset vit dans la ligne de texte,
 * pas sur la vignette du boss.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const OVERLAY_ROW = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const DUNGEON_CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const MEMBER = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("Repère — pas de pose sur une quête verrouillée", () => {
    it("l'overlay désactive le repère tant que le verrou tient", () => {
        const row = read(OVERLAY_ROW);
        expect(row).toContain("disabled={isDone || (isLocked && !isBookmarked)}");
        expect(row).toContain("Quête verrouillée — repère indisponible");
        // Le libellé de pose n'existe plus sur une ligne verrouillée : la raison est dite.
        expect(row).toContain("Quête verrouillée — terminez d'abord ses prérequis");
    });

    it("la carte verrouillée du guide membre ne rend le bouton que pour RETIRER un repère", () => {
        const member = read(MEMBER);
        const lockedStart = member.indexOf('data-state="locked"');
        expect(lockedStart).toBeGreaterThan(-1);
        const block = member.slice(lockedStart, lockedStart + 4000);
        expect(block).toContain("{isThisBookmarked && (");
        expect(block).not.toContain('aria-label="Je suis ici"');
        expect(block).toContain('aria-label="Retirer le repère"');
    });

    it("le repère de bloc ne vise jamais une quête verrouillée", () => {
        const member = read(MEMBER);
        expect(member).toContain("!isSequenceBlockedByPrereqs(s,allCompletedSeqIds,allMilestones)");
    });

    it("la page publique et la page membre portent `data-here` sur la carte", () => {
        expect(read(PUBLIC)).toContain('data-here={isBookmarked ? "true" : undefined}');
        expect(read(MEMBER)).toContain('data-here={isThisBookmarked ? "true" : undefined}');
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
