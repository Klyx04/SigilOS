"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pause, Play, Swords, MessageSquare, Gamepad2, Crown } from "lucide-react";
import { type ServiceListingWithProfile } from "@/server/actions/service-actions";
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from "@/server/actions/services-constants";
import { deleteServiceListing, toggleServiceStatus } from "@/server/actions/service-actions";
import { ServiceCategory } from "@prisma/client";
import { ServiceEditDialog } from "./service-edit-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import Image from "next/image";
import { FM_JOBS } from "./service-form";
import { getAchievementIconUrl } from "@/lib/achievement-icon";

// ---------------------------------------------------------------------------
// DESIGN TOKENS
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<ServiceCategory, { badge: string; glow: string; hover: string; icon: string }> = {
    PASSAGE_DONJON: { badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", glow: "hover:border-cyan-500/40", hover: "hover:bg-cyan-500/[0.03]", icon: "text-cyan-400" },
    FORGEMAGIE: { badge: "border-amber-500/40 bg-amber-500/10 text-amber-300", glow: "hover:border-amber-500/40", hover: "hover:bg-amber-500/[0.03]", icon: "text-amber-400" },
    METIER: { badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", glow: "hover:border-emerald-500/40", hover: "hover:bg-emerald-500/[0.03]", icon: "text-emerald-400" },
    QUETE: { badge: "border-violet-500/40 bg-violet-500/10 text-violet-300", glow: "hover:border-violet-500/40", hover: "hover:bg-violet-500/[0.03]", icon: "text-violet-400" },
    OCRE: { badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300", glow: "hover:border-yellow-500/40", hover: "hover:bg-yellow-500/[0.03]", icon: "text-yellow-400" },
    AUTRE: { badge: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300", glow: "hover:border-zinc-500/40", hover: "hover:bg-zinc-500/[0.03]", icon: "text-zinc-400" },
};

// ---------------------------------------------------------------------------
// AVAILABILITY MINI — affiche les dispos du profil directement dans la carte
// ---------------------------------------------------------------------------

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOUR_ABBR: Record<string, string> = {
    lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu",
    vendredi: "Ven", samedi: "Sam", dimanche: "Dim",
};
const SLOT_COLORS: Record<string, string> = {
    matin: "bg-orange-500/70",
    midi: "bg-amber-400/70",
    soir: "bg-violet-500/70",
    nuit: "bg-indigo-600/70",
};
const SLOT_ABBR: Record<string, string> = {
    matin: "🌅", midi: "☀️", soir: "🌙", nuit: "🌃",
};

function resolveAvailabilityMap(raw: unknown): Record<string, string[]> {
    if (!raw || typeof raw !== "object") return {};
    const obj = raw as Record<string, unknown>;
    if ("template" in obj || "weeks" in obj) {
        const template = (obj.template as Record<string, string[]>) || {};
        return template;
    }
    return raw as Record<string, string[]>;
}

function AvailabilityMini({ raw }: { raw: unknown }) {
    const map = resolveAvailabilityMap(raw);
    const activeDays = JOURS.filter(j => (map[j]?.length ?? 0) > 0);
    if (activeDays.length === 0) return null;

    return (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Disponibilités</p>
            <div className="grid grid-cols-7 gap-0.5">
                {JOURS.map(jour => {
                    const slots = map[jour] || [];
                    const isActive = slots.length > 0;
                    return (
                        <div key={jour} className="flex flex-col items-center gap-0.5">
                            <span className={`text-[8px] font-bold ${isActive ? "text-zinc-200" : "text-zinc-600"}`}>
                                {JOUR_ABBR[jour]?.slice(0, 3)}
                            </span>
                            <div className="flex flex-col gap-0.5 w-full">
                                {["matin", "midi", "soir", "nuit"].map(slot => (
                                    <div
                                        key={slot}
                                        title={`${JOUR_ABBR[jour]} ${SLOT_ABBR[slot]}`}
                                        className={`h-1.5 w-full rounded-sm transition-all ${slots.includes(slot)
                                            ? SLOT_COLORS[slot]
                                            : "bg-zinc-800/50"
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Légende */}
            <div className="flex gap-2 mt-1">
                {["matin", "midi", "soir", "nuit"].map(s => (
                    <span key={s} className="flex items-center gap-0.5 text-[8px] text-zinc-500">
                        <span className={`inline-block h-1.5 w-3 rounded-sm ${SLOT_COLORS[s]}`} />
                        {SLOT_ABBR[s]}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// PRICE TIERS
// ---------------------------------------------------------------------------

function PriceLine({ tier }: { tier: { label: string; price: string } }) {
    const isSimple = tier.label.toLowerCase().includes("simple") || tier.label.toLowerCase().includes("sans");
    return (
        <div className="flex items-center justify-between gap-3 py-0.5">
            <span className={`text-xs font-semibold truncate ${isSimple ? "text-zinc-300" : "text-cyan-200"}`}>
                {isSimple ? "⚪" : "✨"} {tier.label}
            </span>
            <span className="font-black text-amber-300 whitespace-nowrap flex items-center gap-1.5 shrink-0">
                <Image src="/assets/icons/kama.png" alt="kamas" width={14} height={14} className="object-contain" />
                {tier.price}
            </span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// OCRE PACK BADGE — affichage premium pour packs Archi/Boss
// ---------------------------------------------------------------------------

const PACK_CONFIG: Record<string, { emoji: string; color: string; glow: string; label: string }> = {
    "pack boss": { emoji: "🐉", color: "from-orange-500/20 to-yellow-500/10 border-orange-500/30", glow: "text-orange-300", label: "Pack Boss" },
    "pack boss + archi": { emoji: "👑", color: "from-yellow-500/25 to-amber-500/10 border-yellow-500/35", glow: "text-yellow-200", label: "Pack Boss + Archi" },
    "pack archi": { emoji: "⚜️", color: "from-amber-400/25 to-yellow-500/10 border-amber-400/40", glow: "text-amber-200", label: "Pack Archi" },
};

function OcrePackBadge({ packLabel, price }: { packLabel: string; price: string | null }) {
    const key = packLabel.toLowerCase().trim();
    const config = PACK_CONFIG[key] ?? { emoji: "👑", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30", glow: "text-yellow-200", label: packLabel };
    return (
        <div className={`relative flex items-center gap-3 rounded-xl border bg-gradient-to-r ${config.color} px-4 py-3 overflow-hidden`}>
            {/* subtle shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent pointer-events-none" />
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-2xl leading-none">{config.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-black uppercase tracking-wider ${config.glow}`}>{config.label}</p>
                <p className="text-[10px] text-zinc-400 font-medium">Quête Ocre complète</p>
            </div>
            {price && (
                <div className="shrink-0 flex items-center gap-1.5">
                    <Image src="/assets/icons/kama.png" alt="kamas" width={16} height={16} className="object-contain" />
                    <span className="font-black text-amber-300 text-base tabular-nums">{price}</span>
                </div>
            )}
            {!price && (
                <Crown className="h-5 w-5 text-yellow-500/60 shrink-0" />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// MAIN CARD
// ---------------------------------------------------------------------------

interface ServiceCardProps {
    listing: ServiceListingWithProfile;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
}

export function ServiceCard({ listing, guildId, currentProfileId, isAdmin }: ServiceCardProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const isOwner = listing.profileId === currentProfileId;
    const isPaused = listing.status === "PAUSED";
    const name = listing.profile.pseudoDofus || listing.profile.discordNickname || listing.profile.user?.name || "Membre";
    const col = CATEGORY_COLORS[listing.category];

    const handleDelete = async () => {
        if (!confirm("Supprimer cette annonce ?")) return;
        setLoading(true);
        const result = await deleteServiceListing(guildId, listing.id);
        if (result.success) { toast.success("Annonce supprimée."); router.refresh(); }
        else toast.error(result.error || "Erreur.");
        setLoading(false);
    };

    const handleToggle = async () => {
        setLoading(true);
        const result = await toggleServiceStatus(guildId, listing.id);
        if (result.success) { toast.success(isPaused ? "Annonce réactivée." : "Annonce mise en pause."); router.refresh(); }
        else toast.error(result.error || "Erreur.");
        setLoading(false);
    };

    return (
        <div className={`group relative flex flex-col rounded-2xl border ${isPaused ? "border-white/5 opacity-55" : `border-white/12 ${col.glow}`} bg-zinc-900/80 hover:bg-zinc-800/80 p-5 transition-all duration-300 gap-4 shadow-sm`}>

            {/* ── Header : badge catégorie + pause badge ── */}
            <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className={`${col.badge} text-[11px] font-black uppercase tracking-wide px-2.5 py-1 border`}>
                    {CATEGORY_EMOJIS[listing.category]} {CATEGORY_LABELS[listing.category]}
                </Badge>
                {isPaused && (
                    <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-bold">
                        ⏸ Pause
                    </Badge>
                )}
            </div>

            {/* ── Donjon : image + nom ── */}
            {listing.category === "PASSAGE_DONJON" && listing.dungeonName && (
                <div className="flex items-center gap-3">
                    {listing.dungeonImageUrl ? (
                        <div className="relative h-14 w-14 rounded-xl shrink-0 overflow-hidden border border-cyan-500/25 shadow-lg shadow-cyan-500/10">
                            <Image src={listing.dungeonImageUrl} alt={listing.dungeonName} fill className="object-cover" />
                        </div>
                    ) : (
                        <div className="h-14 w-14 rounded-xl shrink-0 bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Swords className="h-6 w-6 text-cyan-400" />
                        </div>
                    )}
                    <span className="text-base font-black text-cyan-300 leading-tight">{listing.dungeonName}</span>
                </div>
            )}

            {/* Quête */}
            {listing.category === "QUETE" && listing.questName && (
                <div className="flex items-center gap-2 text-sm text-violet-300 font-bold">
                    <span>📜</span><span>{listing.questName}</span>
                </div>
            )}

            {/* ── Titre ── */}
            <h3 className="text-base font-black text-white leading-snug line-clamp-2">{listing.title}</h3>

            {/* ── Description ── */}
            {listing.description && (
                <p className="text-[13px] text-zinc-300 leading-relaxed line-clamp-3">{listing.description}</p>
            )}

            {/* ── Achievements avec icônes ── */}
            {listing.category === "PASSAGE_DONJON" && (listing.selectedAchievementNames as string[] | null)?.length ? (
                <div className="flex flex-wrap gap-1.5">
                    {(listing.selectedAchievementNames as string[]).slice(0, 6).map((achName) => {
                        const slug = achName.toLowerCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                        const iconUrl = getAchievementIconUrl(slug);
                        return (
                            <span key={achName} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-bold">
                                {iconUrl && (
                                    <div className="relative h-5 w-5 shrink-0">
                                        <Image src={iconUrl} alt={achName} fill className="object-contain"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                    </div>
                                )}
                                {achName}
                            </span>
                        );
                    })}
                    {(listing.selectedAchievementNames as string[]).length > 6 && (
                        <span className="text-xs text-zinc-500 self-center">+{(listing.selectedAchievementNames as string[]).length - 6}</span>
                    )}
                </div>
            ) : null}

            {/* ── FM Professions ── */}
            {listing.category === "FORGEMAGIE" && (listing.professions as string[] | null)?.length ? (
                <div className="flex flex-wrap gap-1.5">
                    {(listing.professions as string[]).map((prof) => {
                        const jobDef = FM_JOBS.find(j => j.name === prof);
                        return (
                            <span key={prof} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold">
                                {jobDef && <div className="relative h-5 w-5 shrink-0"><Image src={jobDef.iconUrl} alt={prof} fill className="object-contain" /></div>}
                                {prof}
                            </span>
                        );
                    })}
                </div>
            ) : null}

            {/* ── OCRE : affichage pack premium ── */}
            {listing.category === "OCRE" && listing.price && (() => {
                // Prix kamas extrait du 1er priceTier si dispo
                const ocrePriceFromTier = (listing.priceTiers as { label: string; price: string }[] | null)?.[0]?.price ?? null;
                return (
                    <OcrePackBadge
                        packLabel={listing.price}
                        price={ocrePriceFromTier}
                    />
                );
            })()}

            {/* ── Tarifs par palier (non-OCRE) ── */}
            {listing.category !== "OCRE" && listing.priceTiers && listing.priceTiers.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                    {listing.priceTiers.map((tier, i) => <PriceLine key={i} tier={tier} />)}
                </div>
            ) : listing.price && listing.category !== "OCRE" ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <Image src="/assets/icons/kama.png" alt="kamas" width={18} height={18} className="object-contain shrink-0" />
                    <span className="font-black text-white text-base">
                        {/^\d+$/.test(listing.price.replace(/\s/g, ""))
                            ? `${Number(listing.price).toLocaleString("fr-FR")}`
                            : listing.price}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">kamas</span>
                </div>
            ) : null}

            {/* ── FM craftMeta ── */}
            {listing.category === "FORGEMAGIE" && listing.craftMeta && (
                <div className="space-y-0.5 text-sm text-zinc-400">
                    {listing.craftMeta.fmItems && <div>🔨 Items FM : <span className="text-zinc-200 font-bold">{listing.craftMeta.fmItems}</span></div>}
                    {listing.craftMeta.passTrans && <div>⚗️ Pass Trans : <span className="text-zinc-200 font-bold">{listing.craftMeta.passTrans}</span></div>}
                    {listing.craftMeta.commandeExo && <div>✨ Exo/Over : <span className="text-zinc-200 font-bold">{listing.craftMeta.commandeExo}</span></div>}
                </div>
            )}

            {/* ── DISPONIBILITÉS du profil (heatmap mini) ── */}
            {listing.profile.availability ? (
                <AvailabilityMini raw={listing.profile.availability} />
            ) : listing.availability ? (
                <div className="flex items-start gap-2 text-sm text-zinc-400 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    <span className="text-base leading-none">🕐</span>
                    <span className="leading-snug">{listing.availability}</span>
                </div>
            ) : null}

            {/* ── Contact ── */}
            {listing.contactMethod && (
                <div className="flex items-center gap-2 flex-wrap">
                    {listing.contactMethod.includes("Discord") && (
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-bold">
                            <MessageSquare className="h-3 w-3" /> Discord
                        </span>
                    )}
                    {listing.contactMethod.includes("En jeu") && (
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-bold">
                            <Gamepad2 className="h-3 w-3" /> En jeu
                        </span>
                    )}
                    {!listing.contactMethod.includes("Discord") && !listing.contactMethod.includes("En jeu") && (
                        <span className="text-xs text-zinc-400">{listing.contactMethod}</span>
                    )}
                </div>
            )}

            {/* ── Footer : auteur + actions ── */}
            <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-auto">
                <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 rounded-lg border border-white/10">
                        <AvatarImage src={listing.profile.user?.image || undefined} />
                        <AvatarFallback className="text-[10px] bg-zinc-800 font-bold">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-bold text-zinc-200">{name}</span>
                </div>

                {(isOwner || isAdmin) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isOwner && (
                            <>
                                <ServiceEditDialog listing={listing} guildId={guildId} />
                                <Button size="icon" variant="ghost" onClick={handleToggle} disabled={loading} className="h-8 w-8 text-zinc-500 hover:text-white">
                                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                </Button>
                            </>
                        )}
                        <Button size="icon" variant="ghost" onClick={handleDelete} disabled={loading} className="h-8 w-8 text-zinc-500 hover:text-rose-400">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
