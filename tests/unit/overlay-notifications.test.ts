/**
 * Overlay — notifications et modale publique **dans** la PiP.
 *
 * Trois verrous, nés des retours du 10/11 :
 *  1. le guide public monte l'overlay **sans** `OverlayToastProvider` ⇒ `useOverlayToast`
 *     retombait sur le toast global, hors de la fenêtre ;
 *  2. `PublicMetamobModal` est une modale Radix : sans conteneur de portail, elle s'ouvre
 *     dans la page hôte, pas dans la PiP ;
 *  3. un bloc validé (ou un Dofus obtenu) doit produire un toast d'overlay, pas seulement
 *     un changement de chapitre silencieux.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const MODAL = "src/components/dofus-quests/rush/PublicMetamobModal.tsx";
const DIALOG = "src/components/ui/dialog.tsx";

describe("Overlay — notifications et portail de la modale publique", () => {
    it("le guide public enveloppe l'overlay dans le provider de toasts dédié, dans la PiP", () => {
        const pub = stripComments(read(PUBLIC));
        expect(pub).toContain("<OverlayToastProvider>");
        expect(pub).toContain("</OverlayToastProvider>");
        expect(pub).toMatch(/createPortal\(\s*<OverlayToastProvider>/);
    });

    it("la modale Metamob publique est portée dans le body de la PiP", () => {
        const overlay = stripComments(read(OVERLAY));
        expect(overlay).toContain("portalContainer={rootRef.current?.ownerDocument.body ?? null}");
        expect(stripComments(read(MODAL))).toContain("portalContainer={portalContainer}");
        expect(stripComments(read(DIALOG))).toContain("container={portalContainer}");
    });

    it("un bloc validé (ou un Dofus obtenu) produit un toast d'overlay", () => {
        const overlay = stripComments(read(OVERLAY));
        expect(overlay).toContain("notifyBlockDone");
        expect(overlay).toContain("Bloc validé :");
        expect(overlay).toContain("Dofus obtenu :");
        // Deux chemins de bloc (invité + serveur) et les deux fins de bloc par la dernière quête.
        expect((overlay.match(/notifyBlockDone\(ms\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    });

    it("le guide public pousse ses captures Ocre dans l'overlay et y ouvre la modale publique", () => {
        const pub = stripComments(read(PUBLIC));
        expect(pub).toContain("publicCapturedOcreNames={capturedOcreNames}");
        expect(pub).toContain("if (pipWin && visitor?.metamobPseudo) setOcreLoadRequested(true);");
        const overlay = stripComments(read(OVERLAY));
        expect(overlay).toContain("publicCapturedOcreNames");
        expect(overlay).toContain("setMetamobOpen(true)");
    });
});
