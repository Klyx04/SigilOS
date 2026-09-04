import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyGod } from "@/server/actions/god-notif-actions";
import { safeEqualStrings } from "@/lib/god-route";
import { rateLimit } from "@/lib/ratelimit";

/**
 * ☕ Webhook Réception des dons Ko-fi (#198.2 / Monétisation)
 * Ko-fi envoie un POST avec Content-Type 'application/x-www-form-urlencoded' contenant un champ 'data' en JSON.
 */
export async function POST(req: Request) {
    try {
        // 🔒 Anti-abus : rate-limit IP fail-closed (dons = faible volume légitime).
        const ip = req.headers.get("x-real-ip") || "unknown";
        const rl = await rateLimit(`kofi:${ip}`, 20, 60_000);
        if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

        const contentType = req.headers.get("content-type") || "";
        let dataJson: any;

        try {
            if (contentType.includes("application/json")) {
                const json = await req.json();
                dataJson = typeof json.data === "string" ? JSON.parse(json.data) : (json.data || json);
            } else {
                const text = await req.text();
                if (text) {
                    const params = new URLSearchParams(text);
                    const rawData = params.get("data");
                    if (rawData) {
                        dataJson = JSON.parse(rawData);
                    } else {
                        dataJson = JSON.parse(text);
                    }
                }
            }
        } catch (e) {
            try {
                const fd = await req.formData();
                const raw = fd.get("data");
                if (raw && typeof raw === "string") dataJson = JSON.parse(raw);
            } catch {}
        }

        if (!dataJson) {
            return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
        }

        // 🔒 Sécurité : Vérification du Token Ko-fi — fail-closed si absent (OWASP 2026).
        // Sans secret configuré, on refuse (503) plutôt que d'attribuer des badges à n'importe qui.
        const expectedToken = process.env.KOFI_VERIFICATION_TOKEN;
        if (!expectedToken) {
            logger.error("[Ko-fi Webhook] KOFI_VERIFICATION_TOKEN non configuré — webhook bloqué (fail-closed)");
            return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
        }
        if (!safeEqualStrings(String(dataJson.verification_token ?? ""), expectedToken)) {
            logger.warn("[Ko-fi Webhook] Invalid verification_token received");
            return NextResponse.json({ error: "Unauthorized verification token" }, { status: 401 });
        }

        const donorName = (dataJson.from_name || "").trim();
        const donorEmail = (dataJson.email || "").trim().toLowerCase();
        const amount = dataJson.amount || "0";
        const currency = dataJson.currency || "EUR";
        const message = dataJson.message || "";
        const type = dataJson.type || "Donation";
        const isSubscription = Boolean(dataJson.is_subscription_payment);

        logger.info(`[Ko-fi Webhook] Don reçu de ${donorName || "Anonyme"} (${amount} ${currency}) - Type: ${type}`);

        // 1. S'assurer que le badge "Mécène Ko-fi" existe en base
        const kofiBadge = await (db as any).badge.upsert({
            where: { slug: "kofi-supporter" },
            create: {
                slug: "kofi-supporter",
                name: "☕ Mécène Ko-fi",
                description: "A soutenu financièrement le développement et l'hébergement de SigilOS sur Ko-fi.",
                imageUrl: "https://storage.ko-fi.com/cdn/brandasset/kofi_s_logo_nolabel.png",
                rarity: isSubscription ? "MYTHIC" : "LEGENDARY",
                category: "COMMUNITY",
                isGodOnly: true,
                sortOrder: 1,
            },
            update: {}
        });

        // 2. Tenter de matcher un UserProfile via son pseudo Dofus, son pseudo Discord, son nom d'utilisateur ou son email
        let matchedProfiles: any[] = [];

        if (donorName) {
            matchedProfiles = await (db as any).userProfile.findMany({
                where: {
                    OR: [
                        { pseudoDofus: { equals: donorName, mode: "insensitive" } },
                        { discordNickname: { equals: donorName, mode: "insensitive" } },
                        { user: { name: { equals: donorName, mode: "insensitive" } } },
                        ...(donorEmail ? [{ user: { email: { equals: donorEmail, mode: "insensitive" } } }] : [])
                    ]
                }
            });
        } else if (donorEmail) {
            matchedProfiles = await (db as any).userProfile.findMany({
                where: {
                    user: { email: { equals: donorEmail, mode: "insensitive" } }
                }
            });
        }

        // 3. Attribuer le badge à tous les profils trouvés pour ce compte
        let grantedCount = 0;
        for (const prof of matchedProfiles) {
            await (db as any).userBadge.upsert({
                where: {
                    profileId_badgeId: {
                        profileId: prof.id,
                        badgeId: kofiBadge.id
                    }
                },
                create: {
                    profileId: prof.id,
                    badgeId: kofiBadge.id,
                    source: "KOFI",
                    reason: `Don Ko-fi de ${amount} ${currency}${message ? ` (« ${message} »)` : ""}`
                },
                update: {
                    reason: `Don Ko-fi de ${amount} ${currency} (renouvelé)`
                }
            });
            grantedCount++;
        }

        // 4. Alerte console GOD
        await notifyGod({
            title: `☕ Nouveau Don Ko-fi (${amount} ${currency})`,
            message: `${donorName || "Un donateur"} a fait un don de ${amount} ${currency}.${grantedCount > 0 ? ` Badge attribué à ${grantedCount} profil(s).` : " Aucun profil Discord/SigilOS matché automatiquement."}${message ? `\nMessage : « ${message} »` : ""}`,
            type: "SYSTEM",
            success: true
        });

        return NextResponse.json({
            success: true,
            grantedProfiles: grantedCount,
            donor: donorName
        });
    } catch (err: any) {
        logger.error("[Ko-fi Webhook Fatal Error]", err);
        return NextResponse.json({ error: "Internal webhook processing error" }, { status: 500 });
    }
}
