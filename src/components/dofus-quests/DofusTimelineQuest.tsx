"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2, Circle, ChevronDown,
  ExternalLink, MapPin, Sword, Package,
  ArrowUp, BookOpen, Skull, X,
  ChevronRight, Info, Layers, Users,
  Lock, Search, EyeOff, Eye, Crosshair, Flag, RotateCcw, Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusQuestStatus } from "@prisma/client";
import { toast } from "sonner";
import type { DofusPresenceMember } from "@/hooks/use-dofus-presence";

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
  /** #148 — pseudo Metamob du membre (liaison des donjons « non relié »). */
  metamobPseudo?: string | null;
  prereqsByQuestId?: Record<string, { fromQuestId: string; name: string }[]>;
  /** #37 suite — présence live WS de la page (membres + quête qu'ils regardent). */
  presence?: DofusPresenceMember[];
  presenceConnected?: boolean;
  onFocusedQuestChange?: (questId: string | null) => void;
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
function QuestDetailInline({ quest, color, isCompleted, onToggle, synergyForQuest, liveViewers = [], metamobPseudo = null, guildId = "" }: {
  quest: any; color: string; isCompleted: boolean; onToggle: (s: DofusQuestStatus) => void;
  synergyForQuest?: { profileId: string; pseudo: string; image: string | null; status: string }[];
  liveViewers?: DofusPresenceMember[];
  metamobPseudo?: string | null;
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
      <div className="p-4 bg-surface/40 border border-border rounded-2xl ml-0 space-y-3">
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-2">
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
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <span className="text-muted-foreground font-bold uppercase tracking-widest">Position de lancement</span>
          {quest.zone && <span className="text-muted-foreground font-medium">{quest.zone}</span>}
          {Array.isArray(quest.positions) && quest.positions.length > 0 ? (
            quest.positions.map((p: any, i: number) => (
              <span key={i} className="group/pos inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-success/25 bg-success/10 font-mono text-success font-bold" title="Cliquer pour copier /travel X,Y">
                <MapPin className="w-3 h-3 shrink-0" />{p.x},{p.y}
                <button onClick={() => { navigator.clipboard.writeText(`/travel ${p.x},${p.y}`); toast.success(`Copié : /travel ${p.x},${p.y}`); }} className="flex items-center gap-0.5 text-success/70 hover:text-success transition-colors" title="Copier /travel X,Y">
                  <Copy className="w-3 h-3" />
                  <span className="hidden group-hover/pos:inline text-caption font-black uppercase tracking-wider">Copier</span>
                </button>
              </span>
            ))
          ) : coords ? (
            <span className="group/pos inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-success/25 bg-success/10 font-mono text-success font-bold" title="Cliquer pour copier /travel X,Y">
              <MapPin className="w-3 h-3" />{coords.x},{coords.y}
              <button onClick={() => { navigator.clipboard.writeText(`/travel ${coords.x},${coords.y}`); toast.success(`Copié : /travel ${coords.x},${coords.y}`); }} className="flex items-center gap-0.5 text-success/70 hover:text-success transition-colors" title="Copier /travel X,Y">
                <Copy className="w-3 h-3" />
                <span className="hidden group-hover/pos:inline text-caption font-black uppercase tracking-wider">Copier</span>
              </button>
            </span>
          ) : null}
          {quest.level ? <span className="text-muted-foreground font-semibold">Niveau recommandé : {quest.level}</span> : null}
        </div>

        {/* Objectifs */}
        {objList.length > 0 && (
          <div className="text-caption text-foreground leading-relaxed space-y-0.5">
            {objList.slice(0, 3).map((t: string, i: number) => <p key={i} className="flex items-start gap-1.5"><span className="text-muted-foreground mt-0.5 shrink-0">•</span><span>{t}</span></p>)}
            {objList.length > 3 && <p className="text-muted-foreground italic text-caption">+{objList.length - 3} autres objectifs</p>}
          </div>
        )}

        {/* Items / Donjons */}
        <div className="flex flex-wrap gap-1.5">
          {items.map((it: any, i: number) => <span key={i} className="px-2 py-0.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold">{typeof it === "string" ? it : it.name || it}</span>)}
          {dungeons.map((d: any, i: number) => {
            const dungeonName = typeof d === "string" ? d : (d?.name || "");
            const dImg = typeof d === "object" && d ? (d.imageUrl || "") : "";
            return (
              <span key={i} className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-caption font-bold flex items-center gap-1.5">
                {dImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={dImg} alt="" className="w-4 h-4 object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : <Skull className="w-2 h-2" />}
                {dungeonName}
                {!metamobPseudo ? (
                  <a href={`/dashboard/${guildId}/profile`} className="text-amber-400/90 hover:text-amber-300 font-black uppercase tracking-wider text-caption" title="Lier Metamob pour voir les étapes du donjon">non relié</a>
                ) : (
                  <a href={`/dashboard/${guildId}/quetes-dofus/ocre`} className="text-emerald-400/90 hover:text-emerald-300 font-black uppercase tracking-wider text-caption" title="Voir les étapes metamob du donjon">étapes</a>
                )}
              </span>
            );
          })}
        </div>

        {/* Liens externes */}
        <div className="flex gap-2 pt-1 border-t border-border items-center">
          {quest.dofusdbId && <a href={`https://dofusdb.fr/fr/database/quest/${quest.dofusdbId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-info/10 border border-info/20 text-info text-caption font-bold hover:bg-info/20 transition-all"><img src="https://dofusdb.fr/favicon.ico" alt="" className="w-3 h-3 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> DofusDB</a>}
          {quest.externalRef && <a href={quest.externalRef} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold hover:bg-warning/20 transition-all"><img src="https://www.dofuspourlesnoobs.com/favicon.ico" alt="" className="w-3 h-3 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> Guide Noobs</a>}
          {quest.isDungeon && !quest.externalRef && (
            <button onClick={() => { const slug = (quest.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); window.open(`https://www.dofuspourlesnoobs.com/donjon-${slug}.html`, "_blank"); }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold hover:bg-warning/20 transition-all"><img src="https://www.dofuspourlesnoobs.com/favicon.ico" alt="" className="w-3 h-3 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> Guide Noobs</button>
          )}
          {/* Badge Prérequis si présent */}
          {quest.requirements && typeof quest.requirements === 'object' && (quest.requirements as any).npc && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-caption font-bold"><Info className="w-2.5 h-2.5" /> Prérequis: {(quest.requirements as any).npc}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Quest Row ────────────────────────────────────────────────────────────
function QuestRow({ quest, color, isCompleted, isLast, isNext, isBlocked, isSelected, synergyForQuest = [], currentUser, prereqs = [], liveViewers = [], onFocusPrereq, onClick, onToggle }: {
  quest: any; color: string; isCompleted: boolean; isLast: boolean; isNext: boolean; isBlocked: boolean; isSelected: boolean;
  synergyForQuest?: any[];
  currentUser?: { pseudo: string; image: string | null };
  prereqs?: { fromQuestId: string; name: string }[];
  liveViewers?: DofusPresenceMember[];
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
          isNext ? "bg-success/20 border-success" :
          isBlocked ? "bg-surface border-border opacity-50" : "bg-surface border-border hover:border-border"
        }`}>
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-success" />}
      </button>
      <div id={`quest-${quest.id}`} onClick={onClick} className={`relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isRenduIci ? "bg-warning/10 border-warning/40" :
        isNext && !isCompleted ? "bg-success/10 border-success/30" :
        isCompleted ? "bg-success/5 border-success/15" :
        isBlocked ? "bg-surface/20 border-border opacity-60" :
        isSelected ? "bg-surface/50 border-border-strong ring-2 ring-offset-2 ring-offset-[#0a0d14]" : "bg-surface/30 border-border hover:border-border-strong"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isNext && !isCompleted && <span className="text-caption font-black text-success bg-success/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">À FAIRE</span>}
              {isBlocked && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
              {/* #148 — icône de quête : image réelle si dispo, sinon livre générique (grossi) */}
              {quest.localImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={quest.localImageUrl} alt="" className="w-6 h-6 shrink-0 object-contain rounded" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src="/assets/icons/icone-quete.png" alt="" className="w-5 h-5 shrink-0 object-contain opacity-80" loading="lazy" />
              )}
              <span className={`text-xs font-bold leading-tight ${isCompleted ? "text-success" : isBlocked ? "text-muted-foreground" : "text-foreground"}`}>{quest.name}</span>
              {liveViewers.length > 0 && (
                <span className="flex items-center gap-1 text-caption font-black text-success bg-success/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider" title={`${liveViewers.map((v) => v.userName).join(", ")} regarde(nt) cette quête`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-success" /> {liveViewers.length} en direct
                </span>
              )}
              {quest.isDungeon && <span className="text-caption font-black text-danger bg-danger/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Donjon</span>}
              {quest.isOptional && <span className="text-caption font-black text-warning bg-warning/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Optionnel</span>}
              {quest.level && <span className="text-caption font-black text-muted-foreground">N{quest.level}</span>}
              {isBlocked && prereqs && prereqs.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onFocusPrereq?.(prereqs[0].fromQuestId); }}
                  title={`Prérequis : ${prereqs.map(p => p.name).join(" · ")}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning text-caption font-black uppercase tracking-wider hover:bg-warning/20 transition-colors"
                >
                  <Lock className="w-2.5 h-2.5" />
                  {prereqs.length > 1 ? `${prereqs.length} prérequis` : "1 prérequis"}
                </button>
              )}
              <button
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
                className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-caption font-black uppercase tracking-wider border transition-all ${
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
            </div>
            <div className="flex items-center gap-3 text-caption text-muted-foreground font-medium mt-1">
              {quest.zone && <span><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{quest.zone}</span>}
              {Array.isArray(quest.positions) && quest.positions.length > 0 && (
                <span className="group/pos inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-success/25 bg-success/10 font-mono text-success font-bold" title="Cliquer pour copier /travel X,Y">
                  <MapPin className="w-2.5 h-2.5" />{quest.positions[0].x},{quest.positions[0].y}
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`/travel ${quest.positions[0].x},${quest.positions[0].y}`); toast.success(`Copié : /travel ${quest.positions[0].x},${quest.positions[0].y}`); }} className="text-success/70 hover:text-success flex items-center gap-0.5 transition-colors" title="Copier /travel X,Y">
                    <Copy className="w-2.5 h-2.5" />
                    <span className="hidden group-hover/pos:inline text-caption font-black uppercase tracking-wider">Copier</span>
                  </button>
                </span>
              )}
              {quest.level ? <span className="font-semibold">Niveau reco. {quest.level}</span> : null}
              {quest.npcName && <span>{quest.npcName}</span>}
            </div>
            {renduMembers.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowRendu(true); }}
                title={`${renduMembers.length} membre${renduMembers.length > 1 ? "s" : ""} ici — clique pour voir`}
                className="flex items-center gap-1.5 mt-1.5 group/av"
              >
                <div className="flex -space-x-1.5">
                  {renduMembers.slice(0, 4).map((m: any) => (
                    <div key={m.profileId} className="w-5 h-5 rounded-full border-2 border-background overflow-hidden bg-muted shrink-0">
                      {m.image ? <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" /> : <span className="text-caption font-black text-muted-foreground flex items-center justify-center h-full">{m.pseudo?.[0]?.toUpperCase() || "?"}</span>}
                    </div>
                  ))}
                </div>
                <span className="text-caption font-bold text-warning/80 uppercase tracking-wider group-hover/av:text-warning">
                  {renduMembers.length} membre{renduMembers.length > 1 ? "s" : ""} ici
                </span>
              </button>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "rotate-90" : ""}`} style={{ color: isSelected ? color : undefined }} />
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

// ─── Chain Section ────────────────────────────────────────────────────────
function ChainSection({ chain, color, completedIds, onToggleStatus, onQuestClick, expandedQuest, setExpandedQuest, guildId, synergy, currentUser, collapsed, onToggleCollapse, prereqsByQuestId, onFocusPrereq, presence, metamobPseudo = null }: {
  chain: any; color: string; completedIds: Set<string>; onToggleStatus: (q: string, s: DofusQuestStatus) => void;
  onQuestClick: (q: any) => void; expandedQuest: string | null; setExpandedQuest: (id: string | null) => void; guildId: string;
  synergy: Record<string, any[]>;
  currentUser?: { pseudo: string; image: string | null };
  collapsed: boolean; onToggleCollapse: (id: string) => void;
  prereqsByQuestId?: Record<string, { fromQuestId: string; name: string }[]>;
  onFocusPrereq?: (questId: string) => void;
  presence?: DofusPresenceMember[];
  metamobPseudo?: string | null;
}) {
  const entries = chain.entries || [];
  const completedCount = entries.filter((e: any) => completedIds.has(e.id)).length;
  const progress = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0;

  if (entries.length === 0) return null;
  const firstNonCompletedIdx = entries.findIndex((e: any) => !completedIds.has(e.id));

  const handleValidateAll = async () => {
    const missing = entries.filter((e: any) => !completedIds.has(e.id));
    for (const e of missing) {
      onToggleStatus(e.id, "COMPLETED" as DofusQuestStatus);
    }
    if (missing.length > 0) toast.success(`${missing.length} quête${missing.length > 1 ? "s" : ""} validée${missing.length > 1 ? "s" : ""}`);
  };

  // #148 — « TOUT RESET » rouge à côté de « Tout valider »
  const handleResetAll = async () => {
    const done = entries.filter((e: any) => completedIds.has(e.id));
    for (const e of done) {
      onToggleStatus(e.id, "NOT_STARTED" as DofusQuestStatus);
    }
    if (done.length > 0) toast.success(`${done.length} quête${done.length > 1 ? "s" : ""} réinitialisée${done.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="bg-surface/30 border border-border rounded-3xl overflow-hidden">
      <button onClick={() => onToggleCollapse(chain.id)} className="w-full flex items-center justify-between p-5 bg-surface/40 hover:bg-surface/60 transition-all text-left">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
            {(chain as any).sectionIcon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/assets/icons/${(chain as any).sectionIcon}.png`} alt="" className="w-9 h-9 object-contain" />
            ) : (
              <Layers className="w-5 h-5" style={{ color }} />
            )}
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground uppercase tracking-tight">{chain.sectionName}</h3>
            <p className="text-caption text-muted-foreground font-medium mt-0.5">{completedCount}/{entries.length} • {progress}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedCount < entries.length && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); handleValidateAll(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleValidateAll(); } }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-caption font-black uppercase tracking-wider hover:bg-success/20 transition-all cursor-pointer">
              <CheckCircle2 className="w-3 h-3" /> Tout valider
            </span>
          )}
          {completedCount > 0 && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); handleResetAll(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleResetAll(); } }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-danger/10 border border-danger/20 text-danger text-caption font-black uppercase tracking-wider hover:bg-danger/20 transition-all cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Tout reset
            </span>
          )}
          <div className="hidden sm:block w-20 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </div>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-5 pt-2 space-y-1">
              {entries.map((entry: any, idx: number) => {
                const isSelected = expandedQuest === entry.id;
                const entryPrereqs = prereqsByQuestId?.[entry.id] || [];
                const blockedByPrereqs = entryPrereqs.some((p) => !completedIds.has(p.fromQuestId));
                const liveViewers = (presence || []).filter((p) => p.questId === entry.id);
                return (
                  <div key={entry.id}>
                    <QuestRow quest={entry} color={color} isCompleted={completedIds.has(entry.id)} isLast={idx === entries.length - 1}
                      isNext={!completedIds.has(entry.id) && idx === firstNonCompletedIdx} isBlocked={blockedByPrereqs}
                      isSelected={isSelected}
                      synergyForQuest={synergy[entry.id] || []}
                      currentUser={currentUser}
                      prereqs={entryPrereqs}
                      liveViewers={liveViewers}
                      onFocusPrereq={onFocusPrereq}
                      onClick={() => { setExpandedQuest(isSelected ? null : entry.id); onQuestClick(entry); }}
                      onToggle={(s) => onToggleStatus(entry.id, s)} />
                    <AnimatePresence>
                      {isSelected && <QuestDetailInline quest={entry} color={color} isCompleted={completedIds.has(entry.id)} onToggle={(s) => onToggleStatus(entry.id, s)} liveViewers={liveViewers} metamobPseudo={metamobPseudo} guildId={guildId} />}
                    </AnimatePresence>
                  </div>
                );
              })}
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
export function DofusTimelineQuest({ guildId, dofus, chains, dofusColor, completedIds, onToggleStatus, synergy, currentUser, metamobPseudo = null, prereqsByQuestId = {}, presence = [], presenceConnected = false, onFocusedQuestChange }: DofusTimelineQuestProps) {
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

  const totalQuests = useMemo(() => chains.reduce((acc: number, c: any) => acc + (c.entries?.length || 0), 0), [chains]);
  const completedQuests = useMemo(() => chains.reduce((acc: number, c: any) => acc + (c.entries?.filter((e: any) => completedIds.has(e.id)).length || 0), 0), [chains, completedIds]);
  const progressPercent = totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;

  const filteredChains = useMemo(() => {
    if (!searchQuery && !hideCompleted) return chains;
    return chains.map((chain: any) => {
      let entries = chain.entries || [];
      if (hideCompleted) entries = entries.filter((e: any) => !completedIds.has(e.id));
      if (searchQuery) entries = entries.filter((e: any) => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || (e.zone || "").toLowerCase().includes(searchQuery.toLowerCase()));
      return { ...chain, entries };
    }).filter((c: any) => c.entries.length > 0 || !hideCompleted);
  }, [chains, searchQuery, hideCompleted, completedIds]);

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
          {filteredChains.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold uppercase tracking-widest">{searchQuery ? "Aucune quête trouvée" : "Toutes les quêtes sont terminées !"}</p>
            </div>
          ) : filteredChains.map((chain: any) => (
            <ChainSection key={chain.id} chain={chain} color={dofusColor} completedIds={completedIds}
              onToggleStatus={handleQuestToggle} onQuestClick={handleQuestClick}
              expandedQuest={expandedQuest} setExpandedQuest={setExpandedQuest} guildId={guildId} synergy={synergyMap} currentUser={currentUser}
              collapsed={collapsedChains.has(chain.id)} onToggleCollapse={toggleChainCollapse}
              prereqsByQuestId={prereqsByQuestId} onFocusPrereq={handleFocusPrereq} presence={presence} metamobPseudo={metamobPseudo} />
          ))}
        </div>

        <ScrollToTopButton />
      </div>

      {/* Panneau droit */}
      <QuiEstOuPanel synergy={synergyMap} guildName={dofus?.name} currentUser={currentUser}
        completedCount={completedQuests} totalQuests={totalQuests} />
    </div>
  );
}
