/**
 * Bloc « Aujourd'hui » du tableau de bord — **illustration du donjon** nommé dans le titre
 * d'un événement d'agenda.
 *
 * **Pourquoi cette règle existe (mesure du 15/10/2026)** : le module DJ ne crée pas
 * d'événement d'agenda (aucun `event.create` dans `dungeon-finder-actions.ts`) — un
 * événement « [DJ] Crypte de Kardorim » est **saisi à la main** et ne porte donc **aucun**
 * identifiant de donjon. La seule source fiable est le **nom** publié par `Dungeon.name`.
 *
 * Le préfixe entre crochets (`[DJ]`, `[Raid]`…) est retiré, la comparaison est insensible à
 * la casse (`mode: "insensitive"`, patron `src/server/actions/game-data-actions.ts:2003`).
 *
 * **Fail-closed** : aucun donjon trouvé ⇒ `null` — jamais une image inventée, et jamais
 * d'exception remontée : un titre douteux ne doit pas casser le tableau de bord.
 *
 * Pas de directive `"use server"` : c'est un module serveur appelé par le composant
 * serveur `src/app/dashboard/[guildId]/page.tsx` (même forme que `seniority-roles-core.ts`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Longueur minimale/maximale d'un nom de donjon exploitable (borne d'entrée). */
const MIN_DUNGEON_NAME_LENGTH = 3;
const MAX_DUNGEON_NAME_LENGTH = 120;

export async function resolveEventDungeonImage(title: string | null | undefined): Promise<string | null> {
    const cleaned = (title ?? "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (cleaned.length < MIN_DUNGEON_NAME_LENGTH || cleaned.length > MAX_DUNGEON_NAME_LENGTH) return null;

    try {
        const dungeon = await db.dungeon.findFirst({
            where: { name: { equals: cleaned, mode: "insensitive" } },
            select: { imageUrl: true },
        });
        return dungeon?.imageUrl ?? null;
    } catch (error) {
        logger.warn("Illustration de donjon indisponible pour un événement", { error: String(error) });
        return null;
    }
}