/**
 * Garde — le CHOIX DU PERSONNAGE du guide public : une modale visuelle (pictos de
 * classe, vignettes de serveur) et un pseudo VALIDÉ par la même règle que le profil
 * interne.
 *
 * 🎯 Demande user (21/09/2026) : « choix du personnage pas du tout assez visible : faut
 * une modale plutôt avec choix classe (icônes des classes), choix du serveur (icône des
 * serveurs), et nom du personnage (1ʳᵉ lettre majuscule obligatoire, reprend la
 * validation zod d'un pseudo dans le profil perso interne) ».
 *
 * Ce qu'on verrouille :
 *   · la règle de pseudo est UNIQUE (`src/lib/pseudo-validation.ts`) et le Zod du
 *     profil interne s'y branche (plus de regex recopiée) — testé par COMPORTEMENT ;
 *   · la modale câble pictos de classe, vignettes de serveur, champ pseudo validé, et
 *     « Enregistrer » inerte tant que classe + pseudo valide manquent — testé par
 *     câblage : la modale vit dans un PORTAIL radix, que l'environnement `node` de
 *     Vitest ne rend pas (`renderToStaticMarkup` renvoie une chaîne vide) ;
 *   · le guide public monte la modale et n'a plus le panneau inline (3 `<select>`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  pseudoError,
  PSEUDO_PATTERN,
  PSEUDO_MAX_LENGTH,
  PSEUDO_FORMAT_MESSAGE,
} from "@/lib/pseudo-validation";

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const PROFILE_ACTIONS = "src/server/actions/profile-actions.ts";
const MODAL = "src/components/dofus-quests/rush/GuestCharacterModal.tsx";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const MODAL_SRC = codeOf(MODAL);

describe("Règle de pseudo — une seule définition pour le profil ET le guide public", () => {
  it("exige la majuscule initiale et refuse chiffres, espaces et caractères spéciaux", () => {
    expect(pseudoError("Iop")).toBeNull();
    expect(pseudoError("Cra-Zar")).toBeNull();
    expect(pseudoError("Éliatrope")).toBeNull();
    expect(pseudoError("iop")).toBe(PSEUDO_FORMAT_MESSAGE);
    expect(pseudoError("Iop2")).toBe(PSEUDO_FORMAT_MESSAGE);
    expect(pseudoError("Iop le grand")).toBe(PSEUDO_FORMAT_MESSAGE);
    expect(pseudoError("Iop!")).toBe(PSEUDO_FORMAT_MESSAGE);
  });

  it("borne la longueur comme le profil interne (2 → 20)", () => {
    expect(pseudoError("I")).toBe("Pseudo trop court");
    expect(pseudoError("A".repeat(PSEUDO_MAX_LENGTH + 1))).toBe("Pseudo trop long");
    expect(pseudoError("A".repeat(PSEUDO_MAX_LENGTH))).toBeNull();
  });

  it("un champ vide n'est pas une erreur ici (l'appelant décide s'il est requis)", () => {
    expect(pseudoError("")).toBeNull();
    expect(pseudoError(null)).toBeNull();
  });

  it("le Zod du profil interne consomme cette source (aucune regex recopiée)", () => {
    const actions = codeOf(PROFILE_ACTIONS);
    expect(actions).toMatch(/from "@\/lib\/pseudo-validation"/);
    expect(actions).toMatch(/\.regex\(PSEUDO_PATTERN, PSEUDO_FORMAT_MESSAGE\)/);
    expect(actions).toMatch(/PSEUDO_MIN_LENGTH/);
    expect(actions).toMatch(/PSEUDO_MAX_LENGTH/);
    // La regex historique ne doit plus être écrite en dur dans les actions.
    expect(actions).not.toMatch(/\[\^A-Z\\u00C0-\\u017F\]\[a-zA-Z/);
    expect(PSEUDO_PATTERN.test("Cra-Zar")).toBe(true);
  });
});

describe("Modale « Mon personnage » — classes, serveurs, pseudo", () => {
  it("rend les pictos de classe et les vignettes de serveur (le jeu, jamais un glyphe)", () => {
    expect(MODAL_SRC).toContain("DOFUS_CLASSES.map");
    expect(MODAL_SRC).toMatch(/<img src=\{c\.icon\}/);
    expect(MODAL_SRC).toContain("getDofusServerImage(s.id)");
    expect(MODAL_SRC).toContain("servers.map");
    expect(MODAL_SRC).toContain("Mon personnage");
  });

  it("porte le champ pseudo, sa normalisation et la longueur de la règle partagée", () => {
    expect(MODAL_SRC).toContain('id="guest-character-pseudo"');
    expect(MODAL_SRC).toContain("formatDofusPseudo(e.target.value)");
    expect(MODAL_SRC).toContain("maxLength={PSEUDO_MAX_LENGTH}");
    expect(MODAL_SRC).toContain("Première lettre en majuscule");
  });

  it("« Enregistrer » reste inerte sans classe ni pseudo valide (aucun personnage fantôme)", () => {
    expect(MODAL_SRC).toMatch(/const canSave = !!classId && pseudo\.trim\(\)\.length > 0 && !pseudoErr/);
    expect(MODAL_SRC).toMatch(/disabled=\{!canSave\}/);
  });

  it("affiche l'erreur de pseudo telle quelle (règle du profil)", () => {
    expect(MODAL_SRC).toMatch(/pseudoErr \? \(/);
    expect(MODAL_SRC).toContain("{pseudoErr}");
    // La valeur rejouée est bien celle de la règle partagée.
    expect(pseudoError("iop")).toBe(PSEUDO_FORMAT_MESSAGE);
  });
});

describe("Guide public — la modale remplace le panneau inline", () => {
  it("monte la modale partagée", () => {
    const pub = codeOf(PUBLIC);
    expect(pub).toMatch(/import \{ GuestCharacterModal \}/);
    expect(pub).toMatch(/<GuestCharacterModal/);
    expect(pub).toMatch(/onSubmit=\{\(next\) => applyGuestCharacter\(next\)\}/);
  });

  it("n'a plus les trois `<select>` de classe / serveur / pseudo", () => {
    const pub = codeOf(PUBLIC);
    expect(pub).not.toMatch(/GUEST_SERVER_GROUPS/);
    expect(pub).not.toMatch(/charDraft/);
    expect(pub).not.toMatch(/t\.rushGuide\.selectClass/);
    expect(pub).not.toMatch(/t\.rushGuide\.selectServer/);
  });

  it("le bouton de personnage est un bouton du registre, visible dans le panneau", () => {
    const pub = codeOf(PUBLIC);
    expect(pub).toMatch(/Choisir mon personnage/);
    expect(pub).toMatch(/Changer de personnage/);
  });
});
