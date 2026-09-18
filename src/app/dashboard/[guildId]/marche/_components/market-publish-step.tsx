"use client";

/**
 * Module « Marché » — **étape 4 « Publication Discord »** (S3.14).
 *
 * Aperçu **fidèle** via `DiscordEmbedPreview` (D29) construit par le **même
 * payload pur** que la publication réelle (`buildMarketDiscordPayload`) et
 * bandeau de destination (salon texte **ou** forum).
 *
 * ⚠️ Décision user du 18/09/2026 : le **choix des rôles à mentionner** (et
 * l'estimation « 👥 X membres seront notifiés ») ne vit plus ici mais sur une
 * **étape dédiée** — `market-notify-step.tsx` (étape 5), pour que la
 * notification soit lisible et vérifiable avant de publier.
 */

import { DiscordEmbedPreview, type DiscordPreviewComponentRow } from "@/components/discord/DiscordEmbedPreview";
import { buildMarketDiscordPayload, type MarketDiscordStatLine } from "@/lib/market/discord-payload";
import { cn } from "@/lib/utils";
import { Hash, Hammer, MessageSquare } from "lucide-react";

export type MarketPublishContext = {
    channelConfigured: boolean;
    channelKind: string | null;
    allowedPingRoleIds: string[];
    notifyRoleId: string | null;
};

export interface MarketPublishStepProps {
    channelName: string;
    title: string;
    itemName?: string | null;
    itemLevel?: number | null;
    itemTypeName?: string | null;
    priceKamas?: number | null;
    unitLabel?: string | null;
    negotiable: boolean;
    /**
     * D43 — « troc accepté » de l'annonce : l'embed l'affiche désormais
     * (« Troc accepté » / « Kamas uniquement »), donc l'aperçu aussi.
     */
    acceptsTrade?: boolean;
    /**
     * S8.17 — **forge déclarée** publiée par l'embed (Transcendé, élément de
     * frappe + palier de potion, arme de chasse) : mêmes valeurs que la carte
     * d'item, pour que l'aperçu reste **fidèle** à ce que verront les membres.
     */
    transcended?: boolean;
    transcendenceLabel?: string | null;
    strikeElement?: string | null;
    elementPotionTier?: number | null;
    huntingWeapon?: string | null;
    forgedBy?: string | null;
    exoLabels: string[];
    /**
     * Correction 13/09 — **jet déclaré** publié dans l'embed (valeur + libellé +
     * plage native, exo marqué « ✦ Exo »). L'annonce publiée ne portait aucune
     * ligne de stats : le vendeur ne pouvait pas relire ce qu'il publiait.
     */
    stats?: MarketDiscordStatLine[];
    /**
     * Correction 13/09 — **icône réelle de l'objet** : sans elle, l'aperçu
     * n'affichait aucune image alors que le post publié en porte une (mode
     * forum → `thumbnail`). Le chemin relatif du catalogue (`/api/assets-dofus/…`)
     * s'affiche très bien dans l'aperçu navigateur ; la publication, elle,
     * l'**absolutise** (`src/server/market/discord.ts`).
     */
    itemIconUrl?: string | null;
    /** Mode **forum** : l'icône part en `thumbnail` (pas de carte PNG). */
    forumMode?: boolean;
    /**
     * S8.9 — **forge réelle déclarée** (rune de Transcendance nommée, potion +
     * palier, arme de chasse), alimentée par le référentiel côté appelant.
     * Rappel : l'embed Discord lui-même n'expose pas encore le statut (lot 3,
     * `S8.17`) — ce récapitulatif est là pour que le vendeur relise sa
     * déclaration avant de publier.
     */
    forgeRecap?: { label: string; value: string }[];
    components: { name: string; quantity: number }[];
    /**
     * 🧺 Lot multiple — **un message Discord par objet** (option A, décision user
     * du 14/09/2026) : l'aperçu en montre donc **N**, chacun avec son objet, son
     * prix et ses propres boutons. Vide pour les annonces simples.
     */
    bundleItems?: { name: string; quantity: number; priceKamas: number; iconUrl?: string | null }[];
    context: MarketPublishContext | null;
    /**
     * Rôles cochés à l'**étape 5 « Notification »** (`market-notify-step.tsx`) :
     * servent uniquement ici à afficher la mention dans l'aperçu Discord (revenu
     * en arrière après avoir coché des rôles). La sélection elle-même vit sur
     * l'étape dédiée — décision user du 18/09/2026.
     */
    selectedPingIds?: string[];
}

export function MarketPublishStep({
    channelName,
    title,
    itemName,
    itemLevel,
    itemTypeName,
    priceKamas,
    unitLabel,
    negotiable,
    acceptsTrade,
    transcended,
    transcendenceLabel,
    strikeElement,
    elementPotionTier,
    huntingWeapon,
    exoLabels,
    stats = [],
    forgeRecap = [],
    itemIconUrl,
    forumMode = false,
    components,
    bundleItems = [],
    context,
    selectedPingIds = [],
}: MarketPublishStepProps) {
    const isForum = context?.channelKind === "FORUM";

    const payload = buildMarketDiscordPayload({
        listingId: "preview",
        title,
        status: "ACTIVE",
        sellerName: "Toi",
        itemName,
        itemLevel,
        itemTypeName,
        priceKamas,
        unitLabel,
        negotiable,
        // S8.17 — statut de forge déclaré + conditions de troc (D43).
        acceptsTrade,
        transcended,
        transcendenceLabel,
        strikeElement,
        elementPotionTier,
        huntingWeapon,
        exoLabels,
        // BUG-5 (spec §2.4) — l'aperçu ne liste plus le jet en texte : il est
        // rendu par la **carte image** (icônes officielles + couleurs).
        components,
        dashboardUrl: "#",
    });

    return (
        <div className="space-y-5">
            {/* Bandeau de destination */}
            <div
                className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3",
                    context?.channelConfigured ? "border-border bg-surface/60" : "border-warning/30 bg-warning/10"
                )}
                data-tour="marche-publish"
            >
                {isForum ? (
                    <MessageSquare className="h-5 w-5 text-info" />
                ) : (
                    <Hash className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="min-w-0">
                    {context?.channelConfigured ? (
                        <>
                            <p className="text-sm font-bold text-foreground">
                                Publication dans #{channelName || "salon configuré"}
                                <span className="ml-2 rounded-md border border-border px-1.5 text-[10px] font-black uppercase text-muted-foreground">
                                    {isForum ? "Forum" : "Texte"}
                                </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {isForum
                                    ? "Un post sera créé avec le nom de l'annonce et l'icône de l'objet."
                                    : "Un message avec la carte de l'item sera envoyé."}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-warning">Aucun salon Discord configuré</p>
                            <p className="text-[11px] text-muted-foreground">
                                Ton annonce sera publiée sur SigilOS sans Discord. Demande à un admin de
                                configurer le salon dans Réglages → Marché.
                            </p>
                        </>
                    )}
                </div>
            </div>


            {/* S8.9 — récapitulatif de la forge déclarée (D40/D41) */}
            {forgeRecap.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        <Hammer className="h-3.5 w-3.5" /> Forge déclarée
                    </p>
                    <ul className="space-y-1">
                        {forgeRecap.map((line) => (
                            <li
                                key={line.label}
                                className="flex flex-wrap items-baseline gap-2 text-xs"
                            >
                                <span className="font-bold text-muted-foreground">{line.label}</span>
                                <span className="text-foreground">{line.value}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        Ces informations sont enregistrées avec l&apos;annonce et apparaissent sur
                        la carte de l&apos;objet (bloc STATUT).
                    </p>
                </div>
            )}

            {/* 🧺 Lot multiple — **un message Discord par objet** (option A) : l'aperçu
                en montre donc N, chacun avec son nom, son prix et ses boutons. */}
            {bundleItems.length > 0 ? (
                <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Aperçu Discord — {bundleItems.length} message{bundleItems.length > 1 ? "s" : ""}, un
                        par objet
                    </p>
                    {bundleItems.map((bundleItem, index) => {
                        const itemPayload = buildMarketDiscordPayload({
                            listingId: "preview",
                            title,
                            status: "ACTIVE",
                            sellerName: "Toi",
                            itemName: bundleItem.name,
                            itemLevel,
                            itemTypeName,
                            priceKamas: bundleItem.priceKamas,
                            unitLabel: null,
                            negotiable,
                            acceptsTrade,
                            transcended: false,
                            transcendenceLabel: null,
                            strikeElement: null,
                            elementPotionTier: null,
                            huntingWeapon: null,
                            exoLabels: [],
                            components: [{ name: bundleItem.name, quantity: bundleItem.quantity }],
                            dashboardUrl: "#",
                        });
                        return (
                            <div key={`${index}-${bundleItem.name}`} className="space-y-2">
                                <p className="text-xs font-semibold text-foreground">
                                    {index + 1}/{bundleItems.length} — {bundleItem.name}
                                </p>
                                <DiscordEmbedPreview
                                    title={itemPayload.embedTitle}
                                    description={itemPayload.embedDescription}
                                    color={itemPayload.embedColor}
                                    fields={itemPayload.fields}
                                    footer={itemPayload.embedFooter}
                                    components={
                                        itemPayload.components as unknown as DiscordPreviewComponentRow[]
                                    }
                                    thumbnail={bundleItem.iconUrl ?? undefined}
                                    mentionContent={selectedPingIds.map(() => "@role").join(" ")}
                                    channelName={channelName || "marche"}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
            /* Aperçu fidèle (correction 13/09 : boutons réels + icône objet) */
            <DiscordEmbedPreview
                title={payload.embedTitle}
                description={payload.embedDescription}
                color={payload.embedColor}
                fields={payload.fields}
                footer={payload.embedFooter}
                // Les **vrais** composants du payload (le post publié porte ces boutons).
                components={payload.components as unknown as DiscordPreviewComponentRow[]}
                // Mode forum : l'icône objet est envoyée en `thumbnail` par Discord.
                thumbnail={itemIconUrl ?? undefined}
                mentionContent={selectedPingIds.map(() => "@role").join(" ")}
                channelName={channelName || "marche"}
            />
            )}
            {!forumMode && bundleItems.length === 0 && (
                <p className="text-caption italic text-muted-foreground">
                    En salon texte, Discord affiche à la place l&apos;image de la carte de
                    l&apos;annonce, générée <strong>au moment de la publication</strong>.
                </p>
            )}
        </div>
    );
}
