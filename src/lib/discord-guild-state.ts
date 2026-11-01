/**
 * État d'une guilde **déployée** face aux interactions Discord — règle pure, sans I/O.
 *
 * 🐛 Mesure du 01/11/2026 : un soft-delete (`GuildConfig.isActive=false` / `deletedAt`) ferme le
 * site, mais **pas Discord** — les messages et leurs boutons survivent, et la résolution par
 * `discordGuildId` ne filtre pas l'état. Un clic continuait donc d'écrire sur une guilde
 * désactivée. Le refus est décidé ici, une seule fois, pour toutes les interactions.
 *
 * - `absent` : la guilde n'a pas de config (pas encore déployée) → comportement inchangé ;
 * - `error`  : la lecture a échoué → **fail-closed**, on ne devine pas un droit.
 */
export type GuildActivityState = "active" | "inactive" | "absent" | "error";

export function resolveGuildActivityState(
    row: { isActive: boolean; deletedAt: Date | string | null } | null,
): GuildActivityState {
    if (!row) return "absent";
    return !row.isActive || Boolean(row.deletedAt) ? "inactive" : "active";
}
