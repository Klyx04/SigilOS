"use client";

import { AvatarImage } from "@/components/ui/avatar";

interface DiscordAvatarImageProps {
    src?: string | null;
    alt?: string;
    className?: string;
}

/**
 * #23 + #134 — Avatar Discord résilient.
 *
 * Conservé pour compatibilité : délègue désormais au composant partagé
 * `AvatarImage` (`@/components/ui/avatar`) qui applique en interne la cascade de
 * secours (CDN → miroir `media.discordapp.net` → avatar Discord par défaut
 * → initiales) à tous les avatars. Le `src` null/undefined rend `null` afin de
 * laisser l'`AvatarFallback` du parent s'afficher.
 */
export function DiscordAvatarImage({ src, alt, className }: DiscordAvatarImageProps) {
    return <AvatarImage src={src ?? undefined} alt={alt} className={className} />;
}
