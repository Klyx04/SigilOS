import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";

// Prisma impose le runtime Node (pas d'edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_WIDTH = 640;
const CARD_HEIGHT = 520;

/** Statuts dont la carte est publique (déjà exposée dans l'embed Discord). */
const PUBLIC_STATUSES = ["ACTIVE", "RESERVED", "SOLD", "EXPIRED", "WITHDRAWN"];

function statColor(origin: string, quality: string, characteristic: number | null): string {
    if (origin === "EXO") return "#67e8f9"; // cyan
    if ([1, 23, 19].includes(characteristic ?? -1)) return "#67e8f9";
    switch (quality) {
        case "PERFECT":
            return "#ffffff";
        case "OVER":
            return "#22d3ee";
        case "GOOD":
            return "#34d399";
        case "LOW":
            return "#fbbf24";
        default:
            return "#9ca3af";
    }
}

/**
 * GET /api/og/market/[id] — carte PNG d'une annonce (S2.16).
 *
 * ⚠️ Discord récupère l'image des embeds **sans session** : la carte est donc
 * publique pour les annonces publiées (statut public) et le contenu affiché est
 * exactement celui de l'embed (nom, jet, pods, prix). Le cache est invalidé par
 * `v=` (= `statsHash`), donc régénéré à chaque modification du jet (§12.7).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const listing = await db.marketListing.findUnique({
            where: { id },
            include: {
                stats: true,
                components: { orderBy: { position: "asc" } },
                profile: { select: { pseudoDofus: true } },
            },
        });
        if (!listing || !PUBLIC_STATUSES.includes(listing.status)) {
            return new Response("Carte introuvable", { status: 404 });
        }

        const baseUrl = getAppBaseUrl();
        const headerName = listing.itemName || listing.title;
        const priceLabel = listing.priceKamas != null
            ? `${listing.priceKamas.toLocaleString("fr-FR")} K`
            : "Prix non fixé";
        const exoLabels = listing.stats.filter((s) => s.origin === "EXO").map((s) => s.label);

        // Les PODS viennent du CATALOGUE (GameItem), pas de l'annonce.
        const catalogItem = listing.dofusDbItemId
            ? await db.gameItem.findUnique({
                  where: { ankamaId: listing.dofusDbItemId },
                  select: { realWeight: true },
              })
            : null;
        const realWeight = catalogItem?.realWeight ?? null;

        const itemIconUrl = listing.dofusDbItemId
            ? `${baseUrl}/api/assets-dofus/items/${listing.dofusDbItemId}`
            : null;

        // On n'affiche que les 10 premières lignes sur la carte (lisibilité).
        const visibleStats = listing.stats.slice(0, 10);
        const visibleComponents = listing.components.slice(0, 5);

        return new ImageResponse(
            (
                <div
                    style={{
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        display: "flex",
                        flexDirection: "column",
                        background: "linear-gradient(160deg, #101018 0%, #0a0a10 100%)",
                        border: "2px solid #26283a",
                        borderRadius: 22,
                        padding: 28,
                        fontFamily: "sans-serif",
                        color: "#e5e7eb",
                    }}
                >
                    {/* En-tête */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{headerName}</div>
                            <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 4 }}>
                                {listing.itemLevel ? `Niveau ${listing.itemLevel}` : ""}
                                {listing.itemLevel && listing.itemTypeName ? " • " : ""}
                                {listing.itemTypeName ?? ""}
                            </div>
                            {exoLabels.length > 0 && (
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#67e8f9", marginTop: 6 }}>
                                    ★ Exo {exoLabels.join(" · ")}
                                </div>
                            )}
                        </div>
                        {itemIconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={itemIconUrl}
                                alt=""
                                width={72}
                                height={72}
                                style={{ borderRadius: 14, background: "#141520" }}
                            />
                        )}
                    </div>

                    {/* Effets */}
                    {visibleStats.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
                            <div style={{ fontSize: 11, letterSpacing: 4, color: "#6b7280", fontWeight: 800 }}>
                                EFFETS
                            </div>
                            {visibleStats.map((stat) => (
                                <div
                                    key={`${stat.effectId}-${stat.origin}`}
                                    style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: 15,
                                            fontWeight: 800,
                                            color: statColor(stat.origin, stat.quality, stat.characteristic),
                                            width: 70,
                                        }}
                                    >
                                        {stat.actualValue >= 0 ? `+${stat.actualValue}` : `${stat.actualValue}`}
                                    </div>
                                    <div style={{ display: "flex", flex: 1, fontSize: 15, color: "#d1d5db" }}>
                                        {stat.label}
                                    </div>
                                    <div style={{ display: "flex", fontSize: 13, color: "#6b7280" }}>
                                        {stat.naturalMin != null && stat.naturalMax != null
                                            ? `[${stat.naturalMin} à ${stat.naturalMax}]`
                                            : `[${stat.actualValue}]`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}


                    {/* Contenu du lot */}
                    {visibleComponents.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
                            <div style={{ fontSize: 11, letterSpacing: 4, color: "#6b7280", fontWeight: 800 }}>
                                CONTENU DU LOT
                            </div>
                            {visibleComponents.map((component, index) => (
                                <div key={index} style={{ display: "flex", fontSize: 14, color: "#d1d5db", marginTop: 4 }}>
                                    ×{component.quantity.toLocaleString("fr-FR")} {component.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pied */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            marginTop: "auto",
                            paddingTop: 14,
                            borderTop: "1px solid #26283a",
                            fontSize: 14,
                            color: "#9ca3af",
                        }}
                    >
                        <div style={{ display: "flex" }}>POIDS {realWeight ?? "—"}</div>
                        <div style={{ display: "flex", color: "#d4af37", fontWeight: 900 }}>{priceLabel}</div>
                        <div style={{ display: "flex", marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>
                            SigilOS Market
                        </div>
                    </div>
                </div>
            ),
            {
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                headers: {
                    "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
                },
            }
        );
    } catch {
        return new Response("Échec de génération de la carte", { status: 500 });
    }
}

