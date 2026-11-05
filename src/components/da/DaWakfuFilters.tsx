/**
 * Filtres SVG de la DA « Gouache Wakfu ».
 *
 * À monter **une seule fois** par surface qui utilise la DA (layout de
 * l'overlay, page du guide). Les classes `.da-*` les référencent par
 * `url(#da-rough)` et `url(#da-brush)`.
 *
 * Pourquoi un composant et pas un `dangerouslySetInnerHTML` : le SVG est
 * inerte (`aria-hidden`, taille 0), il n'entre pas dans le flux et ne coûte
 * qu'une seule définition pour toute la page. Deux filtres suffisent :
 * `da-rough` pour les bords, `da-brush` pour les chiffres de l'écriteau.
 *
 * ⚠️ Le déplacement est une passe de rastérisation : ne jamais l'appliquer à
 * un texte, ni à une liste de cartes (voir `[data-quality]` dans
 * `src/app/da-wakfu.css`).
 */
export function DaWakfuFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="da-rough" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" />
        </filter>
        <filter id="da-brush" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.12" numOctaves="2" seed="3" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" />
        </filter>
      </defs>
    </svg>
  );
}
