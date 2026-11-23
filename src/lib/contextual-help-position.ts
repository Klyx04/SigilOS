/**
 * Placement d'une bulle d'aide (`ContextualHelp`) dans la fenêtre.
 *
 * Règle pure : la bulle s'ouvre au-dessus si elle y tient, sinon en dessous ;
 * elle est **toujours** ramenée dans la fenêtre (marge 8 px) et sa largeur est
 * plafonnée par `100vw - 16 px`. Aucun `absolute` dans un parent scrollable :
 * le composant la porte dans le `body` en `position: fixed`.
 */

export type HelpTriggerRect = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type HelpViewport = { width: number; height: number };
export type HelpSize = { width: number; height: number };
export type HelpPlacement = "top" | "bottom";

export type HelpPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: HelpPlacement;
  /** Position horizontale de la flèche dans la bulle. */
  arrowLeft: number;
};

export const HELP_MARGIN = 8;
export const HELP_GAP = 8;

export function placeContextualHelp(
  trigger: HelpTriggerRect,
  viewport: HelpViewport,
  size: HelpSize
): HelpPosition {
  const width = Math.max(0, Math.min(size.width, viewport.width - HELP_MARGIN * 2));
  const maxHeight = Math.max(0, viewport.height - HELP_MARGIN * 2);
  const height = Math.min(size.height, maxHeight);
  const placement: HelpPlacement =
    trigger.top >= height + HELP_GAP + HELP_MARGIN ? "top" : "bottom";
  const rawTop =
    placement === "top" ? trigger.top - height - HELP_GAP : trigger.bottom + HELP_GAP;
  const top = Math.min(
    Math.max(HELP_MARGIN, rawTop),
    Math.max(HELP_MARGIN, viewport.height - height - HELP_MARGIN)
  );
  const rawLeft = trigger.left + trigger.width / 2 - width / 2;
  const left = Math.min(
    Math.max(HELP_MARGIN, rawLeft),
    Math.max(HELP_MARGIN, viewport.width - width - HELP_MARGIN)
  );
  const arrowLeft = Math.min(
    Math.max(12, trigger.left + trigger.width / 2 - left - 4),
    Math.max(12, width - 20)
  );

  return { top, left, width, maxHeight, placement, arrowLeft };
}
