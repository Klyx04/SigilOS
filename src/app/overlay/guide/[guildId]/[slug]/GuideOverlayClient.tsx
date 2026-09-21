"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { CheckCircle2, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  toggleMilestoneProgress,
  setRushSequenceProgress,
  setRushBookmark,
  applyRushAlignmentFromSequence,
  resetGuideProgress,
} from "@/server/actions/optimized-guide-actions";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { type GuideProgressRow } from "@/lib/guide-progress-helpers";
import { isInfoSequence, isNonCheckableBlock, rushChapterPosition, getPrereqRefs, type RushPrereqRef } from "@/lib/rush-guide-utils";
import { collectCascadeUncheck } from "@/lib/rush-helpers";
import { useGuideProgressSync } from "@/hooks/use-guide-sync";
import { RushOverlayHeader } from "./components/RushOverlayHeader";
import { RushOverlaySearch } from "./components/RushOverlaySearch";
import { RushOverlayChapterTree } from "./components/RushOverlayChapterTree";
import { RushOverlayQuestListItem } from "./components/RushOverlayQuestListItem";
import { RushOverlayQuestDetailModal } from "./components/RushOverlayQuestDetailModal";
import { RushOverlayFooter } from "./components/RushOverlayFooter";
import { RushOverlayCompact } from "./components/RushOverlayCompact";
import { RushSeparatorBanner } from "@/components/dofus-quests/rush/RushSeparatorBanner";
import { RushInfoBanner } from "@/components/dofus-quests/rush/RushInfoBanner";
import { RushRichText } from "@/components/dofus-quests/rush/RushRichText";
import { RushInfoSequenceBanner } from "@/components/dofus-quests/rush/RushInfoSequenceBanner";
import { getNextObjective, aggregateRushResources, nextBlockIndex, bannersForChapter } from "./components/overlay-utils";
import { RushOverlayResourcesModal } from "./components/RushOverlayResourcesModal";
import { RushOverlayMembersModal, type OverlayMember } from "./components/RushOverlayMembersModal";
import { RushOverlayOcreModal } from "./components/RushOverlayOcreModal";
import { buildOcrePlan, type OcrePanelData } from "@/lib/ocre-soul-stones";
import { RushOverlayTutorialModal } from "./components/RushOverlayTutorialModal";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";

// Dofus defs pour récupération des visuels d'œufs
const DOFUS_DEFS: Record<string, { label: string; imageUrl: string; color: string }> = {
  argente: { label: "Argenté", imageUrl: "/module-dofus/Dofus_Argente.png", color: "#a8c0d6" },
  argente_scintillant: { label: "Arg. Scintillant", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png", color: "#c0c0c0" },
  cawotte: { label: "Cawotte", imageUrl: "/module-dofus/Dofus_Cawotte.png", color: "#f59e0b" },
  dokoko: { label: "Dokoko", imageUrl: "/module-dofus/Dofus_Dokoko.png", color: "#a3e635" },
  emeraude: { label: "Émeraude", imageUrl: "/module-dofus/Dofus_Emeraude.png", color: "#10b981" },
  pourpre: { label: "Pourpre", imageUrl: "/module-dofus/Dofus_Pourpre.png", color: "#ef4444" },
  turquoise: { label: "Turquoise", imageUrl: "/module-dofus/Dofus_Turquoise.png", color: "#06b6d4" },
  vulbis: { label: "Vulbis", imageUrl: "/module-dofus/Dofus_Vulbis.png", color: "#f97316" },
  ocre: { label: "Ocre", imageUrl: "/assets/icons/ocre.png", color: "#eab308" },
  ebene: { label: "Ébène", imageUrl: "/module-dofus/Dofus_Ebene.png", color: "#6366f1" },
  ivoire: { label: "Ivoire", imageUrl: "/module-dofus/Dofus_Ivoire.png", color: "#f1f5f9" },
  abyssal: { label: "Abyssal", imageUrl: "/module-dofus/Dofus_Abyssal.png", color: "#3b82f6" },
  sylvestre: { label: "Sylvestre", imageUrl: "/module-dofus/Dofus_Sylvestre.png", color: "#39bc95" },
  dolmanax: { label: "Dolmanax", imageUrl: "/module-dofus/Dofus_Dolmanax.png", color: "#ef4444" },
  des_glaces: { label: "Des Glaces", imageUrl: "/module-dofus/Dofus_Des_Glaces.png", color: "#93c5fd" },
  du_cauchemar: { label: "Du Cauchemar", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png", color: "#7c3aed" },
  cauchemar: { label: "Du Cauchemar", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png", color: "#7c3aed" },
  des_veilleurs: { label: "Des Veilleurs", imageUrl: "/module-dofus/Dofus_Veilleur.png", color: "#38bdf8" },
  domakuro: { label: "Domakuro", imageUrl: "/module-dofus/Dofus_Domakuro.png", color: "#84cc16" },
  dorigami: { label: "Dorigami", imageUrl: "/module-dofus/Dofus_Dorigami.png", color: "#f472b6" },
  tachete: { label: "Tacheté", imageUrl: "/module-dofus/Dofus_Tachete.png", color: "#c084fc" },
  dom_de_pin: { label: "Dom de Pin", imageUrl: "/module-dofus/Dom_De_Pin.png", color: "#a3e635" },
};

type Props = {
  guildId?: string;
  guide: { id: string; name: string; slug: string; description?: string; imageUrl?: string };
  milestones: RushMilestone[];
  allProgress?: GuideProgressRow[];
  altPseudo?: string | null;
  /** Personnage courant (principal ou mule) pour l'affichage. */
  character?: { pseudo: string; classe: string | null; isMain: boolean };
  onClose?: () => void;
  /** Mode invité / démo sans compte ni guilde */
  isGuest?: boolean;
  /**
   * Préfixe des trois clés de progression invité. La page publique le calcule en
   * fonction du PERSONNAGE déclaré (classe + pseudo + serveur) ; l'overlay ne
   * devine rien : il lit exactement le même emplacement (voir `@/lib/guest-progress`).
   * Par défaut : `sigil_guest_<slug>_` (progression sans personnage).
   */
  guestStoragePrefix?: string;
  /**
   * Faux quand la fenêtre est la popup `about:blank` de secours (navigateur sans
   * Document PiP, ex. Opera GX) → bandeau "fenêtre non épinglée". Vrai par défaut
   * (vraie PiP toujours-au-dessus, ou page overlay directe).
   */
  pinned?: boolean;
  /**
   * Quête Ocre du membre (Metamob lié) — **overlay interne uniquement** : le guide
   * public n'a ni guilde ni compte, donc aucun bouton. `null`/absent ⇒ masqué.
   */
  ocre?: OcrePanelData | null;
};

export default function GuideOverlayClient({
  guildId = "public",
  guide,
  milestones: rawMilestones,
  allProgress = [],
  altPseudo = null,
  character,
  onClose,
  isGuest = false,
  guestStoragePrefix,
  pinned = true,
  ocre = null,
}: Props) {
  const effectiveAltPseudo = altPseudo ?? undefined;
  // Repli si le personnage n'est pas fourni (accès direct à la page overlay).
  const overlayCharacter = useMemo(
    () =>
      character ?? {
        pseudo: effectiveAltPseudo || "Principal",
        classe: null,
        isMain: !effectiveAltPseudo,
      },
    [character, effectiveAltPseudo]
  );

  // La NAVIGATION ne porte que sur les CHAPITRES : les bannières (séparateur, encart
  // CONSEIL/TIPS, « Dofus obtenu ») ne sont pas des étapes — ni case à cocher, ni « 0/0 »,
  // ni titre de chapitre. Elles s'affichent dans le FLUX de leur chapitre, à leur place
  // chronologique (`bannersForChapter`), et on les retrouve dès qu'on ouvre ce chapitre,
  // quelle que soit la façon d'y arriver. Règle partagée `isNonCheckableBlock`.
  const milestones = useMemo(
    () => rawMilestones.filter((ms) => !isNonCheckableBlock(ms)),
    [rawMilestones]
  );

  // Détecte le Dofus associé à un jalon (via dofusId insensible aux accents, ou par correspondance du titre).
  const getMsDofus = useCallback((ms?: RushMilestone | null) => {
    if (!ms) return null;
    const norm = (s?: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (ms.dofusId) {
      const k = norm(ms.dofusId);
      for (const [key, d] of Object.entries(DOFUS_DEFS)) {
        if (norm(key) === k) return d;
      }
    }
    const t = norm(ms.title);
    for (const [key, d] of Object.entries(DOFUS_DEFS)) {
      if (t.includes("dofus " + norm(key)) || (d.label && t.includes(norm(d.label)))) return d;
    }
    return null;
  }, []);

  // ─── Thème Clair / Sombre ─────────────────────────────────────────────────
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigil_overlay_theme");
      if (saved === "light") setIsLightMode(true);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setIsLightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sigil_overlay_theme", next ? "light" : "dark");
      } catch {}
      toast(next ? "☀️ Mode Clair activé" : "🌙 Mode Sombre activé", { duration: 1200 });
      return next;
    });
  }, []);

  // ─── Mode compact (jeu) ───────────────────────────────────────────────────
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [showResources, setShowResources] = useState<boolean>(false);
  const [showOcre, setShowOcre] = useState<boolean>(false);
  const [membersModal, setMembersModal] = useState<{ title: string; members: OverlayMember[] } | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Détection fiable de la taille RÉELLE du panneau overlay (le `matchMedia` sur
  // `window` ne reflète pas toujours la largeur d'un PiP / panneau redimensionnable).
  // On observe le conteneur racine avec un ResizeObserver.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [overlaySmall, setOverlaySmall] = useState<boolean>(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect?.width ?? el.clientWidth;
      const h = entry?.contentRect?.height ?? el.clientHeight;
      setOverlaySmall(w < 580 || h < 640);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openChapterMembers = useCallback((members: OverlayMember[]) => {
    setMembersModal({ title: "Sur ce chapitre", members });
  }, []);

  // Mode jeu: replie l'overlay en mode compact.
  const enterGameMode = useCallback(() => {
    setIsCompactMode(true);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      window.close();
    } catch {
      // window.close() refuse: on reduit l'overlay en mode compact plutot que de rien faire
      setIsCompactMode(true);
    }
  }, [onClose]);

  // ─── Progression Locale Optimiste / Guest LocalStorage ───────────────────────
  // Le préfixe vient de l'appelant quand il est fourni (page publique : progression
  // PAR PERSONNAGE), sinon on retombe sur l'emplacement historique sans personnage.
  const storagePrefix = guestStoragePrefix || `sigil_guest_${guide.slug}_`;

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}completed_ms`);
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    const s = new Set<string>();
    milestones.forEach((ms) => {
      if (ms.playerProgress?.[0]?.isCompleted) s.add(ms.id);
    });
    return s;
  });

  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}steps`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const m = new Map<string, Set<string>>();
          for (const [k, v] of Object.entries(parsed)) {
            m.set(k, new Set(v as string[]));
          }
          return m;
        }
      } catch {}
    }
    const m = new Map<string, Set<string>>();
    milestones.forEach((ms) => {
      const ids = ms.playerProgress?.[0]?.completedStepIds;
      if (Array.isArray(ids)) m.set(ms.id, new Set(ids));
    });
    return m;
  });

  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}bookmarks`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return new Map(Object.entries(parsed));
        }
      } catch {}
    }
    const m = new Map<string, string>();
    milestones.forEach((ms) => {
      const bk = ms.playerProgress?.[0]?.bookmarkedSeqId;
      if (bk) m.set(ms.id, bk);
    });
    return m;
  });

  // ─── Synchro dashboard ↔ overlay (BroadcastChannel, même navigateur) ─────
  // Aligne « ce qui est coché » entre la fenêtre du module et l'overlay.
  useGuideProgressSync(
    // Invité : canal par PERSONNAGE (même identifiant que la page publique, qui
    // transmet son préfixe) ; membre : canal de guilde habituel.
    isGuest ? storagePrefix : guildId,
    guide.slug,
    { completedIds, completedStepsByMs, bookmarksByMs },
    { setCompletedIds, setCompletedStepsByMs, setBookmarksByMs }
  );

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  // Modale de détail d'une quête (remplace l'ancien accordéon).
  const [detailSeq, setDetailSeq] = useState<{ ms: RushMilestone; seq: RushSequence } | null>(null);

  const toggleHideCompleted = useCallback(() => {
    setHideCompleted((prev) => {
      const next = !prev;
      toast(next ? "👁️ Quêtes faites masquées" : "👁️ Toutes les quêtes affichées", { duration: 1200 });
      return next;
    });
  }, []);

  // ─── Pagination de Milestone Active ─────────────────────────────────────────
  const defaultMsIndex = useMemo(() => {
    const idx = milestones.findIndex((ms) => !completedIds.has(ms.id));
    return idx >= 0 ? idx : 0;
  }, [milestones, completedIds]);

  const [currentMsIndex, setCurrentMsIndex] = useState<number>(defaultMsIndex);
  const currentMs = milestones[currentMsIndex] || milestones[0] || null;

  const goToNextMs = useCallback(() => {
    // Prochain bloc qui reste à valider — les bandeaux (séparateur, encart CONSEIL/TIPS,
    // « Dofus obtenu ») ne sont jamais sautés : règle pure dans `nextBlockIndex`.
    const next = nextBlockIndex(milestones, currentMsIndex, completedIds);
    if (next !== null) {
      setCurrentMsIndex(next);
      setDetailSeq(null);
    }
  }, [currentMsIndex, milestones, completedIds]);

  const goToPrevMs = useCallback(() => {
    if (currentMsIndex > 0) {
      setCurrentMsIndex((v) => v - 1);
      setDetailSeq(null);
    }
  }, [currentMsIndex]);

  const selectChapter = useCallback(
    (msId: string) => {
      const idx = milestones.findIndex((m) => m.id === msId);
      if (idx >= 0 && idx !== currentMsIndex) {
        setCurrentMsIndex(idx);
        setDetailSeq(null);
      }
    },
    [milestones, currentMsIndex]
  );

  // ─── Recherche ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && !isCompactMode) {
        e.preventDefault();
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        if (search) {
          setSearch("");
          searchRef.current?.blur();
        } else if (!isCompactMode) {
          setIsCompactMode(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search, isCompactMode]);

  // ─── Stats Globales ───────────────────────────────────────────────────────
  // Les séquences info (bandeaux/conseils) ne comptent pas dans la progression.
  const contentSeqs = (seqs: RushSequence[]) => seqs.filter((s) => !isInfoSequence(s));

  // Position du bloc courant dans la numérotation des CHAPITRES : un bandeau n'est pas
  // numéroté (« 12 / 45 » ne doit pas compter les séparateurs ni les encarts CONSEIL/TIPS).
  const chapterPos = useMemo(
    () => rushChapterPosition(milestones, currentMs?.id),
    [milestones, currentMs?.id]
  );

  // Bannières à lire AVEC ce chapitre, à leur place chronologique : celles qui l'introduisent
  // au-dessus du contenu, celles de fin de guide en dessous (règle partagée avec le
  // dashboard : « les bannières restent collées au chapitre qui les suit »).
  const banners = useMemo(
    () => bannersForChapter(rawMilestones, currentMs?.id),
    [rawMilestones, currentMs?.id]
  );
  const totalSteps = useMemo(() => milestones.reduce((acc, ms) => acc + contentSeqs(ms.sequences).length, 0), [milestones]);
  const completedSteps = useMemo(() => {
    let n = 0;
    for (const ms of milestones) n += completedStepsByMs.get(ms.id)?.size ?? 0;
    return n;
  }, [milestones, completedStepsByMs]);
  const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // ─── Quête Ocre (Metamob) ─────────────────────────────────────────────────
  // Réservé à l'overlay INTERNE d'un membre dont le compte Metamob est lié : le guide
  // public (`isGuest`) et l'overlay sans guilde n'ont ni compte ni progression Ocre,
  // donc aucun bouton n'est rendu — et aucun calcul n'est fait.
  const ocreEnabled = !isGuest && !!ocre && !!guildId && guildId !== "public";
  const ocreSummary = useMemo(() => {
    if (!ocreEnabled || !ocre) return null;
    const plan = buildOcrePlan(ocre);
    return { missing: plan.progress.missing, percent: plan.progress.percent };
  }, [ocre, ocreEnabled]);

  // Ressources agrégées sur TOUT le guide (bouton "Ressources" du header).
  const allResources = useMemo(() => aggregateRushResources(milestones), [milestones]);

  const currentMsSeqs = contentSeqs(currentMs?.sequences || []);
  const currentMsDoneSeqs = currentMs ? completedStepsByMs.get(currentMs.id) || new Set<string>() : new Set<string>();
  const currentMsDoneCount = currentMsSeqs.filter((s) => currentMsDoneSeqs.has(s.id)).length;
  const currentMsPct =
    currentMsSeqs.length > 0
      ? Math.round((currentMsDoneCount / currentMsSeqs.length) * 100)
      : completedIds.has(currentMs?.id || "")
        ? 100
        : 0;

  // Image de Dofus associée au guide ou au milestone
  const dofusImage = useMemo(() => {
    if (guide.slug.includes("sylvestre") || guide.name.toLowerCase().includes("sylvestre")) {
      return "/module-dofus/Dofus_Sylvestre.png";
    }
    if (currentMs?.dofusId && DOFUS_DEFS[currentMs.dofusId]) {
      return DOFUS_DEFS[currentMs.dofusId].imageUrl;
    }
    return guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png";
  }, [currentMs, guide.imageUrl, guide.slug, guide.name]);

  // ─── Membres ayant posé un repère (par séquence) ────────────────────────────
  // Le "repère" d'un membre = son `currentStep`. Selon l'appelant (dashboard Rush
  // ou overlay) il peut être stocké brut (`seqId`) ou préfixé (`seq:<seqId>`).
  // On normalise puis on compare directement à l'id de séquence (plus de mapping
  // step-keys Ganymède qui ne correspondait jamais → avatars vides).
  const validSeqIds = useMemo(() => {
    return new Set(currentMs?.sequences.map((s) => s.id) ?? []);
  }, [currentMs]);

  const bookmarkersBySeq = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string }[]>();
    if (!currentMs) return map;
    for (const row of allProgress) {
      if (row.milestoneId !== currentMs.id || !row.currentStep) continue;
      const raw = String(row.currentStep);
      const seqId = raw.startsWith("seq:") ? raw.slice(4) : raw;
      if (!validSeqIds.has(seqId)) continue;
      const list = map.get(seqId) || [];
      list.push({ name: row.userName, avatar: row.userAvatar });
      map.set(seqId, list);
    }
    return map;
  }, [allProgress, currentMs, validSeqIds]);

  // ─── Prérequis (gating de validation) ─────────────────────────────────────
  // Une quête ne peut être cochée que si toutes ses quêtes prérequis sont validées.
  const gateAllCompleted = useMemo(() => {
    const all = new Set<string>();
    // Un bloc entièrement validé compte toutes ses quêtes : sinon les ressources
    // restantes (et le gating des prérequis) ignorent ses séquences si elles
    // n'ont pas été cochées une à une.
    for (const ms of milestones) {
      if (completedIds.has(ms.id)) {
        for (const s of ms.sequences) all.add(s.id);
        continue;
      }
      const steps = completedStepsByMs.get(ms.id);
      if (steps) for (const id of steps) all.add(id);
    }
    return all;
  }, [milestones, completedIds, completedStepsByMs]);
  // Mode « restantes » : on exclut les ressources des quêtes déjà cochées
  // (décrément en direct selon l'avancement).
  const remainingResources = useMemo(
    () => aggregateRushResources(milestones, gateAllCompleted),
    [milestones, gateAllCompleted]
  );



  const prereqBySeq = useMemo(() => {
    const map = new Map<string, RushPrereqRef[]>();
    if (!currentMs) return map;
    for (const seq of currentMs.sequences) {
      map.set(seq.id, getPrereqRefs(seq, milestones));
    }
    return map;
  }, [currentMs, milestones]);

  const getSeqGate = useCallback(
    (seqId: string): { locked: boolean; prereqs: RushPrereqRef[] } => {
      const refs = prereqBySeq.get(seqId) || [];
      return { locked: refs.some((r) => !gateAllCompleted.has(r.seqId)), prereqs: refs };
    },
    [prereqBySeq, gateAllCompleted]
  );

  const handleGoToPrereq = useCallback(
    (seqId: string, milestoneId: string) => {
      const idx = milestones.findIndex((m) => m.id === milestoneId);
      if (idx >= 0) {
        setCurrentMsIndex(idx);
        setDetailSeq(null);
      }
      window.setTimeout(() => {
        document.getElementById(`overlay-seq-${seqId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 90);
    },
    [milestones, currentMsIndex]
  );

  // ─── Présence communauté : membres ayant un repère sur ce chapitre ─────────
  const chapterMembers = useMemo(() => {
    if (!currentMs) return [];
    const seen = new Set<string>();
    const out: { name: string; avatar?: string; stepId?: string }[] = [];
    for (const row of allProgress) {
      if (row.milestoneId !== currentMs.id) continue;
      if (seen.has(row.profileId)) continue;
      seen.add(row.profileId);
      const raw = row.currentStep ? String(row.currentStep) : "";
      out.push({
        name: row.userName,
        avatar: row.userAvatar,
        stepId: raw ? (raw.startsWith("seq:") ? raw.slice(4) : raw) : undefined,
      });
    }
    return out;
  }, [allProgress, currentMs]);


  // ─── Mutations Optimistes ──────────────────────────────────────────────────
  const handleToggleMs = useCallback(
    async (ms: RushMilestone) => {
      if (loadingIds.has(ms.id)) return;
      const was = completedIds.has(ms.id);
      setCompletedIds((prev) => {
        const n = new Set(prev);
        was ? n.delete(ms.id) : n.add(ms.id);
        return n;
      });
      // Chapitre validé/dévalidé d'un coup → synchronise les quêtes cochées
      // (sinon les cases ne se cochent pas toutes et les ressources ne sont
      // pas décomptées pour ce chapitre).
      const prevSteps = new Map(completedStepsByMs);
      setCompletedStepsByMs((prev) => {
        const n = new Map(prev);
        n.set(ms.id, was ? new Set<string>() : new Set(ms.sequences.map((s) => s.id)));
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const nextCompleted = was
              ? Array.from(completedIds).filter((id) => id !== ms.id)
              : [...Array.from(completedIds), ms.id];
            localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(nextCompleted));
            const stepsObj: Record<string, string[]> = {};
            prevSteps.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            stepsObj[ms.id] = was ? [] : ms.sequences.map((s) => s.id);
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));

            if (!was && bookmarksByMs.get(ms.id)) {
              setBookmarksByMs((prev) => {
                const n = new Map(prev);
                n.delete(ms.id);
                localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(n)));
                return n;
              });
            }
          } catch {}
        }
        if (!was) goToNextMs();
        return;
      }
      setLoadingIds((prev) => new Set([...prev, ms.id]));
      try {
        const res = await toggleMilestoneProgress(guildId, ms.id, !was, effectiveAltPseudo);
        if (!(res as any)?.success) throw new Error("Échec mutation");
        // Chapitre validé d'un coup → son repère est retiré (soit validé, soit repère).
        if (!was && bookmarksByMs.get(ms.id)) {
          setBookmarksByMs((prev) => {
            const n = new Map(prev);
            n.delete(ms.id);
            return n;
          });
          await setRushBookmark(guildId, ms.id, null, effectiveAltPseudo).catch(() => {});
        }
        // Chapitre complété d'un coup → passer automatiquement au suivant.
        if (!was) goToNextMs();
      } catch {
        setCompletedStepsByMs(prevSteps);
        setCompletedIds((prev) => {
          const n = new Set(prev);
          was ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev);
          n.delete(ms.id);
          return n;
        });
      }
    },
    [completedIds, completedStepsByMs, loadingIds, bookmarksByMs, guildId, effectiveAltPseudo, goToNextMs]
  );

  const handleToggleSeq = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      const cur = new Set(completedStepsByMs.get(ms.id) || []);
      const was = cur.has(seqId);
      if (!was && getSeqGate(seqId).locked) {
        toast.warning("Terminez d'abord les prérequis de cette quête.");
        return;
      }
      was ? cur.delete(seqId) : cur.add(seqId);
      const contentSeqs = ms.sequences.filter((s) => !isInfoSequence(s));
      const allChecked = contentSeqs.length > 0 && contentSeqs.every((s) => cur.has(s.id));
      const prevMap = new Map(completedStepsByMs);
      const prevActive = completedIds.has(ms.id);
      // Cascade décoche : décocher la cible décoche aussi les quêtes qui en dépendent.
      const cascadeMsIds = new Map<string, Set<string>>();
      const cascadeSeqIds = new Set<string>();
      if (was) {
        const cascade = collectCascadeUncheck(seqId, milestones, gateAllCompleted);
        for (const cid of cascade) {
          if (cid === seqId) continue;
          const owner = milestones.find((m) => m.sequences.some((s) => s.id === cid));
          if (!owner) continue;
          cascadeSeqIds.add(cid);
          if (!cascadeMsIds.has(owner.id)) cascadeMsIds.set(owner.id, new Set<string>());
          cascadeMsIds.get(owner.id)!.add(cid);
        }
      }
      setCompletedStepsByMs((prev) => {
        const n = new Map(prev);
        n.set(ms.id, cur);
        for (const [mid, set] of cascadeMsIds) {
          const s = new Set(n.get(mid) || []);
          for (const cid of set) s.delete(cid);
          n.set(mid, s);
        }
        return n;
      });
      setCompletedIds((prev) => {
        const n = new Set(prev);
        allChecked ? n.add(ms.id) : n.delete(ms.id);
        for (const [mid, set] of cascadeMsIds) {
          const m = milestones.find((mm) => mm.id === mid);
          if (!m) continue;
          const reg = m.sequences.filter((s) => !isInfoSequence(s));
          const steps = new Set(completedStepsByMs.get(mid) || []);
          for (const cid of set) steps.delete(cid);
          const done = reg.length > 0 && reg.every((s) => steps.has(s.id));
          done ? n.add(mid) : n.delete(mid);
        }
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            completedStepsByMs.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            stepsObj[ms.id] = Array.from(cur);
            for (const [mid, set] of cascadeMsIds) {
              const currentSt = new Set(completedStepsByMs.get(mid) || []);
              for (const cid of set) currentSt.delete(cid);
              stepsObj[mid] = Array.from(currentSt);
            }
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));

            const nextCompleted = new Set(completedIds);
            allChecked ? nextCompleted.add(ms.id) : nextCompleted.delete(ms.id);
            for (const [mid, set] of cascadeMsIds) {
              const m = milestones.find((mm) => mm.id === mid);
              if (!m) continue;
              const reg = m.sequences.filter((s) => !isInfoSequence(s));
              const steps = new Set(completedStepsByMs.get(mid) || []);
              for (const cid of set) steps.delete(cid);
              const done = reg.length > 0 && reg.every((s) => steps.has(s.id));
              done ? nextCompleted.add(mid) : nextCompleted.delete(mid);
            }
            localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(Array.from(nextCompleted)));

            if (!was && bookmarksByMs.get(ms.id) === seqId) {
              const nextBk = new Map(bookmarksByMs);
              nextBk.delete(ms.id);
              setBookmarksByMs(nextBk);
              localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(nextBk)));
            }
          } catch {}
        }
        return;
      }
      try {
        const res = await setRushSequenceProgress(guildId, ms.id, Array.from(cur), effectiveAltPseudo);
        if (!(res as any)?.success) throw new Error("Échec mutation");
        // Validation → le repère (« je suis ici ») de cette quête est retiré :
        // une quête est soit validée, soit marquée d'un repère, jamais les deux.
        if (!was && bookmarksByMs.get(ms.id) === seqId) {
          setBookmarksByMs((prev) => {
            const n = new Map(prev);
            n.delete(ms.id);
            return n;
          });
          await setRushBookmark(guildId, ms.id, null, effectiveAltPseudo).catch(() => {});
        }
        // Cascade : persiste les milestones dépendants (quêtes décochées).
        for (const [mid, set] of cascadeMsIds) {
          const steps = new Set(completedStepsByMs.get(mid) || []);
          for (const cid of set) steps.delete(cid);
          await setRushSequenceProgress(guildId, mid, Array.from(steps), effectiveAltPseudo).catch(() => {});
        }
        // Quête(s) d'alignement : applique (coche) / restaure (décoche) l'alignement.
        for (const sid of [seqId, ...cascadeSeqIds]) {
          const owner = milestones.find((m) => m.sequences.some((s) => s.id === sid));
          const alignTag = owner?.sequences
            .find((s) => s.id === sid)
            ?.activityTags?.some((t) => t.type === "alignment_set");
          if (!alignTag) continue;
          const ares = await applyRushAlignmentFromSequence(guildId, sid, !was, effectiveAltPseudo);
          if ((ares as any)?.success) {
            toast.success(
              was
                ? "↩️ Alignement restauré"
                : `↦ Alignement ${(ares as any).camp} ${(ares as any).level}`,
              { duration: 2000 }
            );
          }
        }
      } catch {
        setCompletedStepsByMs(prevMap);
        setCompletedIds((prev) => {
          const n = new Set(prev);
          prevActive ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      }
    },
    [completedStepsByMs, completedIds, bookmarksByMs, guildId, effectiveAltPseudo, getSeqGate]
  );

  // Réinitialise TOUTE la progression du guide (synchro serveur + dashboard),
  // et vide l'état local de l'overlay (blocs cochés, quêtes, repères).
  const handleResetGuide = useCallback(async () => {
    if (isGuest) {
      setCompletedIds(new Set());
      setCompletedStepsByMs(new Map());
      setBookmarksByMs(new Map());
      setDetailSeq(null);
      setCurrentMsIndex(0);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`${storagePrefix}completed_ms`);
          localStorage.removeItem(`${storagePrefix}steps`);
          localStorage.removeItem(`${storagePrefix}bookmarks`);
        } catch {}
      }
      toast.success("Guide réinitialisé.");
      return;
    }
    try {
      const res = await resetGuideProgress(guildId, guide.id, effectiveAltPseudo);
      if ((res as any)?.success) {
        setCompletedIds(new Set());
        setCompletedStepsByMs(new Map());
        setBookmarksByMs(new Map());
        setDetailSeq(null);
        // Force le recalcul de la progression globale (header) à 0.
        setCurrentMsIndex(0);
        toast.success("Guide réinitialisé.");
      } else {
        toast.error("Échec de la réinitialisation.");
      }
    } catch {
      toast.error("Erreur réseau lors de la réinitialisation.");
    }
  }, [guildId, guide.id, effectiveAltPseudo, isGuest, storagePrefix]);

  const handleBookmark = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      const isAlready = bookmarksByMs.get(ms.id) === seqId;
      // Une quête validée ne peut pas porter de repère : soit validée, soit repère.
      if (!isAlready && (completedStepsByMs.get(ms.id)?.has(seqId) || getSeqGate(seqId).locked)) {
        toast.info(
          completedStepsByMs.get(ms.id)?.has(seqId)
            ? "Cette quête est déjà validée."
            : "Terminez d'abord les prérequis de cette quête."
        );
        return;
      }
      const prevMap = new Map(bookmarksByMs);
      setBookmarksByMs((prev) => {
        // Préserve les repères des AUTRES blocs (1 `bookmarksByMs` = Map<msId,seqId>).
        const n = new Map(prev);
        if (!isAlready) n.set(ms.id, seqId);
        else n.delete(ms.id);
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const nextBk = new Map(bookmarksByMs);
            if (!isAlready) nextBk.set(ms.id, seqId);
            else nextBk.delete(ms.id);
            localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(nextBk)));
          } catch {}
        }
        toast.success(isAlready ? "Repère retiré" : "📍 Repère posé ici !", { duration: 1500 });
        return;
      }
      try {
        await setRushBookmark(guildId, ms.id, isAlready ? null : seqId, effectiveAltPseudo);
        toast.success(isAlready ? "Repère retiré" : "📍 Repère posé ici !", { duration: 1500 });
      } catch {
        setBookmarksByMs(prevMap);
        toast.error("Erreur repère");
      }
    },
    [bookmarksByMs, completedStepsByMs, guildId, effectiveAltPseudo, getSeqGate, isGuest, storagePrefix]
  );

  // Filtrage des quêtes du milestone courant
  const visibleSequences = useMemo(() => {
    if (!currentMs) return [];
    let seqs = currentMs.sequences;
    if (search.trim()) {
      const q = search.toLowerCase();
      seqs = seqs.filter(
        (s) =>
          s.subGuideName.toLowerCase().includes(q) ||
          (s.tips && s.tips.toLowerCase().includes(q)) ||
          (s.dungeon?.name && s.dungeon.name.toLowerCase().includes(q))
      );
    }
    if (hideCompleted) {
      seqs = seqs.filter((s) => !currentMsDoneSeqs.has(s.id));
    }
    return seqs;
  }, [currentMs, search, hideCompleted, currentMsDoneSeqs]);

  // Recherche GLOBALE : matche sur TOUT le guide (tous chapitres), pas seulement
  // le milestone courant. Un clic sur un résultat bascule vers son chapitre.
  const globalResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const out: { ms: RushMilestone; seq: RushSequence }[] = [];
    for (const ms of milestones) {
      for (const seq of ms.sequences) {
        if (isInfoSequence(seq)) continue;
        const dungeons = (seq as any).dungeons as { name?: string }[] | undefined;
        const hit =
          (seq.subGuideName || "").toLowerCase().includes(q) ||
          (seq.tips || "").toLowerCase().includes(q) ||
          (seq.note || "").toLowerCase().includes(q) ||
          (seq.dungeon?.name || "").toLowerCase().includes(q) ||
          !!dungeons?.some((d) => (d.name || "").toLowerCase().includes(q));
        if (hit) out.push({ ms, seq });
      }
    }
    return out;
  }, [milestones, search]);

  const bookmarkSeqId = currentMs ? bookmarksByMs.get(currentMs.id) || null : null;
  const compactObjective = currentMs
    ? getNextObjective(currentMs.sequences, currentMsDoneSeqs, bookmarkSeqId, milestones, gateAllCompleted)
    : null;

  const msDone = currentMs ? completedIds.has(currentMs.id) : false;
  const currentMsDofus = currentMs ? getMsDofus(currentMs) : null;
  const currentMsTotal = currentMsSeqs.length;
  const dofusDone = !!currentMsDofus && currentMsTotal > 0 && currentMsDoneCount >= currentMsTotal;

  // Contexte exact de l'étape courante, pré-rempli dans le retour bug (overlay).
  const overlayBugContext = useMemo(() => {
    if (!currentMs) return undefined;
    const parts = [
      chapterPos.index > 0 ? `Chapitre ${chapterPos.index}/${chapterPos.total}` : "Bloc informatif",
      currentMs.title || "Jalon",
    ];
    const objective = compactObjective;
    if (objective) parts.push(`Étape : ${objective.subGuideName || objective.subGuideRef || "?"}`);
    return parts.join(" · ");
  }, [currentMs, chapterPos, compactObjective]);

  // ─── Rendu d'une BANNIÈRE (bloc non cochable) ──────────────────────────────
  // Le MÊME composant partagé que le dashboard et le guide public : un séparateur, un
  // encart CONSEIL/TIPS ou un « Dofus obtenu » se lit à sa place dans le flux, jamais comme
  // une étape (aucune case à cocher, aucun numéro, aucun « n/N »).
  const renderBanner = (ms: RushMilestone) => {
    if (ms.type === "SEPARATEUR") {
      return (
        <RushSeparatorBanner
          key={ms.id}
          title={ms.title}
          description={ms.description}
          imageUrl={ms.imageUrl}
          accentColor={ms.accentColor}
          className="my-3"
        />
      );
    }
    if (ms.type === "INFO") {
      return (
        <RushInfoBanner
          key={ms.id}
          title={ms.description && ms.title && !ms.description.startsWith(ms.title) ? ms.title : null}
          imageUrl={ms.imageUrl}
          accentColor={ms.accentColor}
          className="my-3"
        >
          <RushRichText text={ms.tips || ms.description || ms.title} />
        </RushInfoBanner>
      );
    }
    const dofus = getMsDofus(ms);
    return (
      <div key={ms.id} className="flex flex-col items-center gap-3 py-10 px-6 text-center select-none max-w-md mx-auto">
        {dofus ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dofus.imageUrl} alt={dofus.label} title={dofus.label} className="h-12 w-12 object-contain drop-shadow" />
        ) : ms.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ms.imageUrl} alt={ms.title} className="h-12 w-12 object-contain drop-shadow" />
        ) : null}
        <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: ms.accentColor || "#a3e635" }}>
          ✦ Dofus obtenu ✦
        </span>
        <h3 className={`font-serif text-lg font-black uppercase tracking-wide ${isLightMode ? "text-slate-900" : "text-[#f2f0e9]"}`}>
          {ms.title}
        </h3>
        {(ms.description || ms.tips) && (
          <p className={`text-[12px] leading-relaxed ${isLightMode ? "text-slate-500" : "text-[#929aa5]"}`}>
            <RushRichText text={ms.description || ms.tips} />
          </p>
        )}
        <div className="h-px w-28" style={{ background: `linear-gradient(90deg, transparent, ${ms.accentColor || "#a3e635"})` }} />
      </div>
    );
  };

  // ─── Rendu COMMUN ─────────────────────────────────────────────────────────
  // La fenêtre source et la fenêtre PiP (always-on-top) affichent le même
  // contenu. Seules les actions liées au cycle de vie de la fenêtre (fermer /
  // épingler / réduire) diffèrent selon le contexte.

  return (
    // `.light` bascule les jetons de thème pour tout le sous-arbre : les
    // composants du rush (carte de quête, modales détails/donjon/badges) ne se
    // peignent qu'avec `--surface`, `--border`, `--accent`… et suivent donc le
    // thème sans variante claire codée en dur. Sans cette classe, `<html>` porte
    // `.dark` et une modale sortie de l'arbre (portail) resterait sombre.
    <div
      ref={rootRef}
      className={`relative flex flex-col h-screen overflow-hidden select-none transition-colors ${isLightMode ? "light" : ""} ${
        isLightMode ? "bg-[#f8fafc] text-[#0f172a]" : "bg-[#090b0e] text-[#f2f0e9]"
      }`}
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <style>{`@media (prefers-reduced-motion: reduce){ *{transition:none!important; animation:none!important; } }`}</style>

      {/* Navigateur sans Document PiP (ex. Opera GX) : la fenêtre n'est pas épinglée */}
      {!pinned && <OverlayPinNotice />}

      {!isCompactMode ? (
        <>
          {/* ══ HEADER FIXE ══ */}
          <RushOverlayHeader
            guideName={guide.name}
            guideSlug={guide.slug}
            guildId={guildId}
            dofusImageUrl={dofusImage}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            overallPct={overallPct}
            isLightMode={isLightMode}
            isNarrow={overlaySmall}
            onToggleTheme={toggleTheme}
            onEnterCompact={enterGameMode}
            onOpenResources={() => setShowResources(true)}
            hideCompleted={hideCompleted}
            onToggleHideCompleted={toggleHideCompleted}
            onOpenTutorial={() => setShowTutorial(true)}
            bugContext={overlayBugContext}
            character={overlayCharacter}
            onResetGuide={handleResetGuide}
            isGuest={isGuest}
            ocre={ocreSummary}
            onOpenOcre={ocreEnabled ? () => setShowOcre(true) : undefined}
          />

          {/* ══ RECHERCHE ══ */}
          <RushOverlaySearch
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            isLightMode={isLightMode}
            ref={searchRef}
          />

          {/* ══ NAVIGATION CHAPITRES ══ */}
          <RushOverlayChapterTree
            chapters={milestones}
            activeMsId={currentMs?.id}
            onSelectChapter={selectChapter}
            completedMsIds={completedIds}
            doneByMs={completedStepsByMs}
            isLightMode={isLightMode}
          />


          {/* ══ BARRE CHAPITRE COURANT ══ */}
          {currentMs && (
            <div
              className={`flex items-center justify-between gap-2 px-4 py-2.5 border-y shrink-0 ${
                isLightMode ? "border-slate-200 bg-white" : "border-[#28303a]/60 bg-[#12161b]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleToggleMs(currentMs)}
                  aria-label={msDone ? "Marquer le chapitre comme non terminé" : "Marquer le chapitre comme terminé"}
                  className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-[#39bc95] focus-visible:outline-offset-1"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-md border transition-all ${
                      msDone
                        ? "bg-[#39bc95] border-[#39bc95] text-black"
                        : isLightMode
                          ? "border-slate-300 bg-white"
                          : "border-[#3a4d60] bg-[#0f1419]"
                    }`}
                  >
                    {msDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                </button>

                {/* Numéro et pourcentage ne valent que pour une ÉTAPE : un séparateur ou un
                    encart n'a aucune progression (« 0% » n'est pas une information). */}
                <span className="font-serif font-bold text-xs text-[#39bc95] shrink-0">{currentMsIndex + 1}.</span>

                {/* Icône Dofus à côté du bloc courant + animation à la complétion */}
                {currentMsDofus && (
                  <span className="relative shrink-0 flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentMsDofus.imageUrl}
                      alt={currentMsDofus.label}
                      title={currentMsDofus.label}
                      className={`h-5 w-5 object-contain drop-shadow ${dofusDone ? "animate-pulse" : ""}`}
                    />
                    {dofusDone && (
                      <span
                        className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#39bc95]"
                        style={{ boxShadow: "0 0 6px 2px rgba(57,188,149,0.7)" }}
                      />
                    )}
                  </span>
                )}

                <span
                  className={`font-serif font-bold text-xs truncate flex-1 leading-tight ${
                    isLightMode ? "text-slate-900" : "text-[#f2f0e9]"
                  }`}
                  title={currentMs.title}
                >
                  {currentMs.title || "Jalon"}
                </span>
                {dofusDone && (
                  <span className="shrink-0 rounded-full border border-[#39bc95]/50 bg-[#39bc95]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#39bc95]">
                    Dofus obtenu
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <span className={`text-[11px] font-mono font-bold mr-1 ${isLightMode ? "text-slate-500" : "text-[#929aa5]"}`}>
                  {currentMsPct}%
                </span>
              </div>
            </div>
          )}

          {/* L'objectif courant (« À FAIRE MAINTENANT ») a été retiré : la liste des quêtes
              juste en dessous dit déjà quoi faire, avec sa coordonnée et ses donjons —
              un encart doré qui répète la première ligne ne servait à rien (user, 21/09). */}

          {/* ══ PRÉSENCE COMMUNAUTÉ ══ */}
          {chapterMembers.length > 0 && (
            <button
              type="button"
              onClick={() =>
                openChapterMembers(
                  chapterMembers.map((m) => ({
                    name: m.name,
                    avatar: m.avatar,
                    subtitle: m.stepId ? "a posé un repère ici" : undefined,
                  }))
                )
              }
              title="Voir les membres sur ce chapitre"
              className="px-3 pt-2 flex items-center gap-2 text-left"
            >
              <Users className="w-3 h-3 text-[#39bc95]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#6e7784]">
                Sur ce chapitre
              </span>
              <span className="flex items-center -space-x-1.5">
                {chapterMembers.slice(0, 6).map((m, i) =>
                  m.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={m.avatar}
                      alt={m.name}
                      loading="lazy"
                      title={m.name}
                      className="w-5 h-5 rounded-full border border-[#39bc95]/40 object-cover"
                    />
                  ) : (
                    <span
                      key={i}
                      title={m.name}
                      className="w-5 h-5 rounded-full border border-[#39bc95]/40 bg-[#39bc95]/20 text-[#39bc95] flex items-center justify-center text-[8px] font-bold uppercase"
                    >
                      {m.name.charAt(0) || "?"}
                    </span>
                  )
                )}
              </span>
              {chapterMembers.length > 6 && (
                <span className="text-[9px] text-[#6e7784]">+{chapterMembers.length - 6}</span>
              )}
            </button>
          )}

          {/* ══ LISTE DES QUÊTES + DÉTAILS ══ */}
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2 custom-scrollbar">
            {/* Bannières qui INTRODUISENT ce chapitre — leur place chronologique dans le
                flux. Elles suivent le chapitre, donc on les retrouve dès qu'on l'ouvre
                (dropdown, précédent/suivant, repère) : c'est ce qui manquait. */}
            {!search.trim() && banners.before.map(renderBanner)}
            {search.trim() ? (
              globalResults.length === 0 ? (
                <div className="py-12 text-center text-[#929aa5] text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#39bc95] opacity-40" />
                  <p className="font-bold font-serif text-sm text-[#f2f0e9]">Aucune quête ne correspond</p>
                  <p className="text-[11px] text-[#6e7784] mt-0.5">Essayez un autre mot-clé.</p>
                </div>
              ) : (
                globalResults.map(({ ms, seq }, i) => {
                  const showMsHeader = i === 0 || globalResults[i - 1].ms.id !== ms.id;
                  const isSeqDone = (completedStepsByMs.get(ms.id) || new Set<string>()).has(seq.id);
                  const gate = getSeqGate(seq.id);
                  return (
                    <React.Fragment key={seq.id}>
                      {showMsHeader && (
                        <div className="flex items-center gap-1.5 pt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#d5a94e]">
                          <span className="w-1 h-1 rounded-full bg-[#d5a94e]" />
                          {ms.title || "Jalon"}
                        </div>
                      )}
                      <RushOverlayQuestListItem
                        seq={seq}
                        guildId={guildId}
                        isDone={isSeqDone}
                        isBookmarked={bookmarksByMs.get(ms.id) === seq.id}
                        isLightMode={isLightMode}
                        isLocked={gate.locked}
                        prereqs={gate.prereqs}
                        onGoToPrereq={handleGoToPrereq}
                        onToggle={() => handleToggleSeq(ms, seq.id)}
                        onBookmark={() => handleBookmark(ms, seq.id)}
                        onOpenDetail={() => setDetailSeq({ ms, seq })}
                        bookmarkers={[]}
                      />
                    </React.Fragment>
                  );
                })
              )
            ) : visibleSequences.length === 0 ? (
              <div className="py-12 text-center text-[#929aa5] text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#39bc95] opacity-40" />
                <p className="font-bold font-serif text-sm text-[#f2f0e9]">
                  {search.trim() ? "Aucune quête ne correspond" : "Toutes les quêtes sont terminées !"}
                </p>
                <p className="text-[11px] text-[#6e7784] mt-0.5">
                  {search.trim() ? "Essayez un autre mot-clé." : "Passez au chapitre suivant avec le bouton Suivant."}
                </p>
              </div>
            ) : currentMs ? (
              visibleSequences.map((seq) => {
                // Les séquences info (conseils/bandeaux) ne sont pas des quêtes cochables.
                if (isInfoSequence(seq)) {
                  // Bandeau d'une séquence informative : composant PARTAGÉ (dashboard,
                  // guide public, overlay) — rien à cocher, ce n'est pas une quête.
                  return (
                    <RushInfoSequenceBanner key={seq.id} seq={seq} accentColor={currentMs.accentColor} />
                  );
                }
                const isSeqDone = currentMsDoneSeqs.has(seq.id);
                const gate = getSeqGate(seq.id);
                const isBookmarked = bookmarkSeqId === seq.id;
                return (
                  <React.Fragment key={seq.id}>
                    <RushOverlayQuestListItem
                      seq={seq}
                      guildId={guildId}
                      isDone={isSeqDone}
                      isBookmarked={isBookmarked}
                      isLightMode={isLightMode}
                      isLocked={gate.locked}
                      prereqs={gate.prereqs}
                      onGoToPrereq={handleGoToPrereq}
                      onToggle={() => handleToggleSeq(currentMs, seq.id)}
                      onBookmark={() => handleBookmark(currentMs, seq.id)}
                      onOpenDetail={() => setDetailSeq({ ms: currentMs, seq })}
                      bookmarkers={bookmarkersBySeq.get(seq.id) || []}
                      onOpenBookmarkers={() => {
                        const b = bookmarkersBySeq.get(seq.id) || [];
                        setMembersModal({ title: "En attente ici", members: b.map((x) => ({ name: x.name, avatar: x.avatar })) });
                      }}
                    />
                  </React.Fragment>
                );
              })
            ) : null}

            {/* Bannières de fin de guide : rattachées au dernier chapitre (même règle) */}
            {!search.trim() && banners.after.map(renderBanner)}
          </main>

          {/* ══ FOOTER FIXE ══ */}
          <RushOverlayFooter
            onPrev={goToPrevMs}
            onNext={goToNextMs}
            canPrev={currentMsIndex > 0}
            canNext={currentMsIndex < milestones.length - 1}
            isLightMode={isLightMode}
            label={chapterPos.index > 0 ? `${chapterPos.index} / ${chapterPos.total}` : ""}
          />
        </>
      ) : currentMs ? (
        /* ══ MODE COMPACT (JEU) ══ */
        <RushOverlayCompact
          milestone={currentMs}
          objective={compactObjective}
          isDone={!!compactObjective && currentMsDoneSeqs.has(compactObjective.id)}
          isLightMode={isLightMode}
          // Mode jeu : l'objectif courant reste la priorité. Les bannières ne remplacent
          // l'objectif que s'il n'y a RIEN à faire ici (chapitre sans quête restante) —
          // sinon elles restent lisibles en mode normal, à leur place dans le flux.
          body={!compactObjective && banners.before.length > 0 ? banners.before.map(renderBanner) : undefined}
          onToggle={() => currentMs && compactObjective && handleToggleSeq(currentMs, compactObjective.id)}
          onPrev={goToPrevMs}
          onNext={goToNextMs}
          canPrev={currentMsIndex > 0}
          canNext={currentMsIndex < milestones.length - 1}
          onExpand={() => setIsCompactMode(false)}
          onClose={handleClose}
        />
      ) : null}

      {/* ══ MODALE RESSOURCES GLOBALES (toutes étapes) ══ */}
      {showResources && (
        <RushOverlayResourcesModal
          resources={remainingResources}
          allResources={allResources}
          isLightMode={isLightMode}
          totalCount={allResources.length}
          onClose={() => setShowResources(false)}
        />
      )}

      {/* ══ MODALE MEMBRES (sur ce chapitre / je suis ici) ══ */}
      {membersModal && (
        <RushOverlayMembersModal
          title={membersModal.title}
          members={membersModal.members}
          isLightMode={isLightMode}
          onClose={() => setMembersModal(null)}
        />
      )}

      {/* ══ MODALE DÉTAILS DE QUÊTE ══ */}
      {detailSeq && (
        <RushOverlayQuestDetailModal
          milestone={detailSeq.ms}
          seq={detailSeq.seq}
          isDone={(completedStepsByMs.get(detailSeq.ms.id) || new Set<string>()).has(detailSeq.seq.id)}
          isLightMode={isLightMode}
          guildId={guildId}
          onClose={() => setDetailSeq(null)}
        />
      )}

      {/* ══ MODALE TUTORIEL ══ */}
      {showTutorial && (
        <RushOverlayTutorialModal isLightMode={isLightMode} onClose={() => setShowTutorial(false)} />
      )}

      {/* ══ PANNEAU QUÊTE OCRE (Metamob · overlay interne) ══ */}
      {showOcre && ocreEnabled && ocre && (
        <RushOverlayOcreModal
          guildId={guildId}
          isLightMode={isLightMode}
          initial={ocre}
          onClose={() => setShowOcre(false)}
        />
      )}
    </div>
  );
}

