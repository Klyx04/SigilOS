"use client";

import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Lightbulb, Sparkles } from "lucide-react";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * RushInfoBanner — le bandeau d'un bloc CONSEIL / TIPS (type `INFO`) du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard membre + guide public + overlay PiP).
 *
 * DA « Carnet de campagne » (02/11/2026) : **plus de dégradé teinté par la couleur God**
 * (les blocs vert/rouge/violet « IA »), **plus d'emoji**. Un seul panneau de matière
 * (`rush-carnet`, fond `surface`, filet de bronze, biseau interne), un **sceau de
 * registre** (icône + libellé) et l'image du bloc à droite. La couleur God ne peint
 * plus la carte : elle ne choisit que le registre (Attention / À savoir / Astuce /
 * Conseil), qui reste sémantique (`danger`, `gold`, `success`).
 */
export type RushInfoTone = "attention" | "info" | "astuce" | "conseil";

const TONE_ICON: Record<RushInfoTone, typeof AlertTriangle> = {
  attention: AlertTriangle,
  info: BookOpen,
  astuce: Lightbulb,
  conseil: Sparkles,
};

const TONE_TEXT: Record<RushInfoTone, string> = {
  attention: "text-danger",
  info: "text-gold",
  astuce: "text-gold",
  conseil: "text-success",
};

const TONE_RAIL: Record<RushInfoTone, string> = {
  attention: "bg-danger",
  info: "bg-gold",
  astuce: "bg-gold",
  conseil: "bg-success",
};

/** Une seule table de registre pour les deux bandeaux (INFO de bloc et info_sequence). */
export const RUSH_INFO_TONE_ICON = TONE_ICON;
export const RUSH_INFO_TONE_TEXT = TONE_TEXT;
export const RUSH_INFO_TONE_RAIL = TONE_RAIL;

export function RushInfoBanner({
  title,
  children,
  imageUrl,
  accentColor,
  className,
  collapsible = false,
}: {
  title?: string | null;
  /** Contenu du conseil — fourni par l'appelant (chaque surface a son rendu de liens). */
  children: ReactNode;
  imageUrl?: string | null;
  accentColor?: string | null;
  className?: string;
  /**
   * Overlay uniquement : un bloc CONSEIL devient un DÉPLIABLE (filet haut/bas,
   * `+` à droite) au lieu d'un encadré de 112 px — dans une PiP, un conseil
   * ouvert en permanence coûtait la moitié de la hauteur utile.
   */
  collapsible?: boolean;
}) {
  const tone = infoBannerTone(accentColor);
  const ToneIcon = TONE_ICON[tone.tone];
  const src = imageUrl ? safeImageUrl(imageUrl) : "";

  if (collapsible) {
    return (
      <details
        data-tone={tone.tone}
        className={cn("rush-carnet da-conseil select-none", className)}
      >
        <summary>
          <ToneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{title ? `${tone.label} · ${title}` : tone.label}</span>
        </summary>
        <div className="da-conseil-body">{children}</div>
      </details>
    );
  }

  return (
    <section
      data-tone={tone.tone}
      className={cn(
        "rush-carnet relative my-3 flex min-h-[96px] select-none items-stretch overflow-hidden rounded-[6px] bg-surface sm:min-h-[112px]",
        className
      )}
    >
      {/* Filet de registre : 2 px, sémantique, jamais un fond teinté. */}
      <span aria-hidden="true" className={cn("w-[2px] shrink-0", TONE_RAIL[tone.tone])} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 sm:px-5">
        <span
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
            TONE_TEXT[tone.tone]
          )}
        >
          <ToneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {tone.label}
        </span>
        {title && <h3 className="font-serif text-[15px] font-semibold leading-tight text-foreground">{title}</h3>}
        <div className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{children}</div>
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          // L'image s'adapte : hauteur du bandeau, largeur déduite de SON ratio.
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

/**
 * Registre du bandeau, déduit de la couleur d'accent choisie côté GOD.
 * La couleur ne peint plus rien : elle ne sert qu'à nommer le registre.
 */
export function infoBannerTone(accentColor?: string | null): { label: string; tone: RushInfoTone } {
  const c = (accentColor || "").toLowerCase();
  if (c.startsWith("#ef") || c.startsWith("#f4") || c.startsWith("#f5") || c.startsWith("#eab") || c.startsWith("#dc") || c.startsWith("#f9") || c.startsWith("#e11")) {
    return { label: "Attention", tone: "attention" };
  }
  if (c.startsWith("#3b") || c.startsWith("#06") || c.startsWith("#4f") || c.startsWith("#63") || c.startsWith("#0e") || c.startsWith("#38")) {
    return { label: "À savoir", tone: "info" };
  }
  if (c.startsWith("#7c") || c.startsWith("#a8") || c.startsWith("#8b") || c.startsWith("#c0")) {
    return { label: "Astuce", tone: "astuce" };
  }
  return { label: "Conseil", tone: "conseil" };
}
