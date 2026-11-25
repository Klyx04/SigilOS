"use client";

/**
 * Sous-bloc d'un bloc du Rush — **rendu partagé des trois surfaces**.
 *
 * Un sous-bloc n'est pas une quête : il reprend exactement les composants des blocs
 * autonomes (Conseil/Tips, Obtention Dofus, Séparateur, Combat) pour que la même
 * donnée s'affiche pareil dans le dashboard, le guide public et l'overlay.
 * `surface` ne change que la densité (PiP vs page).
 */

import { isRushCombatBlock } from "@/lib/rush-block-types";
import type { RushMilestoneChild } from "@/types/rush-guide-types";
import { DofusObtainedBanner } from "./DofusObtainedBanner";
import { RushCombatBanner } from "./RushCombatBanner";
import { RushInfoBanner } from "./RushInfoBanner";
import { RushSeparatorBanner } from "./RushSeparatorBanner";
import { RushTipLines } from "./RushTipLines";

export function RushBlockChild({
  child,
  surface = "page",
}: {
  child: RushMilestoneChild;
  surface?: "pip" | "page";
}) {
  if (child.type === "INFO") {
    const content = child.tips || child.description || child.title || "";
    return (
      <RushInfoBanner
        title={child.title || null}
        imageUrl={child.imageUrl}
        accentColor={child.accentColor}
        collapsible={surface === "pip"}
      >
        <RushTipLines text={content} />
      </RushInfoBanner>
    );
  }

  if (child.type === "DOFUS_OBTAINED") {
    return <DofusObtainedBanner milestone={child} surface={surface} />;
  }

  if (child.type === "SEPARATEUR") {
    return (
      <RushSeparatorBanner
        title={child.title}
        description={child.description}
        imageUrl={child.imageUrl}
        accentColor={child.accentColor}
        surface={surface}
      />
    );
  }

  if (isRushCombatBlock(child.type)) {
    return (
      <RushCombatBanner
        type={child.type}
        title={child.title}
        bodyText={child.tips ?? child.description}
        imageUrl={child.imageUrl}
        links={child.links}
        surface={surface}
      />
    );
  }

  return null;
}
