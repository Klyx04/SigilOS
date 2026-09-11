import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
import { expireMarketListingsCore, expireMarketOffersCore, remindMarketListingsCore } from "@/server/market/expiry";
import { expireMarketReservationsCore, remindMarketReservationsEndingCore } from "@/server/market/reservations";
import { claimMarketDailyMaintenance, reconcileMarketDiscordMessagesCore } from "@/server/market/maintenance";

/**
 * 🔒 CRON « Marché » — fin de vie automatique et rappels (§15.1, S5.2).
 *
 * Une seule route pour toutes les échéances du marché, déclenchée toutes les
 * 10 minutes par le crontab du VPS :
 *   1. **réservations** expirées (`expireMarketReservationsCore`, S4.9) — libère
 *      l'annonce réservée (`RESERVED → ACTIVE`) avant tout le reste ;
 *   2. **rappel H-1** de réservation (`remindMarketReservationsEndingCore`, S5.2)
 *      — vendeur + acheteur, fenêtre stricte de 60 min ;
 *   3. **rappels J+7 / J+15** des annonces sans activité
 *      (`remindMarketListingsCore`, S5.2) ;
 *   4. **annonces** à échéance J+20 et sans aucune activité
 *      (`expireMarketListingsCore`, S5.1) — archivage en douceur ;
 *   5. **offres** `PENDING` hors délai (`expireMarketOffersCore`, S5.1) ;
 *   6. **entretien** (1×/jour seulement, S5.4) : **réconciliation Discord** des
 *      messages divergents (`FAILED`/`PENDING`) puis purges (S5.5/S5.6) —
 *      verrou quotidien Redis (`claimMarketDailyMaintenance`, fail-open).
 *
 * L'**ordre est imposé** : le retrait J+20 ne vise que les annonces sans
 * activité (§11.6) ; archiver les annonces avant d'avoir libéré celles dont la
 * réservation vient d'expirer laisserait une annonce « réservée » orpheline.
 * Les rappels précèdent le retrait comme au §15.1 : la garde `expiresAt > now`
 * du rappel rend l'ordre neutre pour les annonces saines, et une annonce déjà
 * arrivée à échéance part directement à l'archivage.
 *
 * Protection : header `x-cron-secret` (cf. `lib/cron-auth.ts`), **fail-closed** —
 * sans `CRON_SECRET` configuré, la route refuse tout. Aucun paramètre d'entrée :
 * la passe n'est pas pilotable depuis l'extérieur (§13.7) ; l'isolation multi-tenant
 * reste interne (`GuildConfig.id`).
 *
 * GET **et** POST : le plan déclare `POST` (§14.3) tandis que la ligne de crontab
 * du VPS utilise `curl` (donc GET). Les deux verbes partagent strictement le même
 * corps de contrôle : aucune divergence possible.
 *
 * Renvoie le bilan de la passe (compteurs par étape) ; toute erreur globale
 * renvoie 500 — les gardes d'idempotence rendent la relance sans effet de bord.
 * Télémétrie `KNOWN_CRON_TASKS.market_expire` (`recordCronExecution`, S5.3) :
 * l'état, la durée, la fréquence et les volumes de la passe sont visibles dans
 * **God → Tâches CRON** (`?tab=cron-status`) — aucun développement de plus.
 */
async function handleMarketExpire(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const now = new Date();

        const reservations = await expireMarketReservationsCore({ now });
        const reservationReminders = await remindMarketReservationsEndingCore({ now });
        const reminders = await remindMarketListingsCore({ now });
        const listings = await expireMarketListingsCore({ now });
        const offers = await expireMarketOffersCore({ now });

        // Entretien 1×/jour (§15.1 étapes 7-8) — le cron tourne toutes les
        // 10 min : sans verrou, la réconciliation s'exécuterait 144 fois par jour.
        // Le verrou est *fail-open* (Redis indisponible → la passe tourne quand
        // même) : bornée par lot et idempotente, elle ne coûte qu'un peu d'I/O.
        const maintenance = await claimMarketDailyMaintenance(now);
        const reconciled = maintenance.run ? await reconcileMarketDiscordMessagesCore() : null;

        const summary = {
            reservations,
            reservationReminders,
            reminders,
            listings,
            offers,
            maintenance: { ran: maintenance.run, reason: maintenance.reason },
            // `null` = passe d'entretien non exécutée aujourd'hui (verrou déjà posé).
            resynced: reconciled?.resynced ?? null,
        };

        logger.info("[MarketExpireCron] passe terminée", summary);

        // Télémétrie God (§15.1) : un récapitulatif **par passe** (jamais une
        // ligne par annonce) — libellés lisibles dans `?tab=cron-status`.
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("market_expire", {
            // Un échec Discord est le seul « succès partiel » possible : la base
            // a bien avancé (syncStatus = FAILED, rejouable), le cron le signale.
            success: listings.discordFailed === 0 && (reconciled?.stillFailed ?? 0) === 0,
            durationMs: Date.now() - startedAt,
            summary: [
                `Marché : ${reservations.expired} réservation(s) expirée(s)`,
                `${reservationReminders.reminded} rappel(s) H-1`,
                `${reminders.reminded7} rappel(s) J+7`,
                `${reminders.reminded15} rappel(s) J+15`,
                `${listings.deleted} annonce(s) retirée(s)`,
                `${offers.expired} offre(s) expirée(s)`,
                `${listings.discordFailed} échec(s) Discord`,
                maintenance.run
                    ? `entretien : ${reconciled?.resynced ?? 0} resync, ${reconciled?.recreated ?? 0} recréé(s), ${reconciled?.stillFailed ?? 0} échec(s)`
                    : `entretien : non déclenchée (${maintenance.reason})`,
            ].join(", "),
            details: summary,
        });

        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[MarketExpireCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("market_expire", {
            success: false,
            summary: `Erreur : ${message}`,
        });

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Déclenchement par le crontab du VPS (`curl`). */
export async function GET(req: Request) {
    return handleMarketExpire(req);
}

/** Déclenchement déclaré dans le plan (§14.3) — strictement identique à `GET`. */
export async function POST(req: Request) {
    return handleMarketExpire(req);
}
