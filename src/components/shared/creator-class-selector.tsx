"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Swords } from "lucide-react";

import { GameIcon } from "@/components/shared/game-icon";
import { getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import type { UserPlayableCharacter } from "@/lib/user-character-classes";
import { getMyPlayableCharacters } from "@/server/actions/character-class-actions";

/**
 * Cache **par guilde** du roster côté client.
 *
 * Les cinq surfaces (création/édition DJ, création/édition Songes, calendrier) montent ce
 * sélecteur à tour de rôle ; sans cache, chaque ouverture relance une action serveur, et un
 * rechargement à chaud **abandonne les requêtes en vol** — d'où les
 * `uncaughtException: Error: aborted` / `ECONNRESET` dans la console de `next dev`.
 */
const rosterCache = new Map<string, Promise<UserPlayableCharacter[]>>();

function loadRoster(guildId: string): Promise<UserPlayableCharacter[]> {
    const cached = rosterCache.get(guildId);
    if (cached) return cached;
    const pending = getMyPlayableCharacters(guildId)
        .then((res) => res.characters)
        .catch(() => {
            // Échec réseau : on ne fige pas un roster vide dans le cache.
            rosterCache.delete(guildId);
            return [] as UserPlayableCharacter[];
        });
    rosterCache.set(guildId, pending);
    return pending;
}

interface CreatorClassSelectorProps {
    /** Roster déjà connu (ex. Songes : lu avec le reste du formulaire). */
    characters?: UserPlayableCharacter[];
    /** Sinon : le roster est chargé depuis le profil (serveur), une seule fois. */
    guildId?: string;
    /** Classe choisie — nom canonique (`Cra`, `Féca`…). */
    value: string | null;
    onChange: (classe: string | null) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
}

/**
 * Sélecteur de classe du **créateur** d'un post (donjons, songes, calendrier).
 *
 * Règle unique : on ne propose QUE ce que le membre possède — personnage principal et
 * mules de son profil SigilOS. Une classe absente du roster n'est pas sélectionnable,
 * et le serveur revalide de toute façon (`resolveOwnedClass`, fail-closed) : ce composant
 * est un confort, pas la garde.
 *
 * Défaut : le personnage principal, dès que le roster est connu (aucune classe inventée).
 */
export function CreatorClassSelector({
    characters,
    guildId,
    value,
    onChange,
    label = "Ma classe pour cette activité",
    description,
    disabled = false,
}: CreatorClassSelectorProps) {
    const [loaded, setLoaded] = useState<UserPlayableCharacter[] | null>(characters ?? null);
    const [loading, setLoading] = useState(false);
    const autoSelected = useRef(false);

    useEffect(() => {
        if (characters || !guildId) return;
        let cancelled = false;
        setLoading(true);
        loadRoster(guildId)
            .then((characters) => { if (!cancelled) setLoaded(characters); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [characters, guildId]);

    const roster = characters ?? loaded ?? [];

    // Pré-sélection du personnage principal (une seule fois : un choix explicite du
    // membre n'est jamais écrasé par un rendu ultérieur).
    useEffect(() => {
        if (autoSelected.current || value || roster.length === 0) return;
        autoSelected.current = true;
        onChange(roster[0].classe);
    }, [roster, value, onChange]);

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                {roster.length > 1 ? (
                    <span className="text-caption text-muted-foreground/70">{roster.length} personnages</span>
                ) : null}
            </div>

            {loading && roster.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement de ton profil…
                </p>
            ) : roster.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface/40 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Aucune classe sur ton profil. Renseigne ton personnage principal et tes mules
                        pour pouvoir choisir ici.
                    </p>
                </div>
            ) : (
                <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
                    {roster.map((character) => {
                        const cls = getClass(character.classe);
                        const selected = value === character.classe;
                        return (
                            <button
                                key={`${character.pseudo}-${character.classe}`}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                title={`${character.pseudo} — ${character.classe}`}
                                disabled={disabled}
                                onClick={() => onChange(character.classe)}
                                className={cn(
                                    "group flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40",
                                    selected
                                        ? "border-foreground/25 bg-elevated"
                                        : "border-border bg-surface/40 hover:border-border-strong hover:bg-surface",
                                    disabled && "opacity-60"
                                )}
                            >
                                <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60"
                                    style={cls ? { backgroundColor: `${cls.color}1f` } : undefined}
                                >
                                    {cls ? (
                                        <GameIcon src={cls.icon} className="h-5 w-5" />
                                    ) : (
                                        <Swords className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1.5">
                                        <span className="block max-w-[9rem] truncate text-xs font-semibold text-foreground">
                                            {character.pseudo}
                                        </span>
                                        {character.isMain ? (
                                            <span className="rounded-md bg-surface px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/50">
                                                Main
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block truncate text-caption text-muted-foreground">
                                        {character.classe}
                                        {character.level ? ` · Nv ${character.level}` : ""}
                                    </span>
                                </span>
                                <span
                                    className={cn(
                                        "ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                        selected ? "border-info/60 bg-info/15" : "border-border"
                                    )}
                                >
                                    {selected ? <Check className="h-2.5 w-2.5 text-info" aria-hidden="true" /> : null}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {description && roster.length > 0 ? (
                <p className="text-caption text-muted-foreground/80 leading-relaxed">{description}</p>
            ) : null}
        </div>
    );
}
