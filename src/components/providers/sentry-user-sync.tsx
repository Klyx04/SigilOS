"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Impact Sentry — rattache les événements du **navigateur** à un identifiant opaque.
 *
 * 🐛 Mesure du 16/11/2026 : **aucun** événement des 16 issues non résolues ne portait
 * d'utilisateur (`usersImpacted = 0` partout, même pour 54 occurrences) ⇒ impossible de
 * prioriser par nombre de personnes touchées.
 *
 * 🔒 On n'envoie **que** l'id interne (cuid Prisma, opaque) : ni pseudo, ni e-mail, ni
 * identifiant Discord (`session.user.discordId` existe mais reste local). Le cookie de
 * session est déjà fermé à la collecte (`SENTRY_DATA_COLLECTION`).
 *
 * ⚠️ Portée : les événements **client** (navigation, images, hydratation). Les événements
 * serveur restent sans utilisateur tant qu'aucun point d'entrée requête-scopé ne les
 * marque — sujet noté au ROADMAP, pas masqué ici.
 */
export function SentryUserSync({ userId }: { userId: string | null }) {
    useEffect(() => {
        Sentry.setUser(userId ? { id: userId } : null);
    }, [userId]);

    return null;
}
