"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { useResilientAvatarSrc } from "@/hooks/use-resilient-avatar"

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
  // #23 + #134 — Avatar Discord résilient, appliqué à TOUS les avatars : la
  // cascade de secours (normalisation `webp` bornée → miroir
  // `media.discordapp.net` → avatar Discord par défaut officiel → `null`) vit
  // désormais dans `useResilientAvatarSrc`, **mécanique unique** partagée avec
  // `MemberAvatar` (aucun écran ne réimplémente la cascade). Un `null` rend
  // `null` pour laisser l'`AvatarFallback` (initiales) s'afficher.
  // `src` peut être un `Blob` (upload Radix) : le hook ne traite que les strings.
  const { src: currentSrc, onError } = useResilientAvatarSrc(typeof src === "string" ? src : null, 256);

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
        if (status === "error") onError();
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
