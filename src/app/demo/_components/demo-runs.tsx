"use client";

/**
 * Songes — vue de démo **dédiée** (lot S-2a).
 *
 * Pourquoi pas le composant réel : `RunCard` appelle une action serveur **au montage**
 * (`getMemberProfiles`, `RunCard.tsx:136`), or la page publique n'a pas de base. On
 * reprend donc le **vocabulaire réel** (filtre par palier, jauge d'étage, slots,
 * pictos officiels) **sans aucun import d'action serveur** — seule
 * `src/lib/demo/source.ts` fournit les données.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import { DIFFICULTIES, OBJECTIVES, getEpreuve, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
import { DEMO_MEMBERS, DEMO_RUNS, type DemoRun } from "@/lib/demo/source";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Tier = "ALL" | "REVE" | "PARADOXE" | "CAUCHEMAR";

const TIERS: { key: Tier; asset: string }[] = [
    { key: "ALL", asset: "/assets/missions/songes.png" },
    { key: "REVE", asset: "/assets/missions/reve1.png" },
    { key: "PARADOXE", asset: "/assets/missions/paradoxe1.png" },
    { key: "CAUCHEMAR", asset: "/assets/missions/cauchemar1.png" },
];

const MAX_FLOOR = 26;
const TEAM_SIZE = 4;

export function DemoRuns() {
    const { t } = useI18n();
    const d = t.demoPage;
    const [tier, setTier] = useState<Tier>("ALL");

    const membersById = useMemo(() => new Map(DEMO_MEMBERS.map((m) => [m.id, m])), []);

    const runs = useMemo(
        () => (tier === "ALL" ? DEMO_RUNS : DEMO_RUNS.filter((r) => r.difficulty.startsWith(tier))),
        [tier],
    );

    const countFor = (key: Tier) =>
        key === "ALL" ? DEMO_RUNS.length : DEMO_RUNS.filter((r) => r.difficulty.startsWith(key)).length;

    const tierLabel: Record<Tier, string> = {
        ALL: d.songesTierAll,
        REVE: d.songesTierReve,
        PARADOXE: d.songesTierParadoxe,
        CAUCHEMAR: d.songesTierCauchemar,
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {TIERS.map(({ key, asset }) => {
                    const active = tier === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTier(key)}
                            aria-pressed={active}
                            className={cn(
                                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer",
                                active
                                    ? "border-border-strong bg-elevated text-foreground"
                                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Image src={asset} alt="" aria-hidden width={16} height={16} className="object-contain" />
                            <span>{tierLabel[key]}</span>
                            <span className="reg-mono rounded-sm bg-background/60 px-1.5 text-xs">{countFor(key)}</span>
                        </button>
                    );
                })}
            </div>

            {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{d.songesEmpty}</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {runs.map((run) => {
                        const diff = DIFFICULTIES[run.difficulty as DifficultyKey];
                        const obj = OBJECTIVES[run.objective as ObjectiveKey];
                        const epreuve = getEpreuve(run.epreuveCode);
                        const leader = membersById.get(run.leaderMemberId);
                        const progress = Math.round((run.currentFloor / MAX_FLOOR) * 100);
                        const isFull = run.members.length >= TEAM_SIZE;
                        return (
                            <article key={run.id} className="flex flex-col rounded-lg border border-border bg-surface p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-elevated p-1">
                                            <Image src={diff.asset} alt="" aria-hidden width={28} height={28} className="object-contain" />
                                        </span>
                                        <div>
                                            <h3 className="text-base font-bold text-foreground">{diff.label}</h3>
                                            <p className="text-xs text-muted-foreground">{obj.label}</p>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "reg-mono shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                                            isFull
                                                ? "border-border-strong text-muted-foreground"
                                                : "border-accent/30 bg-accent/10 text-accent",
                                        )}
                                    >
                                        {isFull ? d.songesFull : d.songesRecruiting}
                                    </span>
                                </div>

                                <p className="mt-3 text-xs text-muted-foreground">
                                    {d.songesLeader} ·{" "}
                                    <span className="font-semibold text-foreground">{leader?.pseudoDofus ?? "—"}</span>
                                    {run.scheduledLabel ? ` · ${run.scheduledLabel}` : ` · ${run.createdLabel}`}
                                </p>

                                {epreuve && (
                                    <p className="mt-2 flex items-center gap-2 rounded-sm border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                                        <Image src={epreuve.asset} alt="" aria-hidden width={14} height={14} className="object-contain" />
                                        {epreuve.label}
                                    </p>
                                )}

                                <div className="mt-3 flex items-baseline gap-1">
                                    <span className="reg-mono text-2xl font-bold text-foreground">{run.currentFloor}</span>
                                    <span className="reg-mono text-xs text-subtle-foreground">/ {MAX_FLOOR}</span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-border">
                                    <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-1.5">
                                    {Array.from({ length: TEAM_SIZE }, (_, i) => i + 1).map((slot) => {
                                        const entry = run.members.find((m) => m.slot === slot);
                                        if (!entry) {
                                            return (
                                                <span
                                                    key={slot}
                                                    className="rounded-sm border border-dashed border-border px-2 py-1 text-xs text-subtle-foreground"
                                                >
                                                    {d.songesFree}
                                                </span>
                                            );
                                        }
                                        const member = membersById.get(entry.memberId);
                                        return (
                                            <span
                                                key={slot}
                                                className="flex items-center gap-1.5 rounded-sm border border-border bg-elevated px-2 py-1 text-xs font-semibold text-foreground"
                                            >
                                                {member && (
                                                    <Image
                                                        src={member.user.image}
                                                        alt=""
                                                        aria-hidden
                                                        width={16}
                                                        height={16}
                                                        className="rounded-sm"
                                                    />
                                                )}
                                                {member?.pseudoDofus ?? "—"}
                                            </span>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <p className="reg-mono text-xs text-subtle-foreground">{d.songesSignature}</p>
        </div>
    );
}
