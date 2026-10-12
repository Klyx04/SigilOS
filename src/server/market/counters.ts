/**
 * Module « Marché » — compteurs **publics** d'une annonce (S4.7).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il existe pour éviter toute dépendance circulaire :
 * `discord.ts` (rendu de l'embed) et `offers.ts` (cycle de vie des offres)
 * s'appuient tous les deux dessus, sans s'importer mutuellement.
 *
 * §13.7 — la seule information **publique** sur les négociations est un
 * **compteur** : « N offre(s) en cours ». Ce module ne lit donc **jamais** un
 * montant (`offeredKamas`), un troc (`tradeDescription`), une note ou un pseudo
 * d'acheteur : `count()` seul, sur le statut `PENDING`.
 *
 * S3.6 — comme tout ce qui touche Discord, un échec BDD ici **ne casse rien** :
 * on retombe sur `0` et on trace, l'annonce reste affichée.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Nombre d'offres **en cours** (`PENDING`) d'une annonce.
 *
 * Seules les offres `PENDING` comptent : une offre `ACCEPTED`, `DECLINED`,
 * `CANCELLED` ou `EXPIRED` (§11.4, `MarketOfferStatus`) ne fait plus partie des
 * négociations en cours et ne doit pas gonfler le compteur public.
 *
 * Ne jette jamais : renvoie `0` si la requête échoue.
 */
export async function countPendingMarketOffers(listingId: string): Promise<number> {
    try {
        // Aucun `select`/`include` : le compteur ne peut structurellement pas
        // transporter de donnée privée (§13.7).
        return await db.marketOffer.count({ where: { listingId, status: "PENDING" } });
    } catch (error) {
        logger.warn("[market] countPendingMarketOffers failed", { listingId, err: String(error) });
        return 0;
    }
}
