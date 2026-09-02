"use client";

import {
  useState, useTransition, useCallback, useEffect, useRef, useMemo
} from "react";
import { createPortal } from "react-dom";
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
  Star, MapPin, Trophy, Sparkles, Gem, AlignLeft, Lock, Search
} from "lucide-react";
import {
  upsertRushMilestone,
  deleteRushMilestone,
  upsertRushSequence,
  deleteRushSequence,
  updateRushSylvestreSettings,
  reorderRushMilestones,
  reorderRushSequences,
  seedRushSylvestreFromGuide,
} from "@/server/actions/optimized-guide-actions";
import { searchDungeonsLocal, searchGuideQuests, searchItemsLocalThenDofusDB } from "@/server/actions/dofus-search-actions";
import { DOFUS_WORLDS, DOFUS_JOBS } from "@/lib/dofus-assets";
import { resolveRushSeqIcon } from "@/lib/rush-guide-utils";
import { uploadImageFile } from "@/components/editor/utils/image-upload";
import { isSafeImageUrl, safeImageUrl } from "@/lib/security";
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
  | "metier"
  | "solver"
  | "quest_group"
  | "item";

type ActivityTag = { type: ActivityTagType; name?: string; level?: number; count?: number; color?: string; url?: string; id?: string; imageUrl?: string; quantity?: number };

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
  dungeons?: { id: string; name: string; bossName: string; imageUrl?: string | null }[];
  isSuccess?: boolean;
  icon?: string | null;
  metamobMonsterId?: number | null;
  activityTags?: ActivityTag[];
};

type MilestoneType = "PREREQUIS" | "ALIGNEMENT" | "DOFUS" | "SUCCES" | "ZONE" | "QUETE_SERIE" | "DONJON" | "INFO" | "SEPARATEUR" | "DOFUS_OBTAINED";

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
  { value: "INFO",       label: "Conseil / Tips", icon: <Sparkles className="w-3 h-3" />, color: "#ec4899" },
  { value: "SEPARATEUR", label: "Séparateur", icon: <Sparkles className="w-3 h-3" />, color: "#f59e0b" },
  { value: "DOFUS_OBTAINED", label: "Obtention Dofus", icon: <Gem className="w-3 h-3" />, color: "#d4a853" },
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
  { id: "des_veilleurs",    label: "Des Veilleurs",      color: "#38bdf8", imageUrl: "/module-dofus/Dofus_Veilleur.png" },
  { id: "domakuro",         label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  { id: "dorigami",         label: "Dorigami",           color: "#f472b6", imageUrl: "/module-dofus/Dofus_Dorigami.png" },
  { id: "tachete",          label: "Tacheté",            color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tachete.png" },
  { id: "dom_de_pin",       label: "Dom de Pin",         color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
];

// ─── Activity Tags ────────────────────────────────────────────────────────────
const ACTIVITY_TAGS: { type: ActivityTagType; imagePath: string; label: string; color: string; hasName?: boolean; hasLevel?: boolean; hasUrl?: boolean }[] = [
  { type: "combat_tactique",    imagePath: "/assets/rush-sylvestre/combat-tactique.png",    label: "Combat Tactique", color: "#ef4444" },
  { type: "combat_vagues",      imagePath: "/assets/rush-sylvestre/combat-vagues.png",      label: "Combat à vagues",          color: "#3b82f6" },
  { type: "songes",             imagePath: "/assets/rush-sylvestre/songes.png",             label: "Songes",          color: "#8b5cf6" },
  { type: "combat_solo",        imagePath: "/assets/rush-sylvestre/combat-solo.png",        label: "Combat Solo",     color: "#f43f5e" },
  { type: "combat_plusieurs",   imagePath: "/assets/rush-sylvestre/combat-plusieurs.png",   label: "Combat à plusieurs",    color: "#a855f7" },
  { type: "contrainte_horaire", imagePath: "/assets/rush-sylvestre/contrainte-horaire.png", label: "Horaire Spec.",   color: "#f59e0b", hasName: true },
  { type: "donjon",             imagePath: "/assets/rush-sylvestre/donjon.png",             label: "Donjon requis",   color: "#3b82f6" },
  { type: "plusieurs_personnes",imagePath: "/assets/rush-sylvestre/plusieurs-personnes.png",label: "Multi joueurs",   color: "#10b981" },
  { type: "sort",               imagePath: "/assets/rush-sylvestre/sort.png",               label: "Sort requis",     color: "#ec4899" },
  { type: "metier",             imagePath: "/assets/rush-sylvestre/façonneur.png",          label: "Métier requis",   color: "#eab308", hasName: true, hasLevel: true },
  { type: "solver",             imagePath: "/assets/rush-sylvestre/solver.png",             label: "Solver requis",   color: "#10b981", hasUrl: true },
  { type: "quest_group",        imagePath: "/assets/rush-sylvestre/group.png",              label: "À faire ensemble", color: "#f59e0b", hasName: true },
];

function getMilestoneTypeInfo(type?: MilestoneType) {
  return MILESTONE_TYPES.find(t => t.value === type) ?? MILESTONE_TYPES[0];
}

function isSeparatorMilestone(m: Pick<Milestone, "type">) {
  return m.type === "SEPARATEUR";
}

function isOutsideChapterMilestone(m: Pick<Milestone, "type">) {
  return m.type === "SEPARATEUR" || m.type === "DOFUS_OBTAINED" || m.type === "INFO";
}

function sortMilestonesByOrder(milestones: Milestone[]) {
  return [...milestones].sort((a, b) => a.order - b.order);
}

function countContentChapters(milestones: Milestone[]) {
  return new Set(
    milestones.filter((m) => !isSeparatorMilestone(m) && m.chapter > 0).map((m) => m.chapter),
  ).size;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RushSylvestreAdminClient({ guide: initialGuide }: { guide: Guide }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(initialGuide.isActive);
  const [isUnderConstruction, setIsUnderConstruction] = useState(initialGuide.isUnderConstruction);

  // Scroll to top/bottom state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Use a ref to self-reference for scroll detection
  const scrollRef = useRef<HTMLElement | Window>(null);

  useEffect(() => {
    // Find the scroll container: it's the parent of our component's root element
    // that has overflow-y-auto. The GOD layout wraps children in:
    // .flex-1.overflow-y-auto.scrollbar-thin
    // We need to skip the sidebar which has the same classes.
    const ourRoot = document.querySelector('[data-rush-admin-root]');
    const container = ourRoot?.closest('.flex-1.overflow-y-auto') as HTMLElement | null;
    if (!container) return;
    scrollRef.current = container;

    const handleScroll = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      setShowScrollTop(container.scrollTop > 100);
      setShowScrollBottom(container.scrollTop < maxScroll - 100);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Local sortable milestones for optimistic DnD
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>(initialGuide.milestones as Milestone[]);
  useEffect(() => { setLocalMilestones(initialGuide.milestones as Milestone[]); }, [initialGuide.milestones]);

  const sortedMilestones = useMemo(() => sortMilestonesByOrder(localMilestones), [localMilestones]);
  const chapterCount = useMemo(() => countContentChapters(localMilestones), [localMilestones]);

  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "settings">("content");
  const [importPreview, setImportPreview] = useState<null | { plan: { milestones: number; sequences: number; items: number; metiers: number; dungeons: number }; totalToCreate: number }>(null);
  const [importing, startImport] = useTransition();

  const runSeed = useCallback(async (apply: boolean) => {
    startImport(async () => {
      try {
        const res = await seedRushSylvestreFromGuide({ apply });
        if (res?.success) {
          if (apply) {
            toast.success(`Guide importé : ${res.created?.milestones ?? 0} jalons · ${res.created?.sequences ?? 0} quêtes`);
            setImportPreview(null);
            router.refresh();
          } else {
            setImportPreview(res as any);
          }
        } else {
          toast.error("Échec de l'import");
        }
      } catch (e) {
        toast.error("Erreur d'import");
      }
    });
  }, [router]);

  // New step form
  const [newChapterNum, setNewChapterNum] = useState<number>(1);
  const [newChapterLabel, setNewChapterLabel] = useState("");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepColor, setNewStepColor] = useState("#10b981");
  const [newStepType, setNewStepType] = useState<MilestoneType>("QUETE_SERIE");
  const [newDofusId, setNewDofusId] = useState<string | null>(null);

  useEffect(() => {
    if (!addingStep) setNewChapterNum(chapterCount + 1);
  }, [chapterCount, addingStep]);

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

    if (isSeparatorMilestone(activeMs) || isSeparatorMilestone(overMs)) {
      setLocalMilestones(prev => {
        const updated = [...prev];
        const [item] = updated.splice(activeIndex, 1);
        updated.splice(overIndex, 0, item);
        return updated.map((m, idx) => ({ ...m, order: idx }));
      });
      return;
    }

    // Si on survole un bloc dans un chapitre différent
    // INFO, DOFUS_OBTAINED etc. stay outside chapters — don't reassign
    if (activeMs.chapter !== overMs.chapter && !isOutsideChapterMilestone(activeMs)) {
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

    // INFO, DOFUS_OBTAINED, SEPARATEUR stay outside chapters — don't reassign
    if (!isOutsideChapterMilestone(movedItem) && !isOutsideChapterMilestone(targetMilestone) && movedItem.chapter !== targetMilestone.chapter) {
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
        if (!isOutsideChapterMilestone(sourceMilestone) && !isOutsideChapterMilestone(targetMilestone) && sourceMilestone.chapter !== targetMilestone.chapter) {
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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddStep = useCallback(() => {
    if (!newStepTitle.trim()) { toast.error(newStepType === "SEPARATEUR" ? "Titre de section requis" : "Nom de l'étape requis"); return; }
    const isSeparator = newStepType === "SEPARATEUR";
    const isDofusBanner = newStepType === "DOFUS_OBTAINED";
    const isInfoBlock = newStepType === "INFO";
    const isOutsideChapter = isSeparator || isDofusBanner || isInfoBlock;
    startTransition(async () => {
      try {
        await upsertRushMilestone({
          chapter: isOutsideChapter ? "0" : String(newChapterNum),
          chapterLabel: isOutsideChapter ? "" : (newChapterLabel.trim() || `Chapitre ${newChapterNum}`),
          label: newStepTitle.trim(),
          accentColor: isOutsideChapter ? (newStepColor || "#d4a853") : newStepColor,
          order: localMilestones.length,
          type: newStepType,
          dofusId: isSeparator ? null : newDofusId,
        });
        toast.success(isSeparator ? "Séparateur ajouté ✓" : isDofusBanner ? "Bannière Dofus ajoutée ✓" : "Étape ajoutée ✓");
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
          chapter: String(isOutsideChapterMilestone(m) ? 0 : m.chapter),
          chapterLabel: isOutsideChapterMilestone(m) ? "" : m.chapterLabel,
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
    <div className="min-h-screen bg-zinc-950 text-white" data-rush-admin-root>
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-caption font-black uppercase tracking-widest text-emerald-400/60">ÉDITEUR GOD</p>
              <h1 className="text-lg font-black text-white italic">{initialGuide.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-widest border ${isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
              {isActive ? "Actif" : "Inactif"}
            </span>
            {isUnderConstruction && (
              <span className="px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Construction className="w-2.5 h-2.5" /> En construction
              </span>
            )}
            <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-white/5">
              {(["content", "settings"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-caption font-black uppercase tracking-widest transition-all ${activeTab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t === "content" ? <><Layers className="w-3 h-3 inline mr-1" />Contenu</> : <><Settings className="w-3 h-3 inline mr-1" />Config</>}
                </button>
              ))}
            </div>
            <button onClick={() => runSeed(false)} disabled={importing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-caption font-black uppercase tracking-widest bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 transition-all disabled:opacity-50"
              title="Importer le guide Laniyelle (métiers, ressources, donjons)">
              <Sparkles className="w-3 h-3" /> Importer
            </button>
          </div>
        </div>
      </div>

      {/* Modal d'aperçu d'import */}
      <AnimatePresence>
        {importPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setImportPreview(null)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-base font-black text-white">Importer le guide Laniyelle</h3>
              </div>
              <p className="text-sm text-zinc-400">Aperçu (aucune écriture). L'import est <b>non destructif</b> : il ne crée que les jalons/quêtes absents.</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <PreviewStat label="Jalons" value={importPreview.plan.milestones} />
                <PreviewStat label="Quêtes" value={importPreview.plan.sequences} />
                <PreviewStat label="Donjons" value={importPreview.plan.dungeons} />
                <PreviewStat label="Objets" value={importPreview.plan.items} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setImportPreview(null)} disabled={importing}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-white/10 transition-all">Annuler</button>
                <button onClick={() => runSeed(true)} disabled={importing}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50">
                  {importing ? "Import…" : "Appliquer"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 relative">
        {activeTab === "content" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-6 px-5 py-3 bg-zinc-900/60 border border-white/5 rounded-2xl">
              <StatPill label="Chapitres" value={chapterCount} />
              <div className="w-px h-8 bg-white/5" />
              <StatPill label="Blocs" value={localMilestones.filter((m) => !isSeparatorMilestone(m)).length} />
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
                    <p className="text-caption font-black uppercase tracking-widest" style={{ color: d.color }}>{d.label}</p>
                    <p className="text-xs font-bold text-white mt-1">{questCount} quête{questCount !== 1 ? 's' : ''}</p>
                    <p className="text-caption text-zinc-600">{linkedMilestones.length} bloc{linkedMilestones.length !== 1 ? 's' : ''}</p>
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
                      <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-2 block">Type de bloc</label>
                      <div className="flex flex-wrap gap-2">
                        {MILESTONE_TYPES.map(t => (
                          <button key={t.value} onClick={() => {
                            setNewStepType(t.value);
                            if (t.value === "SEPARATEUR") setNewStepColor("#d4a853");
                          }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-caption font-black border transition-all ${newStepType === t.value ? "border-white/30 text-white bg-white/10" : "border-white/5 text-zinc-500 hover:text-zinc-300"}`}
                            style={newStepType === t.value ? { color: t.color, borderColor: t.color + "60", background: t.color + "15" } : {}}
                          >
                            {t.icon}{t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newStepType !== "SEPARATEUR" && newStepType !== "DOFUS_OBTAINED" && newStepType !== "INFO" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">N° chapitre *</label>
                        <input type="number" min={1} value={newChapterNum}
                          onChange={e => setNewChapterNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">Label chapitre</label>
                        <input value={newChapterLabel} onChange={e => setNewChapterLabel(e.target.value)}
                          placeholder="ex: Incarnam & Astrub"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    ) : newStepType === "INFO" ? (
                      <p className="text-caption text-purple-400/70 leading-relaxed">
                        Le bloc Conseil/Tips est un bandeau informatif autonome — il n'appartient à aucun chapitre et peut être déplacé librement entre les quêtes.
                      </p>
                    ) : newStepType === "SEPARATEUR" ? (
                      <p className="text-caption text-amber-400/70 leading-relaxed">
                        Le séparateur est un titre visuel entre les blocs — il n'appartient à aucun chapitre.
                      </p>
                    ) : (
                      <p className="text-caption text-amber-400/70 leading-relaxed">
                        La bannière d'obtention est un bloc visuel autonome — il n'appartient à aucun chapitre et n'est pas cochable.
                      </p>
                    )}
                    <div>
                      <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">
                        {newStepType === "SEPARATEUR" ? "Titre de section *" : "Nom du bloc *"}
                      </label>
                      <input value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddStep()}
                        placeholder={newStepType === "SEPARATEUR" ? "ex: Dofus Turquoise" : "ex: Quêtes Incarnam de base"}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50"
                        autoFocus
                      />
                    </div>

                    {/* Dofus selector (si type DOFUS ou DOFUS_OBTAINED) */}
                    {(newStepType === "DOFUS" || newStepType === "DOFUS_OBTAINED") && (
                      <div>
                        <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-2 block">Dofus associé <span className="text-zinc-600">(clic pour sélectionner)</span></label>
                        <div className="flex flex-wrap gap-2">
                          {DOFUS_LIST.map(d => (
                            <button key={d.id} type="button"
                              onClick={() => setNewDofusId(prev => prev === d.id ? null : d.id)}
                              title={d.label}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-caption font-black border transition-all ${
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
                          <p className="mt-1.5 text-caption text-emerald-400/70">✓ Sélectionné : {DOFUS_LIST.find(d => d.id === newDofusId)?.label}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-2 block">Couleur accent</label>
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

            {/* Liste ordonnée (séparateurs + blocs) */}
            {localMilestones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/5 rounded-3xl">
                <Zap className="w-12 h-12 text-zinc-800 mb-4" />
                <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Aucun bloc — clique sur &quot;Ajouter un bloc&quot;</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleMilestoneDragOver} onDragEnd={handleMilestoneDragEnd}>
                <SortableContext items={localMilestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {sortedMilestones.map((m, index) => {
                      const prevContent = sortedMilestones.slice(0, index).reverse().find((item) => !isSeparatorMilestone(item));
                      const showChapterLabel = !isSeparatorMilestone(m) && (!prevContent || prevContent.chapter !== m.chapter);

                      return (
                        <div key={m.id} className="space-y-2">
                          {showChapterLabel && (
                            <div className="flex items-center gap-2 pt-2 pb-1 px-1">
                              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-caption font-black font-mono rounded tracking-widest border border-white/5">
                                CH.{m.chapter}
                              </span>
                              <span className="text-xs font-black text-zinc-400 uppercase tracking-wide">{m.chapterLabel}</span>
                            </div>
                          )}
                          {isSeparatorMilestone(m) ? (
                            <SortableSeparatorRow
                              milestone={m}
                              isEditing={editingMilestone?.id === m.id}
                              editingData={editingMilestone?.id === m.id ? editingMilestone : null}
                              isPending={isPending}
                              onEdit={() => setEditingMilestone({ ...m })}
                              onEditChange={(patch) => setEditingMilestone((prev) => prev ? { ...prev, ...patch } : prev)}
                              onSave={() => editingMilestone && handleSaveMilestone(editingMilestone)}
                              onCancelEdit={() => setEditingMilestone(null)}
                              onDelete={() => handleDeleteMilestone(m.id)}
                            />
                          ) : (
                            <div className="border border-white/5 rounded-2xl overflow-hidden bg-zinc-900/10">
                              <SortableMilestoneRow
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
                            </div>
                          )}
                        </div>
                      );
                    })}
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
              <div className="p-3 bg-zinc-800/60 rounded-xl text-caption text-zinc-500 space-y-1">
                <p><span className="text-zinc-400 font-bold">Slug :</span> rush-sylvestre</p>
                <p><span className="text-zinc-400 font-bold">Mode :</span> TIMELINE</p>
                <p><span className="text-zinc-400 font-bold">URL membres :</span> /dashboard/[guildId]/quetes-dofus/guide/rush-sylvestre</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      {/* Navigation flottante — pilule verticale */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="fixed right-4 z-[999999] flex flex-col items-center gap-1 bg-zinc-950/90 border border-emerald-500/20 rounded-2xl py-2 px-1.5 shadow-2xl backdrop-blur-md"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <button
            onClick={() => {
              const container = document.querySelector<HTMLElement>('.flex-1.overflow-y-auto');
              if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={!showScrollTop}
            className={`p-2 rounded-xl transition-all ${showScrollTop ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Haut"
            aria-label="Haut"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const container = document.querySelector<HTMLElement>('.flex-1.overflow-y-auto');
              if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
              else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            }}
            disabled={!showScrollBottom}
            className={`p-2 rounded-xl transition-all ${showScrollBottom ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Bas"
            aria-label="Bas"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-caption text-zinc-500 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-zinc-800/70 border border-white/10">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-caption text-zinc-500 uppercase tracking-widest">{label}</p>
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
        <p className="text-caption text-zinc-500">{description}</p>
      </div>
      <button onClick={onToggle} disabled={disabled}
        className={`relative w-12 h-6 rounded-full border transition-all disabled:opacity-50 ${value ? on : "bg-zinc-800 border-zinc-700"}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? "left-6" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ─── SortableSeparatorRow ─────────────────────────────────────────────────────
function SortableSeparatorRow(props: {
  milestone: Milestone;
  isEditing: boolean;
  editingData: Milestone | null;
  isPending: boolean;
  onEdit: () => void;
  onEditChange: (patch: Partial<Milestone>) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.milestone.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <SeparatorRowAdmin {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function SeparatorRowAdmin({
  milestone,
  isEditing,
  editingData,
  isPending,
  onEdit,
  onEditChange,
  onSave,
  onCancelEdit,
  onDelete,
  dragHandleProps,
}: {
  milestone: Milestone;
  isEditing: boolean;
  editingData: Milestone | null;
  isPending: boolean;
  onEdit: () => void;
  onEditChange: (patch: Partial<Milestone>) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
}) {
  const color = milestone.accentColor || "#d4a853";

  return (
    <div className="group rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0 touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color }} />

        {isEditing ? (
          <div className="flex-1 space-y-2">
            <input
              value={editingData?.title ?? ""}
              onChange={(e) => onEditChange({ title: e.target.value })}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 font-[family-name:var(--font-cinzel)] uppercase tracking-wider"
              placeholder="Titre de section"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onEditChange({ accentColor: c.value })}
                    title={c.label}
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
            <div className="flex-1 min-w-0 py-1">
              <p className="text-caption font-black uppercase tracking-widest text-amber-400/60 mb-1">Séparateur</p>
              <p
                className="font-[family-name:var(--font-cinzel)] text-sm sm:text-base font-bold uppercase tracking-[0.14em] truncate"
                style={{ color, textShadow: `0 0 18px ${color}30` }}
              >
                {milestone.title}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={onEdit} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={onDelete} disabled={isPending} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </>
        )}
      </div>
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
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-caption font-black border transition-all"
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
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-caption font-black border transition-all ${editingData.dofusId === d.id ? "border-white/40" : "border-white/10 opacity-50 hover:opacity-100"}`}
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
              {/* Preview icon for INFO blocks */}
              {(editingData?.type ?? milestone.type) === "INFO" && (() => {
                const ac = editingData?.accentColor ?? milestone.accentColor;
                let icon = "💡";
                if (ac) {
                  const c = ac.toLowerCase();
                  if (c.startsWith("#ef")||c.startsWith("#f4")||c.startsWith("#f5")||c.startsWith("#eab")||c.startsWith("#dc")||c.startsWith("#f9")) icon = "⚠️";
                  else if (c.startsWith("#3b")||c.startsWith("#06")||c.startsWith("#4f")||c.startsWith("#63")||c.startsWith("#0e")||c.startsWith("#38")) icon = "📖";
                  else if (c.startsWith("#7c")||c.startsWith("#a8")||c.startsWith("#8b")||c.startsWith("#c0")) icon = "🔮";
                }
                return <span className="text-base ml-2" title="Icône d'aperçu pour ce type INFO">{icon}</span>;
              })()}
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
              {milestone.isOptional && <span className="text-caption px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold uppercase flex-shrink-0">opt.</span>}
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
              <span className="text-caption text-zinc-600 flex-shrink-0">{milestone.sequences.length} quête{milestone.sequences.length !== 1 ? "s" : ""}</span>
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
                        milestones={[milestone]}
                        onSave={(data, targetMilestoneId) => {
                          onSaveSequence({ ...data, id: seq.id, milestoneId: targetMilestoneId || milestone.id });
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

  // Collect all dungeons to display
  const displayDungeons = (Array.isArray(seq.dungeons) && seq.dungeons.length > 0) ? seq.dungeons : (seq.dungeon ? [seq.dungeon] : []);

  return (
    <div className="flex items-center gap-2 group/seq px-2 py-1.5 bg-zinc-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-500 flex-shrink-0 touch-none">
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Boss image(s) — now shows ALL dungeons */}
      {displayDungeons.length > 0 ? (
        <div className="flex items-center -space-x-1.5 flex-shrink-0">
          {displayDungeons.map((dd: any, di: number) => (
            dd.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={dd.id || di} src={dd.imageUrl} alt={dd.bossName || dd.name} title={dd.name} className={`w-6 h-6 rounded object-cover border border-white/10 ${di > 0 ? "ring-1 ring-zinc-950" : ""}`} />
            ) : (
              <div key={dd.id || di} title={dd.name} className="w-6 h-6 rounded bg-zinc-800 border border-white/10 flex items-center justify-center">
                <Sword className="w-3 h-3 text-zinc-500" />
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color + "80" }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {resolveRushSeqIcon((seq as any).icon) && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={safeImageUrl(resolveRushSeqIcon((seq as any).icon) as string)} alt="" className="w-4 h-4 object-contain shrink-0" />
          )}
          <span className="text-xs text-zinc-300 font-medium">{seq.subGuideName || seq.subGuideRef}</span>
          {displayDungeons.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {displayDungeons.map((dd: any, di: number) => (
                <span key={dd.id || di} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-caption font-bold text-indigo-300 truncate max-w-[140px]">
                  <Sword className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{dd.name}</span>
                  {Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "ocre_dungeon" && t.name === dd.id) && (
                    <span className="flex items-center gap-0.5 px-1 py-0 rounded-full bg-amber-500/20 text-amber-300 text-caption font-black uppercase tracking-widest">
                      <img src="/assets/icons/ocre.png" alt="" className="w-2 h-2 object-contain" />
                      Ocre
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
          {seq.alignReq && (
            <span className="px-1 py-0.5 rounded text-caption font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {seq.alignReq}{seq.alignOrderReq ? ` lv.${seq.alignOrderReq}` : ""}
            </span>
          )}
          {seq.tips && (
            <span title={seq.tips} className="flex-shrink-0">
              <AlertCircle className="w-2.5 h-2.5 text-amber-400/60" />
            </span>
          )}
          {/* Rendu des tags d'activité réels (texte seul, sans icône) */}
          {Array.isArray(seq.activityTags) && seq.activityTags.map((tag: any, idx: number) => {
            const def = ACTIVITY_TAGS.find(d => d.type === tag.type);
            if (!def) return null;
            const isMetier = tag.type === "metier";
            const label = isMetier && tag.name ? `${tag.name} (Niv. ${tag.level ?? 1})` : def.label;
            return (
              <span
                key={idx}
                title={label}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-caption font-black bg-zinc-800 text-zinc-300 border border-white/5"
              >
                <span className="max-w-[90px] truncate">{label}</span>
                {tag.count && tag.count > 1 && <span className="text-amber-400 font-mono text-caption ml-0.5">x{tag.count}</span>}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {hasCustomDb && <span className="text-caption text-emerald-400/60 font-bold flex items-center gap-0.5"><Link2 className="w-2 h-2" />DB✓</span>}
          {hasCustomNoobs && <span className="text-caption text-cyan-400/60 font-bold flex items-center gap-0.5"><Link2 className="w-2 h-2" />Noobs✓</span>}
          {seq.note && <span className="text-caption text-amber-400/60 italic truncate">{seq.note}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover/seq:opacity-100 transition-opacity flex-shrink-0">
        <a href={dofusdbUrl} target="_blank" rel="noreferrer"
          className={`px-1 py-0.5 text-caption font-black uppercase rounded transition-colors ${hasCustomDb ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-300"}`}
        ><BookOpen className="w-2.5 h-2.5 inline" /> DB</a>
        <a href={noobsUrl} target="_blank" rel="noreferrer"
          className={`px-1 py-0.5 text-caption font-black uppercase rounded transition-colors ${hasCustomNoobs ? "text-cyan-400" : "text-zinc-600 hover:text-zinc-300"}`}
        ><ExternalLink className="w-2.5 h-2.5 inline" /> Noobs</a>
        <button onClick={onEdit} className="p-1 text-zinc-600 hover:text-zinc-300 transition-all"><Pencil className="w-3 h-3" /></button>
        <button onClick={onDelete} className="p-1 text-zinc-600 hover:text-red-400 transition-all"><X className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

// ─── RequiredItemsEditor ───────────────────────────────────────────────────
function RequiredItemsEditor({
  items,
  onChange,
}: {
  items: Array<{ id?: string; name: string; quantity: number; imageUrl?: string; level?: number }>;
  onChange: (items: Array<{ id?: string; name: string; quantity: number; imageUrl?: string; level?: number }>) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(searchTimeoutRef.current);
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await searchItemsLocalThenDofusDB(q);
      if (res.success && res.data) {
        setResults(res.data);
      }
      setSearching(false);
    }, 250);
  };

  const addItem = (it: any) => {
    const existingIndex = items.findIndex(x => x.name.toLowerCase() === it.name.toLowerCase() || (it.id && x.id === it.id));
    if (existingIndex >= 0) {
      const next = [...items];
      next[existingIndex].quantity += 1;
      onChange(next);
    } else {
      onChange([...items, {
        id: it.id,
        name: it.name,
        quantity: 1,
        imageUrl: it.imageUrl,
        level: it.level
      }]);
    }
    setQuery("");
    setResults([]);
  };

  const updateQuantity = (idx: number, qty: number) => {
    const next = [...items];
    next[idx].quantity = Math.max(1, qty);
    onChange(next);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2 p-3 bg-zinc-950/60 rounded-xl border border-white/5 relative">
      <div className="flex items-center justify-between">
        <label className="text-caption font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
          📦 Objets & Ressources nécessaires ({items.length})
        </label>
      </div>

      {/* Liste des items ajoutés */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
              {it.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.imageUrl} alt={it.name} className="w-5 h-5 object-contain shrink-0" />
              )}
              <span className="font-bold truncate max-w-[140px]" title={it.name}>{it.name}</span>
              <div className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-lg border border-amber-500/20">
                <span className="text-[10px] text-zinc-400 font-mono">x</span>
                <input
                  type="number"
                  min={1}
                  max={999999}
                  value={it.quantity}
                  onChange={(e) => updateQuantity(idx, parseInt(e.target.value, 10) || 1)}
                  className="w-14 bg-transparent text-amber-300 font-black text-xs text-center focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="hover:text-red-400 text-zinc-500 transition-colors ml-0.5"
                title="Supprimer la ressource"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input de recherche avec dropdown */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher une ressource (ex: Reflet onirique, Riz, Pépite)..."
          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
        />
        {searching && (
          <span className="absolute right-3 top-2 text-caption text-zinc-500 animate-pulse">Recherche...</span>
        )}

        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-amber-500/30 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5 backdrop-blur-xl">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addItem(r)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-500/20 text-left transition-colors group"
              >
                {r.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.imageUrl} alt={r.name} className="w-6 h-6 object-contain shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">{r.name}</p>
                  <p className="text-[10px] text-zinc-500">Niv. {r.level} • {r.typeName || "Ressource"}</p>
                </div>
                <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SequenceEditForm (Sections progressives & Live Preview) ───────────────────
function SequenceEditForm({ seq, milestoneId, isPending, onSave, onCancel, milestones }: {
  seq: Sequence; milestoneId: string; isPending: boolean;
  onSave: (data: any, targetMilestoneId?: string) => void; onCancel: () => void;
  milestones?: Milestone[];
}) {
  const [name, setName] = useState(seq.subGuideName || seq.subGuideRef);
  const [dofusdbUrl, setDofusdbUrl] = useState(seq.dofusdbUrl || "");
  const [noobsUrl, setNoobsUrl] = useState(seq.dofuspourlesnoobsUrl || "");
  const [tips, setTips] = useState(seq.tips || "");
  const [alignReq, setAlignReq] = useState(seq.alignReq || "");
  const [alignOrderReq, setAlignOrderReq] = useState(seq.alignOrderReq ? String(seq.alignOrderReq) : "");
  const [note, setNote] = useState(seq.note || "");
  const [isSuccess, setIsSuccess] = useState(seq.isSuccess ?? false);
  const [icon, setIcon] = useState(seq.icon || "");
  const [customIconUrl, setCustomIconUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [metamobMonsterId, setMetamobMonsterId] = useState(seq.metamobMonsterId ? String(seq.metamobMonsterId) : "");
  const [activityTags, setActivityTags] = useState<ActivityTag[]>(
    Array.isArray(seq.activityTags) ? seq.activityTags as ActivityTag[] : []
  );
  const [requiredItems, setRequiredItems] = useState<Array<{ id?: string; name: string; quantity: number; imageUrl?: string; level?: number }>>(() => {
    return (seq.activityTags as any[])?.filter(t => t.type === "item").map(t => ({
      id: t.id || (t.dofusdbId ? String(t.dofusdbId) : undefined),
      name: t.name || "",
      quantity: Number(t.quantity || t.count || 1),
      imageUrl: t.imageUrl,
      level: t.level
    })) || [];
  });
  const [selectedDofusId, setSelectedDofusId] = useState<string>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "dofus_link");
    return existing?.name || "";
  });

  // Accordéon des sections d'édition
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    location: true,
    prereqs: false,
    activities: false,
    resources: false,
    links: false,
    hints: false,
    advanced: false,
  });

  const toggleSection = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));
  const [showPreview, setShowPreview] = useState(false);

  const handleRequiredItemsChange = (items: Array<{ id?: string; name: string; quantity: number; imageUrl?: string; level?: number }>) => {
    setRequiredItems(items);
    setActivityTags(prev => {
      const nonItemTags = prev.filter((t: any) => t.type !== "item");
      const itemTags = items.map(it => ({
        type: "item" as any,
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        count: it.quantity,
        imageUrl: it.imageUrl,
        level: it.level
      }));
      return [...nonItemTags, ...itemTags];
    });
  };

  // Multiselect Prerequisites state
  const [prereqs, setPrereqs] = useState<string[]>(() => {
    const existingTags = (seq.activityTags as any[])?.filter(t => t.type === "prereq_text") || [];
    if (existingTags.length > 0) {
      return existingTags.map(t => t.name).filter(Boolean);
    }
    return [];
  });
  const [prereqQuery, setPrereqQuery] = useState("");
  const [prereqResults, setPrereqResults] = useState<{ id: string; name: string }[]>([]);
  const [searchingPrereqs, setSearchingPrereqs] = useState(false);
  const prereqSearchRef = useRef<any>(null);

  const handlePrereqSearch = (q: string) => {
    setPrereqQuery(q);
    if (q.length < 2) { setPrereqResults([]); return; }
    clearTimeout(prereqSearchRef.current);
    setSearchingPrereqs(true);
    prereqSearchRef.current = setTimeout(async () => {
      const res = await searchGuideQuests(q);
      if (res.success && res.data) {
        setPrereqResults(res.data);
      }
      setSearchingPrereqs(false);
    }, 250);
  };

  const addPrereq = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed || prereqs.includes(trimmed)) return;
    const nextPrereqs = [...prereqs, trimmed];
    setPrereqs(nextPrereqs);
    setPrereqQuery("");
    setPrereqResults([]);
    
    // Sync activityTags
    setActivityTags(prev => {
      const nonPrereqs = prev.filter((t: any) => t.type !== "prereq_text");
      const prereqTags = nextPrereqs.map(p => ({ type: "prereq_text" as any, name: p }));
      return [...nonPrereqs, ...prereqTags];
    });
  };

  const removePrereq = (nameToRemove: string) => {
    const nextPrereqs = prereqs.filter(p => p !== nameToRemove);
    setPrereqs(nextPrereqs);
    
    setActivityTags(prev => {
      const nonPrereqs = prev.filter((t: any) => t.type !== "prereq_text");
      const prereqTags = nextPrereqs.map(p => ({ type: "prereq_text" as any, name: p }));
      return [...nonPrereqs, ...prereqTags];
    });
  };

  const [positionsInput, setPositionsInput] = useState<string>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "pos_tags");
    return existing?.name || "";
  });
  const [positionsWorldId, setPositionsWorldId] = useState<number>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "pos_tags");
    return existing?.worldId ?? 1;
  });
  const [tougliText, setTougliText] = useState<string>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "tougli_box");
    return existing?.name || "";
  });
  const [tougliColor, setTougliColor] = useState<string>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "tougli_box");
    return existing?.color || "emerald";
  });

  const [isInfoBlock, setIsInfoBlock] = useState<boolean>(() => {
    return (seq.activityTags as any[])?.some(t => t.type === "info_sequence") ?? false;
  });
  const [infoBlockColor, setInfoBlockColor] = useState<string>(() => {
    const existing = (seq.activityTags as any[])?.find(t => t.type === "info_sequence");
    return existing?.color || "#10b981";
  });

  const handleIsInfoBlockChange = (val: boolean) => {
    setIsInfoBlock(val);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "info_sequence");
      if (val) {
        return [...filtered, { type: "info_sequence" as any, color: infoBlockColor }];
      }
      return filtered;
    });
  };

  const handleInfoBlockColorChange = (color: string) => {
    setInfoBlockColor(color);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "info_sequence");
      return [...filtered, { type: "info_sequence" as any, color }];
    });
  };

  // ─── Quête d'alignement (tag alignment_set) ─────────────────────────────
  const [alignmentSet, setAlignmentSet] = useState<{ camp: string; level: number } | null>(() => {
    const t = (seq.activityTags as any[])?.find((x: any) => x.type === "alignment_set");
    return t && t.name ? { camp: t.name, level: typeof t.level === "number" ? t.level : 0 } : null;
  });

  const syncAlignmentTag = (next: { camp: string; level: number } | null) => {
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "alignment_set");
      if (next) return [...filtered, { type: "alignment_set" as any, name: next.camp, level: next.level }];
      return filtered;
    });
  };
  const handleAlignmentSetToggle = (on: boolean) => {
    const next = on ? { camp: alignmentSet?.camp || "bontarien", level: alignmentSet?.level ?? 0 } : null;
    setAlignmentSet(next);
    syncAlignmentTag(next);
  };
  const handleAlignmentCampChange = (camp: string) => {
    const next = { camp, level: alignmentSet?.level ?? 0 };
    setAlignmentSet(next);
    syncAlignmentTag(next);
  };
  const handleAlignmentLevelChange = (level: number) => {
    const clamped = Math.max(0, Math.min(100, level));
    const next = { camp: alignmentSet?.camp || "bontarien", level: clamped };
    setAlignmentSet(next);
    syncAlignmentTag(next);
  };

  // ─── Métier requis (tag metier) — « qui peut aider » côté membre ──────────
  const [metierTag, setMetierTag] = useState<{ name: string; level: number } | null>(() => {
    const t = (seq.activityTags as any[])?.find((x: any) => x.type === "metier");
    return t && t.name ? { name: t.name, level: typeof t.level === "number" ? t.level : 0 } : null;
  });

  const syncMetierTag = (next: { name: string; level: number } | null) => {
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "metier");
      if (!next || !next.name) return filtered;
      const tag: any = { type: "metier", name: next.name };
      if (next.level > 0) tag.level = next.level;
      return [...filtered, tag];
    });
  };
  const handleMetierToggle = (on: boolean) => {
    const first = Object.values(DOFUS_JOBS).flat()[0]?.name || "";
    const next = on ? { name: metierTag?.name || first, level: metierTag?.level ?? 0 } : null;
    setMetierTag(next);
    syncMetierTag(next);
  };
  const handleMetierJobChange = (name: string) => {
    const next = { name, level: metierTag?.level ?? 0 };
    setMetierTag(next);
    syncMetierTag(next);
  };
  const handleMetierLevelChange = (level: number) => {
    const clamped = Math.max(0, Math.min(200, level));
    const next = { name: metierTag?.name || "", level: clamped };
    setMetierTag(next);
    syncMetierTag(next);
  };

  const handleInsertLink = () => {
    const label = prompt("Texte affiché pour le lien (ex: Le trésor de Totankama) :");
    if (!label) return;
    const url = prompt("URL du lien (ex: https://dofusdb.fr/...) :");
    if (!url) return;
    const markdown = `[${label}](${url})`;
    setTougliText(prev => {
      const newText = prev ? `${prev} ${markdown}` : markdown;
      handleTougliTextChange(newText);
      return newText;
    });
  };

  const handlePositionsChange = (text: string) => {
    setPositionsInput(text);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "pos_tags");
      if (text.trim()) {
        return [...filtered, { type: "pos_tags" as any, name: text.trim(), worldId: positionsWorldId }];
      }
      return filtered;
    });
  };

  const handleTougliTextChange = (text: string) => {
    setTougliText(text);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "tougli_box");
      if (text.trim()) {
        return [...filtered, { type: "tougli_box" as any, name: text.trim(), color: tougliColor }];
      }
      return filtered;
    });
  };

  const handleTougliColorChange = (color: string) => {
    setTougliColor(color);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "tougli_box");
      if (tougliText.trim()) {
        return [...filtered, { type: "tougli_box" as any, name: tougliText.trim(), color }];
      }
      return filtered;
    });
  };
  const [selectedDungeons, setSelectedDungeons] = useState<DungeonResult[]>(
    seq.dungeons && seq.dungeons.length > 0
      ? seq.dungeons.map(d => ({ id: d.id, name: d.name, level: 0, imageUrl: d.imageUrl, bossName: d.bossName }))
      : seq.dungeon ? [{ id: seq.dungeon.id, name: seq.dungeon.name, level: 0, imageUrl: seq.dungeon.imageUrl, bossName: seq.dungeon.bossName }] : []
  );
  const [dungeonQuery, setDungeonQuery] = useState("");
  const [dungeonResults, setDungeonResults] = useState<DungeonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<any>(null);

  const isDungeonOcre = (dungeonId: string) => {
    return activityTags.some((t: any) => t.type === "ocre_dungeon" && t.name === dungeonId);
  };

  const toggleOcreForDungeon = (dungeonId: string) => {
    if (isDungeonOcre(dungeonId)) {
      setActivityTags(prev => prev.filter((t: any) => !(t.type === "ocre_dungeon" && t.name === dungeonId)));
    } else {
      setActivityTags(prev => [...prev, { type: "ocre_dungeon" as any, name: dungeonId }]);
    }
  };

  const handleDofusChange = (dofusId: string) => {
    setSelectedDofusId(dofusId);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "dofus_link");
      if (dofusId) {
        return [...filtered, { type: "dofus_link" as any, name: dofusId }];
      }
      return filtered;
    });
  };

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

  const removeDungeon = (id: string) => {
    setSelectedDungeons(prev => prev.filter(d => d.id !== id));
    setActivityTags(prev => prev.filter((t: any) => !(t.type === "ocre_dungeon" && t.name === id)));
  };

  const isDirty = useMemo(() => {
    return (
      name !== (seq.subGuideName || seq.subGuideRef) ||
      dofusdbUrl !== (seq.dofusdbUrl || "") ||
      noobsUrl !== (seq.dofuspourlesnoobsUrl || "") ||
      tips !== (seq.tips || "") ||
      alignReq !== (seq.alignReq || "") ||
      alignOrderReq !== (seq.alignOrderReq ? String(seq.alignOrderReq) : "") ||
      note !== (seq.note || "") ||
      isSuccess !== (seq.isSuccess ?? false) ||
      icon !== (seq.icon || "") ||
      metamobMonsterId !== (seq.metamobMonsterId ? String(seq.metamobMonsterId) : "")
    );
  }, [name, dofusdbUrl, noobsUrl, tips, alignReq, alignOrderReq, note, isSuccess, icon, metamobMonsterId, seq]);

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
      icon: icon.trim() || null,
      metamobMonsterId: metamobMonsterId ? parseInt(metamobMonsterId, 10) : null,
      activityTags,
    });
  };

  return (
    <div className="p-3.5 bg-zinc-950/90 border border-indigo-500/30 rounded-2xl space-y-3 shadow-xl">
      {/* Header avec statut dirty et toggle preview */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <p className="text-caption font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Pencil className="w-3 h-3 text-indigo-400" /> Édition quête
          </p>
          {isDirty && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
              ● Non enregistré
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-caption font-bold transition-all ${
            showPreview
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/5"
          }`}
        >
          👁️ {showPreview ? "Masquer Aperçu" : "Aperçu Live"}
        </button>
      </div>

      {/* Aperçu Live (Simulateur Dashboard / Overlay) */}
      {showPreview && (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-[#d5a94e]/30 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#d5a94e]">Aperçu Joueur (Temps Réel)</p>
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3.5 h-3.5 rounded border border-zinc-600 shrink-0" />
              <span className="font-bold text-xs text-zinc-100 truncate font-serif">{name || "Nom de quête"}</span>
            </div>
            {positionsInput && (
              <span className="font-mono text-[10px] font-bold text-blue-300 bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.5 rounded">
                {positionsInput}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Section 1 : Identité & Nom (Ouvert par défaut) ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => toggleSection("identity")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-zinc-400">
            1. Identité de la quête *
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.identity ? "rotate-180" : ""}`} />
        </button>
        {openSections.identity && (
          <div className="p-3 pt-0 space-y-2 border-t border-white/5">
            <div>
              <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">Nom *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                placeholder="Nom de la quête"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2 : Destination & Coordonnées (Ouvert par défaut) ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 relative">
        <button
          type="button"
          onClick={() => toggleSection("location")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-emerald-400/90">
            2. 📍 Destination & Coordonnées GPS
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.location ? "rotate-180" : ""}`} />
        </button>
        {openSections.location && (
          <div className="p-3 pt-0 space-y-2 border-t border-white/5">
            <label className="text-caption font-black text-emerald-400/80 uppercase tracking-widest mb-1 block">
              Positions GPS (ex: -2, 0 ; 10, -22)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                value={positionsInput}
                onChange={e => handlePositionsChange(e.target.value)}
                className="flex-1 bg-black/60 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500/50"
                placeholder="-2, 0 ; 10, -22"
              />
              <div className="relative shrink-0">
                <WorldPicker
                  value={positionsWorldId}
                  onChange={w => {
                    setPositionsWorldId(w);
                    setActivityTags(prev => {
                      const filtered = prev.filter((t: any) => t.type !== "pos_tags");
                      if (positionsInput.trim()) {
                        return [...filtered, { type: "pos_tags" as any, name: positionsInput.trim(), worldId: w }];
                      }
                      return filtered;
                    });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3 : Prérequis & Dofus ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 relative">
        <button
          type="button"
          onClick={() => toggleSection("prereqs")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-amber-400/90">
            3. 🔒 Prérequis ({prereqs.length}) & Dofus associé
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.prereqs ? "rotate-180" : ""}`} />
        </button>
        {openSections.prereqs && (
          <div className="p-3 pt-0 space-y-3 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <label className="text-caption font-black text-amber-400/80 uppercase tracking-widest mb-1 block">
                  Prérequis de quête
                </label>
                {prereqs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {prereqs.map((pName, pIdx) => (
                      <span key={pIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 text-caption font-bold">
                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                        <span className="max-w-[120px] truncate">{pName}</span>
                        <button type="button" onClick={() => removePrereq(pName)} className="hover:text-red-400 text-zinc-400 ml-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={prereqQuery}
                    onChange={e => handlePrereqSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && prereqQuery.trim()) {
                        e.preventDefault();
                        addPrereq(prereqQuery.trim());
                      }
                    }}
                    className="w-full bg-black/60 border border-amber-500/20 rounded-lg px-2 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-700"
                    placeholder="Rechercher une quête prérequis..."
                  />
                  {searchingPrereqs && <span className="absolute right-2 top-2 text-caption text-zinc-500 animate-pulse">...</span>}
                </div>
                {prereqResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-amber-500/30 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto p-1 space-y-0.5">
                    {prereqResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => addPrereq(res.name)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-amber-500/20 hover:text-amber-100 flex items-center gap-2 transition-colors"
                      >
                        <Search className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{res.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-caption font-black text-emerald-400/80 uppercase tracking-widest mb-1 block">
                  🥚 Dofus associé
                </label>
                <select
                  value={selectedDofusId}
                  onChange={e => handleDofusChange(e.target.value)}
                  className="w-full bg-black/60 border border-emerald-500/20 rounded-lg px-2 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">— Aucun Dofus associé —</option>
                  {DOFUS_LIST.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4 : Activités & Tags ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => toggleSection("activities")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-blue-400/90">
            4. 🎯 Alignement & Métier requis
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.activities ? "rotate-180" : ""}`} />
        </button>
        {openSections.activities && (
          <div className="p-3 pt-0 space-y-2 border-t border-white/5">
            {/* ⚔️ Quête d'alignement : quand cochée, donne camp + niveau au perso */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alignSetToggle"
                  checked={!!alignmentSet}
                  onChange={e => handleAlignmentSetToggle(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
                <label htmlFor="alignSetToggle" className="flex items-center gap-1.5 text-xs font-bold text-indigo-200 cursor-pointer select-none">
                  ⚔️ Quête d'alignement
                  <span className="text-[10px] font-medium text-indigo-300/60">— quand un membre la coche, son alignement de rush prend ce camp + niveau</span>
                </label>
              </div>
              {alignmentSet && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <span className="text-caption font-black text-indigo-300/80 uppercase tracking-widest">Camp</span>
                  <button
                    type="button"
                    onClick={() => handleAlignmentCampChange("bontarien")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-caption font-black uppercase tracking-widest transition-all ${
                      alignmentSet.camp === "bontarien"
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-200"
                        : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <img src="/ordres/bonta.png" alt="" className="w-4 h-4 object-contain" /> Bontarien
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlignmentCampChange("brakmarien")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-caption font-black uppercase tracking-widest transition-all ${
                      alignmentSet.camp === "brakmarien"
                        ? "bg-red-500/20 border-red-500/50 text-red-200"
                        : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <img src="/ordres/brakmar.png" alt="" className="w-4 h-4 object-contain" /> Brakmarien
                  </button>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-caption font-black text-indigo-300/80 uppercase tracking-widest">Niveau</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={alignmentSet.level}
                      onChange={e => handleAlignmentLevelChange(parseInt(e.target.value, 10) || 0)}
                      className="w-16 bg-black/60 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs text-indigo-200 text-center focus:outline-none"
                    />
                  </div>
                  <span className="ml-auto text-caption text-indigo-300/60 italic">
                    → tag: {'{ type: "alignment_set", name: "'}{alignmentSet.camp}{'", level: '}{alignmentSet.level}{' }'}
                  </span>
                </div>
              )}

              {/* 🔨 Métier requis : « qui peut aider » côté membre */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="metierToggle"
                    checked={!!metierTag}
                    onChange={e => handleMetierToggle(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <label htmlFor="metierToggle" className="flex items-center gap-1.5 text-xs font-bold text-amber-200 cursor-pointer select-none">
                    🔨 Métier requis
                    <span className="text-[10px] font-medium text-amber-300/60">— affiche « qui peut aider » via ce métier (badge membre)</span>
                  </label>
                </div>
                {metierTag && (
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <select
                      value={metierTag.name}
                      onChange={e => handleMetierJobChange(e.target.value)}
                      className="bg-black/60 border border-amber-500/30 rounded-lg px-2 py-1.5 text-xs text-amber-200 focus:outline-none"
                    >
                      <option value="">— Choisir un métier —</option>
                      {Object.values(DOFUS_JOBS).flat().map(j => (
                        <option key={j.id} value={j.name}>{j.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <span className="text-caption font-black text-amber-300/80 uppercase tracking-widest">Niveau</span>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={metierTag.level}
                        onChange={e => handleMetierLevelChange(parseInt(e.target.value, 10) || 0)}
                        className="w-16 bg-black/60 border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-amber-200 text-center focus:outline-none"
                      />
                    </div>
                    <span className="ml-auto text-caption text-amber-300/60 italic">
                      → tag: {'{ type: "metier", name: "'}{metierTag.name}{'", level: '}{metierTag.level}{' }'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 5 : Ressources & Objets requis ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 relative">
        <button
          type="button"
          onClick={() => toggleSection("resources")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-amber-300/90">
            5. 📦 Ressources & Objets nécessaires ({requiredItems.length})
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.resources ? "rotate-180" : ""}`} />
        </button>
        {openSections.resources && (
          <div className="p-3 pt-0 space-y-2 border-t border-white/5">
            <RequiredItemsEditor items={requiredItems} onChange={handleRequiredItemsChange} />
          </div>
        )}
      </div>

      {/* ── Section 6 : Liens & Médias ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => toggleSection("links")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-cyan-400/90">
            6. 🔗 Liens externes & Icône
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.links ? "rotate-180" : ""}`} />
        </button>
        {openSections.links && (
          <div className="p-3 pt-0 space-y-3 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">URL DofusDB</label>
                <input
                  value={dofusdbUrl}
                  onChange={e => setDofusdbUrl(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-caption text-emerald-300/80 focus:outline-none focus:border-emerald-500/40"
                  placeholder="https://dofusdb.fr/fr/..."
                />
              </div>
              <div>
                <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">URL DofusNoobs</label>
                <input
                  value={noobsUrl}
                  onChange={e => setNoobsUrl(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-caption text-cyan-300/80 focus:outline-none focus:border-cyan-500/40"
                  placeholder="https://dofuspourlesnoobs.com/..."
                />
              </div>
            </div>

            <div>
              <label className="text-caption font-black text-zinc-500 uppercase tracking-widest block mb-1">Icône du bloc (optionnel)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[["", "Défaut"], ["serie-de-quete", "Série de quêtes"], ["icone-succes", "Succès"]].map(([val, label]) => (
                  <button
                    key={val || "none"}
                    type="button"
                    onClick={() => { setIcon(val); if (!val) setCustomIconUrl(""); }}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-caption font-black uppercase tracking-widest transition-all ${
                      icon === val ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-zinc-800/60 border-white/10 text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {val ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/assets/icons/${val}.png`} alt={label} className="w-4 h-4 object-contain" />
                    ) : (
                      <span className="w-4 h-4 flex items-center justify-center text-caption">✕</span>
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Icône personnalisée — URL ou import d'image (S5) */}
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    value={customIconUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomIconUrl(v);
                      if (v.trim()) {
                        setIcon(isSafeImageUrl(v) ? v.trim() : "");
                      } else {
                        setIcon("");
                      }
                    }}
                    placeholder="URL d'image (https://… ou /uploads/…)"
                    className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-caption text-indigo-200/90 focus:outline-none focus:border-indigo-500/40 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("rush-icon-upload")?.click()}
                    disabled={uploadingIcon}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 bg-zinc-800/60 text-caption font-black text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {uploadingIcon ? "…" : "⬆ Importer"}
                  </button>
                  <input
                    id="rush-icon-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploadingIcon(true);
                      const url = await uploadImageFile(f);
                      if (url) { setIcon(url); setCustomIconUrl(url); }
                      setUploadingIcon(false);
                      e.target.value = "";
                    }}
                  />
                </div>
                {resolveRushSeqIcon(icon) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={safeImageUrl(resolveRushSeqIcon(icon) as string)} alt="" className="w-6 h-6 object-contain rounded-md" />
                )}
                {customIconUrl.trim() && !isSafeImageUrl(customIconUrl) && (
                  <p className="text-[10px] text-red-400/80">URL d'image non autorisée (http(s) ou chemin relatif uniquement).</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 7 : Conseils & Style Tougli ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => toggleSection("hints")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-purple-400/90">
            7. 💡 Conseils, Notes & Style Tougli
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.hints ? "rotate-180" : ""}`} />
        </button>
        {openSections.hints && (
          <div className="p-3 pt-0 space-y-3 border-t border-white/5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-caption font-black text-zinc-500 uppercase tracking-widest block">💡 Tips</label>
                <button
                  type="button"
                  onClick={() => {
                    const x = prompt("Position X :");
                    if (!x) return;
                    const y = prompt("Position Y :");
                    if (!y) return;
                    const pos = `/travel ${x},${y}`;
                    setTips(prev => prev ? `${prev} ${pos}` : pos);
                    toast.success(`📍 ${pos} ajouté !`, { duration: 1500 });
                  }}
                  className="flex items-center gap-1 text-caption font-bold text-indigo-300 hover:text-indigo-100 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-lg transition-all"
                >
                  <MapPin className="w-3 h-3" /> Ajouter position
                </button>
              </div>
              <textarea
                value={tips}
                onChange={e => setTips(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-amber-300/80 focus:outline-none focus:border-amber-500/30 resize-none"
                placeholder="Conseil affiché côté membre..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block">⚠️ Note courte</label>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                placeholder="ex: Ne pas cliquer le portail !"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-caption font-black text-purple-400/80 uppercase tracking-widest block">
                  Mini bloc Tougli
                </label>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  className="flex items-center gap-1 text-caption font-bold text-purple-300 hover:text-purple-100 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-lg transition-all"
                >
                  🔗 Insérer un lien
                </button>
              </div>
              <textarea
                value={tougliText}
                onChange={e => handleTougliTextChange(e.target.value)}
                className="w-full bg-black/60 border border-purple-500/20 rounded-lg px-2 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-500/50 resize-none font-sans"
                placeholder="ex: Prenez la quête [Le trésor de Totankama](https://dofusdb.fr/...) qui demandera de faire..."
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Section 8 : Options Avancées & Donjons ── */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 relative">
        <button
          type="button"
          onClick={() => toggleSection("advanced")}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-mono uppercase text-caption tracking-wider text-rose-400/90">
            8. ⚔️ Donjons ({selectedDungeons.length}), Info Sequence & Transfert
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openSections.advanced ? "rotate-180" : ""}`} />
        </button>
        {openSections.advanced && (
          <div className="p-3 pt-0 space-y-3 border-t border-white/5">
            {/* Toggle Info Sequence */}
            <div className="flex flex-col gap-2 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isInfoBlockToggle"
                  checked={isInfoBlock}
                  onChange={e => handleIsInfoBlockChange(e.target.checked)}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <label htmlFor="isInfoBlockToggle" className="text-xs font-bold text-purple-200 cursor-pointer select-none">
                  📌 Est un bloc d'information pur (non cochable)
                </label>
              </div>
            </div>

            {/* Donjons liés */}
            <div>
              <label className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1 block flex items-center gap-1">
                <Sword className="w-2.5 h-2.5 text-indigo-400" /> Donjons liés
              </label>
              {selectedDungeons.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {selectedDungeons.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-2 p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        {d.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={d.imageUrl} alt={d.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                          : <Sword className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                        <span className="text-caption font-bold text-white truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleOcreForDungeon(d.id)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-caption font-black uppercase tracking-widest transition-all ${
                            isDungeonOcre(d.id)
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                              : "bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/assets/icons/ocre.png" alt="Ocre" className="w-3 h-3 object-contain" />
                          {isDungeonOcre(d.id) ? "À capturer ✓" : "Ocre ?"}
                        </button>
                        <button type="button" onClick={() => removeDungeon(d.id)} className="text-zinc-500 hover:text-red-400 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                value={dungeonQuery}
                onChange={e => handleDungeonSearch(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/40"
                placeholder="Ajouter un donjon…"
              />
              {searching && <p className="text-caption text-zinc-600 italic mt-1">Recherche…</p>}
              {dungeonResults.length > 0 && (
                <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
                  {dungeonResults.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => addDungeon(d)}
                      className="w-full flex items-center gap-2 px-2 py-1 hover:bg-indigo-500/10 rounded-lg transition-colors text-left"
                    >
                      {d.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={d.imageUrl} alt={d.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                        : <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0"><Sword className="w-2.5 h-2.5 text-zinc-600" /></div>}
                      <p className="text-xs font-bold text-white">{d.name}</p>
                      <p className="text-caption text-zinc-500">Niv. {d.level}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Déplacer vers un autre bloc */}
            {seq.id && milestones && milestones.length > 1 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-caption font-black text-emerald-400 uppercase tracking-widest shrink-0">Déplacer vers</span>
                <select
                  value=""
                  onChange={e => {
                    const targetId = e.target.value;
                    if (targetId && targetId !== milestoneId) {
                      onSave({ subGuideRef: name.trim(), activityTags }, targetId);
                    }
                  }}
                  className="flex-1 bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1 text-caption text-emerald-200 focus:outline-none"
                >
                  <option value="">— Choisir un bloc —</option>
                  {milestones.filter(m => m.id !== milestoneId && !isSeparatorMilestone(m)).map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
          >
            <Check className="w-3.5 h-3.5" /> Enregistrer la quête
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WorldPicker pour sélectionner un monde avec style ──────────────────────
function WorldPicker({ value, onChange }: { value: number; onChange: (worldId: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = DOFUS_WORLDS.find(w => w.id === value);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 text-caption font-medium transition-all whitespace-nowrap"
      >
        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="truncate max-w-[100px]">{selected ? `${selected.name}` : `Monde ${value}`}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 bg-zinc-950 border border-zinc-700/80 rounded-xl shadow-2xl z-[100] min-w-[220px] max-h-60 overflow-y-auto p-1.5 backdrop-blur-xl">
          {DOFUS_WORLDS.map(w => (
            <button key={w.id} type="button" onClick={() => { onChange(w.id); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                w.id === value
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                  : "text-zinc-300 hover:bg-zinc-800/80 border border-transparent"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black font-mono shrink-0 ${
                w.id === value ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
              }`}>{w.id}</span>
              <span className="font-medium truncate flex-1">{w.name}</span>
              {w.id === value && <Check className="w-3.5 h-3.5 ml-auto text-emerald-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
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

  // Info block state
  const [isInfoBlockNew, setIsInfoBlockNew] = useState(false);
  const [infoBlockColorNew, setInfoBlockColorNew] = useState("#10b981");

  const [selectedDofusId, setSelectedDofusId] = useState<string>("");
  
  // Multiselect Prerequisites state
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [prereqQuery, setPrereqQuery] = useState("");
  const [prereqResults, setPrereqResults] = useState<{ id: string; name: string }[]>([]);
  const [searchingPrereqs, setSearchingPrereqs] = useState(false);
  const prereqSearchRef = useRef<any>(null);

  const handlePrereqSearch = (q: string) => {
    setPrereqQuery(q);
    if (q.length < 2) { setPrereqResults([]); return; }
    clearTimeout(prereqSearchRef.current);
    setSearchingPrereqs(true);
    prereqSearchRef.current = setTimeout(async () => {
      const res = await searchGuideQuests(q);
      if (res.success && res.data) {
        setPrereqResults(res.data);
      }
      setSearchingPrereqs(false);
    }, 250);
  };

  const addPrereq = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || prereqs.includes(trimmed)) return;
    const nextPrereqs = [...prereqs, trimmed];
    setPrereqs(nextPrereqs);
    setPrereqQuery("");
    setPrereqResults([]);
    
    // Sync activityTags
    setActivityTags(prev => {
      const nonPrereqs = prev.filter((t: any) => t.type !== "prereq_text");
      const prereqTags = nextPrereqs.map(p => ({ type: "prereq_text" as any, name: p }));
      return [...nonPrereqs, ...prereqTags];
    });
  };

  const removePrereq = (nameToRemove: string) => {
    const nextPrereqs = prereqs.filter(p => p !== nameToRemove);
    setPrereqs(nextPrereqs);
    
    setActivityTags(prev => {
      const nonPrereqs = prev.filter((t: any) => t.type !== "prereq_text");
      const prereqTags = nextPrereqs.map(p => ({ type: "prereq_text" as any, name: p }));
      return [...nonPrereqs, ...prereqTags];
    });
  };

  const handleDofusChange = (dofusId: string) => {
    setSelectedDofusId(dofusId);
    setActivityTags(prev => {
      const filtered = prev.filter((t: any) => t.type !== "dofus_link");
      if (dofusId) {
        return [...filtered, { type: "dofus_link" as any, name: dofusId }];
      }
      return filtered;
    });
  };

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
    setSelectedDofusId(""); setPrereqs([]); setPrereqQuery("");
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
              <p className="text-caption font-black text-indigo-400/60 uppercase tracking-widest">Options avancées</p>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="text-caption font-black text-amber-400/80 uppercase tracking-widest mb-1 block flex items-center gap-1">
                    🔒 Prérequis de cette quête ({prereqs.length})
                  </label>

                  {/* Badges / Tags de prérequis choisis */}
                  {prereqs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {prereqs.map((pName, pIdx) => (
                        <span key={pIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 text-caption font-bold">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          <span className="max-w-[120px] truncate">{pName}</span>
                          <button type="button" onClick={() => removePrereq(pName)} className="hover:text-red-400 text-zinc-400 ml-0.5">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Autocomplete Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={prereqQuery}
                      onChange={e => handlePrereqSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && prereqQuery.trim()) {
                          e.preventDefault();
                          addPrereq(prereqQuery.trim());
                        }
                      }}
                      className="w-full bg-black/60 border border-amber-500/20 rounded-lg px-2 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-700"
                      placeholder="Rechercher une quête prérequis..."
                    />
                    {searchingPrereqs && <span className="absolute right-2 top-2 text-caption text-zinc-500 animate-pulse">...</span>}
                  </div>

                  {/* Dropdown de résultats */}
                  {prereqResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-amber-500/30 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto p-1 space-y-0.5">
                      {prereqResults.map((res) => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => addPrereq(res.name)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-amber-500/20 hover:text-amber-100 flex items-center gap-2 transition-colors"
                        >
                          <Search className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{res.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-caption font-black text-emerald-400/80 uppercase tracking-widest mb-1 block flex items-center gap-1">
                    🥚 Dofus associé
                  </label>
                  <select value={selectedDofusId} onChange={e => handleDofusChange(e.target.value)}
                    className="w-full bg-black/60 border border-emerald-500/20 rounded-lg px-2 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">— Aucun Dofus associé —</option>
                    {DOFUS_LIST.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-caption text-zinc-600 mb-1 block">URL DofusDB</label>
                  <input value={dofusdbUrl} onChange={e => setDofusdbUrl(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-caption text-emerald-300/80 focus:outline-none"
                    placeholder="https://dofusdb.fr/fr/..."
                  />
                </div>
                <div>
                  <label className="text-caption text-zinc-600 mb-1 block">URL DofusNoobs</label>
                  <input value={noobsUrl} onChange={e => setNoobsUrl(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-caption text-cyan-300/80 focus:outline-none"
                    placeholder="https://dofuspourlesnoobs.com/..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-caption text-zinc-600 mb-1 block">Alignement</label>
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
                  <label className="text-caption text-zinc-600 mb-1 block">Niveau</label>
                  <input type="number" min={0} max={100} value={alignOrderReq} onChange={e => setAlignOrderReq(e.target.value)}
                    className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    placeholder="0–100"
                  />
                </div>
              </div>
              <div>
                <label className="text-caption text-zinc-600 mb-1 block">💡 Tips</label>
                <textarea value={tips} onChange={e => setTips(e.target.value)}
                  className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-amber-300/70 focus:outline-none resize-none"
                  placeholder="Conseil pour le membre…" rows={2}
                />
              </div>
              <div className="flex flex-col gap-1 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isInfoBlockNew"
                    checked={isInfoBlockNew}
                    onChange={e => {
                      setIsInfoBlockNew(e.target.checked);
                      setActivityTags(prev => {
                        const filtered = prev.filter((t: any) => t.type !== "info_sequence");
                        if (e.target.checked) {
                          return [...filtered, { type: "info_sequence" as any, color: infoBlockColorNew }];
                        }
                        return filtered;
                      });
                    }}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
          <label htmlFor="isInfoBlockNew" className="text-caption font-bold text-purple-200 cursor-pointer select-none">
            📌 Bloc d'info sans check ni bookmark
          </label>
          <span className="text-caption text-zinc-600 ml-auto italic">Écris `/travel X Y` dans le texte → badge cliquable</span>
                </div>
                {isInfoBlockNew && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-caption font-black text-zinc-500 uppercase tracking-widest">Couleur</span>
                    <div className="flex gap-1">
                      {COLOR_PALETTE.map(c => (
                        <button key={c.value} onClick={() => {
                          setInfoBlockColorNew(c.value);
                          setActivityTags(prev => {
                            const filtered = prev.filter((t: any) => t.type !== "info_sequence");
                            return [...filtered, { type: "info_sequence" as any, color: c.value }];
                          });
                        }} title={c.label}
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${infoBlockColorNew === c.value ? "border-white scale-125" : "border-transparent opacity-40 hover:opacity-100"}`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-caption text-zinc-600 mb-1 block">⚠️ Note courte</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="w-full bg-black/60 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  placeholder="Note courte…"
                />
              </div>
              {/* Donjons */}
              <div>
                <label className="text-caption text-zinc-600 mb-1 block">⚔️ Donjons liés</label>
                {selectedDungeons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {selectedDungeons.map(d => (
                      <div key={d.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-caption text-white font-bold">
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
                {searching && <p className="text-caption text-zinc-600 italic mt-0.5">Recherche…</p>}
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
