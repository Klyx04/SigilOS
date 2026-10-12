"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2, Circle, ChevronDown,
  ExternalLink, MapPin,
  ArrowUp, BookOpen, Skull, X,
  Layers, Users,
  Lock, Search, EyeOff, Eye, Crosshair, Flag, RotateCcw, Copy, Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusQuestStatus } from "@prisma/client";
import { toast } from "sonner";
import type { DofusPresenceMember } from "@/hooks/use-dofus-presence";
import { isSafeImageUrl } from "@/lib/security";
import { QUEST_TYPE_KEYS, questTypeIconPath } from "@/lib/quest-type-icon";
import { extractNpcRef } from "@/lib/npc-portrait";
import { brandIconForUrl } from "@/lib/source-icons";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import { copyToClipboard } from "@/lib/clipboard";
import { NpcBadge } from "@/components/dofus-quests/rush/NpcBadge";
import { ZaapCopyButton } from "@/components/dofus-quests/ZaapCopyButton";
import {
  buildQuestTree,
  collectSubtreeQuestIds,
  filterTreeEntries,
  isAchievement,
  nodeProgress,
  questProgress,
  type QuestTree,
} from "@/lib/dofus-quest-tree";

interface DofusTimelineQuestProps {
  guildId: string;
  dofus: any;
  chains: any[];
  dofusColor: string;
  completedIds: Set<string>;
  onToggleStatus: (questId: string, newStatus: DofusQuestStatus) => void;
  selectedCharacter?: string;
  synergy?: Record<string, { profileId: string; pseudo: string; image: string | null; status: string }[]>;
  currentUser?: { pseudo: string; image: string | null };
  prereqsByQuestId?: Record<string, { fromQuestId: string; name: string }[]>;
  /** #37 suite — présence live WS de la page (membres + quête qu'ils regardent). */
  presence?: DofusPresenceMember[];
  presenceConnected?: boolean;
  onFocusedQuestChange?: (questId: string | null) => void;
  customSlotAfterPrerequisites?: React.ReactNode;
}

function parseObjectiveText(raw: string): string {
  if (!raw) return "";
  let t = raw.replace(/\{monster,(\d+)\}/g, "Monstre #$1");
  t = t.replace(/\{map,(\d+)::([^}]+)\}/g, "$2");
  t = t.replace(/\{npc,(\d+)\}/g, "PNJ #$1");
  t = t.replace(/\{item,(\d+)\}/g, "Objet #$1");
  return t;
}

function ScrollToTopButton() {
  const [v, setV] = useState(false);
  useEffect(() => { const s = () => setV(window.scrollY > 400); window.addEventListener("scroll", s, { passive: true }); return () => window.removeEventListener("scroll", s); }, []);
  return (
    <AnimatePresence>
      {v && <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-2xl bg-success/90 backdrop-blur-xl border border-success/30 flex items-center justify-center text-success-foreground hover:bg-success transition-all "><ArrowUp className="w-5 h-5" /></motion.button>}
    </AnimatePresence>
  );
}

// ─── Inline quest detail ──────────────────────────────────────────────────
/**
 * Bulle d'information d'une quête (façon guide Sylvestre) : sections à filet,
 * libellés en casse normale, neutre sauf les états. Les donjons lient vers
 * leur fiche interne, les liens externes portent les favicons locales.
 */
function QuestDetailInline({ quest, color, isCompleted, onToggle, synergyForQuest, liveViewers = [], guildId = "" }: {
  quest: any; color: string; isCompleted: boolean; onToggle: (s: DofusQuestStatus) => void;
  synergyForQuest?: { profileId: string; pseudo: string; image: string | null; status: string }[];
  liveViewers?: DofusPresenceMember[];
  guildId?: string;
}) {
  const coords = quest.coords as any;
  const objectives = quest.objectives as any[] | any;
  const itemsRequired = quest.itemsRequired as any[] | any;
  const dungeonsRequired = quest.dungeonsRequired as any[] | any;

  const objList = useMemo(() => {
    if (!objectives) return [];
    let r: any[] = [];
    if (Array.isArray(objectives)) r = objectives;
    else { try { const p = typeof objectives === "string" ? JSON.parse(objectives) : objectives; r = Array.isArray(p) ? p : []; } catch {} }
    return r.map((o: any) => { const t = typeof o === "string" ? o : o.description || o.name || ""; return parseObjectiveText(t); }).filter(Boolean);
  }, [objectives]);

  const items = useMemo(() => {
    if (!itemsRequired) return [];
    return Array.isArray(itemsRequired) ? itemsRequired.filter(Boolean) : [];
  }, [itemsRequired]);

  const dungeons = useMemo(() => {
    if (!dungeonsRequired) return [];
    return Array.isArray(dungeonsRequired) ? dungeonsRequired.filter(Boolean) : [];
  }, [dungeonsRequired]);

  const members = useMemo(() => {
    if (!synergyForQuest) return [];
    // Affiche TOUS les membres présents sur la quête : ceux « je suis ici »
    // (IN_PROGRESS) d'abord, puis ceux qui l'ont complétée — plus de plafond.
    return [...synergyForQuest].sort((a, b) =>
      a.status === b.status ? 0 : a.status === "IN_PROGRESS" ? -1 : 1
    );
  }, [synergyForQuest]);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden border-l-2 ml-10 mb-2" style={{ borderColor: `${color}88` }}>
      <div className="p-4 bg-elevated border border-border rounded-md ml-0">
        <div className="divide-y divide-border">
        <div className="flex items-center gap-3 pb-3">
          <button onClick={() => onToggle(isCompleted ? "NOT_STARTED" : "COMPLETED")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              isCompleted ? "bg-success/10 border-success/30 text-success" : "bg-surface border-border text-muted-foreground hover:border-border hover:text-success-foreground"
            }`}>
            {isCompleted ? <><CheckCircle2 className="w-4 h-4" /> Complétée <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onToggle("NOT_STARTED"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggle("NOT_STARTED"); } }} className="ml-2 px-2 py-0.5 rounded bg-elevated text-muted-foreground hover:text-danger text-caption cursor-pointer" title="Réinitialiser">↺</span></> : <><Circle className="w-4 h-4" /> Valider</>}
          </button>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-auto justify-end">
              {members.map((m: any) => (
                <div key={m.profileId} className="w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted shrink-0" title={`${m.pseudo}${m.status === "COMPLETED" ? " — quête complétée" : " — je suis ici"}`}>
                  {m.image ? <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" /> : <span className="text-caption font-black text-muted-foreground flex items-center justify-center h-full">{m.pseudo?.[0]?.toUpperCase() || "?"}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {liveViewers.length > 0 && (
          <div className="flex items-center gap-2 py-3">
            <span className="text-caption font-black uppercase tracking-widest text-success/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> En direct
            </span>
            <div className="flex -space-x-1.5">
              {liveViewers.map((m) => (
                <div key={m.profileId} title={`${m.userName} regarde cette quête`} className="w-5 h-5 rounded-full border-2 border-success/60 overflow-hidden bg-muted shrink-0">
                  {m.userAvatar ? <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" /> : <span className="text-caption font-black text-success flex items-center justify-center h-full">{m.userName?.[0]?.toUpperCase() || "?"}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Position de lancement + positions GPS /travel + niveau recommandé (#148) */}
        <div className="flex flex-wrap items-center gap-2 py-3 text-caption">
          <span className="text-[11px] font-semibold text-muted-foreground">Position de lancement</span>
          {quest.zone && <span className="text-muted-foreground font-medium">{quest.zone}</span>}
          {Array.isArray(quest.positions) && quest.positions.length > 0 ? (
            quest.positions.map((p: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1">
                <button onClick={async () => { const cmd = `/travel ${p.x},${p.y}`; const ok = await copyToClipboard(cmd); if (ok) toast.success(`Copié : ${cmd}`); }} aria-label={`Copier /travel ${p.x},${p.y}`} title="Cliquer pour copier /travel" className="inline-flex cursor-pointer select-none items-center gap-1 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
                  <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />{p.x},{p.y}
                  <Copy className="w-3 h-3 shrink-0 opacity-60" />
                </button>
                {Number.isSafeInteger(p?.x) && Number.isSafeInteger(p?.y) && (p as any)?.zaap && (() => {
                  const zm = (p as any)?.zaap && typeof (p as any).zaap === "object" && Number.isSafeInteger((p as any).zaap?.x) && Number.isSafeInteger((p as any).zaap?.y)
                    ? (p as any).zaap : null;
                  return <ZaapCopyButton x={p.x} y={p.y} zaapX={zm?.x ?? null} zaapY={zm?.y ?? null} />;
                })()}
              </span>
            ))
          ) : coords ? (
            <button onClick={async () => { const cmd = `/travel ${coords.x},${coords.y}`; const ok = await copyToClipboard(cmd); if (ok) toast.success(`Copié : ${cmd}`); }} aria-label={`Copier /travel ${coords.x},${coords.y}`} title="Cliquer pour copier /travel" className="inline-flex cursor-pointer select-none items-center gap-1 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />{coords.x},{coords.y}
              <Copy className="w-3 h-3 shrink-0 opacity-60" />
            </button>
          ) : null}
        </div>

        {/* Objectifs */}
        {objList.length > 0 && (
          <div className="py-3 text-caption text-foreground leading-relaxed space-y-0.5">
            {objList.slice(0, 3).map((t: string, i: number) => <p key={i} className="flex items-start gap-1.5"><span className="text-muted-foreground mt-0.5 shrink-0">•</span><span>{t}</span></p>)}
            {objList.length > 3 && <p className="text-muted-foreground italic text-caption">+{objList.length - 3} autres objectifs</p>}
          </div>
        )}

        {/* Items / Donjons — les donjons lient vers leur fiche interne */}
        <div className="py-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Requis</p>
          <div className="flex flex-wrap gap-1.5">
          {items.map((it: any, i: number) => <span key={i} className="px-2 py-0.5 rounded-[3px] bg-warning/10 border border-warning/20 text-warning text-caption font-semibold">{typeof it === "string" ? it : it.name || it}</span>)}
          {dungeons.map((d: any, i: number) => {
            const dungeon = typeof d === "object" && d ? d : null;
            const dungeonName = typeof d === "string" ? d : (d?.bossName || d?.name || "Donjon");
            const href = dungeonFicheHref(guildId, dungeon);
            const dImg = dungeon && isSafeImageUrl(dungeon.imageUrl) ? String(dungeon.imageUrl) : "";
            const inner = (<>
                {dImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={dImg} alt="" className="w-4 h-4 object-cover rounded" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : <Skull className="w-3 h-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{typeof d === "string" ? d : (d?.name || dungeonName)}</span>
                {href && <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />}
              </>);
            return href ? (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer" title={`Ouvrir la fiche boss de ${dungeonName}`} className="px-2 py-0.5 rounded-[3px] bg-surface border border-border text-foreground text-caption font-semibold flex items-center gap-1.5 hover:border-border-strong transition-colors">
                {inner}
              </a>
            ) : (
              <span key={i} title={dungeonName} className="px-2 py-0.5 rounded-[3px] bg-surface border border-border text-muted-foreground text-caption font-semibold flex items-center gap-1.5">
                {inner}
              </span>
            );
          })}
          </div>
        </div>

        {/* Liens externes : URLs saisies en God prioritaires, favicons servies
            en local (`brandIconForUrl`, jamais de requête vers un tiers).
            Le donneur PNJ s'affiche via `NpcBadge` sur la ligne (nom en hover),
            jamais comme « Prérequis » — les vrais prérequis viennent de
            `prereqsByQuestId` (table de liaison, verrou de la ligne). */}
        <div className="flex gap-2 pt-3 items-center">
          {(() => {
            const dofusdbHref = (typeof quest.dofusdbUrl === "string" && quest.dofusdbUrl.trim() !== "")
              ? quest.dofusdbUrl.trim()
              : (quest.dofusdbId ? `https://dofusdb.fr/fr/database/quest/${quest.dofusdbId}` : null);
            const rawNoobs = (typeof quest.dofuspourlesnoobsUrl === "string" && quest.dofuspourlesnoobsUrl.trim() !== "")
              ? quest.dofuspourlesnoobsUrl.trim()
              : (typeof quest.externalRef === "string" && /^https?:\/\//i.test(quest.externalRef.trim()) ? quest.externalRef.trim() : null);
            const dofusdbBrand = brandIconForUrl(dofusdbHref);
            const noobsBrand = brandIconForUrl(rawNoobs);
            return (<>
              {dofusdbHref && <a href={dofusdbHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-info/10 border border-info/20 text-info text-caption font-bold hover:bg-info/20 transition-all">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dofusdbBrand?.src ?? "/assets/icons/dofusdb.png"} alt="" className="w-3 h-3 rounded" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> DofusDB</a>}
              {rawNoobs && <a href={rawNoobs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold hover:bg-warning/20 transition-all">
                {noobsBrand ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={noobsBrand.src} alt="" className="w-3 h-3 rounded" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : <BookOpen className="w-3 h-3" />} Guide Noobs</a>}
              {quest.isDungeon && !rawNoobs && (
                <button onClick={() => { const slug = (quest.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); window.open(`https://www.dofuspourlesnoobs.com/donjon-${slug}.html`, "_blank"); }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold hover:bg-warning/20 transition-all"><BookOpen className="w-3 h-3" /> Guide Noobs</button>
              )}
            </>);
          })()}
        </div>
      </div>
      </div>
    </motion.div>
  );
}

// ─── Quest Row ────────────────────────────────────────────────────────────
/**
 * Ligne dense façon guide Sylvestre : icône du type → nom → PNJ (image nue
 * 24 px, nom en repli) → position copiable (+ zaap) → donjon(s) cliquable(s)
 * vers la fiche interne. Une seule ligne souple (`flex-wrap`), casse normale,
 * neutre sauf les états (à faire, verrou, bloqué, complété, « je suis ici »).
 */
export function QuestRow({ quest, isCompleted, isLast, isNext, isBlocked, isSelected, synergyForQuest = [], currentUser, prereqs = [], liveViewers = [], guildId = "", onFocusPrereq, onClick, onToggle }: {
  quest: any; color?: string; isCompleted: boolean; isLast: boolean; isNext: boolean; isBlocked: boolean; isSelected: boolean;
  synergyForQuest?: any[];
  currentUser?: { pseudo: string; image: string | null };
  prereqs?: { fromQuestId: string; name: string }[];
  liveViewers?: DofusPresenceMember[];
  guildId?: string;
  onFocusPrereq?: (questId: string) => void;
  onClick: () => void; onToggle: (status: DofusQuestStatus) => void;
}) {
  const isRenduIci = quest.status === "IN_PROGRESS";
  const renduMembers = useMemo(() => {
    const list = (synergyForQuest || []).filter((m: any) => m.status === "IN_PROGRESS");
    if (isRenduIci && currentUser && !list.some((m: any) => m.profileId === "__self__" || m.pseudo === currentUser.pseudo)) {
      list.push({ profileId: "__self__", pseudo: currentUser.pseudo, image: currentUser.image, status: "IN_PROGRESS" });
    }
    return list;
  }, [synergyForQuest, isRenduIci, currentUser]);
  const [showRendu, setShowRendu] = useState(false);
  return (
    <div className="relative pl-10 group">
      {!isLast && <div className="absolute left-[15px] top-5 bottom-0 w-0.5 bg-elevated/50 group-hover:bg-muted/50 transition-colors" />}
      <button onClick={() => !isBlocked && onToggle(isCompleted ? "NOT_STARTED" : "COMPLETED")}
        className={`absolute left-[9px] top-2 w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 ${
          isCompleted ? "bg-success border-success" :
          isNext ? "bg-info/20 border-info" :
          isBlocked ? "bg-surface border-border opacity-50" : "bg-surface border-border hover:border-border"
        }`}>
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-success" />}
      </button>
      <div id={`quest-${quest.id}`} onClick={onClick} className={`relative p-3 rounded-md border transition-all duration-200 cursor-pointer ${
        isRenduIci ? "bg-warning/10 border-warning/40" :
        isNext && !isCompleted ? "bg-info/[0.07] border-info/30" :
        isCompleted ? "bg-success/5 border-success/15" :
        isBlocked ? "bg-surface/20 border-border opacity-60" :
        isSelected ? "bg-surface/50 border-border-strong ring-1 ring-border-strong" : "bg-surface/30 border-border hover:border-border-strong"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {isBlocked && <Lock className="w-3 h-3 shrink-0 text-muted-foreground" />}
            {/* 1. icône du type de quête (image historique prioritaire, repli livre) */}
            {quest.localImageUrl && isSafeImageUrl(quest.localImageUrl) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={quest.localImageUrl} alt="" className="w-5 h-5 shrink-0 object-contain rounded" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (QUEST_TYPE_KEYS as readonly string[]).includes(quest.questType) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={questTypeIconPath(quest.questType)} alt="" className="w-5 h-5 shrink-0 object-contain" loading="lazy" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/assets/icons/icone-quete.png" alt="" className="w-5 h-5 shrink-0 object-contain opacity-80" loading="lazy" />
            )}
            {/* 2. nom (casse normale, comme le guide Sylvestre) */}
            <span className={`text-[13px] font-semibold leading-snug break-words min-w-0 ${isCompleted ? "text-success" : isBlocked ? "text-muted-foreground" : "text-foreground"}`}>{quest.name}</span>
            {/* 3. PNJ donneur : image nue 24 px, nom en repli */}
            {(() => {
              const npc = extractNpcRef(quest);
              if (!npc.name && npc.id === null) return null;
              return <NpcBadge npcId={npc.id} name={npc.name} imageUrl={npc.imageUrl} size="md" bare showNameFallback className="shrink-0" />;
            })()}
            {isNext && !isCompleted && (
              <span className="font-mono shrink-0 text-[11px] text-muted-foreground">à faire</span>
            )}
            {/* 4. position à copier (+ détour zaap éventuel) */}
            {Array.isArray(quest.positions) && quest.positions.length > 0 && Number.isSafeInteger(quest.positions[0]?.x) && Number.isSafeInteger(quest.positions[0]?.y) && (
              <span className="inline-flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={async (e) => { e.stopPropagation(); const cmd = `/travel ${quest.positions[0].x},${quest.positions[0].y}`; const ok = await copyToClipboard(cmd); if (ok) toast.success(`Copié : ${cmd}`); }} aria-label={`Copier /travel ${quest.positions[0].x},${quest.positions[0].y}`} title="Cliquer pour copier /travel" className="inline-flex cursor-pointer select-none items-center gap-1 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
                  <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />{quest.positions[0].x},{quest.positions[0].y}
                  <Copy className="w-3 h-3 shrink-0 opacity-60" />
                </button>
                {(quest.positions[0] as any)?.zaap && (() => {
                  const zm = (quest.positions[0] as any)?.zaap && typeof (quest.positions[0] as any).zaap === "object" && Number.isSafeInteger((quest.positions[0] as any).zaap?.x) && Number.isSafeInteger((quest.positions[0] as any).zaap?.y)
                    ? (quest.positions[0] as any).zaap : null;
                  return <ZaapCopyButton x={quest.positions[0].x} y={quest.positions[0].y} zaapX={zm?.x ?? null} zaapY={zm?.y ?? null} />;
                })()}
              </span>
            )}
            {/* 5. donjon(s) : icône cliquable vers la fiche interne */}
            {Array.isArray(quest.dungeonsRequired) && quest.dungeonsRequired.filter(Boolean).slice(0, 3).map((d: any, i: number) => {
              const href = dungeonFicheHref(guildId, typeof d === "object" ? d : null);
              const label = typeof d === "string" ? d : (d?.bossName || d?.name || "Donjon");
              const img = typeof d === "object" && d && isSafeImageUrl(d.imageUrl) ? String(d.imageUrl) : null;
              const icon = img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img} alt="" className="h-5 w-5 shrink-0 rounded object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <Skull className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              );
              const cls = "inline-flex shrink-0 items-center rounded-[3px] p-0.5 transition-colors hover:bg-elevated";
              return href ? (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={`Ouvrir la fiche boss de ${label}`} className={cls}>{icon}</a>
              ) : (
                <span key={i} title={label} className={cls}>{icon}</span>
              );
            })}
            {quest.zone && <span className="shrink-0 text-[11px] text-muted-foreground">{quest.zone}</span>}
            {quest.level ? <span className="shrink-0 font-mono text-[11px] text-muted-foreground">N{quest.level}</span> : null}
            {quest.isOptional && <span className="shrink-0 text-[11px] text-muted-foreground">Bonus</span>}
            {quest.isDungeon && !(Array.isArray(quest.dungeonsRequired) && quest.dungeonsRequired.filter(Boolean).length > 0) && (
              <span className="shrink-0 text-[11px] text-muted-foreground">Donjon</span>
            )}
            {liveViewers.length > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-success" title={`${liveViewers.map((v) => v.userName).join(", ")} regarde(nt) cette quête`}>
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> {liveViewers.length} en direct
              </span>
            )}
            {isBlocked && prereqs && prereqs.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFocusPrereq?.(prereqs[0].fromQuestId); }}
                title={`Prérequis : ${prereqs.map(p => p.name).join(" · ")}`}
                className="inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning text-caption font-bold hover:bg-warning/20 transition-colors"
              >
                <Lock className="w-2.5 h-2.5" />
                {prereqs.length > 1 ? `${prereqs.length} prérequis` : "1 prérequis"}
              </button>
            )}
            {renduMembers.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowRendu(true); }}
                title={`${renduMembers.length} membre${renduMembers.length > 1 ? "s" : ""} ici — clique pour voir`}
                className="flex shrink-0 items-center gap-1.5 group/av"
              >
                <span className="flex -space-x-1.5">
                  {renduMembers.slice(0, 4).map((m: any) => (
                    <span key={m.profileId} className="w-5 h-5 rounded-full border-2 border-background overflow-hidden bg-muted shrink-0">
                      {m.image ? <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" /> : <span className="text-caption font-bold text-muted-foreground flex items-center justify-center h-full">{m.pseudo?.[0]?.toUpperCase() || "?"}</span>}
                    </span>
                  ))}
                </span>
                <span className="text-[11px] font-semibold text-warning/80 group-hover/av:text-warning">
                  {renduMembers.length} membre{renduMembers.length > 1 ? "s" : ""} ici
                </span>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isBlocked && !isRenduIci) return;
                onToggle(isRenduIci ? "NOT_STARTED" : "IN_PROGRESS");
              }}
              title={
                isRenduIci
                  ? "Retirer mon repère \"Je suis ici\""
                  : isBlocked
                    ? "Prérequis non terminé — impossible de marquer cette quête"
                    : "Marquer que je suis ici (quête en cours)"
              }
              disabled={isBlocked && !isRenduIci}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-bold border transition-all ${
                isRenduIci
                  ? "bg-warning/15 border-warning/40 text-warning"
                  : isBlocked
                    ? "bg-surface border-border text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
              }`}
            >
              <Flag className={`w-2.5 h-2.5 ${isRenduIci ? "fill-current" : ""}`} />
              Je suis ici
            </button>
            <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isSelected ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>
      {showRendu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowRendu(false)}>
          <div className="w-full max-w-sm bg-background border border-border rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2"><Flag className="w-3.5 h-3.5 text-warning" /> Je suis ici</h4>
              <button onClick={() => setShowRendu(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-caption text-muted-foreground font-medium mb-3">Sur « {quest.name} »</p>
            <div className="space-y-2">
              {renduMembers.map((m: any) => (
                <div key={m.profileId} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/40 border border-border">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border shrink-0">
                    {m.image ? <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" /> : <span className="text-caption font-black text-muted-foreground flex items-center justify-center h-full">{m.pseudo?.[0]?.toUpperCase() || "?"}</span>}
                  </div>
                  <span className="text-xs font-bold text-foreground">{m.pseudo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Succès imbriqué ───────────────────────────────────────────────────────
/**
 * Succès du jeu contenant une série de succès (ou de quêtes) — « Le pays des
 * Vermeils » → « Même pas malle » → ses quêtes.
 *
 * Le bloc n'a pas d'état propre : sa progression et ses boutons portent sur les
 * quêtes de son sous-arbre (`collectSubtreeQuestIds`), donc valider le succès
 * revient exactement à valider ses objectifs, comme en jeu.
 */
function AchievementBlock({
  entry, tree, color, completedIds, onToggleStatus, renderQuest, depth = 0,
}: {
  entry: any;
  tree: QuestTree<any>;
  color: string;
  completedIds: Set<string>;
  onToggleStatus: (questId: string, status: DofusQuestStatus) => void;
  renderQuest: (entry: any, depth: number) => React.ReactNode;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const children = tree.childrenByParent.get(entry.id) ?? [];
  const progress = nodeProgress(tree, entry, completedIds);
  const questIds = collectSubtreeQuestIds(tree, entry.id);

  const handleValidateAll = () => {
    const missing = questIds.filter((id) => !completedIds.has(id));
    missing.forEach((id) => onToggleStatus(id, "COMPLETED" as DofusQuestStatus));
    if (missing.length > 0) toast.success(`${missing.length} objectif${missing.length > 1 ? "s" : ""} validé${missing.length > 1 ? "s" : ""}`);
  };

  const handleResetAll = () => {
    const done = questIds.filter((id) => completedIds.has(id));
    done.forEach((id) => onToggleStatus(id, "NOT_STARTED" as DofusQuestStatus));
    if (done.length > 0) toast.success(`${done.length} objectif${done.length > 1 ? "s" : ""} réinitialisé${done.length > 1 ? "s" : ""}`);
  };

  const isDone = progress.total > 0 && progress.completed === progress.total;

  return (
    <div className="rounded-md border border-border overflow-hidden bg-surface/20">
      <div className="flex items-center justify-between gap-3 p-3">
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-3 min-w-0 text-left">
          <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-surface border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/icone-succes.png" alt="" className="w-6 h-6 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3 h-3 shrink-0 text-warning" />
              <span className="text-[11px] font-semibold text-muted-foreground">Succès</span>
              {isDone && <CheckCircle2 className="w-3 h-3 text-success shrink-0" />}
            </span>
            <span className={`block truncate text-[13px] font-semibold ${isDone ? "text-success" : "text-foreground"}`}>{entry.name}</span>
          </span>
        </button>
        <span className="flex items-center gap-2 shrink-0">
          {progress.completed < progress.total && (
            <button type="button" onClick={() => handleValidateAll()}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-success text-caption font-bold hover:bg-success/20 transition-all">
              <CheckCircle2 className="w-3 h-3" /> Tout valider
            </button>
          )}
          {progress.completed > 0 && (
            <button type="button" onClick={() => handleResetAll()}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-danger/10 border border-danger/20 text-danger text-caption font-bold hover:bg-danger/20 transition-all">
              <RotateCcw className="w-3 h-3" /> Tout reset
            </button>
          )}
          <span className="text-caption font-semibold text-muted-foreground tabular-nums">{progress.completed}/{progress.total} objectifs</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </span>
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-3 pt-2 space-y-1 border-l-2 ml-4" style={{ borderColor: `${color}55` }}>
              {children.length === 0 ? (
                <p className="text-caption text-muted-foreground font-medium px-2 py-1.5">Aucun objectif renseigné.</p>
              ) : (
                children.map((child: any) => isAchievement(child)
                  ? <AchievementBlock key={child.id} entry={child} tree={tree} color={color} completedIds={completedIds}
                      onToggleStatus={onToggleStatus} renderQuest={renderQuest} depth={depth + 1} />
                  : renderQuest(child, depth + 1)
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Chain Section ────────────────────────────────────────────────────────
function ChainSection({ chain, color, completedIds, onToggleStatus, onQuestClick, expandedQuest, setExpandedQuest, guildId, synergy, currentUser, collapsed, onToggleCollapse, prereqsByQuestId, onFocusPrereq, presence }: {
  chain: any; color: string; completedIds: Set<string>; onToggleStatus: (q: string, s: DofusQuestStatus) => void;
  onQuestClick: (q: any) => void; expandedQuest: string | null; setExpandedQuest: (id: string | null) => void; guildId: string;
  synergy: Record<string, any[]>;
  currentUser?: { pseudo: string; image: string | null };
  collapsed: boolean; onToggleCollapse: (id: string) => void;
  prereqsByQuestId?: Record<string, { fromQuestId: string; name: string }[]>;
  onFocusPrereq?: (questId: string) => void;
  presence?: DofusPresenceMember[];
}) {
  const entries = chain.entries || [];
  // Succès imbriqués : l'arbre ne sert qu'à l'affichage et aux compteurs, qui
  // ignorent les succès conteneurs (ce ne sont pas des étapes jouables).
  const tree = useMemo(() => buildQuestTree<any>(entries), [entries]);
  const { completed: completedCount, total: totalQuestsInChain, percent: progress } = useMemo(
    () => questProgress(tree, completedIds),
    [tree, completedIds]
  );
  const firstNonCompletedQuestId = useMemo(
    () => tree.quests.find((e: any) => !completedIds.has(e.id))?.id ?? null,
    [tree, completedIds]
  );

  if (entries.length === 0) return null;

  const handleValidateAll = async () => {
    const missing = tree.quests.filter((e: any) => !completedIds.has(e.id));
    for (const e of missing) {
      onToggleStatus(e.id, "COMPLETED" as DofusQuestStatus);
    }
    if (missing.length > 0) toast.success(`${missing.length} quête${missing.length > 1 ? "s" : ""} validée${missing.length > 1 ? "s" : ""}`);
  };

  // #148 — « TOUT RESET » rouge à côté de « Tout valider »
  const handleResetAll = async () => {
    const done = tree.quests.filter((e: any) => completedIds.has(e.id));
    for (const e of done) {
      onToggleStatus(e.id, "NOT_STARTED" as DofusQuestStatus);
    }
    if (done.length > 0) toast.success(`${done.length} quête${done.length > 1 ? "s" : ""} réinitialisée${done.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="bg-surface/30 border border-border rounded-md overflow-hidden">
      <button type="button" onClick={() => onToggleCollapse(chain.id)} className="w-full flex items-center justify-between gap-3 p-3 bg-surface/40 hover:bg-surface/60 transition-all text-left">
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-surface border border-border">
            {(chain as any).sectionIcon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/assets/icons/${(chain as any).sectionIcon}.png`} alt="" className="w-6 h-6 object-contain" />
            ) : (
              <Layers className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-[13px] font-semibold text-foreground">{chain.sectionName}</span>
            <span className="block text-[11px] text-muted-foreground tabular-nums mt-0.5">{completedCount}/{totalQuestsInChain} • {progress}%</span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {completedCount < totalQuestsInChain && (
            <button type="button" onClick={(e) => { e.stopPropagation(); handleValidateAll(); }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-success text-caption font-bold hover:bg-success/20 transition-all">
              <CheckCircle2 className="w-3 h-3" /> Tout valider
            </button>
          )}
          {completedCount > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); handleResetAll(); }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-danger/10 border border-danger/20 text-danger text-caption font-bold hover:bg-danger/20 transition-all">
              <RotateCcw className="w-3 h-3" /> Tout reset
            </button>
          )}
          <span className="hidden sm:block w-20 h-1.5 rounded-full bg-elevated overflow-hidden">
            <span className="block h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: color }} />
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-3 pt-2 space-y-1">
              {(() => {
                // Rendu d'une quête (racine ou objectif d'un succès, au même niveau visuel).
                const renderQuest = (entry: any, depth = 0) => {
                  const isSelected = expandedQuest === entry.id;
                  const entryPrereqs = prereqsByQuestId?.[entry.id] || [];
                  const blockedByPrereqs = entryPrereqs.some((p) => !completedIds.has(p.fromQuestId));
                  const liveViewers = (presence || []).filter((p) => p.questId === entry.id);
                  return (
                    <div key={entry.id} style={depth > 0 ? { marginLeft: `${(depth - 1) * 12}px` } : undefined}>
                      <QuestRow quest={entry} color={color} isCompleted={completedIds.has(entry.id)}
                        isLast={entry.id === tree.quests[tree.quests.length - 1]?.id}
                        isNext={!completedIds.has(entry.id) && entry.id === firstNonCompletedQuestId} isBlocked={blockedByPrereqs}
                        isSelected={isSelected}
                        synergyForQuest={synergy[entry.id] || []}
                        currentUser={currentUser}
                        prereqs={entryPrereqs}
                        liveViewers={liveViewers}
                        guildId={guildId}
                        onFocusPrereq={onFocusPrereq}
                        onClick={() => { setExpandedQuest(isSelected ? null : entry.id); onQuestClick(entry); }}
                        onToggle={(s) => onToggleStatus(entry.id, s)} />
                      <AnimatePresence>
                        {isSelected && <QuestDetailInline quest={entry} color={color} isCompleted={completedIds.has(entry.id)} onToggle={(s) => onToggleStatus(entry.id, s)} liveViewers={liveViewers} guildId={guildId} />}
                      </AnimatePresence>
                    </div>
                  );
                };

                return tree.roots.map((entry: any) => isAchievement(entry)
                  ? <AchievementBlock key={entry.id} entry={entry} tree={tree} color={color} completedIds={completedIds}
                      onToggleStatus={onToggleStatus} renderQuest={renderQuest} />
                  : renderQuest(entry)
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Right Panel "QUI EST OÙ" ────────────────────────────────────────────
function QuiEstOuPanel({ synergy, guildName, currentUser, completedCount, totalQuests }: { synergy: Record<string, any[]>; guildName?: string; currentUser?: { pseudo: string; image: string | null }; completedCount: number; totalQuests: number }) {
  const userPct = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;

  const members = useMemo(() => {
    const map = new Map<string, { pseudo: string; image: string | null; pct: number }>();
    Object.entries(synergy).forEach(([, memberList]) => {
      memberList.forEach((m: any) => {
        if (!map.has(m.profileId)) {
          map.set(m.profileId, { pseudo: m.pseudo, image: m.image, pct: 0 });
        }
      });
    });
    // For other members, estimate from synergy data
    map.forEach((val, key) => {
      const entries = Object.values(synergy).flat().filter((m: any) => m.profileId === key);
      const total = entries.length;
      const done = entries.filter((m: any) => m.status === "COMPLETED").length;
      val.pct = total > 0 ? Math.round((done / total) * 100) : 0;
    });
    const result = Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
    // Add current user at top
    if (currentUser) {
      return [{ id: "__self__", pseudo: currentUser.pseudo, image: currentUser.image, pct: userPct }, ...result];
    }
    return result;
  }, [synergy, currentUser, userPct]);

  if (members.length === 0) return null;

  return (
    <div className="w-full lg:w-[280px] shrink-0 bg-background/40 border border-border rounded-3xl overflow-hidden self-start lg:sticky lg:top-4">
      <div className="p-5 border-b border-border bg-surface/20">
        <h3 className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Users className="w-3 h-3 text-success" />
          QUI EST OÙ
        </h3>
        {guildName && <p className="text-caption text-muted-foreground font-bold mt-1">{guildName}</p>}
      </div>
      <div className="p-3 space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/30 border border-border">
            <div className="w-8 h-8 rounded-full border-2 border-success/30 overflow-hidden bg-elevated shrink-0 flex items-center justify-center">
              {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover" /> : <span className="text-caption font-black text-muted-foreground">{m.pseudo?.[0]?.toUpperCase() || "?"}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{m.pseudo}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {[0,1,2,3,4].map(i => {
                  const threshold = (i + 1) * 20;
                  return (
                    <div key={i} className={`w-2 h-2 rounded-full border ${
                      m.pct >= threshold ? "bg-success border-success" :
                      m.pct >= threshold - 10 ? "bg-warning/50 border-warning/30" :
                      "bg-elevated border-border"
                    }`} />
                  );
                })}
                <span className="text-caption font-black text-muted-foreground ml-auto">{m.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 text-center">
        <p className="text-caption text-muted-foreground font-medium">{members.length} membre{members.length > 1 ? "s" : ""}</p>
        {currentUser && <p className="text-caption text-success/50 font-medium mt-0.5">En ligne</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export function DofusTimelineQuest({ guildId, dofus, chains, dofusColor, completedIds, onToggleStatus, synergy, currentUser, prereqsByQuestId = {}, presence = [], presenceConnected = false, onFocusedQuestChange, customSlotAfterPrerequisites }: DofusTimelineQuestProps) {
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [clickedQuestId, setClickedQuestId] = useState<string | null>(null);
  const [collapsedChains, setCollapsedChains] = useState<Set<string>>(new Set());

  const synergyMap = useMemo(() => synergy || {}, [synergy]);

  // #37 suite — nom de quête par id (tooltips de la présence live).
  const questNameById = useMemo(() => {
    const map = new Map<string, string>();
    chains.forEach((c: any) => (c.entries || []).forEach((e: any) => { if (e.id && e.name) map.set(e.id, e.name); }));
    return map;
  }, [chains]);

  const toggleChainCollapse = useCallback((id: string) => {
    setCollapsedChains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Focus sur une quête prérequis : déplie sa section, ouvre son détail et scroll dessus.
  const handleFocusPrereq = useCallback((questId: string) => {
    const chain = chains.find((c: any) => c.entries?.some((e: any) => e.id === questId));
    if (!chain) return;
    setCollapsedChains((prev) => {
      if (!prev.has(chain.id)) return prev;
      const next = new Set(prev);
      next.delete(chain.id);
      return next;
    });
    setExpandedQuest(questId);
    onFocusedQuestChange?.(questId);
    setTimeout(() => {
      document.getElementById(`quest-${questId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, [chains, onFocusedQuestChange]);

  // Succès imbriqués : seules les quêtes jouables comptent comme « étapes ».
  const totals = useMemo(() => {
    const quests = chains.flatMap((c: any) => buildQuestTree<any>(c.entries || []).quests);
    return {
      total: quests.length,
      completed: quests.filter((q: any) => completedIds.has(q.id)).length,
    };
  }, [chains, completedIds]);
  const totalQuests = totals.total;
  const completedQuests = totals.completed;
  const progressPercent = totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;

  const filteredChains = useMemo(() => {
    if (!searchQuery && !hideCompleted) return chains;
    const needle = searchQuery.toLowerCase();
    return chains.map((chain: any) => {
      // `filterTreeEntries` garde les succès parents d'un objectif retenu :
      // une quête trouvée par la recherche reste dans son succès.
      const entries = filterTreeEntries(chain.entries || [], (e: any) => {
        if (hideCompleted && completedIds.has(e.id)) return false;
        if (needle) return e.name.toLowerCase().includes(needle) || (e.zone || "").toLowerCase().includes(needle);
        return true;
      });
      return { ...chain, entries };
    }).filter((c: any) => c.entries.length > 0 || !hideCompleted);
  }, [chains, searchQuery, hideCompleted, completedIds]);

  const { prereqChains, mainChains } = useMemo(() => {
    const prereq: any[] = [];
    const main: any[] = [];
    filteredChains.forEach((c: any) => {
      if (c.sectionType === "PREREQUISITE") prereq.push(c);
      else main.push(c);
    });
    return { prereqChains: prereq, mainChains: main };
  }, [filteredChains]);

  const handleQuestToggle = (questId: string, status: DofusQuestStatus) => {
    onToggleStatus(questId, status);
    if (status === "COMPLETED") toast.success("Quête validée");
  };

  const handleQuestClick = (quest: any) => {
    const next = expandedQuest === quest.id ? null : quest.id;
    setExpandedQuest(next);
    onFocusedQuestChange?.(next);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6">
        {/* #37 suite — bandeau de présence live (qui est sur la page) */}
        {presenceConnected && presence.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 rounded-2xl border border-success/15 bg-success/5">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Temps réel" />
            <span className="text-caption font-black uppercase tracking-widest text-success shrink-0">Présence live</span>
            <div className="flex -space-x-1.5">
              {presence.map((m) => (
                <div
                  key={m.profileId}
                  title={m.questId ? `${m.userName} — ${questNameById.get(m.questId) || "parcourt la page"}` : m.userName}
                  className="w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted shrink-0"
                >
                  {m.userAvatar ? <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" /> : <span className="text-caption font-black text-muted-foreground flex items-center justify-center h-full">{m.userName?.[0]?.toUpperCase() || "?"}</span>}
                </div>
              ))}
            </div>
            <span className="text-caption text-muted-foreground font-medium">{presence.length} membre{presence.length > 1 ? "s" : ""} sur cette page</span>
          </div>
        )}

        {/* Barre de controle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 bg-background/40 border border-border rounded-2xl backdrop-blur-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher une quête..."
              className="w-full h-9 bg-muted/40 border border-border rounded-xl text-xs pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl shrink-0 border border-success/20" style={{ background: `${dofusColor}10` }}>
              <span className="text-sm text-success">{completedQuests}/{totalQuests}</span>
              <span className="text-caption font-black uppercase tracking-widest hidden sm:inline text-success/60">Étapes</span>
            </div>
            <div className="w-20 sm:w-28 h-1.5 rounded-full bg-elevated overflow-hidden hidden sm:block">
              <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">{progressPercent}%</span>
            <button onClick={() => setHideCompleted(!hideCompleted)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface/50 border border-border text-muted-foreground hover:text-foreground text-caption font-black uppercase tracking-widest transition-all" title={hideCompleted ? "Afficher" : "Masquer"}>
              {hideCompleted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{hideCompleted ? "Afficher" : "Masquer"}</span>
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {prereqChains.map((chain: any) => (
            <ChainSection key={chain.id} chain={chain} color={dofusColor} completedIds={completedIds}
              onToggleStatus={handleQuestToggle} onQuestClick={handleQuestClick}
              expandedQuest={expandedQuest} setExpandedQuest={setExpandedQuest} guildId={guildId} synergy={synergyMap} currentUser={currentUser}
              collapsed={collapsedChains.has(chain.id)} onToggleCollapse={toggleChainCollapse}
              prereqsByQuestId={prereqsByQuestId} onFocusPrereq={handleFocusPrereq} presence={presence} />
          ))}

          {customSlotAfterPrerequisites && (
            <div className="my-4">
              {customSlotAfterPrerequisites}
            </div>
          )}

          {mainChains.map((chain: any) => (
            <ChainSection key={chain.id} chain={chain} color={dofusColor} completedIds={completedIds}
              onToggleStatus={handleQuestToggle} onQuestClick={handleQuestClick}
              expandedQuest={expandedQuest} setExpandedQuest={setExpandedQuest} guildId={guildId} synergy={synergyMap} currentUser={currentUser}
              collapsed={collapsedChains.has(chain.id)} onToggleCollapse={toggleChainCollapse}
              prereqsByQuestId={prereqsByQuestId} onFocusPrereq={handleFocusPrereq} presence={presence} />
          ))}

          {filteredChains.length === 0 && !customSlotAfterPrerequisites && (
            <div className="text-center py-12 text-muted-foreground">
              <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold uppercase tracking-widest">{searchQuery ? "Aucune quête trouvée" : "Toutes les quêtes sont terminées !"}</p>
            </div>
          )}
        </div>

        <ScrollToTopButton />
      </div>

      {/* Panneau droit */}
      <QuiEstOuPanel synergy={synergyMap} guildName={dofus?.name} currentUser={currentUser}
        completedCount={completedQuests} totalQuests={totalQuests} />
    </div>
  );
}
