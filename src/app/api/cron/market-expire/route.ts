import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { expireMarketListingsCore, expireMarketOffersCore } from "@/server/market/expiry";
import { expireMarketReservationsCore } from "@/server/market/reservations";

/**
 * 🔒 CRON « Marché » — fin de vie automatique (§15.1).
 *
 * Une seule route pour toutes les échéances du marché, déclenchée toutes les
 * 10 minutes par le crontab du VPS :
 *   1. **réservations** expirées (`expireMarketReservationsCore`, S4.7) — libère
 *      l'annonce réservée (`RESERVED → ACTIVE`) avant tout le reste ;
 *   2. **annonces** à échéance J+20 et sans aucune activité
 *      (`expireMarketListingsCore`, S5.1) — archivage en douceur ;
 *   3. **offres** `PENDING` hors délai (`expireMarketOffersCore`, S5.1).
 *
 * Cet **ordre est imposé** : le retrait J+20 ne vise que les annonces sans
 * activité (§11.6) ; archiver les annonces avant d'avoir libéré celles dont la
 * réservation vient d'expirer laisserait une annonce « réservée » orpheline.
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
        const listings = await expireMarketListingsCore({ now });
        const offers = await expireMarketOffersCore({ now });

        const summary = { reservations, listings, offers };

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
