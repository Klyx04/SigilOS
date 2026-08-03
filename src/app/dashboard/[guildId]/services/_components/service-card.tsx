"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pause, Play, Swords, MessageSquare, Gamepad2, Crown, GraduationCap } from "lucide-react";
import { type ServiceListingWithProfile } from "@/server/actions/service-actions";
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from "@/server/actions/services-constants";
import { deleteServiceListing, toggleServiceStatus } from "@/server/actions/service-actions";
import { ServiceCategory } from "@prisma/client";
import { ServiceEditDialog } from "./service-edit-dialog";
import { ServiceContactDialog } from "./service-contact-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import Image from "next/image";
import { FM_JOBS } from "./service-form";
import { getAchievementIconUrl } from "@/lib/achievement-icon";
import { getJob, DOFUS_CLASSES } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DESIGN TOKENS
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<ServiceCategory, { badge: string; glow: string; hover: string; icon: string; bg: string }> = {
    PASSAGE_DONJON: { badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400", glow: "hover:border-cyan-500/40", hover: "hover:bg-cyan-500/[0.03]", icon: "text-cyan-400", bg: "from-cyan-500/5 to-transparent" },
    FORGEMAGIE: { badge: "border-amber-500/40 bg-amber-500/10 text-amber-400", glow: "hover:border-amber-500/40", hover: "hover:bg-amber-500/[0.03]", icon: "text-amber-400", bg: "from-amber-500/5 to-transparent" },
    METIER: { badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", glow: "hover:border-emerald-500/40", hover: "hover:bg-emerald-500/[0.03]", icon: "text-emerald-400", bg: "from-emerald-500/5 to-transparent" },
    QUETE: { badge: "border-violet-500/40 bg-violet-500/10 text-violet-400", glow: "hover:border-violet-500/40", hover: "hover:bg-violet-500/[0.03]", icon: "text-violet-400", bg: "from-violet-500/5 to-transparent" },
    OCRE: { badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400", glow: "hover:border-yellow-500/40", hover: "hover:bg-yellow-500/[0.03]", icon: "text-yellow-400", bg: "from-yellow-500/5 to-transparent" },
    TUTORAT: { badge: "border-blue-500/40 bg-blue-500/10 text-blue-400", glow: "hover:border-blue-500/40", hover: "hover:bg-blue-500/[0.03]", icon: "text-blue-400", bg: "from-blue-500/5 to-transparent" },
    AUTRE: { badge: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400", glow: "hover:border-zinc-500/40", hover: "hover:bg-zinc-500/[0.03]", icon: "text-zinc-400", bg: "from-zinc-500/5 to-transparent" },
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
    isDiscordConfigured?: boolean;
}

export function ServiceCard({ listing, guildId, currentProfileId, isAdmin, isDiscordConfigured = false }: ServiceCardProps) {
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
        <div className={cn(
            "group relative flex flex-col rounded-3xl border transition-all duration-500 overflow-hidden",
            isPaused 
                ? "border-white/5 opacity-60 bg-zinc-950/20" 
                : "border-white/10 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/20 shadow-xl hover:shadow-2xl"
        )}>
            {/* Background Ambient Glow */}
            {!isPaused && (
                <div className={cn("absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 bg-gradient-to-br", col.bg)} />
            )}

            <div className="relative p-6 flex flex-col gap-5 h-full z-10">

            {/* ── Header : badge catégorie + pause badge ── */}
            <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className={cn(
                    "text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 border rounded-full shadow-sm transition-all",
                    col.badge
                )}>
                    {CATEGORY_EMOJIS[listing.category]} {CATEGORY_LABELS[listing.category]}
                </Badge>
                {isPaused && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                        PAUSE
                    </Badge>
                )}
            </div>

            {/* ── Donjon : image + nom (uniquement Passage Donjon) ── */}
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

            {/* Quête (uniquement Quête) */}
            {listing.category === "QUETE" && listing.questName && (
                <div className="flex items-center gap-2 text-sm text-violet-300 font-bold">
                    <span>📜</span><span>{listing.questName}</span>
                </div>
            )}

            {/* Breeder Profession Decorative Banner — races réellement sélectionnées (priceTiers) */}
            {listing.category === "METIER" && (listing.professions as string[] | null)?.includes("Éleveur") && (() => {
                const tiers = (listing.priceTiers as { label: string; price: string }[] | null) || [];
                const tierLabels = tiers.map(t => t.label.toLowerCase());
                const has = (k: string) => tierLabels.some(l => l.includes(k));
                const hasDragodinde = has("dragodinde");
                const hasMuldo = has("muldo");
                const hasVolkorne = has("volkorne");
                const hasEmeraude = has("émeraude") || has("emeraude");
                const races = [
                    { race: "Dragodinde", icon: "https://api.dofusdu.de/dofus3/v1/img/item/97016-64.png", active: hasDragodinde },
                    { race: "Muldo", icon: "https://api.dofusdu.de/dofus3/v1/img/item/97299-64.png", active: hasMuldo },
                    { race: "Volkorne", icon: "https://api.dofusdu.de/dofus3/v1/img/item/97261-64.png", active: hasVolkorne },
                ].filter(r => r.active);
                const label = races.length > 0
                    ? races.map(r => r.race).join(", ") + (hasEmeraude ? " (+ Émeraude)" : "")
                    : "Élevage de Montures";
                return (
                    <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-2xl">
                        {(races.length > 0 || hasEmeraude) ? (
                            <div className="flex -space-x-2 shrink-0">
                                {races.map(r => (
                                    <div key={r.race} className="relative h-9 w-9 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shadow-md">
                                        <Image src={r.icon} alt={r.race} fill className="object-contain p-1" />
                                    </div>
                                ))}
                                {hasEmeraude && (
                                    <div className="relative h-9 w-9 rounded-xl overflow-hidden bg-slate-900 border border-amber-500/30 shadow-md">
                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/23002-64.png" alt="Dofus Émeraude" fill className="object-contain p-1" />
                                    </div>
                                )}
                            </div>
                        ) : null}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest leading-none">Éleveur Certifié</p>
                            <p className="text-xs text-zinc-400 font-bold mt-1 truncate">{label}</p>
                        </div>
                    </div>
                );
            })()}

            {/* ── Titre ── */}
            <h3 className="text-xl font-black text-white leading-tight tracking-tight group-hover:text-cyan-400 transition-colors duration-300">{listing.title}</h3>

            {/* ── Description ── */}
            {listing.description && (
                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 italic opacity-80 group-hover:opacity-100 transition-opacity">
                    "{listing.description}"
                </p>
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

            {/* ── METIER Professions ── */}
            {listing.category === "METIER" && (listing.professions as string[] | null)?.length ? (
                <div className="flex flex-wrap gap-1.5">
                    {(listing.professions as string[]).map((prof) => {
                        const jobDef = getJob(prof);
                        return (
                            <span key={prof} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold">
                                {jobDef?.icon && (
                                    <div className="relative h-5 w-5 shrink-0">
                                        <Image src={jobDef.icon} alt={prof} fill className="object-contain" />
                                    </div>
                                )}
                                {prof}
                            </span>
                        );
                    })}
                </div>
            ) : null}

            {/* ── TUTORAT Classes ── */}
            {listing.category === "TUTORAT" && (listing.professions as string[] | null)?.length ? (
                <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-pink-500 flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" /> Classes proposées
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {(listing.professions as string[]).map((classId) => {
                            const cls = DOFUS_CLASSES.find(c => c.id === classId);
                            if (!cls) return null;
                            return (
                                <span
                                    key={classId}
                                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-300 font-bold"
                                >
                                    <div className="relative h-5 w-5 shrink-0">
                                        <Image src={cls.icon} alt={cls.name} fill className="object-contain" />
                                    </div>
                                    {cls.name}
                                </span>
                            );
                        })}
                    </div>
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
            {listing.category !== "OCRE" && listing.priceTiers && (listing.priceTiers as any[]).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2 shadow-inner">
                    {(listing.priceTiers as any[]).map((tier, i) => <PriceLine key={i} tier={tier} />)}
                </div>
            ) : listing.price && listing.category !== "OCRE" ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 shadow-inner">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <Image src="/assets/icons/kama.png" alt="kamas" width={20} height={20} className="object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-white text-lg leading-none">
                            {/^\d+$/.test(listing.price.replace(/\s/g, ""))
                                ? `${Number(listing.price.replace(/\s/g, "")).toLocaleString("fr-FR")}`
                                : listing.price}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">kamas total</span>
                    </div>
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
            <div className="flex items-center justify-between pt-5 border-t border-white/10 mt-auto">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-9 w-9 rounded-xl border border-white/10 shadow-lg">
                            <AvatarImage src={listing.profile.user?.image || undefined} />
                            <AvatarFallback className="text-xs bg-zinc-800 font-black text-zinc-400">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900 shadow-glow" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-white tracking-tight leading-none">{name}</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Vendeur certifié</span>
                    </div>
                </div>

                {isOwner ? (
                    <div className="flex items-center gap-2">
                        <ServiceEditDialog listing={listing} guildId={guildId} />
                        <Button size="icon" variant="ghost" onClick={handleToggle} disabled={loading} className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleDelete} disabled={loading} className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <ServiceContactDialog listing={listing} guildId={guildId} isDiscordConfigured={isDiscordConfigured} />
                        {isAdmin && (
                            <Button size="icon" variant="ghost" onClick={handleDelete} disabled={loading} className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}