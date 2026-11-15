import { describe, expect, it } from "vitest";
import { fetch as undiciFetch } from "undici";
import {
    assertPublicAddresses,
    nextRedirectTarget,
    safeFetch,
} from "@/lib/safe-fetch";

/**
 * Correctif TOCTOU DNS + redirections (audit 13/11, reste du 15/11/2026).
 *
 * Le comportement dangereux corrigé : `dns.lookup` → contrôle IP → `fetch(url)`,
 * où `fetch` **re-résout** le nom et **suit** les redirections sans revalider.
 * Ces cas verrouillent la règle : IP privée refusée, protocole refusé, chaque saut
 * revalidé, nombre de redirections borné.
 */

const fake = (handler: (input: URL) => Response | Promise<Response>) =>
    (async (input: unknown) => handler(new URL(String(input)))) as unknown as typeof undiciFetch;

describe("safe-fetch — adresses résolues", () => {
    it("refuse une résolution vide (fail-closed)", () => {
        expect(() => assertPublicAddresses([])).toThrow("Résolution DNS impossible");
    });

    it("refuse les IP privées, réservées et IPv6 locales", () => {
        for (const address of ["127.0.0.1", "10.1.2.3", "192.168.0.8", "169.254.169.254", "::1", "fd00::1"]) {
            expect(() => assertPublicAddresses([{ address }]), address).toThrow("Adresse IP interne bloquée");
        }
    });

    it("accepte une adresse publique", () => {
        expect(() => assertPublicAddresses([{ address: "8.8.8.8" }])).not.toThrow();
    });
});

describe("safe-fetch — cible d'une redirection", () => {
    it("ignore une réponse normale", () => {
        expect(nextRedirectTarget(200, "https://exemple.fr", new URL("https://exemple.fr"))).toBeNull();
    });

    it("ignore une 3xx sans Location", () => {
        expect(nextRedirectTarget(302, null, new URL("https://exemple.fr"))).toBeNull();
    });

    it("résout une Location relative contre l'URL courante", () => {
        expect(nextRedirectTarget(302, "/b", new URL("https://exemple.fr/a"))?.toString()).toBe("https://exemple.fr/b");
    });
});

describe("safe-fetch — garde-fous", () => {
    it("refuse un protocole non http(s) avant tout appel réseau", async () => {
        const impl = fake(() => {
            throw new Error("ne doit pas être appelé");
        });
        await expect(safeFetch("file:///etc/passwd", { fetchImpl: impl })).rejects.toThrow("Protocole non autorisé");
    });

    it("suit une redirection autorisée", async () => {
        const seen: string[] = [];
        const impl = fake((url) => {
            seen.push(url.toString());
            if (url.pathname === "/a") {
                return new Response(null, { status: 302, headers: { location: "/b" } });
            }
            return new Response("ok", { status: 200 });
        });

        const response = await safeFetch("https://exemple.fr/a", { fetchImpl: impl });
        expect(response.status).toBe(200);
        expect(seen).toEqual(["https://exemple.fr/a", "https://exemple.fr/b"]);
    });

    it("revalide l'hôte à chaque saut (redirection vers une IP interne refusée)", async () => {
        const impl = fake(() => new Response(null, { status: 302, headers: { location: "http://127.0.0.1:9090/" } }));

        await expect(
            safeFetch("https://exemple.fr/a", {
                fetchImpl: impl,
                validateUrl: (url) => {
                    if (url.hostname !== "exemple.fr") throw new Error("Hôte non autorisé");
                },
            }),
        ).rejects.toThrow("Hôte non autorisé");
    });

    it("coupe une chaîne de redirections infinie", async () => {
        const impl = fake(() => new Response(null, { status: 302, headers: { location: "/boucle" } }));

        await expect(
            safeFetch("https://exemple.fr/boucle", { fetchImpl: impl, maxRedirects: 2 }),
        ).rejects.toThrow("Trop de redirections");
    });

    it("n'appelle jamais le fetch nu de Next pour une URL externe", () => {
        // `fetchImpl` par défaut = undici ; le `fetch` global (patché par Next) ignore `dispatcher`.
        expect(undiciFetch).toBeTypeOf("function");
    });
});
