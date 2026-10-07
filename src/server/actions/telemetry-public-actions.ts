"use server";

import { headers } from "next/headers";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import {
    MIN_PUBLIC_VIEWS_TO_PUBLISH,
    PUBLIC_COUNTER_TTL_DAYS,
    PUBLIC_SCREEN_RULES,
    dayKeyUTC,
    isLikelyBot,
    listDayKeysUTC,
    publicCounterKey,
    publicCounterKeysForDay,
    publicScreenKey,
    publicScreenLabel,
    splitPublicViews,
} from "@/lib/telemetry/public";
import { isSuperAdmin } from "./super-admin-actions";

/**
 * Partie **externe** de la télémétrie (D-2bis, itération 6) : le site public.
 *
 * Jusqu'ici, rien n'était compté hors du tableau de bord connecté. Ici on compte les **vues
 * d'écrans publics** — accueil, guides, carte, almanax… — avec trois contraintes non négociables :
 *
 * 1. **Aucune identité** : pas de cookie, pas de consentement, pas de bandeau, aucune adresse
 *    conservée, aucun user-agent conservé (il est **lu** pour écarter les robots, jamais stocké) ;
 * 2. **Agrégat seulement** : un compteur Redis par **jour et par écran** (`stats:public:<jour>:<écran>`),
 *    jamais une ligne par visite ;
 * 3. **Deux mondes séparés** : ces compteurs ne sont **jamais** joints à `TelemetryEvent` (le monde
 *    identifié). Une jointure serait la fin des deux garanties.
 *
 * Ce que ça ne peut pas dire : visiteurs uniques, sessions, provenance. On compte des **requêtes**.
 */

/** Budget de comptage : large (une vue par page consultée), borné contre l'inflation. */
const PUBLIC_VIEW_LIMIT = 120;
const PUBLIC_VIEW_WINDOW_MS = 60_000;

/** Fenêtre maximale lue d'un coup (bornée : la lecture reste une `mget` de quelques centaines de clés). */
const MAX_PUBLIC_WINDOW_DAYS = 90;

export async function logPublicPageView(path: string) {
    try {
        const screen = publicScreenKey(path);
        if (!screen) return { success: true, counted: false };

        const headerList = await headers();
        // Le user-agent est LU ici (filtre robots) et **jamais conservé**.
        if (isLikelyBot(headerList.get("user-agent"))) return { success: true, counted: false };

        const ip = headerList.get("x-real-ip") ?? "unknown";
        const limit = await rateLimit(`public-view:${ip}`, PUBLIC_VIEW_LIMIT, PUBLIC_VIEW_WINDOW_MS);
        // Un compteur n'est pas une protection d'accès : au-delà du budget, on cesse simplement
        // de compter plutôt que de refuser la page.
        if (!limit.success) return { success: true, counted: false };

        const key = publicCounterKey(dayKeyUTC(new Date()), screen);
        const views = await redis.incr(key);
        if (views === 1) {
            await redis.expire(key, PUBLIC_COUNTER_TTL_DAYS * 86400).catch(() => {});
        }

        return { success: true, counted: true };
    } catch (err) {
        // Une page publique ne casse pas parce que son compteur a échoué.
        logger.warn("[PublicTelemetry] Vue non comptee", { error: String(err) });
        return { success: false, counted: false };
    }
}

/**
 * Lecture agrégée des vues publiques. Réservée au super-admin (fail-closed).
 *
 * Une seule requête Redis (`mget`) sur `jours × écrans` clés — jamais `KEYS`, jamais une clé par
 * visite. Si Redis est indisponible, on renvoie `available: false` : l'écran dit que la mesure
 * est indisponible au lieu d'afficher des zéros qui passeraient pour une absence de trafic.
 */
export async function getPublicStats(days: number = 30) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        throw new Error("Unauthorized: Super-admin access required");
    }

    const now = new Date();
    const windowDays = Math.max(1, Math.min(MAX_PUBLIC_WINDOW_DAYS, Math.trunc(days)));
    const dayKeys = listDayKeysUTC(now, windowDays);
    const lastWeek = new Set(listDayKeysUTC(now, 7));

    const keys: string[] = [];
    for (const day of dayKeys) keys.push(...publicCounterKeysForDay(day));

    let values: Array<string | null> = [];
    try {
        values = keys.length > 0 ? await redis.mget(...keys) : [];
    } catch (err) {
        logger.warn("[PublicTelemetry] Lecture impossible", { error: String(err) });
        return {
            generatedAt: now.toISOString(),
            available: false,
            days: windowDays,
            ttlDays: PUBLIC_COUNTER_TTL_DAYS,
            minViewsToPublish: MIN_PUBLIC_VIEWS_TO_PUBLISH,
            trackedScreens: PUBLIC_SCREEN_RULES.length,
            totals: { views7: 0, views30: 0 },
            screens: PUBLIC_SCREEN_RULES.map((rule) => ({
                key: rule.key,
                label: publicScreenLabel(rule.key),
                views7: 0,
                views30: 0,
                published: false,
            })),
            withheld: { screens: PUBLIC_SCREEN_RULES.length, views: 0 },
        };
    }

    const perScreen = new Map<string, { views7: number; views30: number }>();
    for (const rule of PUBLIC_SCREEN_RULES) perScreen.set(rule.key, { views7: 0, views30: 0 });

    dayKeys.forEach((day, dayIndex) => {
        const inLastWeek = lastWeek.has(day);
        PUBLIC_SCREEN_RULES.forEach((rule, ruleIndex) => {
            const raw = values[dayIndex * PUBLIC_SCREEN_RULES.length + ruleIndex];
            const views = raw ? Number.parseInt(raw, 10) : 0;
            if (!Number.isFinite(views) || views <= 0) return;

            const entry = perScreen.get(rule.key);
            if (!entry) return;
            entry.views30 += views;
            if (inLastWeek) entry.views7 += views;
        });
    });

    const split = splitPublicViews(
        PUBLIC_SCREEN_RULES.map((rule) => ({ screen: rule.key, views: perScreen.get(rule.key)?.views30 ?? 0 }))
    );
    const publishedKeys = new Set(split.published.map((row) => row.screen));

    return {
        generatedAt: now.toISOString(),
        available: true,
        days: windowDays,
        ttlDays: PUBLIC_COUNTER_TTL_DAYS,
        minViewsToPublish: MIN_PUBLIC_VIEWS_TO_PUBLISH,
        trackedScreens: PUBLIC_SCREEN_RULES.length,
        totals: {
            views7: Array.from(perScreen.values()).reduce((total, entry) => total + entry.views7, 0),
            views30: Array.from(perScreen.values()).reduce((total, entry) => total + entry.views30, 0),
        },
        screens: PUBLIC_SCREEN_RULES.map((rule) => ({
            key: rule.key,
            label: publicScreenLabel(rule.key),
            views7: perScreen.get(rule.key)?.views7 ?? 0,
            views30: perScreen.get(rule.key)?.views30 ?? 0,
            published: publishedKeys.has(rule.key),
        })),
        withheld: split.withheld,
    };
}
