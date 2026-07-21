"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, ChevronUp,
  BookOpen, Flag, Users, RotateCcw, EyeOff, Eye, ExternalLink,
  Bookmark, BookmarkCheck, Zap, Loader2, CheckCheck, ArrowRight, ArrowUp,
  Sparkles, Construction, AlertTriangle, Sword, Gem, X, Lock, ShieldAlert, UserCheck, MapPin, Plus
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import { RushOnboardingWizardModal } from "@/components/dofus-quests/RushOnboardingWizardModal";
import {
  toggleMilestoneProgress,
  validateEntireMilestone,
  resetMilestoneProgress,
  updateBookmarkedStep,
  updateStepProgress,
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
  | "metier"
  | "solver";

type ActivityTag = { type: ActivityTagType; name?: string; level?: number; count?: number; color?: string; url?: string };

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
    dofusClass?: string | null;
    metamobPseudo?: string | null;
    pseudoDofus?: string | null;
  };
  ocreStats?: {
    bosses?: { total: number; gathered: number };
    archis?: { total: number; gathered: number };
    progressPercent?: number;
    currentStep?: number;
    serverName?: string;
  } | null;
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
  { id: "des_veilleurs",    label: "Des Veilleurs",      color: "#38bdf8", imageUrl: "/module-dofus/Dofus_Veilleur.png" },
  { id: "domakuro",         label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  { id: "dorigami",         label: "Dorigami",           color: "#f472b6", imageUrl: "/module-dofus/Dofus_Dorigami.png" },
  { id: "tachete",          label: "Tacheté",            color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tacheté.png" },
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

// ─── Tougli Callout Component ──────────────────────────────────────────────────
function TougliCallout({ text, colorStyle = "emerald" }: { text: string; colorStyle?: string }) {
  const isPurple = colorStyle === "purple";
  const isAmber = colorStyle === "amber";

  const borderColor = isPurple ? "border-purple-500" : isAmber ? "border-amber-500" : "border-emerald-500";
  const bgGradient = isPurple
    ? "from-purple-950/50 via-zinc-950 to-zinc-950"
    : isAmber
    ? "from-amber-950/50 via-zinc-950 to-zinc-950"
    : "from-emerald-950/50 via-zinc-950 to-zinc-950";
  const iconColor = isPurple ? "text-purple-400" : isAmber ? "text-amber-400" : "text-emerald-400";
  const linkColor = isPurple
    ? "text-purple-300 hover:text-purple-200 decoration-purple-500/50"
    : isAmber
    ? "text-amber-300 hover:text-amber-200 decoration-amber-500/50"
    : "text-emerald-300 hover:text-emerald-200 decoration-emerald-500/50";

  const parts = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] && match[2]) {
      const label = match[1];
      const url = match[2];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors ${linkColor}`}
        >
          {label}
          <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-80 shrink-0" />
        </a>
      );
    } else if (match[3]) {
      const rawUrl = match[3];
      let displayLabel = rawUrl;
      if (rawUrl.includes("dofusdb.fr")) displayLabel = "Lien DofusDB ↗";
      else if (rawUrl.includes("dofuspourlesnoobs.com")) displayLabel = "Lien DofusNoobs ↗";
      parts.push(
        <a
          key={match.index}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors ${linkColor}`}
        >
          {displayLabel}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-2xl border-l-4 ${borderColor} bg-gradient-to-r ${bgGradient} border border-y-white/5 border-r-white/5 shadow-md my-2`}>
      <div className="mt-0.5 shrink-0">
        {isPurple ? (
          <span className="text-base leading-none">👿</span>
        ) : isAmber ? (
          <span className="text-base leading-none">💡</span>
        ) : (
          <span className={`font-black text-base leading-none ${iconColor}`}>!</span>
        )}
      </div>
      <div className="text-xs text-zinc-200 leading-relaxed font-medium">
        {parts}
      </div>
    </div>
  );
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
  completedStepsSet,
  isBookmarked,
  membersHere,
  hideDone,
  isLoading,
  accentColor,
  userAlignmentInfo,
  onToggle,
  onToggleSequence,
  onValidateAll,
  onReset,
  onBookmark,
  onDungeonClick,
  onLinkClick,
}: {
  ms: Milestone;
  isCompleted: boolean;
  completedStepsSet: Set<string>;
  isBookmarked: boolean;
  membersHere: GuildMemberProgress[];
  hideDone: boolean;
  isLoading: boolean;
  accentColor: string;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  onToggle: () => void;
  onToggleSequence: (ms: Milestone, seqId: string) => void;
  onValidateAll: () => void;
  onReset: () => void;
  onBookmark: () => void;
  onDungeonClick: (dungeonId: string, questName: string) => void;
  onLinkClick: (questName: string, dbUrl?: string | null, noobsUrl?: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isInfoBlock = ms.type === "INFO";
  if (isInfoBlock) {
    const textToRender = ms.tips || ms.description || ms.title;
    return (
      <div className="my-2 ml-2">
        <TougliCallout text={textToRender} colorStyle="emerald" />
      </div>
    );
  }

  // Auto-expand bookmarked milestone
  useEffect(() => {
    if (isBookmarked) setExpanded(true);
  }, [isBookmarked]);

  if (hideDone && isCompleted) return null;

  const completedSeqCount = ms.sequences.filter(s => isCompleted || completedStepsSet.has(s.id)).length;

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
            ) : completedSeqCount > 0 ? (
              <CheckCircle2 className="w-5 h-5 text-amber-400/80" />
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

          {/* Sequences count / progress indicator */}
          {ms.sequences.length > 0 && (
            <span className={`text-[9px] font-black flex-shrink-0 px-2 py-0.5 rounded-full border transition-all ${
              completedSeqCount === ms.sequences.length || isCompleted
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : completedSeqCount > 0
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-zinc-800 border-white/5 text-zinc-500"
            }`}>
              {completedSeqCount}/{ms.sequences.length} quête{ms.sequences.length > 1 ? "s" : ""}
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
                    {ms.sequences
                      .filter((seq) => !(hideDone && (isCompleted || completedStepsSet.has(seq.id))))
                      .map((seq) => (
                      <SequenceRow 
                        key={seq.id} 
                        seq={seq} 
                        accentColor={accentColor} 
                        userAlignmentInfo={userAlignmentInfo}
                        isSeqCompleted={isCompleted || completedStepsSet.has(seq.id)}
                        onToggleSeq={() => onToggleSequence(ms, seq.id)}
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
  isSeqCompleted,
  onToggleSeq,
  onDungeonClick,
  onLinkClick,
}: {
  seq: Sequence;
  accentColor: string;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  isSeqCompleted?: boolean;
  onToggleSeq?: () => void;
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

  const isInfoBlock = seq.activityTags?.some((t: any) => t.type === "is_info_block");
  if (isInfoBlock) {
    const tougliTag = seq.activityTags?.find((t: any) => t.type === "tougli_box");
    const textToRender = tougliTag?.name || seq.note || seq.tips || seq.subGuideName || seq.subGuideRef;
    const colorToUse = tougliTag?.color || "emerald";

    return (
      <div className="py-0.5">
        <TougliCallout text={textToRender} colorStyle={colorToUse} />
      </div>
    );
  }

  // Determine row colors based on content type with high contrast
  let bgClass = isSeqCompleted 
    ? "bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_2px_10px_rgba(16,185,129,0.05)]" 
    : "bg-zinc-900/90 border-white/10 hover:border-white/20 hover:bg-zinc-800/90 shadow-md";
  let themeAccent = accentColor;
  
  if (!isSeqCompleted) {
    if (seq.isSuccess) {
      bgClass = "bg-orange-950/30 border-orange-500/35 hover:border-orange-500/60 hover:bg-orange-900/40 shadow-[0_2px_12px_rgba(249,115,22,0.08)]";
      themeAccent = "#f97316"; // Orange for success/achievement
    } else if (hasDungeons) {
      bgClass = "bg-red-950/30 border-red-500/35 hover:border-red-500/60 hover:bg-red-900/40 shadow-[0_2px_12px_rgba(239,68,68,0.08)]";
      themeAccent = "#ef4444";
    } else if (seq.isOptional) {
      bgClass = "bg-purple-950/30 border-purple-500/35 hover:border-purple-500/60 hover:bg-purple-900/40 shadow-[0_2px_12px_rgba(168,85,247,0.08)]";
      themeAccent = "#a855f7";
    } else if (hasAlignment) {
      if (seq.alignReq === "bontarien") {
        bgClass = "bg-blue-950/30 border-blue-500/35 hover:border-blue-500/60 hover:bg-blue-900/40 shadow-[0_2px_12px_rgba(59,130,246,0.08)]";
        themeAccent = "#3b82f6";
      } else if (seq.alignReq === "brakmarien") {
        bgClass = "bg-red-950/30 border-red-500/35 hover:border-red-500/60 hover:bg-red-950/40 shadow-[0_2px_12px_rgba(239,68,68,0.08)]";
        themeAccent = "#ef4444";
      }
    }
  }

  return (
    <div 
      onClick={hasAnyLink ? () => onLinkClick(questName, dbUrl, noobsUrl) : undefined}
      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all ${bgClass} ${
        hasAnyLink ? "group cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Checkbox pour cocher la quête/étape individuellement */}
        {onToggleSeq && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSeq();
            }}
            className="flex-shrink-0 mt-0.5 p-0.5 rounded text-zinc-500 hover:text-emerald-400 transition-colors"
            title={isSeqCompleted ? "Décocher cette quête" : "Cocher cette quête comme faite"}
          >
            {isSeqCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
            ) : (
              <Circle className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
            )}
          </button>
        )}

        {/* Left: donjon avatar button / bullet */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
          {hasDungeons ? (
            allDungeons.map((dj) => (
              <button
                key={dj.id}
                onClick={(e) => { e.stopPropagation(); onDungeonClick(dj.id, questName); }}
                title={`Créer un post DJ pour le donjon ${dj.name}`}
                className="group/dj relative p-0.5 rounded-xl border border-white/10 hover:border-amber-500/50 bg-zinc-900/80 transition-all hover:scale-105 shadow-md flex items-center gap-1.5 pr-2"
              >
                {dj.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dj.imageUrl}
                    alt={dj.bossName}
                    className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Sword className="w-4 h-4 text-amber-400" />
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-[10px] font-black text-amber-300 leading-tight flex items-center gap-1">
                    {dj.name}
                    <Plus className="w-3 h-3 text-amber-400 group-hover/dj:scale-125 transition-transform" />
                  </div>
                  <span className="text-[7.5px] text-zinc-400 font-bold uppercase tracking-wider">Sortie DJ +</span>
                </div>
              </button>
            ))
          ) : (
            <div className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: themeAccent }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-black tracking-tight leading-tight group-hover:text-white transition-colors ${
              isSeqCompleted ? "line-through text-zinc-400 opacity-70" : "text-white"
            }`}>
              {questName}
            </span>
            
            {/* Badge Dofus spécifique à cette quête */}
            {(() => {
              const dofusTag = seq.activityTags?.find((t: any) => t.type === "dofus_link");
              if (!dofusTag?.name) return null;
              const def = DOFUS_DEFS.find(d => d.id === dofusTag.name);
              if (!def) return null;
              return (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest animate-pulse shadow-md"
                  style={{ borderColor: def.color + "60", background: def.color + "25", color: def.color, boxShadow: `0 0 10px ${def.color}35` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={def.imageUrl} alt={def.label} className="w-4.5 h-4.5 object-contain" />
                  {def.label}
                </span>
              );
            })()}

            {/* Badge Prérequis de la quête */}
            {(() => {
              const prereqTag = seq.activityTags?.find((t: any) => t.type === "prereq_text");
              if (!prereqTag?.name) return null;
              return (
                <span
                  className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                  title={`Prérequis de cette quête : ${prereqTag.name}`}
                >
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  Requis : {prereqTag.name}
                </span>
              );
            })()}

            {/* Donjon badge(s) cliquables pour créer un post DJ */}
            {hasDungeons && (
              allDungeons.map((dj) => {
                const isDjOcre = seq.activityTags?.some((t: any) => t.type === "ocre_dungeon" && t.name === dj.id) || (allDungeons.length === 1 && !!seq.metamobMonsterId);
                return (
                  <button
                    key={dj.id}
                    onClick={(e) => { e.stopPropagation(); onDungeonClick(dj.id, questName); }}
                    title={`Créer un post DJ pour ${dj.name}`}
                    className={`flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all hover:scale-105 cursor-pointer ${
                      isDjOcre
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                        : "bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25"
                    }`}
                  >
                    {isDjOcre ? (
                      <img src="/assets/icons/ocre.png" alt="Ocre" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
                    ) : (
                      <Sword className="w-3 h-3 flex-shrink-0 text-red-400" />
                    )}
                    <span>{dj.name}</span>
                    {isDjOcre && <span className="text-[7.5px] text-amber-300 font-extrabold ml-0.5">(À CAPTURER)</span>}
                    <span className="ml-1 px-1 py-0.5 bg-black/40 rounded text-[7px] text-amber-400 font-bold border border-amber-500/30">+ SORTIE DJ</span>
                  </button>
                );
              })
            )}

            {stepRange && <span className="text-[9px] text-zinc-500 font-mono">{stepRange}</span>}
            {seq.isOptional && (
              <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Bonus</span>
            )}
            {/* Badge Succès */}
            {seq.isSuccess && (
              <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/icons/succes.png" alt="succès" className="w-3.5 h-3.5 object-contain" />
                Succès
              </span>
            )}
            {/* Badge Ocre global s'il n'y a pas de donjon spécifique mais qu'il est coché */}
            {seq.metamobMonsterId && !hasDungeons && (
              <span
                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
                title="À capturer pour la quête du Dofus Ocre"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/icons/ocre.png" alt="Ocre" className="w-3.5 h-3.5 object-contain" />
                À capturer (Ocre)
              </span>
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

            {/* Positions GPS cliquables */}
            {(() => {
              const posTag = seq.activityTags?.find((t: any) => t.type === "pos_tags");
              if (!posTag?.name) return null;
              const matches = posTag.name.match(/\[?\s*-?\d+\s*,\s*-?\d+\s*\]?/g) || [posTag.name];
              return matches.map((posStr: string, pIdx: number) => {
                const cleanPos = posStr.trim();
                return (
                  <button
                    key={pIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(cleanPos);
                      toast.success(`Position ${cleanPos} copiée dans le presse-papier !`, {
                        icon: "📍",
                        duration: 2000,
                      });
                    }}
                    className="flex items-center gap-1 text-[9.5px] font-mono font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 hover:scale-105 transition-all cursor-pointer shadow-sm"
                    title="Cliquer pour copier la position dans le presse-papier"
                  >
                    <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                    {cleanPos}
                  </button>
                );
              });
            })()}

            {/* Rendu des tags d'activité réels (GRANDES ICÔNES w-7 h-7) */}
            {Array.isArray(seq.activityTags) && seq.activityTags
              .filter((tag: any) => tag.type !== "ocre_dungeon" && tag.type !== "dofus_link" && tag.type !== "prereq_text" && tag.type !== "pos_tags" && tag.type !== "tougli_box")
              .map((tag, idx) => {
              const isSolver = tag.type === "solver";
              if (isSolver) {
                const solverUrl = tag.url || null;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      if (solverUrl) {
                        e.stopPropagation();
                        window.open(solverUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    title={solverUrl ? `Ouvrir le Solver : ${solverUrl}` : "Solver requis"}
                    className={`flex items-center gap-2 text-[9.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-md transition-all ${
                      solverUrl ? "hover:bg-emerald-500/30 hover:scale-105 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/rush-sylvestre/solver.png" alt="Solver" className="w-7 h-7 object-cover rounded-full overflow-hidden shrink-0 border border-emerald-400/40 bg-zinc-950 p-0.5" />
                    <span>Solver</span>
                    {solverUrl && <ExternalLink className="w-3 h-3 text-emerald-400 ml-0.5 shrink-0" />}
                  </button>
                );
              }

              const def = ACTIVITY_TAGS.find(d => d.type === tag.type);
              if (!def) return null;
              const isMetier = tag.type === "metier";
              const iconPath = isMetier ? getMetierIconPath(tag.name) : def.imagePath;
              const label = isMetier && tag.name ? `${tag.name} (Niv. ${tag.level ?? 1})` : def.label;
              return (
                <span
                  key={idx}
                  title={label}
                  className="flex items-center gap-2 text-[9.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-zinc-900/90 text-zinc-100 border border-white/10 shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconPath} alt={def.label} className="w-7 h-7 object-cover rounded-full overflow-hidden shrink-0 border border-white/20 bg-zinc-950 p-0.5" />
                  {tag.count && tag.count > 1 && <span className="text-amber-400 font-mono text-[10px] font-black">x{tag.count}</span>}
                  {isMetier && tag.name && <span>{tag.name} {tag.level ? `Niv.${tag.level}` : ""}</span>}
                  {!isMetier && <span>{def.label}</span>}
                </span>
              );
            })}
          </div>

          {/* Mini bloc Conseil / Tips Style Tougli */}
          {(() => {
            const tougliTag = seq.activityTags?.find((t: any) => t.type === "tougli_box");
            if (!tougliTag?.name) return null;
            return <TougliCallout text={tougliTag.name} colorStyle={tougliTag.color || "emerald"} />;
          })()}

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
            <img src="/assets/icons/succes.png" alt="succès" className="w-5 h-5 object-contain" />
          </div>
        )}
        {/* Metamob/Ocre icon */}
        {seq.metamobMonsterId && (
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0"
            title="À capturer pour la quête du Dofus Ocre"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/ocre.png" alt="Ocre" className="w-5 h-5 object-contain" />
          </div>
        )}
        {/* Favicons des sites (si liens disponibles) avec libellés */}
        {hasAnyLink && (
          <div className="flex items-center gap-1.5">
            {noobsUrl && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/90 text-cyan-300 border border-cyan-500/25 group-hover:border-cyan-400/50 transition-all text-[9px] font-black uppercase tracking-wider shadow-sm" title="Ouvrir le guide DofusPourLesNoobs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32"
                  alt="Noobs"
                  className="w-4 h-4 rounded-sm shrink-0"
                />
                <span className="hidden sm:inline">DofusNoobs</span>
              </span>
            )}
            {dbUrl && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/90 text-emerald-300 border border-emerald-500/25 group-hover:border-emerald-400/50 transition-all text-[9px] font-black uppercase tracking-wider shadow-sm" title="Ouvrir la fiche DofusDB">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32"
                  alt="DofusDB"
                  className="w-4 h-4 rounded-sm shrink-0"
                />
                <span className="hidden sm:inline">DofusDB</span>
              </span>
            )}
            <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 group-hover:text-zinc-200 flex-shrink-0">
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
  completedStepsByMs,
  bookmarkedMsId,
  guildProgressByMs,
  hideDone,
  loadingIds,
  dofusFilter,
  userAlignmentInfo,
  onToggle,
  onToggleSequence,
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
  completedStepsByMs: Map<string, Set<string>>;
  bookmarkedMsId: string | null;
  guildProgressByMs: Map<string, GuildMemberProgress[]>;
  hideDone: boolean;
  loadingIds: Set<string>;
  dofusFilter: string | null;
  userAlignmentInfo: { alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number };
  onToggle: (ms: Milestone) => void;
  onToggleSequence: (ms: Milestone, seqId: string) => void;
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
            <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-amber-400/80 text-xs">✦</span>
              {label}
              <span className="text-amber-400/80 text-xs">✦</span>
            </span>
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
                  completedStepsSet={completedStepsByMs.get(ms.id) || new Set()}
                  isBookmarked={ms.id === bookmarkedMsId}
                  membersHere={guildProgressByMs.get(ms.id) || []}
                  hideDone={hideDone}
                  isLoading={loadingIds.has(ms.id)}
                  onToggle={() => onToggle(ms)}
                  onToggleSequence={onToggleSequence}
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
  ocreStats,
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

  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    milestones.forEach((ms) => {
      const raw = ms.playerProgress?.[0]?.completedSteps;
      const stepsArray = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : []);
      map.set(ms.id, new Set(stepsArray));
    });
    return map;
  });

  // Re-sync local state when milestones prop changes
  useEffect(() => {
    const nextCompletedIds = new Set<string>();
    const nextStepsMap = new Map<string, Set<string>>();
    milestones.forEach((ms) => {
      if (ms.playerProgress?.[0]?.isCompleted) {
        nextCompletedIds.add(ms.id);
      }
      const raw = ms.playerProgress?.[0]?.completedSteps;
      const stepsArray = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : []);
      nextStepsMap.set(ms.id, new Set(stepsArray));
    });
    setCompletedIds(nextCompletedIds);
    setCompletedStepsByMs(nextStepsMap);
  }, [milestones]);

  const [bookmarkedMsId, setBookmarkedMsId] = useState<string | null>(() => {
    for (const ms of milestones) {
      if (ms.playerProgress?.[0]?.currentStep) return ms.id;
    }
    return null;
  });

  const [hideDone, setHideDone] = useState(false);

  // Scroll to top listener state
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [dofusFilter, setDofusFilter] = useState<string | null>(null);

  // DJ Modal state
  const [djModal, setDjModal] = useState<{ open: boolean; dungeonId?: string; questName?: string }>({ open: false });

  // Link Selector Modal
  const [linkSelectorModal, setLinkSelectorModal] = useState<{ open: boolean; title?: string; noobsUrl?: string; dbUrl?: string }>({ open: false });

  // Onboarding Wizard Modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeMembersModalOpen, setActiveMembersModalOpen] = useState(false);

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

  const handleToggleSequence = useCallback(async (ms: Milestone, seqId: string) => {
    const currentStepsSet = new Set(completedStepsByMs.get(ms.id) || []);
    const wasChecked = currentStepsSet.has(seqId);

    if (wasChecked) {
      currentStepsSet.delete(seqId);
    } else {
      currentStepsSet.add(seqId);
    }

    const updatedStepsArray = Array.from(currentStepsSet);
    const allSeqIds = ms.sequences.map(s => s.id);
    const isAllChecked = allSeqIds.length > 0 && allSeqIds.every(id => currentStepsSet.has(id));

    // Optimistic updates
    setCompletedStepsByMs((prev) => {
      const next = new Map(prev);
      next.set(ms.id, currentStepsSet);
      return next;
    });

    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (isAllChecked) next.add(ms.id);
      else next.delete(ms.id);
      return next;
    });

    setLoading(ms.id, true);
    try {
      const res = await updateStepProgress(guildId, ms.id, updatedStepsArray, altPseudo);
      if ((res as any).success) {
        toast.success(wasChecked ? "Quête décochée" : "✅ Quête validée !", { duration: 1500 });
      } else {
        toast.error("Erreur de sauvegarde de la quête");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(ms.id, false);
    }
  }, [completedStepsByMs, guildId, altPseudo, setLoading]);

  const handleToggle = useCallback(async (ms: Milestone) => {
    const wasCompleted = completedIds.has(ms.id);
    // Optimistic update
    setCompletedIds((prev) => {
      const n = new Set(prev);
      wasCompleted ? n.delete(ms.id) : n.add(ms.id);
      return n;
    });
    setCompletedStepsByMs((prev) => {
      const next = new Map(prev);
      if (wasCompleted) {
        next.set(ms.id, new Set());
      } else {
        next.set(ms.id, new Set(ms.sequences.map(s => s.id)));
      }
      return next;
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
    setCompletedStepsByMs((prev) => {
      const next = new Map(prev);
      next.set(ms.id, new Set(ms.sequences.map(s => s.id)));
      return next;
    });
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
    setCompletedStepsByMs((prev) => {
      const next = new Map(prev);
      next.set(ms.id, new Set());
      return next;
    });
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

      {/* ── Bandeau d'attention — Niveau 200 conseillé ── */}
      <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.15)]">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-inner">
          <AlertTriangle className="w-5.5 h-5.5 text-amber-400 animate-pulse" />
        </div>
        <div className="space-y-0.5 min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-amber-400">
            ⚠️ Attention — Prérequis Recommandé
          </p>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Ce guide Rush Sylvestre est vivement conseillé dès le <strong className="text-white font-black underline decoration-amber-500/50">Niveau 200</strong> (ou avec un personnage fortement optimisé) pour effectuer le parcours sereinement.
          </p>
        </div>
      </div>

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

            {/* Active Character status & class preview & alignment details */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl max-w-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs shadow-inner">
                  {currentUserProfile?.dofusClass ? currentUserProfile.dofusClass.slice(0, 3).toUpperCase() : "LVL"}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Personnage Actif</p>
                    <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Niv. 200</span>
                  </div>
                  <p className="text-xs font-black text-white">{selectedCharacter} {currentUserProfile?.dofusClass ? `(${currentUserProfile.dofusClass})` : ""}</p>
                </div>
              </div>

              {resolvedCharacterInfo.alignment && (
                <div className="h-6 w-px bg-white/10 hidden sm:block" />
              )}

              {resolvedCharacterInfo.alignment && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-sm ${
                      resolvedCharacterInfo.alignment === "bontarien"
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                        : resolvedCharacterInfo.alignment === "brakmarien"
                        ? "bg-red-500/15 border-red-500/30 text-red-300"
                        : "bg-zinc-800 border-white/10 text-zinc-300"
                    }`}
                  >
                    <span>{resolvedCharacterInfo.alignment === "bontarien" ? "🔵 Bonta" : resolvedCharacterInfo.alignment === "brakmarien" ? "🔴 Brakmar" : "⚪ Neutre"}</span>
                    {resolvedCharacterInfo.alignmentLevel > 0 && <span className="font-mono text-amber-400">lv.{resolvedCharacterInfo.alignmentLevel}</span>}
                  </span>
                </div>
              )}

              {/* Metamob / Ocre Progress Stats Widget */}
              {ocreStats && (
                <>
                  <div className="h-6 w-px bg-white/10 hidden sm:block" />
                  <Link
                    href={`/dashboard/${guildId}/quete-ocre`}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:border-amber-400/50 transition-all group"
                    title="Voir les détails complets sur Metamob"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/icons/ocre.png" alt="Ocre" className="w-5 h-5 object-contain shrink-0" />
                    <div className="text-left text-[10px] leading-tight space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">Gardiens:</span>
                        <span className="font-mono font-black text-white">{ocreStats.bosses?.gathered ?? 0}/{ocreStats.bosses?.total ?? 51}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">Archis:</span>
                        <span className="font-mono font-black text-white">{ocreStats.archis?.gathered ?? 0}/{ocreStats.archis?.total ?? 286}</span>
                      </div>
                    </div>
                  </Link>
                </>
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
                <button
                  type="button"
                  onClick={() => setActiveMembersModalOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all cursor-pointer"
                  title="Voir le détail de l'avancée de chaque membre actif"
                >
                  <Users className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-400">
                    {activeMembersCount} membre{activeMembersCount > 1 ? "s" : ""} actif{activeMembersCount > 1 ? "s" : ""}
                  </span>
                </button>
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
                completedStepsByMs={completedStepsByMs}
                bookmarkedMsId={bookmarkedMsId}
                guildProgressByMs={guildProgressByMs}
                hideDone={hideDone}
                loadingIds={loadingIds}
                dofusFilter={dofusFilter}
                userAlignmentInfo={resolvedCharacterInfo}
                onToggle={handleToggle}
                onToggleSequence={handleToggleSequence}
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

      {/* Onboarding Wizard Modal */}
      <RushOnboardingWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        guildId={guildId}
        characters={[
          { id: "PRINCIPAL", name: currentUserProfile?.pseudoDofus || "Principal", isMule: false, dofusClass: currentUserProfile?.dofusClass },
          ...(mules || []).map((m: any) => ({
            id: m.pseudo,
            name: m.pseudo,
            isMule: true,
            dofusClass: m.classe,
          })),
        ]}
        selectedCharacter={selectedCharacter}
        onSelectCharacter={(charId) => {
          router.push(`?character=${encodeURIComponent(charId)}`);
        }}
        activeMembers={Array.from(
          new Map(
            guildProgress.map((p) => [
              p.profileId,
              {
                profileId: p.profileId,
                userName: p.userName,
                userAvatar: p.userAvatar,
                currentMilestoneTitle: milestones.find((m) => m.id === p.milestoneId)?.title,
                percent: Math.round(
                  (guildProgress.filter((x) => x.profileId === p.profileId && x.isCompleted).length / Math.max(1, milestones.length)) * 100
                ),
              },
            ])
          ).values()
        )}
        hasNoClassDeclared={!currentUserProfile?.dofusClass}
      />

      {/* Guild Active Members Modal */}
      <AnimatePresence>
        {activeMembersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Avancée de la Guilde</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMembersModalOpen(false)}
                  className="text-zinc-500 hover:text-white text-xs font-bold"
                >
                  Fermer
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {Array.from(
                  new Map(
                    guildProgress.map((p) => [
                      p.profileId,
                      {
                        profileId: p.profileId,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        currentMilestoneTitle: milestones.find((m) => m.id === p.milestoneId)?.title,
                        completedCount: guildProgress.filter((x) => x.profileId === p.profileId && x.isCompleted).length,
                      },
                    ])
                  ).values()
                ).map((m, idx) => {
                  const percent = Math.round((m.completedCount / Math.max(1, milestones.length)) * 100);
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-300 overflow-hidden shrink-0">
                          {m.userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" />
                          ) : (
                            m.userName[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{m.userName}</p>
                          <p className="text-[9.5px] text-zinc-400 truncate">{m.currentMilestoneTitle ? `Étape : ${m.currentMilestoneTitle}` : "Démarré"}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400">{percent}%</span>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-24 z-40 p-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] border border-emerald-300/40 transition-all hover:scale-110 flex items-center justify-center cursor-pointer group"
            title="Remonter tout en haut de la page"
          >
            <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
