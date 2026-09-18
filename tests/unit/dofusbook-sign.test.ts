import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    DOFUSBOOK_CLIENT_TOKEN_TTL_SECONDS,
    buildDofusbookClientFetchUrl,
    signDofusbookClientToken,
    verifyDofusbookClientToken,
} from "@/lib/dofusbook-sign";

const SECRET = "unit-test-secret";

/** Sauvegarde/restaure les variables d'environnement touchées par les tests. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    try {
        for (const [k, v] of Object.entries(vars)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        fn();
    } finally {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

describe("dofusbook-sign — jeton navigateur du worker Cloudflare", () => {
    it("signe `id.exp` en HMAC-SHA256 hex (recette identique au worker)", () => {
        const signed = signDofusbookClientToken("23117628", 1_000_000, 300, SECRET);
        expect(signed).not.toBeNull();
        expect(signed!.exp).toBe(1_000_300);
        expect(signed!.token).toBe(
            crypto.createHmac("sha256", SECRET).update("23117628.1000300").digest("hex")
        );
        expect(DOFUSBOOK_CLIENT_TOKEN_TTL_SECONDS).toBe(300);
    });

    it("valide un jeton frais (insensible à la casse)", () => {
        const signed = signDofusbookClientToken("42", 1_000_000, 300, SECRET)!;
        expect(verifyDofusbookClientToken("42", signed.token.toUpperCase(), signed.exp, 1_000_100, SECRET)).toBe(true);
    });

    it("rejette un jeton falsifié, expiré, pour un autre build, ou avec un autre secret", () => {
        const signed = signDofusbookClientToken("42", 1_000_000, 300, SECRET)!;
        expect(verifyDofusbookClientToken("43", signed.token, signed.exp, 1_000_100, SECRET)).toBe(false);
        expect(verifyDofusbookClientToken("42", `${signed.token.slice(0, -1)}0`, signed.exp, 1_000_100, SECRET)).toBe(false);
        expect(verifyDofusbookClientToken("42", signed.token, signed.exp, signed.exp + 1, SECRET)).toBe(false);
        expect(verifyDofusbookClientToken("42", signed.token, signed.exp, 1_000_100, "autre-secret")).toBe(false);
        expect(verifyDofusbookClientToken("42", "", signed.exp, 1_000_100, SECRET)).toBe(false);
    });

    it("ne signe rien sans secret configuré (fail-closed)", () => {
        withEnv({ DOFUSBOOK_WORKER_SIGN_SECRET: undefined, DOFUSBOOK_WORKER_SECRET: undefined }, () => {
            expect(signDofusbookClientToken("42")).toBeNull();
            expect(verifyDofusbookClientToken("42", "a".repeat(64), Math.floor(Date.now() / 1000) + 60)).toBe(false);
        });
    });

    it("construit l'URL signée `/s/{id}?e=&t=` (et se tait si le worker n'est pas configuré)", () => {
        withEnv(
            { DOFUSBOOK_CF_WORKER_URL: "https://worker.example.dev/", DOFUSBOOK_WORKER_SECRET: SECRET },
            () => {
                expect(buildDofusbookClientFetchUrl("23117628")).toMatch(
                    /^https:\/\/worker\.example\.dev\/s\/23117628\?e=\d+&t=[0-9a-f]{64}$/
                );
            }
        );
        withEnv({ DOFUSBOOK_CF_WORKER_URL: undefined, DOFUSBOOK_WORKER_SECRET: undefined }, () => {
            expect(buildDofusbookClientFetchUrl("23117628")).toBeNull();
        });
    });
});
