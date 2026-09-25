"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";
import { parseBlockMeta } from "@/lib/rush-rich-meta";
import { RushCoordinateChip } from "./RushCoordinateChip";

/**
 * RushRichText — le texte des encarts CONSEIL / TIPS, rendu UNE fois pour les trois
 * surfaces (dashboard membre, guide public, overlay PiP).
 *
 * Demande user (21/09/2026 + 25/09/2026) : « dans les bandeaux de type tips/conseil je peux ajouter
 * n'importe où dans le texte un lien, une ou plusieurs positions cliquables presse-papier
 * en /w x,y … l'url doit pas être dispo mais le nom de la quête pointera vers l'url.
 * Que les positions soient toujours au même endroit dans le guide dashboard/overlay etc. ».
 *
 * `normalizeMeta = true` : extrait la position et le lien pour les afficher de manière
 * structurée et fixe (position TOUJOURS à gauche, lien TOUJOURS à côté, texte descriptif séparé).
 */
export function RushRichText({
  text,
  className,
  normalizeMeta = false,
}: {
  text: string | null | undefined;
  className?: string;
  normalizeMeta?: boolean;
}) {
  if (!text) return null;

  if (normalizeMeta) {
    const meta = parseBlockMeta(text);
    if (meta.coord || meta.linkUrl) {
      return (
        <div className={cn("flex flex-col gap-1.5", className)}>
          {meta.text && (
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{meta.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {meta.coord && (
              <RushCoordinateChip coordText={meta.coord} showIcon />
            )}
            {meta.linkUrl && (
              <RushTextLink
                label={meta.linkLabel || bareLinkLabel(meta.linkUrl)}
                href={meta.linkUrl}
              />
            )}
          </div>
        </div>
      );
    }
  }

  const parts = splitRichText(text);

  return (
    <span className={cn("contents", className)}>
      {parts.map((part, i) => {
        if (part.kind === "text") return <React.Fragment key={i}>{part.value}</React.Fragment>;
        if (part.kind === "link") return <RushTextLink key={i} label={part.label} href={part.href} />;
        return <RushCoordinateChip key={i} coordText={`${part.x}, ${part.y}`} showIcon />;
      })}
    </span>
  );
}

/** Lien externe du texte enrichi : le libellé est cliquable, l'URL reste invisible. */
function RushTextLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-bold text-success underline decoration-success/50 underline-offset-2 transition-colors hover:text-success"
    >
      {label}
      <ExternalLink className="ml-0.5 inline-block h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
    </a>
  );
}

/** Un morceau de texte enrichi : du texte nu, un lien nommé, ou une position copiable. */
type RushRichTextPart =
  | { kind: "text"; value: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "coord"; x: number; y: number };

/**
 * Découpe un texte en morceaux rendus. Fonction PURE (exportée pour être verrouillée par
 * les tests sans DOM) : `[libellé](url)` · URL brute · position (canonique, `/w`, `/travel`).
 */
export function splitRichText(text: string): RushRichTextPart[] {
  const parts: RushRichTextPart[] = [];
  // Un seul passage. L'ordre des alternatives compte : le lien nommé AVANT la position,
  // sinon `[Eternelle Moisson](…)` serait lu comme une position `[x, y]`.
  const rx = new RegExp(
    [
      /\[([^\]]+)\]\(([^)\s]+)\)/.source, // 1 · libellé   2 · url
      /(https?:\/\/[^\s]+)/.source, // 3 · url brute
      /\[\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(\d+))?\s*\]/.source, // 4 · x  5 · y  6 · world
      /\/(?:w|travel)\s+(-?\d+)\s*[,;]?\s*(-?\d+)(?:\s*,\s*(\d+))?(?!\d)/.source, // 7 · x  8 · y  9 · world
    ].join("|"),
    "gi"
  );

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    last = rx.lastIndex;

    if (m[1] && m[2]) {
      // `[libellé](url)` : le libellé pointe, l'URL ne s'affiche JAMAIS.
      const href = safeImageUrl(m[2]);
      parts.push(href ? { kind: "link", label: m[1], href } : { kind: "text", value: m[1] });
      continue;
    }
    if (m[3]) {
      // Une ponctuation collée à l'URL n'en fait pas partie (« …/quete. » en fin de phrase).
      const punct = /[.,;:!?]+$/.exec(m[3])?.[0] ?? "";
      const url = punct ? m[3].slice(0, -punct.length) : m[3];
      if (punct) {
        rx.lastIndex -= punct.length;
        last = rx.lastIndex;
      }
      // URL non sûre (caractère HTML) ⇒ aucune ancre, on rend le texte tel quel : fail-closed.
      const href = safeImageUrl(url);
      parts.push(href ? { kind: "link", label: bareLinkLabel(url), href } : { kind: "text", value: url });
      continue;
    }
    const rawX = m[4] ?? m[7];
    const rawY = m[5] ?? m[8];
    if (rawX !== undefined && rawY !== undefined) {
      // La dimension (3ᵉ nombre de `[x, y, world]`) n'est pas rendue ici : la puce copie la
      // commande 2D du jeu. Le monde reste utile aux chips de la ligne d'étape (dashboard).
      parts.push({ kind: "coord", x: parseInt(rawX, 10), y: parseInt(rawY, 10) });
    }
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

/**
 * Libellés courts des domaines connus du module.
 *
 * ⚠️ La comparaison se fait sur le **hostname analysé**, jamais par sous-chaîne :
 * `https://evil.com/?x=dofusdb.fr` s'affichait comme « Lien DofusDB » (règle CodeQL
 * `js/incomplete-url-substring-sanitization`, alerte du 21/09/2026).
 */
const KNOWN_DOMAIN_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["dofusdb.fr", "Lien DofusDB"],
  ["dofuspourlesnoobs.com", "Lien DofusNoobs"],
];

/**
 * Libellé d'une URL écrite crue dans un texte : jamais la bouillie `https://…/chemin`.
 * Les deux sites du module ont leur nom, le reste tombe sur son domaine seul.
 */
export function bareLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (!host) return "Lien";
    for (const [domain, label] of KNOWN_DOMAIN_LABELS) {
      // Égalité de domaine ou vrai sous-domaine (suffixe borné par un point), jamais une
      // sous-chaîne libre : `dofusdb.fr.evil.com` et `evil.com/?x=dofusdb.fr` sont rejetés.
      if (host === domain || host.endsWith(`.${domain}`)) return label;
    }
    return host;
  } catch {
    return "Lien";
  }
}
