import { cn } from "@/lib/utils";

/**
 * Pictos d'interface Dofus — `public/assets/dofus/icons/<fichier>.png`.
 *
 * Même référentiel que `SuccesClient`, `ladder-client` et `PublicBossCatalogClient`
 * (crossedSwords = donjon/raid, quests = quête, challenges = défi, success =
 * succès, crown = classement, hourglass = temps…) : une notion = un picto, partout.
 * Sans cette table, chaque module finissait avec son propre emoji coloré pour la
 * même idée — c'est exactement ce qui donnait l'effet « maquette IA ».
 *
 * Le rendu passe par `<img>` (et non `next/image`) : ces PNG font moins de 3 ko et
 * sont déjà à l'échelle 2x, l'optimiseur n'apporte rien et imposerait des
 * dimensions déclaratives partout. Convention du repo (voir `SuccesQuestsTab`).
 */
export const DOFUS_UI_ICON_FILES = {
    dungeon: "crossedSwords",
    quest: "quests",
    challenge: "challenges",
    titan: "titan",
    boss: "boss",
    monster: "waveMonsters",
    archimonster: "archimonster",
    success: "success",
    trophy: "trophy-icon",
    date: "pinClock",
    calendar: "calendar",
    open: "unlock",
    closed: "lock",
    leader: "crown",
    guild: "guild",
    player: "player",
    treasure: "treasureMap",
    hourglass: "hourglass",
    skull: "skull",
    chest: "chest",
    world: "world",
} as const;

export type DofusUiIconName = keyof typeof DOFUS_UI_ICON_FILES;

interface DofusUiIconProps {
    name: DofusUiIconName;
    /** Côté en pixels (les fichiers sont en 2x, ils restent nets). */
    size?: number;
    className?: string;
    /** Renseigné ⇒ icône porteuse de sens (lue par les lecteurs d'écran). */
    alt?: string;
}

export function DofusUiIcon({ name, size = 16, className, alt = "" }: DofusUiIconProps) {
    return (
        <img
            src={`/assets/dofus/icons/${DOFUS_UI_ICON_FILES[name]}.png`}
            alt={alt}
            aria-hidden={alt ? undefined : true}
            draggable={false}
            className={cn("object-contain select-none shrink-0", className)}
            style={{ width: size, height: size }}
        />
    );
}
