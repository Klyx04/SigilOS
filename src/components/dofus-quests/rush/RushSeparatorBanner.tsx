"use client";

import { safeImageUrl } from "@/lib/security";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les deux surfaces (dashboard membre + guide public) : le
 * séparateur se dessine ici, jamais deux fois. Grammaire anti-slop tenue :
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
}: {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  accentColor?: string | null;
}) {
  const accent = accentColor || "#e6b96b";
  const src = imageUrl ? safeImageUrl(imageUrl) : "";

  return (
    <section className="relative my-6 flex select-none items-stretch overflow-hidden rounded-[6px] border border-border bg-surface">
      <span aria-hidden="true" className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
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
          className="hidden h-auto w-32 shrink-0 object-cover sm:block md:w-40"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,0.95), transparent)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.95), transparent)",
          }}
        />
      )}
    </section>
  );
}
