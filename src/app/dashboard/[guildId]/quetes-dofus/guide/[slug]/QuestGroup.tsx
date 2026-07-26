"use client";
import { useMemo, memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle2, Circle, ChevronDown, ChevronUp, Link2, ExternalLink } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestGroupMember = {
  seqId: string;
  questName: string;
  dungeonName?: string;
  dungeonImageUrl?: string;
};

type QuestGroupData = {
  id: string;
  title: string;
  members: QuestGroupMember[];
};

type Sequence = {
  id: string;
  subGuideName: string;
  subGuideRef: string;
  note?: string | null;
  tips?: string | null;
  dungeon?: { id: string; name: string; bossName: string; imageUrl?: string | null } | null;
  dungeons?: { id: string; name: string; bossName: string; imageUrl?: string | null }[];
  activityTags?: { type: string; name?: string; color?: string }[];
};

// ─── QuestGroup client renderer ───────────────────────────────────────────────

export const QuestGroupRenderer = memo(function QuestGroupRenderer({
  title,
  members,
  completedIds,
  onToggleAll,
  isLoading,
}: {
  title: string;
  members: QuestGroupMember[];
  completedIds: Set<string>;
  onToggleAll: (completed: boolean) => void;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const allDone = members.length > 0 && members.every((m) => completedIds.has(m.seqId));
  const someDone = members.some((m) => completedIds.has(m.seqId));

  return (
    <div className="border border-emerald-500/20 rounded-2xl bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/40"
      >
        <div className="flex-shrink-0">
          {isLoading ? (
            <div className="w-5 h-5 rounded border-2 border-emerald-400 border-t-transparent animate-spin" />
          ) : allDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : someDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400/80" />
          ) : (
            <Circle className="w-5 h-5 text-zinc-600" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-black text-emerald-300 uppercase tracking-wider truncate">{title}</span>
          <span className="text-[9px] font-mono text-zinc-500 flex-shrink-0">
            {members.filter((m) => completedIds.has(m.seqId)).length}/{members.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle all button */}
          {someDone && !allDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAll(true);
              }}
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
              title="Tout marquer fait"
            >
              Tout ✓
            </button>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {/* Members list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 border-t border-emerald-500/10 pt-2">
              {members.map((m) => (
                <div
                  key={m.seqId}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                    completedIds.has(m.seqId)
                      ? "bg-zinc-900/50 border-zinc-700/40 opacity-70"
                      : "bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {completedIds.has(m.seqId) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>

                  {m.dungeonImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.dungeonImageUrl}
                      alt={m.dungeonName || ""}
                      className="w-6 h-6 rounded-lg object-cover border border-white/10 flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-bold ${
                      completedIds.has(m.seqId) ? "text-zinc-400 line-through" : "text-white"
                    }`}>
                      {m.questName}
                    </span>
                    {m.dungeonName && (
                      <span className="text-[8px] text-zinc-500 ml-1.5 italic">{m.dungeonName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── QuestGroup data extractor ────────────────────────────────────────────────
// Extrait les groupes de quêtes à partir des sequences activityTags

export function useQuestGroups(sequences: Sequence[]): QuestGroupData[] {
  return useMemo(() => {
    // Trouver tous les tags de type "quest_group"
    const groupMap = new Map<string, QuestGroupData>();

    sequences.forEach((seq) => {
      const tags = seq.activityTags || [];
      tags.forEach((tag) => {
        if (tag.type === "quest_group" && tag.name) {
          if (!groupMap.has(tag.name)) {
            groupMap.set(tag.name, {
              id: `qg-${tag.name}`,
              title: tag.name,
              members: [],
            });
          }
          const group = groupMap.get(tag.name)!;
          // Éviter les doublons
          if (!group.members.some((m) => m.seqId === seq.id)) {
            const allDungeons = [
              ...(seq.dungeons || []),
              ...(seq.dungeon ? [seq.dungeon] : []),
            ];
            group.members.push({
              seqId: seq.id,
              questName: seq.subGuideName || seq.subGuideRef,
              dungeonName: allDungeons[0]?.name ?? undefined,
              dungeonImageUrl: allDungeons[0]?.imageUrl ?? undefined,
            });
          }
        }
      });
    });

    return Array.from(groupMap.values());
  }, [sequences]);
}