import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "crypto";
import type { KeyObject } from "crypto";
import { verifyDiscordSignature, isValidEd25519PublicKey } from "@/server/discord";

/**
 * #223 P1 — Signature Ed25519 UNIFIÉE : anti-replay + validation de la clé publique.
 * Vérifie que `verifyDiscordSignature` (src/server/discord.ts) :
 *  - accepte une signature valide avec un timestamp frais ;
 *  - rejette une signature invalide ;
 *  - rejette un timestamp périmé (anti-replay > 300 s) ;
 *  - rejette une clé publique mal formée / absente (fail-closed) ;
 *  - rejette une signature au mauvais format (longueur hex).
 */

const BODY = '{"type":1,"event":{"type":"APPLICATION_DEAUTHORIZED"}}';

function makeKeyPair(): { publicKeyHex: string; privateKey: KeyObject } {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const jwk = publicKey.export({ format: "jwk" }) as { x: string };
    return {
        // 32 octets bruts → 64 hex (clé publique Ed25519).
        publicKeyHex: Buffer.from(jwk.x, "base64url").toString("hex"),
        privateKey,
    };
}

function signBody(privateKey: KeyObject, timestamp: string, body: string): string {
    return sign(null, Buffer.from(timestamp + body, "utf8"), privateKey).toString("hex");
}

function makeRequest(timestamp: string, signatureHex: string): Request {
    const headers = new Headers();
    headers.set("X-Signature-Ed25519", signatureHex);
    headers.set("X-Signature-Timestamp", timestamp);
    return { headers } as unknown as Request;
}

describe("discord-signature — Ed25519 unifiée + anti-replay (chantier #223 P1)", () => {
    const originalKey = process.env.DISCORD_APPLICATION_PUBLIC_KEY;
    const originalAltKey = process.env.DISCORD_PUBLIC_KEY;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.DISCORD_APPLICATION_PUBLIC_KEY;
        delete process.env.DISCORD_PUBLIC_KEY;
    });

    afterEach(() => {
        if (originalKey === undefined) delete process.env.DISCORD_APPLICATION_PUBLIC_KEY;
        else process.env.DISCORD_APPLICATION_PUBLIC_KEY = originalKey;
        if (originalAltKey === undefined) delete process.env.DISCORD_PUBLIC_KEY;
        else process.env.DISCORD_PUBLIC_KEY = originalAltKey;
    });

    it("accepte une signature valide avec un timestamp frais", async () => {
        const { publicKeyHex, privateKey } = makeKeyPair();
        process.env.DISCORD_APPLICATION_PUBLIC_KEY = publicKeyHex;
        const timestamp = String(Math.floor(Date.now() / 1000));
        const sig = signBody(privateKey, timestamp, BODY);
        const ok = await verifyDiscordSignature(makeRequest(timestamp, sig), BODY);
        expect(ok).toBe(true);
    });

    it("rejette une signature invalide (corps modifié après signature)", async () => {
        const { publicKeyHex, privateKey } = makeKeyPair();
        process.env.DISCORD_APPLICATION_PUBLIC_KEY = publicKeyHex;
        const timestamp = String(Math.floor(Date.now() / 1000));
        const sig = signBody(privateKey, timestamp, BODY);
        const tampered = BODY.slice(0, -1) + '",tampered":true}';
        const ok = await verifyDiscordSignature(makeRequest(timestamp, sig), tampered);
        expect(ok).toBe(false);
    });

    it("rejette un timestamp périmé (anti-replay > 300 s)", async () => {
        const { publicKeyHex, privateKey } = makeKeyPair();
        process.env.DISCORD_APPLICATION_PUBLIC_KEY = publicKeyHex;
        const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
        const sig = signBody(privateKey, oldTimestamp, BODY);
        const ok = await verifyDiscordSignature(makeRequest(oldTimestamp, sig), BODY);
        expect(ok).toBe(false);
    });

    it("rejette une clé publique mal formée (fail-closed)", async () => {
        process.env.DISCORD_APPLICATION_PUBLIC_KEY = "abc123"; // trop courte
        const timestamp = String(Math.floor(Date.now() / 1000));
        const ok = await verifyDiscordSignature(makeRequest(timestamp, "ab".repeat(64)), BODY);
        expect(ok).toBe(false);
    });

    it("rejette une signature au format invalide (longueur hex incorrecte)", async () => {
        const { publicKeyHex } = makeKeyPair();
        process.env.DISCORD_APPLICATION_PUBLIC_KEY = publicKeyHex;
        const timestamp = String(Math.floor(Date.now() / 1000));
        const ok = await verifyDiscordSignature(makeRequest(timestamp, "abcd"), BODY);
        expect(ok).toBe(false);
    });

    it("rejette quand la clé publique est absente (fail-closed)", async () => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const ok = await verifyDiscordSignature(makeRequest(timestamp, "ab".repeat(64)), BODY);
        expect(ok).toBe(false);
    });

    it("isValidEd25519PublicKey : 64 hex = 32 octets", () => {
        expect(isValidEd25519PublicKey("ab".repeat(32))).toBe(true);
        expect(isValidEd25519PublicKey("ab".repeat(31))).toBe(false);
        expect(isValidEd25519PublicKey("zz".repeat(32))).toBe(false);
        expect(isValidEd25519PublicKey("AB".repeat(32))).toBe(true); // hex insensible à la casse
        expect(isValidEd25519PublicKey(undefined)).toBe(false);
        expect(isValidEd25519PublicKey(null)).toBe(false);
    });
});