"use client";

import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard membre + guide public +
 * overlay PiP) : le séparateur se dessine ici, jamais deux fois. Grammaire anti-slop tenue :
 * un filet d'accent à gauche (l'identité du bloc réglée côté GOD), l'eyebrow
 * mono, le titre fort, la description optionnelle — et, s'il y en a une,
 * l'image du bloc (upload GOD, scope `guides`) à DROITE. Elle est dans le flux,
 * remplit la hauteur du bandeau et se fond vers le texte : même grammaire que
 * les autres blocs (aucun cadre, aucune tuile, aucun dégradé décoratif).
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
        // Bandeau plat + hauteur MINIMALE : l'image a une vraie surface et le texte est
        // centré DANS le bandeau (verticalement et horizontalement, dans la zone que
        // l'image lui laisse). La hauteur ne dépend jamais de l'image.
        "relative my-6 flex min-h-[96px] select-none items-stretch overflow-hidden rounded-[6px] border border-border bg-surface sm:min-h-[144px]",
        className
      )}
    >
      <span aria-hidden="true" className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-4 py-3.5 text-center sm:px-5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.055em]" style={{ color: accent }}>
          Étape charnière
        </span>
        <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{title}</h2>
        {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          // L'image s'ADAPTE : hauteur = celle du bandeau, largeur déduite de SON ratio
          // (`object-contain` + `w-auto` ⇒ jamais rognée, jamais déformée). Elle s'aligne
          // à droite et son bord gauche se fond dans le bandeau.
          className="my-auto h-[96px] w-auto max-w-[46%] shrink-0 self-center object-contain sm:h-[144px]"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 100%)",
          }}
        />
      )}
    </section>
  );
}
