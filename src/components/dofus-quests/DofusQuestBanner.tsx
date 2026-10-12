"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Crown, Users, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getClass, getAlignment, ORDERS, getAlignmentLevelSteps } from "@/lib/dofus-assets";
import AlignmentModal from "./AlignmentModal";
import OcreProgressModal, { type OcreMonsterLite } from "./OcreProgressModal";
import { QuestFeedbackButton } from "./QuestFeedbackButton";
import { DofusPageOptions } from "./DofusPageOptions";


// #148 — Styles du guide (Rush Sylvestre / Ganymède) : bandeau à l'identique.
import "@/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/guide-styles.css";

interface DofusQuestBannerProps {
    guildId: string;
    dofusSlug: string;
    dofusColor: string;
    mainCharacter: { pseudo: string; classe?: string | null };
    mules: { pseudo: string; classe?: string | null; level?: number | null }[];
    progress: { completedQuests: number; totalQuests: number; percent: number };
}

type BannerProfile = {
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number;
    metamobPseudo?: string | null;
    altPseudos?: BannerAltPseudo[];
};

type BannerAltPseudo = { pseudo: string; alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };

/** Dropdown personnage — même rendu que GuideCharDropdown du guide Ganymède. */
function CharDropdown({ selectedCharacter, mainPseudo, mainClass, mules }: {
    selectedCharacter: string;
    mainPseudo: string;
    mainClass?: string | null;
    mules?: { pseudo: string; classe?: string | null; level?: number | null }[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const handleSelect = (char: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (char === "PRINCIPAL") params.delete("character");
        else params.set("character", char);
        router.push(pathname + "?" + params.toString());
    };

    const currentLabel = selectedCharacter === "PRINCIPAL" ? mainPseudo : selectedCharacter;
    const selClass = selectedCharacter === "PRINCIPAL" ? mainClass : (mules || []).find((m) => m.pseudo === selectedCharacter)?.classe || null;
    const selIcon = selClass
        ? (() => { const d = getClass(selClass); return d ? <img src={d.icon} alt={d.name} className="w-4 h-4 object-contain" /> : null; })()
        : selectedCharacter === "PRINCIPAL" ? <Crown className="w-3.5 h-3.5 text-amber-500" /> : <Users className="w-3.5 h-3.5 text-blue-400" />;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" role="combobox" aria-expanded={false} className="gch-trigger flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate min-w-0">{selIcon}<span className="truncate">{currentLabel}</span></span>
                    <ChevronDown className="w-3 h-3 opacity-30 shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="gch-content">
                <DropdownMenuItem onClick={() => handleSelect("PRINCIPAL")} className={"gch-opt" + (selectedCharacter === "PRINCIPAL" ? " current" : "")}>
                    <div className="gch-opt-icon principal">{mainClass ? (() => { const d = getClass(mainClass); return d ? <img src={d.icon} alt="" className="w-4 h-4 object-contain" /> : null; })() : <Crown className="w-3 h-3 text-amber-500" />}</div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">{mainPseudo}</span>
                        <span className="text-caption text-zinc-500 font-medium uppercase tracking-widest">{mainClass || "Principal"}</span>
                    </div>
                </DropdownMenuItem>
                {(mules || []).length > 0 && <div className="h-px bg-white/5 my-1" />}
                {(mules || []).map((mule) => (
                    <DropdownMenuItem key={mule.pseudo} onClick={() => handleSelect(mule.pseudo)} className={"gch-opt" + (selectedCharacter === mule.pseudo ? " current" : "")}>
                        <div className="gch-opt-icon mule">{mule.classe ? (() => { const d = getClass(mule.classe); return d ? <img src={d.icon} alt="" className="w-4 h-4 object-contain" /> : null; })() : <Users className="w-3 h-3 text-blue-400" />}</div>
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-bold">{mule.pseudo}</span>
                            <span className="text-caption text-zinc-500 font-medium uppercase tracking-widest">Niv. {mule.level || 200} {mule.classe ? "• " + mule.classe : ""}</span>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ── Composant principal ──────────────────────────────────────────────────────
export function DofusQuestBanner({ guildId, dofusSlug, dofusColor, mainCharacter, mules, progress }: DofusQuestBannerProps) {
    const searchParams = useSearchParams();
    const selectedCharacter = searchParams.get("character") || "PRINCIPAL";

    const [profile, setProfile] = useState<BannerProfile | null>(null);
    const [isAlignModalOpen, setIsAlignModalOpen] = useState(false);
    const [isOcreModalOpen, setIsOcreModalOpen] = useState(false);
    const [ocreStats, setOcreStats] = useState<{ bosses?: { gathered?: number; total?: number }; archis?: { gathered?: number; total?: number } } | null>(null);
    const [ocreMonsters, setOcreMonsters] = useState<OcreMonsterLite[]>([]);

    // Charge pseudo Metamob (getUserContext) + alignement (getMemberProfile) + stats Ocre.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { getUserContext } = await import("@/server/actions/user-actions");
                const ctx = await getUserContext(guildId);
                if (cancelled || !ctx?.profileId) return;
                const { getMemberProfile } = await import("@/server/actions/profile-actions");
                const res = await getMemberProfile(guildId, ctx.profileId);
                if (cancelled || !res.success || !res.data) return;
                const metamobPseudo = ctx.metamobPseudo ?? res.data.metamobPseudo ?? null;
                setProfile({
                    alignment: res.data.alignment ?? null,
                    alignmentOrder: res.data.alignmentOrder ?? null,
                    alignmentLevel: res.data.alignmentLevel ?? 0,
                    metamobPseudo,
                    altPseudos: (ctx.altPseudos || res.data.altPseudos || []) as BannerProfile["altPseudos"],
                });
                if (metamobPseudo) {
                    const { getMyOcreProgress } = await import("@/server/actions/ocre-actions");
                    const ocreRes = await getMyOcreProgress(guildId);
                    if (!cancelled && ocreRes.success && ocreRes.data?.stats) {
                        setOcreStats({
                            bosses: ocreRes.data.stats.bosses,
                            archis: ocreRes.data.stats.archis,
                        });
                        if (Array.isArray(ocreRes.data.monsters)) {
                            setOcreMonsters(ocreRes.data.monsters as unknown as OcreMonsterLite[]);
                        }
                    }
                }
            } catch {
                // non bloquant
            }
        })();
        return () => { cancelled = true; };
    }, [guildId]);

    // Alignement / ordre / tranche du personnage RÉSOLU (mule sélectionnée OU perso principal).
    const resolvedCharInfo = useMemo(() => {
        const mule = profile?.altPseudos?.find((m: BannerAltPseudo) => m.pseudo === selectedCharacter);
        return {
            alignment: selectedCharacter !== "PRINCIPAL" ? (mule?.alignment ?? null) : (profile?.alignment ?? null),
            alignmentOrder: selectedCharacter !== "PRINCIPAL" ? (mule?.alignmentOrder ?? null) : (profile?.alignmentOrder ?? null),
            alignmentLevel: selectedCharacter !== "PRINCIPAL" ? (mule?.alignmentLevel ?? 0) : (profile?.alignmentLevel ?? 0),
        };
    }, [profile, selectedCharacter]);

    const alignInfo = useMemo(() => {
        const { alignment, alignmentOrder, alignmentLevel } = resolvedCharInfo;
        if (!alignment || alignment === "neutre") {
            return { kind: "none" as const, icon: "/ordres/neutre.png", label: !alignment ? "Non défini" : "Neutre", tranche: 0, trancheTitle: "" };
        }
        const ad = getAlignment(alignment);
        const ords = (ORDERS as unknown as Record<string, any[]>)[alignment.toLowerCase()] || [];
        const od = alignmentOrder ? ords.find((o: any) => o.id === alignmentOrder) : null;
        const isBonta = alignment.toLowerCase().startsWith("bonta");
        const steps = od ? getAlignmentLevelSteps(od) : [];
        const step = steps.find((s) => s.level === alignmentLevel);
        if (od) {
            return {
                kind: "order" as const,
                icon: od.icon,
                label: od.name,
                valueClass: isBonta ? "bonta" : "brak",
                tranche: alignmentLevel ?? 0,
                trancheTitle: step?.title || "",
            };
        }
        return {
            kind: "align" as const,
            icon: ad?.icon || "/ordres/neutre.png",
            label: ad?.name || alignment,
            valueClass: isBonta ? "bonta" : "brak",
            tranche: 0,
            trancheTitle: "",
        };
    }, [resolvedCharInfo]);

    return (
        <div className="space-y-3">
            <div className="guide-hero-grid">
                {/* Personnage actif */}
                <div className="guide-hero-card">
                    <div className="guide-hero-card-icon class">
                        {(() => { const d = mainCharacter?.classe ? getClass(mainCharacter.classe) : null; return d ? <img src={d.icon} alt={d.name} className="w-full h-full object-contain p-0.5" /> : <Crown className="w-5 h-5 text-amber-500" />; })()}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="guide-hero-card-label">Personnage Actif</p>
                        {mainCharacter?.pseudo ? (
                            <CharDropdown selectedCharacter={selectedCharacter} mainPseudo={mainCharacter.pseudo} mainClass={mainCharacter.classe} mules={mules} />
                        ) : (
                            <Link href={`/dashboard/${guildId}/profile`} className="guide-hero-link-btn">
                                <ExternalLink size={12} /> Lier mon pseudo
                            </Link>
                        )}
                    </div>
                </div>

                {/* Alignement / Ordre — cliquable : ouvre l'édition */}
                <div
                    className="guide-hero-card guide-hero-card-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsAlignModalOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsAlignModalOpen(true); } }}
                    title="Modifier mon alignement / ordre"
                >
                    <div className={`guide-hero-card-icon align ${alignInfo.kind === "order" ? (alignInfo.valueClass === "bonta" ? "bonta" : "brak") : "neutral"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={alignInfo.icon} alt="" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="guide-hero-card-label">{alignInfo.kind === "order" ? "Ordre" : "Alignement"}</p>
                        <p className={`guide-hero-card-value ${alignInfo.kind === "order" ? alignInfo.valueClass : "dim"}`}>{alignInfo.label}</p>
                        {alignInfo.kind === "order" && alignInfo.tranche > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="guide-hero-tranche">Tranche {alignInfo.tranche}</span>
                                {alignInfo.trancheTitle && <span className="guide-hero-tranche-title">{alignInfo.trancheTitle}</span>}
                            </div>
                        )}
                    </div>
                </div>
                {/* Métamob / Ocre — cliquable : ouvre la modale archis & boss */}
                <div className="guide-hero-card">
                    <div className="guide-hero-card-icon ocre"><img src="/assets/icons/ocre.png" alt="Ocre" className="w-6 h-6 object-contain" /></div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="guide-hero-card-label">Metamob</p>
                        {profile?.metamobPseudo ? (
                            <button type="button" className="guide-hero-metamob-link" onClick={() => setIsOcreModalOpen(true)}>
                                {ocreStats ? (
                                    <>
                                        <span>Gardiens <span className="font-mono text-white">{ocreStats.bosses?.gathered ?? 0}<span className="text-zinc-500">/{ocreStats.bosses?.total ?? 51}</span></span></span>
                                        <span className="text-zinc-600">·</span>
                                        <span>Archis <span className="font-mono text-white">{ocreStats.archis?.gathered ?? 0}<span className="text-zinc-500">/{ocreStats.archis?.total ?? 286}</span></span></span>
                                    </>
                                ) : (
                                    <span className="text-caption font-bold text-amber-400/80">Voir ma progression →</span>
                                )}
                                <ExternalLink size={12} className="text-amber-400/60 shrink-0" />
                            </button>
                        ) : (
                            <Link href={`/dashboard/${guildId}/profile`} className="guide-hero-link-btn amber">
                                <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain" />
                                Lier Metamob
                            </Link>
                        )}
                    </div>
                </div>

                {/* Ma progression */}
                <div className="guide-hero-card">
                    <div className="guide-hero-card-icon progress"><Sparkles className="w-5 h-5" style={{ color: dofusColor }} /></div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="guide-hero-card-label">Progression</p>
                        <p className="guide-hero-card-value">{progress.percent}% <span className="text-zinc-500 font-mono text-caption">({progress.completedQuests}/{progress.totalQuests})</span></p>
                        <div className="guide-hero-bar"><div style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }} /></div>
                    </div>
                </div>
            </div>
            {/* Actions : Signaler · Options */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
                <QuestFeedbackButton guildId={guildId} sourcePage={`dofus:${dofusSlug}`} targetSlug={dofusSlug}
                    className="px-2.5 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 text-caption font-black uppercase tracking-widest" />
                <div className="ml-auto"><DofusPageOptions guildId={guildId} dofusSlug={dofusSlug} baseColor={dofusColor} /></div>
            </div>

            {/* Modale Alignement / Ordre / Tranche */}
            <AlignmentModal
                open={isAlignModalOpen}
                onOpenChange={setIsAlignModalOpen}
                guildId={guildId}
                mulePseudo={selectedCharacter !== "PRINCIPAL" ? selectedCharacter : null}
                alignment={resolvedCharInfo.alignment}
                alignmentOrder={resolvedCharInfo.alignmentOrder}
                alignmentLevel={resolvedCharInfo.alignmentLevel}
            />

            {/* Modale Archis & Boss (metamob) — comme sur le guide */}
            <OcreProgressModal
                open={isOcreModalOpen}
                onOpenChange={setIsOcreModalOpen}
                monsters={ocreMonsters}
                bossCount={ocreStats?.bosses}
                archiCount={ocreStats?.archis}
                metamobPseudo={profile?.metamobPseudo}
                guildId={guildId}
            />
        </div>
    );
}
