"use client";

/**
 * Module « Marché » — **étape 4 « Publication Discord »** (S3.14).
 *
 * Aperçu **fidèle** via `DiscordEmbedPreview` (D29) construit par le **même
 * payload pur** que la publication réelle (`buildMarketDiscordPayload`), bandeau
 * de destination (salon texte **ou** forum), et choix des rôles à ping **limité
 * aux rôles autorisés** (`marketAllowedPingRoleIds`) + option « Ne mentionner
 * personne ». Le ping est revalidé côté serveur (S3.15).
 */

import { DiscordEmbedPreview } from "@/components/discord/DiscordEmbedPreview";
import { buildMarketDiscordPayload } from "@/lib/market/discord-payload";
import { cn } from "@/lib/utils";
import { Hash, MessageSquare, Users } from "lucide-react";

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
    forgedBy?: string | null;
    exoLabels: string[];
    components: { name: string; quantity: number }[];
    context: MarketPublishContext | null;
    roles: { id: string; name: string }[];
    selectedPingIds: string[];
    onTogglePing: (roleId: string) => void;
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
    exoLabels,
    components,
    context,
    roles,
    selectedPingIds,
    onTogglePing,
}: MarketPublishStepProps) {
    const isForum = context?.channelKind === "FORUM";
    const pingableRoles = roles.filter((role) => (context?.allowedPingRoleIds ?? []).includes(role.id));

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
        exoLabels,
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

            {/* Rôles à ping (limités aux rôles autorisés) */}
            {context?.channelConfigured && (
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> Notifier
                    </p>
                    {pingableRoles.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                            Aucun rôle autorisé par l&apos;admin — la publication ne notifiera personne.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => selectedPingIds.forEach((id) => onTogglePing(id))}
                                className={cn(
                                    "rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                    selectedPingIds.length === 0
                                        ? "border-gold/40 bg-gold/10 text-gold"
                                        : "border-border text-muted-foreground hover:border-border-strong"
                                )}
                            >
                                Ne mentionner personne
                            </button>
                            {pingableRoles.map((role) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => onTogglePing(role.id)}
                                    className={cn(
                                        "rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                        selectedPingIds.includes(role.id)
                                            ? "border-gold/40 bg-gold/10 text-gold"
                                            : "border-border text-muted-foreground hover:border-border-strong"
                                    )}
                                >
                                    @{role.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Aperçu fidèle */}
            <DiscordEmbedPreview
                title={payload.embedTitle}
                description={payload.embedDescription}
                color={payload.embedColor}
                fields={payload.fields}
                footer={payload.embedFooter}
                mentionContent={selectedPingIds.map(() => "@role").join(" ")}
                channelName={channelName || "marche"}
            />
        </div>
    );
}
