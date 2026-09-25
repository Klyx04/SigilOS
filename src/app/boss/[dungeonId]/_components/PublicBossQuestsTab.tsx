"use client";

import { useMemo } from "react";
import { MapPin, Swords, User, Flame } from "lucide-react";
import type { PublicLinkedQuestsData, PublicLinkedQuest } from "@/server/actions/public-boss-tabs-actions";

interface PublicBossQuestsTabProps {
    data: PublicLinkedQuestsData;
    bossName: string;
}

function QuestGroup({
    chainName,
    dofusImageUrl,
    dofusSuccessName,
    quests,
    bossName,
}: {
    chainName: string;
    dofusImageUrl: string | null;
    dofusSuccessName: string | null;
    quests: PublicLinkedQuest[];
    bossName: string;
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
            {/* En-tête du groupe */}
            <div className="p-3.5 border-b border-border/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0">
                        {dofusImageUrl ? (
                            <img
                                src={dofusImageUrl}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                        ) : (
                            <img
                                src="/assets/dofus/icons/success.png"
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">{chainName}</h4>
                        <p className="text-[11px] text-muted-foreground">
                            {quests.length} quête{quests.length > 1 ? "s" : ""} liée{quests.length > 1 ? "s" : ""}
                            {dofusSuccessName ? ` · Série : ${dofusSuccessName}` : ""}
                        </p>
                    </div>
                </div>

            </div>

            {/* Cartes quêtes */}
            <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {quests.map((q) => (
                    <div
                        key={q.id}
                        className="p-4 rounded-xl bg-background/70 border border-border/80 flex flex-col gap-3"
                    >
                        <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center p-1.5 shrink-0">
                                <img
                                    src="/assets/dofus/icons/btnIcon_quest.png"
                                    alt=""
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        e.currentTarget.src = "/assets/dofus/icons/quests.png";
                                    }}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-bold text-foreground leading-snug">{q.name}</h5>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {q.level != null && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground">
                                            Niv. {q.level}
                                        </span>
                                    )}
                                    {q.isRush && (
                                        <span className="text-[10px] font-bold inline-flex items-center gap-1 text-warning">
                                            <Flame className="w-2.5 h-2.5" /> Rush Sylvestre
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Métadonnées */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {q.isDungeon && (
                                <span className="px-2 py-0.5 rounded border border-border text-[11px] font-bold inline-flex items-center gap-1">
                                    <Swords className="w-3 h-3" /> Étape Donjon
                                </span>
                            )}
                            {q.zone && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{q.zone}</span>
                                </span>
                            )}
                            {q.npcName && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>PNJ : <strong className="text-foreground/90">{q.npcName}</strong></span>
                                </span>
                            )}
                        </div>

                        {/* Objectif principal */}
                        {q.objectives && q.objectives.length > 0 && (
                            <div className="bg-surface/60 border border-border/50 rounded-lg p-2 text-xs text-muted-foreground">
                                <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                    Objectif clé :
                                </span>
                                <p className="text-foreground/90 font-medium leading-relaxed">
                                    {q.objectives[0].replace(/\{monster,\d+\}/g, bossName)}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Onglet Quêtes de la fiche boss publique.
 * Affiche uniquement les données publiques — pas de progression guilde, pas de liens internes.
 */
export function PublicBossQuestsTab({ data, bossName }: PublicBossQuestsTabProps) {
    const groups = useMemo(() => {
        const map = new Map<
            string,
            {
                chainName: string;
                dofusName: string | null;
                dofusSlug: string | null;
                dofusImageUrl: string | null;
                dofusSuccessName: string | null;
                quests: PublicLinkedQuest[];
            }
        >();
        for (const q of data.quests) {
            const key = q.chainName || "Quêtes liées";
            if (!map.has(key)) {
                map.set(key, {
                    chainName: key,
                    dofusName: q.dofusName ?? null,
                    dofusSlug: q.dofusSlug ?? null,
                    dofusImageUrl: q.dofusImageUrl ?? null,
                    dofusSuccessName: q.dofusSuccessName ?? null,
                    quests: [],
                });
            }
            const g = map.get(key)!;
            g.quests.push(q);
            if (!g.dofusName && q.dofusName) g.dofusName = q.dofusName;
            if (!g.dofusSlug && q.dofusSlug) g.dofusSlug = q.dofusSlug;
            if (!g.dofusImageUrl && q.dofusImageUrl) g.dofusImageUrl = q.dofusImageUrl;
            if (!g.dofusSuccessName && q.dofusSuccessName) g.dofusSuccessName = q.dofusSuccessName;
        }
        return Array.from(map.values());
    }, [data.quests]);

    if (data.quests.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl bg-background/40">
                Aucune quête Dofus connue liée à {bossName}.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <img
                    src="/assets/dofus/icons/btnIcon_quest.png"
                    alt=""
                    className="w-4 h-4 object-contain opacity-80"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <h4 className="text-sm font-bold text-foreground">
                    Quêtes liées au donjon
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    {data.quests.length} quête{data.quests.length > 1 ? "s" : ""}
                </span>
            </div>

            {groups.map((group) => (
                <QuestGroup key={group.chainName} bossName={bossName} {...group} />
            ))}
        </div>
    );
}
