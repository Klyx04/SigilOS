"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  BookOpen, Flag, Users, RotateCcw, EyeOff, Eye, ExternalLink,
  BookmarkCheck, Loader2, CheckCheck, ArrowUp,
  Sparkles, Construction, AlertTriangle, Sword, Lock, MapPin, Plus,
  Layers, Pencil, Crown
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
import { RushOnboardingWizardModal } from "@/components/dofus-quests/RushOnboardingWizardModal";
import { getClass, getAlignment, ORDERS } from "@/lib/dofus-assets";
import {
  toggleMilestoneProgress,
  resetMilestoneProgress,
  updateBookmarkedStep,
  updateStepProgress,
} from "@/server/actions/optimized-guide-actions";
import { DofusProgressStrip } from "./DofusProgressStrip";
import { GuildStatusPanel } from "./GuildStatusPanel";
import { QuestGroupRenderer, useQuestGroups } from "./QuestGroup";

// ─── Types ────────────────────────────────────────────────────────────────────
type DungeonRef = { id: string; name: string; bossName: string; imageUrl?: string|null };
type ActivityTag = { type: string; name?: string; level?: number; count?: number; color?: string; url?: string };
type Sequence = { id: string; subGuideRef: string; subGuideName: string; stepFrom?: number|null; stepTo?: number|null; note?: string|null; isOptional: boolean; order: number; dungeon?: DungeonRef|null; dungeons?: DungeonRef[]; dofusdbUrl?: string|null; dofuspourlesnoobsUrl?: string|null; tips?: string|null; alignReq?: string|null; alignOrderReq?: number|null; isSuccess?: boolean; metamobMonsterId?: number|null; activityTags?: ActivityTag[]; };
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
type GuildMemberProgress = { profileId:string; milestoneId:string; isCompleted:boolean; userName:string; userAvatar?:string };
type RushTimelineClientProps = { guide:{id:string;name:string;slug:string;description?:string|null;isUnderConstruction?:boolean;imageUrl?:string|null;isDiscordConfigured?:boolean}; milestones:Milestone[]; guildProgress:GuildMemberProgress[]; guildId:string; selectedCharacter?:string; mules?:any[]; currentUserProfile:{alignment?:string|null;alignmentOrder?:string|null;alignmentLevel?:number;altPseudos?:any[];dofusClass?:string|null;metamobPseudo?:string|null;pseudoDofus?:string|null;}; ocreStats?:{bosses?:{total:number;gathered:number};archis?:{total:number;gathered:number};progressPercent?:number;currentStep?:number;serverName?:string}|null; };
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
function TougliCallout({text,colorStyle="emerald"}:{text:string;colorStyle?:string}){const p=colorStyle==="purple",a=colorStyle==="amber";const bc=p?"border-purple-500":a?"border-amber-500":"border-emerald-500";const bg=p?"from-purple-950/50 via-zinc-950 to-zinc-950":a?"from-amber-950/50 via-zinc-950 to-zinc-950":"from-emerald-950/50 via-zinc-950 to-zinc-950";const parts=[];const rx=/\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;let li=0,m;while((m=rx.exec(text))!==null){if(m.index>li)parts.push(text.slice(li,m.index));if(m[1]&&m[2])parts.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors text-emerald-300 hover:text-emerald-200 decoration-emerald-500/50">{m[1]}<ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-80 shrink-0"/></a>);else if(m[3]){let dl=m[3];if(m[3].includes("dofusdb.fr"))dl="Lien DofusDB ↗";else if(m[3].includes("dofuspourlesnoobs.com"))dl="Lien DofusNoobs ↗";parts.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 transition-colors text-emerald-300 hover:text-emerald-200 decoration-emerald-500/50">{dl}</a>);}li=rx.lastIndex;}if(li<text.length)parts.push(text.slice(li));return <div className={`flex items-start gap-3 p-3 rounded-2xl border-l-4 ${bc} bg-gradient-to-r ${bg} border border-y-white/5 border-r-white/5 shadow-md my-2`}><div className="mt-0.5 shrink-0">{p?"👿":a?"💡":<span className="font-black text-base leading-none text-emerald-400">!</span>}</div><div className="text-xs text-zinc-200 leading-relaxed font-medium">{parts}</div></div>;}
const MemberAvatars=memo(function MemberAvatars({members,max=5}:{members:GuildMemberProgress[];max?:number}){if(!members.length)return null;const s=members.slice(0,max),e=members.length-max;return<div className="flex items-center gap-1"><div className="flex -space-x-1">{s.map(m=><div key={m.profileId} className="w-5 h-5 rounded-full border-2 border-zinc-950 overflow-hidden bg-indigo-900 flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-500/30" title={m.userName}>{m.userAvatar?<img src={m.userAvatar} alt="" className="w-full h-full object-cover"/>:<span className="text-[7px] font-black text-indigo-300">{m.userName[0]?.toUpperCase()}</span>}</div>)}</div>{e>0&&<span className="text-[7px] font-black text-indigo-400">+{e}</span>}</div>;});

// ─── SequenceRow ──────────────────────────────────────────────────────────────
const SequenceRow = memo(function SequenceRow({ seq, ms, isSeqCompleted, focusedSeqId, accentColor, userAlignmentInfo, onToggleSeq, onDungeonClick, hideSeqCompleted }: {
  seq: Sequence; ms: Milestone; isSeqCompleted: boolean; focusedSeqId?: string|null; accentColor: string; userAlignmentInfo: any; onToggleSeq?: ()=>void; onDungeonClick: (dungeonId: string, questName: string)=>void; hideSeqCompleted?: boolean;
}) {
  const questName=seq.subGuideName||seq.subGuideRef||"Quête sans nom";
  const hasDungeons=(seq.dungeons&&seq.dungeons.length>0)||!!seq.dungeon;
  const allDungeons=seq.dungeons&&seq.dungeons.length>0?seq.dungeons:(seq.dungeon?[seq.dungeon]:[]);
  const dbUrl=seq.dofusdbUrl,noobsUrl=seq.dofuspourlesnoobsUrl;
  const hasAlignment=!!(seq.alignReq&&seq.alignOrderReq);
  let isReqMet=false;let alignInfo:any=null;
  if(hasAlignment&&seq.alignReq&&seq.alignOrderReq){const ua=userAlignmentInfo.alignment?.toLowerCase(),uo=userAlignmentInfo.alignmentOrder?.toLowerCase(),ul=userAlignmentInfo.alignmentLevel??0;if(ua===seq.alignReq.toLowerCase()&&typeof uo==="string"&&ul>=seq.alignOrderReq)isReqMet=true;const ad=getAlignment(seq.alignReq);alignInfo={label:ad?.name||seq.alignReq,met:isReqMet};}
  return <div data-seq-id={seq.id} tabIndex={0} className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-zinc-900/60 hover:border-amber-500/30 hover:bg-zinc-900/80 transition-all cursor-default ${isSeqCompleted?"opacity-50":"shadow-sm"} ${focusedSeqId===seq.id?"ring-1 ring-amber-400/35":""}`}>
    <div className="flex items-start gap-2 min-w-0 flex-1">
      {onToggleSeq&&<button type="button" onClick={e=>{e.stopPropagation();onToggleSeq();}} className="flex-shrink-0 mt-0.5 p-0.5 rounded text-zinc-500 hover:text-emerald-400 transition-colors">{isSeqCompleted?<CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20"/>:<Circle className="w-4 h-4 text-zinc-500 hover:text-zinc-300"/>}</button>}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-bold leading-tight tracking-wide ${isSeqCompleted?"line-through text-zinc-500":"text-white"}`}>{questName}</span>
        {/* Activity tags */}
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {(()=>{const t=seq.activityTags?.find((x:any)=>x.type==="dofus_link");const tn=t?.name;if(!tn)return null;const d=DOFUS_DEFS.find(x=>x.id===tn);if(!d)return null;return<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest animate-pulse" style={{background:d.color+"25",color:d.color}}><img src={d.imageUrl} alt="" className="w-3 h-3 object-contain"/>{d.label}</span>;})()}
          {(()=>{const t=seq.activityTags?.find((x:any)=>x.type==="prereq_text");const pn=t?.name;if(!pn)return null;return<span className="flex items-center gap-1 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"><Lock className="w-2.5 h-2.5"/>Requis:{pn}</span>;})()}
          {alignInfo&&<span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${isReqMet?"text-emerald-400 border-emerald-500/30 bg-emerald-500/10":"text-orange-400 border-orange-500/30 bg-orange-500/10"}`}>{alignInfo.label}{seq.alignOrderReq?` lv.${seq.alignOrderReq}`:""}{isReqMet?"✓":"⚠"}</span>}
          {seq.isOptional&&<span className="text-[7px] text-purple-400 font-black uppercase tracking-widest">Bonus</span>}
          {seq.isSuccess&&<span className="flex items-center gap-1 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400"><img src="/assets/icons/succes.png" alt="" className="w-3 h-3"/>Succès</span>}
          {Array.isArray(seq.activityTags)&&seq.activityTags.filter((t:any)=>!["prereq_text","dofus_link","ocre_dungeon","pos_tags","tougli_box","quest_group"].includes(t.type)).map((tag:any,i:number)=>{
            if(tag.type==="solver"){const su=tag.url||null;return su?<a key={i} href={su} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"><img src="/assets/rush-sylvestre/solver.png" alt="" className="w-3.5 h-3.5 rounded-full"/>Solver<ExternalLink className="w-2 h-2"/></a>:<span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><img src="/assets/rush-sylvestre/solver.png" alt="" className="w-3.5 h-3.5 rounded-full"/>Solver</span>;}
            const def=ACTIVITY_TAGS.find(x=>x.type===tag.type);if(!def)return null;const isMetier=tag.type==="metier";const ip=isMetier?getMetierIconPath(tag.name):def.imagePath;const lb=isMetier&&tag.name?`${tag.name}(${tag.level||1})`:def.label;
            return<span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border bg-zinc-900/90 text-zinc-100 border-white/10"><img src={ip} alt="" className="w-3.5 h-3.5 object-cover rounded-full"/>{tag.count&&tag.count>1&&<span className="text-[8px] text-amber-400 font-bold">x{tag.count}</span>}<span className="truncate max-w-[80px]">{isMetier&&tag.name?`${tag.name} ${tag.level?`N${tag.level}`:""}`:lb}</span></span>;
          })}
          {(()=>{const t=seq.activityTags?.find((x:any)=>x.type==="tougli_box");if(!t?.name)return null;return <TougliCallout text={t.name} colorStyle={t.color||"emerald"}/>;})()}
        </div>
        {seq.tips&&<div className="flex items-start gap-1 mt-1"><Sparkles className="w-2.5 h-2.5 text-amber-400/75 flex-shrink-0 mt-0.5"/><span className="text-[9px] text-amber-300/80 leading-tight">{seq.tips}</span></div>}
        {seq.note&&<div className="flex items-start gap-1 mt-0.5"><AlertTriangle className="w-2.5 h-2.5 text-orange-400/75 flex-shrink-0 mt-0.5"/><span className="text-[9px] text-orange-300/80 leading-tight">{seq.note}</span></div>}
      </div>
    </div>
    {/* Right: dungeon + links */}
    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
      {(()=>{
        // Collect all dungeons: from seq.dungeons[] (new multi) or seq.dungeon (legacy single)
        const djList:any[] = Array.isArray(seq.dungeons)&&seq.dungeons.length>0?seq.dungeons:(allDungeons as any[]);
        if(djList.length===0)return null;
        return <div className="flex items-center gap-1.5 flex-shrink-0">{djList.map((dj:any)=><button key={dj.id} onClick={e=>{e.stopPropagation();onDungeonClick(dj.id,questName);}} className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 transition-all group" title={`DJ: ${dj.name}`}>{dj.imageUrl?<img src={dj.imageUrl} alt={dj.bossName||dj.name} className="w-7 h-7 rounded-lg object-cover border border-white/10 flex-shrink-0"/>:<div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center"><Sword className="w-4 h-4 text-amber-400"/></div>}<span className="text-[8px] font-black text-red-300 hidden sm:block flex items-center gap-1">{dj.name}</span>{Array.isArray(seq.activityTags)&&seq.activityTags.some((t:any)=>t.type==="ocre_dungeon"&&t.name===dj.id)&&<span className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] font-black uppercase tracking-widest"><img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain"/>Ocre</span>}<Plus className="w-3 h-3 text-amber-400 group-hover:scale-125 transition-transform flex-shrink-0"/></button>)}</div>;
      })()}
      {noobsUrl&&<a href={noobsUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all text-[8px] font-black uppercase tracking-wider" title="DofusPourLesNoobs"><img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-4 h-4 rounded-sm shrink-0"/><span className="hidden sm:inline">Noobs</span><ExternalLink className="w-3 h-3 ml-0.5 opacity-70 shrink-0"/></a>}
      {dbUrl&&<a href={dbUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 transition-all text-[8px] font-black uppercase tracking-wider" title="DofusDB"><img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-4 h-4 rounded-sm shrink-0"/><span className="hidden sm:inline">DofusDB</span><ExternalLink className="w-3 h-3 ml-0.5 opacity-70 shrink-0"/></a>}
    </div>
  </div>;
});

// ─── MilestoneRow ─────────────────────────────────────────────────────────────
const MilestoneRow = memo(function MilestoneRow({ ms, isCompleted, completedStepsSet, isBookmarked, membersHere, hideDone, isLoading, accentColor, userAlignmentInfo, focusedSeqId, onFocusSequence, onToggle, onToggleSequence, onReset, onBookmark, onDungeonClick }: any) {
  const [expanded,setExpanded]=useState(false);
  if(ms.type==="SEPARATEUR")return null;
  if(ms.type==="INFO")return <div className="my-2 ml-2"><TougliCallout text={ms.tips||ms.description||ms.title} colorStyle="emerald"/></div>;
  useEffect(()=>{if(isBookmarked)setExpanded(true);},[isBookmarked]);
  useEffect(()=>{if(focusedSeqId&&ms.sequences.some((s:any)=>s.id===focusedSeqId))setExpanded(true);},[focusedSeqId,ms.sequences]);
  if(hideDone&&isCompleted)return null;
  const cs=ms.sequences.filter((s:any)=>isCompleted||completedStepsSet.has(s.id)).length;
  const all=isCompleted||(ms.sequences.length>0&&cs===ms.sequences.length);
  const c=accentColor||"#10b981";
  return <div className={`relative transition-all duration-200 ${isCompleted?"opacity-50":isBookmarked?"opacity-100":"opacity-95 hover:opacity-100"}`}>
    <div className="absolute -left-[25px] top-5 w-3 h-3 rounded-full z-10 transition-all" style={{background:all?c:"transparent",border:`2px solid ${all?c:`${c}60`}`,boxShadow:isBookmarked?`0 0 8px ${c}80`:undefined}}/>
    <div className={`ml-2 rounded-2xl border transition-all ${all?"border-emerald-500/20 bg-zinc-950/30":isBookmarked?"border-amber-500/25 bg-zinc-900/50":"border-white/10 bg-zinc-900/30 hover:border-amber-500/20"}`}>
      {/* Header row — style Dofus premium */}
      <div className="flex items-center gap-3 p-3 cursor-pointer select-none" onClick={()=>setExpanded((v:boolean)=>!v)}>
        {/* Status indicator */}
        <div className="flex-shrink-0 relative">
          {isLoading?<Loader2 className="w-5 h-5 animate-spin" style={{color:c}}/>:
           all?<div className="w-5 h-5 rounded-full flex items-center justify-center" style={{background:`${c}30`}}><CheckCheck className="w-4 h-4" style={{color:c}}/></div>:
           cs>0?<div className="w-5 h-5 rounded-full border-2 border-amber-400/50 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-400/60"/></div>:
           <div className="w-5 h-5 rounded-full border-2 border-zinc-600 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-zinc-600"/></div>}
        </div>
        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black leading-tight tracking-wide font-[family-name:var(--font-cinzel)] ${all?"text-zinc-500":"text-white"}`} style={!all?{color:c}:undefined}>{ms.title}</span>
            {ms.isOptional&&<span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Bonus</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[8px] font-mono font-black text-zinc-500">{completedStepsSet.size>0?`${cs}/${ms.sequences.length}`:`${ms.sequences.length} quête${ms.sequences.length>1?"s":""}`}</span>
            {isBookmarked&&<span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{background:`${c}25`,color:c}}><Flag className="w-2 h-2 inline mr-0.5"/>Rendu ici</span>}
          </div>
        </div>
        {/* Actions */}
        <div className={`flex items-center gap-1 flex-shrink-0 ${isCompleted?"opacity-100":""}`}>
          {!all&&<button onClick={e=>{e.stopPropagation();onToggle();}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[8px] font-black uppercase tracking-widest" title="Valider le bloc"><CheckCircle2 className="w-3 h-3"/>Valider</button>}
          <button onClick={e=>{e.stopPropagation();onBookmark();}} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest ${isBookmarked?"bg-amber-500/15 border-amber-500/40 text-amber-400":"bg-zinc-800/60 border-white/10 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30"}`}>{isBookmarked?<BookmarkCheck className="w-3 h-3 text-amber-400"/>:<Flag className="w-3 h-3"/>}{isBookmarked?"Rendu ici ✓":"J'en suis là"}</button>
          <button onClick={e=>{e.stopPropagation();onReset();}} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest ${isCompleted?"bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30":"bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"}`}><RotateCcw className="w-3 h-3"/>Reset</button>
          {membersHere.length>0&&<MemberAvatars members={membersHere}/>}
          <div className="text-zinc-600 ml-0.5">{expanded?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}</div>
        </div>
      </div>
      {/* Expanded */}
      <AnimatePresence>{expanded&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="px-3 pb-3 space-y-2 pt-1 border-t border-white/5">{ms.sequences.length===0?<div className="py-6 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">Aucune quête</div>:ms.sequences.filter((s:any)=>!hideDone||!completedStepsSet.has(s.id)).map((s:any)=><SequenceRow key={s.id} seq={s} ms={ms} isSeqCompleted={completedStepsSet.has(s.id)} focusedSeqId={focusedSeqId} accentColor={c} userAlignmentInfo={userAlignmentInfo} onToggleSeq={()=>onToggleSequence(ms,s.id)} onDungeonClick={onDungeonClick}/>)}</div></motion.div>}</AnimatePresence>
    </div>
  </div>;
});

// ─── SectionDivider (style Dofus premium) ──────────────────────────────────────
const SectionDivider = memo(function SectionDivider({title,accentColor="#d4a853"}:{title:string;accentColor?:string}) {
  return <div className="relative py-7 my-3 select-none"><div className="flex items-center justify-center gap-4"><div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent via-current to-current opacity-40" style={{color:accentColor}}/><Sparkles className="w-4 h-4" style={{color:accentColor,opacity:0.7}}/><h2 className="font-[family-name:var(--font-cinzel)] text-base sm:text-xl font-bold uppercase tracking-[0.15em] text-center leading-tight px-1" style={{color:accentColor,textShadow:`0 0 20px ${accentColor}30`}}>{title}</h2><Sparkles className="w-4 h-4" style={{color:accentColor,opacity:0.7}}/><div className="h-px flex-1 max-w-[120px] bg-gradient-to-l from-transparent via-current to-current opacity-40" style={{color:accentColor}}/></div></div>;
});

// ─── ChapterBlock ─────────────────────────────────────────────────────────────
const ChapterBlock = memo(function ChapterBlock({ chapterNum,label,showHeader=true,milestones,completedIds,completedStepsByMs,bookmarkedMsId,guildProgressByMs,hideDone,loadingIds,dofusFilter,userAlignmentInfo,focusedSeqId,onFocusSequence,onToggle,onToggleSequence,onReset,onBookmark,onDungeonClick }:any) {
  const ci=milestones.filter((m:any)=>completedIds.has(m.id)).length,ti=milestones.length,all=ci===ti&&ti>0;
  const ac=milestones[0]?.accentColor||"#10b981";const hb=milestones.some((m:any)=>m.id===bookmarkedMsId);const[open,setOpen]=useState(hb||chapterNum===1);
  useEffect(()=>{if(hb)setOpen(true);},[hb]);useEffect(()=>{if(focusedSeqId&&milestones.some((ms:any)=>ms.sequences.some((s:any)=>s.id===focusedSeqId)))setOpen(true);},[focusedSeqId,milestones]);
  const vc=hideDone?milestones.filter((m:any)=>!completedIds.has(m.id)).length:milestones.length;
  if(hideDone&&vc===0)return null;
  return <div className="relative">{showHeader&&<button onClick={()=>setOpen((v:boolean)=>!v)} className="w-full flex items-center gap-3 py-3 group transition-all">
    <div className="relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all group-hover:scale-105" style={{borderColor:all?ac:`${ac}40`,background:all?`${ac}20`:"transparent"}}>{all?<CheckCheck className="w-5 h-5" style={{color:ac}}/>:<span className="text-sm font-black font-[family-name:var(--font-cinzel)]" style={{color:ac}}>{chapterNum}</span>}</div>
    <div className="flex-1 text-left"><div className="flex items-center gap-2"><span className="font-[family-name:var(--font-cinzel)] font-bold uppercase tracking-wider" style={{color:ac,fontSize:"clamp(0.8rem,2vw,1.1rem)"}}>{label}</span><span className="text-[8px] font-black px-2 py-0.5 rounded-full font-mono" style={{background:`${ac}15`,color:ac}}>{ci}/{ti}</span></div><div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5"><div className="h-full rounded-full transition-all duration-500" style={{width:`${ti>0?(ci/ti)*100:0}%`,background:`linear-gradient(90deg, ${ac}, ${ac}99)`}}/></div></div>
    <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 ml-1">{open?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</div>
  </button>}<AnimatePresence>{(open||!showHeader)&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="relative ml-5 pl-5 pb-3 border-l border-white/10 space-y-3">{milestones.filter((ms:any)=>!dofusFilter||ms.dofusId===dofusFilter).map((ms:any)=><MilestoneRow key={ms.id} ms={ms} isCompleted={completedIds.has(ms.id)} completedStepsSet={completedStepsByMs.get(ms.id)||new Set()} isBookmarked={ms.id===bookmarkedMsId} membersHere={guildProgressByMs.get(ms.id)||[]} hideDone={hideDone} isLoading={loadingIds.has(ms.id)} onToggle={()=>onToggle(ms)} onToggleSequence={onToggleSequence} onReset={()=>onReset(ms)} onBookmark={()=>onBookmark(ms)} accentColor={ms.accentColor||ac} userAlignmentInfo={userAlignmentInfo} focusedSeqId={focusedSeqId} onFocusSequence={onFocusSequence} onDungeonClick={onDungeonClick}/>)}</div></motion.div>}</AnimatePresence></div>;
});

// ─── CharacterSelectorDropdown ─────────────────────────────────────────────
function CharacterSelectorDropdown({selectedCharacter,mainPseudo,mainClass,mules,guildId}:{selectedCharacter:string;mainPseudo:string;mainClass:string|null;mules:any[];guildId:string}){
  const router=useRouter();
  const currentLabel=selectedCharacter==="PRINCIPAL"?mainPseudo:selectedCharacter;
  const selClass=selectedCharacter==="PRINCIPAL"?mainClass:mules.find((m:any)=>m.pseudo===selectedCharacter)?.classe||null;
  const selIcon=selClass?(()=>{const d=getClass(selClass);return d?<img src={d.icon} alt={d.name} className="w-4 h-4 object-contain"/>:null;})():selectedCharacter==="PRINCIPAL"?<Crown className="w-3.5 h-3.5 text-amber-500"/>:<Users className="w-3.5 h-3.5 text-blue-400"/>;
  const handleSelect=(char:string)=>{const params=new URLSearchParams(window.location.search);if(char==="PRINCIPAL")params.delete("character");else params.set("character",char);router.push(`${window.location.pathname}?${params.toString()}`);};
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" role="combobox" aria-expanded={false} className="bg-zinc-950/60 backdrop-blur-md border-white/5 hover:border-emerald-500/20 text-white justify-between min-w-[160px] transition-all rounded-xl h-9 px-2.5 cursor-pointer text-xs font-black"><div className="flex items-center gap-2 truncate">{selIcon}<span className="truncate">{currentLabel}</span></div><ChevronDown className="w-3 h-3 opacity-30"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="bg-zinc-950/95 backdrop-blur-xl border-white/5 text-white min-w-[180px] rounded-xl p-1.5 shadow-2xl z-[100]"><DropdownMenuItem onClick={()=>handleSelect("PRINCIPAL")} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter==="PRINCIPAL"?"bg-white/5 text-emerald-400":"hover:bg-white/5"}`}><div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">{mainClass?(()=>{const d=getClass(mainClass);return d?<img src={d.icon} alt="" className="w-4 h-4 object-contain"/>:null;})():<Crown className="w-3 h-3 text-amber-500"/>}</div><div className="flex flex-col text-left"><span className="text-xs font-bold">{mainPseudo}</span><span className="text-[8px] text-zinc-500 font-medium uppercase tracking-widest">{mainClass||"Principal"}</span></div></DropdownMenuItem>{mules.length>0&&<div className="h-px bg-white/5 my-1"/>}{mules.map((mule:any)=><DropdownMenuItem key={mule.pseudo} onClick={()=>handleSelect(mule.pseudo)} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter===mule.pseudo?"bg-white/5 text-emerald-400":"hover:bg-white/5"}`}><div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">{mule.classe?(()=>{const d=getClass(mule.classe);return d?<img src={d.icon} alt="" className="w-4 h-4 object-contain"/>:null;})():<Users className="w-3 h-3 text-blue-400"/>}</div><div className="flex flex-col text-left"><span className="text-xs font-bold">{mule.pseudo}</span><span className="text-[8px] text-zinc-500 font-medium uppercase tracking-widest">Niv. {mule.level||200}{mule.classe?` • ${mule.classe}`:""}</span></div></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function RushTimelineClient({ guide, milestones, guildProgress, guildId, selectedCharacter="PRINCIPAL", mules=[], currentUserProfile, ocreStats }: RushTimelineClientProps) {
  const router=useRouter();const altPseudo=selectedCharacter!=="PRINCIPAL"?selectedCharacter:undefined;
  const [completedIds,setCompletedIds]=useState<Set<string>>(()=>new Set(milestones.filter(ms=>ms.playerProgress?.[0]?.isCompleted).map(ms=>ms.id)));
  const [completedStepsByMs,setCompletedStepsByMs]=useState<Map<string,Set<string>>>(()=>{const m=new Map;milestones.forEach(ms=>{const r=ms.playerProgress?.[0]?.completedSteps;const a=Array.isArray(r)?r:typeof r==="string"?JSON.parse(r):[];m.set(ms.id,new Set(a));});return m;});
  useEffect(()=>{const nc=new Set<string>,ns=new Map<string,Set<string>>;milestones.forEach(ms=>{if(ms.playerProgress?.[0]?.isCompleted)nc.add(ms.id);const r=ms.playerProgress?.[0]?.completedSteps;const a=Array.isArray(r)?r:typeof r==="string"?JSON.parse(r):[];ns.set(ms.id,new Set(a));});setCompletedIds(nc);setCompletedStepsByMs(ns);},[milestones]);
  const [bookmarkedMsId,setBookmarkedMsId]=useState<string|null>(()=>{for(const ms of milestones){if(ms.playerProgress?.[0]?.currentStep)return ms.id;}return null;});
  const [hideDone,setHideDone]=useState(false);const[showScrollTop,setShowScrollTop]=useState(false);
  useEffect(()=>{const o=()=>setShowScrollTop(window.scrollY>300);window.addEventListener("scroll",o,{passive:true});return()=>window.removeEventListener("scroll",o);},[]);
  const [loadingIds,setLoadingIds]=useState<Set<string>>(new Set);
  const [dofusFilter,setDofusFilter]=useState<string|null>(null);
  const [focusedSeqId,setFocusedSeqId]=useState<string|null>(null);
  const [djModal,setDjModal]=useState<{open:boolean;dungeonId?:string;questName?:string}>({open:false});
  const [wizardOpen,setWizardOpen]=useState(false);
  const [activeMembersModalOpen,setActiveMembersModalOpen]=useState(false);
  const [continueModalOpen,setContinueModalOpen]=useState(false);
  const continueShownThisSession=useRef(false);
  const effectiveAltPseudo=useMemo(()=>{if(!altPseudo)return undefined;const mp=currentUserProfile?.pseudoDofus;if(mp&&altPseudo===mp)return undefined;return altPseudo;},[altPseudo,currentUserProfile?.pseudoDofus]);
  const resolvedCharacterInfo=useMemo(()=>{if(!effectiveAltPseudo)return{alignment:currentUserProfile?.alignment,alignmentOrder:currentUserProfile?.alignmentOrder,alignmentLevel:currentUserProfile?.alignmentLevel??0};const m=currentUserProfile?.altPseudos?.find((m:any)=>m.pseudo===effectiveAltPseudo);return{alignment:m?.alignment,alignmentOrder:m?.alignmentOrder,alignmentLevel:m?.level??0};},[effectiveAltPseudo,currentUserProfile]);
  const handleFocusSequence=useCallback((seqId:string)=>setFocusedSeqId(seqId),[]);
  const handleDungeonClick=useCallback((dungeonId:string,questName:string)=>setDjModal({open:true,dungeonId,questName}),[]);
  useEffect(()=>{const k=`rush-onboarding-${guide.id}`;if(!localStorage.getItem(k)){const t=setTimeout(()=>setWizardOpen(true),800);return()=>clearTimeout(t);}},[guide.id]);
  const handleWizardClose=useCallback(()=>{localStorage.setItem(`rush-onboarding-${guide.id}`,"done");setWizardOpen(false);},[guide.id]);
  useEffect(()=>{if(!bookmarkedMsId||continueShownThisSession.current){setContinueModalOpen(false);return;}const k=`rush-continue-${guide.id}-${bookmarkedMsId}`;if(!localStorage.getItem(k)){continueShownThisSession.current=true;const t=setTimeout(()=>setContinueModalOpen(true),1200);return()=>clearTimeout(t);}},[guide.id]);
  useEffect(()=>{if(!bookmarkedMsId)setContinueModalOpen(false);},[bookmarkedMsId]);
  useEffect(()=>{const id=setInterval(()=>router.refresh(),30000);return()=>clearInterval(id);},[router]);
  const contentMilestones=useMemo(()=>milestones.filter(ms=>ms.type!=="SEPARATEUR"),[milestones]);
  const timelineItems=useMemo(()=>{const s=[...milestones].sort((a,b)=>a.order-b.order);type TI={kind:"separator";ms:Milestone}|{kind:"chapter";chapterNum:number;label:string;showHeader:boolean;milestoneList:Milestone[]};const r:TI[]=[];let b:Milestone[]=[];let bc:number|null=null;let bl="";let bsh=true;let lch:number|null=null;const f=()=>{if(b.length){r.push({kind:"chapter",chapterNum:bc!,label:bl,showHeader:bsh,milestoneList:b});b=[];bc=null;bl="";bsh=true;}};for(const ms of s){if(ms.type==="SEPARATEUR"){f();r.push({kind:"separator",ms});continue;}if(dofusFilter&&ms.dofusId!==dofusFilter)continue;const nh=ms.chapter!==lch;if(bc===null||bc!==ms.chapter){f();bc=ms.chapter;bl=ms.chapterLabel;bsh=nh;if(nh)lch=ms.chapter;}b.push(ms);}f();return r;},[milestones,dofusFilter]);
  const guildProgressByMs=useMemo(()=>{const m=new Map<string,GuildMemberProgress[]>;guildProgress.forEach(p=>{if(!p.isCompleted){if(!m.has(p.milestoneId))m.set(p.milestoneId,[]);m.get(p.milestoneId)!.push(p);}});return m;},[guildProgress]);
  const tMs=contentMilestones.length;const completedCount=contentMilestones.filter(ms=>completedIds.has(ms.id)).length;
  const overallPercent=tMs>0?Math.round((completedCount/tMs)*100):0;
  const activeMembersCount=useMemo(()=>new Set(guildProgress.map(p=>p.profileId)).size,[guildProgress]);
  const setLoading=useCallback((msId:string,val:boolean)=>setLoadingIds(prev=>{const n=new Set(prev);val?n.add(msId):n.delete(msId);return n;}),[]);
  const handleToggleSequence=useCallback(async(ms:Milestone,seqId:string)=>{const cur=new Set(completedStepsByMs.get(ms.id)||[]);const was=cur.has(seqId);was?cur.delete(seqId):cur.add(seqId);const arr=Array.from(cur);const allChecked=ms.sequences.length>0&&ms.sequences.every(s=>cur.has(s.id));setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,cur);return n;});setCompletedIds(prev=>{const n=new Set(prev);allChecked?n.add(ms.id):n.delete(ms.id);return n;});setLoading(ms.id,true);try{const res=await updateStepProgress(guildId,ms.id,arr,effectiveAltPseudo);if((res as any).success)toast.success(was?"Décocher":"✅ Validée !",{duration:1500});else toast.error("Erreur");}catch{toast.error("Erreur réseau");}finally{setLoading(ms.id,false);}},[completedStepsByMs,guildId,effectiveAltPseudo,setLoading]);
  const handleToggle=useCallback(async(ms:Milestone)=>{const was=completedIds.has(ms.id);setCompletedIds(prev=>{const n=new Set(prev);was?n.delete(ms.id):n.add(ms.id);return n;});setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,was?new Set():new Set(ms.sequences.map(s=>s.id)));return n;});setLoading(ms.id,true);try{const res=await toggleMilestoneProgress(guildId,ms.id,!was,effectiveAltPseudo);if(!(res as any).success){setCompletedIds(prev=>{const n=new Set(prev);was?n.add(ms.id):n.delete(ms.id);return n;});toast.error("Erreur");}else toast.success(was?"Décochée":"✅ Bloc validé !",{duration:1500});}catch{toast.error("Erreur réseau");}finally{setLoading(ms.id,false);}},[completedIds,guildId,effectiveAltPseudo,setLoading]);
  const handleReset=useCallback(async(ms:Milestone)=>{setCompletedIds(prev=>{const n=new Set(prev);n.delete(ms.id);return n;});setCompletedStepsByMs(prev=>{const n=new Map(prev);n.set(ms.id,new Set);return n;});setLoading(ms.id,true);try{await resetMilestoneProgress(guildId,ms.id,effectiveAltPseudo);toast.success("Réinitialisée");}catch{setCompletedIds(prev=>new Set([...prev,ms.id]));toast.error("Erreur reset");}finally{setLoading(ms.id,false);}},[guildId,effectiveAltPseudo,setLoading]);
  const handleBookmark=useCallback(async(ms:Milestone)=>{const next=bookmarkedMsId===ms.id?null:ms.id;setBookmarkedMsId(next);try{await updateBookmarkedStep(guildId,ms.id,next?`bookmark-${ms.id}`:null);}catch{}},[bookmarkedMsId,guildId]);
  if(guide.isUnderConstruction)return<div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8"><motion.div animate={{rotate:[0,-5,5,-5,0]}} transition={{repeat:Infinity,duration:3}} className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20"><Construction className="w-12 h-12 text-amber-400"/></motion.div><div><h2 className="text-2xl font-black text-white mb-2">En construction 🚧</h2><p className="text-zinc-400 text-sm">Le staff prépare ce guide. Reviens bientôt !</p></div></div>;
  return(<><style>{`footer,.site-footer,.app-footer,nav[class*="footer"]{display:none!important}`}</style>
  <div className="flex flex-col gap-5">
    <Link href={`/dashboard/${guildId}/quetes-dofus`} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors self-start group"><ChevronDown className="w-4 h-4 rotate-90 group-hover:-translate-x-1 transition-transform"/> Retour au Hub</Link>
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 backdrop-blur-md"><div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse"/></div><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-400">⚠️ Prérequis Recommandé</p><p className="text-xs text-amber-200/90">Conseillé dès le <strong className="text-white font-black">Niveau 200</strong>.</p></div></div>
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-zinc-950">
      <div className="relative flex flex-col gap-6">
        {/* Header title + big Sylvestre icon */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-emerald-400"/>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60">Guide Rush — Timeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white" style={{fontFamily:"var(--font-cinzel)"}}>{guide.name}</h2>
            {guide.description&&<p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xl leading-relaxed">{guide.description}</p>}
          </div>
          <img src="/module-dofus/Dofus_Sylvestre.png" alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] flex-shrink-0"/>
        </div>

        {/* Infos cards row — wrap propre */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Personnage */}
          <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">{(()=>{const d=currentUserProfile?.dofusClass?getClass(currentUserProfile.dofusClass):null;return d?<img src={d.icon} alt={d.name} className="w-full h-full object-contain p-0.5"/>:<span className="text-[9px] font-black text-zinc-400">?</span>;})()}</div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider font-[family-name:var(--font-cinzel)]">Personnage</p>
              <CharacterSelectorDropdown selectedCharacter={selectedCharacter} mainPseudo={currentUserProfile?.pseudoDofus||"Principal"} mainClass={currentUserProfile?.dofusClass||null} mules={mules||[]} guildId={guildId} />
            </div>
          </div>

          {/* Alignement / Ordre */}
          <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">{(()=>{const{alignment,alignmentOrder,alignmentLevel}=resolvedCharacterInfo;if(!alignment||alignment==="neutre")return<><div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0"><img src="/ordres/neutre.png" alt="" className="w-5 h-5 object-contain opacity-50"/></div><div className="text-left min-w-0 flex-1"><p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Alignement</p><p className="text-xs font-bold text-zinc-400">{!alignment?"Non défini":"Neutre"}</p></div><Link href={`/dashboard/${guildId}/profile`}><Pencil className="w-3.5 h-3.5 text-zinc-500 hover:text-emerald-400 transition-colors"/></Link></>;const ad=getAlignment(alignment);const ords=(ORDERS as unknown as Record<string,any[]>)[alignment.toLowerCase()]||[];const od=alignmentOrder?ords.find((o:any)=>o.id===alignmentOrder):null;if(od){const ib=alignment==="bontarien";return<><div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ib?"bg-blue-500/10 border-blue-500/20":"bg-red-500/10 border-red-500/20"}`}><img src={od.icon} alt="" className="w-5 h-5 object-contain"/></div><div className="text-left min-w-0 flex-1"><p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Ordre</p><p className={`text-xs font-black ${ib?"text-blue-300":"text-red-300"}`}>{od.name}</p></div><Link href={`/dashboard/${guildId}/profile`}><Pencil className="w-3.5 h-3.5 text-zinc-500 hover:text-emerald-400 transition-colors"/></Link></>;}return<><div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">{ad&&<img src={ad.icon} alt="" className="w-5 h-5 object-contain"/>}</div><div className="text-left min-w-0 flex-1"><p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Alignement</p><div className="flex items-center gap-1.5"><span className="text-xs font-bold text-white">{ad?.name||alignment}</span>{alignmentLevel>0&&<span className="text-[9px] font-bold text-amber-400">lv.{alignmentLevel}</span>}</div></div><Link href={`/dashboard/${guildId}/profile`}><Pencil className="w-3.5 h-3.5 text-zinc-500 hover:text-emerald-400 transition-colors"/></Link></>;})()}</div>

          {/* Metamob */}
          <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <img src="/assets/icons/ocre.png" alt="Ocre" className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-[8px] font-black text-amber-400/70 uppercase tracking-wider font-[family-name:var(--font-cinzel)]">Metamob</p>
              <div className="flex items-center gap-2 mt-0.5">
                {currentUserProfile?.metamobPseudo
                  ? <Link href={`/dashboard/${guildId}/quete-ocre`} className="flex items-center gap-1.5 text-xs font-black text-amber-300 hover:text-amber-200 transition-colors">
                      {ocreStats
                        ? <><span>Gardiens <span className="font-mono text-white">{ocreStats.bosses?.gathered??0}<span className="text-zinc-500">/{ocreStats.bosses?.total??51}</span></span></span><span className="text-zinc-600">·</span><span>Archis <span className="font-mono text-white">{ocreStats.archis?.gathered??0}<span className="text-zinc-500">/{ocreStats.archis?.total??286}</span></span></span></>
                        : <span className="text-[10px] font-bold text-amber-400/80">Voir ma progression →</span>
                      }
                      <ExternalLink className="w-3 h-3 text-amber-400/60 shrink-0"/>
                    </Link>
                  : <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30">
                      <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain" />
                      Lier Metamob
                      <ExternalLink className="w-3 h-3"/>
                    </Link>
                }
              </div>
            </div>
          </div>

          {/* Reset */}
          <button onClick={async()=>{if(confirm(`Réinitialiser la progression de ${selectedCharacter}?`)){try{const{resetGuideProgress}=await import("@/server/actions/optimized-guide-actions");await resetGuideProgress(guildId,guide.id,effectiveAltPseudo);setCompletedIds(new Set);toast.success("Réinitialisée !");router.refresh();}catch{toast.error("Erreur");}}}} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all"><RotateCcw className="w-5 h-5"/><span>Tout Reset</span></button>
        </div>

        {/* Progress bar */}
        <div className="flex flex-wrap items-center gap-3 px-1">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Progression</span>
          <span className="text-lg font-black text-white">{overallPercent}%</span>
          <span className="text-[10px] text-zinc-600 font-mono">({completedCount}/{tMs})</span>
          {activeMembersCount>0&&<button onClick={()=>setActiveMembersModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"><Users className="w-3.5 h-3.5 text-indigo-400"/><span className="text-[10px] font-black text-indigo-400">{activeMembersCount} actif{activeMembersCount>1?"s":""}</span></button>}
          <div className="h-2 bg-white/5 rounded-full flex-1 max-w-[300px] ml-auto">
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${overallPercent}%`,background:"linear-gradient(90deg, #10b981, #34d399)"}}/>
          </div>
        </div>
    </div></div>
    <div className="flex flex-wrap items-center gap-2"><button onClick={()=>setHideDone(v=>!v)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border transition-all text-[10px] font-black uppercase tracking-widest ${hideDone?"bg-emerald-500/15 border-emerald-500/40 text-emerald-400":"bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/30"}`}>{hideDone?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}{hideDone?"Afficher tout":"Masquer le fait"}</button></div>
    <GuildStatusPanel milestones={contentMilestones} guildProgress={guildProgress}/>
    {milestones.length===0?<div className="py-16 text-center"><BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-600 font-black uppercase text-xs tracking-widest">Aucun objectif</p></div>:<div className="relative pl-[28px] space-y-1">{timelineItems.map((item:any)=>item.kind==="separator"?<SectionDivider key={item.ms.id} title={item.ms.title} accentColor={item.ms.accentColor||"#d4a853"}/>:<ChapterBlock key={`ch-${item.chapterNum}`} chapterNum={item.chapterNum} label={item.label} showHeader={item.showHeader} milestones={item.milestoneList} completedIds={completedIds} completedStepsByMs={completedStepsByMs} bookmarkedMsId={bookmarkedMsId} guildProgressByMs={guildProgressByMs} hideDone={hideDone} loadingIds={loadingIds} dofusFilter={null} userAlignmentInfo={resolvedCharacterInfo} focusedSeqId={focusedSeqId} onFocusSequence={handleFocusSequence} onToggle={handleToggle} onToggleSequence={handleToggleSequence} onReset={handleReset} onBookmark={handleBookmark} onDungeonClick={handleDungeonClick}/>)}</div>}
    {showScrollTop&&<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 backdrop-blur-xl shadow-lg hover:bg-emerald-500/30 transition-all"><ArrowUp className="w-5 h-5"/></button>}
    {djModal.open&&<DjPostCreateModal isOpen={true} onClose={()=>setDjModal({open:false})} onCreated={()=>{}} guildId={guildId} initialDungeonId={djModal.dungeonId} initialQuestName={djModal.questName}/>}
    {wizardOpen&&<RushOnboardingWizardModal isOpen={true} guildId={guildId} onClose={handleWizardClose} characters={mules||[]} selectedCharacter={selectedCharacter} onSelectCharacter={(c:string)=>router.push(`?character=${encodeURIComponent(c)}`)} activeMembers={guildProgress.map(p=>{const tc=contentMilestones.length;const mp=guildProgress.filter(x=>x.profileId===p.profileId);const d=mp.filter(x=>x.isCompleted).length;const pct=tc>0?Math.round((d/tc)*100):0;return{profileId:p.profileId,userName:p.userName,userAvatar:p.userAvatar,percent:pct};})}/>}
    {continueModalOpen&&bookmarkedMsId&&(()=>{const ms=milestones.find(m=>m.id===bookmarkedMsId);if(!ms)return null;return<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={()=>setContinueModalOpen(false)}><div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-3 mb-3"><Flag className="w-5 h-5 text-emerald-400"/><h3 className="text-sm font-black text-white" style={{fontFamily:"var(--font-cinzel)"}}>Reprendre ?</h3></div><p className="text-xs text-zinc-400 mb-4">Tu étais à <strong className="text-white">{ms.title}</strong>.</p><div className="flex gap-2"><button onClick={()=>{const el=document.querySelector(`[data-ms-id="${bookmarkedMsId}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});setContinueModalOpen(false);}} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-widest">Reprendre</button><button onClick={()=>setContinueModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Plus tard</button></div></div></div>;})()}
    {activeMembersModalOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={()=>setActiveMembersModalOpen(false)}><div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}><h3 className="text-sm font-black text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400"/>Membres actifs</h3><div className="space-y-2">{Array.from(new Set(guildProgress.map(p=>p.profileId))).slice(0,50).map(pid=>{const mp=guildProgress.filter(p=>p.profileId===pid);const name=mp[0]?.userName||"Inconnu";const done=mp.filter(p=>p.isCompleted).length;const total=milestones.filter((ms:any)=>ms.type!=="SEPARATEUR").length;const pct=total>0?Math.round((done/total)*100):0;const avatar=mp[0]?.userAvatar;return<div key={pid} className="flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl"><div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center overflow-hidden shrink-0">{avatar?<img src={avatar} alt="" className="w-full h-full object-cover"/>:<span className="text-[9px] font-black text-indigo-300">{name[0]}</span>}</div><div className="flex-1"><p className="text-xs font-bold text-white">{name}</p><div className="h-1.5 bg-white/5 rounded-full max-w-[100px] mt-1"><div className="h-full rounded-full bg-emerald-500" style={{width:`${pct}%`}}/></div></div><span className="text-[8px] font-bold text-zinc-500 font-mono">{pct}%</span></div>;})}</div></div></div>}
  </div></>);
}