"use client";

import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";
import { RushRichText } from "./RushRichText";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les quatre surfaces (dashboard membre + guide public + overlay
 * interne + overlay public) : le séparateur se dessine ici, jamais deux fois.
 *
 * Grammaire (retour user du 21/09/2026) : **plus de barre de couleur sur le côté** et
 * **plus de cadre** — l'identité du bloc passe par une composition centrée :
 *
 *     ────────  ◆  TITRE  ◆  ────────
 *
 * deux filets qui s'effacent vers l'extérieur, un losange d'accent (couleur réglée côté
 * GOD) de part et d'autre du titre, titre en capitales espacées. La description reste
 * dessous, centrée et sobre.
 *
 * L'image du bloc (upload GOD, scope `guides`), quand il y en a une, est un DÉCOR de
 * droite posé HORS FLUX (absolu + fondu) : elle ne décale donc jamais le texte.
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
        // Bandeau NU et sans barre latérale. Hauteur MINIMALE pour que le décor de droite
        // ait une vraie surface ; le texte reste centré dans le bandeau ENTIER.
        "relative my-7 flex min-h-[84px] select-none items-center overflow-hidden sm:min-h-[116px]",
        className
      )}
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-5 text-center sm:px-8">
        {/* Composition : filet — losange — TITRE — losange — filet. */}
        <div className="flex w-full max-w-[46rem] items-center gap-3 sm:gap-4">
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ backgroundColor: accent }} />
          <h2 className="text-sm font-semibold uppercase leading-tight tracking-[0.18em] text-foreground sm:text-[0.9375rem]">
            {title}
          </h2>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ backgroundColor: accent }} />
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </div>
        {description && (
          <div className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground flex justify-center">
            <RushRichText text={description} normalizeMeta />
          </div>
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
