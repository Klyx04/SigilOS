"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Square, ChevronDown, ChevronUp, ChevronLeft,
  BookOpen, Flag, Users, RotateCcw, EyeOff, Eye, ExternalLink,
  BookmarkCheck, Loader2, CheckCheck,
  Sparkles, Construction, AlertTriangle, Sword, Lock, MapPin, Plus,
  Pencil, Crown, ChevronRight, ListCollapse, Info, Check, Shield, Search, X, CircleHelp,
  Settings2, Ghost, Maximize2
} from "lucide-react";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import MapPositionPopover from "@/components/dofus-quests/MapPositionPopover";
import { RushOnboardingWizardModal } from "@/components/dofus-quests/RushOnboardingWizardModal";
import { ResetConfirmModal } from "@/components/dofus-quests/ResetConfirmModal";
import LiveActivityTicker from "@/components/dofus-quests/LiveActivityTicker";
import OcreProgressModal, { type OcreMonsterLite } from "@/components/dofus-quests/OcreProgressModal";
import { useGuidePresence } from "@/hooks/use-guide-presence";
import "./guide-styles.css";
import { linkOcreAccount } from "@/server/actions/ocre-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getClass, getAlignment, getAlignmentLevelSteps, ORDERS, ALIGNMENTS } from "@/lib/dofus-assets";
import { updateUserProfile, updateMuleAlignment } from "@/server/actions/profile-actions";
import {
  toggleMilestoneProgress,
  resetMilestoneProgress,
  updateBookmarkedStep,
  updateStepProgress,
} from "@/server/actions/optimized-guide-actions";
import { DofusProgressStrip } from "./DofusProgressStrip";
import { GuildStatusPanel } from "./GuildStatusPanel";
import { QuestGroupRenderer, useQuestGroups } from "./QuestGroup";
import { QuestFeedbackButton } from "@/components/dofus-quests/QuestFeedbackButton";
import { RushChapterSidebar } from "./RushChapterSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────
type DungeonRef = { id: string; name: string; bossName: string; imageUrl?: string|null };
type ActivityTag = { type: string; name?: string; level?: number; count?: number; color?: string; url?: string };
type Sequence = { id: string; subGuideRef: string; subGuideName: string; stepFrom?: number|null; stepTo?: number|null; note?: string|null; isOptional: boolean; order: number; dungeon?: DungeonRef|null; dungeons?: DungeonRef[]; dofusdbUrl?: string|null; dofuspourlesnoobsUrl?: string|null; tips?: string|null; alignReq?: string|null; alignOrderReq?: number|null; isSuccess?: boolean; icon?: string | null; metamobMonsterId?: number|null; activityTags?: ActivityTag[]; };
const ACTIVITY_TAGS: { type: string; imagePath: string; label: string; color: string }[] = [
  { type:"combat_tactique", imagePath:"/assets/rush-sylvestre/combat-tactique.png", label:"Combat Tactique", color:"#ef4444" },
  { type:"combat_vagues", imagePath:"/assets/rush-sylvestre/combat-vagues.png", label:"Combat à vagues", color:"#3b82f6" },
  { type:"songes", imagePath:"/assets/rush-sylvestre/songes.png", label:"Songes", color:"#8b5cf6" },
  { type:"combat_solo", imagePath:"/assets/rush-sylvestre/combat-solo.png", label:"Combat Solo", color:"#f43f5e" },
  { type:"combat_plusieurs", imagePath:"/assets/rush-sylvestre/combat-plusieurs.png", label:"Combat à plusieurs", color:"#a855f7" },
  { type:"contrainte_horaire", imagePath:"/assets/rush-sylvestre/contrainte-horaire.png", label:"Horaire Spec.", color:"#f59e0b" },
  { type:"donjon", imagePath:"/assets/rush-sylvestre/donjon.png", label:"Donjon requis", color:"#3b82f6" },
  { type:"plusieurs_personnes", imagePath:"/assets/rush-sylvestre/plusieurs-personnes.png", label:"Multi joueurs", color:"#10b981" },
  { type:"sort", imagePath:"/assets/rush-sylvestre/sort.png", label:"Sort requis", color:"#ec4899" },
  { type:"metier", imagePath:"/assets/rush-sylvestre/façonneur.png", label:"Métier requis", color:"#eab308" },
  { type:"solver", imagePath:"/assets/rush-sylvestre/solver.png", label:"Solver", color:"#10b981" },
];
function getMetierIconPath(m?:string){if(!m)return"/assets/rush-sylvestre/façonneur.png";return`/assets/rush-sylvestre/${m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ç/g,"c")}.png`;}
type Milestone = { id:string; title:string; subtitle?:string|null; description?:string|null; type:string; accentColor?:string|null; imageUrl?:string|null; chapter:number; chapterLabel:string; order:number; isOptional:boolean; tips?:string|null; dofusId?:string|null; sequences:Sequence[]; playerProgress?:{isCompleted:boolean;completedSteps?:any;currentStep?:string|null}[]; };
type GuildMemberProgress = { profileId:string; milestoneId:string; isCompleted:boolean; userName:string; userAvatar?:string; currentStep?:string|null };
type RushTimelineClientProps = { guide:{id:string;name:string;slug:string;description?:string|null;isUnderConstruction?:boolean;imageUrl?:string|null;isDiscordConfigured?:boolean}; milestones:Milestone[]; guildProgress:GuildMemberProgress[]; guildId:string; selectedCharacter?:string; mules?:any[]; currentUserProfile:{alignment?:string|null;alignmentOrder?:string|null;alignmentLevel?:number;altPseudos?:any[];dofusClass?:string|null;metamobPseudo?:string|null;pseudoDofus?:string|null;}; ocreStats?:{bosses?:{total:number;gathered:number};archis?:{total:number;gathered:number};progressPercent?:number;currentStep?:number;serverName?:string}|null; capturedOcreMonsterIds?:number[]; capturedMonsterNames?:string[]; ocreMonsters?:OcreMonsterLite[]; };
const DOFUS_DEFS = [
  { id:"ocre", label:"Ocre", color:"#f59e0b", imageUrl:"/assets/icons/ocre.png" }, { id:"turquoise", label:"Turquoise", color:"#06b6d4", imageUrl:"/module-dofus/Dofus_Turquoise.png" },
  { id:"argente", label:"Argenté", color:"#a1a1aa", imageUrl:"/module-dofus/Dofus_Argente.png" }, { id:"argente_scintillant", label:"Arg. Scintillant", color:"#c0c0c0", imageUrl:"/module-dofus/Dofus_Argente_Scintillant.png" },
  { id:"ebene", label:"Ébène", color:"#52525b", imageUrl:"/module-dofus/Dofus_Ebene.png" }, { id:"pourpre", label:"Pourpre", color:"#a855f7", imageUrl:"/module-dofus/Dofus_Pourpre.png" },
  { id:"ivoire", label:"Ivoire", color:"#e2e8f0", imageUrl:"/module-dofus/Dofus_Ivoire.png" }, { id:"emeraude", label:"Émeraude", color:"#10b981", imageUrl:"/module-dofus/Dofus_Emeraude.png" },
  { id:"dolmanax", label:"Dolmanax", color:"#ef4444", imageUrl:"/module-dofus/Dofus_Dolmanax.png" }, { id:"des_glaces", label:"Des Glaces", color:"#93c5fd", imageUrl:"/module-dofus/Dofus_Des_Glaces.png" },
  { id:"du_cauchemar", label:"Du Cauchemar", color:"#7c3aed", imageUrl:"/module-dofus/Dofus_Du_Cauchemar.png" }, { id:"des_veilleurs", label:"Des Veilleurs", color:"#38bdf8", imageUrl:"/module-dofus/Dofus_Veilleur.png" },
  { id:"domakuro", label:"Domakuro", color:"#84cc16", imageUrl:"/module-dofus/Dofus_Domakuro.png" }, { id:"dorigami", label:"Dorigami", color:"#f472b6", imageUrl:"/module-dofus/Dofus_Dorigami.png" },
  { id:"tachete", label:"Tacheté", color:"#c084fc", imageUrl:"/module-dofus/Dofus_Tacheté.png" }, { id:"dom_de_pin", label:"Dom de Pin", color:"#a3e635", imageUrl:"/module-dofus/Dom_De_Pin.png" },
];
function TougliCallout({text,colorStyle="emerald"}:{text:string;colorStyle?:string}){
  const isPurple = colorStyle === "purple", isAmber = colorStyle === "amber";
  const borderCol = isPurple ? "border-purple-500/40" : isAmber ? "border-amber-500/40" : "border-emerald-500/40";
  const bgFlat = isPurple ? "bg-purple-950/20" : isAmber ? "bg-amber-950/20" : "bg-emerald-950/20";
  const icon = isPurple ? "👿" : isAmber ? "💡" : "✨";
  const parts = renderContentWithCoords(text);

  return (
    <div className={`flex items-start gap-3 p-3 rounded-2xl border-l-4 ${borderCol} ${bgFlat} border border-y-white/5 border-r-white/5 my-2`}>
      <div className="mt-0.5 shrink-0 text-sm">{icon}</div>
      <div className="text-xs text-zinc-200 leading-relaxed font-medium">{parts}</div>
    </div>
  );
}

const MemberAvatars = memo(function MemberAvatars({ members, max = 5 }: { members: GuildMemberProgress[]; max?: number }) {
  if (!members.length) return null;
  const uniqueMembers = Array.from(new Map(members.map(m => [m.profileId || m.userName, m])).values());
  const s = uniqueMembers.slice(0, max), e = uniqueMembers.length - max;
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1">
        {s.map(m => (
          <div key={m.profileId} className="w-5 h-5 rounded-full border-2 border-zinc-950 overflow-hidden bg-indigo-900 flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-500/30" title={m.userName}>
            {m.userAvatar ? <img src={m.userAvatar} alt="" className="w-full h-full object-cover"/> : <span className="text-caption font-black text-indigo-300">{m.userName[0]?.toUpperCase()}</span>}
          </div>
        ))}
      </div>
      {e > 0 && <span className="text-caption font-black text-indigo-400">+{e}</span>}
    </div>
  );
});

// ─── DungeonGroup sub-component for multi-dungeon display ─────────────────────
const DungeonGroup = memo(function DungeonGroup({
  dungeons,
  capturedMonsterSet,
  capturedMonsterNames,
  activityTags,
  metamobMonsterId,
  questName,
  onDungeonClick,
}: {
  dungeons: DungeonRef[];
  capturedMonsterSet: Set<number>;
  capturedMonsterNames: string[];
  activityTags?: ActivityTag[];
  metamobMonsterId?: number|null;
  questName: string;
  onDungeonClick: (dungeonId: string, questName: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 2;
  const visible = showAll ? dungeons : dungeons.slice(0, maxVisible);
  const extra = dungeons.length - maxVisible;

  if (dungeons.length === 0) return null;

  const DungeonButton = ({ dj, compact = false }: { dj: DungeonRef; compact?: boolean }) => {
    const nameMatch = capturedMonsterNames.length > 0 && capturedMonsterNames.some(
      (n: any) => typeof n === 'string' && (
        (dj.name || '').toLowerCase().includes(n.toLowerCase()) ||
        (dj.bossName || '').toLowerCase().includes(n.toLowerCase())
      )
    );
    const captured = nameMatch || (capturedMonsterSet.size > 0 && !!metamobMonsterId && capturedMonsterSet.has(metamobMonsterId));
    const isOcreDungeon = Array.isArray(activityTags) && activityTags.some((t: any) => t.type === "ocre_dungeon" && t.name === dj.id);

    return (
      <button
        onClick={(e) => { e.stopPropagation(); onDungeonClick(dj.id, questName); }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all group hover:scale-[1.02] active:scale-[0.98] ${
          captured
            ? "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10"
            : "bg-red-500/10 border-red-500/25 hover:bg-red-500/20"
        } ${compact ? "shrink-0" : ""}`}
        title={`${dj.name}${captured ? " ✓ Déjà capturé (Metamob)" : ""}`}
      >
        {dj.imageUrl ? (
          <img src={dj.imageUrl} alt={dj.bossName || dj.name} className={`w-5 h-5 rounded-lg object-cover border flex-shrink-0 ${captured ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "border-white/10"}`} />
        ) : (
          <div className="w-5 h-5 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center"><Sword className="w-3 h-3 text-amber-400" /></div>
        )}
        <span className={`text-caption font-black ${captured ? "text-emerald-300" : "text-red-300"} ${compact ? "hidden sm:inline" : ""}`}>{dj.name}</span>
        {isOcreDungeon && !captured && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-caption font-black uppercase tracking-widest">
            <img src="/assets/icons/ocre.png" alt="" className="w-2.5 h-2.5 object-contain" />Ocre
          </span>
        )}
        {captured && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-caption font-black uppercase tracking-widest">
            {isOcreDungeon && (
              <img src="/module-dofus/Dofus_Ocre.png" alt="Ocre" className="w-3 h-3 object-contain" />
            )}
            <CheckCircle2 className="w-2.5 h-2.5" />Capturé
          </span>
        )}
        <Plus className="w-2.5 h-2.5 group-hover:scale-125 transition-transform shrink-0 text-amber-400" />
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map((dj) => (
        <DungeonButton key={dj.id} dj={dj} />
      ))}
      {extra > 0 && !showAll && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-zinc-700/50 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600/60 transition-all text-caption font-black uppercase tracking-widest"
          title="Voir tous les donjons"
        >
          <ListCollapse className="w-3 h-3" />+{extra}
        </button>
      )}
      {showAll && dungeons.length > maxVisible && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-zinc-700/50 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 transition-all text-caption font-black uppercase tracking-widest"
        >
          <ChevronUp className="w-3 h-3" />Réduire
        </button>
      )}
    </div>
  );
});

// ─── SequenceRow ──────────────────────────────────────────────────────────────
const SequenceRow = memo(function SequenceRow({ seq, ms, isSeqCompleted, focusedSeqId, accentColor, userAlignmentInfo, onToggleSeq, onDungeonClick, hideSeqCompleted }: {
  seq: Sequence; ms: Milestone; isSeqCompleted: boolean; focusedSeqId?: string|null; accentColor: string; userAlignmentInfo: any; onToggleSeq?: ()=>void; onDungeonClick: (dungeonId: string, questName: string)=>void; hideSeqCompleted?: boolean;
}) {
  const capturedMonsterSet=React.useContext(CapturedMonsterCtx);
  const capturedMonsterNames=React.useContext(CapturedMonsterNamesCtx);
  const scrollToPrereq=React.useContext(ScrollToPrereqCtx);
  const activeSeqId = React.useContext(ActiveSeqIdCtx);
  const nextSeqId = React.useContext(NextSeqIdCtx);
  const bookmarksByMs = React.useContext(BookmarkedSeqCtx);
  const onBookmarkSeq = React.useContext(OnBookmarkSeqCtx);
  const allCompletedSeqIds = React.useContext(AllCompletedSeqIdsCtx) as Set<string>;
  const allMilestones = React.useContext(AllMilestonesCtx) as Milestone[];
              const guildProgressBySeq = React.useContext(GuildProgressBySeqCtx) as Map<string,GuildMemberProgress[]>;
              const guildId = React.useContext(GuildIdCtx);
  const isActive = seq.id === activeSeqId && !isSeqCompleted;
  const isNext = seq.id === nextSeqId && !isSeqCompleted && !isActive;
  const isThisBookmarked = seq.id === (bookmarksByMs.get(ms.id) ?? null);
  // ─── Guild members with bookmark on this seq (pour l'affichage flottant) ──
  const seqMembers = useMemo(() => {
    const raw = guildProgressBySeq.get(seq.id) || [];
    return Array.from(new Map(raw.map(m => [m.profileId || m.userName, m])).values());
  }, [guildProgressBySeq, seq.id]);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [activeTagInfo, setActiveTagInfo] = useState<{ icon: string; label: string; name?: string; level?: number; count?: number } | null>(null);
  const maxFloatingAvatars = 5;
  const floatAvatars = seqMembers.slice(0, maxFloatingAvatars);
  const floatExtra = seqMembers.length - maxFloatingAvatars;
  const questName=seq.subGuideName||seq.subGuideRef||"Quête sans nom";
  const allDungeons=seq.dungeons&&seq.dungeons.length>0?seq.dungeons:(seq.dungeon?[seq.dungeon]:[]);
  const dbUrl=seq.dofusdbUrl, noobsUrl=seq.dofuspourlesnoobsUrl;
  const hasAlignment=!!(seq.alignReq&&seq.alignOrderReq);
  let isReqMet=false;let alignInfo:any=null;
  if(hasAlignment&&seq.alignReq&&seq.alignOrderReq){const ua=userAlignmentInfo.alignment?.toLowerCase(),uo=userAlignmentInfo.alignmentOrder?.toLowerCase(),ul=userAlignmentInfo.alignmentLevel??0;if(ua===seq.alignReq.toLowerCase()&&typeof uo==="string"&&ul>=seq.alignOrderReq)isReqMet=true;const ad=getAlignment(seq.alignReq);alignInfo={label:ad?.name||seq.alignReq,met:isReqMet};}

  const prereqBlocked = !isSeqCompleted && (() => {
    const prereqNames = Array.isArray(seq.activityTags) ? seq.activityTags.filter((x:any)=>x.type==="prereq_text").map((x:any)=>x.name?.toLowerCase()) : [];
    if (prereqNames.length === 0) return false;
    return allMilestones.some((candidateMs) =>
      candidateMs.type !== "SEPARATEUR" &&
      candidateMs.type !== "INFO" &&
      candidateMs.sequences.some((candidateSeq) => {
        if (candidateSeq.id === seq.id) return false;
        const candidateName = (candidateSeq.subGuideName || candidateSeq.subGuideRef || "").toLowerCase();
        return prereqNames.includes(candidateName) && !allCompletedSeqIds.has(candidateSeq.id);
      })
    );
  })();

  if (prereqBlocked) {
    const prereqTags = (Array.isArray(seq.activityTags) ? seq.activityTags.filter((x:any)=>x.type==="prereq_text") : []);
    const totalPrereqs = prereqTags.length;
    const singleName = totalPrereqs === 1 ? prereqTags[0]?.name : null;
    return (
      <div data-seq-id={seq.id} className={`rounded-2xl border transition-all bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-400/50 scroll-mt-24 ${focusedSeqId===seq.id?"ring-2 ring-emerald-400/70 border-emerald-400/60":""}`}>
        <div className="px-3 pt-2 pb-0">
          <p className="text-caption font-bold text-zinc-300 truncate">{questName}</p>
        </div>
        {totalPrereqs === 1 && singleName ? (
          <button type="button" onClick={e=>{e.stopPropagation();scrollToPrereq(singleName);}}
            className="w-full flex items-center gap-3 px-3 pb-3 pt-1.5 text-left group focus-visible:outline-2 focus-visible:outline-amber-400/50 rounded-2xl"
            aria-label={`Voir la quête requise : ${singleName}`}
            data-tour="quest-prerequisite"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-caption font-black uppercase tracking-widest text-amber-400/70 mb-0.5">À terminer avant</p>
              <p className="text-caption font-bold text-amber-200 truncate">{singleName}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400/50 group-hover:text-amber-400/80 transition-colors shrink-0" />
          </button>
        ) : (
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
              </div>
              <p className="text-caption font-black uppercase tracking-widest text-amber-400/70">{totalPrereqs} prérequis à terminer</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {prereqTags.map((t:any,i:number)=>(
                <button key={i} type="button" onClick={e=>{e.stopPropagation();scrollToPrereq(t.name||"");}}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-caption font-bold text-amber-300 bg-amber-500/[0.08] border border-amber-500/20 hover:bg-amber-500/[0.15] hover:border-amber-400/40 transition-all group focus-visible:outline-2 focus-visible:outline-amber-400/50"
                  aria-label={`Voir la quête requise : ${t.name}`}
                >
                  <span className="truncate max-w-[140px]">{t.name}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-amber-400/50 group-hover:text-amber-400/80 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        data-seq-id={seq.id}
        tabIndex={0}
        className={`group relative flex flex-col gap-0 rounded-xl border transition-all scroll-mt-24 overflow-hidden
          ${isSeqCompleted
            ? "bg-zinc-950/30 border-white/5 opacity-45"
            : isThisBookmarked
              ? "bg-zinc-900/50 border-white/10 border-l-2 border-l-amber-400/70"
              : isNext
                ? "bg-zinc-900/25 border-white/5"
                : "bg-zinc-900/40 border-white/5 hover:border-white/10"}
          ${focusedSeqId === seq.id ? "ring-1 ring-emerald-400/40" : ""}
        `}
      >
        {/* ── Ligne principale ── */}
        <div className="flex items-center gap-2 px-2.5 py-2 min-w-0">
          {/* Checkbox */}
          {onToggleSeq && (
            <button
              type="button"
              data-tour="quest-completion"
              onClick={e => { e.stopPropagation(); onToggleSeq(); }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors text-zinc-600 hover:text-emerald-400"
              title={isSeqCompleted ? "Décocher" : "Valider"}
              aria-label={isSeqCompleted ? "Décocher cette quête" : "Valider cette quête"}
            >
              {isSeqCompleted
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500/60 fill-emerald-500/10" />
                : <Square className="w-3.5 h-3.5 text-zinc-600" />}
            </button>
          )}
          {/* Nom + position + tags */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {seq.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/assets/icons/${seq.icon}.png`} alt="" className="w-4 h-4 object-contain shrink-0" loading="lazy" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/icone-quete.png" alt="" className="w-3 h-3 object-contain opacity-40 shrink-0" loading="lazy" />
            {hasAlignment && seq.alignReq && seq.alignReq !== "neutre" && (
              <span
                className="font-[family-name:var(--font-cinzel)] uppercase tracking-widest text-[10px] font-bold shrink-0"
                style={{ color: seq.alignReq === "bontarien" ? "#60a5fa" : "#f87171" }}
              >
                {alignInfo?.label} lv.{seq.alignOrderReq}:
              </span>
            )}
            {(() => {
              const primaryUrl = noobsUrl || dbUrl || null;
              const cls = `text-[13px] font-semibold leading-snug font-[family-name:var(--font-cinzel)] tracking-wide ${isSeqCompleted ? "line-through text-zinc-500" : "text-zinc-100"}`;
              if (primaryUrl) return (
                <a href={primaryUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`${cls} hover:text-amber-300 transition-colors`} title={`Ouvrir sur ${noobsUrl ? "DofusPourLesNoobs" : "DofusDB"}`}>{questName}</a>
              );
              return <span className={cls}>{questName}</span>;
            })()}
            {/* Position GPS — chip mono discret */}
            {(() => {
              const posTag = Array.isArray(seq.activityTags) ? (seq.activityTags as any[]).find((t: any) => t.type === "pos_tags") : null;
              if (!posTag?.name) return null;
              const posStr = String(posTag.name);
              const worldId = (posTag as any).worldId ?? undefined;
              const coords = posStr.match(/(-?\d+)\s*[,;]\s*(-?\d+)/);
              if (!coords) return null;
              const x = parseInt(coords[1], 10);
              const y = parseInt(coords[2], 10);
              const chip = (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800/70 border border-white/5 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer transition-colors shrink-0"
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`/travel ${posStr}`).then(() => toast.success(`📍 ${posStr} copié !`, { duration: 1200 })).catch(() => {}); }}
                  title={`Copier /travel ${posStr}`}
                >
                  [{x}, {y}]
                </span>
              );
              return (
                <MapPositionPopover posX={x} posY={y} worldId={worldId} guildId={guildId} contextLabel={`${questName} ${ms.title}`}>
                  {chip}
                </MapPositionPopover>
              );
            })()}
            {/* Tags activité — icônes seules avec tooltip natif */}
            {(() => {
              const visibleTags = Array.isArray(seq.activityTags)
                ? seq.activityTags.filter((t: any) => !["prereq_text", "dofus_link", "ocre_dungeon", "pos_tags", "tougli_box", "quest_group", "info_sequence"].includes(t.type))
                : [];
              if (visibleTags.length === 0) return null;
              return (
                <span className="flex items-center gap-0.5 shrink-0">
                  {visibleTags.map((tag: any, i: number) => {
                    if (tag.type === "solver") {
                      const su = tag.url || null;
                      // eslint-disable-next-line @next/next/no-img-element
                      const icon = <img src="/assets/rush-sylvestre/solver.png" alt="Solver" className="w-4 h-4 object-cover rounded-full opacity-60 hover:opacity-100 transition-opacity" />;
                      if (su) return <a key={i} href={su} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Solver" className="shrink-0">{icon}</a>;
                      return <span key={i} title="Solver requis" className="shrink-0">{icon}</span>;
                    }
                    const def = ACTIVITY_TAGS.find(x => x.type === tag.type);
                    if (!def) return null;
                    const isMetier = tag.type === "metier";
                    const isHoraire = tag.type === "contrainte_horaire";
                    const ip = isMetier ? getMetierIconPath(tag.name) : def.imagePath;
                    let tooltip = def.label;
                    if (isMetier && tag.name) tooltip = `${tag.name}${tag.level != null ? ` Niv.${tag.level}` : ""}`;
                    if (isHoraire && tag.name) {
                      const n = String(tag.name);
                      if (n.startsWith("<")) tooltip = `Avant ${n.slice(1).trim()}h`;
                      else if (n.startsWith(">")) tooltip = `Après ${n.slice(1).trim()}h`;
                      else { const p = n.split("-").map(s => s.trim()); if (p.length === 2) tooltip = `${p[0]}h → ${p[1]}h`; }
                    }
                    if (tag.count && tag.count > 1) tooltip = `${tooltip} ×${tag.count}`;
                    return (
                      <button key={i} type="button" onClick={e => { e.stopPropagation(); setActiveTagInfo({ icon: ip, label: tooltip, name: tag.name, level: tag.level, count: tag.count }); }} className="shrink-0 relative cursor-pointer" title={tooltip}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ip} alt={tooltip} className="w-4 h-4 object-cover rounded-full opacity-55 hover:opacity-100 transition-opacity" />
                        {tag.count && tag.count > 1 && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-black text-amber-400 leading-none">{tag.count}</span>
                        )}
                      </button>
                    );
                  })}
                </span>
              );
            })()}
            {seq.isSuccess && (
              <span title="Succès" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/icons/succes.png" alt="Succès" className="w-3.5 h-3.5 opacity-60" />
              </span>
            )}
            {seq.isOptional && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500 border border-white/5 shrink-0">Bonus</span>
            )}
          </div>
          {/* Liens externes — icônes discrètes au hover */}
          {(dbUrl || noobsUrl) && (
            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {noobsUrl && (
                <a href={noobsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="DofusPourLesNoobs" className="opacity-40 hover:opacity-90 transition-opacity">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" />
                </a>
              )}
              {dbUrl && (
                <a href={dbUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="DofusDB" className="opacity-40 hover:opacity-90 transition-opacity">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" />
                </a>
              )}
            </div>
          )}
          {/* Bookmark JE SUIS ICI */}
          {onToggleSeq && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onBookmarkSeq(seq.id, ms); }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                isThisBookmarked
                  ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                  : "bg-transparent border-white/5 text-zinc-600 hover:text-amber-300 hover:border-amber-500/20"
              }`}
              title={isThisBookmarked ? "Retirer le repère" : "Je suis ici"}
            >
              {isThisBookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
            </button>
          )}
        </div>
        {/* ── Membres sur cette quête (avatars bookmark) ── */}
        {isThisBookmarked && !isSeqCompleted && seqMembers.length > 0 && (
          <div className="px-2.5 pb-1.5">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMembersModalOpen(true); }}
              className="flex items-center gap-1.5 cursor-pointer"
              title={`${seqMembers.length} membre${seqMembers.length > 1 ? "s" : ""} ici`}
            >
              <div className="flex -space-x-1">
                {seqMembers.slice(0, 5).map(m => (
                  <div key={m.profileId} className="w-4 h-4 rounded-full overflow-hidden bg-zinc-900 border border-zinc-950 ring-1 ring-amber-500/30 flex-shrink-0" title={m.userName}>
                    {m.userAvatar
                      ? <img src={m.userAvatar} alt="" className="w-full h-full object-cover" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <span className="text-[7px] font-black text-amber-300 flex items-center justify-center h-full">{m.userName[0]?.toUpperCase()}</span>}
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-bold text-amber-400/60">{seqMembers.length}</span>
            </button>
          </div>
        )}
        {/* ── Tougli callout ── */}
        {(() => {
          const t = seq.activityTags?.find((x: any) => x.type === "tougli_box");
          if (!t?.name) return null;
          return <div className="px-2.5 pb-2"><TougliCallout text={t.name} colorStyle={t.color || "emerald"} /></div>;
        })()}
        {/* ── Donjon(s) ── */}
        {allDungeons.length > 0 && (
          <div className="px-2.5 pb-2">
            <DungeonGroup
              dungeons={allDungeons as DungeonRef[]}
              capturedMonsterSet={capturedMonsterSet}
              capturedMonsterNames={capturedMonsterNames}
              activityTags={seq.activityTags}
              metamobMonsterId={seq.metamobMonsterId}
              questName={questName}
              onDungeonClick={onDungeonClick}
            />
          </div>
        )}
        {/* ── Tips & Note — dépliables ── */}
        {(() => {
          let tipsText = String(seq.tips || "");
          const hasPosTag = Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "pos_tags");
          if (hasPosTag) tipsText = tipsText.replace(/[^\n]*position de lancement[^\n]*/gi, "").trim();
          if (!tipsText && !seq.note) return null;
          return <CollapsibleHints tipsText={tipsText} note={seq.note || null} />;
        })()}
      </div>
      {/* ── Modal info tag activité ── */}
      {activeTagInfo && (
        <Dialog open={!!activeTagInfo} onOpenChange={open => { if (!open) setActiveTagInfo(null); }}>
          <DialogContent className="sm:max-w-xs bg-zinc-950 border-white/10 shadow-2xl p-0 gap-0">
            <DialogHeader className="p-4 border-b border-white/5">
              <DialogTitle className="text-sm font-black text-white flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeTagInfo.icon} alt={activeTagInfo.label} className="w-6 h-6 object-contain rounded-md" />
                {activeTagInfo.label}
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 text-center space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeTagInfo.icon} alt={activeTagInfo.label} className="w-14 h-14 object-contain mx-auto rounded-xl" />
              {activeTagInfo.name && (
                <p className="text-sm font-bold text-zinc-200">
                  {activeTagInfo.name}
                  {activeTagInfo.level != null && <span className="text-zinc-400 font-normal"> — Niv. {activeTagInfo.level}</span>}
                  {activeTagInfo.count && activeTagInfo.count > 1 && <span className="text-amber-400 font-black"> ×{activeTagInfo.count}</span>}
                </p>
              )}
            </div>
            <DialogFooter className="p-3 border-t border-white/5">
              <Button onClick={() => setActiveTagInfo(null)} variant="ghost" size="sm" className="text-zinc-400 text-xs">Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* ── Modal membres ── */}
      {membersModalOpen && (
        <Dialog open={membersModalOpen} onOpenChange={open => { if (!open) setMembersModalOpen(false); }}>
          <DialogContent className="sm:max-w-sm bg-zinc-950 border-white/10 shadow-2xl p-0 gap-0">
            <DialogHeader className="p-4 border-b border-white/5">
              <DialogTitle className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Membres sur cette quête ({seqMembers.length})
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-1">
              {seqMembers.map(m => (
                <div key={m.profileId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-indigo-900 flex items-center justify-center flex-shrink-0">
                    {m.userAvatar
                      ? <img src={m.userAvatar} alt="" className="w-full h-full object-cover" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <span className="text-caption font-black text-indigo-300">{m.userName[0]?.toUpperCase()}</span>}
                  </div>
                  <span className="text-xs font-bold text-zinc-200">{m.userName}</span>
                </div>
              ))}
            </div>
            <DialogFooter className="p-3 border-t border-white/5">
              <Button onClick={() => setMembersModalOpen(false)} variant="ghost" size="sm" className="text-zinc-400 text-xs">Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});

// ─── CollapsibleHints — Tips & Notes dépliables ────────────────────────────────
function CollapsibleHints({ tipsText, note }: { tipsText: string; note: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/5">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <Sparkles className="w-2.5 h-2.5 shrink-0" />
        {open ? "Masquer" : "Conseils & notes"}
        <ChevronDown className={`w-3 h-3 ml-auto transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {tipsText && (
            <div className="flex items-start gap-2 text-xs text-amber-300/80 font-medium leading-relaxed">
              <Sparkles className="w-3 h-3 text-amber-400/50 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-wrap items-center gap-1">{renderContentWithCoords(tipsText)}</div>
            </div>
          )}
          {note && (
            <div className="flex items-start gap-2 text-xs text-orange-300/80 font-medium leading-relaxed">
              <AlertTriangle className="w-3 h-3 text-orange-400/50 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── DofusObtainedBanner (premium card style — high fantasy Dofus UI) ─────────
function DofusObtainedBanner({ milestone }: { milestone: Milestone }) {
  const dofusInfo = milestone.dofusId ? DOFUS_DEFS.find(d => d.id === milestone.dofusId) : null;
  const color = milestone.accentColor || (dofusInfo?.color || "#d4a853");
  const message = milestone.description || milestone.title || (dofusInfo ? `Dofus ${dofusInfo.label}` : "Dofus obtenu !");

  return (
    <div className="relative my-6 mx-auto max-w-md select-none">
      {/* Card frame — plate (zéro glow, bordure 1px) */}
      <div className="relative rounded-2xl overflow-hidden border"
        style={{
          borderColor: `${color}35`,
          background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.5) 50%, ${color}06 100%)`,
        }}
      >
        {/* Inner content */}
        <div className="relative flex flex-col items-center gap-5 py-8 px-6 text-center">
          {/* Dofus icon — large egg */}
          {dofusInfo && (
            <div className="relative group">
              {/* Icon container */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center p-2"
                style={{
                  borderColor: `${color}50`,
                  background: `rgba(0,0,0,0.6)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dofusInfo.imageUrl}
                  alt={dofusInfo.label}
                  className="w-full h-full object-contain scale-110"
                />
              </div>
            </div>
          )}

          {/* Text content strictly inside card */}
          <div className="space-y-2">
            <h2
              className="font-[family-name:var(--font-cinzel)] text-lg sm:text-xl font-black uppercase tracking-[0.12em] leading-tight"
              style={{ color }}
            >
              VOUS AVEZ OBTENU<br />
              <span className="text-2xl sm:text-3xl">LE DOFUS {dofusInfo?.label?.toUpperCase() || ""} !</span>
            </h2>
            {message && (
              <p className="text-sm text-zinc-300/90 leading-relaxed font-medium max-w-xs mx-auto">
                {message}
              </p>
            )}
          </div>

          {/* Bottom divider sparkles */}
          <div className="flex items-center gap-2 opacity-60">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-current" style={{ color: `${color}60` }} />
            <Sparkles className="w-3 h-3" style={{ color: `${color}80` }} />
            <Sparkles className="w-4 h-4" style={{ color: `${color}90` }} />
            <Sparkles className="w-3 h-3" style={{ color: `${color}80` }} />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-current" style={{ color: `${color}60` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── InfoBanner (for INFO type milestones — tips/conseil bandeau) ────────────
function getInfoStyle(accentColor?: string|null): { border: string; bg: string; icon: string } {
  if (!accentColor) return { border:"border-emerald-500/30", bg:"from-emerald-950/30 via-zinc-950 to-zinc-950", icon:"💡" };
  const c = accentColor.toLowerCase();
  if (c.startsWith("#ef")||c.startsWith("#f4")||c.startsWith("#f5")||c.startsWith("#eab")||c.startsWith("#dc")||c.startsWith("#f9")) 
    return { border:"border-amber-500/30", bg:"from-amber-950/30 via-zinc-950 to-zinc-950", icon:"⚠️" };
  if (c.startsWith("#3b")||c.startsWith("#06")||c.startsWith("#4f")||c.startsWith("#63")||c.startsWith("#0e")||c.startsWith("#38"))
    return { border:"border-blue-500/30", bg:"from-blue-950/30 via-zinc-950 to-zinc-950", icon:"📖" };
  if (c.startsWith("#7c")||c.startsWith("#a8")||c.startsWith("#8b")||c.startsWith("#c0"))
    return { border:"border-purple-500/30", bg:"from-purple-950/30 via-zinc-950 to-zinc-950", icon:"🔮" };
  return { border:"border-emerald-500/30", bg:"from-emerald-950/30 via-zinc-950 to-zinc-950", icon:"💡" };
}
function renderContentWithCoords(text: string, guildId: string = ""): (string | React.ReactNode)[] {
  const parts: (string | React.ReactNode)[] = [];
  // Combine link regex and coordinate regex in one pass
  // Order matters: [text](url), raw urls, /travel X Y, /travel X,Y, [X, Y], [X, Y, W]
  const combinedRx = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)|(?:\/travel\s+(-?\d+)\s*[,;]\s*(-?\d+)(?!\d))|\[(-?\d+),\s*(-?\d+)(?:,\s*(\d+))?\]/g;
  let li = 0, m: RegExpExecArray | null;
  while ((m = combinedRx.exec(text)) !== null) {
    if (m.index > li) parts.push(text.slice(li, m.index));
    if (m[1] && m[2]) {
      // Markdown link [text](url)
      parts.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors text-emerald-300 hover:text-emerald-200 decoration-emerald-500/50">{m[1]}<ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-80 shrink-0"/></a>);
    } else if (m[3]) {
      // Raw URL
      let label = m[3];
      if (m[3].includes("dofusdb.fr")) label = "Lien DofusDB ↗";
      else if (m[3].includes("dofuspourlesnoobs.com")) label = "Lien DofusNoobs ↗";
      parts.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors text-emerald-300 hover:text-emerald-200 decoration-emerald-500/50">{label}</a>);
    } else if (m[4] && m[5]) {
      // /travel X, Y format
      const x = m[4], y = m[5];
      const worldId = m[8] ? parseInt(m[8], 10) : undefined;
      const chip = (
        <span key={`pos-${m.index}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-caption font-mono font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer" 
          onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(`/travel ${x},${y}`).then(()=>{toast.success(`📍 Position [${x}, ${y}] copiée !`,{duration:1500,icon:"📋"});}).catch(()=>{});}}
          title="Cliquer pour copier /travel"
        >
          <MapPin className="w-3 h-3 text-indigo-400" />
          [{x}, {y}]
        </span>
      );
      parts.push(
        <MapPositionPopover key={`popover-${m.index}`} posX={parseInt(x, 10)} posY={parseInt(y, 10)} worldId={worldId} guildId={guildId} contextLabel={text}>
          {chip}
        </MapPositionPopover>
      );
    } else if (m[6] && m[7]) {
      // [x, y] or [x, y, world] format
      const x = m[6], y = m[7];
      const worldId = m[8] ? parseInt(m[8], 10) : undefined;
      const chip = (
        <span key={`pos-${m.index}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-caption font-mono font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer" 
          onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(`/travel ${x},${y}`).then(()=>{toast.success(`📍 Position [${x}, ${y}] copiée !`,{duration:1500,icon:"📋"});}).catch(()=>{});}}
          title="Cliquer pour copier /travel"
        >
          <MapPin className="w-3 h-3 text-indigo-400" />
          [{x}, {y}]
        </span>
      );
      parts.push(
        <MapPositionPopover key={`popover-${m.index}`} posX={parseInt(x, 10)} posY={parseInt(y, 10)} worldId={worldId} guildId={guildId} contextLabel={text}>
          {chip}
        </MapPositionPopover>
      );
    }
    li = combinedRx.lastIndex;
  }
  if (li < text.length) parts.push(text.slice(li));
  return parts;
}

function InfoBanner({ milestone }: { milestone: Milestone }) {
  const color = milestone.accentColor || "#10b981";
  const content = milestone.tips || milestone.description || milestone.title || "";
  const parts = renderContentWithCoords(content);
  const hasTitle = !!milestone.title && !content.startsWith(milestone.title);
  const isWarm = color.startsWith("#ef")||color.startsWith("#f4")||color.startsWith("#f5")||color.startsWith("#eab")||color.startsWith("#dc")||color.startsWith("#f9");
  const isCool = color.startsWith("#3b")||color.startsWith("#06")||color.startsWith("#4f")||color.startsWith("#63")||color.startsWith("#0e")||color.startsWith("#38");
  const isPurple = color.startsWith("#7c")||color.startsWith("#a8")||color.startsWith("#8b")||color.startsWith("#c0");
  let icon = "💡";
  if (isWarm) icon = "⚠️";
  else if (isCool) icon = "📖";
  else if (isPurple) icon = "🔮";

  return (
    <div className="relative my-3 rounded-2xl overflow-hidden border select-none"
      style={{
        borderColor: `${color}30`,
        background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.5) 50%, ${color}08 100%)`,
      }}
    >
      <div className="relative flex items-start gap-3 p-3">
        <span className="text-lg leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="text-xs text-zinc-200 leading-relaxed font-medium flex-1 min-w-0">
          {hasTitle && <p className="font-[family-name:var(--font-cinzel)] font-black text-sm mb-1 uppercase tracking-wider" style={{color}}>{milestone.title}</p>}
          {parts}
        </div>
      </div>
    </div>
  );
}

// ─── InfoSequenceBanner (bandeau informatif non-cliquable dans un bloc) ─────
function InfoSequenceBanner({ seq, accentColor }: { seq: Sequence; accentColor: string }) {
  const color = seq.activityTags?.find((t: any) => t.type === "info_sequence")?.color || accentColor || "#10b981";
  const content = seq.tips || seq.subGuideName || seq.subGuideRef || "";
  const parts = renderContentWithCoords(content);
  const isWarm = color.startsWith("#ef")||color.startsWith("#f4")||color.startsWith("#f5")||color.startsWith("#eab")||color.startsWith("#dc")||color.startsWith("#f9");
  const isCool = color.startsWith("#3b")||color.startsWith("#06")||color.startsWith("#4f")||color.startsWith("#63")||color.startsWith("#0e")||color.startsWith("#38");
  const isPurple = color.startsWith("#7c")||color.startsWith("#a8")||color.startsWith("#8b")||color.startsWith("#c0");
  let icon = "💡";
  if (isWarm) icon = "⚠️";
  else if (isCool) icon = "📖";
  else if (isPurple) icon = "🔮";

  return (
    <div className="relative rounded-2xl overflow-hidden border select-none"
      style={{
        borderColor: `${color}25`,
        background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.4) 50%, ${color}06 100%)`,
      }}
    >
      <div className="relative flex items-start gap-2.5 p-3">
        <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="text-xs sm:text-sm text-zinc-200/90 leading-relaxed font-medium flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          {parts}
        </div>
      </div>
    </div>
  );
}

// ─── MilestoneRow ─────────────────────────────────────────────────────────────
const MilestoneRow = memo(function MilestoneRow({ ms, isCompleted, completedStepsSet, isBookmarked, membersHere, hideDone, isLoading, accentColor, userAlignmentInfo, focusedSeqId, onFocusSequence, onToggle, onToggleSequence, onReset, onDungeonClick, isSearching }: any) {
  const [expanded,setExpanded]=useState(false);
  const bookmarksByMs = React.useContext(BookmarkedSeqCtx);
  const onBookmarkSeq = React.useContext(OnBookmarkSeqCtx);
  const blockBookmarkSeqId = bookmarksByMs.get(ms.id) || null;
  if(ms.type==="SEPARATEUR")return null;
  if(ms.type==="INFO")return <InfoBanner milestone={ms}/>;
  useEffect(()=>{if(isBookmarked)setExpanded(true);},[isBookmarked]);
  useEffect(()=>{if(focusedSeqId&&ms.sequences.some((s:any)=>s.id===focusedSeqId))setExpanded(true);},[focusedSeqId,ms.sequences]);
  if(hideDone&&isCompleted&&!isSearching)return null;
  const nonInfoSeqs = ms.sequences.filter((s:any)=>!isInfoSequence(s));
  const cs=nonInfoSeqs.filter((s:any)=>isCompleted||completedStepsSet.has(s.id)).length;
  const totalQuests=nonInfoSeqs.length;
  const all=isCompleted||(totalQuests>0&&cs===totalQuests);
  const c=accentColor||"#10b981";

  return (
    <div className={`relative transition-all duration-200 ${isCompleted?"opacity-60":isBookmarked?"opacity-100":"opacity-95 hover:opacity-100"}`}>
      <div className="absolute -left-[25px] top-5 w-3 h-3 rounded-full z-10 transition-all ring-1 ring-black/30" style={{background:all?c:"transparent",border:`2px solid ${all?c:`${c}60`}`}}/>
      <div className={`ml-2 rounded-2xl border transition-all shadow-md ${all?"border-emerald-500/20 bg-zinc-950/40 shadow-emerald-500/5":isBookmarked?"border-amber-500/30 bg-zinc-950/80 shadow-amber-500/5 ring-1 ring-amber-500/20":"border-white/10 bg-zinc-900/40 hover:border-white/20 shadow-black/20"}`}>
        {/* Header row */}
        <div className="flex items-center gap-3 p-3.5 cursor-pointer select-none" onClick={()=>setExpanded((v:boolean)=>!v)}>
          {/* Status indicator */}
          <div className="flex-shrink-0 relative">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400"/> :
             all ? <div className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40"><CheckCheck className="w-3.5 h-3.5 text-emerald-400"/></div> :
             cs > 0 ? <div className="w-5 h-5 rounded-full border-2 border-amber-400/50 flex items-center justify-center bg-amber-500/10"><span className="w-2 h-2 rounded-full bg-amber-400"/></div> :
             <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center bg-zinc-900"><span className="w-2 h-2 rounded-full bg-zinc-700"/></div>}
          </div>
          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black leading-tight tracking-wide font-[family-name:var(--font-cinzel)] ${all?"text-zinc-500":"text-white"}`} style={!all?{color:c}:undefined}>{ms.title}</span>
              {ms.isOptional&&<span className="text-caption font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Bonus</span>}
              {(()=>{if(!ms.dofusId)return null;const d=ms.dofusId?DOFUS_DEFS.find(x=>x.id===ms.dofusId):null;if(!d)return null;return<img src={d.imageUrl} alt={d.label} title={d.label} className="w-5 h-5 object-contain flex-shrink-0"/>;})()}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-caption font-mono font-bold text-zinc-400">{completedStepsSet.size>0?`${cs}/${totalQuests}`:`${totalQuests} quête${totalQuests>1?"s":""}`}</span>
            </div>
          </div>
          {/* Actions */}
          <div className={`flex items-center gap-1.5 flex-shrink-0 ${isCompleted?"opacity-100":""}`}>
            {!all&&<button onClick={e=>{e.stopPropagation();onToggle();}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-caption font-black uppercase tracking-widest shadow-sm" title="Valider le bloc"><CheckCircle2 className="w-3 h-3"/>Valider</button>}
            <button onClick={e=>{e.stopPropagation();onReset();}} className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border transition-all text-caption font-black uppercase tracking-widest shadow-sm ${isCompleted?"bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30":"bg-zinc-900 border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30"}`}><RotateCcw className="w-3 h-3"/>Reset</button>
            {(blockBookmarkSeqId||!all)&&<button onClick={e=>{e.stopPropagation();if(blockBookmarkSeqId){const bseq=nonInfoSeqs.find((s:any)=>s.id===blockBookmarkSeqId);if(bseq)onBookmarkSeq(bseq.id,ms);}else{const target=nonInfoSeqs.find((s:any)=>!completedStepsSet.has(s.id));if(target)onBookmarkSeq(target.id,ms);}}} className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border transition-all text-caption font-black uppercase tracking-widest shadow-sm ${blockBookmarkSeqId?"bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/25":"bg-zinc-900 border-white/10 text-zinc-500 hover:text-amber-300 hover:border-amber-500/30"}`} title={blockBookmarkSeqId?"Quête repérée dans ce bloc (cliquer pour retirer).":"Poser « Je suis ici » sur la prochaine quête de ce bloc."}>{blockBookmarkSeqId?<BookmarkCheck className="w-3 h-3"/>:<Flag className="w-3 h-3"/>}{blockBookmarkSeqId?"Repère":"Je suis ici"}</button>}
            <div className="text-zinc-500 ml-1">{expanded?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</div>
          </div>
        </div>
        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-1.5 pt-2 border-t border-white/5">
                {/* ── À faire maintenant ── */}
                {(()=>{
                  const nextSeq = blockBookmarkSeqId
                    ? nonInfoSeqs.find((s:any)=>s.id===blockBookmarkSeqId)
                    : nonInfoSeqs.find((s:any)=>!completedStepsSet.has(s.id));
                  if(!nextSeq||all) return null;
                  const posTag = Array.isArray(nextSeq.activityTags) ? nextSeq.activityTags.find((t:any)=>t.type==="pos_tags") : null;
                  const posStr = posTag?.name ? String(posTag.name) : null;
                  const coords = posStr ? posStr.match(/(-?\d+)\s*[,;]\s*(-?\d+)/) : null;
                  return (
                    <div className="mb-2 flex items-start gap-2.5 px-3 py-2.5 rounded-xl border"
                      style={{background:"linear-gradient(90deg,#d5a94e14,#d5a94e04)",borderColor:"#d5a94e40"}}>
                      <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{color:"#d5a94e"}}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] mb-1" style={{color:"#d5a94e"}}>✦ À faire maintenant</p>
                        <p className="text-xs font-semibold font-[family-name:var(--font-cinzel)] text-zinc-200 leading-snug truncate">{nextSeq.subGuideName}</p>
                        {coords && (
                          <button onClick={()=>navigator.clipboard.writeText(`/travel ${posStr}`).then(()=>toast.success(`📍 ${posStr} copié !`,{duration:1200})).catch(()=>{})}
                            className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors hover:bg-blue-500/10"
                            style={{background:"#202a46",color:"#b7caff"}}
                            title={`Copier /travel ${posStr}`}>
                            [{coords[1]}, {coords[2]}]
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {ms.tips && (
                  <div className="mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300 font-medium">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed flex flex-wrap items-center gap-1">{renderContentWithCoords(ms.tips)}</div>
                  </div>
                )}
                <CompletedStepsCtx.Provider value={completedStepsSet}>
                  {ms.sequences.length===0 ? (
                    <div className="py-6 text-center text-zinc-600 text-caption font-black uppercase tracking-widest">Aucune quête</div>
                  ) : (
                    ms.sequences.filter((s:any)=>!hideDone||!completedStepsSet.has(s.id)).map((s:any)=>(
                      isInfoSequence(s) ? (
                        <InfoSequenceBanner key={s.id} seq={s} accentColor={c} />
                      ) : (
                        <SequenceRow key={s.id} seq={s} ms={ms} isSeqCompleted={completedStepsSet.has(s.id)} focusedSeqId={focusedSeqId} accentColor={c} userAlignmentInfo={userAlignmentInfo} onToggleSeq={()=>onToggleSequence(ms,s.id)} onDungeonClick={onDungeonClick}/>
                      )
                    ))
                  )}
                </CompletedStepsCtx.Provider>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ─── SectionDivider ───────────────────────────────────────────────────────────
const SectionDivider = memo(function SectionDivider({title,accentColor="#d4a853"}:{title:string;accentColor?:string}) {
  return <div className="relative py-7 my-3 select-none"><div className="flex items-center justify-center gap-4"><div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent via-current to-current opacity-40" style={{color:accentColor}}/><Sparkles className="w-4 h-4" style={{color:accentColor,opacity:0.7}}/><h2 className="font-[family-name:var(--font-cinzel)] text-base sm:text-xl font-bold uppercase tracking-[0.15em] text-center leading-tight px-1" style={{color:accentColor}}>{title}</h2><Sparkles className="w-4 h-4" style={{color:accentColor,opacity:0.7}}/><div className="h-px flex-1 max-w-[120px] bg-gradient-to-l from-transparent via-current to-current opacity-40" style={{color:accentColor}}/></div></div>;
});

// ─── ChapterBlock ─────────────────────────────────────────────────────────────
const ChapterBlock = memo(function ChapterBlock({ chapterNum,label,showHeader=true,milestones,completedIds,completedStepsByMs,bookmarksByMs,guildProgressByMs,hideDone,loadingIds,dofusFilter,userAlignmentInfo,focusedSeqId,onFocusSequence,onToggle,onToggleSequence,onReset,onDungeonClick,searchFilter }:any) {
  const filteredMilestones = useMemo(() => {
    if (!searchFilter) return milestones;
    return milestones.filter((ms:any) => {
      if (ms.type === "INFO") return true;
      return ms.sequences.some((s:any) => searchFilter.has(s.id));
    });
  }, [milestones, searchFilter]);
  const ci=filteredMilestones.filter((m:any)=>m.type!=="INFO"&&completedIds.has(m.id)).length,ti=filteredMilestones.filter((m:any)=>m.type!=="INFO").length,all=ti>0&&ci===ti;
  const ac=milestones[0]?.accentColor||"#10b981";const hb=milestones.some((m:any)=>bookmarksByMs.has(m.id));const[open,setOpen]=useState(hb||chapterNum===1||!!searchFilter);
  useEffect(()=>{if(hb)setOpen(true);},[hb]);useEffect(()=>{if(searchFilter&&filteredMilestones.length>0)setOpen(true);},[searchFilter,filteredMilestones.length]);useEffect(()=>{if(focusedSeqId&&milestones.some((ms:any)=>ms.sequences.some((s:any)=>s.id===focusedSeqId)))setOpen(true);},[focusedSeqId,milestones]);
  const vc=hideDone?filteredMilestones.filter((m:any)=>!completedIds.has(m.id)).length:filteredMilestones.length;
  if(hideDone&&vc===0)return null;
  return <div className="relative">{showHeader&&<button onClick={()=>setOpen((v:boolean)=>!v)} className="w-full flex items-center gap-3 py-3 group transition-all">
    <div className="relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all group- shadow-sm" style={{borderColor:all?ac:`${ac}40`,background:all?`${ac}20`:"transparent"}}>{all?<CheckCheck className="w-5 h-5" style={{color:ac}}/>:<span className="text-sm font-black font-[family-name:var(--font-cinzel)]" style={{color:ac}}>{chapterNum}</span>}</div>
    <div className="flex-1 text-left"><div className="flex items-center gap-2"><span className="font-[family-name:var(--font-cinzel)] font-bold uppercase tracking-wider" style={{color:ac,fontSize:"clamp(0.8rem,2vw,1.1rem)"}}>{label}</span><span className="text-caption font-black px-2 py-0.5 rounded-full font-mono" style={{background:`${ac}15`,color:ac}}>{ci}/{ti}</span></div><div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5"><div className="h-full rounded-full transition-all duration-300" style={{width:`${ti>0?(ci/ti)*100:0}%`,background:`linear-gradient(90deg, ${ac}, ${ac}99)`}}/></div></div>
    <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 ml-1">{open?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</div>
  </button>}<AnimatePresence>{(open||!showHeader)&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="relative ml-5 pl-5 pb-3 border-l border-zinc-800/40 space-y-2">{filteredMilestones.filter((ms:any)=>!dofusFilter||ms.dofusId===dofusFilter).map((ms:any)=>{
  if(ms.type==="INFO")return <div key={ms.id} className="-ml-2 my-1"><InfoBanner milestone={ms}/></div>;
  const filteredSeqs = searchFilter ? ms.sequences.filter((s:any)=>searchFilter.has(s.id)) : ms.sequences;
  return <div key={ms.id} data-ms-id={ms.id}><MilestoneRow ms={{...ms,sequences:filteredSeqs}} isCompleted={completedIds.has(ms.id)} completedStepsSet={completedStepsByMs.get(ms.id)||new Set()} isBookmarked={bookmarksByMs.has(ms.id)} membersHere={guildProgressByMs.get(ms.id)||[]} hideDone={hideDone} isLoading={loadingIds.has(ms.id)} onToggle={()=>onToggle(ms)} onToggleSequence={onToggleSequence} onReset={()=>onReset(ms)} accentColor={ms.accentColor||ac} userAlignmentInfo={userAlignmentInfo} focusedSeqId={focusedSeqId} onFocusSequence={onFocusSequence} onDungeonClick={onDungeonClick} isSearching={!!searchFilter}/></div>;
})}</div></motion.div>}</AnimatePresence></div>;
});

// ─── CharacterSelectorDropdown ─────────────────────────────────────────────
function CharacterSelectorDropdown({selectedCharacter,mainPseudo,mainClass,mules,guildId}:{selectedCharacter:string;mainPseudo:string;mainClass:string|null;mules:any[];guildId:string}){
  const router=useRouter();
  const currentLabel=selectedCharacter==="PRINCIPAL"?mainPseudo:selectedCharacter;
  const selClass=selectedCharacter==="PRINCIPAL"?mainClass:mules.find((m:any)=>m.pseudo===selectedCharacter)?.classe||null;
  const selIcon=selClass?(()=>{const d=getClass(selClass);return d?<img src={d.icon} alt={d.name} className="w-4 h-4 object-contain"/>:null;})():selectedCharacter==="PRINCIPAL"?<Crown className="w-3.5 h-3.5 text-amber-500"/>:<Users className="w-3.5 h-3.5 text-blue-400"/>;
  const handleSelect=(char:string)=>{const params=new URLSearchParams(window.location.search);if(char==="PRINCIPAL")params.delete("character");else params.set("character",char);router.push(`${window.location.pathname}?${params.toString()}`);};
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" role="combobox" aria-expanded={false} className="bg-zinc-950/60 border-zinc-800/60 hover:border-emerald-500/20 text-white justify-between w-full min-w-0 max-w-full transition-all rounded-xl h-9 px-2.5 cursor-pointer text-xs font-black"><div className="flex items-center gap-2 truncate min-w-0">{selIcon}<span className="truncate">{currentLabel}</span></div><ChevronDown className="w-3 h-3 opacity-30 shrink-0"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="bg-zinc-950/95 border-zinc-800/60 text-white min-w-[180px] rounded-xl p-1.5 shadow-2xl z-[100]"><DropdownMenuItem onClick={()=>handleSelect("PRINCIPAL")} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter==="PRINCIPAL"?"bg-white/5 text-emerald-400":"hover:bg-white/5"}`}><div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">{mainClass?(()=>{const d=getClass(mainClass);return d?<img src={d.icon} alt="" className="w-4 h-4 object-contain"/>:null;})():<Crown className="w-3 h-3 text-amber-500"/>}</div><div className="flex flex-col text-left"><span className="text-xs font-bold">{mainPseudo}</span><span className="text-caption text-zinc-500 font-medium uppercase tracking-widest">{mainClass||"Principal"}</span></div></DropdownMenuItem>{mules.length>0&&<div className="h-px bg-white/5 my-1"/>}{mules.map((mule:any)=><DropdownMenuItem key={mule.pseudo} onClick={()=>handleSelect(mule.pseudo)} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter===mule.pseudo?"bg-white/5 text-emerald-400":"hover:bg-white/5"}`}><div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">{mule.classe?(()=>{const d=getClass(mule.classe);return d?<img src={d.icon} alt="" className="w-4 h-4 object-contain"/>:null;})():<Users className="w-3 h-3 text-blue-400"/>}</div><div className="flex flex-col text-left"><span className="text-xs font-bold">{mule.pseudo}</span><span className="text-caption text-zinc-500 font-medium uppercase tracking-widest">Niv. {mule.level||200}{mule.classe?` • ${mule.classe}`:""}</span></div></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isInfoSequence(seq: Sequence): boolean {
  return Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "info_sequence");
}

// ─── Contexts ────────────────────────────────────────────────────────────────
const CapturedMonsterCtx=React.createContext<Set<number>>(new Set);
const CapturedMonsterNamesCtx=React.createContext<string[]>([]);
const ScrollToPrereqCtx=React.createContext<(name:string)=>void>(()=>{});
const AllMilestonesCtx=React.createContext<Milestone[]>([]);
const CompletedStepsCtx=React.createContext<Set<string>>(new Set);
const AllCompletedSeqIdsCtx=React.createContext<Set<string>>(new Set);
const ContextualHelpCtx=React.createContext<boolean>(true);
const ActiveSeqIdCtx=React.createContext<string|null>(null);
const NextSeqIdCtx=React.createContext<string|null>(null);
const BookmarkedSeqCtx=React.createContext<Map<string,string>>(new Map);
const OnBookmarkSeqCtx=React.createContext<(seqId:string,ms:Milestone)=>void>(()=>{});
const GuildProgressBySeqCtx=React.createContext<Map<string,GuildMemberProgress[]>>(new Map);
const GuildIdCtx=React.createContext<string>("");

// ─── ContextualHelp ──────────────────────────────────────────────────────────
function ContextualHelp({ label, children, className }: { label: string; children?: React.ReactNode; className?: string }) {
  const enabled = React.useContext(ContextualHelpCtx);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!enabled) return null;

  return (
    <span className={`relative inline-flex ${className || ''}`}>
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setOpen(false), 150); }}
        aria-label={label}
        className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all shrink-0"
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="absolute z-[var(--z-tooltip)] bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 leading-relaxed shadow-2xl pointer-events-auto"
        >
          {children}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-950 border-r border-b border-white/10 rotate-45 -mt-px" />
        </div>
      )}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function RushTimelineClient({ guide, milestones, guildProgress, guildId, selectedCharacter="PRINCIPAL", mules=[], currentUserProfile, ocreStats, capturedOcreMonsterIds, capturedMonsterNames, ocreMonsters=[] }: RushTimelineClientProps) {
const capturedMonsterSet=useMemo(()=>new Set(capturedOcreMonsterIds||[]),[capturedOcreMonsterIds]);
  const capturedMonsterNamesMemo=useMemo(()=>capturedMonsterNames||[], [capturedMonsterNames]);
  const router=useRouter();const altPseudo=selectedCharacter!=="PRINCIPAL"?selectedCharacter:undefined;
  // Local copy of profile for optimistic alignment updates (sync profile<->rush)
  const [localProfile,setLocalProfile]=useState(currentUserProfile);
  useEffect(()=>{setLocalProfile(currentUserProfile);},[currentUserProfile]);
  const [completedIds,setCompletedIds]=useState<Set<string>>(()=>new Set(milestones.filter(ms=>ms.playerProgress?.[0]?.isCompleted).map(ms=>ms.id)));
  const [completedStepsByMs,setCompletedStepsByMs]=useState<Map<string,Set<string>>>(()=>{const m=new Map;milestones.forEach(ms=>{const r=ms.playerProgress?.[0]?.completedSteps;const a=Array.isArray(r)?r:typeof r==="string"?JSON.parse(r):[];m.set(ms.id,new Set(a));});return m;});
  useEffect(()=>{const nc=new Set<string>,ns=new Map<string,Set<string>>;milestones.forEach(ms=>{if(ms.playerProgress?.[0]?.isCompleted)nc.add(ms.id);const r=ms.playerProgress?.[0]?.completedSteps;const a=Array.isArray(r)?r:typeof r==="string"?JSON.parse(r):[];ns.set(ms.id,new Set(a));});setCompletedIds(nc);setCompletedStepsByMs(ns);},[milestones]);
  // ─── Bookmark PAR BLOC (jalon) : 1 « Je suis ici » max par bloc ────────────
  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const ms of milestones) {
      const step = ms.playerProgress?.[0]?.currentStep;
      if (step && step.startsWith("seq:")) m.set(ms.id, step.slice(4));
    }
    return m;
  });
  useEffect(() => {
    const next = new Map<string, string>();
    milestones.forEach(ms => {
      const step = ms.playerProgress?.[0]?.currentStep;
      if (step && step.startsWith("seq:")) next.set(ms.id, step.slice(4));
    });
    setBookmarksByMs(next);
  }, [milestones]);
  const [hideDone,setHideDone]=useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>('[data-scroll-container]');
    const target: HTMLElement | Window = scrollEl || window;
    const getY = () => (scrollEl ? scrollEl.scrollTop : window.scrollY);
    const getMaxY = () => scrollEl
      ? (scrollEl.scrollHeight - scrollEl.clientHeight)
      : (document.documentElement.scrollHeight - window.innerHeight);
    const handleScroll = () => {
      const y = getY();
      const maxY = getMaxY();
      setShowScrollTop(y > 300);
      setShowScrollBottom(y < maxY - 300);
    };
    target.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => target.removeEventListener('scroll', handleScroll);
  }, []);
  const [loadingIds,setLoadingIds]=useState<Set<string>>(new Set);
  const [dofusFilter,setDofusFilter]=useState<string|null>(null);
  const [focusedSeqId,setFocusedSeqId]=useState<string|null>(null);
  const [djModal,setDjModal]=useState<{open:boolean;dungeonId?:string;questName?:string}>({open:false});
  const [wizardOpen,setWizardOpen]=useState(false);
  const [resetModalOpen,setResetModalOpen]=useState(false);
  const [resetLoading,setResetLoading]=useState(false);
  const [ocreModalOpen,setOcreModalOpen]=useState(false);
  const [rushLiveModalOpen,setRushLiveModalOpen]=useState(false);
  const [incognito,setIncognito]=useState(false);
  useEffect(()=>{if(typeof window==="undefined")return;const k=`guide-incognito-${guildId}`;const stored=localStorage.getItem(k);if(stored!==null)setIncognito(stored==="true");},[guildId]);
  const toggleIncognito=useCallback(()=>{setIncognito(prev=>{const next=!prev;localStorage.setItem(`guide-incognito-${guildId}`,next?"true":"false");return next;});},[guildId]);
  const [metamobLinkOpen,setMetamobLinkOpen]=useState(false);
  const [metamobStep,setMetamobStep]=useState(1);
  const [metamobPseudoInput,setMetamobPseudoInput]=useState("");
  const [metamobApiKeyInput,setMetamobApiKeyInput]=useState("");
  const [metamobLinkError,setMetamobLinkError]=useState<string|null>(null);
  const [metamobLinking,setMetamobLinking]=useState(false);
  const [continueModalOpen,setContinueModalOpen]=useState(false);
  const continueShownThisSession=useRef(false);
  const [alignEditOpen,setAlignEditOpen]=useState(false);
  const [alignEditSaving,setAlignEditSaving]=useState(false);
  const [alignEditStep,setAlignEditStep]=useState<"alignment"|"order"|"tranche">("alignment");
  const [alignEditAlignment,setAlignEditAlignment]=useState<string|null>(null);
  const [alignEditOrder,setAlignEditOrder]=useState<string|null>(null);
  const [alignEditLevel,setAlignEditLevel]=useState<number>(0);
  const effectiveAltPseudo=useMemo(()=>{if(!altPseudo)return undefined;const mp=localProfile?.pseudoDofus;if(mp&&altPseudo===mp)return undefined;return altPseudo;},[altPseudo,localProfile?.pseudoDofus]);
  const resolvedCharacterInfo=useMemo(()=>{if(!effectiveAltPseudo)return{alignment:localProfile?.alignment,alignmentOrder:localProfile?.alignmentOrder,alignmentLevel:localProfile?.alignmentLevel??0};const m=localProfile?.altPseudos?.find((m:any)=>m.pseudo===effectiveAltPseudo);return{alignment:m?.alignment,alignmentOrder:m?.alignmentOrder,alignmentLevel:m?.alignmentLevel??0};},[effectiveAltPseudo,localProfile]);
  const openAlignEdit=useCallback(()=>{const{alignment,alignmentOrder,alignmentLevel}=resolvedCharacterInfo;setAlignEditAlignment(alignment||"neutre");setAlignEditOrder(alignmentOrder||null);setAlignEditLevel(alignmentLevel||0);setAlignEditStep("alignment");setAlignEditOpen(true);},[resolvedCharacterInfo]);
  const handleAlignEditSave=useCallback(async()=>{setAlignEditSaving(true);try{/* #1 : une mule s'édite dans altPseudos (même tableau que le profil) — pas le perso principal */const res=effectiveAltPseudo?await updateMuleAlignment({guildId,pseudo:effectiveAltPseudo,alignment:alignEditAlignment,alignmentOrder:alignEditOrder,alignmentLevel:alignEditLevel}):await updateUserProfile({guildId,alignment:alignEditAlignment,alignmentOrder:alignEditOrder,alignmentLevel:alignEditLevel});if((res as any).success){toast.success("Alignement mis à jour !");setAlignEditOpen(false);/* Optimistic update — sync local state instantly */if(!effectiveAltPseudo){setLocalProfile(prev=>({...prev,alignment:alignEditAlignment,alignmentOrder:alignEditOrder,alignmentLevel:alignEditLevel}));}else{setLocalProfile(prev=>{const updatedAlts=(prev.altPseudos||[]).map((m:any)=>m.pseudo===effectiveAltPseudo?{...m,alignment:alignEditAlignment,alignmentOrder:alignEditOrder,alignmentLevel:alignEditLevel}:m);return{...prev,altPseudos:updatedAlts};});}router.refresh();}else{toast.error((res as any).error||"Erreur lors de la sauvegarde");}}catch{toast.error("Erreur réseau");}finally{setAlignEditSaving(false);}},[guildId,alignEditAlignment,alignEditOrder,alignEditLevel,effectiveAltPseudo,router]);
  const handleFocusSequence=useCallback((seqId:string)=>setFocusedSeqId(seqId),[]);
  const handleDungeonClick=useCallback((dungeonId:string,questName:string)=>setDjModal({open:true,dungeonId,questName}),[]);
  useEffect(()=>{const k=`rush-onboarding-${guide.id}`;if(!localStorage.getItem(k)){const t=setTimeout(()=>setWizardOpen(true),800);return()=>clearTimeout(t);}},[guide.id]);
  const handleWizardClose=useCallback(()=>{localStorage.setItem(`rush-onboarding-${guide.id}`,"done");setWizardOpen(false);},[guide.id]);
  // (effets « Reprendre ? » déplacés après la dérivation du repère principal — voir plus bas)
  // Temps réel WS (Phase 1) : plus de polling router.refresh() toutes les 2 min.
  // La présence est portée par useGuidePresence (voir plus bas).
const contentMilestones=useMemo(()=>milestones.filter(ms=>ms.type!=="SEPARATEUR"&&ms.type!=="INFO"&&ms.type!=="DOFUS_OBTAINED"),[milestones]);
const timelineItems=useMemo(()=>{const s=[...milestones].sort((a,b)=>a.order-b.order);type TI={kind:"separator";ms:Milestone}|{kind:"info";ms:Milestone}|{kind:"chapter";chapterNum:number;label:string;showHeader:boolean;milestoneList:Milestone[]};const r:TI[]=[];let b:Milestone[]=[];let bc:number|null=null;let bl="";let bsh=true;let lch:number|null=null;const f=()=>{if(b.length){r.push({kind:"chapter",chapterNum:bc!,label:bl,showHeader:bsh,milestoneList:b});b=[];bc=null;bl="";bsh=true;}};for(const ms of s){if(ms.type==="SEPARATEUR"){f();r.push({kind:"separator",ms});continue;}if(ms.type==="INFO"||ms.type==="DOFUS_OBTAINED"){f();r.push({kind:"info",ms});continue;}if(dofusFilter&&ms.dofusId!==dofusFilter)continue;const nh=ms.chapter!==lch;if(bc===null||bc!==ms.chapter){f();bc=ms.chapter;bl=ms.chapterLabel;bsh=nh;if(nh)lch=ms.chapter;}b.push(ms);}f();return r;},[milestones,dofusFilter]);
  const guildProgressByMs=useMemo(()=>{const m=new Map<string,GuildMemberProgress[]>;guildProgress.forEach(p=>{if(!p.isCompleted){if(!m.has(p.milestoneId))m.set(p.milestoneId,[]);m.get(p.milestoneId)!.push(p);}});return m;},[guildProgress]);
  // ─── Guild progress by sequence (members with currentStep/bookmark on a specific seq) ──
  const guildProgressBySeq=useMemo(()=>{const m=new Map<string,GuildMemberProgress[]>;guildProgress.forEach(p=>{if(p.currentStep&&p.currentStep.startsWith("seq:")){const seqId=p.currentStep.slice(4);if(!m.has(seqId))m.set(seqId,[]);m.get(seqId)!.push(p);}});return m;},[guildProgress]);
  const tMs=contentMilestones.length;const completedCount=contentMilestones.filter(ms=>completedIds.has(ms.id)).length;
  const overallPercent=tMs>0?Math.round((completedCount/tMs)*100):0;
  const activeMembersCount=useMemo(()=>new Set(guildProgress.map(p=>p.profileId)).size,[guildProgress]);
  const setLoading=useCallback((msId:string,val:boolean)=>setLoadingIds(prev=>{const n=new Set(prev);val?n.add(msId):n.delete(msId);return n;}),[]);
  const handleToggleSequence=useCallback(async(ms:Milestone,seqId:string)=>{const cur=new Set(completedStepsByMs.get(ms.id)||[]);const was=cur.has(seqId);was?cur.delete(seqId):cur.add(seqId);const arr=Array.from(cur);const regularSeqs=ms.sequences.filter((s:any)=>!isInfoSequence(s));const allChecked=regularSeqs.length>0&&regularSeqs.every((s:any)=>cur.has(s.id));const wasMilestoneCompleted=completedIds.has(ms.id);setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,cur);return n;});setCompletedIds(prev=>{const n=new Set(prev);allChecked?n.add(ms.id):n.delete(ms.id);return n;});setLoading(ms.id,true);try{const res=await updateStepProgress(guildId,ms.id,arr,effectiveAltPseudo);if((res as any).success){if(res.isCompleted&&!wasMilestoneCompleted){toast.success("✅ Bloc validé !",{duration:1500});}else{toast.success(was?"Décocher":"✅ Validée !",{duration:1500});}}else{setCompletedStepsByMs(prev=>{const n=new Map(prev);was?cur.add(seqId):cur.delete(seqId);n.set(ms.id,cur);return n;});setCompletedIds(prev=>{const n=new Set(prev);allChecked?n.delete(ms.id):n.add(ms.id);return n;});toast.error("Erreur");}}catch{setCompletedStepsByMs(prev=>{const n=new Map(prev);was?cur.add(seqId):cur.delete(seqId);n.set(ms.id,cur);return n;});setCompletedIds(prev=>{const n=new Set(prev);allChecked?n.delete(ms.id):n.add(ms.id);return n;});toast.error("Erreur réseau");}finally{setLoading(ms.id,false);}},[completedStepsByMs,completedIds,guildId,effectiveAltPseudo,setLoading]);
  const handleToggle=useCallback(async(ms:Milestone)=>{const was=completedIds.has(ms.id);setCompletedIds(prev=>{const n=new Set(prev);was?n.delete(ms.id):n.add(ms.id);return n;});setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,was?new Set():new Set(ms.sequences.map(s=>s.id)));return n;});setLoading(ms.id,true);try{const res=await toggleMilestoneProgress(guildId,ms.id,!was,effectiveAltPseudo);if(!(res as any).success){setCompletedIds(prev=>{const n=new Set(prev);was?n.add(ms.id):n.delete(ms.id);return n;});toast.error("Erreur");}else toast.success(was?"Décochée":"✅ Bloc validé !",{duration:1500});}catch{toast.error("Erreur réseau");}finally{setLoading(ms.id,false);}},[completedIds,guildId,effectiveAltPseudo,setLoading]);
  const handleReset=useCallback(async(ms:Milestone)=>{setCompletedIds(prev=>{const n=new Set(prev);n.delete(ms.id);return n;});setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,new Set);return n;});setLoading(ms.id,true);try{await resetMilestoneProgress(guildId,ms.id,effectiveAltPseudo);toast.success("Réinitialisée");}catch{setCompletedIds(prev=>new Set([...prev,ms.id]));toast.error("Erreur reset");}finally{setLoading(ms.id,false);}},[guildId,effectiveAltPseudo,setLoading]);
  // Ensemble de toutes les séquences complétées (à travers tous les blocs)
  const allCompletedSeqIds = useMemo(() => {
    const all = new Set<string>();
    completedStepsByMs.forEach(steps => steps.forEach(id => all.add(id)));
    return all;
  }, [completedStepsByMs]);

  // Séquences bloquées par un prérequis non terminé → impossible d'y poser son repère
  const blockedSeqIds = useMemo(() => {
    const out = new Set<string>();
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO") continue;
      for (const seq of ms.sequences) {
        const prereqNames = Array.isArray(seq.activityTags)
          ? seq.activityTags.filter((x: any) => x.type === "prereq_text").map((x: any) => x.name?.toLowerCase()).filter(Boolean)
          : [];
        if (prereqNames.length === 0) continue;
        const blocked = milestones.some((candidateMs: any) =>
          candidateMs.type !== "SEPARATEUR" &&
          candidateMs.type !== "INFO" &&
          candidateMs.sequences.some((candidateSeq: any) => {
            if (candidateSeq.id === seq.id) return false;
            const candidateName = (candidateSeq.subGuideName || candidateSeq.subGuideRef || "").toLowerCase();
            return prereqNames.includes(candidateName) && !allCompletedSeqIds.has(candidateSeq.id);
          })
        );
        if (blocked) out.add(seq.id);
      }
    }
    return out;
  }, [milestones, allCompletedSeqIds]);

  // ─── Bookmark par séquence ─────────────────────────────────────────────
  // 1 max par bloc : bookmarker une quête remplace le repère du même bloc
  const handleBookmarkSequence = useCallback(async (seqId: string, ms: Milestone) => {
    const wasBookmarked = bookmarksByMs.get(ms.id) === seqId;
    // 🚫 Refuser de poser un repère sur une quête bloquée par un prérequis non terminé
    if (!wasBookmarked && blockedSeqIds.has(seqId)) {
      toast.warning("Prérequis non terminé — impossible de poser votre repère sur cette quête.");
      return;
    }
    setBookmarksByMs(prev => {
      const next = new Map(prev);
      if (wasBookmarked) next.delete(ms.id);
      else next.set(ms.id, seqId);
      return next;
    });
    try { await updateBookmarkedStep(guildId, ms.id, wasBookmarked ? null : `seq:${seqId}`); } catch {}
  }, [bookmarksByMs, guildId, blockedSeqIds]);
  if(guide.isUnderConstruction)return<div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8"><motion.div animate={{rotate:[0,-5,5,-5,0]}} transition={{repeat:Infinity,duration:3}} className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20"><Construction className="w-12 h-12 text-amber-400"/></motion.div><div><h2 className="text-2xl font-black text-white mb-2">En construction 🚧</h2><p className="text-zinc-400 text-sm">Le staff prépare ce guide. Reviens bientôt !</p></div></div>;
  const handleScrollToPrereq = useCallback((seqName: string) => {
    let foundId: string | null = null;
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO") continue;
      for (const seq of ms.sequences) {
        const matchName = seq.subGuideName || seq.subGuideRef || "";
        if (matchName.toLowerCase() === seqName.toLowerCase() || matchName.toLowerCase().includes(seqName.toLowerCase())) {
          foundId = seq.id;
          break;
        }
      }
      if (foundId) break;
    }
    if (foundId) {
      setFocusedSeqId(foundId);
      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        const el = document.querySelector(`[data-seq-id="${foundId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-emerald-400", "ring-offset-2", "ring-offset-zinc-950");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-emerald-400", "ring-offset-2", "ring-offset-zinc-950");
          }, 3500);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryScroll, 200 + attempts * 100);
        }
      };
      setTimeout(tryScroll, 300);
    }
  }, [milestones]);
  const helpStorageKey = `rush-contextual-help:${guide.id}`;
  const [contextualHelpEnabled, setContextualHelpEnabled] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(helpStorageKey);
      if (stored === null) {
        setContextualHelpEnabled(true);
        localStorage.setItem(helpStorageKey, 'true');
      } else {
        setContextualHelpEnabled(stored === 'true');
      }
    }
  }, [helpStorageKey]);
  const toggleContextualHelp = useCallback(() => {
    setContextualHelpEnabled(prev => {
      const next = !prev;
      localStorage.setItem(helpStorageKey, next ? 'true' : 'false');
      return next;
    });
  }, [helpStorageKey]);

  // ─── Helper pur : vérifier si une séquence a un prérequis réellement non terminé ──
  const isActuallyBlocked = useCallback((seq: Sequence): boolean => {
    const prereqNames = Array.isArray(seq.activityTags)
      ? seq.activityTags.filter((x:any) => x.type === "prereq_text").map((x:any) => x.name?.toLowerCase()).filter(Boolean)
      : [];
    if (prereqNames.length === 0) return false;
    return milestones.some((candidateMs) =>
      candidateMs.type !== "SEPARATEUR" &&
      candidateMs.type !== "INFO" &&
      candidateMs.sequences.some((candidateSeq) => {
        if (candidateSeq.id === seq.id) return false;
        const candidateName = (candidateSeq.subGuideName || candidateSeq.subGuideRef || "").toLowerCase();
        return prereqNames.includes(candidateName) && !allCompletedSeqIds.has(candidateSeq.id);
      })
    );
  }, [milestones, allCompletedSeqIds]);

  // ─── Computed active/next sequences ─────────────────────────────────────
  const findNextActionableSequence = useCallback(() => {
    // First non-completed, non-blocked sequence (le repère par bloc ne force plus l'« active »)
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO" || ms.type === "DOFUS_OBTAINED") continue;
      for (const seq of ms.sequences) {
        if (isInfoSequence(seq)) continue;
        if (!allCompletedSeqIds.has(seq.id) && !isActuallyBlocked(seq)) {
          return { milestone: ms, sequence: seq };
        }
      }
    }
    return null;
  }, [milestones, allCompletedSeqIds, isActuallyBlocked]);

  const findNextSequenceAfter = useCallback((currentMsId: string, currentSeqId: string) => {
    let foundCurrent = false;
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO" || ms.type === "DOFUS_OBTAINED") continue;
      for (const seq of ms.sequences) {
        if (isInfoSequence(seq)) continue;
        if (!foundCurrent) {
          if (ms.id === currentMsId && seq.id === currentSeqId) {
            foundCurrent = true;
          }
          continue;
        }
        if (!allCompletedSeqIds.has(seq.id) && !isActuallyBlocked(seq)) {
          return { milestone: ms, sequence: seq };
        }
      }
    }
    return null;
  }, [milestones, allCompletedSeqIds, isActuallyBlocked]);

  const actionableSeq = useMemo(() => findNextActionableSequence(), [findNextActionableSequence]);
  const activeSeqId = actionableSeq?.sequence.id || null;
  const activeMsId = actionableSeq?.milestone.id || null;
  const nextSeq = useMemo(() => {
    if (!activeSeqId || !activeMsId) return null;
    return findNextSequenceAfter(activeMsId, activeSeqId);
  }, [activeMsId, activeSeqId, findNextSequenceAfter]);
  const nextSeqId = nextSeq?.sequence.id || null;

  // ─── Repère « principal » : repère du bloc ACTIF, sinon 1er repère du guide ─
  const primaryBookmark = useMemo(() => {
    if (activeMsId && bookmarksByMs.has(activeMsId)) {
      return { msId: activeMsId, seqId: bookmarksByMs.get(activeMsId)! };
    }
    for (const ms of milestones) {
      const seqId = bookmarksByMs.get(ms.id);
      if (seqId) return { msId: ms.id, seqId };
    }
    return null;
  }, [bookmarksByMs, activeMsId, milestones]);
  const effectiveBookmarkSeqId = primaryBookmark?.seqId || null;
  const bookmarkedMsId = primaryBookmark?.msId || null;

  // ─── Temps réel (Phase 1) : useGuidePresence (même hook que Ganymède) ───────
  const guideLive = useGuidePresence({
    guildId,
    guideSlug: guide.slug,
    milestoneId: bookmarkedMsId,
    userName: currentUserProfile?.pseudoDofus || selectedCharacter,
    enabled: !incognito,
  });

  // Membres présents : WS si connecté, sinon fallback sur les props serveur.
  const livePresenceMembers = useMemo(() => {
    if (guideLive.connectionStatus === "connected" && guideLive.presence.length > 0) {
      return guideLive.presence;
    }
    const seen = new Set<string>();
    return (guildProgress || [])
      .filter((p: any) => { if (seen.has(p.profileId)) return false; seen.add(p.profileId); return true; })
      .map((p: any) => ({ profileId: p.profileId, userName: p.userName, userAvatar: p.userAvatar, milestoneId: p.milestoneId }));
  }, [guideLive.connectionStatus, guideLive.presence, guildProgress]);

  // « Reprendre ? » : 1 popup par session et par jalon repéré
  useEffect(()=>{if(!bookmarkedMsId||continueShownThisSession.current){setContinueModalOpen(false);return;}const k=`rush-continue-${guide.id}-${bookmarkedMsId}`;if(!localStorage.getItem(k)){continueShownThisSession.current=true;const t=setTimeout(()=>setContinueModalOpen(true),1200);return()=>clearTimeout(t);}},[guide.id,bookmarkedMsId]);
  useEffect(()=>{if(!bookmarkedMsId)setContinueModalOpen(false);},[bookmarkedMsId]);

  // ─── Scroll / resume helpers ────────────────────────────────────────────
  const scrollToSequence = useCallback((seqId: string) => {
    handleFocusSequence(seqId);
    let attempts = 0;
    const maxAttempts = 10;
    const tryScroll = () => {
      const el = document.querySelector(`[data-seq-id="${seqId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-emerald-400", "ring-offset-2", "ring-offset-zinc-950");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-emerald-400", "ring-offset-2", "ring-offset-zinc-950");
        }, 3500);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 200 + attempts * 100);
      }
    };
    setTimeout(tryScroll, 300);
  }, [handleFocusSequence]);

  const scrollToActive = useCallback(() => {
    if (activeSeqId) scrollToSequence(activeSeqId);
  }, [activeSeqId, scrollToSequence]);

  const scrollToTop = useCallback(() => {
    const scrollEl = document.querySelector<HTMLElement>('[data-scroll-container]');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    const scrollEl = document.querySelector<HTMLElement>('[data-scroll-container]');
    if (scrollEl) scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    else window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'smooth' });
  }, []);

  // ─── Search state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // resumeRush priorité : 1) bookmarkedSeqId 2) activeSeqId 3) toast
  const resumeRush = useCallback(() => {
    if (searchQuery) setSearchQuery("");
    if (effectiveBookmarkSeqId) {
      scrollToSequence(effectiveBookmarkSeqId);
    } else if (activeSeqId) {
      scrollToSequence(activeSeqId);
    } else {
      toast("Aucune étape à reprendre", { duration: 2000 });
    }
  }, [effectiveBookmarkSeqId, activeSeqId, scrollToSequence, searchQuery]);
  const normalizeSearch = useCallback((s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = normalizeSearch(searchQuery);
    const matchingSeqIds = new Set<string>();
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO") continue;
      for (const seq of ms.sequences) {
        const fields = [
          seq.subGuideName, seq.subGuideRef, seq.tips, seq.note,
          seq.dungeon?.name, seq.dungeon?.bossName,
          ...(seq.dungeons || []).flatMap(d => [d.name, d.bossName]),
          ...(seq.activityTags || []).flatMap(t => [t.name, t.type])
        ];
        if (fields.some(f => f && normalizeSearch(f).includes(q))) {
          matchingSeqIds.add(seq.id);
        }
      }
    }
    return matchingSeqIds;
  }, [searchQuery, milestones, normalizeSearch]);

  return(<><GuildIdCtx.Provider value={guildId}><ContextualHelpCtx.Provider value={contextualHelpEnabled}><ActiveSeqIdCtx.Provider value={activeSeqId}><NextSeqIdCtx.Provider value={nextSeqId}><BookmarkedSeqCtx.Provider value={bookmarksByMs}><OnBookmarkSeqCtx.Provider value={handleBookmarkSequence}><GuildProgressBySeqCtx.Provider value={guildProgressBySeq}><CapturedMonsterNamesCtx.Provider value={capturedMonsterNamesMemo}><CapturedMonsterCtx.Provider value={capturedMonsterSet}><AllMilestonesCtx.Provider value={milestones}><AllCompletedSeqIdsCtx.Provider value={allCompletedSeqIds}><ScrollToPrereqCtx.Provider value={handleScrollToPrereq}><style>{`footer,.site-footer,.app-footer,nav[class*="footer"]{display:none!important}`}</style>
  <div className="flex flex-col gap-5">
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950">
      <div className="relative flex flex-col gap-6">
        {/* Top Header Navigation & Meta Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/10 pb-4">
          <Link
            href={`/dashboard/${guildId}/quetes-dofus`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900/90 hover:bg-zinc-800 hover:border-emerald-500/40 text-caption font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-all shadow-sm group"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quêtes Dofus</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Conseillé dès le <strong className="text-white font-black">Niv. 200</strong></span>
            </div>

            <ContextualHelp label="Aide Rush Sylvestre">
              <p className="font-bold text-emerald-400 mb-1">📖 Guide Rush Sylvestre</p>
              <p>Ce module interactif vous permet de suivre votre timeline pas à pas. Cliquez sur le bouton <strong className="text-amber-400">JE SUIS ICI</strong> pour poser votre repère de reprise visible par vos coéquipiers de guilde.</p>
            </ContextualHelp>

            <QuestFeedbackButton
              guildId={guildId}
              sourcePage={`guide:${guide.slug}`}
              targetSlug={guide.slug}
              compact
            />

            <button
              type="button"
              onClick={() => window.open(
                `/overlay/guide/${guildId}/${guide.slug}`,
                "sigil-overlay",
                "width=420,height=700,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no"
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-800/60 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-zinc-800 transition-all text-caption font-black uppercase tracking-widest"
              title="Ouvrir le guide en mode overlay — juxtaposable en jeu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Overlay
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-emerald-400"/>
              <span className="text-caption font-black uppercase tracking-widest text-emerald-400/60">Guide Rush — Timeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white" style={{fontFamily:"var(--font-cinzel)"}}>{guide.name}</h2>
            {guide.description&&<p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xl leading-relaxed">{guide.description}</p>}
          </div>
          <img src="/module-dofus/Dofus_Sylvestre.png" alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain flex-shrink-0"/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-3 bg-zinc-950/80 border border-zinc-800/60 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/50 flex items-center justify-center overflow-hidden shrink-0">{(()=>{const d=localProfile?.dofusClass?getClass(localProfile.dofusClass):null;return d?<img src={d.icon} alt={d.name} className="w-full h-full object-contain p-0.5"/>:<span className="text-caption font-black text-zinc-400">?</span>;})()}</div>
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-caption font-black text-zinc-500 uppercase tracking-wider font-[family-name:var(--font-cinzel)]">Personnage Actif</p>
                <ContextualHelp label="Aide Personnage">
                  <p className="font-bold text-white mb-1">🎭 Personnages & Mules</p>
                  <p>Basculez facilement entre votre personnage principal et vos mules. La validation des étapes et la position de reprise sont sauvegardées séparément par personnage.</p>
                </ContextualHelp>
              </div>
              <div className="flex flex-nowrap items-center gap-1.5 min-w-0">
                <div className="min-w-0 shrink">
                  {localProfile?.pseudoDofus ? (
                    <CharacterSelectorDropdown selectedCharacter={selectedCharacter} mainPseudo={localProfile.pseudoDofus} mainClass={localProfile?.dofusClass||null} mules={mules||[]} guildId={guildId} />
                  ) : (
                    <Link href={`/dashboard/${guildId}/profile`} className="inline-flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30">
                      <Pencil className="w-3 h-3" />
                      Lier mon pseudo
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => setResetModalOpen(true)}
                  className="flex items-center justify-center p-2 rounded-lg text-caption font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all shadow-sm shrink-0"
                  title={`Réinitialiser ${selectedCharacter}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <button type="button" onClick={openAlignEdit} title="Modifier l'alignement" className="flex items-center gap-3 p-3 bg-zinc-950/80 border border-zinc-800/60 rounded-xl shadow-sm text-left cursor-pointer hover:border-emerald-500/30 transition-colors">{(()=>{const{alignment,alignmentOrder,alignmentLevel}=resolvedCharacterInfo;if(!alignment||alignment==="neutre")return<><div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/50 flex items-center justify-center shrink-0"><img src="/ordres/neutre.png" alt="" className="w-5 h-5 object-contain opacity-50"/></div><div className="text-left min-w-0 flex-1"><p className="text-caption font-black text-zinc-500 uppercase tracking-wider">Alignement</p><p className="text-xs font-bold text-zinc-400">{!alignment?"Non défini":"Neutre"}</p></div><Pencil className="w-3.5 h-3.5 text-zinc-500 shrink-0"/></>;const ad=getAlignment(alignment);const ords=(ORDERS as unknown as Record<string,any[]>)[alignment.toLowerCase()]||[];const od=alignmentOrder?ords.find((o:any)=>o.id===alignmentOrder):null;if(od){const ib=alignment==="bontarien";const trancheTitle=alignmentLevel>0?((od as any).levels?.[alignmentLevel]||""):"";return<><div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ib?"bg-blue-500/10 border-blue-500/20":"bg-red-500/10 border-red-500/20"}`}><img src={od.icon} alt="" className="w-5 h-5 object-contain"/></div><div className="text-left min-w-0 flex-1"><p className="text-caption font-black text-zinc-500 uppercase tracking-wider">Ordre</p><p className={`text-xs font-black ${ib?"text-blue-300":"text-red-300"}`}>{od.name}</p><div className="flex flex-wrap items-center gap-1 mt-0.5">{alignmentLevel>0&&<span className="inline-flex items-center gap-0.5 text-caption font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Tranche {alignmentLevel}</span>}{trancheTitle&&<span className="text-caption font-bold text-zinc-400">{trancheTitle}</span>}</div></div><Pencil className="w-3.5 h-3.5 text-zinc-500 shrink-0"/></>;}return<><div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/50 flex items-center justify-center shrink-0">{ad&&<img src={ad.icon} alt="" className="w-5 h-5 object-contain"/>}</div><div className="text-left min-w-0 flex-1"><p className="text-caption font-black text-zinc-500 uppercase tracking-wider">Alignement</p><div className="flex items-center gap-1.5"><span className="text-xs font-bold text-white">{ad?.name||alignment}</span>{alignmentLevel>0&&<span className="text-caption font-bold text-amber-400">lv.{alignmentLevel}</span>}</div></div><Pencil className="w-3.5 h-3.5 text-zinc-500 shrink-0"/></>;})()}</button>
          <div className="flex items-center gap-3 p-3 bg-zinc-950/80 border border-zinc-800/60 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <img src="/assets/icons/ocre.png" alt="Ocre" className="w-6 h-6 object-contain" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-caption font-black text-amber-400/70 uppercase tracking-wider font-[family-name:var(--font-cinzel)]">Metamob</p>
              <div className="flex items-center gap-2 mt-0.5">
                {currentUserProfile?.metamobPseudo ? (
                  <button type="button" onClick={() => setOcreModalOpen(true)} className="flex items-center gap-1.5 text-xs font-black text-amber-300 hover:text-amber-200 transition-colors cursor-pointer" title="Voir ma collection Ocre (Gardiens & Archis)">
                    {ocreStats
                      ? <><span>Gardiens <span className="font-mono text-white">{ocreStats.bosses?.gathered??0}<span className="text-zinc-500">/{ocreStats.bosses?.total??51}</span></span></span><span className="text-zinc-600">·</span><span>Archis <span className="font-mono text-white">{ocreStats.archis?.gathered??0}<span className="text-zinc-500">/{ocreStats.archis?.total??286}</span></span></span><ChevronRight className="w-3 h-3 text-amber-400/60 shrink-0"/></>
                      : <span className="text-caption font-bold text-amber-400/80">Voir ma collection →</span>
                    }
                  </button>
                ) : (
                  <button onClick={()=>setMetamobLinkOpen(true)} className="flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain" />
                    Lier Metamob
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-950/80 border border-zinc-800/60 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-caption font-black text-emerald-400/70 uppercase tracking-wider font-[family-name:var(--font-cinzel)]">Rush Live</p>
                {guideLive.connectionStatus === "connected" && (
                  <span className="flex items-center gap-1 text-caption font-black uppercase tracking-widest text-emerald-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRushLiveModalOpen(true)}
                className="flex items-center gap-1.5 mt-1 min-w-0 cursor-pointer"
                title="Voir les membres connectés sur le guide"
              >
                <span className="text-xs font-black text-emerald-300">{livePresenceMembers.length} en ligne</span>
                {livePresenceMembers.length > 0 && (
                  <span className="flex -space-x-1.5 ml-1">
                    {livePresenceMembers.slice(0, 4).map((m: any) => (
                      <span key={m.profileId || m.userName} className="w-5 h-5 rounded-full overflow-hidden bg-emerald-900 flex items-center justify-center border border-zinc-950 flex-shrink-0" title={m.userName}>
                        {m.userAvatar ? (
                          <img src={m.userAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-caption font-black text-emerald-300">{String(m.userName || "?")[0]?.toUpperCase()}</span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
                <ChevronRight className="w-3 h-3 text-emerald-400/60 shrink-0" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-1">
          <span className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">Progression<ContextualHelp label="Aide progression">La progression se synchronise en temps réel avec les autres membres connectés. Chaque quête cochée met à jour le pourcentage global.</ContextualHelp></span>
          <span className="text-lg font-black text-white">{overallPercent}%</span>
          <span className="text-caption text-zinc-600 font-mono">({completedCount}/{tMs})</span>
          <div className="h-2 bg-zinc-800/60 rounded-full flex-1 max-w-[300px] ml-auto shadow-inner">
            <div className="h-full rounded-full transition-all duration-300 shadow-sm" style={{width:`${overallPercent}%`,background:"linear-gradient(90deg, #10b981, #34d399)"}}/>
          </div>
        </div>
    </div></div>
    {/* ── Ticker temps réel (Phase 1) — mêmes events que Ganymède ────────── */}
    <LiveActivityTicker events={guideLive.events} />
    {/* ── Modale Rush Live : membres connectés sur le guide ─────────────── */}
    <Dialog open={rushLiveModalOpen} onOpenChange={(open) => { if (!open) setRushLiveModalOpen(false); }}>
      <DialogContent className="sm:max-w-sm bg-zinc-950 border-white/10 shadow-2xl p-0 gap-0">
        <DialogHeader className="p-4 border-b border-white/5">
          <DialogTitle className="text-sm font-black text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Membres sur le guide ({livePresenceMembers.length})
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 max-h-[300px] overflow-y-auto space-y-1">
          {livePresenceMembers.length === 0 ? (
            <p className="text-xs text-zinc-500 italic px-1">Aucun membre pour l'instant</p>
          ) : (
            livePresenceMembers.map((m: any) => (
              <div key={m.profileId || m.userName} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  {m.userAvatar ? (
                    <img src={m.userAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-caption font-black text-emerald-300">{String(m.userName || "?")[0]?.toUpperCase()}</span>
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-200">{m.userName}</span>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="p-3 border-t border-white/5">
          <Button onClick={() => setRushLiveModalOpen(false)} variant="ghost" size="sm" className="text-zinc-400 text-xs">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* ── Barre d'actions ────────────────────────────────────────────────── */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sticky top-20 z-[var(--z-sticky-hud)] flex-wrap">
      <div className="relative flex-1 min-w-0 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          data-tour="quest-search"
          aria-label="Rechercher dans le guide"
          placeholder="Rechercher une quête, un donjon ou une zone…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <ContextualHelp label="Aide recherche">Recherche par nom de quête, donjon ou zone. Les résultats s'affichent en temps réel et incluent les quêtes terminées.</ContextualHelp>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800/80 hover:border-white/15 hover:text-white transition-all text-caption font-black uppercase tracking-widest shrink-0" aria-label="Options du guide">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Options</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-950/95 border-zinc-800/60 text-white min-w-[220px] rounded-xl p-1.5 z-[var(--z-dropdown)]">
          <DropdownMenuItem onClick={() => setHideDone(v => !v)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer">
            {hideDone ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
            <span className="text-xs font-bold">{hideDone ? "Afficher tout" : "Masquer les terminées"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleIncognito} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer">
            <Ghost className={`w-4 h-4 ${incognito ? "text-purple-400" : "text-zinc-400"}`} />
            <span className="text-xs font-bold">{incognito ? "Mode discret : actif" : "Mode discret"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            toggleContextualHelp();
            if (contextualHelpEnabled) toast("Aide désactivée", { duration: 1500 });
            else toast("💡 Aide activée : des bulles d'aide apparaissent sur les éléments clés", { duration: 3000, icon: "❓" });
          }} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer">
            <CircleHelp className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-bold">{contextualHelpEnabled ? "Désactiver l'aide" : "Activer l'aide"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetModalOpen(true)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-red-400">
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-bold">Réinitialiser le guide</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {/* ── Résultats de recherche ─────────────────────────────────────────── */}
    {searchResults !== null && (
      <div className="flex items-center justify-between px-1">
        <p className="text-caption text-zinc-500 font-mono">
          {searchResults.size} quête(s) trouvée(s) pour « {searchQuery} »
        </p>
        <button onClick={() => setSearchQuery("")}
          className="text-caption text-zinc-600 hover:text-white transition-colors underline underline-offset-2"
        >
          Effacer la recherche
        </button>
      </div>
    )}
    {searchResults !== null && searchResults.size > 0 && (
      <p className="text-caption text-zinc-600 italic px-1">Les résultats incluent les quêtes terminées.</p>
    )}
    {searchResults !== null && searchResults.size === 0 && (
      <div className="py-16 text-center">
        <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-600 font-black uppercase text-xs tracking-widest mb-1">Aucune quête trouvée</p>
        <p className="text-caption text-zinc-500 mb-4">Essaie un autre nom de quête, donjon ou zone.</p>
        <button onClick={() => setSearchQuery("")}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs transition-colors"
        >
          Effacer la recherche
        </button>
      </div>
    )}
    <GuildStatusPanel milestones={contentMilestones} guildProgress={guildProgress}/>
    {/* ── CSS grid responsive (timeline + sidebar) ── */}
    <style>{`
      .rush-content-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 260px;
        gap: 24px;
        align-items: start;
      }
      @media (max-width: 900px) {
        .rush-content-grid {
          grid-template-columns: 1fr;
        }
        .rush-content-grid .rush-sidebar {
          display: none;
        }
      }
    `}</style>
    <div className="rush-content-grid">
      <div className="min-w-0">
        {milestones.length===0?<div className="py-16 text-center"><BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-600 font-black uppercase text-xs tracking-widest">Aucun objectif</p></div>:<div className="relative pl-[28px] space-y-1">{timelineItems.map((item:any)=>item.kind==="separator"?<SectionDivider key={item.ms.id} title={item.ms.title} accentColor={item.ms.accentColor||"#d4a853"}/>:item.kind==="info"?<div key={item.ms.id} className="-ml-1">{item.ms.type==="DOFUS_OBTAINED"?<DofusObtainedBanner milestone={item.ms}/>:<InfoBanner milestone={item.ms}/>}</div>:<ChapterBlock key={`ch-${item.chapterNum}`} chapterNum={item.chapterNum} label={item.label} showHeader={item.showHeader} milestones={item.milestoneList} completedIds={completedIds} completedStepsByMs={completedStepsByMs} bookmarksByMs={bookmarksByMs} guildProgressByMs={guildProgressByMs} hideDone={hideDone} loadingIds={loadingIds} dofusFilter={null} userAlignmentInfo={resolvedCharacterInfo} focusedSeqId={focusedSeqId} onFocusSequence={handleFocusSequence} onToggle={handleToggle} onToggleSequence={handleToggleSequence} onReset={handleReset} onDungeonClick={handleDungeonClick} searchFilter={searchResults}/>)}</div>}
      </div>
      <div className="rush-sidebar sticky top-20">
        <RushChapterSidebar
          milestones={contentMilestones as any}
          completedSeqIds={allCompletedSeqIds}
          activeMilestoneId={(() => { for (const [msId] of bookmarksByMs) { return msId; } return null; })()}
        />
      </div>
    </div>
    {/* ── Navigation flottante ───────────────────────────────────────────── */}
    {typeof document !== 'undefined' && createPortal(
      <div className="fixed right-4 z-[var(--z-floating-nav)] flex flex-col items-center gap-1 bg-zinc-950/90 border border-emerald-500/20 rounded-2xl py-2 px-1.5 shadow-2xl"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <button onClick={scrollToTop} disabled={!showScrollTop}
          className={`p-2 rounded-xl transition-all ${showScrollTop ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
          title="Remonter en haut" aria-label="Remonter en haut"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={resumeRush}
          className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
          title="Reviens à la quête où tu t'es arrêté." aria-label="Reviens à la quête où tu t'es arrêté."
        >
          <MapPin className="w-4 h-4" />
        </button>
        <button onClick={scrollToBottom} disabled={!showScrollBottom}
          className={`p-2 rounded-xl transition-all ${showScrollBottom ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
          title="Aller en bas" aria-label="Aller en bas"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>,
      document.body
    )}
    {djModal.open&&<DjPostCreateModal isOpen={true} onClose={()=>setDjModal({open:false})} onCreated={()=>{}} guildId={guildId} initialDungeonId={djModal.dungeonId} initialQuestName={djModal.questName}/>}
    {wizardOpen&&<RushOnboardingWizardModal isOpen={true} guildId={guildId} onClose={handleWizardClose} characters={(()=>{const mainChar={id:"PRINCIPAL",name:currentUserProfile?.pseudoDofus||"Principal",isMule:false,dofusClass:currentUserProfile?.dofusClass,level:200};const mappedMules=(mules||[]).map((m:any)=>({id:m.pseudo||m.id,name:m.pseudo||m.id,isMule:true,dofusClass:m.classe||null,level:m.level||200}));return[mainChar,...mappedMules];})()} selectedCharacter={selectedCharacter} onSelectCharacter={(c:string)=>router.push(`?character=${encodeURIComponent(c)}`)} activeMembers={guildProgress.map(p=>{const tc=contentMilestones.length;const mp=guildProgress.filter(x=>x.profileId===p.profileId);const d=mp.filter(x=>x.isCompleted).length;const pct=tc>0?Math.round((d/tc)*100):0;return{profileId:p.profileId,userName:p.userName,userAvatar:p.userAvatar,percent:pct};})}/>}
    {continueModalOpen&&bookmarkedMsId&&(()=>{const ms=milestones.find(m=>m.id===bookmarkedMsId);if(!ms)return null;return<div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60" onClick={()=>setContinueModalOpen(false)}><div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-3 mb-3"><Flag className="w-5 h-5 text-emerald-400"/><h3 className="text-sm font-black text-white" style={{fontFamily:"var(--font-cinzel)"}}>Reprendre ?</h3></div><p className="text-xs text-zinc-400 mb-4">Tu étais à <strong className="text-white">{ms.title}</strong>.</p><div className="flex gap-2"><button onClick={()=>{const el=document.querySelector(`[data-ms-id="${bookmarkedMsId}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});setContinueModalOpen(false);}} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-caption font-black uppercase tracking-widest">Reprendre</button><button onClick={()=>setContinueModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-caption font-black uppercase tracking-widest">Plus tard</button></div></div></div>;})()}
    {resetModalOpen&&<ResetConfirmModal
      isOpen={resetModalOpen}
      onClose={()=>setResetModalOpen(false)}
      onConfirm={async()=>{setResetLoading(true);try{const{resetGuideProgress}=await import("@/server/actions/optimized-guide-actions");await resetGuideProgress(guildId,guide.id,effectiveAltPseudo);setCompletedIds(new Set);setResetModalOpen(false);toast.success("Réinitialisée !");router.refresh();}catch{toast.error("Erreur");}finally{setResetLoading(false);}}}
      characterName={selectedCharacter}
      isLoading={resetLoading}
    />}
    <Dialog open={metamobLinkOpen} onOpenChange={(open) => {
      setMetamobLinkOpen(open);
      if (!open) { setMetamobLinkError(null); setMetamobPseudoInput(""); setMetamobApiKeyInput(""); setMetamobStep(1); }
    }}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border-white/10 shadow-2xl p-0 gap-0">
        <DialogHeader className="p-8 border-b border-white/5">
          <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
            <img src="/assets/icons/ocre.png" alt="" className="w-6 h-6 object-contain" />
            Lier votre compte Metamob
          </DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${metamobStep === 1 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>1. Pseudo</div>
            <div className="flex-1 h-0.5 bg-zinc-800" />
            <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${metamobStep === 2 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-900 text-zinc-600"}`}>2. Clé API</div>
          </div>
          {metamobStep === 1 ? (
            <div className="space-y-4">
              <label className="text-sm font-bold text-zinc-200">Pseudo Metamob</label>
              <Input placeholder="Ex: MonPseudo" value={metamobPseudoInput} onChange={(e) => setMetamobPseudoInput(e.target.value)} className="h-12 bg-zinc-900/50 border-zinc-800" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-200">Clé API V2</label>
                <a href="https://www.metamob.fr/settings#api" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1 transition-colors">
                  Où trouver ma clé API ? <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Input type="password" placeholder="64 caractères..." value={metamobApiKeyInput} onChange={(e) => setMetamobApiKeyInput(e.target.value)} className="h-12 bg-zinc-900/50 border-zinc-800" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                Votre clé API est requise pour synchroniser automatiquement vos archimonstres et vos quêtes.
              </p>
            </div>
          )}
          {metamobLinkError && <div className="p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-bold">{metamobLinkError}</div>}
        </div>
        <DialogFooter className="p-8 border-t border-white/5 flex gap-3">
          {metamobStep === 1 ? (
            <Button onClick={() => setMetamobStep(2)} disabled={!metamobPseudoInput.trim()} className="w-full bg-amber-600 font-bold">Suivant</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setMetamobStep(1)} className="text-zinc-400">Retour</Button>
              <Button onClick={async () => {
                if (!metamobPseudoInput.trim()) { toast.error("Veuillez entrer un pseudo"); return; }
                setMetamobLinking(true); setMetamobLinkError(null);
                try {
                  const res = await linkOcreAccount({ guildId, pseudo: metamobPseudoInput.trim(), apiKey: metamobApiKeyInput.trim() || undefined, force: false });
                  if (res.success) { toast.success("Compte Metamob lié !"); setMetamobLinkOpen(false); setMetamobPseudoInput(""); setMetamobApiKeyInput(""); window.location.reload(); }
                  else { setMetamobLinkError(res.error || "Erreur de liaison"); }
                } catch { setMetamobLinkError("Erreur réseau"); }
                finally { setMetamobLinking(false); }
              }} disabled={metamobLinking} className="bg-emerald-600 font-bold">
                {metamobLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lier le compte"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <OcreProgressModal
      open={ocreModalOpen}
      onOpenChange={setOcreModalOpen}
      monsters={ocreMonsters as OcreMonsterLite[]}
      bossCount={ocreStats?.bosses}
      archiCount={ocreStats?.archis}
      metamobPseudo={currentUserProfile?.metamobPseudo}
      guildId={guildId}
    />
   </div></ScrollToPrereqCtx.Provider></AllCompletedSeqIdsCtx.Provider></AllMilestonesCtx.Provider></CapturedMonsterCtx.Provider></CapturedMonsterNamesCtx.Provider></GuildProgressBySeqCtx.Provider></OnBookmarkSeqCtx.Provider></BookmarkedSeqCtx.Provider></NextSeqIdCtx.Provider></ActiveSeqIdCtx.Provider></ContextualHelpCtx.Provider></GuildIdCtx.Provider>
  <Dialog open={alignEditOpen} onOpenChange={setAlignEditOpen}>
    <DialogContent className="max-w-lg w-[95vw] bg-zinc-950 border-zinc-800 rounded-3xl p-0 overflow-hidden shadow-2xl">
      <DialogHeader className="p-6 pb-4 border-b border-white/5">
        <DialogTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400"/>Alignement & Ordre
        </DialogTitle>
        <div className="flex items-center gap-2 mt-3">
          {(["alignment","order","tranche"] as const).map((s,i)=>(
            <button key={s} type="button" onClick={()=>{if(s==="order"&&(!alignEditAlignment||alignEditAlignment==="neutre"))return;if(s==="tranche"&&!alignEditOrder)return;setAlignEditStep(s);}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-black uppercase tracking-widest border transition-all ${alignEditStep===s?"bg-emerald-500/20 border-emerald-500/40 text-emerald-300":"border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-caption font-black ${alignEditStep===s?"bg-emerald-500 text-white":"bg-zinc-800 text-zinc-500"}`}>{i+1}</span>
              {s==="alignment"?"Alignement":s==="order"?"Ordre":"Tranche"}
            </button>
          ))}
        </div>
      </DialogHeader>
      <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {alignEditStep==="alignment"&&(
          <div className="grid grid-cols-3 gap-3">
            {ALIGNMENTS.map(align=>(
              <button key={align.id} type="button" onClick={()=>{setAlignEditAlignment(align.id);if(align.id==="neutre"){setAlignEditOrder(null);setAlignEditLevel(0);}else setAlignEditStep("order");}} className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${alignEditAlignment===align.id?"border-emerald-500/60 bg-emerald-500/10":"border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border overflow-hidden ${align.id==="bontarien"?"bg-blue-500/20 border-blue-500/30":align.id==="brakmarien"?"bg-red-500/20 border-red-500/30":"bg-zinc-800 border-zinc-700"}`}>
                  <img src={align.icon} alt={align.name} className="w-8 h-8 object-contain"/>
                </div>
                <span className={`text-caption font-black uppercase tracking-widest ${alignEditAlignment===align.id?"text-white":"text-zinc-400"}`}>{align.name}</span>
                {alignEditAlignment===align.id&&<div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}
              </button>
            ))}
          </div>
        )}
        {alignEditStep==="order"&&alignEditAlignment&&alignEditAlignment!=="neutre"&&(
          <div className="grid grid-cols-1 gap-3">
            {((ORDERS as any)[alignEditAlignment]||[]).map((order:any)=>{
              const isSel=alignEditOrder===order.id;
              const ib=alignEditAlignment==="bontarien";
              return(
                <button key={order.id} type="button" onClick={()=>{setAlignEditOrder(order.id);setAlignEditStep("tranche");}} className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${isSel?(ib?"border-blue-500/60 bg-blue-500/10":"border-red-500/60 bg-red-500/10"):"border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"}`}>
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={order.icon} alt={order.name} className="w-9 h-9 object-contain p-1"/>
                  </div>
                  <span className={`text-sm font-black ${isSel?"text-white":"text-zinc-300"}`}>{order.name}</span>
                  {isSel&&<div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${ib?"bg-blue-500":"bg-red-500"}`}><Check className="w-3 h-3 text-white"/></div>}
                </button>
              );
            })}
          </div>
        )}
        {alignEditStep==="tranche"&&(
          <div className="space-y-4">
            <p className="text-caption font-black text-zinc-500 uppercase tracking-widest">Niveau d'alignement (Tranche)</p>
            <div className="grid grid-cols-1 gap-2">
              {(()=>{const orderData=alignEditAlignment&&alignEditOrder?(ORDERS as any)[alignEditAlignment]?.find((o:any)=>o.id===alignEditOrder):null;return getAlignmentLevelSteps(orderData).map(({level:lvl,title})=>{
                const isSel=alignEditLevel===lvl;
                return(
                  <button key={lvl} type="button" onClick={()=>setAlignEditLevel(lvl)} className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left ${isSel?"border-amber-500 bg-amber-500/15":"border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900"}`}>
                    <span className={`text-sm font-black w-8 shrink-0 ${isSel?"text-amber-400":"text-zinc-500"}`}>{">"}{lvl}</span>
                    <span className={`text-xs font-bold flex-1 ${isSel?"text-white":"text-zinc-400"}`}>{title||`Niveau ${lvl}`}</span>
                    {isSel&&<Check className="w-4 h-4 text-amber-400 shrink-0"/>}
                  </button>
                );
              });})()}
            </div>
          </div>
        )}
      </div>
      <DialogFooter className="p-5 border-t border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {alignEditStep!=="alignment"&&<Button variant="ghost" size="sm" onClick={()=>setAlignEditStep(alignEditStep==="tranche"?"order":"alignment")} className="text-zinc-400 hover:text-white text-xs">← Retour</Button>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={()=>setAlignEditOpen(false)} className="text-zinc-500 hover:text-white text-xs">Annuler</Button>
          <Button onClick={handleAlignEditSave} disabled={alignEditSaving||(!alignEditAlignment)} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5">
            {alignEditSaving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:"Enregistrer"}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</>);}
