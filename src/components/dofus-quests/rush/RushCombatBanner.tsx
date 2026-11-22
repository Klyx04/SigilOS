"use client";

import type { SyntheticEvent } from "react";
import { ExternalLink, Swords } from "lucide-react";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";
import {
  RUSH_COMBAT_BLOCK_META,
  rushCombatBlockMeta,
  type RushCombatBlockType,
} from "@/lib/rush-block-types";
import { parseRushBlockLinks, type RushBlockLink } from "@/lib/rush-block-links";
import { parseRushMarkdown } from "@/lib/rush-markdown";
import { RushMarkdown } from "./RushMarkdown";
import { SiteFavicon } from "./SiteFavicon";

/**
 * Bandeau d'un bloc **Combat tactique / semi-tactique** (12/11/2026).
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard, guide public, overlay PiP) :
 * même matière `rush-carnet`, même filet de registre, même image, mêmes liens.
 *
 * · `page` : image à droite (hauteur du bandeau, largeur déduite de son ratio,
 *   fondu vers la gauche) — la grammaire de `RushInfoBanner`.
 * · `pip` : image **sous** le texte, 112 px, `object-cover` — la PiP n'a pas la
 *   place pour une colonne.
 *
 * Le texte est du markdown borné (`RushMarkdown`), les liens sont nommés et leur
 * favicon est résolue par `SiteFavicon` (repli `Globe` local).
 */
function RushCombatLinks({
  links,
  compact = false,
}: {
  links: RushBlockLink[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "flex flex-col gap-1" : "mt-1 flex flex-wrap gap-1.5"}>
      {links.map((link) => (
        <li key={link.url} className="min-w-0">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-border bg-background/60 px-2 py-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <SiteFavicon url={link.url} className="h-3.5 w-3.5" />
            <span className="truncate">{link.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function RushCombatBanner({
  type,
  title,
  bodyText,
  imageUrl,
  links,
  surface = "page",
  className,
}: {
  type: RushCombatBlockType | string;
  title?: string | null;
  /** Texte markdown borné (gras, italique, titres, listes, liens, couleurs). */
  bodyText?: string | null;
  imageUrl?: string | null;
  /** `GuideMilestone.links` — lu en tolérance, jamais fait confiance. */
  links?: unknown;
  surface?: "pip" | "page";
  className?: string;
}) {
  const meta = rushCombatBlockMeta(type) ?? RUSH_COMBAT_BLOCK_META.COMBAT_TACTIQUE;
  // Aucune illustration par défaut : les deux visuels du dépôt (`combat-*.webp`) sont
  // des placeholders. Seule l'image importée dans God est affichée (22/11/2026).
  const src = imageUrl ? safeImageUrl(imageUrl) : null;
  const parsedLinks = parseRushBlockLinks(links);
  const blocks = parseRushMarkdown(bodyText);
  const rail = meta.rail === "success" ? "bg-success" : "bg-warning";
  /** Densité PiP : mêmes éléments, tailles réduites (la PiP descend à ~360 px). */
  const pip = surface === "pip";

  const hideOnError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
  };

  // Composition CENTRÉE unique (22/11/2026) : même gabarit en `page` et en `pip`,
  // seules les tailles changent. L'ancien bandeau collait le texte à gauche et
  // poussait une illustration à droite — illisible en PiP et sans rapport avec la
  // carte « Dofus obtenu ». Le corps markdown garde son alignement à gauche (listes,
  // liens) mais dans une colonne centrée et bornée.
  return (
    <section
      data-tone={meta.rail}
      className={cn(
        "rush-carnet relative my-3 w-full select-none overflow-hidden rounded-[6px] bg-surface",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[2px]", rail)} />
      <div className={cn("px-4", pip ? "py-3" : "py-4 sm:px-6 sm:py-5")}>
        <div
          className={cn(
            "mx-auto flex w-full max-w-prose flex-col items-center text-center",
            pip ? "gap-1.5" : "gap-2",
          )}
        >
          <span className="flex items-center justify-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {meta.kicker}
          </span>
          {title && (
            <h3
              className={cn(
                "font-[family-name:var(--da-font-title)] font-semibold leading-tight text-foreground",
                pip ? "text-sm" : "text-base sm:text-lg",
              )}
            >
              {title}
            </h3>
          )}
          {blocks.length > 0 && (
            <div className="w-full text-left">
              <RushMarkdown blocks={blocks} />
            </div>
          )}
          {parsedLinks.length > 0 && (
            <div className="flex w-full flex-wrap justify-center">
              <RushCombatLinks links={parsedLinks} compact={pip} />
            </div>
          )}
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              onError={hideOnError}
              className={cn(
                "mt-1 max-w-full rounded-[4px] object-contain",
                pip ? "h-24" : "h-32 sm:h-40",
              )}
            />
          )}
        </div>
      </div>
    </section>
  );
}
