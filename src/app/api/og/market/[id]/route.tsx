import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { resolveDofusStatTheme } from "@/lib/dofus-stats-theme";
// Constat beta — une ligne de jet `0 → 0` (« Échangeable : », « Compatible
// avec : ») n'est pas une statistique : jamais peinte, ni comptée dans la carte.
import { isStatBearingStatRow } from "@/lib/market/effects";
import { buildMarketStatusLines, shortListingId } from "@/lib/market/discord-payload";
import { loadItemImageDataUrl, loadKamasIconDataUrl, loadStatIconDataUrl } from "@/lib/market/og-assets";

// Prisma impose le runtime Node (pas d'edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_WIDTH = 760;
const CARD_HEIGHT = 560;
const ITEM_BOX = 236;
/**
 * BUG-4 — quand l'annonce n'a **aucune ligne de stats** (cosmétique, ressources,
 * vente brute), l'objet est affiché **en grand** : il n'y a pas de colonne
 * d'effets à équilibrer, et une petite vignette au milieu d'un cadre vide est
 * illisible sur Discord.
 */
const ITEM_BOX_LARGE = 340;
/**
 * Constat beta (14/09) — « n'affiche pas "+3 autres lignes", affiche **toutes**
 * les lignes, compresse un peu plus intelligemment ». Plus de troncature : la
 * carte **grandit** et la densité des lignes s'adapte au volume (hauteur de
 * ligne, icône, valeur, libellé, badge, plage).
 */
const CARD_HEADER_HEIGHT = 80;
const CARD_FOOTER_HEIGHT = 48;
const CARD_BODY_PADDING = 32;

type StatRowMetrics = {
    /** Hauteur d'une ligne (px). */
    row: number;
    /** Côté de l'icône officielle (px). */
    icon: number;
    value: number;
    label: number;
    badge: number;
    range: number;
};

/** Métriques d'une ligne de jet, **compressées** au-delà de 12 / 18 / 24 lignes. */
function statRowMetrics(count: number): StatRowMetrics {
    if (count > 24) return { row: 19, icon: 12, value: 12.5, label: 12.5, badge: 9, range: 10.5 };
    if (count > 18) return { row: 21, icon: 14, value: 13.5, label: 13.5, badge: 10, range: 11.5 };
    if (count > 12) return { row: 24, icon: 16, value: 15, label: 14.5, badge: 10, range: 12.5 };
    return { row: 29, icon: 18, value: 16, label: 15, badge: 11, range: 13 };
}

/** Statuts dont la carte est publique (déjà exposée dans l'embed Discord). */
const PUBLIC_STATUSES = ["ACTIVE", "RESERVED", "SOLD", "EXPIRED", "WITHDRAWN"];

/** Couleur d'une ligne de jet — lecture immédiate, comme en jeu. */
function statValueColor(stat: {
    actualValue: number;
    origin: string;
    quality: string;
    characteristic: number | null;
}): string {
    if (stat.actualValue < 0) return "#f87171"; // malus
    if (stat.origin === "EXO") return "#22d3ee"; // exo
    if ([1, 23, 19].includes(stat.characteristic ?? -1)) return "#22d3ee"; // PA / PM / PO
    switch (stat.quality) {
        case "OVER":
            return "#22d3ee";
        case "PERFECT":
            return "#ffffff";
        case "GOOD":
            return "#34d399";
        case "LOW":
            return "#fbbf24";
        default:
            return "#cbd5e1";
    }
}

/** Étiquette courte affichée après la valeur (`over`, `exo`, `malus`, `max`). */
function statBadge(stat: { actualValue: number; origin: string; quality: string }): string | null {
    if (stat.actualValue < 0) return "malus";
    if (stat.origin === "EXO") return "exo";
    if (stat.quality === "OVER") return "over";
    if (stat.quality === "PERFECT") return "max";
    return null;
}

/** Plage native lisible : `[81 à 100]`, `[1]`, jamais `[null]`. */
function formatRange(min: number | null, max: number | null): string {
    if (min == null && max == null) return "";
    if (min == null) return `[${max}]`;
    if (max == null) return `[${min}]`;
    if (min === max) return `[${min}]`;
    return `[${Math.min(min, max)} à ${Math.max(min, max)}]`;
}

function formatKamas(value: number | null): string {
    return value == null ? "Prix non fixé" : `${value.toLocaleString("fr-FR")} K`;
}

/**
 * GET /api/og/market/[id] — **carte d'annonce** du Marché (S2.16, refonte S8.22).
 *
 * ⚠️ Discord récupère l'image des embeds **sans session** : la carte reste donc
 * publique pour les annonces publiées (statut public) et son contenu est
 * exactement celui de l'embed (nom, jet, statut de forge, troc, prix, poids,
 * pseudo Dofus du vendeur). **Aucune donnée privée** : pas d'id Discord, pas de
 * montant d'offre, pas d'id interne. Le cache est invalidé par `v=`
 * (= `statsHash`), donc régénéré à chaque modification du jet (§12.7).
 *
 * Rendu calqué sur la **tooltip Dofus** : image de l'objet à droite, effets à
 * gauche avec les **assets officiels** des statistiques et la colorisation
 * over / malus / exo / transcendance.
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

        const headerName = listing.itemName || listing.title;

        // Les PODS viennent du CATALOGUE (GameItem), pas de l'annonce.
        const catalogItem = listing.dofusDbItemId
            ? await db.gameItem.findUnique({
                  where: { ankamaId: listing.dofusDbItemId },
                  select: { realWeight: true },
              })
            : null;
        const realWeight = catalogItem?.realWeight ?? null;

        // BUG-5 — image de l'objet **inlinée** (WebP siphonné → PNG via Sharp) :
        // Satori ne décode pas le WebP et un auto-appel HTTP pouvait échouer.
        // Constat beta — un **lot** n'a pas d'`ankamaId` d'annonce : on retombe
        // sur le **1ᵉʳ composant** (la carte montrait un cadre vide).
        const itemImageDataUrl = await loadItemImageDataUrl(
            listing.dofusDbItemId ?? listing.components[0]?.dofusDbItemId ?? null
        );
        // BUG-5 — icône Kamas officielle, embarquée DANS l'image (spec §2.4).
        const kamasIconDataUrl = loadKamasIconDataUrl();

        /**
         * Constat beta — les lignes de **métadonnées** (`0 → 0`) sont écartées
         * avant tout calcul : une annonce ancienne qui les porte s'affiche comme
         * un objet sans jet (objet en grand), jamais « +0 Échangeable : [0] ».
         */
        const statLines = listing.stats.filter(isStatBearingStatRow);
        // Constat beta — **toutes** les lignes sont peintes (aucune troncature,
        // aucun « + N autre(s) ligne(s) ») : la carte grandit, les lignes se
        // compressent par paliers (`statRowMetrics`).
        const visibleStats = statLines;
        const metrics = statRowMetrics(statLines.length);
        /**
         * BUG-4 — pas de lignes de stats ⇒ **objet en grand** (et l'image est
         * proportionnellement plus grande) : c'est le seul contenu utile de la
         * carte. Sinon on garde la composition « tooltip Dofus » (effets à
         * gauche, objet à droite).
         */
        const hasStatLines = visibleStats.length > 0;
        const boxSize = hasStatLines ? ITEM_BOX : ITEM_BOX_LARGE;
        const visibleComponents = listing.components.slice(0, 6);
        /**
         * Hauteur **dynamique** : la carte s'allonge avec le nombre de lignes de
         * jet et le contenu du lot (jamais de ligne perdue, jamais de texte
         * écrasé) — minimum `CARD_HEIGHT`.
         */
        const componentBlockHeight =
            visibleComponents.length > 0 ? 26 + visibleComponents.length * 21 : 0;
        const cardHeight = Math.max(
            CARD_HEIGHT,
            CARD_HEADER_HEIGHT +
                CARD_FOOTER_HEIGHT +
                CARD_BODY_PADDING +
                (hasStatLines ? 0 : 32) +
                statLines.length * metrics.row +
                componentBlockHeight
        );

        // S8.17 — source **unique** du bloc statut (Transcendé, élément + palier,
        // arme de chasse, « Troc accepté » / « Kamas uniquement »).
        const statusLines = buildMarketStatusLines({
            transcended: listing.transcendenceRuneId !== null,
            transcendenceLabel: listing.transcendenceLabel,
            strikeElement: listing.strikeElement,
            elementPotionTier: listing.elementPotionTier,
            huntingWeapon: listing.huntingWeapon,
            acceptsTrade: listing.acceptsTrade,
        });



        // Lignes prêtes à peindre : icône officielle + valeur + couleur + badge.
        const statRows = visibleStats.map((stat) => {
            const theme = resolveDofusStatTheme(stat.characteristic, stat.effectId, null, stat.label);
            return {
                id: stat.id,
                // BUG-5 — icône officielle **inlinée** (data-URI) : plus de 404,
                // plus de dépendance réseau au moment du rendu Discord.
                iconUrl: theme ? loadStatIconDataUrl(theme.asset) : null,
                valueLabel: stat.actualValue >= 0 ? `+${stat.actualValue}` : `${stat.actualValue}`,
                color: statValueColor(stat),
                badge: statBadge(stat),
                label: stat.label,
                range: formatRange(stat.naturalMin, stat.naturalMax),
            };
        });

        return new ImageResponse(
            (
                <div
                    style={{
                        width: CARD_WIDTH,
                        height: cardHeight,
                        display: "flex",
                        flexDirection: "column",
                        background: "linear-gradient(155deg, #14121f 0%, #0b0a12 100%)",
                        border: "2px solid #2a2740",
                        borderRadius: 18,
                        overflow: "hidden",
                        fontFamily: "sans-serif",
                    }}
                >
                    {/* ─── En-tête : nom + niveau/type + statut de forge ─────────── */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            padding: "16px 22px",
                            background: "linear-gradient(90deg, #241d3d 0%, #1a1630 100%)",
                            borderBottom: "1px solid #322b4d",
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: "#f5f3ff" }}>
                                {headerName}
                            </div>
                            <div style={{ display: "flex", gap: 12, fontSize: 15, color: "#b9b3d4" }}>
                                {listing.itemLevel != null && (
                                    <div style={{ display: "flex" }}>Niveau {listing.itemLevel}</div>
                                )}
                                {listing.itemTypeName && <div style={{ display: "flex" }}>{listing.itemTypeName}</div>}
                                {realWeight != null && <div style={{ display: "flex" }}>{realWeight} pods</div>}
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                            {statusLines.slice(0, 3).map((line) => (
                                <div
                                    key={line}
                                    style={{
                                        display: "flex",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: line.startsWith("Transcendé") ? "#f0abfc" : "#a5f3fc",
                                        border: `1px solid ${line.startsWith("Transcendé") ? "#a21caf" : "#0e7490"}`,
                                        background: line.startsWith("Transcendé") ? "#3b0764" : "#083344",
                                        borderRadius: 999,
                                        padding: "3px 10px",
                                    }}
                                >
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── Corps : effets (gauche) + objet & prix (droite) ────────── */}
                    <div style={{ display: "flex", flex: 1, gap: 18, padding: "16px 22px" }}>
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 7 }}>
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 12,
                                    letterSpacing: 4,
                                    color: "#8b84ad",
                                    fontWeight: 800,
                                }}
                            >
                                EFFETS
                            </div>
                            {statRows.length === 0 && (
                                <div style={{ display: "flex", fontSize: 15, color: "#6b7280" }}>
                                    Jet non déclaré par le vendeur.
                                </div>
                            )}
                            {statRows.map((row) => (
                                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {row.iconUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={row.iconUrl} width={metrics.icon} height={metrics.icon} alt="" />
                                    ) : (
                                        <div
                                            style={{
                                                display: "flex",
                                                width: metrics.icon,
                                                height: metrics.icon,
                                                borderRadius: 4,
                                                background: "#3b3560",
                                            }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            width: 58,
                                            justifyContent: "flex-end",
                                            fontSize: metrics.value,
                                            fontWeight: 800,
                                            color: row.color,
                                        }}
                                    >
                                        {row.valueLabel}
                                    </div>
                                    <div style={{ display: "flex", flex: 1, fontSize: metrics.label, color: "#e5e7eb" }}>
                                        {row.label}
                                    </div>
                                    {row.badge && (
                                        <div
                                            style={{
                                                display: "flex",
                                                fontSize: metrics.badge,
                                                fontWeight: 800,
                                                color: row.color,
                                                border: `1px solid ${row.color}`,
                                                borderRadius: 999,
                                                padding: "1px 6px",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {row.badge}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            width: 82,
                                            justifyContent: "flex-end",
                                            fontSize: metrics.range,
                                            color: "#6b7280",
                                        }}
                                    >
                                        {row.range}
                                    </div>
                                </div>
                            ))}
                            {visibleComponents.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: 12,
                                            letterSpacing: 4,
                                            color: "#8b84ad",
                                            fontWeight: 800,
                                        }}
                                    >
                                        CONTENU DU LOT
                                    </div>
                                    {visibleComponents.map((component, index) => (
                                        <div key={index} style={{ display: "flex", fontSize: 14, color: "#cbd5e1" }}>
                                            ×{component.quantity.toLocaleString("fr-FR")} {component.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                        {/* ─── Objet (image en gros) + prix + conditions ──────────── */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: boxSize + 20,
                                gap: 10,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    width: boxSize,
                                    height: boxSize,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "2px solid #3b3560",
                                    borderRadius: 16,
                                    background: "radial-gradient(circle at 50% 40%, #2a2547 0%, #14111f 100%)",
                                }}
                            >
                                {itemImageDataUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={itemImageDataUrl}
                                        width={boxSize - 40}
                                        height={boxSize - 40}
                                        alt=""
                                    />
                                ) : (
                                    /*
                                     * BUG-4 — plus jamais de « ? » : un cadre neutre
                                     * (aucun glyphe de question) quand l'asset est
                                     * introuvable après les trois tentatives.
                                     */
                                    <div
                                        style={{
                                            display: "flex",
                                            width: boxSize - 80,
                                            height: boxSize - 80,
                                            border: "2px dashed #4b5563",
                                            borderRadius: 14,
                                        }}
                                    />
                                )}
                            </div>

                            {/* BUG-5 — le **prix + l'icône Kamas** sont dans l'image (spec §2.4). */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: "4px 12px",
                                    borderRadius: 12,
                                    border: "1px solid #78350f",
                                    background: "#1c1408",
                                }}
                            >
                                {kamasIconDataUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={kamasIconDataUrl} width={22} height={22} alt="" />
                                )}
                                <div style={{ display: "flex", fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>
                                    {formatKamas(listing.priceKamas)}
                                </div>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "#a5f3fc",
                                        border: "1px solid #0e7490",
                                        background: "#083344",
                                        borderRadius: 999,
                                        padding: "3px 10px",
                                    }}
                                >
                                    {listing.acceptsTrade ? "Troc accepté" : "Kamas uniquement"}
                                </div>
                                {listing.negotiable && (
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "#fde68a",
                                            border: "1px solid #b45309",
                                            background: "#422006",
                                            borderRadius: 999,
                                            padding: "3px 10px",
                                        }}
                                    >
                                        Négociable
                                    </div>
                                )}
                                {listing.quantity != null && (
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "#ddd6fe",
                                            border: "1px solid #6d28d9",
                                            background: "#2e1065",
                                            borderRadius: 999,
                                            padding: "3px 10px",
                                        }}
                                    >
                                        {listing.unitLabel || `×${listing.quantity}`}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", fontSize: 13, color: "#8b84ad" }}>
                                Échange conclu en jeu — non garanti
                            </div>
                        </div>
                    </div>


                    {/* ─── Pied : vendeur + origine ──────────────────────────────── */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "12px 22px",
                            borderTop: "1px solid #2a2740",
                            fontSize: 14,
                            color: "#9ca3af",
                        }}
                    >
                        <div style={{ display: "flex", color: "#e5e7eb", fontWeight: 700 }}>
                            {listing.profile?.pseudoDofus || "Vendeur"}
                        </div>
                        {listing.forgedBy && <div style={{ display: "flex" }}>Modifié par {listing.forgedBy}</div>}
                        {/* BUG-5 — vendeur + #annonce + horodatage dans l'image (spec §2.4). */}
                        <div style={{ display: "flex", marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
                            Annonce #{shortListingId(listing.id)} ·{" "}
                            {listing.createdAt.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                            })}{" "}
                            à{" "}
                            {listing.createdAt.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}{" "}
                            · SigilOS Market
                        </div>
                    </div>
                </div>
            ),
            {
                width: CARD_WIDTH,
                height: cardHeight,
                headers: {
                    "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
                },
            }
        );
    } catch {
        return new Response("Échec de génération de la carte", { status: 500 });
    }
}

