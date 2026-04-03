import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { Gem, ArrowLeft, Trophy, TreePine, Sparkles } from "lucide-react";
import Link from "next/link";
import {
    getDofusDetailWithChains,
    getGuildHeatmapForDofus,
} from "@/server/actions/dofus-quest-actions";
import { DofusQuestManagerV3 } from "@/components/dofus-quests/DofusQuestManagerV3";
import { DofusProgressRing } from "@/components/dofus-quests/DofusProgressRing";
import { DofusIcon } from "@/components/dofus-quests/DofusIcon";
import { DofusOcreMetamob } from "@/components/dofus-quests/DofusOcreMetamob";
import { DofusDolmanaxTracker } from "@/components/dofus-quests/DofusDolmanaxTracker";
import { notFound } from "next/navigation";
import { linkOcreAccount } from "@/server/actions/ocre-actions";

type Props = {
    params: Promise<{ guildId: string; dofusSlug: string }>;
};

export default async function DofusDetailPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId, dofusSlug } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled) return <AccessDenied />;

    const [result, heatmapResult] = await Promise.all([
        getDofusDetailWithChains(guildId, dofusSlug),
        getGuildHeatmapForDofus(guildId, dofusSlug),
    ]);

    if (!result.success || !result.data) return notFound();

    const { dofus, chains } = result.data;
    const color = dofus.color || "#6366f1";
    const heatmapData = heatmapResult.success ? heatmapResult.data ?? null : null;

    return (
        <div className="space-y-6 pb-12">
            {/* Back button */}
            <Link
                href={`/dashboard/${guildId}/quetes-dofus`}
                className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Retour aux Dofus
            </Link>

            {/* Dofus hero header */}
            <div
                className="relative overflow-hidden rounded-2xl px-6 py-8 flex flex-col sm:flex-row items-center gap-6"
                style={{
                    background: `linear-gradient(135deg, ${color}18 0%, rgba(255,255,255,0.02) 60%, ${color}08 100%)`,
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
                        {(dofus as any).imageUrl ? (
                            <div className="relative w-16 h-16">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={(dofus as any).imageUrl}
                                    alt={dofus.nameShort || dofus.name}
                                    className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                                    style={{ filter: dofus.isObtained ? `drop-shadow(0 0 16px ${color})` : undefined }}
                                />
                            </div>
                        ) : dofus.name ? (
                            <DofusIcon
                                name={dofus.nameShort || "Argenté"}
                                size={64}
                                color={color}
                                isObtained={dofus.isObtained}
                            />
                        ) : (
                            <Gem className="w-12 h-12" style={{ color }} />
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1 flex-wrap">
                        <span
                            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: `${color}20`, color, border: `1px solid ${color}44` }}
                        >
                            {dofus.isPrimordial ? "Primordial" : dofus.rarity}
                        </span>
                        {(dofus as any).isMeta && (
                            <span
                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-emerald-400"
                                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
                            >
                                <TreePine className="w-2.5 h-2.5" /> Méta-Dofus
                            </span>
                        )}
                        {(dofus as any).isSylvestreReq && !(dofus as any).isMeta && (
                            <span
                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-emerald-500/70"
                                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
                            >
                                <Sparkles className="w-2.5 h-2.5" /> Requis Sylvestre
                            </span>
                        )}
                        <span className="text-xs text-white/30">Niveau {dofus.levelRecommended}+</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{dofus.name}</h1>
                    {dofus.successName && (
                        <p className="text-sm text-white/40">
                            Succès : <span style={{ color }}>{dofus.successName}</span>
                        </p>
                    )}
                    {(dofus as any).bonusSummary && (
                        <p className="text-xs text-white/30 mt-1 font-medium">
                            ✦ {(dofus as any).bonusSummary}
                        </p>
                    )}
                    {dofus.description && (
                        <p className="text-sm text-white/50 mt-2 max-w-lg">{dofus.description}</p>
                    )}

                    {/* Progress bar + stats */}
                    <div className="mt-4 flex flex-col gap-2 max-w-xs mx-auto sm:mx-0">
                        <div className="flex items-center justify-between text-xs text-white/40">
                            <span>Progression</span>
                            <span className="tabular-nums">{dofus.completedQuests}/{dofus.totalQuests} étapes</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${dofus.progressPercent}%`,
                                    background: dofus.isObtained
                                        ? `linear-gradient(90deg, ${color}, #fbbf24)`
                                        : `linear-gradient(90deg, ${color}cc, ${color})`,
                                    boxShadow: `0 0 8px ${color}66`,
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
                    className="rounded-3xl p-6 border"
                    style={{
                        background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.4) 100%)`,
                        border: `1px solid ${color}25`,
                    }}
                >
                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
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
                    className="rounded-3xl p-6 border"
                    style={{
                        background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.4) 100%)`,
                        border: `1px solid ${color}25`,
                    }}
                >
                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                        <span style={{ color }}>📖</span> Progression Almanax
                    </div>
                    <DofusDolmanaxTracker
                        guildId={guildId}
                        initialPages={0}
                    />
                </div>
            )}

            <DofusQuestManagerV3
                guildId={guildId}
                dofus={dofus}
                chains={chains}
                dofusColor={color}
                heatmapData={heatmapData}
            />
        </div>
    );
}
