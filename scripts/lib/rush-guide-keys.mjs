/**
 * Clé d'appariement des blocs et quêtes du guide Rush Sylvestre.
 *
 * SOURCE UNIQUE : le seed (`scripts/seed-rush-sylvestre-cli.mjs`) et les scripts de
 * maintenance (`scripts/prune-rush-guide-orphans.mjs`, `scripts/enrich-rush-guide-items.mjs`)
 * DOIVENT apparier avec la même règle — sinon une ligne vivante serait déclarée orpheline
 * (suppression) ou un doublon passerait inaperçu.
 *
 * « Mission Solution. » et « Mission Solution » donnent la même clé
 * (`missionsolution`), comme « Corvée de patate » et « corvee de patate ».
 */
export function normKey(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Clé d'une quête du dataset (`subGuideName`, sinon `subGuideRef`, sinon `name`). */
export function sequenceName(seq) {
  return seq?.subGuideName || seq?.subGuideRef || seq?.name || "";
}
