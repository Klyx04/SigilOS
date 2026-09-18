import { getDofusbookClientFetchUrl } from "@/server/actions/dofusbook-actions";
import { storeClientDofusbookPreview } from "@/server/actions/gallery-actions";
import {
    DOFUSBOOK_BLOCKED_MESSAGE,
    isDofusbookBlockResponse,
    processDofusbookRawData,
    type DofusbookPreviewData,
} from "@/lib/dofusbook-utils";

/**
 * Bake « côté navigateur » d'un build Dofusbook — **conçu pour les composants clients**.
 *
 *  1. le serveur signe une URL (`getDofusbookClientFetchUrl`) ;
 *  2. le NAVIGATEUR appelle le worker Cloudflare avec cette URL signée ;
 *  3. le JSON obtenu est renvoyé au serveur (`storeClientDofusbookPreview`) qui le valide
 *     puis l'enregistre dans le profil propriétaire.
 *
 * Raison d'être : Dofusbook (Cloudflare) refuse les appels serveur (challenge anti-bot)
 * alors qu'un navigateur passe. Le worker reste le seul émetteur vers Dofusbook : l'IP du
 * VPS n'est jamais exposée.
 */
export type ClientBakeResult =
    | { ok: true; data: DofusbookPreviewData; persisted: boolean }
    | { ok: false; status?: number; error: string };

export async function bakeDofusbookFromBrowser(
    buildUrl: string,
    guildId?: string
): Promise<ClientBakeResult> {
    const signed = await getDofusbookClientFetchUrl(buildUrl);
    if (!signed.success || !signed.url) {
        return { ok: false, error: signed.error || "Proxy Dofusbook indisponible" };
    }

    let response: Response;
    try {
        response = await fetch(signed.url, { headers: { Accept: "application/json" } });
    } catch {
        return { ok: false, error: "Réseau indisponible" };
    }

    const text = await response.text().catch(() => "");

    if (!response.ok) {
        const blocked = isDofusbookBlockResponse(response.status, response.headers.get("content-type"), text);
        return {
            ok: false,
            status: response.status,
            error: blocked ? DOFUSBOOK_BLOCKED_MESSAGE : `Dofusbook a répondu ${response.status}`,
        };
    }

    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return { ok: false, status: response.status, error: "Réponse Dofusbook illisible" };
    }

    if (guildId) {
        const stored = await storeClientDofusbookPreview(guildId, buildUrl, raw);
        if (stored.success && stored.data) {
            return { ok: true, data: stored.data.data, persisted: stored.data.persisted };
        }
        return { ok: false, status: response.status, error: stored.error || "Enregistrement impossible" };
    }

    return { ok: true, data: processDofusbookRawData(signed.id as string, raw), persisted: false };
}
