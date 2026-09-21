"use client";

import type { ReactNode } from "react";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * RushInfoBanner — le bandeau d'un bloc CONSEIL / TIPS (type `INFO`) du Rush Sylvestre.
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard membre + guide public + overlay PiP).
 * Motif du correctif (20/09/2026) : côté public, un bloc INFO s'affichait comme un
 * **chapitre** (« Chapitre 0 · 0/0 étapes (0%) » et un bouton « Tout valider » qui ne
 * pouvait rien valider), alors que le dashboard montrait un bandeau — deux rendus pour un
 * même bloc dans un guide partagé, ce qui n'est pas acceptable.
 *
 * Grammaire (anti-slop, alignée sur le bandeau de séparateur) : filet d'accent à gauche,
 * eyebrow mono dont le **registre** vient de la couleur (Attention / À savoir / Astuce /
 * Conseil) avec le picto **intégré à l'eyebrow** (fini l'émoji perdu seul dans son coin),
 * titre fort, texte, et l'image du bloc (upload GOD, scope `guides`) à DROITE : hauteur du
 * bandeau, largeur déduite de son ratio (`object-contain` ⇒ jamais rognée), fondue vers le
 * texte. URL non sûre ou asset absent ⇒ pas d'image, pas de trou.
 */
export function RushInfoBanner({
  title,
  children,
  imageUrl,
  accentColor,
  className,
}: {
  title?: string | null;
  /** Contenu du conseil — fourni par l'appelant (chaque surface a son rendu de liens). */
  children: ReactNode;
  imageUrl?: string | null;
  accentColor?: string | null;
  className?: string;
}) {
  const color = accentColor || "#10b981";
  const { label, icon } = infoBannerTone(color);
  const src = imageUrl ? safeImageUrl(imageUrl) : "";

  return (
    <section
      className={cn(
        "relative my-3 flex min-h-[96px] select-none items-stretch overflow-hidden rounded-[6px] border sm:min-h-[112px]",
        className
      )}
      style={{
        borderColor: `${color}30`,
        background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.5) 50%, ${color}08 100%)`,
      }}
    >
      <span aria-hidden="true" className="w-[3px] shrink-0" style={{ backgroundColor: color }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 sm:px-5">
        <span
          className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.055em]"
          style={{ color }}
        >
          <span aria-hidden="true" className="text-[12px] leading-none">{icon}</span>
          {label}
        </span>
        {title && <h3 className="text-base font-bold leading-tight text-foreground">{title}</h3>}
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

/** Registre du bandeau, déduit de la couleur d'accent choisie côté GOD (même logique qu'au studio). */
export function infoBannerTone(accentColor?: string | null): { label: string; icon: string } {
  const c = (accentColor || "").toLowerCase();
  if (c.startsWith("#ef") || c.startsWith("#f4") || c.startsWith("#f5") || c.startsWith("#eab") || c.startsWith("#dc") || c.startsWith("#f9")) {
    return { label: "Attention", icon: "⚠️" };
  }
  if (c.startsWith("#3b") || c.startsWith("#06") || c.startsWith("#4f") || c.startsWith("#63") || c.startsWith("#0e") || c.startsWith("#38")) {
    return { label: "À savoir", icon: "📖" };
  }
  if (c.startsWith("#7c") || c.startsWith("#a8") || c.startsWith("#8b") || c.startsWith("#c0")) {
    return { label: "Astuce", icon: "🔮" };
  }
  return { label: "Conseil", icon: "💡" };
}
