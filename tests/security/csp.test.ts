import { describe, it, expect, afterEach, vi } from "vitest";
import { generateCspNonce, buildCsp, dofusbookRelayOrigin, CSP_HEADER_ENFORCE, CSP_HEADER_REPORT_ONLY } from "../../src/lib/csp";

// Tests du construction CSP nonce-based.
// On teste uniquement la logique pure (aucun I/O) : génération du nonce,
// présence/absence d'unsafe-inline dans script-src, mode report-only/enforce,
// et conservation des directives critiques (Sentry, WebSocket, fonts, images).

describe("CSP nonce-based", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("generateCspNonce", () => {
        it("returns a non-empty base64url string", () => {
            const nonce = generateCspNonce();
            expect(nonce).toBeTruthy();
            expect(typeof nonce).toBe("string");
        });

        it("produces a different nonce on each call (random per request)", () => {
            const a = generateCspNonce();
            const b = generateCspNonce();
            expect(a).not.toBe(b);
        });

        it("only contains characters accepted by Next's nonce regex [A-Za-z0-9_-]", () => {
            // Next: /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/
            for (let i = 0; i < 50; i++) {
                const nonce = generateCspNonce();
                expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
            }
        });
    });

    describe("dofusbookRelayOrigin", () => {
        it("réduit l'URL configurée à son origine (protocole + hôte + port)", () => {
            expect(dofusbookRelayOrigin("https://dofusbook.sigilos.fr/s/123?e=1&t=abc")).toBe("https://dofusbook.sigilos.fr");
            expect(dofusbookRelayOrigin("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
            expect(dofusbookRelayOrigin("https://test-dofusbook.benjamin-tremoureux.workers.dev/")).toBe(
                "https://test-dofusbook.benjamin-tremoureux.workers.dev"
            );
        });

        it("tolère les guillemets et espaces des fichiers .env", () => {
            expect(dofusbookRelayOrigin('  "https://x.workers.dev"  ')).toBe("https://x.workers.dev");
            expect(dofusbookRelayOrigin("'http://localhost:8787'")).toBe("http://localhost:8787");
        });

        it("retourne null pour une valeur vide, invalide ou non http(s)", () => {
            expect(dofusbookRelayOrigin("")).toBeNull();
            expect(dofusbookRelayOrigin("   ")).toBeNull();
            expect(dofusbookRelayOrigin("pas-une-url")).toBeNull();
            expect(dofusbookRelayOrigin("ftp://dofusbook.sigilos.fr")).toBeNull();
        });
    });

    describe("script-src", () => {
        it("does NOT contain 'unsafe-inline'", () => {
            const { headerValue } = buildCsp({ nonce: "abc", enforce: false });
            const directive = headerValue.split(";").find(d => d.trim().startsWith("script-src"))!;
            expect(directive).not.toContain("'unsafe-inline'");
        });

        it("contains 'nonce-<value>'", () => {
            const { headerValue } = buildCsp({ nonce: "abc123", enforce: false });
            const directive = headerValue.split(";").find(d => d.trim().startsWith("script-src"))!;
            expect(directive).toContain("'nonce-abc123'");
        });

        it("allows Sentry CDN script loader", () => {
            const { headerValue } = buildCsp({ nonce: "abc", enforce: false });
            const directive = headerValue.split(";").find(d => d.trim().startsWith("script-src"))!;
            expect(directive).toContain("https://cdn.sentry.io");
        });

        it("includes 'unsafe-eval' in development only", () => {
            vi.stubEnv("NODE_ENV", "development");
            const dev = buildCsp({ nonce: "abc", enforce: false });
            const devDirective = dev.headerValue.split(";").find(d => d.trim().startsWith("script-src"))!;
            expect(devDirective).toContain("'unsafe-eval'");

            vi.stubEnv("NODE_ENV", "production");
            const prod = buildCsp({ nonce: "abc", enforce: false });
            const prodDirective = prod.headerValue.split(";").find(d => d.trim().startsWith("script-src"))!;
            expect(prodDirective).not.toContain("'unsafe-eval'");
        });
    });

    describe("mode report-only vs enforce", () => {
        it("defaults to Report-Only when CSP_ENFORCE is not set", () => {
            vi.stubEnv("CSP_ENFORCE", "");
            const { headerName, mode } = buildCsp({ nonce: "abc", enforce: process.env.CSP_ENFORCE === "true" });
            expect(headerName).toBe(CSP_HEADER_REPORT_ONLY);
            expect(mode).toBe("report-only");
        });

        it("uses Content-Security-Policy (enforce) when CSP_ENFORCE=true", () => {
            const { headerName, mode } = buildCsp({ nonce: "abc", enforce: true });
            expect(headerName).toBe(CSP_HEADER_ENFORCE);
            expect(mode).toBe("enforce");
        });

        it("uses Report-Only header when enforce=false", () => {
            const { headerName, mode } = buildCsp({ nonce: "abc", enforce: false });
            expect(headerName).toBe(CSP_HEADER_REPORT_ONLY);
            expect(mode).toBe("report-only");
        });
    });

    describe("critical directives preserved (no breakage)", () => {
        const { headerValue } = buildCsp({ nonce: "abc", enforce: false });

        it("keeps style-src 'unsafe-inline' + Google Fonts", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("style-src"))!;
            expect(directive).toContain("'unsafe-inline'");
            expect(directive).toContain("https://fonts.googleapis.com");
        });

        it("keeps font-src Google Fonts data:", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("font-src"))!;
            expect(directive).toContain("https://fonts.gstatic.com");
            expect(directive).toContain("data:");
        });

        it("keeps connect-src Sentry + WebSocket wss:", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(directive).toContain("https://*.sentry.io");
            expect(directive).toContain("wss://*.sigilos.fr");
            expect(directive).toContain("wss://localhost:*");
        });

        it("keeps connect-src image CDNs (fetch() probes + SW revalidate)", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(directive).toContain("https://cdn.discordapp.com");
            expect(directive).toContain("https://media.discordapp.net");
            expect(directive).toContain("https://api.dofusdu.de");
            expect(directive).toContain("https://api.dofusdb.fr");
        });

        it("allows the Dofusbook Cloudflare worker (bake « navigateur »)", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(directive).toContain("https://*.workers.dev");
        });

        it("allows the local worker (wrangler dev) in development only", () => {
            vi.stubEnv("NODE_ENV", "development");
            const dev = buildCsp({ nonce: "abc", enforce: false });
            const devDirective = dev.headerValue.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(devDirective).toContain("http://127.0.0.1:*");

            vi.stubEnv("NODE_ENV", "production");
            const prod = buildCsp({ nonce: "abc", enforce: false });
            const prodDirective = prod.headerValue.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(prodDirective).not.toContain("http://127.0.0.1:*");
            expect(prodDirective).toContain("https://*.workers.dev");
        });

        it("suit le relais Dofusbook configuré (DOFUSBOOK_CF_WORKER_URL → connect-src)", () => {
            vi.stubEnv("DOFUSBOOK_CF_WORKER_URL", "https://dofusbook.sigilos.fr/s/123?e=1&t=abc");
            const { headerValue: csp } = buildCsp({ nonce: "abc", enforce: false });
            const directive = csp.split(";").find(d => d.trim().startsWith("connect-src"))!;
            // Seule l'ORIGINE est retenue (une CSP ne connaît pas les chemins).
            expect(directive).toContain("https://dofusbook.sigilos.fr");
            expect(directive).not.toContain("dofusbook.sigilos.fr/s/123");
        });

        it("ignore une origine de relais invalide (aucune directive cassée)", () => {
            vi.stubEnv("DOFUSBOOK_CF_WORKER_URL", "pas-une-url");
            const { headerValue: csp } = buildCsp({ nonce: "abc", enforce: false });
            const directive = csp.split(";").find(d => d.trim().startsWith("connect-src"))!;
            expect(directive).not.toContain("pas-une-url");
            expect(directive).toContain("'self'");
        });

        it("keeps img-src CDNs (Discord, DofusDB, Ankama, Unsplash, Imgur)", () => {
            const directive = headerValue.split(";").find(d => d.trim().startsWith("img-src"))!;
            expect(directive).toContain("https://cdn.discordapp.com");
            expect(directive).toContain("https://static.dofusdb.fr");
            expect(directive).toContain("https://static.ankama.com");
            expect(directive).toContain("https://images.unsplash.com");
            expect(directive).toContain("https://i.imgur.com");
            expect(directive).toContain("https://unavatar.io");
            expect(directive).toContain("https://media.discordapp.net");
            // Icônes de sorts Dofensive (fiches boss / simulation) — cdn.static.dofensive.com
            expect(directive).toContain("https://cdn.static.dofensive.com");
        });

        it("reports violations to /api/csp-report (F-29)", () => {
            expect(headerValue).toContain("report-uri /api/csp-report");
            expect(headerValue).toContain("report-to csp-endpoint");
        });

        it("keeps frame-ancestors 'none' (no iframes)", () => {
            expect(headerValue).toContain("frame-ancestors 'none'");
        });
    });
});