import { cache } from "react";
import { headers } from "next/headers";
import { logger } from "@/lib/logger";
import {
    sanitizeNotFoundPath,
    sanitizeRefererHost,
    sanitizeUserAgent,
    shouldLogNotFound,
    type NotFoundLogRecord,
} from "@/lib/not-found-log";

/**
 * Journalise une 404 depuis un composant serveur `not-found`.
 *
 * `headers()` est appelé **hors** de tout `try` : pendant le prerender, Next s'en sert
 * comme signal de bascule dynamique — l'avaler casserait la génération de la page.
 * Rien de sensible n'est écrit : chemin sans query, hôte du Referer, agent tronqué.
 *
 * `cache()` déduplique l'appel : Next rend la même 404 deux fois par requête (vol payload
 * et document), et sans cela chaque visite produisait deux lignes de log identiques.
 */
export const logNotFound = cache(async (): Promise<void> => {
    const requestHeaders = await headers();

    const path = sanitizeNotFoundPath(requestHeaders.get("x-pathname"));
    const refererHost = sanitizeRefererHost(requestHeaders.get("referer"));

    if (!shouldLogNotFound(path, refererHost !== null)) return;

    const record: NotFoundLogRecord = {
        path,
        refererHost,
        userAgent: sanitizeUserAgent(requestHeaders.get("user-agent")),
    };

    try {
        logger.warn("[404] page introuvable", record);
    } catch {
        // Une page 404 ne doit jamais échouer à cause de sa journalisation.
    }
});
