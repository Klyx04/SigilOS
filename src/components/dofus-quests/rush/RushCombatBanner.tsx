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
  const src = safeImageUrl(imageUrl || meta.image);
  const parsedLinks = parseRushBlockLinks(links);
  const blocks = parseRushMarkdown(bodyText);
  const rail = meta.rail === "success" ? "bg-success" : "bg-warning";

  const hideOnError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
  };

  if (surface === "pip") {
    return (
      <section
        data-tone={meta.rail}
        className={cn(
          "rush-carnet relative my-3 select-none overflow-hidden rounded-[6px] bg-surface",
          className,
        )}
      >
        <div className="flex">
          <span aria-hidden="true" className={cn("w-[2px] shrink-0", rail)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pl-3 pr-3">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {meta.kicker}
            </span>
            {title && (
              <h3 className="font-serif text-sm font-semibold leading-tight text-foreground">
                {title}
              </h3>
            )}
            {blocks.length > 0 && <RushMarkdown blocks={blocks} />}
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onError={hideOnError}
                className="mt-1 h-28 w-full rounded-[4px] object-cover"
              />
            )}
            {parsedLinks.length > 0 && <RushCombatLinks links={parsedLinks} compact />}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-tone={meta.rail}
      className={cn(
        "rush-carnet relative my-3 flex min-h-[96px] select-none items-stretch overflow-hidden rounded-[6px] bg-surface sm:min-h-[112px]",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("w-[2px] shrink-0", rail)} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 sm:px-5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {meta.kicker}
        </span>
        {title && (
          <h3 className="font-serif text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </h3>
        )}
        {blocks.length > 0 && <RushMarkdown blocks={blocks} />}
        {parsedLinks.length > 0 && <RushCombatLinks links={parsedLinks} />}
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={hideOnError}
          className="my-auto h-[96px] w-auto max-w-[42%] shrink-0 self-center object-contain sm:h-[112px]"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,1) 74%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 74%, rgba(0,0,0,0) 100%)",
          }}
        />
      )}
    </section>
  );
}
