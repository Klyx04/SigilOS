/**
 * Garde — côté studio GOD, un bloc CONSEIL / TIPS porte un texte + une image, RIEN d'autre.
 *
 * 🎯 Demande user (20/09/2026) : « un bloc de type tips/conseil ne doit pas côté god avoir la
 * possibilité d'option et d'avancée et d'ajout de quête : il s'agit d'un bloc pour ajouter un
 * tips/conseil + une image sympa, rien d'autres ».
 *
 * Mesure avant correctif : la ligne d'un bloc Tips affichait le badge `opt.`, le compteur de
 * quêtes, le chevron de dépliage, et le dépliage ouvrait la liste des quêtes + le formulaire
 * « Ajouter une quête » (un bloc Tips n'accueille aucune quête) ; et le formulaire de CRÉATION
 * n'avait **aucun champ de texte** — il fallait créer le bloc puis le rouvrir en édition pour
 * écrire le conseil, alors que ce texte EST le bloc.
 *
 * 🛡️ Lecture seule des sources (commentaires retirés) : le rendu du studio est un client React
 * sans DOM dans les tests — on verrouille le CÂBLAGE, comme les autres gardes du module.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ADMIN = "src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx";

const CODE = readFileSync(ADMIN, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("Studio GOD — bloc CONSEIL / TIPS", () => {
  it("la création demande le texte du conseil et l'enregistre (`tips`)", () => {
    expect(CODE, "champ de saisie du conseil absent").toMatch(/Conseil \/ Tips/);
    expect(CODE, "état du texte absent").toMatch(/const \[newStepTips, setNewStepTips\]/);
    expect(CODE, "texte jamais envoyé au serveur").toMatch(/tips: isInfoBlock && newStepTips\.trim\(\)/);
  });

  it("la ligne d'un bloc Tips n'affiche ni option, ni compteur de quêtes, ni dépliage", () => {
    // Le drapeau qui commande tous ces affichages.
    expect(CODE).toMatch(/const isTips = milestone\.type === "INFO"/);
    expect(CODE, "badge opt. toujours rendu").toMatch(/\{!isTips && milestone\.isOptional &&/);
    expect(CODE, "compteur de quêtes toujours rendu").toMatch(/\{!isTips && \(\s*<span className="text-caption text-zinc-600/);
    expect(CODE, "chevron de dépliage toujours rendu").toMatch(/\{!isTips && \(isExpanded \?/);
  });

  it("aucune quête ne peut être ajoutée à un bloc Tips", () => {
    expect(CODE, "section quêtes non gardée").toMatch(/\{!isTips && isExpanded && !isEditing && \(/);
  });
});
