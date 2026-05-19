"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, Loader2, Search, X,
  BookOpen, MapPin, AlertTriangle, Lightbulb, Info, Flag,
  Users, Star, ArrowRight, ChevronLeft, ExternalLink, Copy,
  Bookmark, BookmarkCheck, EyeOff, Eye, BookOpenCheck
} from "lucide-react";
import { toggleMilestoneProgress, getSubGuideSteps } from "@/server/actions/optimized-guide-actions";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/security";
import "./guide-styles.css";

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
  playerProgress?: { isCompleted: boolean; completedSteps?: number[] };
};
type SubStep = { stepNumber: number; plainText?: string; web_text?: string; pos_x?: number; pos_y?: number };
type GuildMember = { profileId: string; userName: string; userAvatar?: string; milestoneId: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GP_PALETTE = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#f97316","#84cc16","#a78bfa","#34d399","#fb7185"
];
const getGPColor = (ref: string) => GP_PALETTE[(parseInt(ref.replace(/\D/g,""))||0) % GP_PALETTE.length];

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

// Process HTML to make coordinates and entities clickable without breaking tags
const processHtml = (html: string) => {
  if (!html) return "";
  
  // 0. Sanitize FIRST — remove any malicious tags/attributes before transforming
  const safe = sanitizeHtml(html) ?? "";
  if (!safe) return "";
  
  // 1. Split into tags and text content to avoid breaking attributes
  const parts = safe.split(/(<[^>]+>)/g);
  
  const processedParts = parts.map(part => {
    if (part.startsWith('<')) {
      let tagContent = part;
      // Intercept shorthand or local image sources and map to original Ganymede CDN URLs
      if (tagContent.toLowerCase().startsWith('<img')) {
        tagContent = tagContent.replace(/src=["']?([^"']+)["']?/i, (match, src) => {
          const lowerSrc = src.toLowerCase();
          if (lowerSrc === 'quest' || lowerSrc.includes('icon_quest.png')) {
            return `src="https://ganymede-dofus.com/images/icon_quest.png"`;
          }
          if (lowerSrc === 'dungeon' || lowerSrc.includes('icon_dungeon.png')) {
            return `src="https://ganymede-dofus.com/images/icon_dungeon.png"`;
          }
          if (lowerSrc === 'guidestep' || lowerSrc.includes('guides.png')) {
            return `src="https://ganymede-app.com/images/texteditor/guides.png"`;
          }
          if (lowerSrc === 'monster' || lowerSrc.includes('icon_monster.png')) {
            return `src="https://ganymede-dofus.com/images/icon_monster.png"`;
          }
          if (lowerSrc.includes('gyazo.com/0a5cd701d47079078cad5f59fe91e700')) {
            return `src="https://ganymede-app.com/images/ganymede-logo.webp"`;
          }
          return match;
        });
      }
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
          return `<span class="coord-chip" data-x="${x}" data-y="${y}"${worldAttr} title="Copier la position et ouvrir la carte">[${x}, ${y}]</span>`;
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
function SubGuideCard({ seq, checkedSteps, onStepToggle, onMapClick, onInteractiveClick, defaultExpanded = false }: {
  seq: Sequence;
  checkedSteps: Set<string>;
  onStepToggle: (ref: string, n: number) => void;
  onMapClick: (x: number, y: number, worldId?: number) => void;
  onInteractiveClick: (e: React.MouseEvent) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [steps, setSteps] = useState<SubStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const color = getGPColor(seq.subGuideRef);

  // Focus & Hide state
  const [readMode, setReadMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hideCompletedLocal, setHideCompletedLocal] = useState(false);

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

  const handleExpand = () => {
    if (!expanded) load();
    setExpanded(v => !v);
  };

  const handleStepCheckToggle = (stepNumber: number, stepIndex: number) => {
    const key = `${seq.subGuideRef}-${stepNumber}`;
    const isNowChecked = !checkedSteps.has(key);
    onStepToggle(seq.subGuideRef, stepNumber);

    if (readMode && isNowChecked && stepIndex < steps.length - 1) {
      // Auto-advance to next step in focus mode
      setTimeout(() => {
        setCurrentStepIndex(stepIndex + 1);
      }, 400);
    }
  };

  const done = steps.filter(s => checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`)).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Filter steps if hideCompleted is checked
  const filteredSteps = hideCompletedLocal
    ? steps.filter(s => !checkedSteps.has(`${seq.subGuideRef}-${s.stepNumber}`))
    : steps;

  return (
    <div className="sgc" style={{"--sgc-color": color} as React.CSSProperties}>
      {/* Card Header */}
      <button className="sgc-header" onClick={handleExpand} aria-expanded={expanded}>
        <div className="sgc-badge">{seq.subGuideRef}</div>
        <div className="sgc-info">
          <span className="sgc-name">{seq.subGuideName}</span>
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
          {seq.isResume && <span className="sgc-flag resume">↩ Reprendre depuis votre dernière position</span>}
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
                    className={`sgc-ctrl-btn ${readMode ? "active" : ""}`}
                    onClick={() => setReadMode(v => !v)}
                    title="Activer le mode lecture étape par étape"
                  >
                    <BookOpen size={12}/>
                    <span>Mode Lecture</span>
                  </button>
                  <button 
                    className={`sgc-ctrl-btn ${hideCompletedLocal ? "active" : ""}`}
                    onClick={() => setHideCompletedLocal(v => !v)}
                    title="Masquer les étapes terminées de ce sous-guide"
                  >
                    <EyeOff size={12}/>
                    <span>Cacher validées ({done})</span>
                  </button>
                </div>

                {readMode ? (
                  /* Focus mode rendering (Ganymede-like) */
                  (() => {
                    const step = steps[currentStepIndex];
                    if (!step) return <div className="sgc-empty">Aucune étape sélectionnée</div>;

                    const key = `${seq.subGuideRef}-${step.stepNumber}`;
                    const checked = checkedSteps.has(key);
                    const coords = Array.from(
                      (step.plainText ?? step.web_text ?? "").matchAll(/\[(-?\d+),\s*(-?\d+)(?:,\s*(\d+))?\]/g)
                    ).map(m => ({ x: parseInt(m[1]), y: parseInt(m[2]), worldId: m[3] ? parseInt(m[3]) : undefined }));

                    return (
                      <div className="sgc-focus-wrap">
                        <div className="sgc-focus-header">
                          <button 
                            className="sgc-focus-nav-btn"
                            disabled={currentStepIndex === 0}
                            onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                          >
                            <ChevronLeft size={16}/>
                          </button>
                          <span className="sgc-focus-indicator">
                            Étape {step.stepNumber} ({currentStepIndex + 1} / {steps.length})
                          </span>
                          <button 
                            className="sgc-focus-nav-btn"
                            disabled={currentStepIndex === steps.length - 1}
                            onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
                          >
                            <ChevronRight size={16}/>
                          </button>
                        </div>

                        <div className={`sgc-step sgc-step-focus ${checked ? "done" : ""}`}>
                          <div className="sgc-step-check" 
                            onClick={() => handleStepCheckToggle(step.stepNumber, currentStepIndex)}>
                            {checked ? <CheckCircle2 size={20} className="checked-icon"/> : <Circle size={20} className="unchecked-icon"/>}
                          </div>
                          <span className="sgc-step-num"
                            onClick={() => handleStepCheckToggle(step.stepNumber, currentStepIndex)}>
                            {step.stepNumber}
                          </span>
                          <div className="sgc-step-content ganymade-step-text"
                            onClick={onInteractiveClick}
                            dangerouslySetInnerHTML={{ __html: processHtml(step.web_text ?? step.plainText ?? "") }}/>
                          {coords.length > 0 && (
                            <div className="sgc-step-coords">
                              {coords.map((c,i) => (
                                <button key={i} className="coord-btn" onClick={(e) => { e.stopPropagation(); onMapClick(c.x, c.y, c.worldId); }}>
                                  <MapPin size={9}/> {c.x},{c.y}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Standard list rendering */
                  <div className="sgc-step-list">
                    {filteredSteps.length === 0 ? (
                      <div className="sgc-empty">Toutes les étapes de ce sous-guide sont validées ! 🎉</div>
                    ) : (
                      filteredSteps.map(step => {
                        const key = `${seq.subGuideRef}-${step.stepNumber}`;
                        const checked = checkedSteps.has(key);
                        const coords = Array.from(
                          (step.plainText ?? step.web_text ?? "").matchAll(/\[(-?\d+),\s*(-?\d+)(?:,\s*(\d+))?\]/g)
                        ).map(m => ({ x: parseInt(m[1]), y: parseInt(m[2]), worldId: m[3] ? parseInt(m[3]) : undefined }));

                        const stepIndexInFullList = steps.findIndex(s => s.stepNumber === step.stepNumber);

                        return (
                          <div key={step.stepNumber}
                            className={`sgc-step ${checked ? "done" : ""}`}>
                            <div className="sgc-step-check" 
                              title={checked ? "Désactiver cette étape" : "Valider cette étape"}
                              onClick={() => handleStepCheckToggle(step.stepNumber, stepIndexInFullList)}>
                              {checked ? <CheckCircle2 size={18} className="checked-icon"/> : <Circle size={18} className="unchecked-icon"/>}
                            </div>
                            <span className="sgc-step-num"
                              title={checked ? "Désactiver cette étape" : "Valider cette étape"}
                              onClick={() => handleStepCheckToggle(step.stepNumber, stepIndexInFullList)}>
                              {step.stepNumber}
                            </span>
                            <div className="sgc-step-content ganymade-step-text"
                              onClick={onInteractiveClick}
                              dangerouslySetInnerHTML={{ __html: processHtml(step.web_text ?? step.plainText ?? "") }}/>
                            {coords.length > 0 && (
                              <div className="sgc-step-coords">
                                {coords.map((c,i) => (
                                  <button key={i} className="coord-btn" onClick={(e) => { e.stopPropagation(); onMapClick(c.x, c.y, c.worldId); }}>
                                    <MapPin size={9}/> {c.x},{c.y}{c.worldId ? ` (Monde ${c.worldId})` : ''}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
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
        dangerouslySetInnerHTML={{ __html: processHtml(html) }}/>
    </div>
  );
}

// ─── Chapter Group ────────────────────────────────────────────────────────────
function ChapterGroup({ chapter, label, milestones, selectedId, completedIds, onSelect, defaultOpen, presenceMap, bookmarkId }: {
  chapter: number; label: string; milestones: Milestone[];
  selectedId?: string; completedIds: Set<string>;
  onSelect: (m: Milestone) => void; defaultOpen: boolean;
  presenceMap: Record<string, GuildMember[]>;
  bookmarkId?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = milestones.filter(m => completedIds.has(m.id)).length;
  const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0;
  const allDone = done === milestones.length;

  const totalPresence = milestones.reduce((acc, m) => acc + (presenceMap[m.id]?.length || 0), 0);

  return (
    <div className="chapter-group">
      <button className={`chapter-header ${allDone ? "all-done" : ""}`} onClick={() => setOpen(v=>!v)}>
        <ProgressRing pct={pct} size={28} stroke={2.5} color={allDone ? "#10b981" : "#3b82f6"}/>
        <div className="chapter-label">
          <span className="chapter-name">{label}</span>
          <div className="chapter-meta">
            <span className="chapter-count">{done}/{milestones.length} complétées</span>
            {totalPresence > 0 && (
              <span className="chapter-presence">
                <Users size={10}/> {totalPresence}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronDown size={14} className="text-zinc-500"/> : <ChevronRight size={14} className="text-zinc-500"/>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="chapter-items"
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.18 }}>
            {milestones.map((ms, i) => {
              const isSelected = ms.id === selectedId;
              const isDone = completedIds.has(ms.id);
              const here = presenceMap[ms.id] || [];
              return (
                <button key={ms.id} className={`ms-row ${isSelected ? "active" : ""} ${isDone ? "done" : ""} ${bookmarkId === ms.id ? "bookmarked" : ""}`}
                  onClick={() => onSelect(ms)}>
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
                    <div className="ms-presence-chip" title={`${here.length} membres ici`}>
                      <Users size={10}/>
                      <span>{here.length}</span>
                    </div>
                  )}

                  {ms.sequences.length > 0 && (
                    <span className="ms-seqs">{ms.sequences.length}</span>
                  )}
                </button>
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
  userProgress: { milestoneId: string; isCompleted: boolean; completedSteps?: number[] }[];
  guildProgress: GuildMember[];
  guildId: string;
}) {
  const [milestones] = useState(initialMilestones);
  const [selected, setSelected] = useState<Milestone | null>(initialMilestones[0] ?? null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(userProgress.filter(p => p.isCompleted).map(p => p.milestoneId))
  );
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [validating, setValidating] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  
  const [mapModal, setMapModal] = useState<{x:number;y:number;worldId?:number}|null>(null);
  const [activeSeqIndex, setActiveSeqIndex] = useState(0);
  const [activeGuideFilter, setActiveGuideFilter] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
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

  useEffect(() => {
    setActiveSeqIndex(0);
  }, [selected?.id]);

  // Extract list of all unique sub-guides available inside this roadmap
  const availableSubGuides = useMemo(() => {
    const list: { ref: string; name: string }[] = [];
    const seen = new Set<string>();
    milestones.forEach(m => {
      m.sequences.forEach(s => {
        const key = s.subGuideName.trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          list.push({ ref: s.subGuideRef, name: s.subGuideName });
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

  // Presence mapping
  const presenceMap = useMemo(() => {
    const map: Record<string, GuildMember[]> = {};
    guildProgress.forEach(m => {
      if (!map[m.milestoneId]) map[m.milestoneId] = [];
      map[m.milestoneId].push(m);
    });
    return map;
  }, [guildProgress]);

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

  const selectedIdx = selected ? flatList.findIndex(m => m.id === selected.id) : -1;
  const prevMs = selectedIdx > 0 ? flatList[selectedIdx - 1] : null;
  const nextMs = selectedIdx < flatList.length - 1 ? flatList[selectedIdx + 1] : null;

  // Scroll to top on milestone change
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [selected?.id]);

  // Guild members on current step
  const membersHere = useMemo(() =>
    selected ? guildProgress.filter(m => m.milestoneId === selected.id) : [],
  [selected, guildProgress]);

  const handleStepToggle = useCallback((ref: string, n: number) => {
    const key = `${ref}-${n}`;
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleToggleMs = useCallback(async () => {
    if (!selected) return;
    setValidating(true);
    const isCurrentlyCompleted = completedIds.has(selected.id);
    try {
      const res = await toggleMilestoneProgress(guildId, selected.id, !isCurrentlyCompleted);
      if ((res as any).success) {
        setCompletedIds(prev => {
          const next = new Set(prev);
          if (next.has(selected.id)) { next.delete(selected.id); }
          else {
            next.add(selected.id);
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

    // 0. Guide-step spans (cross-guide navigation)
    const guideStepEl = target.closest(".guide-step-link") as HTMLElement;
    if (guideStepEl) {
      e.stopPropagation();
      e.preventDefault();
      const guideName = guideStepEl.getAttribute("guidename") || guideStepEl.getAttribute("guideName") || "";
      const refMatch = guideName.match(/\[GP(\d+)\]/i);
      const ref = refMatch ? `GP${refMatch[1]}` : "";
      if (ref) {
        let foundSeqIndex = 0;
        const targetMs = milestones.find(m => {
          const sortedSeqs = [...m.sequences].sort((a,b) => a.order - b.order);
          const idx = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref.toUpperCase());
          if (idx !== -1) { foundSeqIndex = idx; return true; }
          return false;
        });
        if (targetMs) {
          setSelected(targetMs);
          setActiveSeqIndex(foundSeqIndex);
          mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          toast.info(`→ ${targetMs.title}`);
        } else {
          import("@/server/actions/optimized-guide-actions").then((mod: any) => {
            mod.findGuideBySubRef(ref).then((res: any) => {
              if (res?.success && res.slug) {
                toast.info(`Ouverture du guide ${res.guideName || ref}…`);
                window.open(`/dashboard/${guildId}/quetes-dofus/guide/${res.slug}`, "_blank");
              } else {
                toast.warning(`Sous-guide ${ref} introuvable dans cette roadmap.`);
              }
            });
          });
        }
      }
      return;
    }

    // 1. Coordinates
    const chip = target.closest(".coord-chip") as HTMLElement;
    if (chip) {
      e.stopPropagation();
      e.preventDefault();
      const x = chip.getAttribute("data-x");
      const y = chip.getAttribute("data-y");
      const explicitWorld = chip.getAttribute("data-world");
      if (x && y) {
        const xNum = parseInt(x);
        const yNum = parseInt(y);
        navigator.clipboard.writeText(`/travel ${xNum} ${yNum}`);
        chip.classList.add("copied");
        
        let worldId = 1;
        const stepContainer = chip.closest(".sgc-step") || chip.closest(".narrative-block") || target.closest("main");
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

        toast.custom((t) => (
          <div className="flex items-center gap-3 bg-zinc-950/95 border border-emerald-500/30 p-3.5 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <MapPin className="w-4 h-4 animate-bounce" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Position copiée & carte ouverte</p>
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
      
      let foundSeqIndex = 0;
      const targetMs = milestones.find(m => {
        // 1. Try exact matching sequence ref (e.g. "GP23")
        const sortedSeqs = [...m.sequences].sort((a,b) => a.order - b.order);
        const idx = sortedSeqs.findIndex(s => s.subGuideRef.toUpperCase() === ref);
        if (idx !== -1) {
          foundSeqIndex = idx;
          return true;
        }

        // 2. Fallbacks
        const chapterNum = m.chapter?.toString() || "";
        const label = (m.chapterLabel || "").toUpperCase();
        const title = (m.title || "").toUpperCase();
        
        return label.includes(ref) || 
               title.includes(ref) || 
               ref.includes(chapterNum) ||
               (ref.startsWith("GP") && label.includes(ref.replace("GP", "")));
      });

      if (targetMs) {
        setSelected(targetMs);
        setActiveSeqIndex(foundSeqIndex);
        toast.info(`Navigation : ${targetMs.title} (Partie ${foundSeqIndex + 1})`);
      } else {
        toast.error(`Guide introuvable : ${ref}`);
      }
      return;
    }

    // 3. Clickable Entities (Dungeons, Items, Quests)
    const entity = target.closest(".clickable-entity") as HTMLElement;
    if (entity) {
      e.stopPropagation();
      e.preventDefault();
      const type = entity.getAttribute("data-type");
      const dbid = entity.getAttribute("dofusdbid") || entity.getAttribute("data-dbid");
      const dbtype = entity.getAttribute("data-dbtype") || "items";
      
      if (type === "dungeon" || type === "quest") {
        const name = entity.getAttribute("name") || entity.innerText;
        window.open(`/dashboard/${guildId}/worldmap?search=${encodeURIComponent(name)}`, "_blank");
        toast.info(`Recherche : ${name}`);
      } else if (dbid) {
        const singularType = dbtype.endsWith("s") ? dbtype.slice(0, -1) : dbtype;
        window.open(`https://dofusdb.fr/fr/database/${singularType}/${dbid}`, "_blank");
        toast.info(`Ouverture DofusDB`);
      }
      return;
    }
  }, [milestones, guildId]);


  const isCompleted = selected ? completedIds.has(selected.id) : false;
  const typeConf = selected ? (TYPE_CONFIG[selected.type] ?? TYPE_CONFIG.QUETE_SERIE) : TYPE_CONFIG.QUETE_SERIE;

  return (
    <div className="guide-shell">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside className="guide-sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <div>
              <p className="sidebar-super">ROADMAP</p>
              <h2 className="sidebar-title">{guide.name}</h2>
            </div>
            <div className="sidebar-ring-wrap">
              <ProgressRing pct={overallPct} size={44} stroke={3.5} color="#10b981"/>
              <span className="sidebar-pct">{overallPct}%</span>
            </div>
          </div>
          <div className="sidebar-stats">
            <span>{totalDone} / {totalMs} complétées</span>
          </div>
        </div>

        {/* Guild Radar */}
        <div className="sidebar-radar">
          <div className="radar-header">
            <Users size={12} className="text-blue-400"/>
            <span>Radar de Guilde</span>
          </div>
          <div className="radar-grid">
            <div className="radar-stat">
              <span className="radar-val">{guildProgress.length}</span>
              <span className="radar-lab">Membres actifs</span>
            </div>
            <div className="radar-stat">
              <span className="radar-val">{Object.keys(presenceMap).length}</span>
              <span className="radar-lab">Étapes occupées</span>
            </div>
          </div>
        </div>

        {/* Search + Hide-completed toggle */}
        <div className="sidebar-search">
          <Search size={13} className="search-icon"/>
          <input
            className="search-input" placeholder="Rechercher une étape…"
            value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch("")} className="search-clear"><X size={12}/></button>}
        </div>
        <button
          className={`hide-completed-toggle ${hideCompleted ? "active" : ""}`}
          onClick={() => setHideCompleted(v => !v)}
          title={hideCompleted ? "Afficher toutes les étapes" : "Cacher les étapes validées"}
        >
          {hideCompleted ? <Eye size={12}/> : <EyeOff size={12}/>}
          <span>{hideCompleted ? "Afficher toutes" : "Cacher les validées"}</span>
          {hideCompleted && completedIds.size > 0 && (
            <span className="hide-badge">{completedIds.size}</span>
          )}
        </button>

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
                defaultOpen={idx === 0 || ch.items.some(m => m.id === selected?.id)}
                presenceMap={presenceMap}
                bookmarkId={bookmarkId}
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
              <div className="guide-name-banner">
                <BookOpen size={13} className="text-emerald-400"/>
                <span className="guide-name-label">{guide.name}</span>
                <span className="guide-name-sep">›</span>
                <span className="guide-name-step">{selected.title}</span>
                {bookmarkId === selected.id && (
                  <span title="Votre position actuelle"><BookmarkCheck size={13} className="text-amber-400"/></span>
                )}
              </div>

              {/* Step header with Navigator */}
              <header className="step-header">
                <div className="step-navigator">
                  <div className="step-nav-info">
                    <span className="step-nav-ref">
                      {activeGuideFilter ? `📌 ${activeGuideFilter}` : `🗺️ ${guide.name}`}
                    </span>
                    <div className="step-nav-controls">
                      <button className="nav-step-btn" onClick={() => prevMs && setSelected(prevMs)} disabled={!prevMs} title="Étape précédente">
                        <ChevronLeft size={16}/>
                      </button>
                      <span className="nav-step-count">{selectedIdx + 1} / {flatList.length}</span>
                      <button className="nav-step-btn" onClick={() => nextMs && setSelected(nextMs)} disabled={!nextMs} title="Étape suivante">
                        <ChevronRight size={16}/>
                      </button>
                    </div>
                  </div>
                  
                  {/* Selector Pills Bar to switch between Complete Sequential or Specific Sub-Guides */}
                  <div className="step-nav-filter-bar">
                    <button
                      className={`filter-pill-btn ${!activeGuideFilter ? "active" : ""}`}
                      onClick={() => setActiveGuideFilter(null)}
                    >
                      🗺️ Guide Complet
                    </button>
                    {availableSubGuides.slice(0, 3).map(sg => {
                      const isActive = activeGuideFilter === sg.name;
                      return (
                        <button
                          key={sg.ref}
                          className={`filter-pill-btn ${isActive ? "active" : ""}`}
                          onClick={() => setActiveGuideFilter(sg.name)}
                        >
                          📌 {sg.name}
                        </button>
                      );
                    })}
                    {availableSubGuides.length > 3 && (
                      <select
                        className="filter-select-dropdown"
                        value={activeGuideFilter || ""}
                        onChange={(e) => setActiveGuideFilter(e.target.value || null)}
                      >
                        <option value="">Autres guides...</option>
                        {availableSubGuides.slice(3).map(sg => (
                          <option key={sg.ref} value={sg.name}>{sg.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="step-meta-row">
                    <span className="step-phase-badge">Phase {selected.chapter > 0 ? selected.chapter : "Intro"}</span>
                    <span className="step-type-badge"
                      style={{ background: typeConf.bg, color: typeConf.color, borderColor: typeConf.color + "40" }}>
                      {typeConf.label}
                    </span>
                    {selected.isOptional && <span className="step-optional-badge">Bonus</span>}
                  </div>
                </div>
                
                <h1 className="step-title">{selected.title}</h1>
                {selected.subtitle && <p className="step-subtitle">{selected.subtitle}</p>}
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
                    <div className="subguides-label">
                      <span>Instructions tactiques</span>
                      <span className="subguides-count">
                        Partie {activeSeqIndex + 1} / {sortedSeqs.length}
                      </span>
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

              {/* Members here */}
              {membersHere.length > 0 && (
                <div className="members-here">
                  <Users size={12}/>
                  <span>{membersHere.length} membre{membersHere.length>1?"s":""} sur cette étape</span>
                  <div className="member-avatars">
                    {membersHere.slice(0,5).map(m => (
                      <div key={m.profileId} className="member-avatar" title={m.userName}>
                        {m.userAvatar
                          ? <img src={m.userAvatar} alt={m.userName || "Membre"}/>
                          : <span>{(m.userName || "?")[0]?.toUpperCase()}</span>}
                      </div>
                    ))}
                  </div>
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
    </div>
  );
}

