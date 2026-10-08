/**
 * Garde — **robustesse du studio God « Rush Sylvestre »** (lot 3 du plan : E1, E3, E4, E5, E6).
 *
 * 🎯 Mesures du 08/10/2026 (aucune supposition) :
 *   · **E4** — la suppression d'un bloc passait par le `confirm()` **natif** (l. 519) : impossible
 *     d'expliquer ce qui part avec le bloc (ses quêtes), et certains navigateurs le bloquent. Le
 *     `Dialog` Radix annoncé « déjà importé » par la consigne **ne l'était pas** — il a fallu
 *     l'importer.
 *   · **E6** — le conteneur de défilement était deviné par une **classe Tailwind**
 *     (`closest('.flex-1.overflow-y-auto')`), classe partagée avec la barre latérale du panneau
 *     God ; et la même devinette servait les boutons « Haut / Bas », un **second** site que la
 *     consigne ne mentionnait pas.
 *   · **E3** — la création d'un bloc écrivait `order: localMilestones.length` puis **renumérait
 *     tout le guide** par un second appel. `order` étant un `Int` (aucune position fractionnaire),
 *     écrire l'index d'insertion seul crée des **doublons** : le créneau doit être **ouvert**
 *     côté serveur, dans la même transaction que la création.
 *   · **E1** — l'aide de syntaxe omettait `/w` (reconnu par le parseur) et laissait croire qu'une
 *     position nue suffisait.
 *   · **E5** — l'aperçu « live » montrait une **vignette maison** (un carré à cocher dessiné en
 *     dur) au lieu de la ligne de quête et de la fiche du membre.
 *
 * 🛡️ Deux niveaux de preuve : le **câblage** (lecture des sources, commentaires retirés) et un
 * **rendu réel** (`renderToStaticMarkup`) qui vérifie que le composant du MEMBRE accepte l'objet
 * construit par le studio.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RushSequence } from "@/types/rush-guide-types";
import { RushOverlayQuestListItem } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem";

const ADMIN_PATH = "src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx";
const LAYOUT_PATH = "src/app/god/layout.tsx";
const ACTIONS_PATH = "src/server/actions/optimized-guide-actions.ts";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ADMIN = codeOf(ADMIN_PATH);
const ACTIONS = codeOf(ACTIONS_PATH);

/** Bloc source : du marqueur `start` au marqueur `end` (6 000 caractères à défaut). */
function blockOf(code: string, start: string, end?: string): string {
  const from = code.indexOf(start);
  expect(from, `marqueur introuvable : ${start}`).toBeGreaterThan(-1);
  const to = end ? code.indexOf(end, from + start.length) : -1;
  return code.slice(from, to === -1 ? from + 6000 : to);
}

describe("E4 — la suppression d'un bloc passe par le `Dialog` Radix", () => {
  it("plus aucun `confirm()` natif dans le studio", () => {
    expect(ADMIN).not.toMatch(/\bconfirm\(/);
  });

  it("c'est la modale qui porte la décision, pas le clic sur la corbeille", () => {
    expect(ADMIN).toMatch(/const \[pendingDelete, setPendingDelete\] = useState<Milestone \| null>\(null\)/);
    // Les deux sites de suppression (bloc simple et séparateur) visent l'état, pas la suppression.
    expect((ADMIN.match(/onDelete=\{\(\) => setPendingDelete\(m\)\}/g) ?? []).length).toBe(2);
    expect(ADMIN).toMatch(/<Dialog open=\{!!pendingDelete\}/);
    expect(ADMIN).toMatch(/handleDeleteMilestone\(target\.id\)/);
  });

  it("la modale dit ce qui part avec le bloc (ses quêtes)", () => {
    const dialog = blockOf(ADMIN, "<Dialog open={!!pendingDelete}", "{/* Navigation flottante");
    expect(dialog).toMatch(/DialogTitle/);
    expect(dialog).toMatch(/DialogDescription/);
    expect(dialog).toMatch(/pendingDelete\.sequences\.length/);
    // L'action reste retardée jusqu'à l'accord : le bouton « Annuler » ne supprime rien.
    expect(dialog).toMatch(/setPendingDelete\(null\)/);
  });
});

describe("E6 — le conteneur de défilement est déclaré par le layout, jamais deviné", () => {
  it("le layout God marque son conteneur (contrat stable)", () => {
    expect(codeOf(LAYOUT_PATH)).toMatch(/data-god-scroll-container/);
  });

  it("le studio ne cherche plus le conteneur par une classe Tailwind", () => {
    expect(ADMIN).toMatch(/querySelector<HTMLElement>\("\[data-god-scroll-container\]"\)/);
    expect(ADMIN).not.toMatch(/['"]\.flex-1\.overflow-y-auto['"]/);
  });

  it("les DEUX sites (suivi de défilement + boutons Haut/Bas) passent par le même helper", () => {
    // Trois lectures : 1 dans l'effet de suivi, 2 dans les boutons flottants (la définition du
    // helper ne compte pas : on cherche les affectations).
    expect((ADMIN.match(/(?:const|let) \w+ = godScrollContainer\(\)/g) ?? []).length).toBe(3);
    expect(ADMIN).toMatch(/function godScrollContainer\(\): HTMLElement \| null/);
  });
});

describe("E3 — l'`order` du nouveau bloc est ouvert côté serveur (un seul aller-retour)", () => {
  const addStep = blockOf(ADMIN, "const handleAddStep = useCallback", "const handleSaveMilestone = useCallback");

  it("le studio calcule la place AVANT l'écriture et la donne à l'action", () => {
    expect(addStep).toMatch(/const insertAt = findMilestoneInsertIndex\(sortedMilestones/);
    expect(addStep).toMatch(/order: insertAt,/);
  });

  it("plus de renumérotation complète du guide après une création", () => {
    expect(addStep).not.toMatch(/reorderRushMilestones/);
  });

  it("l'action ouvre le créneau dans la MÊME transaction que la création", () => {
    const action = blockOf(
      ACTIONS,
      "export async function upsertRushMilestone",
      "export async function deleteRushMilestone"
    );
    expect(action).toMatch(/const insertAt =/);
    expect(action).toMatch(/order: \{ increment: 1 \}/);
    expect(action).toMatch(/\$transaction\(async \(tx\)/);
    // La garde de guilde reste dans le `WHERE` : aucune écriture hors du guide rush.
    expect(action).toMatch(/where: \{ guideId: guide\.id, order: \{ gte: insertAt \} \}/);
  });
});

describe("E1 — les conseils d'une quête s'écrivent « une ligne = une puce »", () => {
  const editor = blockOf(ADMIN, "function TipsLinesEditor(", "function SortableSeparatorRow");
  const hint = blockOf(ADMIN, "function RichTextSyntaxHint()", "function MemberPreviewFrame");

  it("les deux champs `tips` de séquence passent par l'éditeur partagé", () => {
    expect((ADMIN.match(/<TipsLinesEditor/g) ?? []).length).toBe(2);
    expect(ADMIN).toMatch(/<TipsLinesEditor\s+value=\{tips\}/);
    expect(editor).toMatch(/splitTipLines\(value\)/);
  });

  it("l'éditeur annonce la règle et montre le rendu du membre", () => {
    expect(editor).toMatch(/Une ligne = une puce/);
    expect(editor).toMatch(/<RushTipLines text=\{value\} \/>/);
    expect(editor).toMatch(/<RichTextSyntaxHint \/>/);
  });

  it("« Ajouter position » ouvre une NOUVELLE puce au lieu de coller la commande", () => {
    expect(ADMIN).toMatch(
      /setTips\(prev => \(prev\.trim\(\) \? `\$\{prev\.replace\(\/\\s\+\$\/, ""\)\}\\n\$\{pos\}` : pos\)\)/
    );
  });

  it("l'aide de syntaxe sort du rendu lui-même (aucun exemple codé en dur)", () => {
    for (const key of ["link", "bracket", "w", "travel"]) {
      expect(hint, `exemple ${key} absent de l'aide`).toMatch(new RegExp(`RUSH_RICH_TEXT_SYNTAX\\.${key}`));
    }
    expect(hint).toMatch(/RUSH_RICH_TEXT_NOT_ACCEPTED/);
    expect(hint).not.toMatch(/\[-55,15\]/);
  });
});

describe("E5 — l'aperçu live rend les composants du MEMBRE", () => {
  const preview = blockOf(ADMIN, "const previewSeq: RushSequence = useMemo", "const previewMilestone");
  const frame = blockOf(ADMIN, "function MemberPreviewFrame(", "function TipsLinesEditor");

  it("la ligne de quête et la fiche « Détails » sont celles du membre", () => {
    expect(ADMIN).toMatch(/<RushOverlayQuestListItem/);
    expect(ADMIN).toMatch(/<RushOverlayQuestDetailModal/);
    expect(ADMIN).toMatch(/const \[showPreviewModal, setShowPreviewModal\] = useState\(false\)/);
    // La ligne ouvre la vraie fiche, pas un résumé.
    expect(ADMIN).toMatch(/onOpenDetail=\{\(\) => setShowPreviewModal\(true\)\}/);
  });

  it("la vignette maison a disparu", () => {
    expect(ADMIN).not.toMatch(/Aperçu Joueur \(Temps Réel\)/);
    expect(ADMIN).not.toMatch(/border-zinc-600 shrink-0/);
  });

  it("l'aperçu est nourri par l'état vivant du formulaire (contrat complet du membre)", () => {
    for (const field of ["isOptional: false", "dungeons:", "activityTags:", "alignReq:", "tips:", "metamobMonsterId:"]) {
      expect(preview, `champ ${field} absent de l'aperçu`).toMatch(new RegExp(field));
    }
  });

  it("le cadre d'aperçu repose le thème du membre (jetons, jamais la palette God)", () => {
    expect(frame).toMatch(/className="dark rounded-xl border border-border bg-surface/);
  });

  it("rendu réel : le composant du membre accepte l'objet construit par le studio", () => {
    // Forme identique à `previewSeq` : position en tag, donjons, conseils, note.
    const seq: RushSequence = {
      id: "seq-1",
      subGuideRef: "Faire parler le gardien",
      subGuideName: "Faire parler le gardien",
      note: "Ne pas cliquer le portail",
      isOptional: false,
      order: 3,
      dungeonId: "d-1",
      dungeonIds: ["d-1"],
      dungeons: [{ id: "d-1", name: "Donjon des Dragoeufs", bossName: "Bworker", imageUrl: null }],
      dofusdbUrl: "https://dofusdb.fr/fr/database/quest/1",
      dofuspourlesnoobsUrl: null,
      tips: "Prendre la quête\nAller en [-55,15]",
      alignReq: null,
      alignOrderReq: null,
      isSuccess: false,
      icon: null,
      metamobMonsterId: null,
      activityTags: [{ type: "pos_tags", name: "-55,15" }],
    };
    const out = renderToStaticMarkup(
      React.createElement(RushOverlayQuestListItem, {
        seq,
        isDone: false,
        isBookmarked: false,
        isLightMode: false,
        onToggle: () => {},
        onBookmark: () => {},
        onOpenDetail: () => {},
      })
    );
    expect(out).toContain("Faire parler le gardien");
    expect(out).toContain("Copier la commande /travel -55,15");
  });
});
