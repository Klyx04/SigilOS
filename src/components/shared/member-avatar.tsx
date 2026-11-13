"use client";

import { useResilientAvatarSrc } from "@/hooks/use-resilient-avatar";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
    /** URL d'avatar du membre (`userAvatar`, `avatarUrl`, `User.image`…). */
    src?: string | null;
    /** Nom affiché : sert aux initiales de repli et, par défaut, au `alt`. */
    name?: string | null;
    /** `alt` explicite — vide par défaut quand le nom est déjà écrit à côté. */
    alt?: string;
    /** Classes de la pastille (taille, forme, bordure) ; `h-full w-full` par défaut. */
    className?: string;
    /** Classes de l'image. */
    imgClassName?: string;
    /** Classes des initiales de repli. */
    fallbackClassName?: string;
    /** Astuce au survol (nom complet quand l'avatar est réduit). */
    title?: string;
}

/**
 * Avatar de membre Discord — **la seule façon d'afficher un avatar de membre**.
 *
 * Pourquoi ce composant existe : le hash d'avatar est figé dans `User.image` au
 * login OAuth. Quand un membre change d'avatar sur Discord, l'ancien hash répond
 * 404 (mesuré le 16/10/2026 : `cdn.discordapp.com/avatars/…/*.png` → 404) et les
 * écrans qui affichaient un `<img>` brut laissaient une image brisée. Ici, la
 * cascade `useResilientAvatarSrc` (CDN → miroir → avatar Discord par défaut →
 * initiales) s'applique **partout**, comme dans l'annuaire depuis #835.
 *
 * Le DOM rendu est volontairement celui des écrans existants — une pastille
 * dimensionnée par l'appelant (`className`) contenant l'image (`h-full w-full`) :
 * remplacer un `<img>` par `<MemberAvatar>` ne change donc aucune mise en page.
 */
export function MemberAvatar({
    src,
    name,
    alt,
    className,
    imgClassName,
    fallbackClassName,
    title,
}: MemberAvatarProps) {
    const { src: resolvedSrc, onError } = useResilientAvatarSrc(src);
    const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

    return (
        <span
            data-slot="member-avatar"
            className={cn("inline-flex h-full w-full shrink-0 items-center justify-center overflow-hidden", className)}
            title={title}
        >
            {resolvedSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar Discord : hôte externe, cascade de repli gérée par le hook
                <img
                    src={resolvedSrc}
                    alt={alt ?? ""}
                    className={cn("h-full w-full object-cover", imgClassName)}
                    onError={onError}
                    referrerPolicy="no-referrer"
                />
            ) : (
                <span className={cn("flex h-full w-full items-center justify-center", fallbackClassName)}>{initial}</span>
            )}
        </span>
    );
}
