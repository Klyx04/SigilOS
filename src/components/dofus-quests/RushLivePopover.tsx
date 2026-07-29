"use client";
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  Users, Circle, Clock, Activity
} from "lucide-react";
import { getClass } from "@/lib/dofus-assets";
import {
  getRushActiveMembers,
  joinRushSession,
  leaveRushSession,
  updateRushLocation,
} from "@/server/actions/rush-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type RushMember = {
  id: string;
  profileId: string;
  pseudoDofus: string;
  dofusClass: string | null;
  milestoneId: string | null;
  locationDesc: string | null;
  status: string; // "ACTIVE" | "AFK"
  lastActivity: Date;
  joinedAt: Date;
};

type RushLivePopoverProps = {
  guildId: string;
  currentPseudo: string;
  currentClass: string | null;
  currentMilestoneId?: string | null;
  currentMilestoneTitle?: string | null;
  isOnRush: boolean;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const RushLivePopover = memo(function RushLivePopover({
  guildId,
  currentPseudo,
  currentClass,
  currentMilestoneId,
  currentMilestoneTitle,
  isOnRush,
}: RushLivePopoverProps) {
  const [members, setMembers] = useState<RushMember[]>([]);
  const joinedRef = useRef(false);

  const fetchMembers = useCallback(async () => {
    const res = await getRushActiveMembers(guildId);
    if (res.success) {
      setMembers(res.members as RushMember[]);
    }
  }, [guildId]);

  // Join automatically on mount, leave on unmount
  useEffect(() => {
    if (!currentPseudo || currentPseudo === "PRINCIPAL" || joinedRef.current) return;
    joinedRef.current = true;
    joinRushSession(guildId, currentPseudo, currentClass);
    fetchMembers();

    // Leave on tab close
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability on unload
      navigator.sendBeacon(
        `/api/rush/leave?guildId=${guildId}`
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also leave on unmount (navigation away)
      leaveRushSession(guildId);
    };
  }, [guildId, currentPseudo, currentClass, fetchMembers]);

  // Fetch on mount + every 10s
  useEffect(() => {
    fetchMembers();
    const id = setInterval(fetchMembers, 10000);
    return () => clearInterval(id);
  }, [fetchMembers]);

  // Auto-update location when milestone changes
  useEffect(() => {
    if (currentMilestoneId) {
      updateRushLocation(guildId, currentMilestoneId, currentMilestoneTitle);
    }
  }, [guildId, currentMilestoneId, currentMilestoneTitle]);

  const uniqueMembers = Array.from(new Map(members.map(m => [m.profileId || m.pseudoDofus, m])).values())
    .sort((a, b) => a.pseudoDofus.localeCompare(b.pseudoDofus));
  const activeCount = uniqueMembers.filter(m => m.status === "ACTIVE").length;
  const totalCount = uniqueMembers.length;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header with count */}
      <div className="flex items-center gap-1.5 px-1">
        <Activity className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
          {totalCount > 0 ? `${totalCount} en ligne` : "En ligne"}
        </span>
        {activeCount > 0 && activeCount < totalCount && (
          <span className="text-[8px] text-zinc-600">({activeCount} actif{activeCount > 1 ? "s" : ""})</span>
        )}
      </div>

      {/* Inline member chips */}
      {totalCount > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {uniqueMembers.slice(0, 6).map((m) => {
            const cls = m.dofusClass ? getClass(m.dofusClass) : null;
            const isActive = m.status === "ACTIVE";
            const isMe = m.pseudoDofus === currentPseudo;
            return (
              <div
                key={m.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/40 text-[8px] font-bold text-zinc-200"
                title={`${m.pseudoDofus} • ${cls?.name || "?"}${!isActive ? " • AFK" : ""}${m.locationDesc ? ` • ${m.locationDesc}` : ""}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-400" : "bg-amber-400/60"}`} />
                {cls && (
                  <img src={cls.icon} alt="" className="w-3 h-3 object-contain" />
                )}
                <span className="truncate max-w-[50px]">{m.pseudoDofus}</span>
                {!isActive && (
                  <Clock className="w-2 h-2 text-amber-400/60" />
                )}
                {isMe && <span className="text-emerald-400 ml-0.5">(toi)</span>}
              </div>
            );
          })}
          {totalCount > 6 && (
            <span className="text-[8px] font-black text-zinc-500">+{totalCount - 6}</span>
          )}
        </div>
      ) : (
        <p className="text-[9px] text-zinc-600 italic px-1">Aucun membre pour l'instant</p>
      )}
    </div>
  );
});