import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Gem, ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getDofusDetailWithChains, toggleDofusObtained } from "@/server/actions/dofus-quest-actions";
import { DofusQuestManagerV3 } from "@/components/dofus-quests/DofusQuestManagerV3";
import { DofusProgressRing } from "@/components/dofus-quests/DofusProgressRing";
import { DofusIcon } from "@/components/dofus-quests/DofusIcon";
import { notFound } from "next/navigation";

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

    const result = await getDofusDetailWithChains(guildId, dofusSlug);

    if (!result.success || !result.data) return notFound();

    const { dofus, chains } = result.data;
    const color = dofus.color || "#6366f1";

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
                {/* Ambient glow */}
                <div
                    className="absolute -top-12 -left-12 w-40 h-40 rounded-full pointer-events-none"
                    style={{
                        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
                    }}
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
                        {dofus.name ? (
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
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                        <span
                            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: `${color}20`, color, border: `1px solid ${color}44` }}
                        >
                            {dofus.isPrimordial ? "Primordial" : dofus.rarity}
                        </span>
                        <span className="text-xs text-white/30">Niveau {dofus.levelRecommended}+</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{dofus.name}</h1>
                    {dofus.successName && (
                        <p className="text-sm text-white/40">
                            Succès : <span style={{ color }}>{dofus.successName}</span>
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

            <DofusQuestManagerV3
                guildId={guildId}
                dofus={dofus}
                chains={chains}
                dofusColor={color}
            />
        </div>
    );
}
