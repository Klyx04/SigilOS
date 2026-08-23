"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import {
    normalizeDiscordAvatarUrl,
    discordAvatarErrorFallback,
    extractUserIdFromAvatarUrl,
    getDefaultDiscordAvatar,
} from "@/lib/discord-avatars"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  onLoadingStatusChange,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  // #23 + #134 — Avatar Discord résilient, appliqué à TOUS les avatars :
  //  - normalise les URLs persistées en base (`/avatars/{id}/{hash}.png` sans `?size`)
  //    en `webp` léger, borné à 256px ;
  //  - erreur/429 du CDN principal → bascule sur le miroir `media.discordapp.net` ;
  //  - hash périmé (404 durable → ERR_BLOCKED_BY_ORB) → avatar Discord par défaut
  //    officiel (`embed/avatars/{n}.png`, jamais 404) ;
  //  - dernier recours → rend `null` pour laisser l'`AvatarFallback` (initiales) s'afficher.
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(() =>
    typeof src === "string" ? normalizeDiscordAvatarUrl(src, 256) : null
  );
  const [stage, setStage] = React.useState<0 | 1 | 2>(0);

  React.useEffect(() => {
    setCurrentSrc(typeof src === "string" ? normalizeDiscordAvatarUrl(src, 256) : null);
    setStage(0);
  }, [src]);

  const handleError = () => {
    if (!currentSrc) return;
    // 0 → 1 : on tente d'abord le miroir `media.discordapp.net`.
    if (stage === 0) {
      const mirror = discordAvatarErrorFallback(currentSrc);
      if (mirror && mirror !== currentSrc) {
        setStage(1);
        setCurrentSrc(mirror);
        return;
      }
    }
    // 1 → 2 : le miroir a échoué (ou pas de miroir) → avatar Discord par défaut.
    if (stage <= 1) {
      const userId = extractUserIdFromAvatarUrl(currentSrc);
      const defaultAvatar = getDefaultDiscordAvatar(userId);
      if (defaultAvatar) {
        setStage(2);
        setCurrentSrc(defaultAvatar);
        return;
      }
    }
    // 2 → null : même l'avatar par défaut a échoué → AvatarFallback (initiales).
    setCurrentSrc(null);
  };

  if (!currentSrc) return null;

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={currentSrc}
      loading="lazy"
      decoding="async"
      onLoadingStatusChange={(status) => {
        onLoadingStatusChange?.(status);
        if (status === "error") handleError();
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
