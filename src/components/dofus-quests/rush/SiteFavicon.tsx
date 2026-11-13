"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { hostOfRushLink } from "@/lib/rush-block-links";

/**
 * Favicon d'un lien externe (12/11/2026) — avec repli local.
 *
 * 🎯 Un bloc Combat / Conseil peut pointer une vidéo YouTube ou un guide écrit :
 * la favicon du site rend le lien identifiable d'un coup d'œil. Le service
 * `icons.duckduckgo.com` sert l'icône par hôte ; il est appelé **côté client**,
 * en `lazy`, sans référent. Si le réseau, le service ou le site échoue, on
 * retombe sur un `Globe` local — jamais une image cassée.
 */
export function SiteFavicon({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOfRushLink(url);

  if (!host || failed) {
    return (
      <Globe
        className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("h-4 w-4 shrink-0 rounded-[2px] object-contain", className)}
    />
  );
}
