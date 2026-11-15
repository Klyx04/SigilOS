import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit, type Response as UndiciResponse } from "undici";
import { lookup as dnsLookup } from "node:dns/promises";
import { isPrivateIp } from "@/lib/ip-safety";

/**
 * Fetch sortant **sûr** — ferme le SSRF par rebinding DNS (TOCTOU) **et** par redirection.
 *
 * Le défaut corrigé (audit du 13/11/2026, reste au 15/11/2026) : les appelants faisaient
 * `dns.lookup()` → contrôle des IP → `fetch(url)`. Or `fetch` **re-résout** le nom au moment
 * de la connexion : entre le contrôle et l'usage, un domaine peut répondre `127.0.0.1`.
 * Et le `fetch` par défaut **suit les redirections** sans revalider : un redirecteur ouvert
 * (`https://www.google.com/url?q=…`) suffisait à atteindre un service interne.
 *
 * Correctif : la vérification d'IP est faite **dans le `lookup` de connexion** (donc au moment
 * exact où la socket s'ouvre), et les redirections sont suivies **à la main**, une par une,
 * avec revalidation du protocole, de l'hôte (callback `validateUrl`) et de l'IP.
 *
 * Fail-closed : résolution impossible, adresse invalide ou privée ⇒ refus.
 */

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export type SafeFetchInit = Omit<UndiciRequestInit, "dispatcher" | "redirect"> & {
    /** Revalidation appliquée à l'URL initiale **et** à chaque saut de redirection. */
    validateUrl?: (url: URL) => void;
    /** Nombre maximal de redirections suivies (0 = aucune). Défaut : 3. */
    maxRedirects?: number;
    /** Injection réservée aux tests (aucun effet en production). */
    fetchImpl?: typeof undiciFetch;
};

/** Refuse un lot d'adresses résolues si l'une est privée/réservée. Règle pure. */
export function assertPublicAddresses(addresses: ReadonlyArray<{ address: string }>): void {
    if (addresses.length === 0) throw new Error("Résolution DNS impossible");
    for (const entry of addresses) {
        if (isPrivateIp(entry.address)) throw new Error("Adresse IP interne bloquée");
    }
}

function assertHttpProtocol(url: URL): void {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Protocole non autorisé");
    }
}

/** Cible d'une redirection, ou `null` si la réponse n'en est pas une. Règle pure. */
export function nextRedirectTarget(status: number, location: string | null, current: URL): URL | null {
    if (!REDIRECT_STATUS.has(status) || !location) return null;
    return new URL(location, current);
}

/**
 * `lookup` de connexion : résout, refuse les IP privées, puis laisse undici se connecter.
 * C'est ce callback qui supprime la fenêtre TOCTOU — il est appelé **pendant** la connexion.
 */
function createSafeDispatcher(): Agent {
    return new Agent({
        connect: {
            lookup(hostname, options, callback) {
                dnsLookup(hostname, { all: true, verbatim: true })
                    .then((addresses) => {
                        assertPublicAddresses(addresses);
                        const wantsAll = Boolean(options && typeof options === "object" && "all" in options && options.all);
                        if (wantsAll) {
                            (callback as unknown as (error: null, all: typeof addresses) => void)(null, addresses);
                            return;
                        }
                        (callback as unknown as (error: null, address: string, family: number) => void)(
                            null,
                            addresses[0]!.address,
                            addresses[0]!.family,
                        );
                    })
                    .catch((error: unknown) => {
                        (callback as unknown as (error: Error) => void)(
                            error instanceof Error ? error : new Error(String(error)),
                        );
                    });
            },
        },
    });
}

let sharedDispatcher: Agent | null = null;

function getSharedDispatcher(): Agent {
    if (!sharedDispatcher) sharedDispatcher = createSafeDispatcher();
    return sharedDispatcher;
}

/** Fetch sortant sûr : connexion vérifiée + redirections bornées et revalidées. */
export async function safeFetch(input: string | URL, init: SafeFetchInit = {}): Promise<UndiciResponse> {
    const { validateUrl, maxRedirects = 3, fetchImpl = undiciFetch, ...rest } = init;
    const dispatcher = fetchImpl === undiciFetch ? getSharedDispatcher() : undefined;
    let current = new URL(input.toString());

    for (let hop = 0; hop <= maxRedirects; hop++) {
        assertHttpProtocol(current);
        validateUrl?.(current);

        const response = await fetchImpl(current, {
            ...rest,
            redirect: "manual",
            ...(dispatcher ? { dispatcher } : {}),
        });

        const target = nextRedirectTarget(response.status, response.headers.get("location"), current);
        if (!target) return response;

        await response.body?.cancel().catch(() => {});
        current = target;
    }

    throw new Error("Trop de redirections");
}
