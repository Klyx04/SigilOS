/**
 * Verrou de donjons **côté surface** + notifications **dans** l'overlay.
 *
 * 🎯 Retours user (22/10/2026, verbatim) : « on peut toujours cliquer sur la coche
 * malgré les donjons non coché , une erreur de synchro qui s'affiche au clic et en dehors
 * de l'overlay (au lieu d'une notif toast dans l'overlay) , on ne devras en fait meme pas
 * pouvoir cocher un dj ou les dj obligatoire sont pas coché ».
 *
 * Causes mesurées :
 *  ① `getSeqGate` ne testait que les **prérequis** : une quête dont un donjon requis
 *    manquait restait cochable → le serveur refusait → toast d'erreur ;
 *  ② l'overlay est porté par `createPortal(..., win.document.body)` et `toast()` de
 *    sonner rendait dans le Toaster du **document hôte** (donc hors de la fenêtre).
 *
 * On verrouille les deux au bon étage : la **règle pure** (noms des requis manquants) et
 * le **câblage** (verrou composé, Toaster dédié dans le portail).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { RushSequence } from "@/types/rush-guide-types";
import { missingRequiredDungeons, resolveSequenceDungeons } from "@/lib/rush-dungeons";

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const ITEM = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const PANEL = "src/components/dofus-quests/rush/RushQuestDungeonsPanel.tsx";
const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
const FEEDBACK = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFeedbackPanel.tsx";
const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const RESOURCES = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal.tsx";
const CHIP = "src/components/dofus-quests/rush/RushCoordinateChip.tsx";
const HOST = "src/app/dashboard/[guildId]/_components/rush-overlay-host.tsx";
const TOAST = "src/components/rush/overlay-toast.tsx";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const seq = (over: Partial<RushSequence> = {}): RushSequence => ({
  id: "seq-1",
  subGuideRef: "q1",
  subGuideName: "Quête 1",
  isOptional: false,
  order: 1,
  ...over,
});

const dj = (id: string, name: string, extra: { isOptional?: boolean } = {}) => ({
  id,
  name,
  isOptional: extra.isOptional,
});

describe("missingRequiredDungeons — ce qui bloque vraiment", () => {
  it("rend la clé ET le nom des donjons requis non cochés", () => {
    expect(missingRequiredDungeons(seq({ dungeons: [dj("d1", "Bworkette")] }), [])).toEqual([
      { key: "d1", name: "Bworkette" },
    ]);
  });

  it("ignore un donjon optionnel non coché", () => {
    expect(
      missingRequiredDungeons(
        seq({ dungeons: [dj("d1", "Bworkette", { isOptional: true })] }),
        []
      )
    ).toEqual([]);
  });

  it("ne rend que ce qui manque quand un frère est déjà coché", () => {
    const s = seq({ dungeons: [dj("d1", "Bworkette"), dj("d2", "Nelween")] });
    const doneKey = resolveSequenceDungeons(s, new Set()).requirements.find((r) => r.name === "Bworkette")!.key;
    expect(missingRequiredDungeons(s, [doneKey])).toEqual([{ key: "d2", name: "Nelween" }]);
  });

  it("ne bloque plus quand tous les requis sont cochés", () => {
    const s = seq({ dungeons: [dj("d1", "Bworkette"), dj("d2", "Nelween")] });
    const keys = resolveSequenceDungeons(s, new Set()).requirements.map((r) => r.key);
    expect(missingRequiredDungeons(s, keys)).toEqual([]);
  });

  it("ne rend rien sans donjon (ou sans quête)", () => {
    expect(missingRequiredDungeons(seq(), [])).toEqual([]);
    expect(missingRequiredDungeons(null, [])).toEqual([]);
    expect(missingRequiredDungeons(undefined, ["x"])).toEqual([]);
  });
});

describe("Overlay — verrou composé (prérequis ET donjons requis)", () => {
  it("le verrou appelle la règle partagée des donjons manquants", () => {
    expect(codeOf(OVERLAY)).toMatch(/missingRequiredDungeons\(/);
  });

  it("le verrou combine les deux causes", () => {
    expect(codeOf(OVERLAY)).toMatch(
      /locked:\s*refs\.some\([\s\S]{0,140}missingDungeons\.length > 0/
    );
  });

  it("les états de donjons sont chargés dès l'ouverture (pas de `lazy`)", () => {
    expect(codeOf(OVERLAY)).toMatch(/lazy:\s*false/);
  });

  it("la ligne de quête nomme les donjons manquants et garde la coche désactivée", () => {
    const item = codeOf(ITEM);
    expect(item).toMatch(/missingDungeons/);
    expect(item).toMatch(/Donjons requis/);
    expect(item).toMatch(/disabled=\{isLocked\}/);
  });
});

describe("Overlay — les toasts s'affichent DANS la fenêtre", () => {
  it("le Toaster dédié est monté dans le portail du PiP, avec le provider", () => {
    const host = codeOf(HOST);
    expect(host).toMatch(/OverlayToastProvider/);
    expect(host).toMatch(/<OverlayToaster \/>/);
    expect(host).toMatch(/win\.document\.body/);
  });

  it("plus aucun composant de l'overlay n'appelle le toast global", () => {
    for (const file of [OVERLAY, ITEM, FEEDBACK, HEADER, RESOURCES, PANEL, CARD, CHIP]) {
      expect(codeOf(file), file).not.toMatch(/import \{ toast \} from "sonner"/);
    }
  });

  it("le helper route bien par `toasterId`", () => {
    const code = codeOf(TOAST);
    expect(code).toMatch(/toasterId: OVERLAY_TOASTER_ID/);
    expect(code).toMatch(/id=\{OVERLAY_TOASTER_ID\}/);
  });
});
