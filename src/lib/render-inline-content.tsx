import React from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * Parse /travel X,Y patterns from text and render them as clickable position badges.
 * Also supports markdown-style links [text](url).
 */
export function renderInlineContent(
  text: string,
  options?: { linkColor?: string; positionColor?: string }
): (string | React.ReactNode)[] {
  const parts: (string | React.ReactNode)[] = [];
  const linkColor = options?.linkColor || "text-emerald-300";
  const posColor = options?.positionColor || "text-indigo-300";

  // Combined regex: travel positions OR markdown links OR bare URLs
  const combined = /\/travel\s+(-?\d+)\s*[,;\s]\s*(-?\d+)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // /travel X,Y
      const x = match[1];
      const y = match[2];
      const posStr = `${x},${y}`;
      parts.push(
        <span
          key={`travel-${match.index}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-caption font-mono font-bold ${posColor} hover:bg-indigo-500/20 transition-all cursor-pointer shrink-0`}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(`/travel ${x} ${y}`).then(() => {
              toast.success(`📍 Position ${posStr} copiée !`, { duration: 1500, icon: "📋" });
            }).catch(() => {});
          }}
          title={`Cliquer pour copier /travel ${x} ${y}`}
        >
          <MapPin className="w-3 h-3 text-indigo-400" />
          <span>{posStr}</span>
        </span>
      );
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // [text](url) markdown link
      const label = match[3];
      const url = match[4];
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors ${linkColor} hover:opacity-80 decoration-white/20`}
        >
          {label}
          <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-70 shrink-0" />
        </a>
      );
    } else if (match[5] !== undefined) {
      // Bare URL
      let label = match[5];
      // Sécurité (CodeQL js/incomplete-url-substring-sanitization) : hostname parsé,
      // pas d'includes() naïf — l'URL reste toujours du https?:// (regex) → href sûr.
      const bareHost = (() => {
        try { return new URL(match[5]).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return ""; }
      })();
      if (bareHost === "dofusdb.fr" || bareHost.endsWith(".dofusdb.fr")) label = "Lien DofusDB ↗";
      else if (bareHost === "dofuspourlesnoobs.com" || bareHost.endsWith(".dofuspourlesnoobs.com")) label = "Lien DofusNoobs ↗";
      parts.push(
        <a
          key={`url-${match.index}`}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors ${linkColor} hover:opacity-80 decoration-white/20`}
        >
          {label}
          <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-70 shrink-0" />
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}