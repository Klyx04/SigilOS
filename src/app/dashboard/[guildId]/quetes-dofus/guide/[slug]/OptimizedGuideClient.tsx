"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, CheckCheck, ChevronDown, ChevronRight, Loader2, Search, X,
  BookOpen, AlertTriangle, Lightbulb, Info, Flag, Skull,
  Users, Star, ArrowRight, ChevronLeft, ExternalLink, Copy, HelpCircle,
  Bookmark, BookmarkCheck, EyeOff, Eye, BookOpenCheck, ChevronUp, RotateCcw, Crown, PanelLeft, LayoutGrid, ListTree, Pencil, Sparkles, Pin, PinOff, Ghost, Settings2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { toggleMilestoneProgress, getSubGuideSteps, updateStepProgress, updateBookmarkedStep, resetMilestoneProgress, resetGuideProgress, completeGuideProgress, getOptimizedGuidesLite } from "@/server/actions/optimized-guide-actions";
import CoordHoverMap from "./CoordHoverMap";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import { DungeonCreateModal } from "@/components/game-data/DungeonCreateModal";
import { QuestFeedbackButton } from "@/components/dofus-quests/QuestFeedbackButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/security";
import { fixBrokenImages } from "@/lib/ganymede-parser";
import { getClass, getAlignment, ORDERS } from "@/lib/dofus-assets";
import { useGuidePresence } from "@/hooks/use-guide-presence";
import LiveActivityTicker from "@/components/dofus-quests/LiveActivityTicker";
import OcreProgressModal, { type OcreMonsterLite } from "@/components/dofus-quests/OcreProgressModal";
import GuideParticles from "@/components/dofus-quests/GuideParticles";
import AlignmentModal from "@/components/dofus-quests/AlignmentModal";
import "./guide-styles.css";

const getNoobsDungeonSlug = (name: string) => {
  let clean = name.toLowerCase().trim();
  
  // Remove "donjon " prefix if it already has it to build it cleanly
  if (clean.startsWith("donjon du ")) {
    clean = clean.substring(10);
  } else if (clean.startsWith("donjon de l'")) {
    clean = clean.substring(12);
  } else if (clean.startsWith("donjon de la ")) {
    clean = clean.substring(13);
  } else if (clean.startsWith("donjon de ")) {
    clean = clean.substring(10);
  } else if (clean.startsWith("donjon d'")) {
    clean = clean.substring(9);
  } else if (clean.startsWith("donjon ")) {
    clean = clean.substring(7);
  }
  
  // Determine the best prefix
  let prefix = "donjon-de-";
  const vowels = ["a", "e", "i", "o", "u", "y", "h"];
  if (vowels.includes(clean.charAt(0))) {
    prefix = "donjon-d-";
  }
  
  const duBosses = ["kimbo", "chene mou", "skeunk", "kralamoure geant", "kralamoure", "peki peki", "bworker", "torig", "grozilla", "rasboul", "maitre donjon", "maitre corbac", "sfincter cell", "weabbit", "wa wabbit", "kardala", "koulosse", "blop", "royal", "gargoutte", "dramak", "qu Tan", "ilyzaelle", "dazak", "tal kasha", "koutoulou", "dramak", "shogun", "tanukouï san", "tengu", "korriandre", "kolosso", "glourseleste"];
  if (duBosses.some(b => clean.includes(b))) {
    prefix = "donjon-du-";
  }
  
  const rawSlug = `${prefix}${clean}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
    
  return rawSlug;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Sequence = {
  id: string; subGuideRef: string; subGuideName: string;
  stepFrom?: number; stepTo?: number; note?: string;
  isResume?: boolean; isOptional: boolean; order: number;
};
type Milestone = {
  id: string; title: string; subtitle?: string; description?: string;
  type: string; accentColor: string; chapter: number; chapterLabel: string;
  order: number; isOptional: boolean; sequences: Sequence[];
  playerProgress?: { isCompleted: boolean; completedSteps?: string[] };
};
type SubStep = { stepNumber: number; plainText?: string; web_text?: string; pos_x?: number; pos_y?: number };
type GuildMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  milestoneId: string;
  profileSlug?: string;
  isCompleted?: boolean;
  completedSteps?: string[];
  currentStep?: string | null;
};
type UniqueGuildMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  profileSlug?: string;
  completedSteps: Set<string>;
  completedMilestoneIds: Set<string>;
  currentMilestoneId: string | null;
  bookmarkedSteps: Map<string, string>; // milestoneId -> stepKey
};

// ─── Helpers sous-guides (validation en masse + masquage) ─────────────────────
// Clés d'étapes d'un sous-guide à partir de ses bornes (stepFrom → stepTo).
function buildSeqStepKeys(seq: Sequence): string[] {
  if (!seq.stepFrom || !seq.stepTo) return [];
  const keys: string[] = [];
  for (let n = seq.stepFrom; n <= seq.stepTo; n++) keys.push(`${seq.subGuideRef}-${n}`);
  return keys;
}
// Un sous-guide est « tout validé » quand toutes ses clés (bornes connues) sont cochées.
function isSeqFullyDone(seq: Sequence, checkedSteps: Set<string>): boolean {
  const keys = buildSeqStepKeys(seq);
  return keys.length > 0 && keys.every(k => checkedSteps.has(k));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GP_PALETTE = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#f97316","#84cc16","#a78bfa","#34d399","#fb7185"
];
const getGPColor = (ref: string) => GP_PALETTE[(parseInt(ref.replace(/\D/g,""))||0) % GP_PALETTE.length];

// Decode HTML entities in milestone titles stored in DB (e.g. &nbsp; -> space)
const decodeTitle = (title: string): string =>
  title
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const TYPE_CONFIG: Record<string,{label:string;color:string;bg:string}> = {
  DOFUS:      { label:"Dofus",      color:"#f59e0b", bg:"rgba(245,158,11,0.12)" },
  DONJON:     { label:"Donjon",     color:"#a855f7", bg:"rgba(168,85,247,0.12)" },
  QUETE_SERIE:{ label:"Quêtes",    color:"#3b82f6", bg:"rgba(59,130,246,0.12)" },
  PREREQUIS:  { label:"Prérequis",  color:"#71717a", bg:"rgba(255,255,255,0.06)" },
  ALIGNEMENT: { label:"Alignement", color:"#06b6d4", bg:"rgba(6,182,212,0.12)" },
};

// Detects narrative block type from html content
const getBlockType = (html: string) => {
  const t = html.toLowerCase();
  if (/r[eé]compense|obtient|obtiendrez|obtiens/.test(t)) return 'reward';
  if (/\blore\b/.test(t)) return 'lore';
  if (/astuce|tip\b/.test(t)) return 'tip';
  if (/important|attention|attention/.test(t)) return 'warning';
  if (/conseil/.test(t)) return 'counsel';
  return 'info';
};

const GANYMEDE_BOSS_LIST = new Set([
  "kardorim", "milimilou", "tournesol sauvage", "bouftou royal", "shin larve", "mollusky", "gligli royal",
  "pichon royal", "mob l'éponge", "bworkette", "corailleur magistral", "gourlo le terrible", "batofu",
  "craqueleur légendaire", "gelée royale bleue", "gelée royale menthe", "gelée royale fraise", "gelée royale citron",
  "wa wabbit", "wa wobot", "moon", "le chouque", "chouque", "koulosse", "maître corbac", "péki péki", "chêne mou",
  "dragon cochon", "minotoror", "minotot", "skeunk", "grozilla", "grasmera", "sphincter cell", "bworker",
  "tanukouï san", "silf le rasboul majeur", "tynril", "kimbo", "kralamour géant", "obsidiantre", "tengu givrefoux",
  "korriandre", "klime", "nileza", "sylargh", "missiz frizz", "comte harebourg", "merkator", "ombre", "kanigrula",
  "capitaine meno", "koutoulou", "dazak martegel", "tal kasha", "ilyzaelle", "bethel akryon", "solar", "toxoliath",
  "kabaal", "belladone", "nelween", "dramak", "halouine", "gargoul", "pounicheur", "founoroshi", "hans l'ausculteur",
  "shogun tofugawa", "yokaï firefoux", "toxine", "qu'tan", "ilyzaelle", "dazak", "meno", "koutoulou", "tal kasha",
  "aniripsa", "bwork", "wa", "le wabbit", "bworker", "kankreblath", "rasboul", "sfincter", "sfincter cell",
  "royal", "blop", "blop multicolore royal", "glourdoraval", "glourceleste", "glourséleste", "kralamour",
  "dramak", "usher", "servitude", "guerre", "misère", "corruption", "kabahal", "kabaal", "torkélonia", "dazak martegel",
  "bounine", "crapaud", "nelween", "gargoul", "pounicheur", "sfincter cell", "wa wabbit", "shin larve", "bouftou royal"
]);

const isBossName = (name: string): boolean => {
  const n = name.toLowerCase().trim();
  if (GANYMEDE_BOSS_LIST.has(n)) return true;
  if (n.endsWith(" royal") || n.endsWith(" royale")) return true;
  if (n.startsWith("roi ") || n.startsWith("reine ")) return true;
  if (n.startsWith("maître ") || n.startsWith("maîtresse ")) return true;
  if (n.includes("donjon") || n.includes("gardien de donjon")) return true;
  return false;
};

const RESOURCE_KEYWORDS = new Set([
  // Farming
  "blé", "orge", "avoine", "houblon", "seigle", "millet", "chanvre", "lin", "trèfle", "farine", "pain",
  // Wood
  "bois de frêne", "bois de châtaignier", "bois de noyer", "bois de chêne", "bois de bombu", "bois d'érable",
  "bois d'if", "bois de merisier", "bois d'ébène", "bois de charme", "bois d'orme", "bois de bambou",
  "bois d'oliviolet", "bois de bambou sombre", "bois de bambou sacré", "bois de tremble",
  // Mining
  "fer", "cuivre", "bronze", "cobalt", "manganèse", "étain", "silicate", "argent", "bauxite", "or",
  "charbon", "obsidienne", "dolomite", "pierre", "gemme",
  // Alchemy
  "ortie", "sauge", "trèfle à 5 feuilles", "menthe sauvage", "orchidée freyesque", "edelweiss", "ginseng",
  "belladone", "mandragore", "perce-neige", "salicorne",
  // Fishing
  "goujon", "truite", "poisson-chat", "crabe", "gardon", "brochet", "sardine", "kralamoure", "morue",
  "tanche", "espadon", "requin", "bar", "poisson", "crevette",
  // Common drops & monster resources
  "peau de", "plume de", "oeil de", "ongle de", "dent de", "griffe de", "aile de", "carapace de",
  "pétale de", "graine de", "feuille de", "oreille de", "queue de", "bec de", "patte de", "corne de",
  "sang de", "sperme de", "salive de", "cervelle de", "os de", "crâne de", "cendre de", "poudre de",
  "bourgeon de", "écorce de", "racine de", "sève de", "étoffe de", "cuir de", "laine de", "poil de",
  "défense de", "antenne de", "patte de", "moustache de", "flocon de", "larme de", "ambre de",
  "gelée de", "noeud de", "bourgeon", "morceau de", "fragment de", "essence de", "pyrute", "rutile",
  "aluminite", "ardoisine", "substrat"
]);

const isResourceItem = (name: string, typeAttr: string): boolean => {
  const n = name.toLowerCase().trim();
  const t = typeAttr.toLowerCase().trim();
  if (t === "resource" || t === "ressource") return true;
  if (RESOURCE_KEYWORDS.has(n)) return true;
  for (const prefix of ["peau de", "plume de", "oeil de", "ongle de", "dent de", "griffe de", "aile de", "carapace de", "pétale de", "graine de", "feuille de", "oreille de", "queue de", "bec de", "patte de", "corne de", "étoffe de", "cuir de", "laine de", "poil de", "bourgeon de", "écorce de", "racine de", "sève de", "morceau de", "fragment de", "essence de"]) {
    if (n.startsWith(prefix)) return true;
  }
  return false;
};

// ─── Module-level HTML cache ─────────────────────────────────────────────────
// processHtml is expensive (sanitize + regex). We cache results to avoid
// re-processing identical step HTML on every re-render (e.g. each checkbox toggle).
const _htmlCache = new Map<string, string>();
const cachedProcessHtml = (html: string): string => {
  if (!html) return "";
  const hit = _htmlCache.get(html);
  if (hit !== undefined) return hit;
  const result = processHtml(html);
  // Guard against unbounded memory growth (> 2000 unique steps is unlikely)
  if (_htmlCache.size > 2000) _htmlCache.clear();
  _htmlCache.set(html, result);
  return result;
};

// Process HTML to make coordinates and entities clickable without breaking tags
const processHtml = (html: string) => {
  if (!html) return "";
  
  // 0. Sanitize FIRST — remove any malicious tags/attributes before transforming
  const safe = sanitizeHtml(html) ?? "";
  if (!safe) return "";
  
  // 1. Fix broken images and force referrerpolicy to bypass hotlinking protection
  const fixed = fixBrokenImages(safe);
  
  // 2. Split into tags and text content to avoid breaking attributes
  const parts = fixed.split(/(<[^>]+>)/g);
  
  const processedParts = parts.map(part => {
    if (part.startsWith('<')) {
      let tagContent = part;
      // Make guide-step spans clickable (cross-guide navigation)
      if (tagContent.toLowerCase().startsWith('<span') && /data-type=["']guide-step["']/.test(tagContent)) {
        if (tagContent.includes('class="')) {
          tagContent = tagContent.replace('class="', 'class="guide-step-link ');
        } else {
          tagContent = tagContent.replace('<span', '<span class="guide-step-link"');
        }
      }
      
      // It's a tag - inject DofusDB interactivity if dofusdbid is present (handles 'data-dofusdbid' or 'dofusdbid' with single/double/no quotes)
      return tagContent.replace(/<([a-z0-9]+)([^>]+?)(?:data-)?dofusdbid=["']?(\d+)["']?([^>]*?)>/gi, (match, tag, before, id, after) => {
        const fullAttrs = before + after;
        
        // Extract tag attributes to isolate the item name and type
        const nameMatch = fullAttrs.match(/name=["']?([^"']+)["']?/i);
        const entityName = nameMatch ? nameMatch[1] : "";
        
        const typeMatch = fullAttrs.match(/\btype=["']?([^"']+)["']?/i);
        const typeAttr = typeMatch ? typeMatch[1] : "";
        
        let dbType = "items";
        if (fullAttrs.includes("monster")) {
          if (isBossName(entityName) || fullAttrs.includes("boss")) {
            dbType = "bosses";
          } else {
            dbType = "monsters";
          }
        } else if (fullAttrs.includes("npc")) {
          dbType = "npcs";
        } else if (fullAttrs.includes("quest")) {
          dbType = "quests";
        } else if (fullAttrs.includes("dungeon")) {
          dbType = "bosses";
        } else {
          if (isResourceItem(entityName, typeAttr)) {
            dbType = "resources";
          } else {
            dbType = "items";
          }
        }
        
        const hasClass = fullAttrs.includes('class="');
        const injectClass = `clickable-entity tag-${dbType}`;
        const finalAttrs = hasClass 
          ? fullAttrs.replace('class="', `class="${injectClass} `) 
          : fullAttrs + ` class="${injectClass}"`;
          
        return `<${tag} ${finalAttrs} data-type="dofusdb" data-dbid="${id}" data-dbtype="${dbType}" dofusdbid="${id}">`;
      });
    } else {
      // It's text - apply coordinate and guide references
      return part
        .replace(/\[(-?\d+),\s*(-?\d+)(?:,\s*(\d+))?\]/g, (match, x, y, world) => {
          const worldAttr = world ? ` data-world="${world}"` : '';
          return `<span class="coord-wrap inline-flex items-center gap-1"><span class="coord-chip cursor-pointer" data-x="${x}" data-y="${y}"${worldAttr} title="Copier la position [${x}, ${y}]">[${x}, ${y}]</span></span>`;
        })
        .replace(/\[(GP\d+)\]/g, `<span class="guide-ref-link" data-ref="$1">[$1]</span>`);
    }
  });

  return processedParts.join("")
    .replace(/color:\s*(?:rgb\(250,\s*200,\s*50\)|#ffff00|yellow)/gi, "color: #e4e4e7")
    .replace(/color:\s*rgb\(250,\s*0,\s*0\)/gi, "color: #f87171")
    .replace(/<input[^>]*type="checkbox"[^>]*>/g, "")
    .replace(/<p>\s*<\/p>/g, "");
};

// Progress ring SVG
function ProgressRing({ pct, size=36, stroke=3, color="#10b981" }:{pct:number;size?:number;stroke?:number;color?:string}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset 0.6s ease" }}/>
    </svg>
  );
}

// ─── Sub-Guide Accordion Card ──────────────────────────────────────────────────
function SubGuideCard({ seq, checkedSteps, onStepToggle, onInteractiveClick, defaultExpanded = false, hideCompletedGlobal = false, onSelectSubGuide, bookmarkStepKey, onStepBookmark, uniqueGuildMembers, milestones, selectedMilestoneId, onShowStepPresenceModal, onCompleteSubGuide }: {
  seq: Sequence;
  checkedSteps: Set<string>;
  onStepToggle: (ref: string, n: number) => void;
  onInteractiveClick: (e: React.MouseEvent) => void;
  defaultExpanded?: boolean;
  hideCompletedGlobal?: boolean;
  onSelectSubGuide?: (name: string) => void;
  bookmarkStepKey: string | null;
  onStepBookmark: (key: string) => void;
  uniqueGuildMembers: UniqueGuildMember[];
  milestones: Milestone[];
  selectedMilestoneId: string;
  onShowStepPresenceModal: (
    stepNumber: number,
    stepTitle: string,
    validatedMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[],
    activeMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[]
  ) => void;
  onCompleteSubGuide?: (keys: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [steps, setSteps] = useState<SubStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const color = getGPColor(seq.subGuideRef);

  // Hide state
  const [hideCompletedLocal, setHideCompletedLocal] = useState(false);

  const done = steps.filter(s => checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`)).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Filter steps if hideCompleted is checked
  const filteredSteps = (hideCompletedLocal || hideCompletedGlobal)
    ? steps.filter(s => !checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`))
    : steps;

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await getSubGuideSteps(seq.subGuideRef, seq.stepFrom, seq.stepTo);
      if (res.success) setSteps((res as any).steps || []);
    } catch { /* silent */ }
    finally { setLoading(false); setLoaded(true); }
  }, [seq.subGuideRef, seq.stepFrom, seq.stepTo, loaded]);

  useEffect(() => {
    if (expanded && !loaded && !loading) {
      load();
    }
  }, [expanded, loaded, loading, load]);


  const handleExpand = () => {
    if (!expanded) load();
    setExpanded(v => !v);
  };


  // ─── Pre-compute step presence (memoized) ─────────────────────────────────
  // This avoids O(steps × members) computation inside filteredSteps.map().
  // Re-runs only when guild members, milestones, or steps change — NOT on every
  // checkbox toggle (checkedSteps is intentionally excluded from deps).
  const stepPresenceMap = useMemo(() => {
    const map = new Map<string, {
      validated: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[];
      active: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[];
    }>();
    const selectedMs = milestones.find(m => m.id === selectedMilestoneId);
    if (!selectedMs || !uniqueGuildMembers.length) return map;

    steps.forEach(step => {
      const key = `${seq.subGuideRef}-${step.stepNumber}`;
      const validated: typeof map extends Map<string, { validated: infer V; active: any }> ? V : never[] = [];
      const active: typeof map extends Map<string, { validated: any; active: infer A }> ? A : never[] = [];

      uniqueGuildMembers.forEach(member => {
        // « Validé » = l'étape est RÉELLEMENT cochée par le membre (clé `GPx-N`).
        // On ne déduit JAMAIS une validation depuis un jalon complété ou passé :
        // valider le jalon (ou être rendu plus loin) ne coche pas chaque étape
        // de ses sous-guides — sinon « 1 membre » s'affiche partout sans clic.
        if (member.completedSteps.has(key)) {
          (validated as any[]).push(member);
          return;
        }
        // « En cours » = le membre est positionné sur CE jalon :
        //   - marque-page « J'en suis là » sur ce jalon → l'étape marquée ;
        //   - sinon → sa première étape non cochée du sous-guide.
        if (member.currentMilestoneId !== selectedMilestoneId) return;
        const bookmarkedStep = member.bookmarkedSteps.get(selectedMilestoneId);
        if (bookmarkedStep) {
          if (bookmarkedStep === key) (active as any[]).push(member);
          return;
        }
        const firstIncompleteStep = steps.find(s => !member.completedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`));
        if (firstIncompleteStep?.stepNumber === step.stepNumber) (active as any[]).push(member);
      });
      map.set(key, { validated: validated as any, active: active as any });
    });
    return map;
  }, [uniqueGuildMembers, milestones, selectedMilestoneId, steps, seq.subGuideRef]);

  // Sous-guide 100 % validé + option « masquer » active → la carte disparaît.
  const allStepsDone = loaded && steps.length > 0 && filteredSteps.length === 0;
  if (allStepsDone && (hideCompletedLocal || hideCompletedGlobal)) {
    return null;
  }

  return (
    <div className="sgc" style={{"--sgc-color": color} as React.CSSProperties}>
      {/* Card Header */}
      <button className="sgc-header" onClick={handleExpand} aria-expanded={expanded}>
        <div 
          className="sgc-badge hover:bg-emerald-500 hover:text-emerald-950 transition-all cursor-pointer transform hover:scale-105"
          title={`Filtrer par le guide secondaire : ${seq.subGuideName}`}
          onClick={(e) => {
            if (onSelectSubGuide) {
              e.stopPropagation();
              onSelectSubGuide(seq.subGuideName);
            }
          }}
        >
          {seq.subGuideRef}
        </div>
        <div className="sgc-info">
          <span 
            className="sgc-name hover:text-emerald-400 transition-colors cursor-pointer"
            title={`Filtrer par le guide secondaire : ${seq.subGuideName}`}
            onClick={(e) => {
              if (onSelectSubGuide) {
                e.stopPropagation();
                onSelectSubGuide(seq.subGuideName);
              }
            }}
          >
            {seq.subGuideName}
          </span>
          <span className="sgc-range">
            {seq.stepFrom && seq.stepTo
              ? `Étapes ${seq.stepFrom} → ${seq.stepTo}`
              : seq.stepFrom ? `À partir de l'étape ${seq.stepFrom}` : "Guide complet"}
          </span>
          <div className="sgc-tags">
            <span className="sgc-tag">{seq.subGuideRef}</span>
            {seq.stepFrom && seq.stepTo && (
              <span className="sgc-tag">{seq.stepTo - seq.stepFrom + 1} étapes</span>
            )}
            {seq.isOptional && <span className="sgc-tag">Bonus</span>}
          </div>
        </div>
        <div className="sgc-progress-wrap">
          {loaded && total > 0 && (
            <>
              <ProgressRing pct={pct} size={32} stroke={2.5} color={color}/>
              <span className="sgc-progress-text">{pct}%</span>
            </>
          )}
          <ChevronDown className={`sgc-chevron ${expanded ? "open" : ""}`} size={16}/>
        </div>
      </button>

      {/* Notes/flags */}
      {(seq.note || seq.isResume || (bookmarkStepKey && bookmarkStepKey.startsWith(`${seq.subGuideRef}-`))) && (
        <div className="sgc-flags">
          {(seq.isResume || (bookmarkStepKey && bookmarkStepKey.startsWith(`${seq.subGuideRef}-`))) && (
            <button 
              className="sgc-flag resume cursor-pointer hover:bg-blue-500/20 hover:text-white transition-all transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                let targetId = "";
                if (bookmarkStepKey && bookmarkStepKey.startsWith(`${seq.subGuideRef}-`)) {
                  targetId = `sgc-step-${bookmarkStepKey}`;
                } else {
                  const firstUnchecked = steps.find(s => !checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`));
                  if (firstUnchecked) {
                    targetId = `sgc-step-${seq.subGuideRef}-${firstUnchecked.stepNumber}`;
                  } else if (steps.length > 0) {
                    targetId = `sgc-step-${seq.subGuideRef}-${steps[0].stepNumber}`;
                  }
                }
                if (targetId) {
                  const el = document.getElementById(targetId);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.style.transition = "background-color 0.5s";
                    const oldBg = el.style.backgroundColor;
                    el.style.backgroundColor = "rgba(59, 130, 246, 0.25)";
                    setTimeout(() => el.style.backgroundColor = oldBg, 1500);
                    toast.success("Retour à votre position !");
                  }
                }
              }}
            >
              ↩ Reprendre depuis votre dernière position
            </button>
          )}
          {seq.note && <span className="sgc-flag warn"><AlertTriangle size={10}/> {seq.note}</span>}
        </div>
      )}

      {/* Expanded steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div className="sgc-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}>
            {loading ? (
              <div className="sgc-loading"><Loader2 className="animate-spin" size={16}/> Chargement…</div>
            ) : steps.length === 0 ? (
              <div className="sgc-empty">
                <Info size={14}/> Ce sous-guide n&apos;est pas encore importé dans la bibliothèque.
                Contactez un modérateur pour le rendre disponible.
              </div>
            ) : (
              <>
                {/* Mode controls */}
                <div className="sgc-controls">
                  <button 
                    className={`sgc-ctrl-btn ${(hideCompletedLocal || hideCompletedGlobal) ? "active" : ""}`}
                    onClick={() => setHideCompletedLocal(v => !v)}
                    title={hideCompletedGlobal ? "Masquage global actif. Cliquez pour forcer la persistance locale." : "Masquer les étapes validées de ce sous-guide"}
                  >
                    {hideCompletedLocal || hideCompletedGlobal ? <Eye size={12}/> : <EyeOff size={12}/>}
                    <span>{hideCompletedLocal || hideCompletedGlobal ? `Afficher les étapes validées (${done})` : `Masquer les étapes validées (${done})`}</span>
                  </button>
                  <button
                    className="sgc-ctrl-btn sgc-complete-subguide-btn"
                    onClick={() => {
                      const keys = steps.map(s => `${seq.subGuideRef}-${s.stepNumber}`);
                      onCompleteSubGuide?.(keys);
                    }}
                    title="Valider toutes les étapes de ce sous-guide d'un coup"
                  >
                    <CheckCheck size={12}/>
                    <span>Valider ce sous-guide</span>
                  </button>
                </div>

                <div className="sgc-step-list">
                  {filteredSteps.length === 0 ? (
                    <div className="sgc-empty p-8 text-center bg-zinc-950/20 border border-white/5 rounded-2xl">
                      <BookOpenCheck size={24} className="mx-auto mb-2 text-emerald-500" />
                      <span>Toutes les étapes de ce sous-guide sont validées ! 🎉</span>
                    </div>
                  ) : (
                    filteredSteps.map((step) => {
                      const key = `${seq.subGuideRef}-${step.stepNumber}`;
                      const checked = checkedSteps.has(key);
                      const { validated: validatedMembers = [], active: activeMembers = [] } = stepPresenceMap.get(key) ?? {};
                      const presenceCount = validatedMembers.length + activeMembers.length;
                      return (
                        <div
                          key={key}
                          id={`sgc-step-${key}`}
                          className={`sgc-step ${checked ? "done" : ""} ${bookmarkStepKey === key ? "bookmarked" : ""}`}
                        >
                          <div className="sgc-step-check" onClick={() => onStepToggle(seq.subGuideRef, step.stepNumber)}>
                            {checked ? <CheckCircle2 size={20} className="checked-icon"/> : <Circle size={20} className="unchecked-icon"/>}
                          </div>
                          <button
                            className="sgc-step-bookmark-btn"
                            title={bookmarkStepKey === key ? "Retirer mon marque-page de cette étape (J'en suis là)" : "Marquer cette étape comme ma position (J'en suis là)"}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onStepBookmark(key);
                            }}
                          >
                            {bookmarkStepKey === key ? (
                              <BookmarkCheck size={18} className="text-amber-500 fill-amber-500/20" />
                            ) : (
                              <Bookmark size={18} />
                            )}
                          </button>
                          <span className="sgc-step-num">{step.stepNumber}</span>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="sgc-step-content ganymade-step-text"
                              onClick={onInteractiveClick}
                              {...{ dangerouslySetInnerHTML: { __html: cachedProcessHtml(step.web_text ?? step.plainText ?? "") } }}/>
                            <div className="sgc-step-footer">
                              {presenceCount > 0 && (
                                <button
                                  type="button"
                                  className="sgc-step-presence-btn"
                                  title="Voir qui a validé ou est en cours sur cette étape"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShowStepPresenceModal(
                                      step.stepNumber,
                                      step.plainText ?? step.web_text ?? `Étape ${step.stepNumber}`,
                                      validatedMembers,
                                      activeMembers
                                    );
                                  }}
                                >
                                  <Users size={11}/>
                                  <span>{presenceCount} {presenceCount > 1 ? "membres" : "membre"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Narrative Block ──────────────────────────────────────────────────────────
function NarrativeBlock({ html }: { html: string }) {
  const type = getBlockType(html);
  return (
    <div className={`narrative narrative-${type}`}>
      <div className="narrative-icon">
        {type === 'lore'    && <BookOpen size={14}/>}
        {type === 'tip'     && <Lightbulb size={14}/>}
        {type === 'warning' && <AlertTriangle size={14}/>}
        {type === 'counsel' && <Star size={14}/>}
        {type === 'reward'  && <Crown size={14}/>}
        {type === 'info'    && <Info size={14}/>}
      </div>
      <div className="narrative-body ganymade-step-text"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: processHtml(html) }}/>
    </div>
  );
}

// ─── Chapter Group ────────────────────────────────────────────────────────────
function ChapterGroup({ chapter, label, milestones, selectedId, completedIds, onSelect, isOpen, onToggle, presenceMap, bookmarkId, guildId, onShowPresenceModal, onBookmark, onResetMilestone, checkedSteps, hideDoneSeqs }: {
  chapter: number; label: string; milestones: Milestone[];
  selectedId?: string; completedIds: Set<string>;
  onSelect: (m: Milestone) => void; isOpen: boolean;
  onToggle: (open: boolean) => void;
  presenceMap: Record<string, GuildMember[]>;
  bookmarkId?: string | null;
  guildId: string;
  onShowPresenceModal: (milestoneId: string, title: string) => void;
  onBookmark: (milestoneId: string) => void;
  onResetMilestone: (milestone: Milestone) => void;
  checkedSteps?: Set<string>;
  hideDoneSeqs?: boolean;
}) {
  const done = milestones.filter(m => completedIds.has(m.id)).length;
  const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0;
  const allDone = done === milestones.length;

  const totalPresence = milestones.reduce((acc, m) => acc + (presenceMap[m.id]?.length || 0), 0);
  const isChapterActive = milestones.some(m => m.id === selectedId);
  const activeColor = selectedId ? (milestones.find(m => m.id === selectedId)?.accentColor || "#6366f1") : "#6366f1";
  
  return (
    <div className="chapter-group">
      <button 
        className={`chapter-header ${allDone ? "all-done" : ""} ${isChapterActive ? "active" : ""}`} 
        style={{
          "--accent-color": activeColor,
        } as React.CSSProperties}
        onClick={() => onToggle(!isOpen)}
      >
        <ProgressRing pct={pct} size={28} stroke={2.5} color={allDone ? "#10b981" : isChapterActive ? "#d4a853" : "#3b82f6"}/>
        <div className="chapter-label">
          <span className="chapter-name">{label}</span>
          <div className="chapter-meta">
            <span className="chapter-count" style={{ color: isChapterActive ? "color-mix(in srgb, var(--accent-color) 75%, white)" : undefined }}>
              {done}/{milestones.length} complétées
            </span>
            {totalPresence > 0 && (
              <span className="chapter-presence" style={{ color: "#38bdf8" }}>
                <Users size={10}/> {totalPresence}
              </span>
            )}
          </div>
        </div>
        {isOpen ? <ChevronDown size={14} className={isChapterActive ? "text-[#d4a853]" : "text-zinc-500"}/> : <ChevronRight size={14} className="text-zinc-500"/>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div className="chapter-items"
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.18 }}>
            {milestones.map((ms, i) => {
              const isSelected = ms.id === selectedId;
              const isDone = completedIds.has(ms.id);
              const here = presenceMap[ms.id] || [];
              return (
                <div key={ms.id} id={`ms-row-${ms.id}`} 
                  className={`ms-row ${isSelected ? "active" : ""} ${isDone ? "done" : ""} ${bookmarkId === ms.id ? "bookmarked" : ""}`}
                  style={isSelected ? { "--accent-color": ms.accentColor || "#3b82f6" } as React.CSSProperties : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(ms)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(ms); } }}>
                  <div className="ms-state">
                    {bookmarkId === ms.id && !isDone
                      ? <Bookmark size={13} className="state-bookmark"/>
                      : isDone
                        ? <CheckCircle2 size={14} className="state-done"/>
                        : isSelected
                          ? <div className="state-active"/>
                          : <Circle size={14} className="state-todo"/>}
                  </div>
                  <span className="ms-num">{i+1}</span>
                  <span className="ms-title">{ms.title}</span>
                  
                  {here.length > 0 && (
                    <div 
                      className="ms-member-avatars cursor-pointer hover:scale-105 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowPresenceModal(ms.id, ms.title);
                      }}
                    >
                      {here.slice(0, 3).map((m) => (
                        <div
                          key={m.profileId}
                          className="ms-member-avatar"
                          title={m.userName}
                        >
                          {m.userAvatar ? (
                            <img src={m.userAvatar} alt={m.userName} referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400">
                              {m.userName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                      {here.length > 3 && (
                        <div className="ms-member-avatar-more" title={`${here.length} membres ici`}>
                          +{here.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    const seqs = hideDoneSeqs && checkedSteps
                      ? ms.sequences.filter(s => !isSeqFullyDone(s, checkedSteps))
                      : ms.sequences;
                    if (seqs.length === 0) return null;
                    return (
                      <span
                        className="ms-seqs"
                        title={`${seqs.length} sous-guide${seqs.length > 1 ? "s" : ""} : ${seqs.map(s => s.subGuideRef).join(" · ")}`}
                      >
                        {seqs.length} sous-guide{seqs.length > 1 ? "s" : ""}
                      </span>
                    );
                  })()}

                  {bookmarkId === ms.id && !isDone && (
                    <span className="ms-you" title="Votre position sur ce guide">
                      Vous êtes ici
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <button
                      className="ms-reset-btn"
                      title="Réinitialiser ce jalon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetMilestone(ms);
                      }}
                    >
                      <RotateCcw size={10} />
                    </button>

                    {!isDone && (
                      <button
                        className="ms-bookmark-btn"
                        title={bookmarkId === ms.id ? "Retirer mon marque-page (J'en suis là)" : "Marquer comme ma position (J'en suis là)"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookmark(ms.id);
                        }}
                      >
                        {bookmarkId === ms.id ? (
                          <BookmarkCheck size={12} className="text-amber-500 fill-amber-500/20" />
                        ) : (
                          <Bookmark size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sélecteur de personnage (bandeau, style rush sylvestre) ─────────────────
function GuideCharDropdown({ selectedCharacter, mainPseudo, mainClass, mules }: {
  selectedCharacter: string;
  mainPseudo: string;
  mainClass?: string | null;
  mules?: { pseudo: string; classe?: string | null; level?: number | null }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const handleSelect = (char: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (char === "PRINCIPAL") params.delete("character");
    else params.set("character", char);
    router.push(pathname + "?" + params.toString());
  };
  const currentLabel = selectedCharacter === "PRINCIPAL" ? mainPseudo : selectedCharacter;
  const selClass = selectedCharacter === "PRINCIPAL" ? mainClass : (mules || []).find(m => m.pseudo === selectedCharacter)?.classe || null;
  const selIcon = selClass
    ? (() => { const d = getClass(selClass); return d ? <img src={d.icon} alt={d.name} className="w-4 h-4 object-contain"/> : null; })()
    : selectedCharacter === "PRINCIPAL" ? <Crown className="w-3.5 h-3.5 text-amber-500"/> : <Users className="w-3.5 h-3.5 text-blue-400"/>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={false} className="gch-trigger">
          <div className="flex items-center gap-2 truncate min-w-0">{selIcon}<span className="truncate">{currentLabel}</span></div>
          <ChevronDown className="w-3 h-3 opacity-30 shrink-0"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gch-content">
        <DropdownMenuItem onClick={() => handleSelect("PRINCIPAL")} className={"gch-opt" + (selectedCharacter === "PRINCIPAL" ? " current" : "")}>
          <div className="gch-opt-icon principal">{mainClass ? (() => { const d = getClass(mainClass); return d ? <img src={d.icon} alt="" className="w-4 h-4 object-contain"/> : null; })() : <Crown className="w-3 h-3 text-amber-500"/>}</div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold">{mainPseudo}</span>
            <span className="text-[8px] text-zinc-500 font-medium uppercase tracking-widest">{mainClass || "Principal"}</span>
          </div>
        </DropdownMenuItem>
        {(mules || []).length > 0 && <div className="h-px bg-white/5 my-1" />}
        {(mules || []).map(mule => (
          <DropdownMenuItem key={mule.pseudo} onClick={() => handleSelect(mule.pseudo)} className={"gch-opt" + (selectedCharacter === mule.pseudo ? " current" : "")}>
            <div className="gch-opt-icon mule">{mule.classe ? (() => { const d = getClass(mule.classe); return d ? <img src={d.icon} alt="" className="w-4 h-4 object-contain"/> : null; })() : <Users className="w-3 h-3 text-blue-400"/>}</div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold">{mule.pseudo}</span>
              <span className="text-[8px] text-zinc-500 font-medium uppercase tracking-widest">Niv. {mule.level || 200} {mule.classe ? "• " + mule.classe : ""}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OptimizedGuideClient({
  guide, milestones: initialMilestones, userProgress, guildProgress, guildId,
  selectedCharacter = "PRINCIPAL", mainCharacter, mules = [],
  currentUserProfile, ocreStats, ocreMonsters = []
}: {
  guide: { id: string; name: string; slug: string; description?: string };
  milestones: Milestone[];
  userProgress: { milestoneId: string; isCompleted: boolean; completedSteps?: string[]; currentStep?: string | null }[];
  guildProgress: GuildMember[];
  guildId: string;
  selectedCharacter?: string;
  mainCharacter?: { pseudo: string; classe?: string | null };
  mules?: { pseudo: string; classe?: string | null; level?: number | null }[];
  currentUserProfile?: {
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number;
    altPseudos?: any[];
    dofusClass?: string | null;
    metamobPseudo?: string | null;
    pseudoDofus?: string | null;
  };
  ocreStats?: { bosses?: { gathered?: number; total?: number }; archis?: { gathered?: number; total?: number }; progressPercent?: number; currentStep?: number; serverName?: string } | null;
  ocreMonsters?: OcreMonsterLite[];
}) {
  // altPseudo is the mule name to pass to server actions (undefined = main char)
  const altPseudo = selectedCharacter !== "PRINCIPAL" ? selectedCharacter : undefined;

  // Clés localStorage scopées par personnage : chaque mule garde sa propre
  // position (le serveur sépare déjà les progressions via characterSlot).
  const bookmarkStorageKey = `guide-bm-${guide.slug}-${selectedCharacter}`;
  const bookmarkStepStorageKey = `guide-bm-step-${guide.slug}-${selectedCharacter}`;
  const sessionStorageKey = `sigilos_session_${guildId}_${guide.id}_${selectedCharacter}`;

  const [milestones] = useState(() => initialMilestones);
  const [selected, setSelected] = useState<Milestone | null>(milestones[0] ?? null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(userProgress.filter(p => p.isCompleted).map(p => p.milestoneId))
  );
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Mode plein écran : masque sidebar/topnav/footer de l'app (pattern map-fullscreen)
  useEffect(() => {
    document.body.classList.add("guide-fullscreen");
    return () => document.body.classList.remove("guide-fullscreen");
  }, []);

  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (initialMilestones.length > 0) {
      initial[initialMilestones[0].chapter] = true;
    }
    return initial;
  });

  const [bookmarkStepKey, setBookmarkStepKey] = useState<string | null>(() => {
    const activeProgress = userProgress.find(p => p.milestoneId === selected?.id);
    if (activeProgress?.currentStep) return activeProgress.currentStep;
    if (typeof window !== "undefined") return localStorage.getItem(bookmarkStepStorageKey) ?? null;
    return null;
  });

  // Sync bookmarkStepKey with userProgress on load or selected milestone change
  useEffect(() => {
    if (selected) {
      const activeProgress = userProgress.find(p => p.milestoneId === selected.id);
      if (activeProgress?.currentStep) {
        setBookmarkStepKey(activeProgress.currentStep);
        localStorage.setItem(bookmarkStepStorageKey, activeProgress.currentStep);
      } else {
        setBookmarkStepKey(null);
        localStorage.removeItem(bookmarkStepStorageKey);
      }
    }
  }, [selected, userProgress, guide.slug, bookmarkStepStorageKey]);

  const handleStepBookmark = useCallback((stepKey: string) => {
    setBookmarkStepKey(prev => {
      const next = prev === stepKey ? null : stepKey;
      if (next) {
        localStorage.setItem(bookmarkStepStorageKey, next);
        toast.success("Position d'étape sauvegardée !");
      } else {
        localStorage.removeItem(bookmarkStepStorageKey);
        toast.info("Marque-page d'étape retiré");
      }

      // Persist step bookmark to database (J'en suis là / en cours)
      if (selected) {
        updateBookmarkedStep(guildId, selected.id, next).catch((e) => {
          console.error("Failed to update bookmarked step in DB:", e);
        });
      }

      return next;
    });
  }, [guide.slug, selected, guildId]);


  const handleToggleChapter = useCallback((chapterNum: number, open: boolean) => {
    setOpenChapters(prev => ({
      ...prev,
      [chapterNum]: open
    }));
  }, []);

  useEffect(() => {
    if (selected?.chapter !== undefined) {
      setOpenChapters(prev => ({
        ...prev,
        [selected.chapter]: true
      }));
    }
  }, [selected?.id, selected?.chapter]);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [isAllMembersModalOpen, setIsAllMembersModalOpen] = useState(false);
  const [isOcreModalOpen, setIsOcreModalOpen] = useState(false);
  const [isAlignModalOpen, setIsAlignModalOpen] = useState(false);
  // Initialize checkedSteps from userProgress on mount
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    userProgress.forEach(p => {
      if (Array.isArray(p.completedSteps)) {
        (p.completedSteps as string[]).forEach(k => initial.add(k));
      }
    });
    return initial;
  });
  const [validating, setValidating] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 400);
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [selected]);
  
  const [activeSeqIndex, setActiveSeqIndex] = useState(0);
  const [activeGuideFilter, setActiveGuideFilter] = useState<string | null>(null);

  const [globalHideCompletedSteps, setGlobalHideCompletedSteps] = useState(false);
  // Mode discret (Phase F) : masque la présence du membre courant (localStorage).
  const [incognito, setIncognito] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(`guide-incognito-${guildId}`) === "true"; } catch { return false; }
  });
  // Identité du membre courant (nom/avatar) pour le heartbeat de présence.
  const [myIdentity, setMyIdentity] = useState<{ name?: string; image?: string }>({});
  // Effet d'ambiance (particules) — désactivable (localStorage, défaut activé).
  const [particlesEnabled, setParticlesEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem(`guide-particles-${guildId}`) !== "false"; } catch { return true; }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [createDjModal, setCreateDjModal] = useState<{ isOpen: boolean; initialDungeonId?: string; initialQuestName?: string }>({ isOpen: false });
  const [createUnpopulatedDjModal, setCreateUnpopulatedDjModal] = useState<{ isOpen: boolean; name: string; dofusdbId: number | null }>({ isOpen: false, name: "", dofusdbId: null });
  const [dungeonChoiceModal, setDungeonChoiceModal] = useState<{ isOpen: boolean; name: string; dofusdbId: number | null; dbtype: string; customUrl?: string | null; isLoadingUrl?: boolean } | null>(null);
  const [editingNoobsUrl, setEditingNoobsUrl] = useState(false);
  const [noobsUrlInput, setNoobsUrlInput] = useState("");
  const [questChoiceModal, setQuestChoiceModal] = useState<{ isOpen: boolean; name: string; dofusdbId: number | null } | null>(null);
  const [verifyingDungeonName, setVerifyingDungeonName] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [jumpMode, setJumpMode] = useState(false);
  const [jumpInput, setJumpInput] = useState("");
  const [welcomeModal, setWelcomeModal] = useState<{ show: boolean; lastViewedId?: string; validatedCount: number } | null>(null);
  const sessionValidatedCountRef = useRef(0);
  const initializedSessionRef = useRef(false);

  const [presenceModal, setPresenceModal] = useState<{
    isOpen: boolean;
    milestoneId: string;
    milestoneTitle: string;
  } | null>(null);

  const [stepPresenceModal, setStepPresenceModal] = useState<{
    isOpen: boolean;
    stepNumber: number;
    stepTitle: string;
    validatedMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[];
    activeMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[];
  } | null>(null);

  const [isResetMilestoneConfirmOpen, setIsResetMilestoneConfirmOpen] = useState(false);
  const [isResetGuideConfirmOpen, setIsResetGuideConfirmOpen] = useState(false);
  const [isCompleteGuideConfirmOpen, setIsCompleteGuideConfirmOpen] = useState(false);
  const [isCompletingGuide, setIsCompletingGuide] = useState(false);

  const handleShowStepPresenceModal = useCallback((
    stepNumber: number,
    stepTitle: string,
    validatedMembers: any[],
    activeMembers: any[]
  ) => {
    setStepPresenceModal({
      isOpen: true,
      stepNumber,
      stepTitle,
      validatedMembers,
      activeMembers
    });
  }, []);

  // handleBackToMainGuideCurrentStep is declared after bookmarkId to avoid TDZ

  const handleLaunchDungeonSearch = useCallback((name: string, dofusdbIdVal: number | null) => {
    setDungeonChoiceModal(null);
    setVerifyingDungeonName(name);
    import("@/server/actions/game-data-actions").then((mod) => {
      mod.checkDungeonExists(name, dofusdbIdVal).then((res) => {
        setVerifyingDungeonName(null);
        if (res.success && res.data) {
          if (res.data.exists && res.data.dungeon) {
            setCreateDjModal({
              isOpen: true,
              initialDungeonId: res.data.dungeon.id
            });
          } else {
            setCreateUnpopulatedDjModal({
              isOpen: true,
              name: name,
              dofusdbId: dofusdbIdVal
            });
          }
        } else {
          toast.error(res.error || "Erreur de vérification");
        }
      });
    });
  }, [setCreateDjModal, setCreateUnpopulatedDjModal]);

  const handleLaunchDofusDB = useCallback((dbid: number | null, dbtype: string) => {
    if (dbid) {
      let singularType = dbtype.endsWith("s") ? dbtype.slice(0, -1) : dbtype;
      if (singularType === "bosse" || singularType === "monster") {
        singularType = "monster";
      } else if (singularType === "resource") {
        singularType = "item";
      }
      window.open(`https://dofusdb.fr/fr/database/${singularType}/${dbid}`, "_blank");
      toast.info(`Ouverture DofusDB`);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    const milestoneParam = searchParams.get("milestone");
    if (milestoneParam) {
      const targetMs = milestones.find(m => m.id === milestoneParam);
      if (targetMs) {
        setSelected(targetMs);
        setTimeout(() => {
          const el = document.getElementById(`ms-row-${milestoneParam}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.transition = "background-color 0.5s";
            const oldBg = el.style.backgroundColor;
            el.style.backgroundColor = "rgba(59, 130, 246, 0.25)";
            setTimeout(() => el.style.backgroundColor = oldBg, 1500);
          }
        }, 300);
      }
    }

    const stepParam = searchParams.get("step");
    if (stepParam) {
      // e.g. "GP7-6" or "GP38"
      const parts = stepParam.split("-");
      const ref = parts[0].toUpperCase();
      const targetStep = parts[1] ? parseInt(parts[1], 10) : 0;
      
      let foundSeqIndex = 0;
      let targetMs = milestones.find(m => {
        const titleMatch = (m.title || "").toUpperCase().includes(ref);
        const chapterMatch = (m.chapterLabel || "").toUpperCase().includes(ref);
        if (titleMatch || chapterMatch) {
          const sortedSeqs = [...m.sequences].sort((a,b) => a.order - b.order);
          const idx = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref);
          if (idx !== -1) foundSeqIndex = idx;
          return true;
        }
        return false;
      });

      if (!targetMs) {
        const containingMs = milestones.filter(m => m.sequences.some(s => s.subGuideRef.toUpperCase() === ref));
        if (containingMs.length > 0) {
          targetMs = containingMs[0];
          const sortedSeqs = [...targetMs.sequences].sort((a,b) => a.order - b.order);
          foundSeqIndex = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref);
        }
      }

      if (targetMs) {
        setSelected(targetMs);
        setActiveSeqIndex(foundSeqIndex);
        if (targetStep > 0) {
          setTimeout(() => {
            const el = document.getElementById(`sgc-step-${ref}-${targetStep}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.transition = "background-color 0.5s";
              const oldBg = el.style.backgroundColor;
              el.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
              setTimeout(() => el.style.backgroundColor = oldBg, 1500);
            } else {
              setTimeout(() => {
                const el2 = document.getElementById(`sgc-step-${ref}-${targetStep}`);
                if (el2) {
                  el2.scrollIntoView({ behavior: "smooth", block: "center" });
                  el2.style.transition = "background-color 0.5s";
                  const oldBg = el2.style.backgroundColor;
                  el2.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
                  setTimeout(() => el2.style.backgroundColor = oldBg, 1500);
                }
              }, 500);
            }
          }, 300);
        } else {
          // If no targetStep, scroll to milestone row
          setTimeout(() => {
            const el = document.getElementById(`ms-row-${targetMs.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 300);
        }
      }
    }
  }, [searchParams, milestones]);

  // Scroll sidebar active milestone into view
  useEffect(() => {
    if (selected?.id) {
      setTimeout(() => {
        const el = document.querySelector(".ms-row.active");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 400);
    }
  }, [selected?.id]);

  useEffect(() => {
    import("@/server/actions/user-actions").then(m => m.getUserContext(guildId)).then(ctx => {
      if (ctx?.isAdmin) {
        setIsAdmin(true);
      }
      // Identité du membre courant pour le heartbeat de présence (Phase F).
      if (ctx?.name || ctx?.image) setMyIdentity({ name: ctx?.name, image: ctx?.image });
    });
  }, [guildId]);

  const [bookmarkId, setBookmarkId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem(bookmarkStorageKey) ?? null;
    return null;
  });

  const handleBookmark = useCallback((milestoneId: string) => {
    const next = bookmarkId === milestoneId ? null : milestoneId;
    setBookmarkId(next);
    if (next) { localStorage.setItem(bookmarkStorageKey, next); toast.success("Position sauvegardée !"); }
    else { localStorage.removeItem(bookmarkStorageKey); toast.info("Marque-page supprimé"); }
  }, [bookmarkId, guide.slug]);

  const handleBackToMainGuideCurrentStep = useCallback(() => {
    setActiveGuideFilter(null);
    if (bookmarkId) {
      const bmMs = milestones.find(m => m.id === bookmarkId);
      if (bmMs) {
        setSelected(bmMs);
        toast.success("Retour au guide principal !", {
          description: `Positionné sur : ${bmMs.title}`
        });
        return;
      }
    }
    const firstIncomplete = milestones.find(m => !completedIds.has(m.id));
    if (firstIncomplete) {
      setSelected(firstIncomplete);
      toast.success("Retour au guide principal !");
    }
  }, [bookmarkId, milestones, completedIds]);

  useEffect(() => {
    setActiveSeqIndex(0);
  }, [selected?.id]);

  // Session tracking & Welcome Back Modal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = sessionStorageKey;
    
    if (!initializedSessionRef.current) {
      initializedSessionRef.current = true;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const timeDiff = Date.now() - parsed.lastUpdate;
          if (timeDiff > 1000 * 60 * 30) { // 30 mins elapsed = new session
            if (parsed.sessionValidatedCount > 0 || parsed.lastViewedId) {
              setWelcomeModal({
                show: true,
                lastViewedId: parsed.lastViewedId,
                validatedCount: parsed.sessionValidatedCount || 0
              });
            }
          }
        } catch (e) {}
      }
    }

    if (selected) {
      localStorage.setItem(key, JSON.stringify({
        lastUpdate: Date.now(),
        lastViewedId: selected.id,
        sessionValidatedCount: sessionValidatedCountRef.current
      }));
    }
  }, [selected, guildId, guide.id]);

  // Extract list of all unique sub-guides available inside this roadmap
  const availableSubGuides = useMemo(() => {
    const list: { ref: string; name: string }[] = [];
    const seen = new Set<string>();
    milestones.forEach(m => {
      m.sequences.forEach(s => {
        const key = s.subGuideName.trim();
        if (key && !seen.has(key)) {
          const isIncarnam = 
            key.toLowerCase().includes("incarnam") || 
            s.subGuideRef.toLowerCase().includes("gp1");
          if (!isIncarnam) {
            seen.add(key);
            list.push({ ref: s.subGuideRef, name: s.subGuideName });
          }
        }
      });
    });
    return list;
  }, [milestones]);

  // Prevent selection empty-state when switching filters
  useEffect(() => {
    if (activeGuideFilter) {
      const filtered = [...milestones]
        .sort((a,b)=>a.order-b.order)
        .filter(m => m.sequences.some(s => s.subGuideName === activeGuideFilter));
      if (filtered.length > 0 && (!selected || !filtered.some(m => m.id === selected.id))) {
        setSelected(filtered[0]);
      }
    }
  }, [activeGuideFilter, milestones, selected]);

  // Unique Guild Members logic (aggregates multiple playerGuideProgress rows per profileId)
  const uniqueGuildMembers = useMemo(() => {
    const map = new Map<string, {
      profileId: string;
      userName: string;
      userAvatar?: string;
      profileSlug?: string;
      completedSteps: Set<string>;
      completedMilestoneIds: Set<string>;
      bookmarkedSteps: Map<string, string>;
      // Track which milestoneIds have any activity (steps OR bookmark OR completed)
      activeMilestoneIds: Set<string>;
    }>();

    guildProgress.forEach(p => {
      let existing = map.get(p.profileId);
      if (!existing) {
        existing = {
          profileId: p.profileId,
          userName: p.userName,
          userAvatar: p.userAvatar,
          profileSlug: p.profileSlug,
          completedSteps: new Set<string>(),
          completedMilestoneIds: new Set<string>(),
          bookmarkedSteps: new Map<string, string>(),
          activeMilestoneIds: new Set<string>()
        };
        map.set(p.profileId, existing);
      }
      if (p.completedSteps && p.completedSteps.length > 0) {
        p.completedSteps.forEach(s => existing!.completedSteps.add(s));
        existing.activeMilestoneIds.add(p.milestoneId);
      }
      if (p.isCompleted) {
        existing.completedMilestoneIds.add(p.milestoneId);
        existing.activeMilestoneIds.add(p.milestoneId);
      }
      if (p.currentStep) {
        existing.bookmarkedSteps.set(p.milestoneId, p.currentStep);
        existing.activeMilestoneIds.add(p.milestoneId);
      }
    });

    const sortedM = [...milestones].sort((a, b) => a.order - b.order);

    return Array.from(map.values()).map(m => {
      // Strategy: find the furthest-order milestone where the member has any activity
      // (has completed steps, has a bookmark, or has marked as completed)
      // then set currentMilestoneId = the next uncompleted milestone after that point
      // OR the active milestone itself if it's not yet completed
      let bestActiveMilestoneOrder = -1;
      let bestActiveMilestoneId: string | null = null;

      sortedM.forEach(ms => {
        const hasActivity = m.activeMilestoneIds.has(ms.id);
        if (hasActivity && ms.order > bestActiveMilestoneOrder) {
          bestActiveMilestoneOrder = ms.order;
          bestActiveMilestoneId = ms.id;
        }
      });

      let currentMilestoneId: string | null = null;
      if (bestActiveMilestoneId) {
        // If the best active milestone is completed, move to the next uncompleted one
        if (m.completedMilestoneIds.has(bestActiveMilestoneId)) {
          const nextMs = sortedM.find(ms => ms.order > bestActiveMilestoneOrder && !m.completedMilestoneIds.has(ms.id));
          currentMilestoneId = nextMs ? nextMs.id : null; // null = guide fully completed
        } else {
          // Member is actively on this milestone
          currentMilestoneId = bestActiveMilestoneId;
        }
      } else if (m.completedMilestoneIds.size > 0) {
        // Has completed some milestones but no active steps — find next after last completed
        let maxCompletedOrder = -1;
        m.completedMilestoneIds.forEach(id => {
          const ms = sortedM.find(s => s.id === id);
          if (ms && ms.order > maxCompletedOrder) maxCompletedOrder = ms.order;
        });
        const nextMs = sortedM.find(ms => ms.order > maxCompletedOrder && !m.completedMilestoneIds.has(ms.id));
        currentMilestoneId = nextMs ? nextMs.id : null;
      }
      // If no activity at all: don't show in presenceMap (currentMilestoneId stays null)

      return {
        profileId: m.profileId,
        userName: m.userName,
        userAvatar: m.userAvatar,
        profileSlug: m.profileSlug,
        completedSteps: m.completedSteps,
        completedMilestoneIds: m.completedMilestoneIds,
        currentMilestoneId,
        bookmarkedSteps: m.bookmarkedSteps
      };
    });
  }, [guildProgress, milestones]);

  // Presence mapping (maps milestone ID to members currently active there)
  const presenceMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    uniqueGuildMembers.forEach(m => {
      if (m.currentMilestoneId) {
        if (!map[m.currentMilestoneId]) map[m.currentMilestoneId] = [];
        map[m.currentMilestoneId].push(m);
      }
    });
    return map;
  }, [uniqueGuildMembers]);

  // ─── Temps réel (Phase F) : présence live du guide ──────────────────────────
  const guideLive = useGuidePresence({
    guildId,
    guideSlug: guide.slug,
    milestoneId: selected?.id ?? null,
    userName: myIdentity.name,
    userAvatar: myIdentity.image,
    enabled: !incognito,
  });

  // Carte milestoneId → membres LIVE ; remplace presenceMap quand on est connecté.
  const livePresenceMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    guideLive.presence.forEach(m => {
      if (!map[m.milestoneId]) map[m.milestoneId] = [];
      map[m.milestoneId].push(m);
    });
    return map;
  }, [guideLive.presence]);

  // Fail-soft : props serveur tant que le WS n'est pas connecté (jamais d'écran vide).
  const effectivePresenceMap = guideLive.connectionStatus === "connected" ? livePresenceMap : presenceMap;

  // Build chapters
  const chapters = useMemo(() => {
    const map = new Map<number, { label: string; items: Milestone[] }>();
    milestones.forEach(ms => {
      if (!map.has(ms.chapter)) map.set(ms.chapter, { label: ms.chapterLabel, items: [] });
      map.get(ms.chapter)!.items.push(ms);
    });
    return Array.from(map.entries())
      .sort(([a],[b]) => a - b)
      .map(([ch, v]) => ({ chapter: ch, label: v.label, items: v.items.sort((a,b)=>a.order-b.order) }));
  }, [milestones]);

  // Filter sidebar by search, active sub-guide filter, and hide-completed toggle
  const filteredChapters = useMemo(() => {
    let list = chapters;

    if (activeGuideFilter) {
      list = list.map(ch => ({
        ...ch,
        items: ch.items.filter(m => m.sequences.some(s => s.subGuideName === activeGuideFilter))
      })).filter(ch => ch.items.length > 0);
    }

    return list;
  }, [chapters, activeGuideFilter]);

  // Overall progress
  const totalDone = completedIds.size;
  const totalMs = milestones.length;
  const overallPct = totalMs > 0 ? Math.round((totalDone / totalMs) * 100) : 0;

  // Navigation: Filters milestones array to strictly support sub-guide step scope if active
  const flatList = useMemo(() => {
    const list = [...milestones].sort((a,b)=>a.order-b.order);
    if (!activeGuideFilter) return list;
    return list.filter(m => m.sequences.some(s => s.subGuideName === activeGuideFilter));
  }, [milestones, activeGuideFilter]);

  const filteredModalMilestones = useMemo(() => {
    if (!modalSearchQuery.trim()) return flatList;
    const q = modalSearchQuery.toLowerCase();
    return flatList.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.sequences.some(s => s.subGuideName.toLowerCase().includes(q))
    );
  }, [flatList, modalSearchQuery]);

  const selectedIdx = selected ? flatList.findIndex(m => m.id === selected.id) : -1;
  const prevMs = selectedIdx > 0 ? flatList[selectedIdx - 1] : null;
  const nextMs = selectedIdx < flatList.length - 1 ? flatList[selectedIdx + 1] : null;

  // Scroll to top on milestone change
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [selected?.id]);

  // Removed JS-based layout DOM adjustment in favor of declarative <style> injection in render  // Guild members on current step
  const membersHere = useMemo(() =>
    selected ? (effectivePresenceMap[selected.id] || []) : [],
  [selected, effectivePresenceMap]);

  // Valider un SOUS-GUIDE d'un coup : coche toutes ses étapes + une seule persistance.
  const handleCompleteSubGuide = useCallback((keys: string[]) => {
    if (!selected || keys.length === 0) return;
    setCheckedSteps(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      const milestoneKeys = Array.from(next).filter(k =>
        selected.sequences.some(s => k.startsWith(`${s.subGuideRef}-`))
      );
      updateStepProgress(guildId, selected.id, milestoneKeys).catch(() => {});
      return next;
    });
    toast.success(`Sous-guide validé ✓ (${keys.length} étape${keys.length > 1 ? "s" : ""})`);
  }, [selected, guildId]);

  const handleStepToggle = useCallback((ref: string, n: number) => {
    const key = `${ref}-${n}`;
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);

      // Persist to DB: gather all checked keys for the current milestone's sequences
      if (selected) {
        const milestoneKeys = Array.from(next).filter(k =>
          selected.sequences.some(s => k.startsWith(`${s.subGuideRef}-`))
        );
        // Fire-and-forget: don't block UI
        updateStepProgress(guildId, selected.id, milestoneKeys).catch(() => {});
      }

      return next;
    });
  }, [selected, guildId]);

  // ─── Sommaire (tiroir TOC + rail épinglable, mode unique plein écran) ─────────
  const router = useRouter();
  const [tocOpen, setTocOpen] = useState(false);
  const [tocPinned, setTocPinned] = useState(false);
  // Recherche dans le sommaire (titres de jalons + sous-guides).
  const [tocSearchQuery, setTocSearchQuery] = useState("");

  // Écrans < 1200px : le rail épinglé se replie → le tiroir drawer reste le seul accès
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1200px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Le tiroir n'est rendu que si le rail épinglé n'est pas déjà visible (large écran)
  const drawerActive = tocOpen && (!tocPinned || isNarrow);

  const toggleToc = useCallback(() => setTocOpen(v => !v), []);
  // Ouverture intelligente : si le rail épinglé est visible (écran >= 1200px),
  // le bouton Sommaire / la touche S n'ouvrent pas de tiroir superflu.
  const toggleTocSide = useCallback(() => {
    if (tocPinned && !isNarrow) return;
    setTocOpen(v => !v);
  }, [tocPinned, isNarrow]);

  // Persistance du mode épinglé par guide (pattern guide-sommaire-{slug} existant)
  const tocPinKey = `guide-toc-pinned-${guildId}-${guide.slug}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(tocPinKey);
      if (stored === "true") setTocPinned(true);
    } catch { /* localStorage indisponible → drawer par défaut */ }
  }, [tocPinKey]);

  const toggleTocPin = useCallback(() => {
    setTocPinned(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(tocPinKey, next ? "true" : "false");
      } catch { /* non bloquant */ }
      if (next) setTocOpen(false);
      return next;
    });
  }, [tocPinKey]);

  // Résultats de recherche sommaire : match sur titre de jalon, chapitre et sous-guides.
  const tocSearchResults = useMemo(() => {
    const q = tocSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const out: { ms: Milestone; chapterLabel: string }[] = [];
    chapters.forEach(ch => {
      ch.items.forEach(ms => {
        const haystack = [
          ms.title,
          ms.chapterLabel,
          ...ms.sequences.map(s => `${s.subGuideRef} ${s.subGuideName}`)
        ].join(" ").toLowerCase();
        if (haystack.includes(q)) out.push({ ms, chapterLabel: ch.label });
      });
    });
    return out;
  }, [tocSearchQuery, chapters]);

  // Clic sur un résultat de recherche : ouvre le jalon + surbrillance dans le sommaire.
  const handleTocSearchSelect = useCallback((ms: Milestone, pinned: boolean) => {
    setSelected(ms);
    setTocSearchQuery("");
    if (!pinned) { setTocOpen(false); return; }
    // Rail épinglé : surligner la ligne du jalon dans le sommaire.
    setTimeout(() => {
      const el = document.getElementById(`ms-row-${ms.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "background-color 0.5s";
        const oldBg = el.style.backgroundColor;
        el.style.backgroundColor = "rgba(212, 168, 83, 0.25)";
        setTimeout(() => { el.style.backgroundColor = oldBg; }, 1500);
      }
    }, 200);
  }, []);

  // --- Selecteur de guide (HUD) — déclaré ici car utilisé par la hiérarchie Échap --
  const [guidesOpen, setGuidesOpen] = useState(false);

  // Raccourci clavier S : ouvrir/fermer le sommaire · Échap : hiérarchie
  // (1. ferme le sélecteur de guide 2. ferme le tiroir 3. quitte le module)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "s" || e.key === "S") { toggleTocSide(); }
      if (e.key === "Escape") {
        if (guidesOpen) { setGuidesOpen(false); return; }
        if (drawerActive) { setTocOpen(false); return; }
        router.push(`/dashboard/${guildId}/quetes-dofus`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guidesOpen, drawerActive, toggleTocSide, guildId, router]);

  // --- Selecteur de guide (HUD) ---------------------------------------------------
  const [guidesList, setGuidesList] = useState<{ id: string; slug: string; name: string; displayMode?: string | null }[]>([]);
  const [guidesLoaded, setGuidesLoaded] = useState(false);

  useEffect(() => {
    if (guidesLoaded) return;
    let cancelled = false;
    getOptimizedGuidesLite(guildId).then(res => {
      if (cancelled || !res?.success) return;
      setGuidesList((res.guides || []).filter((g: any) => g.slug !== guide.slug));
      setGuidesLoaded(true);
    }).catch(() => { /* non bloquant */ });
    return () => { cancelled = true; };
  }, [guildId, guide.slug, guidesLoaded]);

  useEffect(() => {
    if (!guidesOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.guide-switcher')) setGuidesOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [guidesOpen]);



  const handleToggleMs = useCallback(async () => {
    if (!selected) return;
    setValidating(true);
    const isCurrentlyCompleted = completedIds.has(selected.id);
    try {
      const res = await toggleMilestoneProgress(guildId, selected.id, !isCurrentlyCompleted, altPseudo);
      if ((res as any).success) {
        setCompletedIds(prev => {
          const next = new Set(prev);
          if (next.has(selected.id)) { 
            next.delete(selected.id); 
          } else {
            next.add(selected.id);
            sessionValidatedCountRef.current += 1;
            
            // Save to localStorage immediately
            const key = sessionStorageKey;
            const stored = localStorage.getItem(key);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                parsed.sessionValidatedCount = sessionValidatedCountRef.current;
                localStorage.setItem(key, JSON.stringify(parsed));
              } catch (e) {}
            }

            toast.success("Étape validée ! 🎉", { description: selected.title });
            // Auto-advance
            if (nextMs) setTimeout(() => setSelected(nextMs), 600);
          }
          return next;
        });
      }
    } catch { toast.error("Erreur de synchronisation"); }
    finally { setValidating(false); }
  }, [selected, guildId, nextMs, completedIds, altPseudo]);

  // ─── Reset single milestone ────────────────────────────────────────────────
  const handleResetMilestone = useCallback(() => {
    setIsResetMilestoneConfirmOpen(true);
  }, []);

  const confirmResetMilestone = useCallback(async () => {
    if (!selected) return;
    setValidating(true);
    setIsResetMilestoneConfirmOpen(false);
    try {
      const res = await resetMilestoneProgress(guildId, selected.id, altPseudo);
      if ((res as any).success) {
        setCompletedIds(prev => {
          const next = new Set(prev);
          next.delete(selected.id);
          return next;
        });
        setCheckedSteps(prev => {
          const next = new Set(prev);
          selected.sequences.forEach(seq => {
            Array.from(next).filter(k => k.startsWith(`${seq.subGuideRef}-`)).forEach(k => next.delete(k));
          });
          return next;
        });
        setBookmarkStepKey(null);
        localStorage.removeItem(bookmarkStepStorageKey);
        toast.success("Jalon réinitialisé ↺", { description: selected.title });
      }
    } catch { toast.error("Erreur lors de la réinitialisation"); }
    finally { setValidating(false); }
  }, [selected, guildId, altPseudo, guide.slug]);

  // ─── Reset entire guide ────────────────────────────────────────────────────
  const handleResetGuide = useCallback(() => {
    setIsResetGuideConfirmOpen(true);
  }, []);

  const confirmResetGuide = useCallback(async () => {
    setValidating(true);
    setIsResetGuideConfirmOpen(false);
    try {
      const res = await resetGuideProgress(guildId, guide.id, altPseudo);
      if ((res as any).success) {
        setCompletedIds(new Set());
        setCheckedSteps(new Set());
        setBookmarkId(null);
        setBookmarkStepKey(null);
        localStorage.removeItem(bookmarkStorageKey);
        localStorage.removeItem(bookmarkStepStorageKey);
        localStorage.removeItem(sessionStorageKey);
        toast.success("Guide réinitialisé ↺", { description: "Toute votre progression a été effacée." });
      }
    } catch { toast.error("Erreur lors de la réinitialisation du guide"); }
    finally { setValidating(false); }
  }, [guildId, guide.id, guide.slug, altPseudo]);

  // ─── Valider TOUT le guide d'un coup ─────────────────────────────────────────
  const handleCompleteGuide = useCallback(() => {
    setIsCompleteGuideConfirmOpen(true);
  }, []);

  // ─── Mode discret : ne plus émettre sa présence (reste récepteur) ────────────
  const toggleIncognito = useCallback(() => {
    setIncognito(prev => {
      const next = !prev;
      try { localStorage.setItem(`guide-incognito-${guildId}`, next ? "true" : "false"); } catch {}
      if (next) toast.info("Mode discret activé — votre présence est masquée");
      else toast.success("Mode discret désactivé");
      return next;
    });
  }, [guildId]);

  // ─── Effet d'ambiance : particules désactivables ─────────────────────────────
  const toggleParticles = useCallback(() => {
    setParticlesEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(`guide-particles-${guildId}`, next ? "true" : "false"); } catch {}
      return next;
    });
  }, [guildId]);

  const confirmCompleteGuide = useCallback(async () => {
    setIsCompletingGuide(true);
    setIsCompleteGuideConfirmOpen(false);
    try {
      const res = await completeGuideProgress(guildId, guide.id, altPseudo);
      if ((res as any).success) {
        // Tous les jalons complétés côté client (le serveur a persisté chaque milestone)
        setCompletedIds(new Set(milestones.map(m => m.id)));
        toast.success("Guide validé 🎉", { description: "Tous les jalons sont maintenant complétés." });
      }
    } catch { toast.error("Erreur lors de la validation du guide"); }
    finally { setIsCompletingGuide(false); }
  }, [guildId, guide.id, altPseudo, milestones]);

  const handleInteractiveClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Helper to extract step number from attributes or text
    const extractTargetStep = (el: HTMLElement) => {
      let targetStep = parseInt(el.getAttribute("stepnumber") || "0", 10);
      if (targetStep <= 1) {
        // Try parsing surrounding text for "étape X"
        const parentText = el.parentElement?.textContent || el.textContent || "";
        const etapeMatch = parentText.match(/étapes?\s+(\d+)/i) || parentText.match(/etapes?\s+(\d+)/i);
        if (etapeMatch) {
          targetStep = parseInt(etapeMatch[1], 10);
        }
      }
      return targetStep;
    };

    // Helper to scroll to step
    const scrollToStep = (ref: string, targetStep: number) => {
      if (targetStep > 0) {
        setTimeout(() => {
          const stepEl = document.getElementById(`sgc-step-${ref}-${targetStep}`);
          if (stepEl) {
            stepEl.scrollIntoView({ behavior: "smooth", block: "center" });
            stepEl.style.transition = "background-color 0.5s";
            const oldBg = stepEl.style.backgroundColor;
            stepEl.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
            setTimeout(() => stepEl.style.backgroundColor = oldBg, 1500);
          } else {
            // Retry after a bit in case card is expanding
            setTimeout(() => {
              const stepEl2 = document.getElementById(`sgc-step-${ref}-${targetStep}`);
              if (stepEl2) {
                stepEl2.scrollIntoView({ behavior: "smooth", block: "center" });
                stepEl2.style.transition = "background-color 0.5s";
                const oldBg = stepEl2.style.backgroundColor;
                stepEl2.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
                setTimeout(() => stepEl2.style.backgroundColor = oldBg, 1500);
              }
            }, 500);
          }
        }, 150);
      } else {
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    // 0. Guide-step spans (cross-guide navigation)
    const guideStepEl = target.closest(".guide-step-link") as HTMLElement;
    if (guideStepEl) {
      e.stopPropagation();
      e.preventDefault();
      const guideName = guideStepEl.getAttribute("guidename") || guideStepEl.getAttribute("guideName") || "";
      const refMatch = guideName.match(/\[GP(\d+)\]/i);
      const ref = refMatch ? `GP${refMatch[1]}` : "";
      const targetStep = extractTargetStep(guideStepEl);

      if (ref) {
        let foundSeqIndex = 0;
        let targetMs = milestones.find(m => {
          const titleMatch = (m.title || "").toUpperCase().includes(ref.toUpperCase());
          const chapterMatch = (m.chapterLabel || "").toUpperCase().includes(ref.toUpperCase());
          if (titleMatch || chapterMatch) {
            const sortedSeqs = [...m.sequences].sort((a,b) => a.order - b.order);
            const idx = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref.toUpperCase());
            if (idx !== -1) foundSeqIndex = idx;
            return true;
          }
          return false;
        });

        if (!targetMs) {
          const containingMs = milestones.filter(m => m.sequences.some(s => s.subGuideRef.toUpperCase() === ref.toUpperCase()));
          if (containingMs.length > 0) {
            targetMs = containingMs.find(m => m.id === selected?.id) || containingMs[0];
            const sortedSeqs = [...targetMs.sequences].sort((a,b) => a.order - b.order);
            foundSeqIndex = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref.toUpperCase());
          }
        }

        if (targetMs) {
          if (targetMs.id !== selected?.id) {
            setSelected(targetMs);
            toast.info(`→ ${targetMs.title}`);
          }
          setActiveSeqIndex(foundSeqIndex);
          scrollToStep(ref, targetStep);
        } else {
          import("@/server/actions/optimized-guide-actions").then((mod: any) => {
            mod.findGuideBySubRef(ref).then((res: any) => {
              if (res?.success && res.slug) {
                toast.info(`Ouverture du guide ${res.guideName || ref}…`);
                let url = `/dashboard/${guildId}/quetes-dofus/guide/${res.slug}`;
                if (targetStep > 0) url += `?step=${ref}-${targetStep}`;
                window.location.href = url;
              } else {
                toast.warning(`Sous-guide ${ref} introuvable dans cette roadmap.`);
              }
            });
          });
        }
      }
      return;
    }

    // 1.5 Coordinate chip click (ONLY copies the travel command)
    const chip = target.closest(".coord-chip") as HTMLElement;
    if (chip) {
      e.stopPropagation();
      e.preventDefault();
      const x = chip.getAttribute("data-x");
      const y = chip.getAttribute("data-y");
      if (x && y) {
        const xNum = parseInt(x);
        const yNum = parseInt(y);
        navigator.clipboard.writeText(`/travel ${xNum} ${yNum}`);
        chip.classList.add("copied");
        setTimeout(() => chip.classList.remove("copied"), 1500);

        toast.custom((t) => (
          <div className="flex items-center gap-3 bg-zinc-950/95 border border-emerald-500/30 p-3.5 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Copy className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Position copiée</p>
              <p className="text-xs font-mono text-zinc-300">/travel {xNum} {yNum}</p>
            </div>
          </div>
        ), {
          position: "bottom-right",
          duration: 3000
        });
      }
      return;
    }

    // 2. Guide References [GPx]
    const guideRef = target.closest(".guide-ref-link") as HTMLElement;
    if (guideRef) {
      e.stopPropagation();
      e.preventDefault();
      const ref = (guideRef.getAttribute("data-ref") || "").toUpperCase().trim();
      const targetStep = extractTargetStep(guideRef);
      
      let foundSeqIndex = 0;
      let targetMs = milestones.find(m => {
        const titleMatch = (m.title || "").toUpperCase().includes(ref);
        const chapterMatch = (m.chapterLabel || "").toUpperCase().includes(ref);
        if (titleMatch || chapterMatch) {
          const sortedSeqs = [...m.sequences].sort((a,b) => a.order - b.order);
          const idx = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref);
          if (idx !== -1) foundSeqIndex = idx;
          return true;
        }
        return false;
      });

      if (!targetMs) {
        const containingMs = milestones.filter(m => m.sequences.some(s => s.subGuideRef.toUpperCase() === ref));
        if (containingMs.length > 0) {
          targetMs = containingMs.find(m => m.id === selected?.id) || containingMs[0];
          const sortedSeqs = [...targetMs.sequences].sort((a,b) => a.order - b.order);
          foundSeqIndex = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref);
        }
      }

      if (targetMs) {
        if (targetMs.id !== selected?.id) {
          setSelected(targetMs);
          toast.info(`→ ${targetMs.title}`);
        }
        setActiveSeqIndex(foundSeqIndex);
        scrollToStep(ref, targetStep);
      } else {
        import("@/server/actions/optimized-guide-actions").then((mod: any) => {
          mod.findGuideBySubRef(ref).then((res: any) => {
            if (res?.success && res.slug) {
              toast.info(`Ouverture du guide ${res.guideName || ref}…`);
              let url = `/dashboard/${guildId}/quetes-dofus/guide/${res.slug}`;
              if (targetStep > 0) url += `?step=${ref}-${targetStep}`;
              window.open(url, "_blank");
            } else {
              toast.warning(`Guide ${ref} introuvable.`);
            }
          });
        });
      }
      return;
    }

    // 2.5 Image Lightbox Click
    if (target.tagName === "IMG") {
      const parentInteractive = target.closest(".clickable-entity, .guide-step-link, .coord-chip, .guide-ref-link");
      if (!parentInteractive) {
        const src = target.getAttribute("src");
        if (src) {
          e.stopPropagation();
          e.preventDefault();
          setImageModal(src);
        }
        return;
      }
    }

    // 3. Clickable Entities (Dungeons, Items, Quests)
    const entity = target.closest(".clickable-entity") as HTMLElement;
    if (entity) {
      e.stopPropagation();
      e.preventDefault();
      const dbid = entity.getAttribute("dofusdbid") || entity.getAttribute("data-dbid");
      const dbtype = entity.getAttribute("data-dbtype") || "items";
      const name = entity.getAttribute("name") || entity.innerText;
      const dofusdbIdVal = dbid ? parseInt(dbid, 10) : null;
      
      const isDungeon = entity.classList.contains("tag-dungeon") || entity.getAttribute("type") === "dungeon" || dbtype === "bosses";
      
      if (isDungeon) {
        setDungeonChoiceModal({
          isOpen: true,
          name,
          dofusdbId: dofusdbIdVal,
          dbtype,
          isLoadingUrl: true,
          customUrl: null
        });
        setEditingNoobsUrl(false);
        setNoobsUrlInput("");

        import("@/server/actions/game-data-actions").then((mod) => {
            mod.checkDungeonExists(name, dofusdbIdVal).then((res) => {
                setDungeonChoiceModal(prev => {
                    if (!prev || prev.name !== name) return prev;
                    return {
                        ...prev,
                        isLoadingUrl: false,
                        customUrl: res.data?.dungeon?.dofuspourlesnoobsUrl || null
                    };
                });
                if (res.data?.dungeon?.dofuspourlesnoobsUrl) {
                    setNoobsUrlInput(res.data.dungeon.dofuspourlesnoobsUrl);
                } else {
                    const slug = getNoobsDungeonSlug(name);
                    setNoobsUrlInput(`https://www.dofuspourlesnoobs.com/${slug}.html`);
                }
            });
        });
      } else if (dbtype === "quests" || entity.classList.contains("tag-quest") || entity.getAttribute("type") === "quest") {
        setQuestChoiceModal({
          isOpen: true,
          name,
          dofusdbId: dofusdbIdVal
        });
      } else if (dbid) {
        let singularType = dbtype.endsWith("s") ? dbtype.slice(0, -1) : dbtype;
        if (singularType === "bosse" || singularType === "monster") {
          singularType = "monster";
        } else if (singularType === "resource") {
          singularType = "item";
        }
        window.open(`https://dofusdb.fr/fr/database/${singularType}/${dbid}`, "_blank");
        toast.info(`Ouverture DofusDB`);
      }
      return;
    }
  }, [milestones, guildId, setCreateDjModal, setCreateUnpopulatedDjModal, setDungeonChoiceModal, setQuestChoiceModal, selected]);


  // Sous-guide actif (pour le HUD : "Phase X · [GPx] nom · Z%")
  // Quand « masquer les étapes validées » est actif, les sous-guides 100 % validés
  // (bornes connues) sont retirés de la pagination.
  const visibleSeqs = useMemo(() => {
    if (!selected) return [];
    const sorted = [...selected.sequences].sort((a, b) => a.order - b.order);
    return globalHideCompletedSteps ? sorted.filter(s => !isSeqFullyDone(s, checkedSteps)) : sorted;
  }, [selected, globalHideCompletedSteps, checkedSteps]);
  const activeSeq = selected ? visibleSeqs[activeSeqIndex] || visibleSeqs[0] || null : null;
  // Borne l'index quand des sous-guides disparaissent (validés + masqués).
  useEffect(() => {
    if (activeSeqIndex >= visibleSeqs.length) setActiveSeqIndex(0);
  }, [visibleSeqs.length, activeSeqIndex]);
  const isCompleted = selected ? completedIds.has(selected.id) : false;
  const typeConf = selected ? (TYPE_CONFIG[selected.type] ?? TYPE_CONFIG.QUETE_SERIE) : TYPE_CONFIG.QUETE_SERIE;

  // ─── Contenu du sommaire (drawer OU rail épinglé) — un seul composant, deux conteneurs ───
  const renderTocPanel = ({ pinned }: { pinned: boolean }) => (
    <>
      <div className="toc-header">
        <div className="toc-title">
          <span className="toc-title-label">Sommaire</span>
          <span className="toc-title-name">{guide.name}</span>
          <span className="toc-title-progress">{overallPct}% complété</span>
        </div>
        <div className="toc-header-actions">
          <button
            type="button"
            className={"toc-pin-btn" + (pinned ? " active" : "")}
            onClick={toggleTocPin}
            title={pinned ? "Désépingler le sommaire" : "Épingler le sommaire (rail fixe)"}
            aria-pressed={pinned}
          >
            {pinned ? <PinOff size={14}/> : <Pin size={14}/>}
          </button>
          {!pinned && (
            <button type="button" className="toc-close" onClick={() => setTocOpen(false)} title="Fermer (S ou Échap)">
              <X size={15}/>
            </button>
          )}
        </div>
      </div>
      <div className="toc-search">
        <Search size={12} className="toc-search-icon"/>
        <input
          type="text"
          className="toc-search-input"
          placeholder="Rechercher un jalon ou un sous-guide…"
          value={tocSearchQuery}
          onChange={(e) => setTocSearchQuery(e.target.value)}
          aria-label="Rechercher dans le sommaire"
        />
        {tocSearchQuery && (
          <button type="button" className="toc-search-clear" onClick={() => setTocSearchQuery("")} aria-label="Effacer la recherche">
            <X size={12}/>
          </button>
        )}
      </div>
      {activeGuideFilter && (
        <button type="button" className="toc-back-main" onClick={handleBackToMainGuideCurrentStep}>
          <BookOpenCheck size={12}/> ← Guide principal
        </button>
      )}
      <div className="sidebar-chapters toc-chapters">
        {tocSearchQuery.trim() ? (
          tocSearchResults.length === 0 ? (
            <div className="sidebar-empty"><Info size={14}/> Aucun jalon trouvé</div>
          ) : (
            tocSearchResults.map(({ ms, chapterLabel }) => {
              const isDone = completedIds.has(ms.id);
              return (
                <div
                  key={ms.id}
                  className={`ms-row search-result${isDone ? " done" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTocSearchSelect(ms, pinned)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTocSearchSelect(ms, pinned); } }}
                >
                  <div className="ms-state">
                    {isDone ? <CheckCircle2 size={14} className="state-done"/> : <Circle size={14} className="state-todo"/>}
                  </div>
                  <span className="ms-title">{decodeTitle(ms.title)}</span>
                  <span className="ms-seqs">{chapterLabel}</span>
                </div>
              );
            })
          )
        ) : (
          filteredChapters.length === 0 ? (
            <div className="sidebar-empty"><Info size={14}/> Aucun résultat</div>
          ) : (
          filteredChapters.map((ch) => (
            <ChapterGroup
              key={ch.chapter}
              chapter={ch.chapter}
              label={ch.label}
              milestones={ch.items}
              selectedId={selected?.id}
              completedIds={completedIds}
              onSelect={ms => { setSelected(ms); if (!pinned) setTocOpen(false); }}
              isOpen={openChapters[ch.chapter] ?? false}
              onToggle={(open) => handleToggleChapter(ch.chapter, open)}
              presenceMap={effectivePresenceMap}
              checkedSteps={checkedSteps}
              hideDoneSeqs={globalHideCompletedSteps}
              bookmarkId={bookmarkId}
              guildId={guildId}
              onShowPresenceModal={(milestoneId, title) => setPresenceModal({ isOpen: true, milestoneId, milestoneTitle: title })}
              onBookmark={handleBookmark}
              onResetMilestone={handleResetMilestone}
            />
          ))
          )
        )}
      </div>
    </>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .dashboard-layout .container {
          max-width: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        footer, .site-footer, .app-footer {
          display: none !important;
        }
      `}} />
      <div className={"guide-shell" + (tocPinned ? " toc-pinned" : "")}>

      {/* Effet d'ambiance (particules) — désactivable via le menu Options */}
      <GuideParticles active={particlesEnabled} />

      {/* ── Sommaire épinglé (rail fixe, visible tant que >=1200px) ── */}
      {tocPinned && (
        <aside className="toc-rail">
          {renderTocPanel({ pinned: true })}
        </aside>
      )}

      {/* ── CENTER CONTENT ───────────────────────────────────────────────── */}
      <main className="guide-main" ref={mainRef}>
        {!selected ? (
          <div className="guide-empty">
            <Flag size={32} className="text-zinc-600"/>
            <p>Sélectionnez une étape dans la roadmap</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={selected.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
              className="guide-content"
            >
              {/* Barre sticky — sommaire, guide & progression */}
              <div className="guide-hud">
                <div className="guide-hud-row">
                  <Link
                    href={`/dashboard/${guildId}/quetes-dofus`}
                    className="hud-exit"
                    title="Quitter le guide (Échap)"
                    aria-label="Quitter le guide"
                  >
                    <X size={14}/>
                    <span>Quitter</span>
                  </Link>
                  <button
                    type="button"
                    className="guide-sommaire-btn"
                    onClick={toggleTocSide}
                    title="Ouvrir le sommaire (S)"
                  >
                    <PanelLeft size={14}/>
                    <span>Sommaire</span>
                  </button>

                  <div className="guide-switcher">
                    <button
                      type="button"
                      className="guide-switcher-btn"
                      onClick={() => setGuidesOpen(v => !v)}
                      title="Changer de guide"
                      aria-expanded={guidesOpen}
                    >
                      <BookOpen size={13}/>
                      <span className="guide-switcher-label">{guide.name}</span>
                      <ChevronDown size={12} className={"guide-switcher-chev" + (guidesOpen ? " open" : "")}/>
                    </button>
                    {guidesOpen && (
                      <div className="guide-switcher-menu">
                        <button
                          type="button"
                          className="guide-switcher-item"
                          onClick={() => { setGuidesOpen(false); router.push("/dashboard/" + guildId + "/quetes-dofus"); }}
                        >
                          <LayoutGrid size={13}/>
                          <span>Hub des guides</span>
                        </button>
                        {guidesList.map(g => {
                          const isCurrent = g.slug === guide.slug;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              className={"guide-switcher-item" + (isCurrent ? " current" : "")}
                              disabled={isCurrent}
                              onClick={() => { setGuidesOpen(false); router.push("/dashboard/" + guildId + "/quetes-dofus/guide/" + g.slug); }}
                            >
                              <BookOpen size={13}/>
                              <span className="truncate">{g.name}</span>
                              {g.displayMode === "TIMELINE" && <span className="guide-switcher-tag">Timeline</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="guide-hud-crumb">
                    Phase {selected.chapter > 0 ? selected.chapter : "Intro"}
                    {activeSeq ? (
                      <>
                        <span className="sep"> · </span>
                        <span className="gp">[{activeSeq.subGuideRef}] {activeSeq.subGuideName}</span>
                      </>
                    ) : null}
                    <span className="sep"> · </span>
                    <span className="here">{overallPct}% complété</span>
                  </div>

                  <div className="guide-hud-bar"><div style={{ width: overallPct + "%" }} /></div>
                  <span className="guide-hud-pct">{overallPct}%</span>
                </div>
              </div>

              {/* Bandeau contexte (style rush sylvestre) */}
              <div className="guide-hero">
                <div className="guide-hero-top">
                  <Link href={"/dashboard/" + guildId + "/quetes-dofus"} className="guide-hero-back">
                    <ChevronLeft size={16} className="guide-hero-back-icon"/>
                    <span>Quêtes Dofus</span>
                  </Link>
                  <div className="flex items-center gap-2 flex-wrap">
                    {uniqueGuildMembers.length > 0 && (
                      <button
                        type="button"
                        className="guide-hud-presence"
                        onClick={() => setIsAllMembersModalOpen(true)}
                        title={`${uniqueGuildMembers.length} membre${uniqueGuildMembers.length > 1 ? "s" : ""} de la guilde suivent ce guide — cliquer pour la liste`}
                      >
                        <div className="flex -space-x-1.5">
                          {uniqueGuildMembers.slice(0, 4).map(m => (
                            <span key={m.profileId} className="guide-hud-avatar">
                              {m.userAvatar ? <img src={m.userAvatar} alt={m.userName} referrerPolicy="no-referrer"/> : m.userName.slice(0, 1).toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <span className="guide-hud-presence-count">{uniqueGuildMembers.length}</span>
                        <span className="guide-hud-presence-label">membre{uniqueGuildMembers.length > 1 ? "s" : ""}</span>
                      </button>
                    )}
                    {/* Menu Options : toutes les actions du guide regroupées (fini la rangée d'icônes) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="guide-hud-btn guide-hud-menu-trigger"
                          title="Options du guide"
                          aria-label="Options du guide"
                        >
                          <Settings2 size={13}/>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="guide-hud-menu">
                        <DropdownMenuItem
                          onClick={() => setGlobalHideCompletedSteps(v => !v)}
                          className={globalHideCompletedSteps ? "current" : ""}
                        >
                          {globalHideCompletedSteps ? <Eye size={13}/> : <EyeOff size={13}/>}
                          <span>{globalHideCompletedSteps ? "Afficher les étapes validées" : "Masquer les étapes validées"}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setIsHelpOpen(true)}
                        >
                          <HelpCircle size={13}/>
                          <span>Comment utiliser ce guide ?</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={toggleIncognito}
                          className={incognito ? "current" : ""}
                        >
                          <Ghost size={13}/>
                          <span>{incognito ? "Désactiver le mode discret" : "Mode discret : masquer ma présence"}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={toggleParticles}
                          className={particlesEnabled ? "current" : ""}
                        >
                          <Sparkles size={13}/>
                          <span>{particlesEnabled ? "Désactiver l'effet d'ambiance" : "Activer l'effet d'ambiance (particules)"}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem onClick={handleCompleteGuide} disabled={isCompletingGuide || validating}>
                          <CheckCheck size={13}/>
                          <span>Tout valider le guide d'un coup</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleResetGuide}
                          disabled={validating}
                          className="danger"
                        >
                          <RotateCcw size={13}/>
                          <span>Réinitialiser le guide</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <QuestFeedbackButton guildId={guildId} sourcePage={"guide:" + guide.slug} targetSlug={guide.slug} compact />
                    <a
                      href="https://ganymede-app.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-hud-credit"
                      title="Parcours et étapes issus de Ganymède"
                    >
                      <img src="/assets/icons/ganymede.png" alt="Ganymède"/>
                    </a>
                    {/* Reset guide déplacé dans le menu Options */}
                  </div>
                </div>

                <div className="guide-hero-title">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-emerald-400"/>
                    <span className="guide-hero-eyebrow">Guide de Progression Complet</span>
                  </div>
                  <h1 className="guide-hero-name">{guide.name}</h1>
                  {guide.description && <p className="guide-hero-desc">{guide.description}</p>}
                </div>

                <div className="guide-hero-grid">
                  {/* Personnage actif */}
                  <div className="guide-hero-card">
                    <div className="guide-hero-card-icon class">
                      {(() => { const d = mainCharacter?.classe ? getClass(mainCharacter.classe) : null; return d ? <img src={d.icon} alt={d.name} className="w-full h-full object-contain p-0.5"/> : <Crown className="w-5 h-5 text-amber-500"/>; })()}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="guide-hero-card-label">Personnage Actif</p>
                      {mainCharacter?.pseudo ? (
                        <div className="flex items-center gap-1.5">
                          <GuideCharDropdown selectedCharacter={selectedCharacter} mainPseudo={mainCharacter.pseudo} mainClass={mainCharacter.classe} mules={mules} />
                          <button
                            type="button"
                            onClick={handleResetMilestone}
                            disabled={validating}
                            title="Réinitialiser ce jalon (étapes cochées et validation)"
                            className="flex items-center justify-center p-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      ) : (
                        <Link href={"/dashboard/" + guildId + "/profile"} className="guide-hero-link-btn">
                          <Pencil size={12}/> Lier mon pseudo <ExternalLink size={12}/>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Alignement / Ordre — cliquable : ouvre l'édition */}
                  <div
                    className="guide-hero-card guide-hero-card-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsAlignModalOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsAlignModalOpen(true); } }}
                    title="Modifier mon alignement / ordre"
                  >
                    {(() => {
                      const { alignment, alignmentOrder, alignmentLevel } = currentUserProfile || {};
                      if (!alignment || alignment === "neutre") {
                        return (
                          <>
                            <div className="guide-hero-card-icon align neutral"><img src="/ordres/neutre.png" alt="" className="w-5 h-5 object-contain opacity-50"/></div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="guide-hero-card-label">Alignement</p>
                              <p className="guide-hero-card-value dim">{!alignment ? "Non défini" : "Neutre"}</p>
                            </div>
                          </>
                        );
                      }
                      const ad = getAlignment(alignment);
                      const ords = (ORDERS as unknown as Record<string, any[]>)[alignment.toLowerCase()] || [];
                      const od = alignmentOrder ? ords.find((o: any) => o.id === alignmentOrder) : null;
                      if (od) {
                        const isBonta = alignment === "bontarien";
                        const trancheTitle = alignmentLevel && alignmentLevel > 0 ? (od as any).levels?.[alignmentLevel as number] || "" : "";
                        return (
                          <>
                            <div className={"guide-hero-card-icon align " + (isBonta ? "bonta" : "brak")}>
                              <img src={od.icon} alt="" className="w-5 h-5 object-contain"/>
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="guide-hero-card-label">Ordre</p>
                              <p className={"guide-hero-card-value " + (isBonta ? "bonta" : "brak")}>{od.name}</p>
                              {(alignmentLevel ?? 0) > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="guide-hero-tranche">Tranche {alignmentLevel}</span>
                                  {trancheTitle && <span className="guide-hero-tranche-title">{trancheTitle}</span>}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className="guide-hero-card-icon align neutral"><img src={ad?.icon || "/ordres/neutre.png"} alt="" className="w-5 h-5 object-contain"/></div>
                          <div className="text-left min-w-0 flex-1">
                            <p className="guide-hero-card-label">Alignement</p>
                            <p className="guide-hero-card-value dim">{ad?.name || alignment}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Métamob / Ocre */}
                  <div className="guide-hero-card">
                    <div className="guide-hero-card-icon ocre"><img src="/assets/icons/ocre.png" alt="Ocre" className="w-6 h-6 object-contain"/></div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="guide-hero-card-label">Metamob</p>
                      {currentUserProfile?.metamobPseudo ? (
                        <button type="button" className="guide-hero-metamob-link" onClick={() => setIsOcreModalOpen(true)}>
                          {ocreStats ? (
                            <>
                              <span>Gardiens <span className="font-mono text-white">{ocreStats.bosses?.gathered ?? 0}<span className="text-zinc-500">/{ocreStats.bosses?.total ?? 51}</span></span></span>
                              <span className="text-zinc-600">·</span>
                              <span>Archis <span className="font-mono text-white">{ocreStats.archis?.gathered ?? 0}<span className="text-zinc-500">/{ocreStats.archis?.total ?? 286}</span></span></span>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-400/80">Voir ma progression →</span>
                          )}
                          <ExternalLink size={12} className="text-amber-400/60 shrink-0"/>
                        </button>
                      ) : (
                        <Link href={"/dashboard/" + guildId + "/profile"} className="guide-hero-link-btn amber">
                          <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain"/>
                          Lier Metamob
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Ma progression */}
                  <div className="guide-hero-card">
                    <div className="guide-hero-card-icon progress"><ProgressRing pct={overallPct} size={30} stroke={3} color="#10b981"/></div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="guide-hero-card-label">Progression</p>
                      <p className="guide-hero-card-value">{overallPct}% <span className="text-zinc-500 font-mono text-[10px]">({totalDone}/{totalMs})</span></p>
                      <div className="guide-hero-bar"><div style={{ width: overallPct + "%" }}/></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne de lecture 840px — le HUD et le hero restent pleine largeur */}
              <div className="guide-read-col">

              {/* Step header with Navigator */}
              <header className="step-header">
                <div className="step-meta-row">
                  <span className="step-phase-badge">Phase {selected.chapter > 0 ? selected.chapter : "Intro"}</span>
                  <span className="step-type-badge"
                    style={{ background: typeConf.bg, color: typeConf.color, borderColor: typeConf.color + "40" }}>
                    {typeConf.label}
                  </span>
                  {selected.isOptional && <span className="step-optional-badge">Bonus</span>}
                </div>

                <h1 className="step-title">{decodeTitle(selected.title)}</h1>
                {selected.subtitle && <p className="step-subtitle">{selected.subtitle}</p>}

                {/* Step presence banner */}
                {membersHere.length > 0 && (
                  <div 
                    className="step-presence-banner flex items-center justify-between p-3.5 mt-4 rounded-xl bg-zinc-950/40 border border-white/5 cursor-pointer hover:bg-zinc-950/60 hover:border-emerald-500/30 transition-colors select-none group"
                    onClick={() => setPresenceModal({ isOpen: true, milestoneId: selected.id, milestoneTitle: selected.title })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2 overflow-hidden">
                        {membersHere.slice(0, 5).map((m) => (
                          <div
                            key={m.profileId}
                            className="inline-block h-7 w-7 rounded-full ring-2 ring-zinc-950 bg-zinc-900 overflow-hidden"
                          >
                            {m.userAvatar ? (
                              <img src={m.userAvatar} alt={m.userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-400 bg-zinc-800">
                                {m.userName.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                        ))}
                        {membersHere.length > 5 && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-zinc-950 bg-zinc-800 text-[10px] font-black text-zinc-300">
                            +{membersHere.length - 5}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                          {membersHere.length} {membersHere.length > 1 ? "membres sont" : "membre est"} sur cette étape
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Cliquer pour voir la liste complète des pseudos cliquables
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-white/5 text-[10px] font-bold text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-all">
                      <Users size={10} className="shrink-0" />
                      <span>Voir la guilde</span>
                    </div>
                  </div>
                )}
              </header>

              {/* Narrative block */}
              {selected.description && (
                <div onClick={handleInteractiveClick}>
                  <NarrativeBlock html={selected.description}/>
                </div>
              )}

              {/* Sub-guide cards (Paginated!) */}
              {selected.sequences.length > 0 && (() => {
                if (visibleSeqs.length === 0) {
                  return (
                    <section className="subguides-section">
                      <div className="sgc-empty p-8 text-center bg-zinc-950/20 border border-white/5 rounded-2xl">
                        <BookOpenCheck size={24} className="mx-auto mb-2 text-emerald-500" />
                        <span>Tous les sous-guides de cette étape sont validés. 🎉</span>
                      </div>
                    </section>
                  );
                }
                return (
                  <section className="subguides-section">
                    <p className="subguides-hint">
                      Cette étape du guide principal se suit via le sous-guide ci-dessous : cochez chaque étape au fur et à mesure de votre progression.
                    </p>

                    <div className="subguides-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>Sous-guide</span>
                        <span className="subguides-count">
                          Partie {activeSeqIndex + 1} / {visibleSeqs.length}
                        </span>
                      </div>
                      <button
                        className={`global-hide-steps-btn ${globalHideCompletedSteps ? "active" : ""}`}
                        onClick={() => setGlobalHideCompletedSteps(v => !v)}
                        title={globalHideCompletedSteps ? "Afficher toutes les étapes validées" : "Masquer toutes les étapes validées"}
                      >
                        {globalHideCompletedSteps ? <Eye size={11}/> : <EyeOff size={11}/>}
                        <span>{globalHideCompletedSteps ? "Afficher les étapes validées" : "Masquer les étapes validées"}</span>
                      </button>
                    </div>

                    {/* Horizontal tabs pagination for quick selection */}
                    {visibleSeqs.length > 1 && (
                      <div className="subguides-pagination-tabs">
                        {visibleSeqs.map((seq, idx) => {
                          const isActive = idx === activeSeqIndex;
                          return (
                            <button
                              key={seq.id}
                              className={`subguide-tab-btn ${isActive ? "active" : ""}`}
                              onClick={() => setActiveSeqIndex(idx)}
                            >
                              <span className="tab-num">Partie {idx + 1}</span>
                              <span className="tab-ref">{seq.subGuideRef}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="subguides-list">
                      {activeSeq && (
                        <SubGuideCard
                          key={activeSeq.id}
                          seq={activeSeq}
                          checkedSteps={checkedSteps}
                          onStepToggle={handleStepToggle}
                          uniqueGuildMembers={uniqueGuildMembers}
                          milestones={milestones}
                          selectedMilestoneId={selected?.id || ""}
                          onShowStepPresenceModal={handleShowStepPresenceModal}
                          onInteractiveClick={handleInteractiveClick}
                          defaultExpanded={true}
                          hideCompletedGlobal={globalHideCompletedSteps}
                          onSelectSubGuide={setActiveGuideFilter}
                          bookmarkStepKey={bookmarkStepKey}
                          onStepBookmark={handleStepBookmark}
                          onCompleteSubGuide={handleCompleteSubGuide}
                        />
                      )}
                    </div>

                    {/* Bottom horizontal pagination controls */}
                    {visibleSeqs.length > 1 && (
                      <div className="subguides-pagination-controls">
                        <button
                          className="subguide-pag-btn"
                          disabled={activeSeqIndex === 0}
                          onClick={() => setActiveSeqIndex(idx => Math.max(0, idx - 1))}
                        >
                          <ChevronLeft size={12}/> Partie précédente
                        </button>
                        <span className="subguide-pag-indicator">
                          Partie {activeSeqIndex + 1} sur {visibleSeqs.length}
                        </span>
                        <button
                          className="subguide-pag-btn"
                          disabled={activeSeqIndex === visibleSeqs.length - 1}
                          onClick={() => setActiveSeqIndex(idx => Math.min(visibleSeqs.length - 1, idx + 1))}
                        >
                          Partie suivante <ChevronRight size={12}/>
                        </button>
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* No content fallback */}
              {!selected.description && selected.sequences.length === 0 && (
                <div className="step-empty">
                  <Info size={20} className="text-zinc-600"/>
                  <p>Cette étape ne contient pas encore de contenu détaillé.</p>
                </div>
              )}



              {/* Footer nav */}
              <footer className="step-footer">
                <div className="step-nav">
                  {prevMs && (
                    <button className="nav-btn prev" onClick={() => setSelected(prevMs)}>
                      <ChevronLeft size={14}/> <span className="nav-label">Précédent</span>
                    </button>
                  )}
                  <div className="step-actions">
                    <button
                      className="jump-btn"
                      onClick={() => setIsMilestoneModalOpen(true)}
                      title="Aller directement à une étape précise"
                    >
                      <ListTree size={14}/> <span>Aller à…</span>
                    </button>
                    <button
                      className="complete-all-btn"
                      onClick={handleCompleteGuide}
                      disabled={isCompletingGuide || validating}
                      title="Valider tous les jalons du guide d'un coup"
                    >
                      {isCompletingGuide ? <Loader2 size={14} className="animate-spin"/> : <CheckCheck size={14}/>}
                      <span>Tout valider</span>
                    </button>
                    <button
                      className={`validate-btn ${isCompleted ? "validated" : ""}`}
                      onClick={handleToggleMs} disabled={validating}>
                      {validating ? <Loader2 size={14} className="animate-spin"/> :
                        isCompleted ? <><CheckCircle2 size={14}/> Validée</> : <><Flag size={14}/> Valider cette étape</>}
                    </button>
                    <button
                      className={`bookmark-btn ${bookmarkId === selected.id ? "active" : ""}`}
                      onClick={() => handleBookmark(selected.id)}
                      title={bookmarkId === selected.id ? "Supprimer le marque-page" : "J'en suis là"}
                    >
                      {bookmarkId === selected.id ? <BookmarkCheck size={14}/> : <Bookmark size={14}/>}
                      <span>{bookmarkId === selected.id ? "Ma position" : "J'en suis là"}</span>
                    </button>
                    <button
                      className="jump-btn reset"
                      onClick={handleResetMilestone}
                      disabled={validating}
                      title="Réinitialiser ce jalon (étapes cochées et validation)"
                    >
                      <RotateCcw size={14}/>
                      <span>Réinitialiser</span>
                    </button>
                  </div>
                  {nextMs && (
                    <button className="nav-btn next" onClick={() => setSelected(nextMs)}>
                      <span className="nav-label">Suivant</span> <ArrowRight size={14}/>
                    </button>
                  )}
                </div>
              </footer>
              </div>{/* /guide-read-col */}
            </motion.div>
          </AnimatePresence>
        )}
        <CoordHoverMap containerRef={mainRef} guildId={guildId} />
      </main>

      {/* Fil d'activité live (Phase F) — events step:validated / milestone:completed */}
      <LiveActivityTicker events={guideLive.events} />

      {/* Modale Mon Ocre : liste des Gardiens/Archis déjà en poche, zéro refetch API */}
      <OcreProgressModal
        open={isOcreModalOpen}
        onOpenChange={setIsOcreModalOpen}
        monsters={ocreMonsters}
        bossCount={ocreStats?.bosses}
        archiCount={ocreStats?.archis}
        metamobPseudo={currentUserProfile?.metamobPseudo}
        guildId={guildId}
      />

      {/* Modale Alignement / Ordre / Tranche */}
      <AlignmentModal
        open={isAlignModalOpen}
        onOpenChange={setIsAlignModalOpen}
        guildId={guildId}
        alignment={currentUserProfile?.alignment}
        alignmentOrder={currentUserProfile?.alignmentOrder}
        alignmentLevel={currentUserProfile?.alignmentLevel}
      />

      {/* ── Tiroir Sommaire (TOC) — porté dans document.body pour passer AU-DESSUS de la navbar app ── */}
      {typeof document !== "undefined" && createPortal(
        <>
          <AnimatePresence>
            {drawerActive && (
              <motion.div
                className="toc-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setTocOpen(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {drawerActive && (
              <motion.aside
                className="toc-drawer"
                initial={{ x: -320, opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0.6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {renderTocPanel({ pinned: false })}
              </motion.aside>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      <DjPostCreateModal
        guildId={guildId}
        isOpen={createDjModal.isOpen}
        initialDungeonId={createDjModal.initialDungeonId}
        initialQuestName={createDjModal.initialQuestName}
        isDiscordConfigured={true}
        onClose={() => setCreateDjModal({ isOpen: false })}
        onCreated={() => {}}
      />

      <DungeonCreateModal
        guildId={guildId}
        isOpen={createUnpopulatedDjModal.isOpen}
        name={createUnpopulatedDjModal.name}
        dofusdbId={createUnpopulatedDjModal.dofusdbId}
        isAdmin={isAdmin}
        onClose={() => setCreateUnpopulatedDjModal({ isOpen: false, name: "", dofusdbId: null })}
        onCreated={(dungeonId) => {
          setCreateDjModal({
            isOpen: true,
            initialDungeonId: dungeonId
          });
        }}
      />

      {/* ── VERIFYING OVERLAY ─────────────────────────────── */}
      <AnimatePresence>
        {verifyingDungeonName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center p-4 bg-black/85"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0d14] border border-zinc-800 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden"
            >
              {/* Spinning Loader */}
              <div className="w-16 h-16 rounded-full border-4 border-t-amber-500 border-zinc-800 animate-spin mb-6 shadow-[0_0_20px_rgba(245,158,11,0.2)]" />
              
              <h3 className="text-white font-black text-base uppercase tracking-wider mb-2">Vérification en cours</h3>
              <p className="text-zinc-400 text-xs font-medium max-w-[240px]">
                Analyse de la base de données pour le donjon :
              </p>
              <p className="text-amber-400 font-bold text-xs mt-1 truncate max-w-full">
                {verifyingDungeonName}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DUNGEON CHOICE MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {dungeonChoiceModal && dungeonChoiceModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setDungeonChoiceModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-md bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 text-zinc-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Skull className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm">Options de Donjon</h3>
                    <p className="text-purple-400 font-bold text-xs mt-0.5 truncate max-w-[280px]">
                      {dungeonChoiceModal.name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setDungeonChoiceModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <div className="py-6 text-zinc-400 text-xs leading-relaxed">
                Que souhaitez-vous faire avec ce donjon ? Vous pouvez planifier une sortie de guilde ou aller voir sa fiche sur DofusDB.
              </div>

              {/* Choices */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleLaunchDungeonSearch(dungeonChoiceModal.name, dungeonChoiceModal.dofusdbId)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-black text-sm text-left transition-all group"
                >
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-black">Planifier une sortie</p>
                    <p className="text-emerald-400/70 text-[10px] font-bold mt-0.5">Ouvrir ou rejoindre un groupe d'entraide</p>
                  </div>
                </button>

                {/* NOOBS TUTORIAL BUTTON */}
                <div className="relative group">
                  <button
                    disabled={dungeonChoiceModal.isLoadingUrl}
                    onClick={() => {
                      if (dungeonChoiceModal.customUrl) {
                        window.open(dungeonChoiceModal.customUrl, "_blank");
                      } else {
                        const slug = getNoobsDungeonSlug(dungeonChoiceModal.name);
                        window.open(`https://www.dofuspourlesnoobs.com/${slug}.html`, "_blank");
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 font-black text-sm text-left transition-all ${dungeonChoiceModal.isLoadingUrl ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-black truncate">
                        {dungeonChoiceModal.isLoadingUrl ? "Chargement..." : "Consulter le tutoriel Noobs"}
                      </p>
                      <p className="text-amber-400/70 text-[10px] font-bold mt-0.5 truncate pr-2">
                        {dungeonChoiceModal.customUrl ? dungeonChoiceModal.customUrl.replace("https://www.dofuspourlesnoobs.com/", "") : "Guide complet illustré pas-à-pas du donjon"}
                      </p>
                    </div>
                    {isAdmin && !dungeonChoiceModal.isLoadingUrl && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); setEditingNoobsUrl(!editingNoobsUrl); }}
                        className="p-2 rounded-lg hover:bg-amber-500/20 text-amber-500 transition-colors shrink-0"
                      >
                        Editer
                      </div>
                    )}
                  </button>

                  <AnimatePresence>
                    {editingNoobsUrl && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="p-3 bg-black/40 border border-amber-500/20 rounded-xl flex flex-col gap-2">
                          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">URL / Slug Personnalisé</p>
                          <input 
                            value={noobsUrlInput}
                            onChange={(e) => setNoobsUrlInput(e.target.value)}
                            placeholder="ex: donjon-du-kimbo"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button 
                              onClick={() => {
                                let url = noobsUrlInput;
                                if (!url.startsWith("http")) {
                                  url = `https://www.dofuspourlesnoobs.com/${url.replace(".html", "")}.html`;
                                }
                                window.open(url, "_blank");
                              }}
                              className="px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                              Tester
                            </button>
                            <button 
                              onClick={async () => {
                                toast.loading("Enregistrement...", { id: "save-url" });
                                const mod = await import("@/server/actions/game-data-actions");
                                const res = await mod.updateDungeonNoobsUrl(guildId, dungeonChoiceModal.name, dungeonChoiceModal.dofusdbId, noobsUrlInput);
                                if (res.success) {
                                  toast.success("URL enregistrée !", { id: "save-url" });
                                  setDungeonChoiceModal(prev => prev ? { ...prev, customUrl: res.data.dofuspourlesnoobsUrl } : null);
                                  setEditingNoobsUrl(false);
                                } else {
                                  toast.error(res.error || "Erreur", { id: "save-url" });
                                }
                              }}
                              className="px-3 py-1.5 text-[10px] font-bold text-amber-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                            >
                              Sauvegarder
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => handleLaunchDofusDB(dungeonChoiceModal.dofusdbId, dungeonChoiceModal.dbtype)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 font-black text-sm text-left transition-all group"
                >
                  <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-black">Consulter sur DofusDB</p>
                    <p className="text-cyan-400/70 text-[10px] font-bold mt-0.5">Fiche et base de données officielle du boss</p>
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex justify-end">
                <button
                  onClick={() => setDungeonChoiceModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUEST CHOICE MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {questChoiceModal && questChoiceModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setQuestChoiceModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-md bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 text-zinc-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm">Options de Quête</h3>
                    <p className="text-amber-400 font-bold text-xs mt-0.5 truncate max-w-[280px]">
                      {questChoiceModal.name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setQuestChoiceModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <div className="py-6 text-zinc-400 text-xs leading-relaxed">
                Que souhaitez-vous faire pour cette quête ? Vous pouvez planifier une sortie d'entraide de guilde, consulter son guide complet, ou voir sa fiche sur DofusDB.
              </div>

              {/* Choices */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setQuestChoiceModal(null);
                    setCreateDjModal({
                      isOpen: true,
                      initialQuestName: questChoiceModal.name
                    });
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-black text-sm text-left transition-all group"
                >
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-black">Planifier une sortie d'entraide / donjon</p>
                    <p className="text-emerald-400/70 text-[10px] font-bold mt-0.5">Créer un groupe de guilde prérempli pour cette étape</p>
                  </div>
                </button>
 
                <button
                  onClick={() => {
                    const slug = questChoiceModal.name
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/['’]/g, "")
                      .replace(/[^a-z0-9\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-")
                      .replace(/-+/g, "-");
                    window.open(`https://www.dofuspourlesnoobs.com/${slug}.html`, "_blank");
                    toast.info("Ouverture Dofus pour les Noobs");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 font-black text-sm text-left transition-all group"
                >
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-black">Consulter le tutoriel Noobs</p>
                    <p className="text-amber-400/70 text-[10px] font-bold mt-0.5">Ouvrir le guide illustré pas-à-pas</p>
                  </div>
                </button>
 
                {questChoiceModal.dofusdbId && (
                  <button
                    onClick={() => {
                      window.open(`https://dofusdb.fr/fr/database/quest/${questChoiceModal.dofusdbId}`, "_blank");
                      toast.info("Ouverture DofusDB");
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 font-black text-sm text-left transition-all group"
                  >
                    <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-black">Consulter sur DofusDB</p>
                      <p className="text-cyan-400/70 text-[10px] font-bold mt-0.5">Données techniques et structure de la quête</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex justify-end">
                <button
                  onClick={() => setQuestChoiceModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Back Modal */}
      <AnimatePresence>
        {welcomeModal && welcomeModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <BookmarkCheck className="w-8 h-8 text-emerald-400" />
                </div>
                
                <h3 className="text-xl font-black text-white mb-2">Bon retour !</h3>
                <p className="text-sm text-zinc-400 mb-6">
                  {welcomeModal.validatedCount > 0 
                    ? `Lors de votre dernière session, vous aviez validé ${welcomeModal.validatedCount} étape${welcomeModal.validatedCount > 1 ? 's' : ''}. `
                    : `Reprenez votre lecture là où vous l'aviez laissée. `}
                  Voulez-vous y retourner directement ?
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setWelcomeModal(null)}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-sm transition-all"
                  >
                    Ignorer
                  </button>
                  <button
                    onClick={() => {
                      if (welcomeModal.lastViewedId) {
                        const targetMs = flatList.find(x => x.id === welcomeModal.lastViewedId);
                        if (targetMs) {
                          setSelected(targetMs);
                          setTimeout(() => {
                            const el = document.getElementById(`ms-row-${targetMs.id}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 300);
                        }
                      }
                      setWelcomeModal(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    Reprendre
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {imageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/90"
            onClick={() => setImageModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={imageModal}
                alt="Zoom"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-zinc-700/50"
              />
              <button
                onClick={() => setImageModal(null)}
                className="absolute -top-4 -right-4 p-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-full transition-colors shadow-lg"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Milestone Selection Modal */}
      <Dialog open={isMilestoneModalOpen} onOpenChange={setIsMilestoneModalOpen}>
        <DialogContent className="max-w-xl bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500">
              Navigation rapide
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-1">
              Aller à une étape
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 font-medium">
              {completedIds.size} / {milestones.length} étapes complétées ({overallPct}%)
            </div>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative mb-4 flex items-center bg-black/40 border border-white/5 rounded-2xl px-4 py-2 hover:border-white/15 transition-all">
            <Search size={14} className="text-zinc-500 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher par titre d'étape..."
              value={modalSearchQuery}
              onChange={(e) => setModalSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-zinc-600 outline-none font-medium"
            />
            {modalSearchQuery && (
              <button
                onClick={() => setModalSearchQuery("")}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Milestone List in ScrollArea — grouped by chapter when no search */}
          <ScrollArea className="h-[420px] pr-2 no-scrollbar">
            <div className="space-y-3 pb-2">
              {filteredModalMilestones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 italic text-sm">
                  <Info size={20} className="mb-2 opacity-40" />
                  <span>Aucune étape trouvée</span>
                </div>
              ) : modalSearchQuery.trim() ? (
                /* Flat list when searching */
                filteredModalMilestones.map((m) => {
                  const isSelected = selected?.id === m.id;
                  const isDone = completedIds.has(m.id);
                  const isBookmarked = bookmarkId === m.id;
                  const globalIndex = milestones.findIndex(item => item.id === m.id) + 1;
                  const here = presenceMap[m.id] || [];
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelected(m);
                        setIsMilestoneModalOpen(false);
                        setModalSearchQuery("");
                      }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 relative group
                        ${isSelected
                          ? "bg-white/10 border-white/20 shadow-lg"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/15"
                        }
                      `}
                    >
                      <div className="shrink-0 flex items-center justify-center">
                        {isBookmarked && !isDone ? (
                          <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Bookmark size={10} className="fill-amber-400" />
                          </div>
                        ) : isDone ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 size={11} />
                          </div>
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-600 font-mono text-[9px] font-bold">
                            {globalIndex}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] font-black italic truncate block transition-colors ${
                          isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
                        } ${isDone ? "text-zinc-500 line-through" : ""}`}>
                          {m.title}
                        </span>
                        {m.isOptional && (
                          <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 mt-0.5 inline-block">
                            Bonus
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {here.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {here.slice(0, 2).map((member) => (
                              <div key={member.profileId} className="w-4 h-4 rounded-full border border-black/40 overflow-hidden bg-zinc-800" title={member.userName}>
                                {member.userAvatar
                                  ? <img src={member.userAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  : <span className="flex w-full h-full items-center justify-center text-[8px] font-bold text-zinc-400">{member.userName.charAt(0).toUpperCase()}</span>}
                              </div>
                            ))}
                            {here.length > 2 && (
                              <div className="w-4 h-4 rounded-full border border-black/40 bg-indigo-600 text-white text-[7px] font-black flex items-center justify-center">
                                +{here.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                        <ChevronRight size={12} className="text-zinc-600 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  );
                })
              ) : (
                /* Grouped by chapter when not searching */
                chapters.map((ch) => {
                  const chMilestones = filteredModalMilestones.filter(m => m.chapter === ch.chapter);
                  if (chMilestones.length === 0) return null;
                  const chDone = chMilestones.filter(m => completedIds.has(m.id)).length;
                  const chPct = Math.round((chDone / chMilestones.length) * 100);
                  const chAllDone = chDone === chMilestones.length;
                  const chHasSelected = chMilestones.some(m => m.id === selected?.id);
                  return (
                    <div key={ch.chapter} className="space-y-1">
                      {/* Chapter header */}
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${
                        chHasSelected ? "bg-indigo-500/10 border border-indigo-500/20" : "border border-transparent"
                      }`}>
                        <div className="w-4 h-4 shrink-0">
                          {chAllDone
                            ? <CheckCircle2 size={14} className="text-emerald-500" />
                            : <div className="w-4 h-4 rounded-full border-2 border-zinc-700 flex items-center justify-center">
                                <div
                                  className="w-2 h-2 rounded-full bg-indigo-400"
                                  style={{ transform: `scale(${chPct / 100})` }}
                                />
                              </div>
                          }
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          chHasSelected ? "text-indigo-300" : chAllDone ? "text-zinc-600" : "text-zinc-400"
                        }`}>{ch.label}</span>
                        <span className="ml-auto text-[9px] font-bold text-zinc-600">{chDone}/{chMilestones.length}</span>
                      </div>
                      {/* Milestones in chapter */}
                      <div className="pl-4 space-y-0.5">
                        {chMilestones.map((m) => {
                          const isSelected = selected?.id === m.id;
                          const isDone = completedIds.has(m.id);
                          const isBookmarked = bookmarkId === m.id;
                          const globalIndex = milestones.findIndex(item => item.id === m.id) + 1;
                          const here = presenceMap[m.id] || [];
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelected(m);
                                setIsMilestoneModalOpen(false);
                                setModalSearchQuery("");
                              }}
                              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200 group
                                ${isSelected
                                  ? "bg-white/10 border-white/20"
                                  : "bg-white/[0.015] border-white/5 hover:bg-white/5 hover:border-white/12"
                                }
                              `}
                            >
                              {/* Status icon */}
                              <div className="shrink-0">
                                {isBookmarked && !isDone ? (
                                  <Bookmark size={12} className="text-amber-400 fill-amber-400/20" />
                                ) : isDone ? (
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                ) : isSelected ? (
                                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                ) : (
                                  <span className="text-[9px] font-mono font-bold text-zinc-600 w-5 inline-block text-center">{globalIndex}</span>
                                )}
                              </div>
                              {/* Title */}
                              <span className={`flex-1 text-[12px] font-bold truncate transition-colors ${
                                isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
                              } ${isDone ? "text-zinc-600 line-through" : ""}`}>
                                {m.title}
                              </span>
                              {/* Bonus badge */}
                              {m.isOptional && (
                                <span className="text-[7px] font-black uppercase bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 shrink-0">
                                  Bonus
                                </span>
                              )}
                              {/* Guild presence avatars */}
                              {here.length > 0 && (
                                <div className="flex -space-x-1 shrink-0" title={`${here.length} membre${here.length > 1 ? "s" : ""} ici`}>
                                  {here.slice(0, 2).map((member) => (
                                    <div key={member.profileId} className="w-4 h-4 rounded-full border border-black/40 overflow-hidden bg-zinc-800">
                                      {member.userAvatar
                                        ? <img src={member.userAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        : <span className="flex w-full h-full items-center justify-center text-[7px] font-bold text-zinc-400">{member.userName.charAt(0).toUpperCase()}</span>}
                                    </div>
                                  ))}
                                  {here.length > 2 && (
                                    <div className="w-4 h-4 rounded-full border border-black/40 bg-indigo-600/70 text-white text-[7px] font-black flex items-center justify-center">+{here.length - 2}</div>
                                  )}
                                </div>
                              )}
                              <ChevronRight size={10} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Step Presence Modal Dialog */}
      <Dialog 
        open={stepPresenceModal?.isOpen ?? false} 
        onOpenChange={(open) => setStepPresenceModal(prev => prev ? { ...prev, isOpen: open } : null)}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
              <Users size={14} className="text-emerald-400" />
              Progression Étape
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-1">
              Étape {stepPresenceModal?.stepNumber}
            </div>
            {stepPresenceModal?.stepTitle && (
              <div 
                className="text-xs text-zinc-400 mt-1 line-clamp-2 ganymade-step-text animate-in fade-in slide-in-from-top-1 duration-300"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(stepPresenceModal.stepTitle) || "" }}
              />
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[350px] pr-2 no-scrollbar">
            <div className="space-y-4 pb-2">
              {/* Active / Jalon members */}
              {stepPresenceModal?.activeMembers && stepPresenceModal.activeMembers.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1.5 animate-in fade-in duration-300">
                    <BookmarkCheck size={12} className="fill-amber-500/10" />
                    En cours à cette étape ({stepPresenceModal.activeMembers.length})
                  </div>
                  <div className="space-y-2">
                    {stepPresenceModal.activeMembers.map((m) => {
                      const profileUrl = `/dashboard/${guildId}/members/${encodeURIComponent(m.profileSlug || m.profileId)}`;
                      return (
                        <Link
                          key={m.profileId}
                          href={profileUrl}
                          className="flex items-center justify-between p-3 rounded-2xl border border-amber-500/10 bg-amber-500/[0.01] hover:bg-amber-500/5 hover:border-amber-500/20 transition-all group cursor-pointer"
                          onClick={() => {
                            setStepPresenceModal(prev => prev ? { ...prev, isOpen: false } : null);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-amber-500/20 overflow-hidden flex items-center justify-center shrink-0">
                              {m.userAvatar ? (
                                <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover animate-in fade-in duration-500" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-sm font-bold text-zinc-400">
                                  {m.userName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">
                                {m.userName}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                Voir la fiche de membre
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validated members */}
              {stepPresenceModal?.validatedMembers && stepPresenceModal.validatedMembers.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5 animate-in fade-in duration-300">
                    <CheckCircle2 size={12} />
                    Validé ({stepPresenceModal.validatedMembers.length})
                  </div>
                  <div className="space-y-2">
                    {stepPresenceModal.validatedMembers.map((m) => {
                      const profileUrl = `/dashboard/${guildId}/members/${encodeURIComponent(m.profileSlug || m.profileId)}`;
                      return (
                        <Link
                          key={m.profileId}
                          href={profileUrl}
                          className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all group cursor-pointer"
                          onClick={() => {
                            setStepPresenceModal(prev => prev ? { ...prev, isOpen: false } : null);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                              {m.userAvatar ? (
                                <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover animate-in fade-in duration-500" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-sm font-bold text-zinc-400">
                                  {m.userName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                                {m.userName}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                Voir la fiche de membre
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {(!stepPresenceModal?.validatedMembers || stepPresenceModal.validatedMembers.length === 0) &&
               (!stepPresenceModal?.activeMembers || stepPresenceModal.activeMembers.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 italic text-sm animate-in fade-in duration-300">
                  <Info size={16} className="mb-2 opacity-40" />
                  <span>Aucun membre n&apos;a validé ou n&apos;est en cours sur cette étape</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer — entraide (3ᵉ niveau) */}
          <div className="flex gap-2 mt-4 border-t border-white/5 pt-4">
            <button
              onClick={() => setStepPresenceModal(prev => prev ? { ...prev, isOpen: false } : null)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Fermer
            </button>
            <button
              onClick={() => {
                const title = (stepPresenceModal?.stepTitle || "").replace(/<[^>]+>/g, "").trim();
                navigator.clipboard.writeText(
                  `📣 Besoin d'aide sur l'étape ${stepPresenceModal?.stepNumber} : ${title} — je suis sur le guide « ${guide.name} ».`
                ).catch(() => {});
                toast.success("Message d'entraide copié — collez-le sur Discord !");
              }}
              className="flex-[2] py-2.5 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              📣 Demander de l'aide sur Discord
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Presence Modal Dialog */}
      <Dialog 
        open={presenceModal?.isOpen ?? false} 
        onOpenChange={(open) => setPresenceModal(prev => prev ? { ...prev, isOpen: open } : null)}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
              <Users size={14} className="text-emerald-400" />
              Membres actifs
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-1 truncate">
              {presenceModal?.milestoneTitle}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[350px] pr-2 no-scrollbar">
            <div className="space-y-2 pb-2">
              {(() => {
                const members = presenceModal ? (effectivePresenceMap[presenceModal.milestoneId] || []) : [];
                if (members.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-500 italic text-sm">
                      <Info size={16} className="mb-2 opacity-40" />
                      <span>Aucun membre à cette étape</span>
                    </div>
                  );
                }
                return members.map((m) => {
                  const profileUrl = `/dashboard/${guildId}/members/${encodeURIComponent(m.profileSlug || m.profileId)}`;
                  return (
                    <Link
                      key={m.profileId}
                      href={profileUrl}
                      className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all group cursor-pointer"
                      onClick={() => {
                        setPresenceModal(prev => prev ? { ...prev, isOpen: false } : null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {m.userAvatar ? (
                            <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-sm font-bold text-zinc-400">
                              {m.userName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                            {m.userName}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            Voir la fiche de membre
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                });
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {/* All Guild Members Tracking Guide Modal */}
      <Dialog open={isAllMembersModalOpen} onOpenChange={setIsAllMembersModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
              <Users size={14} className="text-blue-400" />
              Membres sur ce guide
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-1">
              Position dans la guilde
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[350px] pr-2 no-scrollbar">
            <div className="space-y-2 pb-2">
              {uniqueGuildMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 italic text-sm">
                  <Info size={16} className="mb-2 opacity-40" />
                  <span>Aucun membre ne suit ce guide</span>
                </div>
              ) : (
                uniqueGuildMembers.map((m) => {
                  const profileUrl = `/dashboard/${guildId}/members/${encodeURIComponent(m.profileSlug || m.profileId)}`;
                  // Find current milestone title
                  const currentMs = milestones.find(ms => ms.id === m.currentMilestoneId);
                  
                  return (
                    <Link
                      key={m.profileId}
                      href={profileUrl}
                      className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all group cursor-pointer"
                      onClick={() => setIsAllMembersModalOpen(false)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {m.userAvatar ? (
                            <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-sm font-bold text-zinc-400">
                              {m.userName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-zinc-200 group-hover:text-blue-400 transition-colors truncate">
                            {m.userName}
                          </span>
                          <span className="text-[9px] text-zinc-400 truncate mt-0.5">
                            {currentMs 
                              ? `En cours : ${currentMs.title}` 
                              : m.completedMilestoneIds.size === milestones.length 
                                ? "✨ Guide entièrement complété !" 
                                : "Pas encore commencé / En pause"
                            }
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* How to Use Modal Dialog */}
      <Dialog 
        open={isHelpOpen} 
        onOpenChange={setIsHelpOpen}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
              <BookOpen size={14} />
              Comment utiliser les guides ?
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-2 no-scrollbar text-zinc-300 text-xs leading-relaxed space-y-4">
            <div className="space-y-4 pb-2 font-medium">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
                <h4 className="text-indigo-300 font-black uppercase tracking-wider text-[10px] mb-1">📐 Structure & Hiérarchie</h4>
                <p className="text-zinc-200">Le système de guide est structuré en deux niveaux :</p>
                <ul className="list-disc pl-4 mt-1.5 space-y-1 text-zinc-300 text-[11px]">
                  <li><strong>Guide Principal (à gauche) :</strong> Les étapes et quêtes de la trame globale (ex: Quête du Dofus Émeraude).</li>
                  <li><strong>Sous-Guides GP (au centre) :</strong> Les fiches d&apos;instructions ultra-détaillées avec coordonnées et dialogues pour chaque objectif spécifique.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-black uppercase tracking-wider text-[10px] mb-1">🗺️ Progression pas-à-pas</h4>
                <p>Suivez la feuille de route optimisée. Les étapes s&apos;enchaînent logiquement pour réduire les allers-retours.</p>
              </div>
              <div>
                <h4 className="text-white font-black uppercase tracking-wider text-[10px] mb-1">📍 Marque-page (J&apos;en suis là)</h4>
                <p>Utilisez l&apos;icône de marque-page pour indiquer précisément votre position actuelle à la guilde sans pour autant marquer l&apos;étape comme terminée.</p>
              </div>
              <div>
                <h4 className="text-white font-black uppercase tracking-wider text-[10px] mb-1">✅ Validation d&apos;étapes</h4>
                <p>Cochez les étapes secondaires ou validez la milestone principale une fois terminée. Votre progression est enregistrée en temps réel.</p>
              </div>
              <div>
                <h4 className="text-white font-black uppercase tracking-wider text-[10px] mb-1">👥 Synchronisation & Entraide</h4>
                <p>Les avatars des membres s&apos;affichent sur les étapes où ils sont rendus. Pratique pour s&apos;organiser et faire des donjons à plusieurs !</p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Floating Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-24 right-6 z-[var(--z-floating-nav)] p-3 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-all cursor-pointer flex items-center justify-center border border-emerald-400/20"
            title="Remonter en haut de page"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Custom Reset Milestone Confirmation Modal */}
      <Dialog open={isResetMilestoneConfirmOpen} onOpenChange={setIsResetMilestoneConfirmOpen}>
        <DialogContent className="max-w-md bg-zinc-950/95 border border-red-500/20 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-red-400 flex items-center gap-2">
              <RotateCcw size={14} className="animate-spin-slow" />
              Réinitialiser le jalon
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-2">
              {selected?.title}
            </div>
          </DialogHeader>
          <div className="text-zinc-400 text-xs leading-relaxed mb-6 space-y-2">
            <p>Êtes-vous sûr de vouloir réinitialiser la progression de ce jalon ?</p>
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-200/90 text-[11px] font-medium">
              ⚠️ <strong>Cette action va :</strong>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Décocher toutes les étapes secondaires de ce jalon</li>
                <li>Retirer le statut de validation de ce jalon</li>
                <li>Supprimer votre marque-page d'étape</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsResetMilestoneConfirmOpen(false)}
              className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={confirmResetMilestone}
              className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"
            >
              Réinitialiser
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Reset Entire Guide Confirmation Modal */}
      <Dialog open={isResetGuideConfirmOpen} onOpenChange={setIsResetGuideConfirmOpen}>
        <DialogContent className="max-w-md bg-zinc-950/95 border border-red-500/30 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-red-500 flex items-center gap-2">
              <RotateCcw size={14}/>
              Réinitialisation Totale
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-2">
              {guide.name}
            </div>
          </DialogHeader>
          <div className="text-zinc-400 text-xs leading-relaxed mb-6 space-y-2">
            <p>Êtes-vous absolument sûr de vouloir réinitialiser la totalité de ce guide ?</p>
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-[11px] font-bold">
              🚨 WARNING : TOUTE votre progression sur ce guide (quêtes cochées, jalons validés, marque-pages) sera effacée définitivement pour ce personnage.
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsResetGuideConfirmOpen(false)}
              className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={confirmResetGuide}
              className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all cursor-pointer"
            >
              Tout effacer
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Complete Entire Guide Confirmation Modal */}
      <Dialog open={isCompleteGuideConfirmOpen} onOpenChange={setIsCompleteGuideConfirmOpen}>
        <DialogContent className="max-w-md bg-zinc-950/95 border border-emerald-500/30 rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
              <CheckCheck size={14}/>
              Validation Totale
            </DialogTitle>
            <div className="text-lg font-black italic tracking-tight text-white uppercase mt-2">
              {guide.name}
            </div>
          </DialogHeader>
          <div className="text-zinc-400 text-xs leading-relaxed mb-6 space-y-2">
            <p>Valider d'un coup tous les jalons de ce guide ?</p>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold">
              ✅ Tous les jalons seront marqués complétés pour ce personnage. Les étapes individuelles des sous-guides restent cochables manuellement si besoin.
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsCompleteGuideConfirmOpen(false)}
              className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={confirmCompleteGuide}
              disabled={isCompletingGuide}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs transition-all cursor-pointer"
            >
              {isCompletingGuide ? <Loader2 size={14} className="animate-spin inline-block mr-1"/> : null}
              Tout valider
            </button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

    </>
  );
}
