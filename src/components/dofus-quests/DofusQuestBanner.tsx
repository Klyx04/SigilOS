"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Crown, Users, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClassIcon } from "@/components/shared/class-icon";
import { DofusClass } from "@/lib/songes/types";
import { getAlignment, getOrder, getAlignmentLevelSteps } from "@/lib/dofus-assets";
import AlignmentModal from "./AlignmentModal";
import { QuestFeedbackButton } from "./QuestFeedbackButton";
import { DofusPageOptions } from "./DofusPageOptions";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

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

/**
 * #148 — Bandeau façon Rush Sylvestre / Ganymède sur la page par-Dofus :
 * Personnage actif (mules) / Alignement (cliquable) / Metamob / Progression
 * + boutons Signaler · Options · Tutoriel.
 */
export function DofusQuestBanner({ guildId, dofusSlug, dofusColor, mainCharacter, mules, progress }: DofusQuestBannerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedCharacter = searchParams.get("character") || "PRINCIPAL";

    const [profile, setProfile] = useState<BannerProfile | null>(null);
    const [isAlignModalOpen, setIsAlignModalOpen] = useState(false);

    // Charge pseudo Metamob (getUserContext) + alignement (getMemberProfile).
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
                setProfile({
                    alignment: res.data.alignment ?? null,
                    alignmentOrder: res.data.alignmentOrder ?? null,
                    alignmentLevel: res.data.alignmentLevel ?? 0,
                    metamobPseudo: ctx.metamobPseudo ?? res.data.metamobPseudo ?? null,
                    altPseudos: (ctx.altPseudos || res.data.altPseudos || []) as BannerProfile["altPseudos"],
                });
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

    const alignMeta = useMemo(() => {
        const { alignment, alignmentOrder, alignmentLevel } = resolvedCharInfo;
        const alg = alignment && alignment !== "neutre" ? getAlignment(alignment) : null;
        const order = alg && alignmentOrder ? getOrder(alignment!, alignmentOrder) : null;
        const steps = order ? getAlignmentLevelSteps(order) : [];
        const step = steps.find((s) => s.level === alignmentLevel);
        return {
            icon: alg ? (order?.icon || alg.icon) : "/ordres/neutre.png",
            label: alg ? (order?.name || alg.name) : "Neutre",
            detail: step ? `${step.level} · ${step.title || `Niveau ${step.level}`}` : (alg ? `Niveau ${alignmentLevel || 0}` : "Non défini"),
            empty: !alg,
        };
    }, [resolvedCharInfo]);

    const handleSelect = (char: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (char === "PRINCIPAL") params.delete("character");
        else params.set("character", char);
        router.push(`${pathname}?${params.toString()}`);
    };

    const selectedCharClass = selectedCharacter === "PRINCIPAL"
        ? mainCharacter.classe
        : mules.find((m) => m.pseudo === selectedCharacter)?.classe;

    const currentLabel = selectedCharacter === "PRINCIPAL" ? mainCharacter.pseudo : selectedCharacter;

    return (
        <div className="rounded-2xl border border-border bg-background/40 p-4" style={{ borderColor: `${dofusColor}33`, background: `linear-gradient(135deg, ${dofusColor}12 0%, transparent 60%)` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Personnage actif */}
                <div className="rounded-xl bg-surface/40 border border-border p-3 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: `${dofusColor}15`, borderColor: `${dofusColor}30` }}>
                        {selectedCharClass ? (
                            <ClassIcon classId={selectedCharClass as DofusClass} size={22} />
                        ) : selectedCharacter === "PRINCIPAL" ? (
                            <Crown className="w-5 h-5 text-warning" />
                        ) : (
                            <Users className="w-5 h-5 text-info" />
                        )}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Personnage Actif</p>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" className="flex items-center gap-1.5 text-xs font-bold text-foreground truncate max-w-full hover:text-white transition-colors">
                                    <span className="truncate">{currentLabel}</span>
                                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-background/95 border-border text-foreground min-w-[200px] rounded-xl p-1.5 shadow-2xl z-[100]">
                                <DropdownMenuItem onClick={() => handleSelect("PRINCIPAL")} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter === "PRINCIPAL" ? "bg-surface text-success" : "hover:bg-surface"}`}>
                                    <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center border border-warning/20">
                                        {mainCharacter.classe ? <ClassIcon classId={mainCharacter.classe as DofusClass} size={16} /> : <Crown className="w-3.5 h-3.5 text-warning" />}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs font-bold">{mainCharacter.pseudo}</span>
                                        <span className="text-caption text-muted-foreground font-medium uppercase tracking-widest">{mainCharacter.classe || "Principal"}</span>
                                    </div>
                                </DropdownMenuItem>
                                {mules.length > 0 && <div className="h-px bg-surface my-1" />}
                                {mules.map((mule) => (
                                    <DropdownMenuItem key={mule.pseudo} onClick={() => handleSelect(mule.pseudo)} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter === mule.pseudo ? "bg-surface text-success" : "hover:bg-surface"}`}>
                                        <div className="w-7 h-7 rounded-lg bg-info/10 flex items-center justify-center border border-info/20">
                                            {mule.classe ? <ClassIcon classId={mule.classe as DofusClass} size={16} /> : <Users className="w-3.5 h-3.5 text-info" />}
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-bold">{mule.pseudo}</span>
                                            <span className="text-caption text-muted-foreground font-medium uppercase tracking-widest">Niv. {mule.level || 200} {mule.classe ? `• ${mule.classe}` : ""}</span>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {/* Alignement — cliquable : ouvre l'édition */}
                <button type="button" onClick={() => setIsAlignModalOpen(true)} title="Modifier mon alignement / ordre"
                    className="rounded-xl bg-surface/40 border border-border p-3 flex items-center gap-3 text-left hover:border-border-strong transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-black/40 border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={alignMeta.icon} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Alignement</p>
                        <p className="text-xs font-bold text-foreground truncate">{alignMeta.label}</p>
                        <p className="text-caption text-muted-foreground font-medium truncate">{alignMeta.detail}</p>
                    </div>
                </button>

                {/* Metamob */}
                <div className="rounded-xl bg-surface/40 border border-border p-3 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-black/40 border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/icons/ocre.png" alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Metamob</p>
                        {profile?.metamobPseudo ? (
                            <a href={`/dashboard/${guildId}/quetes-dofus/ocre`} className="flex items-center gap-1 text-xs font-bold text-amber-400/90 hover:text-amber-300 truncate">
                                <span className="truncate">{profile.metamobPseudo}</span>
                                <ExternalLink size={12} className="shrink-0" />
                            </a>
                        ) : (
                            <a href={`/dashboard/${guildId}/profile`} className="flex items-center gap-1 text-caption font-bold text-amber-400/80 hover:text-amber-300">
                                Lier Metamob
                                <ExternalLink size={11} className="shrink-0" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Progression */}
                <div className="rounded-xl bg-surface/40 border border-border p-3 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: `${dofusColor}15`, borderColor: `${dofusColor}30` }}>
                        <Sparkles className="w-5 h-5" style={{ color: dofusColor }} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Progression</p>
                        <p className="text-xs font-bold text-foreground">{progress.percent}% <span className="text-muted-foreground font-mono text-caption">({progress.completedQuests}/{progress.totalQuests})</span></p>
                        <div className="h-1.5 w-full rounded-full bg-elevated overflow-hidden mt-1">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%`, background: dofusColor }} />
                        </div>
                    </div>
                </div>
            </div>
            {/* Actions : Signaler · Options · Tutoriel */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/60">
                <QuestFeedbackButton guildId={guildId} sourcePage={`dofus:${dofusSlug}`} targetSlug={dofusSlug}
                    className="px-2.5 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 text-caption font-black uppercase tracking-widest" />
                <ModuleTourReplayButton phase="quetesDofus" />
                <div className="ml-auto"><DofusPageOptions guildId={guildId} dofusSlug={dofusSlug} baseColor={dofusColor} /></div>
            </div>

            <AlignmentModal
                open={isAlignModalOpen}
                onOpenChange={setIsAlignModalOpen}
                guildId={guildId}
                mulePseudo={selectedCharacter !== "PRINCIPAL" ? selectedCharacter : null}
                alignment={resolvedCharInfo.alignment}
                alignmentOrder={resolvedCharInfo.alignmentOrder}
                alignmentLevel={resolvedCharInfo.alignmentLevel}
            />
        </div>
    );
}
