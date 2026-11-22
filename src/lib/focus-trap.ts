/**
 * Piege a focus d une modale — regle PURE (aucun DOM), donc testable.
 *
 * `Tab` avance, `Shift+Tab` recule, et l on revient au debut a la fin (cyclique).
 * `current = -1` signifie que le focus est hors de la liste (ou sur le conteneur) :
 * `Tab` va au premier element, `Shift+Tab` au dernier — jamais un focus perdu.
 */
export function nextFocusIndex(current: number, length: number, shift: boolean): number {
  if (length <= 0) return -1;
  if (current < 0) return shift ? length - 1 : 0;
  return shift ? (current - 1 + length) % length : (current + 1) % length;
}