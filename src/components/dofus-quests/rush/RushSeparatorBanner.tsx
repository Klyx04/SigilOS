"use client";

import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard membre + guide public +
 * overlay PiP) : le séparateur se dessine ici, jamais deux fois.
 *
 * Grammaire : un bandeau NU — ni cadre, ni aplat, ni rayon (retour user :
 * « pas de contour ni de fond »). Ne restent que le filet d'accent à gauche
 * (l'identité du bloc réglée côté GOD), le titre fort et la description
 * optionnelle, tous deux CENTRÉS sur toute la largeur. L'image du bloc (upload
 * GOD, scope `guides`), quand il y en a une, est un DÉCOR de droite posé
 * HORS FLUX (absolu + fondu) : elle ne décale donc jamais le texte, qui reste
 * centré dans le bandeau — pas « centré dans ce que l'image laisse ».
 * URL non sûre ou asset absent (401/404) ⇒ pas d'image, pas de trou.
 */
export function RushSeparatorBanner({
  title,
  description,
  imageUrl,
  accentColor,
  className,
}: {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  accentColor?: string | null;
  /** Réglage contextuel (l'overlay PiP resserre ses marges). */
  className?: string;
}) {
  const accent = accentColor || "#e6b96b";
  const src = imageUrl ? safeImageUrl(imageUrl) : "";

  return (
    <section
      className={cn(
        // Bandeau NU : ni cadre, ni aplat, ni rayon. Hauteur MINIMALE pour que l'image
        // ait une vraie surface ; le texte est centré dans le bandeau ENTIER (horizontal
        // ET vertical), jamais dans « ce que l'image laisse ».
        "relative my-6 flex min-h-[96px] select-none items-center overflow-hidden sm:min-h-[144px]",
        className
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-5 text-center sm:px-8">
        <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{title}</h2>
        {description && (
          <p className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          // DÉCOR hors flux : ancré à droite, hauteur = celle du bandeau, largeur déduite
          // de SON ratio (`object-contain` + `w-auto` ⇒ jamais rognée, jamais déformée).
          // `max-w` la borne pour qu'un panorama ne mange pas la page, et le fondu vers la
          // gauche l'amène doucement dans le texte sans jamais le pousser.
          // `pointer-events-none` : elle ne capte ni clic ni survol.
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto max-w-[34%] object-contain opacity-95 sm:max-w-[38%]"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 100%)",
          }}
        />
      )}
    </section>
  );
}
