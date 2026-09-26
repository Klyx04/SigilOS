/**
 * Catalogue UNIQUE des pictos Dofus utilisés dans les embeds Discord.
 *
 * Pourquoi ce fichier : un embed ne peut afficher une image QUE dans 4 emplacements
 * (`author.icon_url`, `thumbnail`, `image`, `footer.icon_url`) — un nom de field ne
 * contient que du TEXTE. Donc « une icône à côté de Donjon / Succès / d'une classe »
 * n'existe que sous forme d'**emoji**, et Discord n'accepte comme emoji qu'un
 * caractère unicode ou un emoji **custom** (`<:nom:id>`) porté par une application
 * (emojis d'application : jusqu'à 2 000, ≤ 256 Ko, sans permission
 * `USE_EXTERNAL_EMOJIS`, gérés avec le token du bot).
 *
 * Trois règles de conception (tenue long terme) :
 *  · on référence les emojis par **NOM**, jamais par id — les ids sont propres à
 *    chaque application (bêta ≠ prod) et seraient faux ailleurs ;
 *  · chaque entrée porte le **PNG local** (le même asset que le site, via
 *    `DOFUS_CLASSES` / `public/assets/dofus/…`) : le site et Discord ne divergent
 *    jamais (« une notion = un picto, partout ») ;
 *  · chaque entrée porte un **repli unicode** : tant que la synchro des emojis n'a
 *    pas été jouée (ou si Discord tombe), l'embed reste **exactement** comme avant.
 *
 * Fichier PUR : aucun accès réseau, aucun id. Partagé par le serveur (embeds) et par
 * `scripts/sync-discord-app-emojis.ts`.
 */
import { DOFUS_CLASSES } from "@/lib/dofus-assets";

export type DiscordEmojiEntry = {
    /** Nom de l'emoji d'application — clé stable et unique (jamais l'id). */
    name: string;
    /** Chemin du PNG local, relatif à `public/` (source de vérité visuelle). */
    file: string;
    /** Repli unicode si l'emoji custom est indisponible (`""` = rien, comme aujourd'hui). */
    fallback: string;
};

/**
 * Pictos de sections/catégories : asset Dofus existant + l'emoji unicode utilisé
 * aujourd'hui (le repli **est** l'existant → zéro régression avant synchro).
 */
const SECTION_EMOJIS: DiscordEmojiEntry[] = [
    { name: "dofus_dungeon", file: "assets/dofus/icons/crossedSwords.png", fallback: "⚔️" },
    { name: "dofus_quest", file: "assets/dofus/icons/quests.png", fallback: "📜" },
    { name: "dofus_challenge", file: "assets/dofus/icons/challenges.png", fallback: "⚡" },
    { name: "dofus_titan", file: "assets/dofus/icons/titan.png", fallback: "👑" },
    { name: "dofus_success", file: "assets/dofus/icons/success.png", fallback: "🏆" },
    { name: "dofus_trophy", file: "assets/dofus/icons/trophy-icon.png", fallback: "🏅" },
    { name: "dofus_date", file: "assets/dofus/icons/pinClock.png", fallback: "📅" },
    { name: "dofus_calendar", file: "assets/dofus/icons/calendar.png", fallback: "🗓️" },
    { name: "dofus_players", file: "assets/dofus/icons/player.png", fallback: "👥" },
    { name: "dofus_leader", file: "assets/dofus/icons/crown.png", fallback: "👑" },
    { name: "dofus_note", file: "assets/dofus/icons/parchment.png", fallback: "💬" },
    { name: "dofus_waitlist", file: "assets/dofus/icons/hourglass.png", fallback: "⏳" },
    { name: "dofus_open", file: "assets/dofus/icons/unlock.png", fallback: "🔓" },
    { name: "dofus_closed", file: "assets/dofus/icons/lock.png", fallback: "🔒" },
    { name: "dofus_boss", file: "assets/dofus/icons/boss.png", fallback: "👊" },
    { name: "dofus_monster", file: "assets/dofus/icons/waveMonsters.png", fallback: "👹" },
    { name: "dofus_archimonster", file: "assets/dofus/icons/archimonster.png", fallback: "🐲" },
    { name: "dofus_guild", file: "assets/dofus/icons/guild.png", fallback: "🏰" },
    { name: "dofus_world", file: "assets/dofus/icons/world.png", fallback: "🌍" },
    { name: "dofus_treasure", file: "assets/dofus/icons/treasureMap.png", fallback: "🗺️" },
    { name: "dofus_chest", file: "assets/dofus/icons/chest.png", fallback: "🎁" },
    { name: "dofus_skull", file: "assets/dofus/icons/skull.png", fallback: "💀" },
    { name: "dofus_zaap", file: "assets/dofus/icons/zaap.png", fallback: "🧭" },
    { name: "dofus_teleport", file: "assets/dofus/icons/teleport.png", fallback: "🌀" },
    { name: "dofus_bell", file: "assets/dofus/game-icons/bell-on.png", fallback: "🔔" },
    { name: "dofus_party", file: "assets/dofus/game-icons/party.png", fallback: "🎉" },
    { name: "dofus_kamas", file: "assets/dofus/game-icons/kamas.png", fallback: "💰" },
    { name: "dofus_shop", file: "assets/dofus/game-icons/shop.png", fallback: "🛒" },
    { name: "dofus_gift", file: "assets/dofus/game-icons/gift.png", fallback: "🎁" },
    { name: "dofus_rune", file: "assets/dofus/game-icons/rune.png", fallback: "🔮" },
    { name: "dofus_hammer", file: "assets/dofus/game-icons/hammer.png", fallback: "🔨" },
    { name: "dofus_experience", file: "assets/dofus/game-icons/experience.png", fallback: "⭐" },
    { name: "dofus_prism", file: "assets/dofus/game-icons/prism.png", fallback: "🔷" },
    { name: "dofus_shield", file: "assets/dofus/game-icons/shield.png", fallback: "🛡️" },
    { name: "dofus_dofus", file: "assets/dofus/game-icons/dofus.png", fallback: "🥚" },
    { name: "dofus_tick", file: "assets/dofus/game-icons/tick.png", fallback: "✅" },
    { name: "dofus_warning", file: "assets/dofus/game-icons/circle-warning.png", fallback: "⚠️" },
];

/**
 * Pictos d'une CLASSE Dofus (`dofus_class_cra`, …) — générés depuis `DOFUS_CLASSES`
 * (source unique : le site et Discord affichent donc la même icône).
 * Repli `""` : sans synchro, on n'affiche rien (comportement actuel — aucune icône de
 * classe n'existait dans les embeds).
 */
export const CLASS_EMOJI_PREFIX = "dofus_class_";

const CLASS_EMOJIS: DiscordEmojiEntry[] = DOFUS_CLASSES.map((c) => ({
    name: `${CLASS_EMOJI_PREFIX}${c.id}`,
    // `icon` = "/assets/dofus/classes/9.png" → chemin relatif à `public/`.
    file: c.icon.replace(/^\//, ""),
    fallback: "",
}));

export const DISCORD_EMOJIS: Record<string, DiscordEmojiEntry> = Object.fromEntries(
    [...SECTION_EMOJIS, ...CLASS_EMOJIS].map((e) => [e.name, e])
);

/** Toutes les entrées (ordre stable) — utilisé par le script de synchro. */
export const DISCORD_EMOJI_LIST: DiscordEmojiEntry[] = [...SECTION_EMOJIS, ...CLASS_EMOJIS];

/** Nom d'emoji d'une classe à partir de son id **ou** de son nom (« Cra », « cra »). */
export function classEmojiName(classeIdOrName: string | null | undefined): string | null {
    const key = (classeIdOrName || "").trim().toLowerCase();
    if (!key) return null;
    const found = DOFUS_CLASSES.find((c) => c.id === key || c.name.toLowerCase() === key);
    return found ? `${CLASS_EMOJI_PREFIX}${found.id}` : null;
}
