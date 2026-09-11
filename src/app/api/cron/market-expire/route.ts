import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { expireMarketListingsCore, expireMarketOffersCore, remindMarketListingsCore } from "@/server/market/expiry";
import { expireMarketReservationsCore, remindMarketReservationsEndingCore } from "@/server/market/reservations";

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
 *   5. **offres** `PENDING` hors délai (`expireMarketOffersCore`, S5.1).
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
 * Télémétrie `KNOWN_CRON_TASKS.market_expire` : livrée en S5.3.
 */
async function handleMarketExpire(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();

        const reservations = await expireMarketReservationsCore({ now });
        const reservationReminders = await remindMarketReservationsEndingCore({ now });
        const reminders = await remindMarketListingsCore({ now });
        const listings = await expireMarketListingsCore({ now });
        const offers = await expireMarketOffersCore({ now });

        const summary = { reservations, reservationReminders, reminders, listings, offers };

        logger.info("[MarketExpireCron] passe terminée", summary);

        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[MarketExpireCron] Global Error", { error: message });
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
