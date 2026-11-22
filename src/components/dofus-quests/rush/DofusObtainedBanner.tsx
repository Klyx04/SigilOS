"use client";

import { dofusObtainedHeading, getDofusMeta, resolveRushDofus } from "@/lib/rush-dofus-meta";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * Bandeau « Obtention Dofus » — SOURCE UNIQUE des trois surfaces.
 *
 * Historique mesuré (22/11/2026) : le dashboard portait une **carte premium centrée**
 * mais avec un titre codé en dur (« VOUS AVEZ OBTENU / LE DOFUS X ! », cassé en
 * « LE DOFUS  ! » sans `dofusId`) ; le guide public l'affichait comme un encart CONSEIL ;
 * l'overlay avait sa propre copie. Ici : la **composition centrée d'origine** est
 * conservée (œuf dans son médaillon, filet d'accent, illustration nue en tête), mais
 * le **titre du studio est le titre** et le Dofus n'est qu'un repère.
 *
 * · Aucune icône générique : les seuls visuels sont des **assets Dofus** (l'œuf et
 *   l'illustration importée dans God), conformément à la règle DA.
 * · Entrée discrète (`animate-in`), coupée par `prefers-reduced-motion` (variantes
 *   `motion-safe:` — aucune animation imposée).
 * · `page` / `pip` : mêmes proportions, le médaillon et les paddings se réduisent en
 *   PiP ; la carte reste **pleine largeur** (plus de `max-w-md` qui flottait).
 */
export function DofusObtainedBanner({
  milestone,
  surface = "page",
  className,
}: {
  milestone: {
    title?: string | null;
    description?: string | null;
    dofusId?: string | null;
    imageUrl?: string | null;
    accentColor?: string | null;
  };
  surface?: "pip" | "page";
  className?: string;
}) {
  const pip = surface === "pip";
  const dofus = resolveRushDofus(milestone.dofusId, milestone.title) ?? getDofusMeta(milestone.dofusId);
  // `#d4a853` = l'accent du type dans la palette du studio (RushEditorStudio).
  const color = milestone.accentColor || dofus?.color || "#d4a853";
  const heading = dofusObtainedHeading(milestone.title, milestone.dofusId);
  const description = milestone.description?.trim() || null;
  const image = milestone.imageUrl ? safeImageUrl(milestone.imageUrl) : null;

  return (
    <section data-tone="gold" className={cn("my-4 w-full select-none", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[6px] border",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500",
        )}
        style={{
          borderColor: `${color}35`,
          background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.5) 50%, ${color}06 100%)`,
        }}
      >
        {/* Illustration importée dans God : posée en tête, NUE (l'œuf du Dofus reste
            le repère du type, l'image est l'illustration de l'obtention). */}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className={cn("w-full object-contain", pip ? "max-h-28" : "max-h-40")}
          />
        )}

        <div
          className={cn(
            "flex flex-col items-center text-center",
            pip ? "gap-2.5 px-4 py-5" : "gap-3 px-5 py-6 sm:gap-4 sm:px-6 sm:py-8",
          )}
        >
          {dofus && (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full border-2",
                pip ? "h-16 w-16 p-1.5" : "h-20 w-20 p-2 sm:h-24 sm:w-24",
              )}
              style={{ borderColor: `${color}50`, background: "rgba(0,0,0,0.6)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dofus.imageUrl}
                alt={dofus.label}
                title={dofus.label}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Dofus obtenu
          </p>

          <h3
            className={cn(
              "font-[family-name:var(--da-font-title)] font-semibold uppercase leading-tight tracking-[0.06em] text-balance",
              pip ? "text-base" : "text-lg sm:text-2xl",
            )}
            style={{ color }}
          >
            {heading}
          </h3>

          {description && (
            <p
              className={cn(
                "max-w-prose leading-relaxed text-muted-foreground",
                pip ? "text-[11px]" : "text-sm",
              )}
            >
              {description}
            </p>
          )}

          <span
            aria-hidden="true"
            className={cn("h-px", pip ? "w-20" : "w-28")}
            style={{ background: `linear-gradient(90deg, transparent, ${color}90, transparent)` }}
          />
        </div>
      </div>
    </section>
  );
}

