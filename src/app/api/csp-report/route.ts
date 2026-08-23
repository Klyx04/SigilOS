import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * CSP Report endpoint (F-29)
 * -------------------------
 * Reçoit les rapports de violation CSP envoyés par le navigateur via
 * `report-uri /api/csp-report` (et `report-to csp-endpoint`).
 *
 * Sécurité :
 * - Validation Zod complète du payload (champs standard CSP report).
 * - Borne de taille : refuser > 64 Ko → 413 (évite le flooding/noise).
 * - Rate-limit IP simple en mémoire bornée (pattern src/proxy.ts), fail-closed :
 *   si le limiter dépasse → 429.
 * - Log structuré via `logger` (jamais console.*) — `script-sample` et
 *   `source-file` tronqués (500 chars).
 *
 * Le proxy (src/proxy.ts) autorise déjà /api/csp-report en route publique
 * (isPublicApi) avec un rate-limit IP à 60 req/min.
 */

// ─── Zod schema — payload standards CSP report (spec W3C CSP3) ───────────────
const zone = z
    .string()
    .max(500, "source-file/script-sample too long")
    .optional();

const cspReportSchema = z.object({
    "document-uri": z.string().url().max(2000).optional(),
    "referrer": z.string().max(500).optional(),
    "blocked-uri": z.string().max(1000).optional(),
    "violated-directive": z.string().max(200).optional(),
    "effective-directive": z.string().max(200).optional(),
    "original-policy": z.string().max(4000).optional(),
    "disposition": z.enum(["enforce", "report"]).optional(),
    "source-file": zone,
    "line-number": z.number().int().min(0).max(1_000_000).optional(),
    "column-number": z.number().int().min(0).max(1_000_000).optional(),
    "script-sample": zone,
    "status-code": z.number().int().min(100).max(599).optional(),
    "sample": zone, // alias compatible (certains navigateurs anciens)
});

const cspReportRequestSchema = z.object({
    // Format CSP3 : { "csp-report": {...} }
    "csp-report": cspReportSchema,
}).passthrough();

// ─── Rate limiter IP en mémoire (borné, pattern proxy) ───────────────────────
const MAX_IP_COUNTER_ENTRIES = 10_000;
const ipCounters = new Map<string, { count: number; reset: number }>();

function ipRateLimit(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = ipCounters.get(ip);

    if (!entry || now > entry.reset) {
        if (ipCounters.size >= MAX_IP_COUNTER_ENTRIES) {
            for (const [k, v] of ipCounters) {
                if (v.reset < now) ipCounters.delete(k);
            }
        }
        if (ipCounters.size >= MAX_IP_COUNTER_ENTRIES) return true; // no new alloc
        ipCounters.set(ip, { count: 1, reset: now + windowMs });
        return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
}

function getClientIp(req: NextRequest): string {
    // Se fier UNIQUEMENT à x-real-ip (Caddy le pose/surécrit) — voir proxy.ts.
    const realIp = req.headers.get("x-real-ip") || "unknown";
    if (realIp !== "unknown" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(realIp)) {
        return "untrusted";
    }
    return realIp;
}

// ─── Max body size (64 Ko) — rejet anticipé avant tout parse ─────────────────
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
    // 1. Rate-limit IP (60 req/min, cohérent avec le proxy) → 429.
    const ip = getClientIp(req);
    if (!ipRateLimit(`${ip}:csp-report`, 60, 60_000)) {
        return new NextResponse(null, { status: 429, headers: { "Retry-After": "60" } });
    }

    // 2. Borne de taille (Content-Length fiable) → 413 avant le body parse.
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
        return new NextResponse(null, { status: 413 });
    }

    // 3. Parse + validation Zod.
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return new NextResponse(null, { status: 400 });
    }

    const parsed = cspReportRequestSchema.safeParse(raw);
    if (!parsed.success) {
        // Un payload invalide n'est pas une violation CSP — on l'ignore (204).
        return new NextResponse(null, { status: 204 });
    }

    // 4. Extraire le rapport (CSP3 → csp-report ; compatible → racine).
    const report = parsed.data?.["csp-report"] ?? parsed.data;

    // 5. Log structuré — jamais console.*. Tronquer les champs sensibles.
    logger.warn("CSP violation report", {
        ip,
        effectiveDirective: report?.["effective-directive"] || "unknown",
        violatedDirective: report?.["violated-directive"] || "unknown",
        blockedUri: report?.["blocked-uri"] || "unknown",
        sourceFile: (report?.["source-file"] || "").slice(0, 500),
        scriptSample: (report?.["script-sample"] || report?.["sample"] || "").slice(0, 500),
        lineNumber: report?.["line-number"],
        columnNumber: report?.["column-number"],
        disposition: report?.["disposition"] || "unknown",
        documentUri: report?.["document-uri"] || "unknown",
        referrer: (report?.["referrer"] || "").slice(0, 500),
    });

    // 6. Toujours répondre 204 (le navigateur ne doit pas réessayer).
    return new NextResponse(null, { status: 204 });
}