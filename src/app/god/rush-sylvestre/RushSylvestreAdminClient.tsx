"use client";

import {
  useState, useTransition, useCallback, useEffect, useRef, useMemo
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverEvent
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Zap, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp,
  Settings, Construction, Check, X,
  Link2, Pencil, Layers, Sword, ExternalLink,
  BookOpen, AlertCircle, Info, GripVertical,
  Star, MapPin, Trophy, Sparkles, Gem, AlignLeft,
} from "lucide-react";
import {
  upsertRushMilestone,
  deleteRushMilestone,
  upsertRushSequence,
  deleteRushSequence,
  updateRushSylvestreSettings,
  reorderRushMilestones,
  reorderRushSequences,
} from "@/server/actions/optimized-guide-actions";
import { searchDungeonsLocal } from "@/server/actions/dofus-search-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type DungeonResult = { id: string; name: string; imageUrl?: string | null; level: number; bossName?: string };

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
  note: string | null;
  order: number;
  dungeonId?: string | null;
  dungeonIds?: string[];
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  tips?: string | null;
  alignReq?: string | null;
  alignOrderReq?: number | null;
  dungeon?: { id: string; name: string; bossName: string; imageUrl?: string | null } | null;
  isSuccess?: boolean;
  metamobMonsterId?: number | null;
  activityTags?: ActivityTag[];
};

type MilestoneType = "PREREQUIS" | "ALIGNEMENT" | "DOFUS" | "SUCCES" | "ZONE" | "QUETE_SERIE" | "DONJON";

type Milestone = {
  id: string;
  chapter: number;
  chapterLabel: string;
  title: string;
  description: string | null;
  accentColor: string | null;
  isOptional: boolean;
  order: number;
  tips?: string | null;
  dofusId?: string | null;
  type?: MilestoneType;
  sequences: Sequence[];
};

type Guide = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isUnderConstruction: boolean;
  displayMode: string;
  milestones: Milestone[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  { label: "Émeraude", value: "#10b981" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Ambre", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Orange", value: "#f97316" },
  { label: "Lime", value: "#84cc16" },
];

const MILESTONE_TYPES: { value: MilestoneType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "QUETE_SERIE", label: "Quêtes", icon: <BookOpen className="w-3 h-3" />, color: "#10b981" },
  { value: "PREREQUIS",  label: "Prérequis", icon: <Star className="w-3 h-3" />, color: "#f59e0b" },
  { value: "ALIGNEMENT", label: "Alignement", icon: <AlignLeft className="w-3 h-3" />, color: "#6366f1" },
  { value: "DOFUS",      label: "Dofus", icon: <Gem className="w-3 h-3" />, color: "#f43f5e" },
  { value: "SUCCES",     label: "Succès", icon: <Trophy className="w-3 h-3" />, color: "#f97316" },
  { value: "ZONE",       label: "Zone", icon: <MapPin className="w-3 h-3" />, color: "#06b6d4" },
  { value: "DONJON",     label: "Donjon", icon: <Sword className="w-3 h-3" />, color: "#8b5cf6" },
];

// Dofus du jeu
const DOFUS_LIST = [
  { id: "ocre",              label: "Ocre",               color: "#f59e0b", imageUrl: "/assets/icons/ocre.png" },
  { id: "turquoise",        label: "Turquoise",          color: "#06b6d4", imageUrl: "/module-dofus/Dofus_Turquoise.png" },
  { id: "argente",          label: "Argenté",            color: "#a1a1aa", imageUrl: "/module-dofus/Dofus_Argente.png" },
  { id: "argente_scintillant", label: "Arg. Scintillant", color: "#c0c0c0", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png" },
  { id: "ebene",            label: "Ébène",              color: "#27272a", imageUrl: "/module-dofus/Dofus_Ebene.png" },
  { id: "pourpre",          label: "Pourpre",            color: "#a855f7", imageUrl: "/module-dofus/Dofus_Pourpre.png" },
  { id: "ivoire",           label: "Ivoire",             color: "#e2e8f0", imageUrl: "/module-dofus/Dofus_Ivoire.png" },
  { id: "emeraude",         label: "Émeraude",           color: "#10b981", imageUrl: "/module-dofus/Dofus_Emeraude.png" },
  { id: "dolmanax",         label: "Dolmanax",           color: "#ef4444", imageUrl: "/module-dofus/Dofus_Dolmanax.png" },
  { id: "des_glaces",       label: "Des Glaces",         color: "#93c5fd", imageUrl: "/module-dofus/Dofus_Des_Glaces.png" },
  { id: "du_cauchemar",     label: "Du Cauchemar",       color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
  { id: "domakuro",         label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  { id: "dom_de_pin",       label: "Dom de Pin",         color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
];

// ─── Activity Tags ────────────────────────────────────────────────────────────
const ACTIVITY_TAGS: { type: ActivityTagType; imagePath: string; label: string; color: string; hasName?: boolean; hasLevel?: boolean }[] = [
  { type: "combat_tactique",    imagePath: "/assets/rush-sylvestre/combat-tactique.png",    label: "Combat Tactique", color: "#ef4444" },
  { type: "combat_vagues",      imagePath: "/assets/rush-sylvestre/combat-vagues.png",      label: "Vagues",          color: "#3b82f6" },
  { type: "songes",             imagePath: "/assets/rush-sylvestre/songes.png",             label: "Songes",          color: "#8b5cf6" },
  { type: "combat_solo",        imagePath: "/assets/rush-sylvestre/combat-solo.png",        label: "Combat Solo",     color: "#f43f5e" },
  { type: "combat_plusieurs",   imagePath: "/assets/rush-sylvestre/combat-plusieurs.png",   label: "Multi Combat",    color: "#a855f7" },
  { type: "contrainte_horaire", imagePath: "/assets/rush-sylvestre/contrainte-horaire.png", label: "Horaire Spec.",   color: "#f59e0b" },
  { type: "donjon",             imagePath: "/assets/rush-sylvestre/donjon.png",             label: "Donjon requis",   color: "#3b82f6" },
  { type: "plusieurs_personnes",imagePath: "/assets/rush-sylvestre/plusieurs-personnes.png",label: "Multi joueurs",   color: "#10b981" },
  { type: "sort",               imagePath: "/assets/rush-sylvestre/sort.png",               label: "Sort requis",     color: "#ec4899" },
  { type: "metier",             imagePath: "/assets/rush-sylvestre/façonneur.png",          label: "Métier requis",   color: "#eab308", hasName: true, hasLevel: true },
];

const DOFUS_METIERS = [
  "Alchimiste", "Bijoutier", "Bricoleur", "Bûcheron", "Chasseur", "Cordonnier",
  "Façonneur", "Forgeron", "Mineur", "Paysan", "Pêcheur", "Sculpteur", "Tailleur",
  "Cordomage", "Costumage", "Façomage", "Forgemage", "Joillomage", "Sculptemage"
];

function getMetierIconPath(metierName?: string) {
  if (!metierName) return "/assets/rush-sylvestre/façonneur.png";
  // Conversion en minuscule, sans accents, et remplacement du 'ç' par 'c'
  const normalized = metierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c");
  return `/assets/rush-sylvestre/${normalized}.png`;
}

function getMilestoneTypeInfo(type?: MilestoneType) {
  return MILESTONE_TYPES.find(t => t.value === type) ?? MILESTONE_TYPES[0];
}

function groupByChapter(milestones: Milestone[]) {
  const map = new Map<string, { chapterLabel: string; num: number; items: Milestone[] }>();
  for (const m of milestones) {
    const key = String(m.chapter);
    if (!map.has(key)) map.set(key, { chapterLabel: m.chapterLabel, num: m.chapter, items: [] });
    map.get(key)!.items.push(m);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => a.num - b.num)
    .map(([key, v]) => ({
      key,
      chapterLabel: v.chapterLabel,
      num: v.num,
      milestones: v.items.sort((a, b) => a.order - b.order),
    }));
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RushSylvestreAdminClient({ guide: initialGuide }: { guide: Guide }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(initialGuide.isActive);
  const [isUnderConstruction, setIsUnderConstruction] = useState(initialGuide.isUnderConstruction);

  // Local sortable milestones for optimistic DnD
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>(initialGuide.milestones as Milestone[]);
  useEffect(() => { setLocalMilestones(initialGuide.milestones as Milestone[]); }, [initialGuide.milestones]);

  const chapters = useMemo(() => groupByChapter(localMilestones), [localMilestones]);

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    const first = chapters[0]?.key;
    return first ? new Set([first]) : new Set();
  });
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "settings">("content");

  // New step form
  const [newChapterNum, setNewChapterNum] = useState<number>(chapters.length + 1);
  const [newChapterLabel, setNewChapterLabel] = useState("");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepColor, setNewStepColor] = useState("#10b981");
  const [newStepType, setNewStepType] = useState<MilestoneType>("QUETE_SERIE");
  const [newDofusId, setNewDofusId] = useState<string | null>(null);

  useEffect(() => {
    if (!addingStep) setNewChapterNum(chapters.length + 1);
  }, [chapters.length, addingStep]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMilestoneDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = localMilestones.findIndex(m => m.id === active.id);
    const overIndex = localMilestones.findIndex(m => m.id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const activeMs = localMilestones[activeIndex];
    const overMs = localMilestones[overIndex];

    // Si on survole un bloc dans un chapitre différent
    if (activeMs.chapter !== overMs.chapter) {
      setLocalMilestones(prev => {
        const updated = [...prev];
        const item = { ...updated[activeIndex], chapter: overMs.chapter, chapterLabel: overMs.chapterLabel };
        updated.splice(activeIndex, 1);
        updated.splice(overIndex, 0, item);
        return updated.map((m, idx) => ({ ...m, order: idx }));
      });
    }
  }, [localMilestones]);

  const handleMilestoneDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const oldIndex = localMilestones.findIndex(m => m.id === active.id);
    const newIndex = localMilestones.findIndex(m => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const targetMilestone = localMilestones[newIndex];
    const sourceMilestone = localMilestones[oldIndex];

    // Finaliser le tri
    const updatedMilestones = [...localMilestones];
    const [movedItem] = updatedMilestones.splice(oldIndex, 1);
    
    if (movedItem.chapter !== targetMilestone.chapter) {
      movedItem.chapter = targetMilestone.chapter;
      movedItem.chapterLabel = targetMilestone.chapterLabel;
    }

    updatedMilestones.splice(newIndex, 0, movedItem);
    const finalMilestones = updatedMilestones.map((m, idx) => ({
      ...m,
      order: idx
    }));

    setLocalMilestones(finalMilestones);

    startTransition(async () => {
      try {
        await reorderRushMilestones(finalMilestones.map(m => m.id));
        // Si le chapitre a changé, on persiste
        if (sourceMilestone.chapter !== targetMilestone.chapter) {
          await upsertRushMilestone({
            id: sourceMilestone.id,
            chapter: String(targetMilestone.chapter),
            chapterLabel: targetMilestone.chapterLabel,
            label: sourceMilestone.title,
            description: sourceMilestone.description ?? undefined,
            accentColor: sourceMilestone.accentColor ?? "#10b981",
            isOptional: sourceMilestone.isOptional,
            order: newIndex,
            tips: sourceMilestone.tips ?? undefined,
            dofusId: sourceMilestone.dofusId,
            type: sourceMilestone.type,
          });
        }
        router.refresh();
      } catch {
        toast.error("Erreur lors du réordonnancement du bloc");
      }
    });
  }, [localMilestones, router]);

  const handleMoveChapter = useCallback((chapterNum: number, direction: 'up' | 'down') => {
    // Récupérer tous les chapitres uniques et triés
    const uniqueChapters = Array.from(new Set(localMilestones.map(m => m.chapter))).sort((a, b) => a - b);
    const currentIdx = uniqueChapters.indexOf(chapterNum);
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    
    if (targetIdx < 0 || targetIdx >= uniqueChapters.length) return;
    const targetChapterNum = uniqueChapters[targetIdx];

    // Mettre à jour optimistement
    const finalMilestones = localMilestones.map(m => {
      if (m.chapter === chapterNum) {
        return { ...m, chapter: targetChapterNum, chapterLabel: `Chapitre ${targetChapterNum}` };
      }
      if (m.chapter === targetChapterNum) {
        return { ...m, chapter: chapterNum, chapterLabel: `Chapitre ${chapterNum}` };
      }
      return m;
    });

    setLocalMilestones(finalMilestones);

    startTransition(async () => {
      try {
        // Sauvegarder les modifications pour tous les milestones affectés
        const affected = finalMilestones.filter(m => m.chapter === chapterNum || m.chapter === targetChapterNum);
        for (const m of affected) {
          await upsertRushMilestone({
            id: m.id,
            chapter: String(m.chapter),
            chapterLabel: m.chapterLabel,
            label: m.title,
            description: m.description ?? undefined,
            accentColor: m.accentColor ?? "#10b981",
            isOptional: m.isOptional,
            order: m.order,
            tips: m.tips ?? undefined,
            dofusId: m.dofusId,
            type: m.type,
          });
        }
        router.refresh();
        toast.success("Chapitre déplacé ✓");
      } catch {
        toast.error("Erreur lors du déplacement du chapitre");
      }
    });
  }, [localMilestones, router]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddStep = useCallback(() => {
    if (!newStepTitle.trim()) { toast.error("Nom de l'étape requis"); return; }
    startTransition(async () => {
      try {
        await upsertRushMilestone({
          chapter: String(newChapterNum),
          chapterLabel: newChapterLabel.trim() || `Chapitre ${newChapterNum}`,
          label: newStepTitle.trim(),
          accentColor: newStepColor,
          order: localMilestones.length,
          type: newStepType,
          dofusId: newDofusId,
        });
        toast.success("Étape ajoutée ✓");
        setNewStepTitle(""); setNewChapterLabel(""); setNewDofusId(null); setAddingStep(false);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  }, [newChapterNum, newChapterLabel, newStepTitle, newStepColor, newStepType, newDofusId, localMilestones.length, router]);

  const handleSaveMilestone = useCallback((m: Milestone) => {
    startTransition(async () => {
      try {
        await upsertRushMilestone({
          id: m.id,
          chapter: String(m.chapter),
          chapterLabel: m.chapterLabel,
          label: m.title,
          description: m.description ?? undefined,
          accentColor: m.accentColor ?? "#10b981",
          isOptional: m.isOptional,
          order: m.order,
          tips: m.tips ?? undefined,
          dofusId: m.dofusId,
          type: m.type,
        });
        toast.success("Étape sauvegardée ✓");
        setEditingMilestone(null);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  }, [router]);

  const handleDeleteMilestone = useCallback((id: string) => {
    if (!confirm("Supprimer cette étape et toutes ses quêtes ?")) return;
    startTransition(async () => {
      try {
        await deleteRushMilestone(id);
        toast.success("Étape supprimée");
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  }, [router]);

  const handleSaveSequence = useCallback((data: any) => {
    startTransition(async () => {
      try {
        await upsertRushSequence(data);
        toast.success(data.id ? "Quête mise à jour ✓" : "Quête ajoutée ✓");
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  }, [router]);

  const handleDeleteSequence = useCallback((id: string) => {
    startTransition(async () => {
      try {
        await deleteRushSequence(id);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  }, [router]);

  const handleReorderSequences = useCallback((milestoneId: string, orderedIds: string[]) => {
    // Optimistic
    setLocalMilestones(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      const seqMap = new Map(m.sequences.map(s => [s.id, s]));
      return { ...m, sequences: orderedIds.map((id, i) => ({ ...seqMap.get(id)!, order: i })) };
    }));
    startTransition(async () => {
      try {
        await reorderRushSequences(milestoneId, orderedIds);
        router.refresh();
      } catch { toast.error("Erreur réordonnancement quêtes"); }
    });
  }, [router]);

  const handleToggle = useCallback((field: "isActive" | "isUnderConstruction") => {
    const next = field === "isActive" ? !isActive : !isUnderConstruction;
    if (field === "isActive") setIsActive(next); else setIsUnderConstruction(next);
    startTransition(async () => {
      try {
        await updateRushSylvestreSettings({ [field]: next });
        toast.success("Paramètre mis à jour ✓");
      } catch (e: any) {
        if (field === "isActive") setIsActive(!next); else setIsUnderConstruction(!next);
        toast.error(e.message);
      }
    });
  }, [isActive, isUnderConstruction]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60">ÉDITEUR GOD</p>
              <h1 className="text-lg font-black text-white italic">{initialGuide.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
              {isActive ? "Actif" : "Inactif"}
            </span>
            {isUnderConstruction && (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Construction className="w-2.5 h-2.5" /> En construction
              </span>
            )}
            <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-white/5">
              {(["content", "settings"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t === "content" ? <><Layers className="w-3 h-3 inline mr-1" />Contenu</> : <><Settings className="w-3 h-3 inline mr-1" />Config</>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {activeTab === "content" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-6 px-5 py-3 bg-zinc-900/60 border border-white/5 rounded-2xl">
              <StatPill label="Chapitres" value={chapters.length} />
              <div className="w-px h-8 bg-white/5" />
              <StatPill label="Blocs" value={localMilestones.length} />
              <div className="w-px h-8 bg-white/5" />
              <StatPill label="Quêtes" value={localMilestones.reduce((s, m) => s + m.sequences.length, 0)} />
              <div className="flex-1" />
              <button onClick={() => setAddingStep(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter un bloc
              </button>
            </div>

            {/* Dofus Configuration Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {DOFUS_LIST.map(d => {
                const linkedMilestones = localMilestones.filter(m => m.dofusId === d.id);
                const questCount = linkedMilestones.reduce((acc, m) => acc + m.sequences.length, 0);
                return (
                  <div key={d.id} className="p-3 bg-zinc-900/40 border border-white/5 rounded-2xl flex flex-col items-center text-center" style={{ borderColor: `${d.color}20` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.imageUrl} alt={d.label} className="w-10 h-10 object-contain mb-1 drop-shadow-lg" />
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: d.color }}>{d.label}</p>
                    <p className="text-xs font-bold text-white mt-1">{questCount} quête{questCount !== 1 ? 's' : ''}</p>
                    <p className="text-[9px] text-zinc-600">{linkedMilestones.length} bloc{linkedMilestones.length !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>

            {/* Add bloc form */}
            <AnimatePresence>
              {addingStep && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-4">
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">Nouveau bloc</h3>

                    {/* Type selector */}
                    <div>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Type de bloc</label>
                      <div className="flex flex-wrap gap-2">
                        {MILESTONE_TYPES.map(t => (
                          <button key={t.value} onClick={() => setNewStepType(t.value)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all ${newStepType === t.value ? "border-white/30 text-white bg-white/10" : "border-white/5 text-zinc-500 hover:text-zinc-300"}`}
                            style={newStepType === t.value ? { color: t.color, borderColor: t.color + "60", background: t.color + "15" } : {}}
                          >
                            {t.icon}{t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">N° chapitre *</label>
                        <input type="number" min={1} value={newChapterNum}
                          onChange={e => setNewChapterNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Label chapitre</label>
                        <input value={newChapterLabel} onChange={e => setNewChapterLabel(e.target.value)}
                          placeholder="ex: Incarnam & Astrub"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Nom du bloc *</label>
                      <input value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddStep()}
                        placeholder="ex: Quêtes Incarnam de base"
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50"
                        autoFocus
                      />
                    </div>

                    {/* Dofus selector (si type DOFUS) */}
                    {newStepType === "DOFUS" && (
                      <div>
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Dofus associé <span className="text-zinc-600">(clic pour sélectionner)</span></label>
                        <div className="flex flex-wrap gap-2">
                          {DOFUS_LIST.map(d => (
                            <button key={d.id} type="button"
                              onClick={() => setNewDofusId(prev => prev === d.id ? null : d.id)}
                              title={d.label}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                                newDofusId === d.id
                                  ? "border-white/40 scale-105"
                                  : "border-white/10 opacity-40 hover:opacity-80"
                              }`}
                              style={newDofusId === d.id ? { color: d.color, borderColor: d.color, background: d.color + "25" } : { borderColor: d.color + "40", background: d.color + "10" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={d.imageUrl} alt={d.label} className="w-5 h-5 object-contain" />
                              {d.label}
                            </button>
                          ))}
                        </div>
                        {newDofusId && (
                          <p className="mt-1.5 text-[9px] text-emerald-400/70">✓ Sélectionné : {DOFUS_LIST.find(d => d.id === newDofusId)?.label}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Couleur accent</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {COLOR_PALETTE.map(c => (
                          <button key={c.value} onClick={() => setNewStepColor(c.value)} title={c.label}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${newStepColor === c.value ? "border-white scale-125" : "border-transparent opacity-60 hover:opacity-100"}`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={handleAddStep} disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Créer
                      </button>
                      <button onClick={() => setAddingStep(false)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chapters wrapped in global DndContext */}
            {chapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/5 rounded-3xl">
                <Zap className="w-12 h-12 text-zinc-800 mb-4" />
                <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Aucun bloc — clique sur "Ajouter un bloc"</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleMilestoneDragOver} onDragEnd={handleMilestoneDragEnd}>
                <SortableContext items={localMilestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {chapters.map(({ key, chapterLabel, num, milestones: cms }, chapterIdx) => (
                      <div key={key} className="space-y-4">
                        {/* Séparation de Chapitre Élégante */}
                        {chapterIdx > 0 && (
                          <div className="flex items-center justify-center gap-4 py-4 my-2 select-none">
                            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent flex-1" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/50 flex items-center gap-1.5 italic font-mono">
                              ✦ Chapitre {num} ✦
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent flex-1" />
                          </div>
                        )}
                        <div className="border border-white/5 rounded-2xl overflow-hidden bg-zinc-900/10">
                          <div className="flex items-center bg-zinc-900/60 hover:bg-zinc-900 transition-colors">
                          {/* Boutons de déplacement chapitre */}
                          <div className="flex flex-col border-r border-white/5 px-1.5 py-1 gap-0.5">
                            <button
                              onClick={() => handleMoveChapter(num, 'up')}
                              disabled={chapterIdx === 0 || isPending}
                              className="p-1 rounded text-zinc-600 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                              title="Monter ce chapitre"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveChapter(num, 'down')}
                              disabled={chapterIdx === chapters.length - 1 || isPending}
                              className="p-1 rounded text-zinc-600 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                              title="Descendre ce chapitre"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          {/* Bouton collapse / expand */}
                          <button
                            onClick={() => setExpandedChapters(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                            className="flex-1 flex items-center justify-between px-5 py-3.5"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] font-black font-mono rounded tracking-widest border border-white/5">CH.{num}</span>
                              <span className="text-sm font-black text-white italic uppercase tracking-wide">{chapterLabel}</span>
                              <span className="text-[9px] text-zinc-600 font-bold">{cms.length} bloc{cms.length > 1 ? "s" : ""}</span>
                            </div>
                            {expandedChapters.has(key) ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedChapters.has(key) && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="divide-y divide-white/5">
                                {cms.map(m => (
                                  <SortableMilestoneRow
                                    key={m.id}
                                    milestone={m}
                                    isExpanded={expandedMilestones.has(m.id)}
                                    isEditing={editingMilestone?.id === m.id}
                                    editingData={editingMilestone?.id === m.id ? editingMilestone : null}
                                    isPending={isPending}
                                    onToggle={() => setExpandedMilestones(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
                                    onEdit={() => setEditingMilestone({ ...m })}
                                    onEditChange={patch => setEditingMilestone(prev => prev ? { ...prev, ...patch } : prev)}
                                    onSave={() => editingMilestone && handleSaveMilestone(editingMilestone)}
                                    onCancelEdit={() => setEditingMilestone(null)}
                                    onDelete={() => handleDeleteMilestone(m.id)}
                                    onSaveSequence={handleSaveSequence}
                                    onDeleteSequence={handleDeleteSequence}
                                    onReorderSequences={(ids) => handleReorderSequences(m.id, ids)}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        </div>
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-xl">
            <div className="p-6 bg-zinc-900/60 border border-white/5 rounded-2xl space-y-5">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Paramètres du guide</h2>
              <ToggleRow label="Guide actif" description="Rend le guide visible aux membres" value={isActive} onToggle={() => handleToggle("isActive")} disabled={isPending} color="emerald" />
              <div className="h-px bg-white/5" />
              <ToggleRow label="Mode Construction" description='Affiche le badge "En construction"' value={isUnderConstruction} onToggle={() => handleToggle("isUnderConstruction")} disabled={isPending} color="amber" />
              <div className="h-px bg-white/5" />
              <div className="p-3 bg-zinc-800/60 rounded-xl text-[10px] text-zinc-500 space-y-1">
                <p><span className="text-zinc-400 font-bold">Slug :</span> rush-sylvestre</p>
                <p><span className="text-zinc-400 font-bold">Mode :</span> TIMELINE</p>
                <p><span className="text-zinc-400 font-bold">URL membres :</span> /dashboard/[guildId]/quetes-dofus/guide/rush-sylvestre</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{label}</p>
    </div>
  );
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────
function ToggleRow({ label, description, value, onToggle, disabled, color }: { label: string; description: string; value: boolean; onToggle: () => void; disabled: boolean; color: "emerald" | "amber" }) {
  const on = color === "emerald" ? "bg-emerald-500 border-emerald-400" : "bg-amber-500 border-amber-400";
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-[10px] text-zinc-500">{description}</p>
      </div>
      <button onClick={onToggle} disabled={disabled}
        className={`relative w-12 h-6 rounded-full border transition-all disabled:opacity-50 ${value ? on : "bg-zinc-800 border-zinc-700"}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? "left-6" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ─── SortableMilestoneRow ─────────────────────────────────────────────────────
function SortableMilestoneRow(props: {
  milestone: Milestone;
  isExpanded: boolean;
  isEditing: boolean;
  editingData: Milestone | null;
  isPending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onEditChange: (patch: Partial<Milestone>) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSaveSequence: (data: any) => void;
  onDeleteSequence: (id: string) => void;
  onReorderSequences: (ids: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.milestone.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <MilestoneRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── MilestoneRow ─────────────────────────────────────────────────────────────
function MilestoneRow({
  milestone, isExpanded, isEditing, editingData, isPending,
  onToggle, onEdit, onEditChange, onSave, onCancelEdit, onDelete,
  onSaveSequence, onDeleteSequence, onReorderSequences, dragHandleProps,
}: {
  milestone: Milestone; isExpanded: boolean; isEditing: boolean;
  editingData: Milestone | null; isPending: boolean;
  onToggle: () => void; onEdit: () => void;
  onEditChange: (patch: Partial<Milestone>) => void;
  onSave: () => void; onCancelEdit: () => void; onDelete: () => void;
  onSaveSequence: (data: any) => void; onDeleteSequence: (id: string) => void;
  onReorderSequences: (ids: string[]) => void;
  dragHandleProps?: any;
}) {
  const color = milestone.accentColor || "#10b981";
  const typeInfo = getMilestoneTypeInfo(milestone.type);
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);

  // Dnd for sequences
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleSeqDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = milestone.sequences.map(s => s.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    onReorderSequences(arrayMove(ids, oldIdx, newIdx));
  };

  const dofusInfo = milestone.dofusId ? DOFUS_LIST.find(d => d.id === milestone.dofusId) : null;

  return (
    <div className="bg-zinc-950/40">
      <div className="flex items-center gap-2 px-4 py-2.5 group">
        {/* Drag handle */}
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0 touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Type badge */}
        <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center" style={{ background: typeInfo.color + "20", color: typeInfo.color }}>
          {typeInfo.icon}
        </div>

        {/* Color dot */}
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

        {isEditing ? (
          <div className="flex-1 space-y-2">
            {/* Type selector inline */}
            <div className="flex flex-wrap gap-1">
              {MILESTONE_TYPES.map(t => (
                <button key={t.value} onClick={() => onEditChange({ type: t.value })}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border transition-all"
                  style={(editingData?.type ?? milestone.type) === t.value
                    ? { color: t.color, borderColor: t.color + "60", background: t.color + "15" }
                    : { color: "#71717a", borderColor: "transparent" }
                  }
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input value={editingData?.title ?? ""} onChange={e => onEditChange({ title: e.target.value })}
                className="flex-1 min-w-[160px] bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Nom du bloc" autoFocus
              />
              <input value={editingData?.description ?? ""} onChange={e => onEditChange({ description: e.target.value })}
                className="flex-1 min-w-[160px] bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none focus:border-emerald-500/50"
                placeholder="Description (optionnel)"
              />
            </div>
            <textarea value={editingData?.tips ?? ""} onChange={e => onEditChange({ tips: e.target.value })}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-amber-300/80 focus:outline-none focus:border-amber-500/30 resize-none"
              placeholder="💡 Tips / Conseils pour ce bloc" rows={2}
            />
            {/* Dofus selector si type DOFUS */}
            {editingData?.type === "DOFUS" && (
              <div className="flex flex-wrap gap-1.5">
                {DOFUS_LIST.map(d => (
                  <button key={d.id} onClick={() => onEditChange({ dofusId: d.id })}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border transition-all ${editingData.dofusId === d.id ? "border-white/40" : "border-white/10 opacity-50 hover:opacity-100"}`}
                    style={{ color: d.color, borderColor: editingData.dofusId === d.id ? d.color : undefined, background: d.color + "15" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.imageUrl} alt={d.label} className="w-4 h-4 object-contain" />
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {COLOR_PALETTE.map(c => (
                  <button key={c.value} onClick={() => onEditChange({ accentColor: c.value })} title={c.label}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${(editingData?.accentColor ?? color) === c.value ? "border-white scale-125" : "border-transparent opacity-40 hover:opacity-100"}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={onSave} disabled={isPending} className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={onCancelEdit} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
              <span className="text-sm font-bold text-white truncate">{milestone.title}</span>
              {milestone.isOptional && <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold uppercase flex-shrink-0">opt.</span>}
              {dofusInfo && (
                <span className="flex items-center flex-shrink-0" title={dofusInfo.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dofusInfo.imageUrl} alt={dofusInfo.label} className="w-4 h-4 object-contain" />
                </span>
              )}
              {milestone.tips && (
                <span title={milestone.tips} className="flex-shrink-0">
                  <Info className="w-3 h-3 text-amber-400/60" />
                </span>
              )}
              <span className="text-[9px] text-zinc-600 flex-shrink-0">{milestone.sequences.length} quête{milestone.sequences.length !== 1 ? "s" : ""}</span>
              {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-600 ml-auto flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 ml-auto flex-shrink-0" />}
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={onEdit} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={onDelete} disabled={isPending} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </>
        )}
      </div>

      {/* Sequences */}
      <AnimatePresence>
        {isExpanded && !isEditing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pl-10 pr-4 pb-3 space-y-1.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSeqDragEnd}>
                <SortableContext items={milestone.sequences.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {milestone.sequences.map(seq => (
                    editingSeqId === seq.id ? (
                      <SequenceEditForm
                        key={seq.id}
                        seq={seq}
                        milestoneId={milestone.id}
                        isPending={isPending}
                        onSave={(data) => {
                          onSaveSequence({ ...data, id: seq.id, milestoneId: milestone.id });
                          setEditingSeqId(null);
                        }}
                        onCancel={() => setEditingSeqId(null)}
                      />
                    ) : (
                      <SortableSequenceRow
                        key={seq.id}
                        seq={seq}
                        color={color}
                        onEdit={() => setEditingSeqId(seq.id)}
                        onDelete={() => onDeleteSequence(seq.id)}
                      />
                    )
                  ))}
                </SortableContext>
              </DndContext>
              {editingSeqId === null && (
                <AddSequenceForm
                  milestoneId={milestone.id}
                  onAdd={(data) => onSaveSequence({ ...data, milestoneId: milestone.id })}
                  isPending={isPending}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SortableSequenceRow ──────────────────────────────────────────────────────
function SortableSequenceRow(props: { seq: Sequence; color: string; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.seq.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <SequenceRowAdmin {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── SequenceRowAdmin ─────────────────────────────────────────────────────────
function SequenceRowAdmin({ seq, color, onEdit, onDelete, dragHandleProps }: {
  seq: Sequence; color: string; onEdit: () => void; onDelete: () => void; dragHandleProps?: any;
}) {
  const hasCustomDb = !!seq.dofusdbUrl;
  const hasCustomNoobs = !!seq.dofuspourlesnoobsUrl;
  const dofusdbUrl = seq.dofusdbUrl || `https://dofusdb.fr/fr/database/quest?name=${encodeURIComponent(seq.subGuideName || seq.subGuideRef)}`;
  const noobsUrl = seq.dofuspourlesnoobsUrl || `https://www.dofuspourlesnoobs.com/?s=${encodeURIComponent(seq.subGuideName || seq.subGuideRef)}`;

  return (
    <div className="flex items-center gap-2 group/seq px-2 py-1.5 bg-zinc-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-500 flex-shrink-0 touch-none">
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Boss image(s) */}
      {seq.dungeon?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={seq.dungeon.imageUrl} alt={seq.dungeon.bossName} className="w-6 h-6 rounded object-cover flex-shrink-0 border border-white/10" />
      ) : seq.dungeon ? (
        <div className="w-6 h-6 rounded flex-shrink-0 bg-zinc-800 border border-white/10 flex items-center justify-center">
          <Sword className="w-3 h-3 text-zinc-500" />
        </div>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color + "80" }} />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-zinc-300 font-medium">{seq.subGuideName || seq.subGuideRef}</span>
          {seq.dungeon && <span className="text-[9px] text-zinc-500 italic">{seq.dungeon.name}</span>}
          {seq.alignReq && (
            <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {seq.alignReq}{seq.alignOrderReq ? ` lv.${seq.alignOrderReq}` : ""}
            </span>
          )}
          {seq.tips && (
            <span title={seq.tips} className="flex-shrink-0">
              <AlertCircle className="w-2.5 h-2.5 text-amber-400/60" />
            </span>
          )}
          {/* Rendu des tags d'activité réels */}
          {Array.isArray(seq.activityTags) && seq.activityTags.map((tag: any, idx: number) => {
            const def = ACTIVITY_TAGS.find(d => d.type === tag.type);
            if (!def) return null;
            const isMetier = tag.type === "metier";
            const iconPath = isMetier ? getMetierIconPath(tag.name) : def.imagePath;
            const label = isMetier && tag.name ? `${tag.name} (Niv. ${tag.level ?? 1})` : def.label;
            return (
              <span
                key={idx}
                title={label}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black bg-zinc-800 text-zinc-300 border border-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconPath} alt={def.label} className="w-3.5 h-3.5 object-contain" />
                {tag.count && tag.count > 1 && <span className="text-amber-400 font-mono text-[9px] ml-0.5">x{tag.count}</span>}
                {isMetier && tag.name && <span className="max-w-[70px] truncate">{tag.name} {tag.level ? `Niv.${tag.level}` : ""}</span>}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {hasCustomDb && <span className="text-[8px] text-emerald-400/60 font-bold flex items-center gap-0.5"><Link2 className="w-2 h-2" />DB✓</span>}
          {hasCustomNoobs && <span className="text-[8px] text-cyan-400/60 font-bold flex items-center gap-0.5"><Link2 className="w-2 h-2" />Noobs✓</span>}
          {seq.note && <span className="text-[8px] text-amber-400/60 italic truncate">{seq.note}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover/seq:opacity-100 transition-opacity flex-shrink-0">
        <a href={dofusdbUrl} target="_blank" rel="noreferrer"
          className={`px-1 py-0.5 text-[8px] font-black uppercase rounded transition-colors ${hasCustomDb ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-300"}`}
        ><BookOpen className="w-2.5 h-2.5 inline" /> DB</a>
        <a href={noobsUrl} target="_blank" rel="noreferrer"
          className={`px-1 py-0.5 text-[8px] font-black uppercase rounded transition-colors ${hasCustomNoobs ? "text-cyan-400" : "text-zinc-600 hover:text-zinc-300"}`}
        ><ExternalLink className="w-2.5 h-2.5 inline" /> Noobs</a>
        <button onClick={onEdit} className="p-1 text-zinc-600 hover:text-zinc-300 transition-all"><Pencil className="w-3 h-3" /></button>
        <button onClick={onDelete} className="p-1 text-zinc-600 hover:text-red-400 transition-all"><X className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

// ─── ActivityTagsEditor ───────────────────────────────────────────────────────
function ActivityTagsEditor({ tags, onChange }: {
  tags: ActivityTag[];
  onChange: (tags: ActivityTag[]) => void;
}) {
  const toggleTag = (type: ActivityTagType) => {
    const exists = tags.find(t => t.type === type);
    if (exists) {
      onChange(tags.filter(t => t.type !== type));
    } else {
      onChange([...tags, { type }]);
    }
  };

  const updateTag = (type: ActivityTagType, patch: Partial<ActivityTag>) => {
    onChange(tags.map(t => t.type === type ? { ...t, ...patch } : t));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_TAGS.map(def => {
          const active = tags.find(t => t.type === def.type);
          return (
            <button
              key={def.type}
              type="button"
              onClick={() => toggleTag(def.type)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                active
                  ? "border-white/30 text-white"
                  : "border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10"
              }`}
              style={active ? { color: def.color, borderColor: def.color + "50", background: def.color + "15" } : {}}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={def.imagePath} alt={def.label} className="w-4 h-4 object-contain" />
              {def.label}
            </button>
          );
        })}
      </div>

      {/* Champs spécifiques pour les tags actifs */}
      {tags.map(tag => {
        const def = ACTIVITY_TAGS.find(d => d.type === tag.type);
        if (!def) return null;
        const isMetier = tag.type === "metier";
        return (
          <div key={tag.type} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: def.color + "30", background: def.color + "08" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isMetier ? getMetierIconPath(tag.name) : def.imagePath} alt={def.label} className="w-4 h-4 object-contain flex-shrink-0" />
            
            {isMetier ? (
              <>
                <select
                  value={tag.name || ""}
                  onChange={e => updateTag(tag.type, { name: e.target.value })}
                  className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                >
                  <option value="">— Métier —</option>
                  {DOFUS_METIERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="number" min={1} max={200}
                  value={tag.level || ""}
                  onChange={e => updateTag(tag.type, { level: parseInt(e.target.value, 10) || undefined })}
                  className="w-20 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                  placeholder="Niv. min"
                />
              </>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{def.label}</span>
                <input
                  type="number" min={1} max={99}
                  value={tag.count || ""}
                  onChange={e => updateTag(tag.type, { count: parseInt(e.target.value, 10) || undefined })}
                  className="w-20 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none ml-auto"
                  placeholder="Quantité"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── SequenceEditForm ─────────────────────────────────────────────────────────
function SequenceEditForm({ seq, milestoneId, isPending, onSave, onCancel }: {
  seq: Sequence; milestoneId: string; isPending: boolean;
  onSave: (data: any) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(seq.subGuideName || seq.subGuideRef);
  const [dofusdbUrl, setDofusdbUrl] = useState(seq.dofusdbUrl || "");
  const [noobsUrl, setNoobsUrl] = useState(seq.dofuspourlesnoobsUrl || "");
  const [tips, setTips] = useState(seq.tips || "");
  const [alignReq, setAlignReq] = useState(seq.alignReq || "");
  const [alignOrderReq, setAlignOrderReq] = useState(seq.alignOrderReq ? String(seq.alignOrderReq) : "");
  const [note, setNote] = useState(seq.note || "");
  const [isSuccess, setIsSuccess] = useState(seq.isSuccess ?? false);
  const [metamobMonsterId, setMetamobMonsterId] = useState(seq.metamobMonsterId ? String(seq.metamobMonsterId) : "");
  const [activityTags, setActivityTags] = useState<ActivityTag[]>(
    Array.isArray(seq.activityTags) ? seq.activityTags as ActivityTag[] : []
  );
  const [selectedDungeons, setSelectedDungeons] = useState<DungeonResult[]>(
    seq.dungeon ? [{ id: seq.dungeon.id, name: seq.dungeon.name, level: 0, imageUrl: seq.dungeon.imageUrl, bossName: seq.dungeon.bossName }] : []
  );
  const [dungeonQuery, setDungeonQuery] = useState("");
  const [dungeonResults, setDungeonResults] = useState<DungeonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<any>(null);

  const handleDungeonSearch = (q: string) => {
    setDungeonQuery(q);
    if (q.length < 2) { setDungeonResults([]); return; }
    clearTimeout(searchRef.current);
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      const res = await searchDungeonsLocal(q);
      if (res.success) setDungeonResults(res.data as DungeonResult[]);
      setSearching(false);
    }, 300);
  };

  const addDungeon = (d: DungeonResult) => {
    if (!selectedDungeons.find(sd => sd.id === d.id)) {
      setSelectedDungeons(prev => [...prev, d]);
    }
    setDungeonQuery(""); setDungeonResults([]);
  };

  const removeDungeon = (id: string) => setSelectedDungeons(prev => prev.filter(d => d.id !== id));

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      subGuideRef: name.trim(),
      dungeonId: selectedDungeons[0]?.id ?? null,
      dungeonIds: selectedDungeons.map(d => d.id),
      dofusdbUrl: dofusdbUrl.trim() || null,
      dofuspourlesnoobsUrl: noobsUrl.trim() || null,
      tips: tips.trim() || null,
      alignReq: alignReq.trim() || null,
      alignOrderReq: alignOrderReq ? parseInt(alignOrderReq, 10) : null,
      note: note.trim() || undefined,
      isSuccess,
      metamobMonsterId: metamobMonsterId ? parseInt(metamobMonsterId, 10) : null,
      activityTags,
    });
  };

  return (
    <div className="p-3 bg-zinc-900/80 border border-indigo-500/20 rounded-xl space-y-2.5">
      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Édition quête</p>

      <div>
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Nom *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
          placeholder="Nom de la quête" autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">URL DofusDB</label>
          <input value={dofusdbUrl} onChange={e => setDofusdbUrl(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-emerald-300/80 focus:outline-none focus:border-emerald-500/40"
            placeholder="https://dofusdb.fr/fr/..."
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">URL DofusNoobs</label>
          <input value={noobsUrl} onChange={e => setNoobsUrl(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-cyan-300/80 focus:outline-none focus:border-cyan-500/40"
            placeholder="https://dofuspourlesnoobs.com/..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Alignement</label>
          <select value={alignReq} onChange={e => setAlignReq(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="">— Aucun —</option>
            <option value="bontarien">Bontarien</option>
            <option value="brakmarien">Brakmarien</option>
            <option value="neutre">Neutre</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Niveau ordre</label>
          <input type="number" min={0} max={100} value={alignOrderReq} onChange={e => setAlignOrderReq(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
            placeholder="0–100"
          />
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">💡 Tips</label>
        <textarea value={tips} onChange={e => setTips(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-amber-300/80 focus:outline-none focus:border-amber-500/30 resize-none"
          placeholder="Conseil affiché côté membre..." rows={2}
        />
      </div>

      <div>
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">⚠️ Note courte</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          placeholder="ex: Ne pas cliquer le portail !"
        />
      </div>

      {/* Tags d'activité */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">🏷️ Activités requises</label>
        <ActivityTagsEditor tags={activityTags} onChange={setActivityTags} />
      </div>

      {/* Badges spéciaux */}
      <div className="flex items-center gap-3 p-2.5 bg-zinc-950/60 rounded-xl border border-white/5">
        {/* Toggle Succès */}
        <button
          type="button"
          onClick={() => setIsSuccess(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
            isSuccess
              ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
              : "bg-zinc-800/60 border-white/10 text-zinc-600 hover:text-zinc-400"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/succès.png" alt="succès" className="w-3.5 h-3.5 object-contain" />
          Succès
        </button>

        {/* Metamob Ocre monster ID */}
        <div className="flex items-center gap-1.5 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/icons/ocre.png" alt="Ocre" className="w-4 h-4 object-contain flex-shrink-0" />
          <input
            type="number"
            value={metamobMonsterId}
            onChange={e => setMetamobMonsterId(e.target.value)}
            className="flex-1 bg-black/60 border border-amber-500/20 rounded-lg px-2 py-1 text-[10px] text-amber-300/80 focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-700"
            placeholder="ID monstre Metamob (Ocre)"
          />
        </div>
      </div>

      {/* Multi-donjons */}
      <div>
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block flex items-center gap-1">
          <Sword className="w-2.5 h-2.5 text-indigo-400" /> Donjons liés
        </label>
        {selectedDungeons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {selectedDungeons.map(d => (
              <div key={d.id} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                {d.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={d.imageUrl} alt={d.name} className="w-5 h-5 rounded object-cover" />
                  : <Sword className="w-3.5 h-3.5 text-indigo-400" />}
                <span className="text-[10px] font-bold text-white">{d.name}</span>
                <button onClick={() => removeDungeon(d.id)} className="text-zinc-500 hover:text-red-400">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input value={dungeonQuery} onChange={e => handleDungeonSearch(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/40"
          placeholder="Ajouter un donjon…"
        />
        {searching && <p className="text-[9px] text-zinc-600 italic mt-1">Recherche…</p>}
        {dungeonResults.length > 0 && (
          <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
            {dungeonResults.map(d => (
              <button key={d.id} onClick={() => addDungeon(d)}
                className="w-full flex items-center gap-2 px-2 py-1 hover:bg-indigo-500/10 rounded-lg transition-colors text-left"
              >
                {d.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={d.imageUrl} alt={d.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                  : <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0"><Sword className="w-2.5 h-2.5 text-zinc-600" /></div>}
                <p className="text-xs font-bold text-white">{d.name}</p>
                <p className="text-[9px] text-zinc-500">Niv. {d.level}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSubmit} disabled={isPending || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
        >
          <Check className="w-3 h-3" /> Sauvegarder
        </button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
        >Annuler</button>
      </div>
    </div>
  );
}

// ─── AddSequenceForm ──────────────────────────────────────────────────────────
function AddSequenceForm({ milestoneId, onAdd, isPending }: {
  milestoneId: string; onAdd: (data: any) => void; isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [dofusdbUrl, setDofusdbUrl] = useState("");
  const [noobsUrl, setNoobsUrl] = useState("");
  const [tips, setTips] = useState("");
  const [alignReq, setAlignReq] = useState("");
  const [alignOrderReq, setAlignOrderReq] = useState("");
  const [note, setNote] = useState("");
  const [activityTags, setActivityTags] = useState<ActivityTag[]>([]);
  const [selectedDungeons, setSelectedDungeons] = useState<DungeonResult[]>([]);
  const [dungeonQuery, setDungeonQuery] = useState("");
  const [dungeonResults, setDungeonResults] = useState<DungeonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<any>(null);

  const handleDungeonSearch = (q: string) => {
    setDungeonQuery(q);
    if (q.length < 2) { setDungeonResults([]); return; }
    clearTimeout(searchRef.current);
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      const res = await searchDungeonsLocal(q);
      if (res.success) setDungeonResults(res.data as DungeonResult[]);
      setSearching(false);
    }, 300);
  };

  const addDungeon = (d: DungeonResult) => {
    if (!selectedDungeons.find(sd => sd.id === d.id)) setSelectedDungeons(p => [...p, d]);
    setDungeonQuery(""); setDungeonResults([]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      subGuideRef: name.trim(),
      dungeonId: selectedDungeons[0]?.id ?? null,
      dungeonIds: selectedDungeons.map(d => d.id),
      dofusdbUrl: dofusdbUrl.trim() || null,
      dofuspourlesnoobsUrl: noobsUrl.trim() || null,
      tips: tips.trim() || null,
      alignReq: alignReq.trim() || null,
      alignOrderReq: alignOrderReq ? parseInt(alignOrderReq, 10) : null,
      note: note.trim() || undefined,
      activityTags,
    });
    setName(""); setDofusdbUrl(""); setNoobsUrl(""); setTips(""); setAlignReq("");
    setAlignOrderReq(""); setNote(""); setActivityTags([]); setSelectedDungeons([]); setDungeonQuery("");
    setExpanded(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) handleSubmit(); }}
          placeholder="Nom de la quête… (Entrée pour ajouter)"
          className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/30"
        />
        <button type="button" onClick={() => setExpanded(v => !v)} title="Options avancées"
          className={`p-1.5 rounded-xl border transition-all ${expanded ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : "bg-zinc-900 border-white/5 text-zinc-600 hover:text-zinc-300"}`}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleSubmit} disabled={isPending || !name.trim()}
          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-30 text-emerald-400 rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-3 bg-zinc-900/60 border border-indigo-500/10 rounded-xl space-y-2">
              <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest">Options avancées</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-zinc-600 mb-1 block">URL DofusDB</label>
                  <input value={dofusdbUrl} onChange={e => setDofusdbUrl(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-emerald-300/80 focus:outline-none"
                    placeholder="https://dofusdb.fr/fr/..."
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 mb-1 block">URL DofusNoobs</label>
                  <input value={noobsUrl} onChange={e => setNoobsUrl(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-cyan-300/80 focus:outline-none"
                    placeholder="https://dofuspourlesnoobs.com/..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-zinc-600 mb-1 block">Alignement</label>
                  <select value={alignReq} onChange={e => setAlignReq(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="">— Aucun —</option>
                    <option value="bontarien">Bontarien</option>
                    <option value="brakmarien">Brakmarien</option>
                    <option value="neutre">Neutre</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 mb-1 block">Niveau ordre</label>
                  <input type="number" min={0} max={100} value={alignOrderReq} onChange={e => setAlignOrderReq(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    placeholder="0–100"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 mb-1 block">🏷️ Activités requises</label>
                <ActivityTagsEditor tags={activityTags} onChange={setActivityTags} />
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 mb-1 block">💡 Tips</label>
                <textarea value={tips} onChange={e => setTips(e.target.value)}
                  className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-amber-300/70 focus:outline-none resize-none"
                  placeholder="Conseil pour le membre…" rows={2}
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 mb-1 block">⚠️ Note courte</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  placeholder="Note courte…"
                />
              </div>
              {/* Donjons */}
              <div>
                <label className="text-[9px] text-zinc-600 mb-1 block">⚔️ Donjons liés</label>
                {selectedDungeons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {selectedDungeons.map(d => (
                      <div key={d.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[9px] text-white font-bold">
                        {d.name}
                        <button onClick={() => setSelectedDungeons(p => p.filter(sd => sd.id !== d.id))} className="text-zinc-500 hover:text-red-400"><X className="w-2 h-2" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <input value={dungeonQuery} onChange={e => handleDungeonSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white placeholder:text-zinc-700 focus:outline-none"
                  placeholder="Ajouter un donjon…"
                />
                {searching && <p className="text-[9px] text-zinc-600 italic mt-0.5">Recherche…</p>}
                {dungeonResults.length > 0 && (
                  <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                    {dungeonResults.map(d => (
                      <button key={d.id} onClick={() => addDungeon(d)}
                        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-indigo-500/10 rounded text-left text-xs text-zinc-300"
                      >
                        {d.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={d.imageUrl} alt={d.name} className="w-4 h-4 rounded object-cover" />
                          : <Sword className="w-3 h-3 text-zinc-600" />}
                        {d.name} <span className="text-zinc-600">Niv.{d.level}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
