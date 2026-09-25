import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { ArrowLeft, Trophy, TreePine, Sparkles } from "lucide-react";
import Link from "next/link";
import {
    getDofusDetailWithChains,
    getGuildHeatmapForDofus,
    updateDolmanaxProgress,
    updateDokilleProgress,
    getUserCompletedQuestIds,
} from "@/server/actions/dofus-quest-actions";
import { DofusQuestManagerV3 } from "@/components/dofus-quests/DofusQuestManagerV3";
import { DofusProgressRing } from "@/components/dofus-quests/DofusProgressRing";
import { DofusIcon } from "@/components/dofus-quests/DofusIcon";
import { getDofusColor } from "@/components/dofus-quests/dofus-colors";
import { DofusOcreMetamob } from "@/components/dofus-quests/DofusOcreMetamob";
import { DofusDolmanaxTracker } from "@/components/dofus-quests/DofusDolmanaxTracker";
import { DofusDokilleTracker, ALL_KROKILLE_MONSTERS } from "@/components/dofus-quests/DofusDokilleTracker";
import { notFound } from "next/navigation";
import { linkOcreAccount } from "@/server/actions/ocre-actions";
import { DofusQuestBanner } from "@/components/dofus-quests/DofusQuestBanner";

type Props = {
    params: Promise<{ guildId: string; dofusSlug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DofusDetailPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId, dofusSlug } = await params;
    const character = (await searchParams)?.character as string || "PRINCIPAL";

    // #165 — Le Dofus Ocre est géré par le module dédié /quete-ocre
    // La page /quetes-dofus/ocre est un doublon avec des images dofusdb cassées
    if (dofusSlug === "ocre") {
        redirect(`/dashboard/${guildId}/quete-ocre`);
    }

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled && !user.isSuperAdmin) return <AccessDenied />;

    const isDolmanax = dofusSlug === "dolmanax";
    const [result, heatmapResult, globalCompletedResult, almanaxList] = await Promise.all([
        getDofusDetailWithChains(guildId, dofusSlug, character),
        getGuildHeatmapForDofus(guildId, dofusSlug),
        getUserCompletedQuestIds(guildId, character),
        isDolmanax ? (await import("@/server/actions/resources-actions")).getUpcomingAlmanax() : Promise.resolve([]),
    ]);

    if (!result.success || !result.data) return notFound();

    const { dofus, chains, prereqsByQuestId = {} } = result.data;
    const color = getDofusColor(dofus.slug, dofus.color || "#6366f1");
    const heatmapData = heatmapResult.success ? heatmapResult.data ?? null : null;


    // Extract pages from notes if available (Format: "PAGES:X")
    let initialPages = 0;
    if (dofus.notes && dofus.notes.startsWith("PAGES:")) {
        initialPages = parseInt(dofus.notes.split(":")[1], 10) || 0;
    } else if (dofusSlug === "dolmanax") {
        initialPages = Math.round((dofus.progressPercent * 365) / 100);
    }

    // Extract captured Krokilles from notes if available (Format: "KROKILLES:[...]")
    let initialCapturedKrokilles: string[] = [];
    if (dofus.notes && dofus.notes.startsWith("KROKILLES:")) {
        try {
            initialCapturedKrokilles = JSON.parse(dofus.notes.slice("KROKILLES:".length));
        } catch {
            initialCapturedKrokilles = [];
        }
    } else if (dofusSlug === "dokille" && dofus.isObtained) {
        initialCapturedKrokilles = [...ALL_KROKILLE_MONSTERS];
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <Link
                    href={`/dashboard/${guildId}/quetes-dofus?tab=dofus${character !== "PRINCIPAL" ? `&character=${character}` : ""}`}
                    className="inline-flex items-center gap-2 text-base font-bold text-muted-foreground hover:text-foreground transition-all group/back"
                >
                    <ArrowLeft className="w-5 h-5 transition-transform group-hover/back:-translate-x-1" />
                    Retour à la liste des Dofus
                </Link>
            </div>

            {/* #148 — Bandeau mule/alignement/metamob façon Rush Sylvestre / Ganymède */}
            <DofusQuestBanner
                guildId={guildId}
                dofusSlug={dofusSlug}
                dofusColor={color}
                mainCharacter={{ pseudo: user.pseudoDofus || user.name || "Principal", classe: user.classe }}
                mules={(user.altPseudos as any) || []}
                progress={{
                    completedQuests: dofus.completedQuests ?? 0,
                    totalQuests: dofus.totalQuests ?? 0,
                    percent: dofus.progressPercent ?? 0,
                }}
            />

            {/* Dofus hero header */}
            <div
                className="relative overflow-hidden rounded-2xl px-6 py-8 flex flex-col sm:flex-row items-center gap-6"
                style={{
                    background: `linear-gradient(135deg, ${color}18 0%, var(--foreground)/[0.02] 60%, ${color}08 100%)`,
                    border: `1px solid ${color}33`,
                    boxShadow: `0 8px 32px ${color}18`,
                }}
            >
                {/* Top accent line */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
                />
                {/* Ambient glow */}
                <div
                    className="absolute -top-12 -left-12 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${color}20 0%, transparent 70%)` }}
                />

                {/* Dofus image + ring */}
                <div className="relative flex-shrink-0">
                    <DofusProgressRing
                        percent={dofus.progressPercent}
                        size={120}
                        strokeWidth={6}
                        color={color}
                        isObtained={dofus.isObtained}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        {/* Icône réelle du Dofus (public/module-dofus/Dofus_*.png) */}
                        <DofusIcon
                            name={dofus.name}
                            size={64}
                            color={color}
                            isObtained={dofus.isObtained}
                            className="drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1 flex-wrap">
                        <span
                            className="text-caption font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: `${color}20`, color, border: `1px solid ${color}44` }}
                        >
                            {dofus.isPrimordial ? "Primordial" : dofus.rarity}
                        </span>
                        {(dofus as any).isMeta && (
                            <span
                                className="flex items-center gap-1 text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-success"
                                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
                            >
                                <TreePine className="w-2.5 h-2.5" /> Méta-Dofus
                            </span>
                        )}
                        {(dofus as any).isSylvestreReq && !(dofus as any).isMeta && (
                            <span
                                className="flex items-center gap-1 text-caption font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-success/70"
                                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
                            >
                                <Sparkles className="w-2.5 h-2.5" /> Requis Sylvestre
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground/50">Niveau {dofus.levelRecommended}+</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-1 uppercase tracking-tight">{dofus.name}</h1>
                    {dofus.successName && (
                        <p className="text-sm text-muted-foreground">
                            Succès : <span style={{ color }} className="font-bold">{dofus.successName}</span>
                        </p>
                    )}
                    {(dofus as any).bonusSummary && (
                        <p className="text-xs text-muted-foreground/60 mt-1 font-medium">
                            ✦ {(dofus as any).bonusSummary}
                        </p>
                    )}
                    {dofus.description && (
                        <p className="text-sm text-muted-foreground/80 mt-2 max-w-4xl font-medium leading-relaxed">{dofus.description}</p>
                    )}

                    {/* Progress bar + stats */}
                    <div className="mt-4 flex flex-col gap-2 max-w-xl mx-auto sm:mx-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-black uppercase tracking-widest text-caption">Progression</span>
                            <span className="tabular-nums font-bold">{dofus.completedQuests}/{dofus.totalQuests} étapes</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-foreground/[0.08]">
                            <div
                                className="h-full rounded-full transition-all duration-300 "
                                style={{
                                    width: `${dofus.progressPercent}%`,
                                    background: dofus.isObtained
                                        ? `linear-gradient(90deg, ${color}, #fbbf24)`
                                        : `linear-gradient(90deg, ${color}cc, ${color})`,
                                    boxShadow: `0 0 12px ${color}66`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Obtained badge */}
                    {dofus.isObtained && (
                        <div
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                        >
                            <Trophy className="w-4 h-4" />
                            Dofus obtenu !
                            {dofus.obtainedAt && (
                                <span className="text-xs opacity-60 ml-1">
                                    le {new Date(dofus.obtainedAt).toLocaleDateString("fr-FR")}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>


            {/* ── Special slug renderers ── */}
            {dofusSlug === "ocre" && (
                <div
                    className="rounded-3xl p-6 border transition-all duration-300"
                    style={{
                        background: `linear-gradient(135deg, ${color}10 0%, var(--foreground)/[0.05] 100%)`,
                        border: `1px solid ${color}25`,
                    }}
                >
                    <div className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span style={{ color }}>⬡</span> Progression Metamob
                    </div>
                    <DofusOcreMetamob
                        guildId={guildId}
                        metamobUsername={user.metamobPseudo || null}
                        onLinkMetamob={async (pseudo) => {
                            "use server";
                            return linkOcreAccount({ guildId, pseudo });
                        }}
                    />
                </div>
            )}

            {dofusSlug === "dolmanax" && (
                <div
                    className="rounded-3xl p-6 border transition-all duration-300 bg-surface border-border"
                >
                    <DofusDolmanaxTracker
                        guildId={guildId}
                        initialPages={initialPages}
                        upcomingAlmanax={almanaxList}
                        onSave={async (pages) => {
                            "use server";
                            await updateDolmanaxProgress(guildId, dofus.id, pages, character);
                        }}
                    />
                </div>
            )}

            <DofusQuestManagerV3
                guildId={guildId}
                dofus={dofus}
                chains={chains}
                dofusColor={color}
                heatmapData={heatmapData}
                selectedCharacter={character}
                initialGlobalCompletedIds={globalCompletedResult.success ? globalCompletedResult.data : []}
                prereqsByQuestId={prereqsByQuestId}
                metamobPseudo={user.metamobPseudo}
                customSlotAfterPrerequisites={
                    dofusSlug === "dokille" ? (
                        <DofusDokilleTracker
                            guildId={guildId}
                            dofusId={dofus.id}
                            dofusColor={color}
                            isObtained={dofus.isObtained}
                            initialCaptured={dofus.isObtained ? ALL_KROKILLE_MONSTERS : initialCapturedKrokilles}
                            onSave={async (monsters) => {
                                "use server";
                                return updateDokilleProgress(guildId, dofus.id, monsters, character);
                            }}
                        />
                    ) : undefined
                }
            />
        </div>
    );
}
