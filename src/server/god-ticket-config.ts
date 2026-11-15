/**
 * 🎫 God — lecture runtime de la configuration du support (G4-3).
 *
 * Appelée par le panneau Discord et par `createSupportTicket`. Aucune garde
 * d'authentification ici : la route d'interactions est déjà vérifiée par
 * signature Ed25519, et le panneau God passe par ses actions gardées.
 *
 * Une base vide ou Discord indisponible ne doit jamais inventer une
 * destination : les défauts (quatre catégories, aucun serveur) sont renvoyés
 * tels quels, et l'appelant refuse s'il manque le serveur ou le salon.
 */

import { db } from "@/lib/prisma";
import {
    resolveGodTicketCategories,
    resolveGodTicketConfig,
    type GodTicketCategoryRow,
    type GodTicketConfigView,
} from "@/lib/tickets/god-config";

export type GodTicketRuntime = {
    config: GodTicketConfigView;
    /** Toutes les catégories, actives ou non, dans l'ordre d'affichage. */
    categories: GodTicketCategoryRow[];
    /** Sous-ensemble actif : c'est lui qui alimente le menu Discord. */
    enabledCategories: GodTicketCategoryRow[];
};

export async function loadGodTicketRuntime(): Promise<GodTicketRuntime> {
    const [row, categoryRows, legacy] = await Promise.all([
        db.godTicketConfig.findUnique({ where: { id: "singleton" } }),
        db.godTicketCategory.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] }),
        db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { ticketSupportGuildId: true },
        }),
    ]);

    const config = resolveGodTicketConfig(row, {
        supportGuildId: legacy?.ticketSupportGuildId ?? null,
    });
    const categories = resolveGodTicketCategories(categoryRows);

    return {
        config,
        categories,
        enabledCategories: categories.filter((category) => category.isEnabled),
    };
}
