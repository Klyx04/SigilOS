/**
 * Garde — **brouillon local du formulaire de quête** (lot 5, 12/11/2026).
 *
 * 🎯 Mesure : un rechargement du studio (ou un crash navigateur) perdait toute saisie
 * non enregistrée. Le brouillon est stocké **par quête**, restauré au montage, jeté à
 * l'enregistrement (et par le bouton « Jeter »).
 *
 * 🛡️ Fail-closed : un JSON illisible, une forme inattendue ou un champ hors bornes
 * renvoie `null` — on garde les valeurs de la base, jamais un brouillon douteux.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseRushEditorDraft,
  rushEditorDraftKey,
  serializeRushEditorDraft,
  type RushEditorDraft,
} from "@/lib/rush-editor-draft";

const base: RushEditorDraft = {
  name: "Ralliement",
  note: "",
  tips: "Conseil",
  dofusdbUrl: "",
  noobsUrl: "",
  alignReq: "bontarien",
  alignOrderCode: "",
  alignLevelReq: "",
  classReq: "",
  metamobMonsterId: "",
  icon: "",
  bontaName: "",
  bontaTips: "",
  brakName: "",
  brakTips: "",
  isSuccess: false,
};

describe("rushEditorDraftKey — une clé stable par quête", () => {
  it("préfixe l'id sans le recalculer depuis le nom", () => {
    expect(rushEditorDraftKey("seq-1")).toBe("rush-editor-draft:seq-1");
  });
});

describe("parseRushEditorDraft — fail-closed", () => {
  it("relit un brouillon valide", () => {
    expect(parseRushEditorDraft(serializeRushEditorDraft(base))).toEqual(base);
  });

  it("null, JSON illisible ou forme inattendue ⇒ null", () => {
    expect(parseRushEditorDraft(null)).toBeNull();
    expect(parseRushEditorDraft("")).toBeNull();
    expect(parseRushEditorDraft("{")).toBeNull();
    expect(parseRushEditorDraft('"texte"')).toBeNull();
    expect(parseRushEditorDraft('{"name":"x"}')).toBeNull();
  });

  it("un champ hors bornes est refusé (4 000 caractères max)", () => {
    const tooLong = { ...base, tips: "x".repeat(4_001) };
    expect(parseRushEditorDraft(JSON.stringify(tooLong))).toBeNull();
  });

  it("un booléen mal typé est refusé", () => {
    expect(parseRushEditorDraft(JSON.stringify({ ...base, isSuccess: "oui" }))).toBeNull();
  });
});

describe("câblage — le studio persiste et purge le brouillon", () => {
  const codeOf = (path: string) =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const STUDIO = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");

  it("lit le brouillon au montage et l'annonce", () => {
    expect(STUDIO).toContain("parseRushEditorDraft(localStorage.getItem(rushEditorDraftKey(seq.id)))");
    expect(STUDIO).toContain("Brouillon restauré");
    expect(STUDIO).toContain("discardDraft");
  });

  it("écrit le brouillon seulement quand le formulaire est modifié", () => {
    expect(STUDIO).toContain("if (!isDirty)");
    expect(STUDIO).toContain("serializeRushEditorDraft({");
  });

  it("jette le brouillon à l'enregistrement", () => {
    const submitAt = STUDIO.indexOf("const handleSubmit = () => {");
    const body = STUDIO.slice(submitAt, submitAt + 600);
    expect(body).toContain("localStorage.removeItem(rushEditorDraftKey(seq.id))");
  });

  it("monte une instance de formulaire PAR quête", () => {
    expect(STUDIO).toContain("key={selectedQuest.id}");
  });
});
