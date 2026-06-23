"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, Loader2, Search, X,
  BookOpen, MapPin, AlertTriangle, Lightbulb, Info, Flag, Skull,
  Users, Star, ArrowRight, ChevronLeft, ExternalLink, Copy, HelpCircle,
  Bookmark, BookmarkCheck, EyeOff, Eye, BookOpenCheck, ChevronUp
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── EYE_SVG Constant ────────────────────────────────────────────────────────
const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye inline-block w-3.5 h-3.5"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
import { toggleMilestoneProgress, getSubGuideSteps, updateStepProgress, updateBookmarkedStep } from "@/server/actions/optimized-guide-actions";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import { DungeonCreateModal } from "@/components/game-data/DungeonCreateModal";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/security";
import { fixBrokenImages } from "@/lib/ganymede-parser";
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

// ─── World Detector Helper ───────────────────────────────────────────────────
function detectWorldId(textContext: string): number {
  const txt = textContext.toLowerCase();
  if (txt.includes("incarnam")) return 2;
  if (txt.includes("minotoror")) return 4;
  if (txt.includes("dragon cochon") || txt.includes("dragon-cochon")) return 5;
  if (txt.includes("corbac")) return 6;
  if (txt.includes("givrefoux")) return 7;
  if (txt.includes("méphitiques")) return 8;
  if (txt.includes("entrailles de brâkmar") || txt.includes("entrailles de brakmar")) return 9;
  if (txt.includes("canopée") || txt.includes("canopee")) return 10;
  return 1; // Default to Monde des Douze
}

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
          return `<span class="coord-wrap inline-flex items-center gap-1"><span class="coord-chip cursor-pointer" data-x="${x}" data-y="${y}"${worldAttr} title="Copier la position [${x}, ${y}]">[${x}, ${y}]</span><button class="coord-eye-btn p-0.5 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all cursor-pointer inline-flex items-center" data-x="${x}" data-y="${y}"${worldAttr} title="Voir la carte HD">${EYE_SVG}</button></span>`;
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
function SubGuideCard({ seq, checkedSteps, onStepToggle, onMapClick, onInteractiveClick, defaultExpanded = false, hideCompletedGlobal = false, onSelectSubGuide, bookmarkStepKey, onStepBookmark, uniqueGuildMembers, milestones, selectedMilestoneId, guildId, onShowStepPresenceModal }: {
  seq: Sequence;
  checkedSteps: Set<string>;
  onStepToggle: (ref: string, n: number) => void;
  onMapClick: (x: number, y: number, worldId?: number) => void;
  onInteractiveClick: (e: React.MouseEvent) => void;
  defaultExpanded?: boolean;
  hideCompletedGlobal?: boolean;
  onSelectSubGuide?: (name: string) => void;
  bookmarkStepKey: string | null;
  onStepBookmark: (key: string) => void;
  uniqueGuildMembers: UniqueGuildMember[];
  milestones: Milestone[];
  selectedMilestoneId: string;
  guildId: string;
  onShowStepPresenceModal: (
    stepNumber: number,
    stepTitle: string,
    validatedMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[],
    activeMembers: { profileId: string; userName: string; userAvatar?: string; profileSlug?: string }[]
  ) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [steps, setSteps] = useState<SubStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const color = getGPColor(seq.subGuideRef);

  // Focus & Hide state
  const readMode = true;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hideCompletedLocal, setHideCompletedLocal] = useState(false);

  // Global states for sub-map checkboxes to respect React Rules of Hooks
  const [checkedSubMaps, setCheckedSubMaps] = useState<Record<string, Record<number, boolean>>>({});

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

  // Set initial focus mode index to the first unchecked step
  useEffect(() => {
    if (steps.length > 0) {
      const firstUnchecked = steps.findIndex(s => !checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`));
      if (firstUnchecked !== -1) {
        setCurrentStepIndex(firstUnchecked);
      } else {
        setCurrentStepIndex(0);
      }
    }
  }, [steps, seq.subGuideRef]);

  // Clamp currentStepIndex within bounds of filteredSteps
  useEffect(() => {
    if (currentStepIndex >= filteredSteps.length && filteredSteps.length > 0) {
      setCurrentStepIndex(filteredSteps.length - 1);
    }
  }, [filteredSteps.length, currentStepIndex]);

  const handleExpand = () => {
    if (!expanded) load();
    setExpanded(v => !v);
  };

  const handleStepCheckToggle = (stepNumber: number, stepIndex: number) => {
    const key = `${seq.subGuideRef}-${stepNumber}`;
    const isNowChecked = !checkedSteps.has(key);
    onStepToggle(seq.subGuideRef, stepNumber);

    const isHidingCompleted = hideCompletedLocal || hideCompletedGlobal;
    if (isNowChecked) {
      if (!isHidingCompleted && stepIndex < filteredSteps.length - 1) {
        setTimeout(() => {
          setCurrentStepIndex(stepIndex + 1);
        }, 400);
      }
    }
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
        const isMsCompleted = member.completedMilestoneIds.has(selectedMilestoneId);
        let isPastMs = false;
        if (member.currentMilestoneId) {
          const memberActiveMs = milestones.find(m => m.id === member.currentMilestoneId);
          if (memberActiveMs && memberActiveMs.order > selectedMs.order) isPastMs = true;
        } else if (member.completedMilestoneIds.size > 0) {
          isPastMs = true;
        }
        const isOnOrPastMs = isPastMs || isMsCompleted;
        const explicitlyValidated = member.completedSteps.has(key);

        if (explicitlyValidated || isOnOrPastMs) {
          (validated as any[]).push(member);
        } else {
          const bookmarkedStep = member.bookmarkedSteps.get(selectedMilestoneId);
          if (bookmarkedStep) {
            if (bookmarkedStep === key) (active as any[]).push(member);
          } else if (member.currentMilestoneId === selectedMilestoneId) {
            const firstIncompleteStep = steps.find(s => !member.completedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`));
            if (firstIncompleteStep?.stepNumber === step.stepNumber) (active as any[]).push(member);
          }
        }
      });
      map.set(key, { validated: validated as any, active: active as any });
    });
    return map;
  }, [uniqueGuildMembers, milestones, selectedMilestoneId, steps, seq.subGuideRef]);

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
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block mb-0.5">Sous-guide tactique</span>
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
      {(seq.note || seq.isResume) && (
        <div className="sgc-flags">
          {seq.isResume && (
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
                <a href="/god/dofus-guides" target="_blank" rel="noreferrer" className="sgc-link">
                  Importer <ExternalLink size={10}/>
                </a>
              </div>
            ) : (
              <>
                {/* Mode controls */}
                <div className="sgc-controls">
                  <button 
                    className={`sgc-ctrl-btn ${(hideCompletedLocal || hideCompletedGlobal) ? "active" : ""}`}
                    onClick={() => setHideCompletedLocal(v => !v)}
                    title={hideCompletedGlobal ? "Masquage global actif. Cliquez pour forcer la persistance locale." : "Masquer les étapes terminées de ce sous-guide"}
                  >
                    <EyeOff size={12}/>
                    <span>Cacher validées ({done})</span>
                  </button>
                </div>

                {(() => {
                  const step = filteredSteps[currentStepIndex];
                  if (!step) {
                    return (
                      <div className="sgc-empty p-8 text-center bg-zinc-950/20 border border-white/5 rounded-2xl">
                        <BookOpenCheck size={24} className="mx-auto mb-2 text-emerald-500 animate-bounce" />
                        <span>Toutes les étapes de ce sous-guide sont validées ! 🎉</span>
                      </div>
                    );
                  }

                  const key = `${seq.subGuideRef}-${step.stepNumber}`;
                  const checked = checkedSteps.has(key);

                  const activeSubMapCheckedState = checkedSubMaps[key] || {};

                  const coords = Array.from(
                    (step.plainText ?? step.web_text ?? "").matchAll(/\[(-?\d+),\s*(-?\d+)(?:,\s*(\d+))?\]/g)
                  ).map(m => ({ x: parseInt(m[1]), y: parseInt(m[2]), worldId: m[3] ? parseInt(m[3]) : undefined }));

                  // ── O(1) presence lookup from pre-computed map ──
                  const { validated: validatedMembers = [], active: activeMembers = [] } = stepPresenceMap.get(key) ?? {};

                  return (
                    <div className="sgc-focus-wrap" id={`sgc-step-${seq.subGuideRef}-${step.stepNumber}`}>
                      <div className="sgc-focus-header">
                        <button 
                          className="sgc-focus-nav-btn"
                          disabled={currentStepIndex === 0}
                          onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                        >
                          <ChevronLeft size={16}/>
                        </button>
                        
                        {/* Interactive Step Input selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-zinc-400 font-bold">Étape</span>
                          <input
                            type="number"
                            min={1}
                            max={steps.length}
                            value={step.stepNumber}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val >= 1 && val <= steps.length) {
                                // Find index of this step in filtered steps
                                const targetIdx = filteredSteps.findIndex(s => s.stepNumber === val);
                                if (targetIdx !== -1) {
                                  setCurrentStepIndex(targetIdx);
                                } else {
                                  // Fallback to closest step if filtered out (e.g. completed)
                                  const rawIdx = steps.findIndex(s => s.stepNumber === val);
                                  if (rawIdx !== -1) {
                                    // Turn off hiding local to let user see it
                                    setHideCompletedLocal(false);
                                    setTimeout(() => {
                                      setCurrentStepIndex(rawIdx);
                                    }, 10);
                                  }
                                }
                              }
                            }}
                            className="w-12 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-center text-xs font-black text-emerald-400 outline-none focus:border-emerald-500 transition-colors"
                            title="Entrez un numéro d'étape pour y aller directement"
                          />
                          <span className="text-[10px] text-zinc-500 font-semibold">
                            / {steps.length}
                          </span>
                        </div>

                        <button 
                          className="sgc-focus-nav-btn"
                          disabled={currentStepIndex === filteredSteps.length - 1}
                          onClick={() => setCurrentStepIndex(prev => Math.min(filteredSteps.length - 1, prev + 1))}
                        >
                          <ChevronRight size={16}/>
                        </button>
                      </div>

                      <div className={`sgc-step sgc-step-focus ${checked ? "done" : ""} ${bookmarkStepKey === key ? "bookmarked" : ""}`}>
                        <div className="sgc-step-check" 
                          onClick={() => handleStepCheckToggle(step.stepNumber, currentStepIndex)}>
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
                        <span className="sgc-step-num">
                          {step.stepNumber}
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="sgc-step-content ganymade-step-text"
                            onClick={onInteractiveClick}
                            {...{ dangerouslySetInnerHTML: { __html: cachedProcessHtml(step.web_text ?? step.plainText ?? "") } }}/>
                          {(validatedMembers.length > 0 || activeMembers.length > 0) && (
                            <div 
                              role="button"
                              tabIndex={0}
                              className="sgc-step-presence cursor-pointer hover:opacity-80 active:scale-95 transition-all select-none"
                              title="Cliquer pour voir la liste des membres ayant validé ou en cours sur cette étape"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowStepPresenceModal(
                                  step.stepNumber,
                                  step.plainText ?? step.web_text ?? `Étape ${step.stepNumber}`,
                                  validatedMembers,
                                  activeMembers
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onShowStepPresenceModal(
                                    step.stepNumber,
                                    step.plainText ?? step.web_text ?? `Étape ${step.stepNumber}`,
                                    validatedMembers,
                                    activeMembers
                                  );
                                }
                              }}
                            >
                              {validatedMembers.slice(0, 5).map(m => (
                                <div
                                  key={`val-${m.profileId}`}
                                  className="sgc-step-presence-avatar validated"
                                  title={`✅ ${m.userName} — a validé cette étape`}
                                >
                                  {m.userAvatar
                                    ? <img src={m.userAvatar} alt={m.userName} referrerPolicy="no-referrer" />
                                    : m.userName.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {activeMembers.slice(0, 3).map(m => (
                                <div
                                  key={`act-${m.profileId}`}
                                  className="sgc-step-presence-avatar active"
                                  title={`📍 ${m.userName} — rendu à cette étape`}
                                >
                                  {m.userAvatar
                                    ? <img src={m.userAvatar} alt={m.userName} referrerPolicy="no-referrer" />
                                    : m.userName.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Coords & Travel Roadmap Checks Section */}
                          {coords.length > 0 && (
                            <div className="mt-3 rounded-2xl overflow-hidden border border-cyan-500/15 animate-in fade-in duration-300" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(16,185,129,0.03) 100%)" }}>
                              {/* Header */}
                              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={10} className="text-cyan-400" />
                                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                                    Trajet · {coords.length} carte{coords.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                                <span className="text-[9px] text-zinc-500 font-semibold">
                                  {Object.values(activeSubMapCheckedState).filter(Boolean).length}/{coords.length} visitées
                                </span>
                              </div>
                              {/* Map cards */}
                              <div className="p-2 flex flex-col gap-1.5">
                                {coords.map((c, i) => {
                                  const cmd = `/travel ${c.x} ${c.y}`;
                                  const isSubChecked = !!activeSubMapCheckedState[i];
                                  return (
                                    <div
                                      key={i}
                                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all duration-200 cursor-default ${
                                        isSubChecked
                                          ? "bg-emerald-500/5 border-emerald-500/20"
                                          : "bg-black/20 border-white/5 hover:border-cyan-500/20 hover:bg-cyan-500/5"
                                      }`}
                                    >
                                      {/* Checkbox */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const nextState = { ...activeSubMapCheckedState, [i]: !isSubChecked };
                                          setCheckedSubMaps(prev => ({ ...prev, [key]: nextState }));
                                          localStorage.setItem(`sigilos_submaps_${guildId}_${key}`, JSON.stringify(nextState));
                                          if (!isSubChecked && Object.values(nextState).filter(Boolean).length === coords.length) {
                                            toast.success("Trajet terminé ! Toutes les cartes visitées 🗺️");
                                          }
                                        }}
                                        className={`flex items-center justify-center w-5 h-5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                                          isSubChecked
                                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                            : "bg-black/40 border-white/10 hover:border-emerald-500/50 text-zinc-600 hover:text-emerald-400"
                                        }`}
                                        title={isSubChecked ? "Décocher cette carte" : "Marquer cette carte comme visitée"}
                                      >
                                        {isSubChecked
                                          ? <CheckCircle2 size={11} />
                                          : <span className="text-[8px] font-black">{i + 1}</span>
                                        }
                                      </button>

                                      {/* Coords label */}
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <span className={`text-[10px] font-bold transition-colors ${isSubChecked ? "text-zinc-600 line-through" : "text-zinc-300 group-hover:text-cyan-300"}`}>
                                          Position {i + 1}
                                        </span>
                                        <span className={`font-mono text-[11px] font-black transition-colors ${isSubChecked ? "text-zinc-600" : "text-cyan-400"}`}>
                                          [{c.x}, {c.y}]
                                        </span>
                                      </div>

                                      {/* Actions */}
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(cmd);
                                            toast.success("Commande copiée !", { description: cmd });
                                          }}
                                          className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black transition-all cursor-pointer"
                                          title="Copier /travel"
                                        >
                                          <Copy size={8} /> /travel
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onMapClick(c.x, c.y, c.worldId);
                                          }}
                                          className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 text-[9px] font-black transition-all cursor-pointer"
                                          title="Voir la carte HD"
                                        >
                                          <Eye size={8} /> HD
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
        {type === 'info'    && <Info size={14}/>}
      </div>
      <div className="narrative-body ganymade-step-text"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: processHtml(html) }}/>
    </div>
  );
}

// ─── Chapter Group ────────────────────────────────────────────────────────────
function ChapterGroup({ chapter, label, milestones, selectedId, completedIds, onSelect, isOpen, onToggle, presenceMap, bookmarkId, guildId, onShowPresenceModal, onBookmark }: {
  chapter: number; label: string; milestones: Milestone[];
  selectedId?: string; completedIds: Set<string>;
  onSelect: (m: Milestone) => void; isOpen: boolean;
  onToggle: (open: boolean) => void;
  presenceMap: Record<string, GuildMember[]>;
  bookmarkId?: string | null;
  guildId: string;
  onShowPresenceModal: (milestoneId: string, title: string) => void;
  onBookmark: (milestoneId: string) => void;
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
          background: isChapterActive 
            ? `linear-gradient(135deg, color-mix(in srgb, ${activeColor} 18%, transparent) 0%, rgba(255,255,255,0.02) 100%)` 
            : undefined,
          borderColor: isChapterActive ? `color-mix(in srgb, ${activeColor} 40%, transparent)` : undefined
        } as React.CSSProperties}
        onClick={() => onToggle(!isOpen)}
      >
        <ProgressRing pct={pct} size={28} stroke={2.5} color={allDone ? "#10b981" : isChapterActive ? "var(--accent-color)" : "#6366f1"}/>
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
        {isOpen ? <ChevronDown size={14} className={isChapterActive ? "text-indigo-300" : "text-zinc-500"}/> : <ChevronRight size={14} className="text-zinc-500"/>}
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

                  {ms.sequences.length > 0 && (
                    <span className="ms-seqs">{ms.sequences.length}</span>
                  )}

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
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OptimizedGuideClient({
  guide, milestones: initialMilestones, userProgress, guildProgress, guildId
}: {
  guide: { id: string; name: string; slug: string };
  milestones: Milestone[];
  userProgress: { milestoneId: string; isCompleted: boolean; completedSteps?: string[]; currentStep?: string | null }[];
  guildProgress: GuildMember[];
  guildId: string;
}) {
  const [milestones] = useState(() => initialMilestones);
  const [selected, setSelected] = useState<Milestone | null>(milestones[0] ?? null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(userProgress.filter(p => p.isCompleted).map(p => p.milestoneId))
  );
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
    if (typeof window !== "undefined") return localStorage.getItem(`guide-bm-step-${guide.slug}`) ?? null;
    return null;
  });

  // Sync bookmarkStepKey with userProgress on load or selected milestone change
  useEffect(() => {
    if (selected) {
      const activeProgress = userProgress.find(p => p.milestoneId === selected.id);
      if (activeProgress?.currentStep) {
        setBookmarkStepKey(activeProgress.currentStep);
        localStorage.setItem(`guide-bm-step-${guide.slug}`, activeProgress.currentStep);
      } else {
        setBookmarkStepKey(null);
        localStorage.removeItem(`guide-bm-step-${guide.slug}`);
      }
    }
  }, [selected, userProgress, guide.slug]);

  const handleStepBookmark = useCallback((stepKey: string) => {
    setBookmarkStepKey(prev => {
      const next = prev === stepKey ? null : stepKey;
      if (next) {
        localStorage.setItem(`guide-bm-step-${guide.slug}`, next);
        toast.success("Position d'étape sauvegardée !");
      } else {
        localStorage.removeItem(`guide-bm-step-${guide.slug}`);
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

  const handleCollapseAll = useCallback(() => {
    setOpenChapters({});
    toast.info("Tous les chapitres ont été réduits");
  }, []);

  const handleExpandAll = useCallback(() => {
    const all: Record<number, boolean> = {};
    initialMilestones.forEach(m => {
      all[m.chapter] = true;
    });
    setOpenChapters(all);
    toast.success("Tous les chapitres ont été développés");
  }, [initialMilestones]);

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
  const [search, setSearch] = useState("");
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
  
  const [mapModal, setMapModal] = useState<{x:number;y:number;worldId?:number}|null>(null);
  const [activeSeqIndex, setActiveSeqIndex] = useState(0);
  const [activeGuideFilter, setActiveGuideFilter] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [globalHideCompletedSteps, setGlobalHideCompletedSteps] = useState(false);
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
    });
  }, [guildId]);

  const [bookmarkId, setBookmarkId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem(`guide-bm-${guide.slug}`) ?? null;
    return null;
  });

  const handleBookmark = useCallback((milestoneId: string) => {
    const next = bookmarkId === milestoneId ? null : milestoneId;
    setBookmarkId(next);
    if (next) { localStorage.setItem(`guide-bm-${guide.slug}`, next); toast.success("Position sauvegardée !"); }
    else { localStorage.removeItem(`guide-bm-${guide.slug}`); toast.info("Marque-page supprimé"); }
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
    const key = `sigilos_session_${guildId}_${guide.id}`;
    
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

    if (hideCompleted) {
      list = list.map(ch => ({ ...ch, items: ch.items.filter(m => !completedIds.has(m.id)) })).filter(ch => ch.items.length > 0);
    }

    if (activeGuideFilter) {
      list = list.map(ch => ({
        ...ch,
        items: ch.items.filter(m => m.sequences.some(s => s.subGuideName === activeGuideFilter))
      })).filter(ch => ch.items.length > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.map(ch => ({
        ...ch,
        items: ch.items.filter(m =>
          m.title.toLowerCase().includes(q) ||
          m.sequences.some(s => s.subGuideName.toLowerCase().includes(q))
        )
      })).filter(ch => ch.items.length > 0);
    }

    return list;
  }, [chapters, search, activeGuideFilter, hideCompleted, completedIds]);

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
    selected ? (presenceMap[selected.id] || []) : [],
  [selected, presenceMap]);

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

  const handleToggleMs = useCallback(async () => {
    if (!selected) return;
    setValidating(true);
    const isCurrentlyCompleted = completedIds.has(selected.id);
    try {
      const res = await toggleMilestoneProgress(guildId, selected.id, !isCurrentlyCompleted);
      if ((res as any).success) {
        setCompletedIds(prev => {
          const next = new Set(prev);
          if (next.has(selected.id)) { 
            next.delete(selected.id); 
          } else {
            next.add(selected.id);
            sessionValidatedCountRef.current += 1;
            
            // Save to localStorage immediately
            const key = `sigilos_session_${guildId}_${guide.id}`;
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
  }, [selected, guildId, nextMs, completedIds]);

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

    // 1. Coordinates eye button click (view HD map)
    const eyeBtn = target.closest(".coord-eye-btn") as HTMLElement;
    if (eyeBtn) {
      e.stopPropagation();
      e.preventDefault();
      const x = eyeBtn.getAttribute("data-x");
      const y = eyeBtn.getAttribute("data-y");
      const explicitWorld = eyeBtn.getAttribute("data-world");
      if (x && y) {
        const xNum = parseInt(x);
        const yNum = parseInt(y);
        let worldId = 1;
        const stepContainer = eyeBtn.closest(".sgc-step") || eyeBtn.closest(".narrative-block") || target.closest("main");
        const contextText = stepContainer ? stepContainer.textContent || "" : "";
        if (explicitWorld) {
          worldId = parseInt(explicitWorld);
        } else {
          worldId = detectWorldId(contextText || selected?.title || "");
        }
        setMapModal({ x: xNum, y: yNum, worldId });

        // Dynamically resolve precise worldId from server action
        if (!explicitWorld) {
          import("@/server/actions/optimized-guide-actions").then((mod) => {
            mod.resolveMapWorldAction(xNum, yNum, contextText || selected?.title || "").then((res) => {
              if (res.success && res.worldId) {
                setMapModal(prev => prev && prev.x === xNum && prev.y === yNum ? { ...prev, worldId: res.worldId } : prev);
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
      const parentInteractive = target.closest(".clickable-entity, .guide-step-link, .coord-chip, .coord-eye-btn, .guide-ref-link");
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


  const isCompleted = selected ? completedIds.has(selected.id) : false;
  const typeConf = selected ? (TYPE_CONFIG[selected.type] ?? TYPE_CONFIG.QUETE_SERIE) : TYPE_CONFIG.QUETE_SERIE;

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
      <div className="guide-shell">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside className="guide-sidebar">

        {/* ── Compact Header ── */}
        <div className="sidebar-compact-header">
          <Link href={`/dashboard/${guildId}/quetes-dofus`} className="sb-back-btn group">
            <ChevronLeft size={11} className="group-hover:-translate-x-0.5 transition-transform"/>
            <span>Hub</span>
          </Link>
          <div className="sb-guide-meta">
            <span className="sb-guide-name" title={guide.name}>{guide.name}</span>
            <span className="sb-guide-stats">{totalDone}/{totalMs} complétées</span>
          </div>
          <div className="sb-ring-wrap">
            <ProgressRing pct={overallPct} size={38} stroke={3} color="#10b981"/>
            <span className="sb-ring-pct">{overallPct}%</span>
          </div>
        </div>

        {/* ── Compact Toolbar ── */}
        <div className="sidebar-toolbar">
          {/* Search */}
          <div className="sb-search">
            <Search size={11} className="sb-search-icon"/>
            <input
              className="sb-search-input"
              placeholder="Rechercher une étape…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="sb-search-clear"><X size={10}/></button>
            )}
          </div>

          {/* Actions row */}
          <div className="sb-actions-row">
            {/* Hide completed */}
            <button
              className={`sb-action-btn ${hideCompleted ? "active" : ""}`}
              onClick={() => setHideCompleted(v => !v)}
              title={hideCompleted ? "Afficher les étapes validées" : "Masquer les étapes validées"}
            >
              {hideCompleted ? <Eye size={13}/> : <EyeOff size={13}/>}
            </button>

            {/* Collapse all */}
            <button className="sb-action-btn" onClick={handleCollapseAll} title="Réduire tous les chapitres">
              <ChevronDown size={13} style={{ transform: "rotate(180deg)" }}/>
            </button>

            {/* Expand all */}
            <button className="sb-action-btn" onClick={handleExpandAll} title="Développer tous les chapitres">
              <ChevronDown size={13}/>
            </button>

            {/* Legend toggle */}
            <button
              className={`sb-action-btn ${legendOpen ? "active" : ""}`}
              onClick={() => setLegendOpen(v => !v)}
              title="Légende des indicateurs"
            >
              <HelpCircle size={13}/>
            </button>

          </div>

          {/* Guild radar mini — only if members */}
          {guildProgress.length > 0 && (
            <button 
              onClick={() => setIsAllMembersModalOpen(true)}
              className="sb-radar-chip w-full hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all p-2 text-left flex flex-col gap-1 cursor-pointer"
              title="Voir la liste des membres"
            >
              <div className="flex items-center gap-1.5 text-blue-400">
                <Users size={12} className="shrink-0"/>
                <span className="text-[11px] font-black uppercase tracking-wider">Suivi de guilde</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-medium">
                <strong>{uniqueGuildMembers.length}</strong> {uniqueGuildMembers.length > 1 ? "membres suivent" : "membre suit"} ce guide.
              </div>
              {Object.keys(presenceMap).length > 0 && (
                <div className="text-[9px] text-zinc-500">
                  Répartis sur <strong>{Object.keys(presenceMap).length}</strong> jalon{Object.keys(presenceMap).length > 1 ? "s" : ""} différent{Object.keys(presenceMap).length > 1 ? "s" : ""} du parcours.
                </div>
              )}
              <div className="text-[9px] text-indigo-400 mt-0.5 underline font-bold">
                Afficher les membres →
              </div>
            </button>
          )}

          {/* Back to main guide (only when filter active) */}
          {activeGuideFilter && (
            <button
              onClick={handleBackToMainGuideCurrentStep}
              className="sb-back-main-btn"
              title="Retourner à votre position du guide principal"
            >
              <BookOpenCheck size={10}/>
              <span>← Guide principal</span>
            </button>
          )}

          {/* Legend panel */}
          <AnimatePresence initial={false}>
            {legendOpen && (
              <motion.div
                className="sb-legend-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="sb-legend-row">
                  <Bookmark size={10} className="text-amber-500 fill-amber-500/20 shrink-0"/>
                  <span><strong className="text-amber-400">J&apos;en suis là</strong> — Position courante (sans valider)</span>
                </div>
                <div className="sb-legend-row">
                  <CheckCircle2 size={10} className="text-emerald-500 shrink-0"/>
                  <span><strong className="text-emerald-400">Validée</strong> — Étape terminée</span>
                </div>
                <div className="sb-legend-row">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)] shrink-0"/>
                  <span><strong className="text-blue-400">Sélectionnée</strong> — Vue active</span>
                </div>
                <div className="sb-legend-row">
                  <Circle size={10} className="text-zinc-600 shrink-0"/>
                  <span><strong>À faire</strong> — Non commencée</span>
                </div>
                <div className="sb-legend-row">
                  <Users size={10} className="text-blue-400 shrink-0"/>
                  <span><strong>Guilde</strong> — Membres positionnés ici</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chapter list */}
        <div className="sidebar-chapters">
          {filteredChapters.length === 0 ? (
            <div className="sidebar-empty"><Info size={14}/> Aucun résultat</div>
          ) : (
            filteredChapters.map((ch, idx) => (
              <ChapterGroup
                key={ch.chapter}
                chapter={ch.chapter}
                label={ch.label}
                milestones={ch.items}
                selectedId={selected?.id}
                completedIds={completedIds}
                onSelect={ms => setSelected(ms)}
                isOpen={openChapters[ch.chapter] ?? false}
                onToggle={(open) => handleToggleChapter(ch.chapter, open)}
                presenceMap={presenceMap}
                bookmarkId={bookmarkId}
                guildId={guildId}
                onShowPresenceModal={(milestoneId, title) => setPresenceModal({ isOpen: true, milestoneId, milestoneTitle: title })}
                onBookmark={handleBookmark}
              />
            ))
          )}
        </div>
      </aside>

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
              {/* Guide name banner */}
              <div className="guide-name-banner mb-6 p-4 rounded-2xl bg-gradient-to-r from-zinc-950/80 via-emerald-950/20 to-zinc-950/80 border border-emerald-500/20 shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-emerald-400"/>
                  <span className="guide-name-label font-black text-xs uppercase tracking-widest text-emerald-400">{guide.name}</span>
                  <span className="guide-name-sep text-zinc-600">›</span>
                  <span className="guide-name-step text-xs font-semibold text-zinc-300">{decodeTitle(selected.title)}</span>
                  {bookmarkId === selected.id && (
                    <span title="Votre position actuelle"><BookmarkCheck size={14} className="text-amber-400 ml-1.5"/></span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Guild Presence Overview */}
                  {uniqueGuildMembers.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {uniqueGuildMembers.slice(0, 4).map((member) => (
                          <div
                            key={member.profileId}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-zinc-950 bg-zinc-900 overflow-hidden"
                            title={member.userName}
                          >
                            {member.userAvatar ? (
                              <img src={member.userAvatar} alt={member.userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-zinc-400 bg-zinc-800">
                                {member.userName.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {uniqueGuildMembers.length} {uniqueGuildMembers.length > 1 ? "membres" : "membre"}
                      </span>
                    </div>
                  )}

                  {/* Help Button */}
                  <button 
                    onClick={() => setIsHelpOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <HelpCircle size={12} />
                    Comment utiliser ?
                  </button>
                </div>
              </div>

              {/* Step header with Navigator */}
              <header className="step-header">
                <div className={`step-navigator ${activeGuideFilter ? "focused" : ""}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="step-nav-ref">
                        {activeGuideFilter ? `📌 ${activeGuideFilter}` : `🗺️ ${guide.name}`}
                      </span>
                      <div className="step-nav-controls">
                        <button className="nav-step-btn" onClick={() => prevMs && setSelected(prevMs)} disabled={!prevMs} title="Étape précédente">
                          <ChevronLeft size={16}/>
                        </button>
                        
                        <button
                          onClick={() => setIsMilestoneModalOpen(true)}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-950/80 border border-white/10 rounded-lg text-xs text-white font-bold hover:bg-zinc-900 hover:border-emerald-500/50 transition-all max-w-[150px] sm:max-w-[200px] cursor-pointer"
                          title="Aller directement à une étape précise"
                        >
                          <span className="truncate">
                            {selectedIdx !== -1 ? selectedIdx + 1 : 1}. {decodeTitle(selected.title)}
                          </span>
                          <ChevronDown size={12} className="text-zinc-500 shrink-0" />
                        </button>

                        <button className="nav-step-btn" onClick={() => nextMs && setSelected(nextMs)} disabled={!nextMs} title="Étape suivante">
                          <ChevronRight size={16}/>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className={`validate-btn-compact ${isCompleted ? "validated" : ""}`}
                        onClick={handleToggleMs} disabled={validating}>
                        {validating ? <Loader2 size={12} className="animate-spin"/> :
                          isCompleted ? <><CheckCircle2 size={12}/> Validée</> : <><Flag size={12}/> Valider</>}
                      </button>
                      <button
                        className={`bookmark-btn-compact ${bookmarkId === selected.id ? "active" : ""}`}
                        onClick={() => handleBookmark(selected.id)}
                        title={bookmarkId === selected.id ? "Supprimer le marque-page" : "J'en suis là"}
                      >
                        {bookmarkId === selected.id ? <BookmarkCheck size={12} className="text-amber-500"/> : <Bookmark size={12}/>}
                      </button>
                    </div>
                  </div>

                  <div className="step-meta-row mt-3">
                    <span className="step-phase-badge">Phase {selected.chapter > 0 ? selected.chapter : "Intro"}</span>
                    <span className="step-type-badge"
                      style={{ background: typeConf.bg, color: typeConf.color, borderColor: typeConf.color + "40" }}>
                      {typeConf.label}
                    </span>
                    {selected.isOptional && <span className="step-optional-badge">Bonus</span>}
                  </div>
                </div>
                
                {/* Structure / Hierarchy flow */}
                <div className="flex items-center flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-4 bg-zinc-950/20 px-3 py-2 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Structure :</span>
                  <div className="flex items-center gap-1 text-indigo-400">
                    <BookOpen size={10} className="shrink-0" />
                    <span>{guide.name}</span>
                  </div>
                  <ChevronRight size={10} className="text-zinc-700 animate-pulse" />
                  <div className="flex items-center gap-1 text-zinc-300">
                    <span>Phase {selected.chapter > 0 ? selected.chapter : "Intro"} : {selected.chapterLabel}</span>
                  </div>
                  <ChevronRight size={10} className="text-zinc-700 animate-pulse" />
                  <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <Flag size={10} className="shrink-0" />
                    <span className="max-w-[120px] sm:max-w-[200px] truncate">{decodeTitle(selected.title)}</span>
                  </div>
                  {selected.sequences.length > 0 && (() => {
                    const sortedSeqs = [...selected.sequences].sort((a,b) => a.order - b.order);
                    const activeSeq = sortedSeqs[activeSeqIndex] || sortedSeqs[0];
                    return (
                      <>
                        <ChevronRight size={10} className="text-zinc-700 animate-pulse" />
                        <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                          <span className="truncate">Sous-Guide {activeSeq.subGuideRef}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <h1 className="step-title">{decodeTitle(selected.title)}</h1>
                {selected.subtitle && <p className="step-subtitle">{selected.subtitle}</p>}

                {/* Step presence banner */}
                {membersHere.length > 0 && (
                  <div 
                    className="step-presence-banner flex items-center justify-between p-3.5 mt-4 rounded-2xl bg-zinc-950/40 border border-white/5 backdrop-blur-md cursor-pointer hover:bg-zinc-950/60 hover:border-emerald-500/30 transition-all select-none group"
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
                const sortedSeqs = [...selected.sequences].sort((a,b) => a.order - b.order);
                const activeSeq = sortedSeqs[activeSeqIndex] || sortedSeqs[0];
                return (
                  <section className="subguides-section">
                    {/* Explication pédagogique de la hiérarchie */}
                    <div className="mb-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-200/90 leading-relaxed flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                        <Info className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-zinc-100">Comment suivre cette étape ?</span>
                        <span>
                          Cette étape de la quête principale nécessite d&apos;accomplir les instructions du sous-guide de terrain ci-dessous.
                          {sortedSeqs.length > 1 && " L'étape étant longue, elle est découpée en plusieurs sous-guides accessibles via les onglets ci-dessous."}
                          {" Cochez les étapes secondaires au fur et à mesure pour guider vos équipiers !"}
                        </span>
                      </div>
                    </div>

                    <div className="subguides-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>Instructions tactiques</span>
                        <span className="subguides-count">
                          Partie {activeSeqIndex + 1} / {sortedSeqs.length}
                        </span>
                      </div>
                      <button
                        className={`global-hide-steps-btn ${globalHideCompletedSteps ? "active" : ""}`}
                        onClick={() => setGlobalHideCompletedSteps(v => !v)}
                        title={globalHideCompletedSteps ? "Afficher toutes les étapes validées" : "Masquer globalement toutes les étapes validées"}
                      >
                        {globalHideCompletedSteps ? <Eye size={11}/> : <EyeOff size={11}/>}
                        <span>{globalHideCompletedSteps ? "Afficher les validées" : "Cacher les validées"}</span>
                      </button>
                    </div>

                    {/* Horizontal tabs pagination for quick selection */}
                    {sortedSeqs.length > 1 && (
                      <div className="subguides-pagination-tabs">
                        {sortedSeqs.map((seq, idx) => {
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
                          guildId={guildId}
                          onShowStepPresenceModal={handleShowStepPresenceModal}
                          onMapClick={(x, y, explicitWorld) => {
                            navigator.clipboard.writeText(`/travel ${x} ${y}`);
                            let worldId = 1;
                            const contextText = `${activeSeq.subGuideName} ${activeSeq.note || ""} ${selected?.title || ""}`;
                            if (explicitWorld) {
                              worldId = explicitWorld;
                            } else {
                              worldId = detectWorldId(contextText);
                            }
                            setMapModal({ x, y, worldId });

                            // Dynamically resolve precise worldId from server action
                            if (!explicitWorld) {
                              import("@/server/actions/optimized-guide-actions").then((mod) => {
                                mod.resolveMapWorldAction(x, y, contextText).then((res) => {
                                  if (res.success && res.worldId) {
                                    setMapModal(prev => prev && prev.x === x && prev.y === y ? { ...prev, worldId: res.worldId } : prev);
                                  }
                                });
                              });
                            }

                            toast.custom((t) => (
                              <div className="flex items-center gap-3 bg-zinc-950/95 border border-emerald-500/30 p-3.5 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom-5 duration-300">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                  <MapPin className="w-4 h-4 animate-bounce" />
                                </div>
                                <div className="text-left">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Position copiée & carte ouverte</p>
                                  <p className="text-xs font-mono text-zinc-300">/travel {x} {y}</p>
                                </div>
                              </div>
                            ), {
                              position: "bottom-right",
                              duration: 3000
                            });
                          }}
                          onInteractiveClick={handleInteractiveClick}
                          defaultExpanded={true}
                          hideCompletedGlobal={globalHideCompletedSteps}
                          onSelectSubGuide={setActiveGuideFilter}
                          bookmarkStepKey={bookmarkStepKey}
                          onStepBookmark={handleStepBookmark}
                        />
                      )}
                    </div>

                    {/* Bottom horizontal pagination controls */}
                    {sortedSeqs.length > 1 && (
                      <div className="subguides-pagination-controls">
                        <button
                          className="subguide-pag-btn"
                          disabled={activeSeqIndex === 0}
                          onClick={() => setActiveSeqIndex(idx => Math.max(0, idx - 1))}
                        >
                          <ChevronLeft size={12}/> Partie précédente
                        </button>
                        <span className="subguide-pag-indicator">
                          Partie {activeSeqIndex + 1} sur {sortedSeqs.length}
                        </span>
                        <button
                          className="subguide-pag-btn"
                          disabled={activeSeqIndex === sortedSeqs.length - 1}
                          onClick={() => setActiveSeqIndex(idx => Math.min(sortedSeqs.length - 1, idx + 1))}
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
                  </div>
                  {nextMs && (
                    <button className="nav-btn next" onClick={() => setSelected(nextMs)}>
                      <span className="nav-label">Suivant</span> <ArrowRight size={14}/>
                    </button>
                  )}
                </div>
              </footer>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Dynamic HD Map Preview Overlay */}
      <AnimatePresence>
        {mapModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setMapModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-5xl bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-black/40"
                style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, transparent 60%)" }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Aperçu HD de la Position</p>
                    <p className="text-cyan-400 font-mono text-xs mt-0.5">[{mapModal.x}, {mapModal.y}] (Monde {mapModal.worldId ?? 1})</p>
                  </div>
                </div>
                <button onClick={() => setMapModal(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Map preview via MapViewer */}
              <div className="relative w-full h-[55vh] min-h-[350px] border-b border-zinc-800/80">
                <MapViewer 
                    initialTab="map" 
                    initialX={mapModal.x}
                    initialY={mapModal.y}
                    initialZoom={6}
                    initialWorldId={mapModal.worldId ?? 1}
                    hideUI={true}
                />
                {/* Coordinate overlay badge */}
                <div className="absolute top-3 right-3 bg-black/85 border border-cyan-500/30 rounded-xl px-3 py-1.5 backdrop-blur-sm pointer-events-none z-10 shadow-lg">
                  <span className="text-cyan-400 font-mono font-black text-xs">[{mapModal.x}, {mapModal.y}]</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 flex gap-3 bg-zinc-950/20">
                <button onClick={() => {
                  window.open(`/dashboard/${guildId}/worldmap?x=${mapModal.x}&y=${mapModal.y}&world=${mapModal.worldId ?? 1}`, "_blank");
                  setMapModal(null);
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 font-black text-sm transition-all hover:border-cyan-500/40 group">
                  <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Voir en grand sur la carte SigilOS
                </button>
                <button onClick={() => {
                  const cmd = `/travel ${mapModal.x} ${mapModal.y}`;
                  navigator.clipboard.writeText(cmd);
                  toast.success("Commande copiée !", { description: cmd });
                  setMapModal(null);
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-black text-sm transition-all group">
                  <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Copier la commande /travel
                </button>
              </div>

              <p className="px-4 pb-4 text-center text-[10px] text-zinc-700 bg-zinc-950/20">
                Commande autopilote : <span className="font-mono text-zinc-500">/travel {mapModal.x} {mapModal.y}</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
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
        <DialogContent className="max-w-xl bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
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
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
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
        </DialogContent>
      </Dialog>

      {/* Presence Modal Dialog */}
      <Dialog 
        open={presenceModal?.isOpen ?? false} 
        onOpenChange={(open) => setPresenceModal(prev => prev ? { ...prev, isOpen: open } : null)}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
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
                const members = presenceModal ? (presenceMap[presenceModal.milestoneId] || []) : [];
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
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
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
        <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 rounded-[2rem] p-6 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] outline-none">
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
            className="fixed bottom-24 right-6 z-[60] p-3 rounded-full bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-emerald-400/20"
            title="Remonter en haut de page"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

