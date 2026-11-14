"use client";

import { useEffect, useState } from "react";
import { getFeedbackScreenshotChannelAction } from "@/server/actions/feedback-actions";

/**
 * Lien du salon des captures, résolu **une seule fois** par session de page.
 *
 * Aucune I/O côté client : l'action serveur lit `PlatformConfig` et renvoie le
 * lien (ou `null`). Le résultat est mémorisé au niveau du module pour que
 * l'overlay, le bouton public et la modale du dashboard ne fassent qu'un appel.
 */
let cached: string | null | undefined;
let inflight: Promise<string | null> | null = null;

async function loadScreenshotChannel(): Promise<string | null> {
    if (cached !== undefined) return cached;
    if (!inflight) {
        inflight = getFeedbackScreenshotChannelAction()
            .then((response) => (response.success ? response.data?.url ?? null : null))
            .catch(() => null)
            .then((url) => {
                cached = url;
                return url;
            })
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}

export function useFeedbackScreenshotChannel(): { url: string | null; loading: boolean } {
    const [state, setState] = useState<{ url: string | null; loading: boolean }>(
        cached !== undefined ? { url: cached, loading: false } : { url: null, loading: true }
    );

    useEffect(() => {
        if (cached !== undefined) {
            setState({ url: cached, loading: false });
            return;
        }
        let active = true;
        loadScreenshotChannel().then((url) => {
            if (active) setState({ url, loading: false });
        });
        return () => {
            active = false;
        };
    }, []);

    return state;
}
