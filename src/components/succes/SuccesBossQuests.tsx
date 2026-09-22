"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, ExternalLink, Flame, MapPin, Swords, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestMember {
    profileId: string;
    pseudo: string;
    avatarUrl?: string | null;
    dofusClass?: string | null;
    status: "COMPLETED" | "IN_PROGRESS";
}

export interface BossLinkedQuest {
    id: string;
    name: string;
    isDungeon: boolean;
    stepOrder: number;
    zone: string | null;
    chainName: string | null;
    dofusName: string | null;
    dofusSlug?: string | null;
    dofusImageUrl: string | null;
    dofusSuccessName?: string | null;
    level?: number | null;
    npcName?: string | null;
    objectives?: string[];
    isRush: boolean;
    myStatus: string;
    guildCompleted: number;
    guildInProgress: number;
    memberCount: number;
    members?: QuestMember[];
}

export interface BossLinkedQuestsData {
    quests: BossLinkedQuest[];
    rushActive: { pseudoDofus: string; dofusClass: string | null; milestoneId: string | null }[];
}

/**
 * Source unique d'affichage des quêtes liées à un boss / titan.
 * Consomme les données déjà chargées par la fiche (`getLinkedQuests`) :
 * aucun fetch ici, aucune duplication du bloc « Succès du donjon »
 * (déjà couvert par « Mes Succès »).
 */
export function SuccesBossQuests({ guildId, data, bossName }: { guildId: string; data: BossLinkedQuestsData; bossName: string }) {
    const [openMembersId, setOpenMembersId] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map = new Map<string, { chainName: string; dofusName: string | null; dofusSlug: string | null; dofusImageUrl: string | null; dofusSuccessName: string | null; quests: BossLinkedQuest[] }>();
        for (const q of data.quests) {
            const key = q.chainName || "Quêtes liées";
            if (!map.has(key)) {
                map.set(key, { chainName: key, dofusName: q.dofusName || null, dofusSlug: q.dofusSlug || null, dofusImageUrl: q.dofusImageUrl || null, dofusSuccessName: q.dofusSuccessName || null, quests: [] });
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
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl bg-background/40">
                Aucune quête de Dofus liée à {bossName} pour le moment.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {data.rushActive.length > 0 && (
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-warning" /> En rush Sylvestre ({data.rushActive.length})
                        </p>
                        <Link href={`/dashboard/${guildId}/quetes-dofus?guide=rush-sylvestre`} className="text-[11px] font-bold text-warning hover:underline">
                            Ouvrir le Rush Sylvestre →
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {data.rushActive.map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-xs font-bold text-foreground">
                                <User className="w-3 h-3 text-muted-foreground" />
                                {m.pseudoDofus}
                                {m.dofusClass && <span className="text-[10px] text-muted-foreground font-normal">({m.dofusClass})</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {groups.map((group) => (
                <div key={group.chainName} className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
                    <div className="p-3.5 border-b border-border/70 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0">
                                <img src="/assets/dofus/icons/success.png" alt="" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-bold text-foreground truncate">{group.chainName}</h4>
                                <p className="text-[11px] text-muted-foreground">
                                    {group.quests.length} quête{group.quests.length > 1 ? "s" : ""} liée{group.quests.length > 1 ? "s" : ""}
                                    {group.dofusSuccessName ? ` · Série : ${group.dofusSuccessName}` : ""}
                                </p>
                            </div>
                        </div>
                        {group.dofusName && (
                            <Link
                                href={`/dashboard/${guildId}/quetes-dofus${group.dofusSlug ? `/guide/${group.dofusSlug}` : ""}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background hover:bg-elevated border border-border text-xs font-bold transition-colors shrink-0"
                                title={`Consulter le guide ${group.dofusName}`}
                            >
                                {group.dofusImageUrl ? (
                                    <img src={group.dofusImageUrl} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="text-muted-foreground">Guide :</span>
                                <span className="text-foreground">{group.dofusName}</span>
                                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Link>
                        )}
                    </div>

                    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.quests.map((q) => {
                            const done = q.myStatus === "COMPLETED";
                            const progress = q.myStatus === "IN_PROGRESS";
                            const dot = done ? "bg-success" : progress ? "bg-warning" : "bg-muted-foreground/40";
                            const label = done ? "Validée" : progress ? "En cours" : "À faire";
                            const showing = openMembersId === q.id;
                            return (
                                <div key={q.id} className="p-4 rounded-xl bg-background/70 border border-border/80 flex flex-col justify-between gap-3">
                                    <div className="space-y-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center p-1.5 shrink-0">
                                                    <img src="/assets/dofus/icons/btnIcon_quest.png" alt="" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = "/assets/dofus/icons/quests.png"; }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-sm font-bold text-foreground leading-snug">{q.name}</h5>
                                                    {q.level ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground">Niv. {q.level}</span> : null}
                                                    {q.isRush && (
                                                        <Link href={`/dashboard/${guildId}/quetes-dofus?guide=rush-sylvestre`} className="text-[10px] font-bold inline-flex items-center gap-1 mt-0.5 text-warning">
                                                            <Flame className="w-2.5 h-2.5" /> Rush Sylvestre
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 text-[11px] font-bold text-muted-foreground shrink-0 inline-flex items-center gap-1.5">
                                                <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                                                {done ? <CheckCircle2 className="w-3 h-3" /> : progress ? <Clock className="w-3 h-3" /> : null}
                                                <span>{label}</span>
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {q.isDungeon && (
                                                <span className="px-2 py-0.5 rounded border border-border text-[11px] font-bold inline-flex items-center gap-1">
                                                    <Swords className="w-3 h-3" /> Étape Donjon
                                                </span>
                                            )}
                                            {q.zone && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> <span>{q.zone}</span>
                                                </span>
                                            )}
                                            {q.npcName && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" /> <span>PNJ : <strong className="text-foreground/90">{q.npcName}</strong></span>
                                                </span>
                                            )}
                                        </div>

                                        {q.objectives && q.objectives.length > 0 && (
                                            <div className="bg-surface/60 border border-border/50 rounded-lg p-2 text-xs text-muted-foreground">
                                                <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5">Objectif clé :</span>
                                                <p className="text-foreground/90 font-medium leading-relaxed">{q.objectives[0].replace(/\{monster,\d+\}/g, bossName)}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-border/60 space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <button type="button" onClick={() => setOpenMembersId(showing ? null : q.id)} className="text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 transition-colors">
                                                <Users className="w-3 h-3" />
                                                <span>Progression guilde :</span>
                                                <span className="text-[10px] underline ml-1">{showing ? "Masquer membres" : "Voir qui l'a"}</span>
                                            </button>
                                            <span className="font-bold text-foreground tabular-nums">
                                                {q.guildCompleted} / {q.memberCount} ({Math.round((q.guildCompleted / Math.max(1, q.memberCount)) * 100)}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-1 bg-surface rounded-full overflow-hidden border border-border/40">
                                            <div className="h-full bg-success rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.round((q.guildCompleted / Math.max(1, q.memberCount)) * 100))}%` }} />
                                        </div>
                                        {showing && (
                                            <div className="p-2.5 rounded-lg bg-surface border border-border text-xs">
                                                {q.members && q.members.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {q.members.map((m) => (
                                                            <span key={m.profileId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-surface text-[11px] font-bold text-foreground">
                                                                <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", m.status === "COMPLETED" ? "bg-success" : "bg-warning")} />
                                                                <span>{m.pseudo}</span>
                                                                {m.dofusClass && <span className="text-[9px] opacity-70 font-normal">({m.dofusClass})</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-muted-foreground italic">Aucun membre n'a encore validé ou débuté cette quête.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
