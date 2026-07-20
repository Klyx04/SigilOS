"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, ChevronUp,
  BookOpen, Flag, Users, RotateCcw, EyeOff, Eye, ExternalLink,
  Bookmark, BookmarkCheck, Zap, Loader2, CheckCheck, ArrowRight,
  Sparkles, Construction, AlertTriangle, Sword, Gem, X
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import {
  toggleMilestoneProgress,
  validateEntireMilestone,
  resetMilestoneProgress,
  updateBookmarkedStep,
} from "@/server/actions/optimized-guide-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type DungeonRef = { id: string; name: string; bossName: string; imageUrl?: string | null };

type ActivityTagType =
  | "combat_tactique"
  | "combat_vagues"
  | "songes"
  | "combat_solo"
  | "combat_plusieurs"
  | "contrainte_horaire"
  | "donjon"
  | "plusieurs_personnes"
  | "sort"
  | "metier";

type ActivityTag = { type: ActivityTagType; name?: string; level?: number; count?: number };

type Sequence = {
  id: string;
  subGuideRef: string;
  subGuideName: string;
  stepFrom?: number | null;
  stepTo?: number | null;
  note?: string | null;
  isOptional: boolean;
  order: number;
  dungeon?: DungeonRef | null;
  dungeons?: DungeonRef[];
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  tips?: string | null;
  alignReq?: string | null;
  alignOrderReq?: number | null;
  isSuccess?: boolean;
  metamobMonsterId?: number | null;
  activityTags?: ActivityTag[];
};

const ACTIVITY_TAGS: { type: ActivityTagType; imagePath: string; label: string; color: string }[] = [
  { type: "combat_tactique",    imagePath: "/assets/rush-sylvestre/combat-tactique.png",    label: "Combat Tactique", color: "#ef4444" },
  { type: "combat_vagues",      imagePath: "/assets/rush-sylvestre/combat-vagues.png",      label: "Vagues",          color: "#3b82f6" },
  { type: "songes",             imagePath: "/assets/rush-sylvestre/songes.png",             label: "Songes",          color: "#8b5cf6" },
  { type: "combat_solo",        imagePath: "/assets/rush-sylvestre/combat-solo.png",        label: "Combat Solo",     color: "#f43f5e" },
  { type: "combat_plusieurs",   imagePath: "/assets/rush-sylvestre/combat-plusieurs.png",   label: "Multi Combat",    color: "#a855f7" },
  { type: "contrainte_horaire", imagePath: "/assets/rush-sylvestre/contrainte-horaire.png", label: "Horaire Spec.",   color: "#f59e0b" },
  { type: "donjon",             imagePath: "/assets/rush-sylvestre/donjon.png",             label: "Donjon requis",   color: "#3b82f6" },
  { type: "plusieurs_personnes",imagePath: "/assets/rush-sylvestre/plusieurs-personnes.png",label: "Multi joueurs",   color: "#10b981" },
  { type: "sort",               imagePath: "/assets/rush-sylvestre/sort.png",               label: "Sort requis",     color: "#ec4899" },
  { type: "metier",             imagePath: "/assets/rush-sylvestre/façonneur.png",          label: "Métier requis",   color: "#eab308" },
];

function getMetierIconPath(metierName?: string) {
  if (!metierName) return "/assets/rush-sylvestre/façonneur.png";
  const normalized = metierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c");
  return `/assets/rush-sylvestre/${normalized}.png`;
}

type MilestoneType = "PREREQUIS" | "ALIGNEMENT" | "DOFUS" | "SUCCES" | "ZONE" | "QUETE_SERIE" | "DONJON" | string;

type Milestone = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  type: MilestoneType;
  accentColor?: string | null;
  imageUrl?: string | null;
  chapter: number;
  chapterLabel: string;
  order: number;
  isOptional: boolean;
  tips?: string | null;
  dofusId?: string | null;
  sequences: Sequence[];
  playerProgress?: { isCompleted: boolean; completedSteps?: any; currentStep?: string | null }[];
};

type GuildMemberProgress = {
  profileId: string;
  milestoneId: string;
  isCompleted: boolean;
  userName: string;
  userAvatar?: string;
};

type RushTimelineClientProps = {
  guide: { id: string; name: string; slug: string; description?: string | null; isUnderConstruction?: boolean; imageUrl?: string | null; isDiscordConfigured?: boolean };
  milestones: Milestone[];
  guildProgress: GuildMemberProgress[];
  guildId: string;
  selectedCharacter?: string;
  mules?: any[];
  currentUserProfile: {
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number;
    altPseudos?: any[];
  };
};

// Dofus list (static reference)
const DOFUS_DEFS = [
  { id: "ocre",              label: "Ocre",               color: "#f59e0b", imageUrl: "/assets/icons/ocre.png" },
  { id: "turquoise",        label: "Turquoise",          color: "#06b6d4", imageUrl: "/module-dofus/Dofus_Turquoise.png" },
  { id: "argente",          label: "Argenté",            color: "#a1a1aa", imageUrl: "/module-dofus/Dofus_Argente.png" },
  { id: "argente_scintillant", label: "Arg. Scintillant", color: "#c0c0c0", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png" },
  { id: "ebene",            label: "Ébène",              color: "#52525b", imageUrl: "/module-dofus/Dofus_Ebene.png" },
  { id: "pourpre",          label: "Pourpre",            color: "#a855f7", imageUrl: "/module-dofus/Dofus_Pourpre.png" },
  { id: "ivoire",           label: "Ivoire",             color: "#e2e8f0", imageUrl: "/module-dofus/Dofus_Ivoire.png" },
  { id: "emeraude",         label: "Émeraude",           color: "#10b981", imageUrl: "/module-dofus/Dofus_Emeraude.png" },
  { id: "dolmanax",         label: "Dolmanax",           color: "#ef4444", imageUrl: "/module-dofus/Dofus_Dolmanax.png" },
  { id: "des_glaces",       label: "Des Glaces",         color: "#93c5fd", imageUrl: "/module-dofus/Dofus_Des_Glaces.png" },
  { id: "du_cauchemar",     label: "Du Cauchemar",       color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
  { id: "domakuro",         label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  { id: "dom_de_pin",       label: "Dom de Pin",         color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
];

type LinkMode = "dofusdb" | "dofusnoob";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDofusNoobQuestUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://www.dofuspourlesnoobs.com/?s=${encodeURIComponent(name)}`;
}

function getDofusDbQuestUrl(name: string): string {
  return `https://dofusdb.fr/fr/database/quest?name=${encodeURIComponent(name)}`;
}

function getQuestUrl(name: string, mode: LinkMode): string {
  return mode === "dofusnoob" ? getDofusNoobQuestUrl(name) : getDofusDbQuestUrl(name);
}

// Avatar cluster for guild heatmap
const MemberAvatars = memo(function MemberAvatars({
  members,
  max = 5,
}: {
  members: GuildMemberProgress[];
  max?: number;
}) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div className="flex items-center gap-1.5" title={`Ici : ${members.map(m => m.userName).join(", ")}`}>
      {/* Pulse indicator */}
      <span className="relative flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-pulse" />
      </span>
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <div
            key={m.profileId}
            className="w-6 h-6 rounded-full border-2 border-zinc-950 overflow-hidden bg-indigo-900 flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-500/30"
            title={m.userName}
          >
            {m.userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-black text-indigo-300">{m.userName[0]?.toUpperCase()}</span>
            )}
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="text-[9px] font-black text-indigo-400">+{extra}</span>
      )}
      <span className="text-[9px] font-bold text-indigo-400/70 hidden sm:block">
        ici
      </span>
    </div>
  );
});

// ─── Milestone Row ────────────────────────────────────────────────────────────

const MilestoneRow = memo(function MilestoneRow({
  ms,
  isCompleted,
  isBookmarked,
  membersHere,
  hideDone,
  isLoading,
  onToggle,
  onValidateAll,
  onReset,
  onBookmark,
  accentColor,
  userAlignmentInfo,
  onDungeonClick,
  onLinkClick,
}: {
  ms: Milestone;
  isCompleted: boolean;
  isBookmarked: boolean;
  membersHere: GuildMemberProgress[];
  hideDone: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onValidateAll: () => void;
  onReset: () => void;
  onBookmark: () => void;
  accentColor: string;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  onDungeonClick: (dungeonId: string, questName: string) => void;
  onLinkClick: (questName: string, dbUrl?: string | null, noobsUrl?: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand bookmarked milestone
  useEffect(() => {
    if (isBookmarked) setExpanded(true);
  }, [isBookmarked]);

  if (hideDone && isCompleted) return null;

  return (
    <div
      className={`relative transition-all duration-200 ${
        isCompleted
          ? "opacity-50"
          : isBookmarked
          ? "opacity-100"
          : "opacity-90 hover:opacity-100"
      }`}
    >
      {/* Timeline dot */}
      <div
        className="absolute -left-[25px] top-4 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 z-10 transition-all"
        style={{
          background: isCompleted ? accentColor : "transparent",
          borderColor: accentColor,
          boxShadow: isBookmarked ? `0 0 10px ${accentColor}80` : undefined,
        }}
      />

      {/* Card */}
      <div
        className={`ml-2 rounded-2xl border transition-all ${
          isCompleted
            ? "border-white/5 bg-zinc-950/20"
            : isBookmarked
            ? "border-white/20 bg-zinc-900/60"
            : "border-white/8 bg-zinc-950/40 hover:border-white/15"
        }`}
        style={
          isBookmarked
            ? { borderColor: `${accentColor}50`, boxShadow: `0 0 20px ${accentColor}10` }
            : undefined
        }
      >
        {/* Header row */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          {/* Status icon */}
          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />
            ) : (
              <Circle className="w-5 h-5 text-zinc-600" />
            )}
          </div>

          {/* Title + badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-bold leading-tight ${
                  isCompleted ? "line-through text-zinc-500" : "text-white"
                }`}
              >
                {ms.title}
              </span>
              {isBookmarked && (
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: `${accentColor}25`, color: accentColor }}
                >
                  <Flag className="w-2.5 h-2.5" /> Rendu ici
                </span>
              )}
              {ms.isOptional && (
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Bonus
                </span>
              )}
              {ms.dofusId && (() => {
                const def = DOFUS_DEFS.find(d => d.id === ms.dofusId);
                if (!def) return null;
                return (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest animate-pulse"
                    style={{ borderColor: def.color + "60", background: def.color + "20", color: def.color, boxShadow: `0 0 10px ${def.color}40` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={def.imageUrl} alt={def.label} className="w-4 h-4 object-contain" />
                    {def.label}
                  </span>
                );
              })()}
            </div>
            {ms.subtitle && (
              <div className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate">{ms.subtitle}</div>
            )}
          </div>

          {/* Guild heatmap */}
          {membersHere.length > 0 && (
            <div className="flex-shrink-0">
              <MemberAvatars members={membersHere} />
            </div>
          )}

          {/* Sequences count */}
          {ms.sequences.length > 0 && (
            <span className="text-[9px] text-zinc-600 font-black flex-shrink-0">
              {ms.sequences.length} séq.
            </span>
          )}

          {/* Chevron */}
          <div className="flex-shrink-0 text-zinc-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Expanded body */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                {/* Description */}
                {ms.description && (
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">{ms.description}</p>
                )}

                {/* Sequences / quêtes */}
                {ms.sequences.length > 0 ? (
                  <div className="space-y-1.5">
                    {ms.sequences.map((seq) => (
                      <SequenceRow 
                        key={seq.id} 
                        seq={seq} 
                        accentColor={accentColor} 
                        userAlignmentInfo={userAlignmentInfo}
                        onDungeonClick={onDungeonClick} 
                        onLinkClick={onLinkClick}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-600 italic">Aucune étape détaillée renseignée.</p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 mt-2 border-t border-white/5">
                  {/* Toggle milestone done */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      isCompleted
                        ? "bg-zinc-800/60 border-white/10 text-zinc-400 hover:bg-zinc-700/60"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {isCompleted ? <Circle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {isCompleted ? "Décocher" : "Marquer fait"}
                  </button>

                  {/* Validate all sequences */}
                  {!isCompleted && ms.sequences.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onValidateAll(); }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Valider tout le bloc
                    </button>
                  )}

                  {/* Bookmark */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      isBookmarked
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                        : "bg-white/5 border-white/10 text-zinc-500 hover:text-amber-400"
                    }`}
                    title="Je suis rendu ici"
                  >
                    {isBookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                    {isBookmarked ? "Ici !" : "Rendu ici"}
                  </button>

                  {/* Reset */}
                  {isCompleted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onReset(); }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/5 border border-red-500/15 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  )}

                  {/* Spacer + Guild members detail */}
                  {membersHere.length > 0 && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-indigo-400" />
                      <span className="text-[9px] text-indigo-400 font-black">
                        {membersHere.map((m) => m.userName).join(", ")} ici
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ─── Sequence Row ─────────────────────────────────────────────────────────────

const ALIGN_LABELS: Record<string, { label: string; color: string }> = {
  bontarien: { label: "Bonta", color: "#60a5fa" },
  brakmarien: { label: "Brakmar", color: "#f87171" },
  neutre: { label: "Neutre", color: "#a1a1aa" },
};

const SequenceRow = memo(function SequenceRow({
  seq,
  accentColor,
  userAlignmentInfo,
  onDungeonClick,
  onLinkClick,
}: {
  seq: Sequence;
  accentColor: string;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  onDungeonClick: (dungeonId: string, questName: string) => void;
  onLinkClick: (questName: string, dbUrl?: string | null, noobsUrl?: string | null) => void;
}) {
  const stepRange =
    seq.stepFrom != null && seq.stepTo != null
      ? `Étapes ${seq.stepFrom}–${seq.stepTo}`
      : null;

  // URLs: uniquement si explicitement renseignées par l'admin (pas de fallback généré → évite les 404)
  const dbUrl = seq.dofusdbUrl || null;
  const noobsUrl = seq.dofuspourlesnoobsUrl || null;
  const hasAnyLink = !!dbUrl || !!noobsUrl;
  
  // Align validation
  const alignInfo = seq.alignReq ? ALIGN_LABELS[seq.alignReq] : null;
  const hasAlignment = !!alignInfo;
  
  // Comparer l'alignement requis de la quête avec celui du profil sélectionné
  const userAlignStr = String(userAlignmentInfo.alignment || "").toLowerCase();
  const reqAlignStr = String(seq.alignReq || "").toLowerCase();
  const isAlignMatch = hasAlignment ? (userAlignStr === reqAlignStr) : true;
  
  // Comparer l'ordre
  const isOrderMatch = seq.alignOrderReq 
    ? (userAlignmentInfo.alignmentLevel ?? 0) >= seq.alignOrderReq
    : true;
    
  const isRequirementMet = isAlignMatch && isOrderMatch;

  // Gather all dungeons (primary + multi)
  const allDungeons: DungeonRef[] = [];
  if (seq.dungeons && seq.dungeons.length > 0) {
    allDungeons.push(...seq.dungeons);
  } else if (seq.dungeon) {
    allDungeons.push(seq.dungeon);
  }
  const hasDungeons = allDungeons.length > 0;

  const questName = seq.subGuideName || seq.subGuideRef;

  // Determine row colors based on content type
  let bgClass = "bg-zinc-950/20 border-white/5 hover:border-white/10 hover:bg-white/5";
  let themeAccent = accentColor;
  
  if (seq.isSuccess) {
    bgClass = "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/10";
    themeAccent = "#f97316"; // Orange for success/achievement
  } else if (hasDungeons) {
    bgClass = "bg-red-500/5 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10";
    themeAccent = "#ef4444";
  } else if (seq.isOptional) {
    bgClass = "bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10";
    themeAccent = "#a855f7";
  } else if (hasAlignment) {
    if (seq.alignReq === "bontarien") {
      bgClass = "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/10";
      themeAccent = "#3b82f6";
    } else if (seq.alignReq === "brakmarien") {
      bgClass = "bg-red-500/5 border-red-900/25 hover:border-red-500/40 hover:bg-red-950/10";
      themeAccent = "#ef4444";
    }
  }

  return (
    <div 
      onClick={hasAnyLink ? () => onLinkClick(questName, dbUrl, noobsUrl) : undefined}
      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all ${bgClass} ${
        hasAnyLink ? "group cursor-pointer" : "cursor-default opacity-80"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Left: donjon icon(s) or bullet */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
          {hasDungeons ? (
            allDungeons.map((dj) => (
              <button
                key={dj.id}
                onClick={(e) => { e.stopPropagation(); onDungeonClick(dj.id, questName); }}
                title={`Créer un post DJ — ${dj.name}`}
                className="relative group/dj"
              >
                {dj.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dj.imageUrl}
                    alt={dj.bossName}
                    className="w-8 h-8 rounded-lg object-cover border border-white/10 group-hover/dj:border-amber-500/40 transition-colors"
                    style={{ boxShadow: `0 0 8px ${themeAccent}30` }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 group-hover/dj:border-amber-500/40 flex items-center justify-center transition-colors">
                    <Sword className="w-4 h-4 text-zinc-500" />
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500/90 rounded-full opacity-0 group-hover/dj:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[6px] text-black font-black">+</span>
                </div>
              </button>
            ))
          ) : (
            <div className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: themeAccent }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-200 font-bold leading-tight group-hover:text-white transition-colors">{questName}</span>
            
            {/* Donjon badge */}
            {hasDungeons && (
              <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                <Sword className="w-2 h-2" />
                {allDungeons.length > 1 ? `${allDungeons.length} donjons` : allDungeons[0].name}
              </span>
            )}

            {stepRange && <span className="text-[9px] text-zinc-500 font-mono">{stepRange}</span>}
            {seq.isOptional && (
              <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Bonus</span>
            )}
            {/* Badge Succès */}
            {seq.isSuccess && (
              <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/succès.png" alt="succès" className="w-3 h-3 object-contain" />
                Succès
              </span>
            )}
            {/* Badge Metamob Ocre */}
            {seq.metamobMonsterId && (
              <a
                href={`https://metamob.fr/monstre/${seq.metamobMonsterId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                title="Voir sur Metamob (Ocre)"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/icons/ocre.png" alt="Ocre" className="w-3 h-3 object-contain" />
                Metamob
              </a>
            )}

            {/* Badge Alignement comparatif */}
            {alignInfo && (
              <span
                className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                  isRequirementMet 
                    ? "color-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "color-orange-400 border-orange-500/30 bg-orange-500/10 text-orange-400"
                }`}
                title={isRequirementMet ? "Prérequis alignement validé ✓" : `Prérequis non rempli (${alignInfo.label} niveau ${seq.alignOrderReq ?? 0} requis)`}
              >
                <span>{alignInfo.label} {seq.alignOrderReq ? `lv.${seq.alignOrderReq}` : ""}</span>
                <span>{isRequirementMet ? "✓" : "⚠"}</span>
              </span>
            )}

            {/* Rendu des tags d'activité réels */}
            {Array.isArray(seq.activityTags) && seq.activityTags.map((tag, idx) => {
              const def = ACTIVITY_TAGS.find(d => d.type === tag.type);
              if (!def) return null;
              const isMetier = tag.type === "metier";
              const iconPath = isMetier ? getMetierIconPath(tag.name) : def.imagePath;
              const label = isMetier && tag.name ? `${tag.name} (Niv. ${tag.level ?? 1})` : def.label;
              return (
                <span
                  key={idx}
                  title={label}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconPath} alt={def.label} className="w-3.5 h-3.5 object-contain" />
                  {tag.count && tag.count > 1 && <span className="text-amber-400 font-mono text-[9px]">x{tag.count}</span>}
                  {isMetier && tag.name && <span>{tag.name} {tag.level ? `Niv.${tag.level}` : ""}</span>}
                  {!isMetier && <span>{def.label}</span>}
                </span>
              );
            })}
          </div>

          {seq.tips && (
            <div className="flex items-start gap-1 mt-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-400/75 flex-shrink-0 mt-0.5" />
              <span className="text-[9.5px] text-amber-300/80 leading-tight">{seq.tips}</span>
            </div>
          )}
          {seq.note && (
            <div className="flex items-start gap-1 mt-0.5">
              <AlertTriangle className="w-2.5 h-2.5 text-orange-400/75 flex-shrink-0 mt-0.5" />
              <span className="text-[9.5px] text-orange-300/80 leading-tight">{seq.note}</span>
            </div>
          )}
        </div>
      </div>

      {/* Icons côté droit — favicons + succès + Ocre */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Succès icon */}
        {seq.isSuccess && (
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0" title="Étape de succès">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/succès.png" alt="succès" className="w-5 h-5 object-contain" />
          </div>
        )}
        {/* Metamob/Ocre icon */}
        {seq.metamobMonsterId && (
          <a
            href={`https://metamob.fr/monstre/${seq.metamobMonsterId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all flex-shrink-0"
            title="Monstre lié à l'Ocre — Voir sur Metamob"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/ocre.png" alt="Ocre" className="w-5 h-5 object-contain" />
          </a>
        )}
        {/* Favicons des sites (si liens disponibles) */}
        {hasAnyLink && (
          <div className="flex items-center gap-1.5">
            {noobsUrl && (
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800/60 border border-white/8 group-hover:border-white/20 transition-colors flex-shrink-0" title="DofusPourLesNoobs disponible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32"
                  alt="Noobs"
                  className="w-5 h-5 rounded-sm"
                />
              </div>
            )}
            {dbUrl && (
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800/60 border border-white/8 group-hover:border-white/20 transition-colors flex-shrink-0" title="DofusDB disponible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32"
                  alt="DofusDB"
                  className="w-5 h-5 rounded-sm"
                />
              </div>
            )}
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 group-hover:text-zinc-200 flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Dofus Progress Bar ───────────────────────────────────────────────────────

const DofusProgressBar = memo(function DofusProgressBar({
  milestones,
  completedIds,
  activeFilter,
  onFilterChange,
}: {
  milestones: Milestone[];
  completedIds: Set<string>;
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
}) {
  const dofusStats = useMemo(() => {
    return DOFUS_DEFS.map(d => {
      const linked = milestones.filter(m => m.dofusId === d.id);
      if (linked.length === 0) return null;
      const done = linked.filter(m => completedIds.has(m.id)).length;
      const pct = Math.round((done / linked.length) * 100);
      return { ...d, total: linked.length, done, pct };
    }).filter(Boolean) as (typeof DOFUS_DEFS[0] & { total: number; done: number; pct: number })[];
  }, [milestones, completedIds]);

  if (dofusStats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/40 border border-white/5 rounded-2xl">
      <button
        onClick={() => onFilterChange(null)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
          activeFilter === null ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Tout
      </button>
      {dofusStats.map(d => (
        <button
          key={d.id}
          onClick={() => onFilterChange(activeFilter === d.id ? null : d.id)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${
            activeFilter === d.id ? "border-white/20" : "border-white/5 opacity-70 hover:opacity-100"
          }`}
          style={activeFilter === d.id ? { background: d.color + "20", borderColor: d.color + "60" } : {}}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.imageUrl} alt={d.label} className="w-7 h-7 object-contain flex-shrink-0" />
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: d.color }}>{d.label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, background: d.color }} />
              </div>
              <span className="text-[8px] text-zinc-500 font-bold">{d.pct}%</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

// ─── Chapter Block ────────────────────────────────────────────────────────────

const ChapterBlock = memo(function ChapterBlock({
  chapterNum,
  label,
  milestones,
  completedIds,
  bookmarkedMsId,
  guildProgressByMs,
  hideDone,
  loadingIds,
  dofusFilter,
  userAlignmentInfo,
  onToggle,
  onValidateAll,
  onReset,
  onBookmark,
  onDungeonClick,
  onLinkClick,
}: {
  chapterNum: number;
  label: string;
  milestones: Milestone[];
  completedIds: Set<string>;
  bookmarkedMsId: string | null;
  guildProgressByMs: Map<string, GuildMemberProgress[]>;
  hideDone: boolean;
  loadingIds: Set<string>;
  dofusFilter: string | null;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  onToggle: (ms: Milestone) => void;
  onValidateAll: (ms: Milestone) => void;
  onReset: (ms: Milestone) => void;
  onBookmark: (ms: Milestone) => void;
  onDungeonClick: (dungeonId: string, questName: string) => void;
  onLinkClick: (questName: string, dbUrl?: string | null, noobsUrl?: string | null) => void;
}) {
  const completedInChapter = milestones.filter((m) => completedIds.has(m.id)).length;
  const totalInChapter = milestones.length;
  const allDone = completedInChapter === totalInChapter && totalInChapter > 0;
  const accentColor = milestones[0]?.accentColor || "#10b981";

  // Auto-open if chapter contains bookmarked milestone
  const hasBookmark = milestones.some((m) => m.id === bookmarkedMsId);
  const [open, setOpen] = useState(hasBookmark || chapterNum === 1);

  useEffect(() => {
    if (hasBookmark) setOpen(true);
  }, [hasBookmark]);

  const visibleCount = hideDone
    ? milestones.filter((m) => !completedIds.has(m.id)).length
    : milestones.length;

  if (hideDone && visibleCount === 0) return null;

  return (
    <div className="relative">
      {/* Chapter header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 py-3 group"
      >
        {/* Progress circle */}
        <div
          className="relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
          style={{
            borderColor: allDone ? accentColor : `${accentColor}40`,
            background: allDone ? `${accentColor}20` : "transparent",
          }}
        >
          {allDone ? (
            <CheckCheck className="w-4 h-4" style={{ color: accentColor }} />
          ) : (
            <span className="text-xs font-black" style={{ color: `${accentColor}80` }}>
              {chapterNum}
            </span>
          )}
        </div>

        {/* Label + progress bar */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-black text-white uppercase tracking-wide">{label}</span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {completedInChapter}/{totalInChapter}
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden w-full">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalInChapter > 0 ? (completedInChapter / totalInChapter) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`,
                boxShadow: allDone ? `0 0 8px ${accentColor}60` : undefined,
              }}
            />
          </div>
        </div>

        {/* Toggle icon */}
        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Timeline line + milestones */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative ml-5 pl-5 pb-4 border-l-2 border-white/5 space-y-2">
              {milestones
                .filter(ms => !dofusFilter || ms.dofusId === dofusFilter)
                .map((ms) => (
                <MilestoneRow
                  key={ms.id}
                  ms={ms}
                  isCompleted={completedIds.has(ms.id)}
                  isBookmarked={ms.id === bookmarkedMsId}
                  membersHere={guildProgressByMs.get(ms.id) || []}
                  hideDone={hideDone}
                  isLoading={loadingIds.has(ms.id)}
                  onToggle={() => onToggle(ms)}
                  onValidateAll={() => onValidateAll(ms)}
                  onReset={() => onReset(ms)}
                  onBookmark={() => onBookmark(ms)}
                  accentColor={ms.accentColor || accentColor}
                  userAlignmentInfo={userAlignmentInfo}
                  onDungeonClick={onDungeonClick}
                  onLinkClick={onLinkClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RushTimelineClient({
  guide,
  milestones,
  guildProgress,
  guildId,
  selectedCharacter = "PRINCIPAL",
  mules = [],
  currentUserProfile,
}: RushTimelineClientProps) {
  const router = useRouter();
  const altPseudo = selectedCharacter !== "PRINCIPAL" ? selectedCharacter : undefined;

  // ── Local state ──────────────────────────────────────────────────────────────
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    milestones.forEach((ms) => {
      if (ms.playerProgress?.[0]?.isCompleted) s.add(ms.id);
    });
    return s;
  });

  const [bookmarkedMsId, setBookmarkedMsId] = useState<string | null>(() => {
    for (const ms of milestones) {
      if (ms.playerProgress?.[0]?.currentStep) return ms.id;
    }
    return null;
  });

  const [hideDone, setHideDone] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [dofusFilter, setDofusFilter] = useState<string | null>(null);

  // DJ Modal state
  const [djModal, setDjModal] = useState<{ open: boolean; dungeonId?: string; questName?: string }>({ open: false });

  // Link Selector Modal
  const [linkSelectorModal, setLinkSelectorModal] = useState<{ open: boolean; title?: string; noobsUrl?: string; dbUrl?: string }>({ open: false });

  // Résoudre l'alignement et l'ordre du personnage sélectionné (principal ou mule)
  const resolvedCharacterInfo = useMemo(() => {
    if (!altPseudo) {
      return {
        alignment: currentUserProfile?.alignment,
        alignmentOrder: currentUserProfile?.alignmentOrder,
        alignmentLevel: currentUserProfile?.alignmentLevel ?? 0,
      };
    }
    const mule = currentUserProfile?.altPseudos?.find(m => m.pseudo === altPseudo);
    return {
      alignment: mule?.alignment,
      alignmentOrder: mule?.alignmentOrder,
      alignmentLevel: mule?.level ?? 0,
    };
  }, [altPseudo, currentUserProfile]);

  // Handler intelligent de clic sur quête
  const handleQuestLinkClick = useCallback((questName: string, dbUrl?: string | null, noobsUrl?: string | null) => {
    const hasDb = !!dbUrl;
    const hasNoobs = !!noobsUrl;
    if (hasDb && hasNoobs) {
      setLinkSelectorModal({ open: true, title: questName, dbUrl, noobsUrl });
    } else if (hasDb) {
      window.open(dbUrl, "_blank", "noopener,noreferrer");
    } else if (hasNoobs) {
      window.open(noobsUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  // ── Live polling: refresh guild progress every 30s ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => { router.refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Handler dungeon click → ouvrir modal DJ
  const handleDungeonClick = useCallback((dungeonId: string, questName: string) => {
    setDjModal({ open: true, dungeonId, questName });
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Group milestones by chapter (no re-render if milestones unchanged)
  const chapters = useMemo(() => {
    const map = new Map<number, { label: string; items: Milestone[] }>();
    for (const ms of milestones) {
      if (!map.has(ms.chapter)) {
        map.set(ms.chapter, { label: ms.chapterLabel, items: [] });
      }
      map.get(ms.chapter)!.items.push(ms);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [milestones]);

  // Guild progress: members who are currently at each milestone (not completed)
  const guildProgressByMs = useMemo(() => {
    const map = new Map<string, GuildMemberProgress[]>();
    guildProgress.forEach((p) => {
      if (!p.isCompleted) {
        if (!map.has(p.milestoneId)) map.set(p.milestoneId, []);
        map.get(p.milestoneId)!.push(p);
      }
    });
    return map;
  }, [guildProgress]);

  // Overall progress stats
  const totalMs = milestones.length;
  const completedCount = completedIds.size;
  const overallPercent = totalMs > 0 ? Math.round((completedCount / totalMs) * 100) : 0;

  // Active members on guide (who have any progress)
  const activeMembersCount = useMemo(() => {
    return new Set(guildProgress.map((p) => p.profileId)).size;
  }, [guildProgress]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const setLoading = useCallback((msId: string, val: boolean) => {
    setLoadingIds((prev) => {
      const n = new Set(prev);
      val ? n.add(msId) : n.delete(msId);
      return n;
    });
  }, []);

  const handleToggle = useCallback(async (ms: Milestone) => {
    const wasCompleted = completedIds.has(ms.id);
    // Optimistic update
    setCompletedIds((prev) => {
      const n = new Set(prev);
      wasCompleted ? n.delete(ms.id) : n.add(ms.id);
      return n;
    });
    setLoading(ms.id, true);
    try {
      const res = await toggleMilestoneProgress(guildId, ms.id, !wasCompleted, altPseudo);
      if (!(res as any).success) {
        // Revert
        setCompletedIds((prev) => {
          const n = new Set(prev);
          wasCompleted ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      } else {
        toast.success(wasCompleted ? "Étape décochée" : "✅ Étape validée !", { duration: 1500 });
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(ms.id, false);
    }
  }, [completedIds, guildId, altPseudo, setLoading]);

  const handleValidateAll = useCallback(async (ms: Milestone) => {
    setCompletedIds((prev) => new Set([...prev, ms.id]));
    setLoading(ms.id, true);
    try {
      const res = await validateEntireMilestone(guildId, ms.id, altPseudo);
      if ((res as any).success) {
        toast.success(`🎉 Bloc "${ms.title}" validé !`, {
          description: "Toutes les étapes ont été marquées comme complétées.",
          duration: 3000,
        });
      } else {
        setCompletedIds((prev) => { const n = new Set(prev); n.delete(ms.id); return n; });
        toast.error("Erreur de validation");
      }
    } catch {
      setCompletedIds((prev) => { const n = new Set(prev); n.delete(ms.id); return n; });
      toast.error("Erreur réseau");
    } finally {
      setLoading(ms.id, false);
    }
  }, [guildId, altPseudo, setLoading]);

  const handleReset = useCallback(async (ms: Milestone) => {
    setCompletedIds((prev) => { const n = new Set(prev); n.delete(ms.id); return n; });
    setLoading(ms.id, true);
    try {
      await resetMilestoneProgress(guildId, ms.id, altPseudo);
      toast.success("Progression réinitialisée");
    } catch {
      setCompletedIds((prev) => new Set([...prev, ms.id]));
      toast.error("Erreur reset");
    } finally {
      setLoading(ms.id, false);
    }
  }, [guildId, altPseudo, setLoading]);

  const handleBookmark = useCallback(async (ms: Milestone) => {
    const isCurrentlyBookmarked = bookmarkedMsId === ms.id;
    const newBookmark = isCurrentlyBookmarked ? null : ms.id;
    setBookmarkedMsId(newBookmark);
    try {
      await updateBookmarkedStep(guildId, ms.id, isCurrentlyBookmarked ? null : `bookmark-${ms.id}`);
    } catch {
      // non-critical, don't revert
    }
  }, [bookmarkedMsId, guildId]);

  // ── Under Construction overlay ───────────────────────────────────────────────

  if (guide.isUnderConstruction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8">
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20"
        >
          <Construction className="w-12 h-12 text-amber-400" />
        </motion.div>
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-black text-white mb-2">En construction 🚧</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Le staff est en train de préparer ce guide. Reviens bientôt !
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`footer, .site-footer, .app-footer, nav[class*="footer"] { display: none !important; }`}</style>
    <div className="flex flex-col gap-6">

      {/* ── Bouton Retour au Hub ── */}
      <Link
        href={`/dashboard/${guildId}/quetes-dofus`}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors self-start group"
      >
        <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
        Retour au Hub
      </Link>

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-zinc-950">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none rounded-full" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60">
                  Guide Rush — Timeline
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">{guide.name}</h2>
              {guide.description && (
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-xl">{guide.description}</p>
              )}
            </div>

            {/* Active Character status & alignment details */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Personnage Actif</p>
                  <p className="text-xs font-bold text-white">{selectedCharacter}</p>
                </div>
              </div>

              {resolvedCharacterInfo.alignment && (
                <div className="h-6 w-px bg-white/10 hidden sm:block" />
              )}

              {resolvedCharacterInfo.alignment && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
                      resolvedCharacterInfo.alignment === "bontarien"
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}
                  >
                    {resolvedCharacterInfo.alignment} {resolvedCharacterInfo.alignmentLevel > 0 ? `lv.${resolvedCharacterInfo.alignmentLevel}` : ""}
                  </span>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {/* Reset Progress for THIS character */}
                <button
                  onClick={async () => {
                    if (confirm(`Voulez-vous vraiment réinitialiser la progression complète du Rush pour ${selectedCharacter} ?`)) {
                      try {
                        const { resetGuideProgress } = await import("@/server/actions/optimized-guide-actions");
                        await resetGuideProgress(guildId, guide.id, altPseudo);
                        setCompletedIds(new Set());
                        toast.success(`Progression de ${selectedCharacter} réinitialisée !`);
                        router.refresh();
                      } catch {
                        toast.error("Erreur lors de la réinitialisation");
                      }
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all cursor-pointer"
                  title="Remettre à zéro la progression pour ce personnage"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Perso
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Progression
                </span>
                <span className="text-sm font-black text-white">{overallPercent}%</span>
                <span className="text-[10px] text-zinc-600">({completedCount}/{totalMs})</span>
              </div>
              {activeMembersCount > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-400">
                    {activeMembersCount} membre{activeMembersCount > 1 ? "s" : ""} actif{activeMembersCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
            {/* Global progress bar */}
            <div className="h-1.5 bg-white/5 rounded-full max-w-xs">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${overallPercent}%`,
                  background: "linear-gradient(90deg, #10b981, #34d399)",
                  boxShadow: overallPercent > 0 ? "0 0 8px rgba(16,185,129,0.5)" : undefined,
                }}
              />
            </div>
          </div>
          {/* Dofus Sylvestre icon */}
          <div className="flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/module-dofus/Dofus_Sylvestre.png" alt="Dofus Sylvestre" className="w-14 h-14 object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform duration-500" />
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Hide done toggle */}
        <button
          onClick={() => setHideDone((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            hideDone
              ? "bg-zinc-800 border-white/20 text-white"
              : "bg-zinc-950/60 border-white/8 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {hideDone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {hideDone ? "Afficher tout" : "Masquer le fait"}
        </button>

        {/* Active members badge */}
        {guildProgress.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Users className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              Guilde active
            </span>
          </div>
        )}
      </div>

      {/* ── Dofus progress bars ── */}
      <DofusProgressBar
        milestones={milestones}
        completedIds={completedIds}
        activeFilter={dofusFilter}
        onFilterChange={setDofusFilter}
      />

      {/* ── Timeline chapters ── */}
      {milestones.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 font-black uppercase text-xs tracking-widest">
            Aucun objectif dans ce guide
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {chapters.map(([chNum, { label, items }], idx) => (
            <div key={chNum} className="space-y-4">
              {/* Séparateur de chapitre doré et nommé */}
              {idx > 0 && (
                <div className="flex items-center justify-center gap-4 py-4 my-2 select-none">
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-500/25 to-transparent flex-1" />
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/40 flex items-center gap-1.5 italic font-mono">
                    ✦ Chapitre {chNum} ✦
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-500/25 to-transparent flex-1" />
                </div>
              )}
              <ChapterBlock
                chapterNum={chNum}
                label={label}
                milestones={items}
                completedIds={completedIds}
                bookmarkedMsId={bookmarkedMsId}
                guildProgressByMs={guildProgressByMs}
                hideDone={hideDone}
                loadingIds={loadingIds}
                dofusFilter={dofusFilter}
                userAlignmentInfo={resolvedCharacterInfo}
                onToggle={handleToggle}
                onValidateAll={handleValidateAll}
                onReset={handleReset}
                onBookmark={handleBookmark}
                onDungeonClick={handleDungeonClick}
                onLinkClick={handleQuestLinkClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── DJ Post Modal ── */}
      <DjPostCreateModal
        guildId={guildId}
        isOpen={djModal.open}
        initialDungeonId={djModal.dungeonId}
        initialQuestName={djModal.questName}
        isDiscordConfigured={guide.isDiscordConfigured}
        onClose={() => setDjModal({ open: false })}
        onCreated={() => setDjModal({ open: false })}
      />

      {/* ── Mini Modale de Choix de Lien (DofusDB / DofusNoobs) ── */}
      <AnimatePresence>
        {linkSelectorModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setLinkSelectorModal({ open: false })}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs p-5 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Consulter la quête</p>
                  <h3 className="text-sm font-black text-white leading-tight">{linkSelectorModal.title}</h3>
                </div>
                <button onClick={() => setLinkSelectorModal({ open: false })} className="p-1.5 text-zinc-600 hover:text-white transition-colors flex-shrink-0 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Link options */}
              <div className="space-y-2">
                {linkSelectorModal.noobsUrl && (
                  <a
                    href={linkSelectorModal.noobsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setLinkSelectorModal({ open: false })}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-cyan-500/10 border border-white/8 hover:border-cyan-500/30 rounded-xl transition-all group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32"
                      alt="DofusPourLesNoobs"
                      className="w-6 h-6 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white">DofusPourLesNoobs</p>
                      <p className="text-[10px] text-zinc-500 truncate">dofuspourlesnoobs.com</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                  </a>
                )}
                {linkSelectorModal.dbUrl && (
                  <a
                    href={linkSelectorModal.dbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setLinkSelectorModal({ open: false })}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-emerald-500/10 border border-white/8 hover:border-emerald-500/30 rounded-xl transition-all group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32"
                      alt="DofusDB"
                      className="w-6 h-6 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white">DofusDB</p>
                      <p className="text-[10px] text-zinc-500 truncate">dofusdb.fr</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </>
  );
}
