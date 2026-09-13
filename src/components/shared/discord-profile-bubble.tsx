"use client";

/**
 * S8.14 — **bulle profil mutualisée** (avatar Discord + pseudo + classe).
 *
 * Patron repris de `OptimizedGuideClient` + `discord-avatar-image` : une seule
 * définition pour la fiche d'annonce (vendeur), le centre de négociation
 * (demandeurs / acheteurs) et « Mon espace ».
 *
 * 🔒 Contrat de données : le DTO est **minimal** (`id`, `name`, `image`,
 * `classe`). `id` est un identifiant **interne** (`UserProfile.id`) — jamais un
 * snowflake Discord. Ce composant est **purement présentationnel** : aucune
 * action, aucun appel serveur, donc aucune surface d'attaque. Le pseudo n'est
 * affiché que dans le dashboard (privé à la guilde) — **jamais** dans un embed
 * Discord (§13.7).
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClassIcon } from "@/components/shared/class-icon";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { cn } from "@/lib/utils";

/** DTO **minimal** d'un profil affiché en bulle (S8.14). */
export type DiscordProfileDTO = {
    /** `UserProfile.id` **interne** (jamais un identifiant Discord). */
    id: string;
    /** Pseudo Dofus (repli : nom d'utilisateur SigilOS). */
    name: string;
    /** Avatar Discord (`User.image`) — `null` ⇒ repli initiales. */
    image?: string | null;
    /** Classe Dofus déclarée (`UserProfile.classe`) — optionnelle. */
    classe?: string | null;
};

/** Initiales de secours quand l'avatar Discord est indisponible. */
function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function DiscordProfileBubble({
    profile,
    label,
    size = "md",
    className,
}: {
    /** `null` ⇒ rien n'est rendu (jamais une bulle vide). */
    profile: DiscordProfileDTO | null;
    /** Intitulé au-dessus du pseudo (« Vendeur », « Offre reçue »…). */
    label?: string;
    size?: "sm" | "md";
    className?: string;
}) {
    if (!profile) return null;

    const small = size === "sm";

    return (
        <div className={cn("flex min-w-0 items-center gap-2", className)}>
            <Avatar className={cn(small ? "h-7 w-7" : "h-9 w-9", "shrink-0 border border-border")}>
                <DiscordAvatarImage src={profile.image} alt={profile.name} className="object-cover" />
                <AvatarFallback className="text-[10px] font-black text-muted-foreground">
                    {initialsOf(profile.name)}
                </AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0", small && "flex items-center gap-1.5")}>
                {label && (
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {label}
                    </p>
                )}
                <p className={cn("flex min-w-0 items-center gap-1.5", small ? "text-xs" : "text-label", "font-bold text-foreground")}>
                    <span className="truncate">{profile.name}</span>
                    {profile.classe ? <ClassIcon classId={profile.classe} size={small ? 14 : 16} /> : null}
                </p>
            </div>
        </div>
    );
}
