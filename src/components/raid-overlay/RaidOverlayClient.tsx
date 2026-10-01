"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Copy,
  ExternalLink,
  RotateCcw,
  Check,
  Maximize2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MapPin,
  Flame,
  Swords,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useRaidOverlayStore, type RaidSlug } from "@/store/raid-overlay-store";
import {
  getLocalizedRaidData,
  type RaidStep,
} from "@/lib/raid-overlay-data";
import { useI18n } from "@/lib/i18n/client";
import { getClass } from "@/lib/dofus-assets";
import { copyToClipboard } from "@/lib/clipboard";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";
import { JardinsEnigmaTracker } from "@/app/raids/_components/JardinsEnigmaTracker";

interface RaidOverlayClientProps {
  initialRaidSlug?: RaidSlug;
  pinned?: boolean;
  onClose?: () => void;
}

// Les 4 véritables formes élémentaires d'Exécrabe et des statues sous le lac
function getExecrabeForms(isEn: boolean) {
  return [
    {
      id: "coquillage",
      label: isEn ? "Shell" : "Coquillage",
      element: isEn ? "Earth" : "Terre",
      color: "#f59e0b",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.48-.99-4.73-2.61-6.38" strokeLinecap="round" />
          <path d="M12 7a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.38-.56-2.63-1.46-3.54" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "oursin",
      label: isEn ? "Sea Urchin" : "Oursin",
      element: isEn ? "Air" : "Air",
      color: "#10b981",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "perle",
      label: isEn ? "Pearl" : "Perle",
      element: isEn ? "Fire" : "Feu",
      color: "#f43f5e",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="7" />
          <path d="M9 9a3 3 0 0 1 3-3" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "poulpe",
      label: isEn ? "Octopus" : "Poulpe",
      element: isEn ? "Water" : "Eau",
      color: "#06b6d4",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3a6 6 0 0 0-6 6c0 3 1.5 5 2 6" strokeLinecap="round" />
          <path d="M12 3a6 6 0 0 1 6 6c0 3-1.5 5-2 6" strokeLinecap="round" />
          <circle cx="9.5" cy="8.5" r="1" fill="currentColor" />
          <circle cx="14.5" cy="8.5" r="1" fill="currentColor" />
          <path d="M8 15c-1 2-2 3.5-3 3.5s-1.5-1-1.5-2" strokeLinecap="round" />
          <path d="M10 15c0 2-1 4-2 4s-1.5-1-1-3" strokeLinecap="round" />
          <path d="M14 15c0 2 1 4 2 4s1.5-1 1-3" strokeLinecap="round" />
          <path d="M16 15c1 2 2 3.5 3 3.5s1.5-1 1.5-2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
}

function getLightScale(isEn: boolean) {
  return [
    {
      lvl: "4",
      name: isEn ? "Full Light" : "Pleine Lumière",
      desc: isEn ? "0 monster buff · Mandatory for Moray & Execrabe" : "0 buff monstre · Obligatoire pour Mureine & Exécrabe",
      color: "#22c55e",
    },
    {
      lvl: "3",
      name: isEn ? "Medium" : "Moyenne",
      desc: isEn ? "+20% HP / +100 Power · Comfortable for corridors" : "+20% PV / +100 Pui · Confortable pour les couloirs",
      color: "#eab308",
    },
    {
      lvl: "2",
      name: isEn ? "Dim Light" : "Pénombre",
      desc: isEn ? "+50% HP / +250 Power · Add salt quickly" : "+50% PV / +250 Pui · Remettre du sel rapidement",
      color: "#f97316",
    },
    {
      lvl: "1",
      name: isEn ? "Darkness" : "Obscurité",
      desc: isEn ? "+100% HP / +500 Power / +1 MP · Critical danger" : "+100% PV / +500 Pui / +1 PM · Danger critique",
      color: "#ef4444",
    },
    {
      lvl: "0",
      name: isEn ? "Pitch Black" : "Nuit Noire",
      desc: isEn ? "Auto-aggro 10 cells (5s) · +200% HP / +1,000 Power" : "Aggro auto à 10 cases (5s) · +200% PV / +1 000 Pui",
      color: "#dc2626",
    },
  ];
}

/**
 * Normalise toute coordonnée ou commande vers le format `/travel x,y`.
 * Exemples : "[3, 2]" -> "/travel 3,2", "/travel 4 7" -> "/travel 4,7"
 */
function formatTravelCommand(input: string): string {
  if (!input) return "";
  const match = input.match(/(-?\d+)\s*[, ]\s*(-?\d+)/);
  if (match) {
    return `/travel ${match[1]},${match[2]}`;
  }
  return input.startsWith("/travel") ? input : `/travel ${input}`;
}

/**
 * Détecte les coordonnées [x, y] ou [x,y] dans un texte et les rend cliquables
 * pour copier la commande `/travel x,y` dans le presse-papier.
 */
function TextWithCoords({
  text,
  onCopy,
  copiedKey,
  isEn = false,
}: {
  text: string;
  onCopy: (travelCmd: string, key: string, label?: string, e?: React.MouseEvent) => void;
  copiedKey: string | null;
  isEn?: boolean;
}) {
  const coordRegex = /\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = coordRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const x = match[1];
    const y = match[2];
    const raw = `[${x}, ${y}]`;
    const travelCmd = `/travel ${x},${y}`;
    const key = `inline-${x}-${y}-${match.index}`;
    const isCopied = copiedKey === key;

    parts.push(
      <button
        key={key}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(travelCmd, key, isEn ? "Position copied!" : "Position copiée !", e);
        }}
        title={isEn ? `Click to copy ${travelCmd}` : `Cliquer pour copier ${travelCmd}`}
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded font-mono text-[10.5px] font-semibold transition-all cursor-pointer select-none align-baseline border",
          isCopied
            ? "bg-emerald-500 text-black border-emerald-400 font-bold scale-105"
            : "bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 hover:text-cyan-100 border-cyan-500/30 hover:border-cyan-400/60"
        )}
      >
        {isCopied ? <Check size={10} className="shrink-0" /> : <Copy size={9} className="shrink-0 opacity-70" />}
        <span>{isCopied ? (isEn ? "Copied" : "Copié") : raw}</span>
      </button>
    );

    lastIndex = coordRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function RaidOverlayClient({
  initialRaidSlug = "gigalodon",
  pinned = false,
  onClose,
}: RaidOverlayClientProps) {
  const win = useRaidOverlayStore((s) => s.win);
  const payload = useRaidOverlayStore((s) => s.payload);
  const setRaid = useRaidOverlayStore((s) => s.setRaid);
  const activeStepIdx = payload?.activeStepIndex ?? 0;
  const setActiveStep = useRaidOverlayStore((s) => s.setActiveStep);
  const execrabeShapes = useRaidOverlayStore((s) => s.execrabeShapes);
  const setExecrabeShape = useRaidOverlayStore((s) => s.setExecrabeShape);
  const clearExecrabeShapes = useRaidOverlayStore((s) => s.clearExecrabeShapes);

  const currentRaidSlug = payload?.raidSlug ?? initialRaidSlug;
  const { locale, setLocale } = useI18n();
  const isEn = locale === "en";
  const raid = getLocalizedRaidData(currentRaidSlug, locale);
  const currentStep: RaidStep | undefined = raid.steps[activeStepIdx] || raid.steps[0];
  const hasSalts = Boolean(raid.saltLocations && raid.saltLocations.length > 0);

  const [isRaidMenuOpen, setIsRaidMenuOpen] = useState(false);
  const raidDropdownRef = useRef<HTMLDivElement>(null);

  const execrabeForms = useMemo(() => getExecrabeForms(isEn), [isEn]);
  const lightScale = useMemo(() => getLightScale(isEn), [isEn]);

  // Onglets principaux : texte pur, simple soulignement
  const [mainView, setMainView] = useState<"step" | "statues" | "safe_travel" | "light" | "burst" | "enigmes">("step");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string } | null>(null);
  const [imageCollapsed, setImageCollapsed] = useState(false);
  // Mini-toast PiP inline (ne passe pas par Sonner du dashboard parent)
  const [pipToast, setPipToast] = useState<string | null>(null);
  const pipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sous-onglet pour Trajets Safe
  const [activeTravelRouteId, setActiveTravelRouteId] = useState<string>(
    raid.safeRoutes?.[0]?.id || "remontee-execrabe"
  );
  const [travelSubTab, setTravelSubTab] = useState<"routes" | "salts">("routes");

  // Synchronisation stricte de l'état selon le raid actif (aucun reliquat d'onglets ou de sous-onglets)
  useEffect(() => {
    if (raid.safeRoutes?.[0]?.id) {
      setActiveTravelRouteId(raid.safeRoutes[0].id);
    }
    setTravelSubTab("routes");
    if (currentRaidSlug === "jardin-eternel" && (mainView === "statues" || mainView === "light")) {
      setMainView("step");
    } else if (currentRaidSlug === "gigalodon" && mainView === "enigmes") {
      setMainView("step");
    }
  }, [currentRaidSlug, raid]);

  const floorNavRef = useRef<HTMLDivElement | null>(null);

  // Défilement horizontal à la molette
  const handleHorizontalWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Centrage auto de l'étage actif
  useEffect(() => {
    if (mainView === "step" && floorNavRef.current) {
      const activeEl = floorNavRef.current.querySelector<HTMLButtonElement>(`[data-step-idx="${activeStepIdx}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeStepIdx, mainView]);

  const handleCopy = async (
    rawText: string,
    key: string,
    _label = "Position copiée !",
    e?: React.MouseEvent | React.SyntheticEvent
  ) => {
    const travelCmd = formatTravelCommand(rawText);
    const targetDoc =
      (e?.currentTarget as HTMLElement | undefined)?.ownerDocument ||
      win?.document ||
      (typeof document !== "undefined" ? document : undefined);

    const ok = await copyToClipboard(travelCmd, targetDoc);

    // Afficher le mini-toast dans le PiP (pas Sonner du dashboard)
    if (pipToastTimerRef.current) clearTimeout(pipToastTimerRef.current);
    if (!ok) {
      setPipToast(`✕ Erreur : impossible de copier`);
    } else {
      setPipToast(`✓ ${travelCmd}`);
      setCopiedKey(key);
      pipToastTimerRef.current = setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
    pipToastTimerRef.current = setTimeout(() => setPipToast(null), 1800);
  };

  const handleToggleShape = (shapeId: string) => {
    const existingIdx = execrabeShapes.indexOf(shapeId);
    if (existingIdx !== -1) {
      setExecrabeShape(existingIdx, "");
    } else {
      const firstEmpty = execrabeShapes.findIndex((s) => !s);
      if (firstEmpty !== -1) {
        setExecrabeShape(firstEmpty, shapeId);
      }
    }
  };

  // Fermeture du menu de sélection de raid en cliquant en dehors
  useEffect(() => {
    if (!isRaidMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (raidDropdownRef.current && !raidDropdownRef.current.contains(e.target as Node)) {
        setIsRaidMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRaidMenuOpen]);

  // Raccourci clavier Escape pour fermer le menu de raid, le zoom d'image ou l'overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRaidMenuOpen) {
          setIsRaidMenuOpen(false);
        } else if (zoomedImage) {
          setZoomedImage(null);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRaidMenuOpen, zoomedImage, onClose]);

  return (
    <div className="w-full h-full min-h-screen bg-[#0e1015] text-[#d6d8df] flex flex-col font-sans select-none overflow-hidden isolate text-[12px]">
      {/* ── 1. HEADER HUD DISCRET (Pas de double bouton fermer avec le PiP) ── */}
      <header className="h-9 shrink-0 px-3 bg-[#0a0b0e] border-b border-white/[0.08] flex items-center justify-between z-30 relative">
        {/* Dropdown choix de raid stylisé */}
        <div className="relative min-w-0" ref={raidDropdownRef}>
          <button
            type="button"
            onClick={() => setIsRaidMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded hover:bg-white/[0.06] text-white transition-colors cursor-pointer group"
            aria-expanded={isRaidMenuOpen}
            aria-label={isEn ? "Select raid" : "Sélectionner le raid"}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                currentRaidSlug === "jardin-eternel" ? "bg-emerald-400" : "bg-cyan-400"
              )}
            />
            <span className="text-[11.5px] font-semibold tracking-tight text-white group-hover:text-cyan-300 transition-colors truncate">
              {currentRaidSlug === "gigalodon"
                ? (isEn ? "The Gigalodon Abyss" : "Gouffre Gigalodon")
                : (isEn ? "Eternal Gardens Sanctuary" : "Jardin Éternel")}
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-white/40 group-hover:text-white/70 transition-transform duration-150",
                isRaidMenuOpen && "rotate-180 text-cyan-400"
              )}
            />
          </button>

          {isRaidMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-md border border-white/10 bg-[#12141c] p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-white/40 font-semibold">
                {isEn ? "Select Raid" : "Choisir un raid"}
              </div>
              {[
                {
                  id: "gigalodon" as RaidSlug,
                  title: isEn ? "The Gigalodon Abyss" : "Gouffre Gigalodon",
                  subtitle: isEn ? "12 Players · 6 Floors" : "12 Joueurs · 6 Étages",
                  color: "bg-cyan-400",
                },
                {
                  id: "jardin-eternel" as RaidSlug,
                  title: isEn ? "Eternal Gardens Sanctuary" : "Jardin Éternel",
                  subtitle: isEn ? "16 Players · 4 Wings" : "16 Joueurs · 4 Ailes",
                  color: "bg-emerald-400",
                },
              ].map((r) => {
                const isSelected = currentRaidSlug === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRaid(r.id);
                      setActiveStep(0);
                      setMainView("step");
                      setIsRaidMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-2 py-1.5 rounded text-left flex items-center justify-between transition-colors cursor-pointer",
                      isSelected
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", r.color)} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate leading-tight">{r.title}</p>
                        <p className="text-[9.5px] text-white/40 truncate leading-tight mt-0.5">{r.subtitle}</p>
                      </div>
                    </div>
                    {isSelected && <Check size={12} className="text-cyan-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Boutons actions droite : Switch langue, Studio 3.6 & Guide */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setLocale(isEn ? "fr" : "en")}
            title={isEn ? "Passer en Français" : "Switch to English"}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Languages size={10} className="text-white/40" />
            <span>{isEn ? "EN" : "FR"}</span>
          </button>
          <a
            href={`/raids?raid=${currentRaidSlug === "jardin-eternel" ? "sanctuaire" : "gigalodon"}`}
            target="_blank"
            rel="noopener noreferrer"
            title={isEn ? "Open Raid Studio 3.6 (Planner & Tools)" : "Ouvrir Raid Studio 3.6 (Planificateur & Outils)"}
            className="px-1.5 py-0.5 rounded text-[10px] text-white/50 hover:text-cyan-300 hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Swords size={11} />
            <span>Studio 3.6</span>
          </a>
          <a
            href={raid.guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={isEn ? "Open full guide" : "Ouvrir le guide complet"}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {!pinned && <OverlayPinNotice />}

      {/* ── 2. NAVIGATION ÉPURÉE (1 SEULE RANGÉE DE TEXTE, DYNAMIQUE PAR RAID) ── */}
      <nav className="flex items-center justify-between shrink-0 bg-[#0a0b0e] border-b border-white/[0.08] px-3 text-[11px]">
        {(currentRaidSlug === "jardin-eternel"
          ? ([
              { id: "step", label: isEn ? "Rooms" : "Salles" },
              { id: "enigmes", label: isEn ? "Puzzles" : "Énigmes" },
              { id: "trajets", label: isEn ? "Routes" : "Trajets" },
              { id: "burst", label: isEn ? "Boss & Setup" : "Boss & Compo" },
            ] as const)
          : ([
              { id: "step", label: isEn ? "Rooms" : "Salles" },
              { id: "statues", label: isEn ? "Statues" : "Statues" },
              { id: "trajets", label: isEn ? "Routes" : "Trajets" },
              { id: "light", label: isEn ? "Light" : "Lumière" },
              { id: "burst", label: isEn ? "Burst" : "Burst" },
            ] as const)
        ).map((tab) => {
          const tabKey = tab.id === "trajets" ? "safe_travel" : tab.id;
          const isActive = mainView === tabKey;
          return (
            <button
              key={tab.id}
              onClick={() => setMainView(tabKey as typeof mainView)}
              className={cn(
                "py-2 px-1.5 transition-colors border-b-2 font-medium",
                isActive
                  ? "text-white border-cyan-400"
                  : "text-white/40 border-transparent hover:text-white/80"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── 3. SÉLECTEUR D'ÉTAGES COMPACT (DÉFILEMENT MOLETTE) ── */}
      {mainView === "step" && (
        <div
          ref={floorNavRef}
          onWheel={handleHorizontalWheel}
          className="shrink-0 bg-[#0c0d12] border-b border-white/[0.06] px-2 py-1 flex items-center gap-1 overflow-x-auto scrollbar-none"
        >
          {raid.steps.map((st, idx) => {
            const isActive = idx === activeStepIdx;
            const shortLabel =
              currentRaidSlug === "jardin-eternel"
                ? st.floor
                : idx === 0
                ? "-1 Base"
                : idx === 1
                ? (isEn ? "-2 Moray" : "-2 Mureine")
                : idx === 2
                ? (isEn ? "-3 Bridge" : "-3 Pont")
                : idx === 3
                ? (isEn ? "-4 Execrabe" : "-4 Exécrabe")
                : idx === 4
                ? (isEn ? "10k Chest" : "Coffre 10k")
                : idx === 5
                ? "-5 Krak"
                : idx === 6
                ? (isEn ? "-6 Willorc" : "-6 Willorque")
                : "Gigalodon";

            return (
              <button
                key={st.id}
                data-step-idx={idx}
                onClick={() => setActiveStep(idx)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10.5px] shrink-0 transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-white/10 text-white font-semibold border border-white/20"
                    : "text-white/40 hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                )}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 4. CONTENU PRINCIPAL EN LISTE CONTINUE ── */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-white/10">
        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 1 : STRATÉGIE SALLE (LISTE CONTINUE, PAS DE CARTES MULTIPLES)   */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "step" && currentStep && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3 space-y-3">
            {/* En-tête : Titre & /travel */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-[13px] font-semibold text-white">
                    {currentStep.floor} · {currentStep.bossName || currentStep.title}
                  </h2>
                  {currentStep.bossHp && (
                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-rose-300 border border-rose-500/20">
                      {currentStep.bossHp}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  <TextWithCoords text={currentStep.summary} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                </p>
              </div>

              <button
                onClick={() => handleCopy(currentStep.coords, `travel-${currentStep.id}`)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded font-mono text-[10.5px] transition-colors shrink-0 border",
                  copiedKey === `travel-${currentStep.id}`
                    ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                )}
                title={isEn ? `Click to copy ${formatTravelCommand(currentStep.coords)}` : `Copier ${formatTravelCommand(currentStep.coords)}`}
              >
                {copiedKey === `travel-${currentStep.id}` ? <Check size={11} /> : <Copy size={10} />}
                <span>{copiedKey === `travel-${currentStep.id}` ? (isEn ? "Copied" : "Copié") : currentStep.coords}</span>
              </button>
            </div>

            {/* Image compacte & Vignettes secondaires */}
            {currentStep.primaryImage && (
              <div className="space-y-1.5">
                {!imageCollapsed && (
                  <div
                    className="relative rounded-md overflow-hidden border border-white/[0.08] bg-black/40 group cursor-zoom-in"
                    onClick={() => setZoomedImage({ src: currentStep.primaryImage, title: currentStep.title })}
                  >
                    <img
                      src={currentStep.primaryImage}
                      alt={currentStep.title}
                      className="w-full h-20 object-cover object-center group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white/90 flex items-center gap-1">
                        <Maximize2 size={10} /> {isEn ? "Enlarge" : "Agrandir"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-1 flex-wrap text-[10.5px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {currentStep.secondaryImages?.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setZoomedImage({ src: img.src, title: img.label })}
                        className="px-2 py-0.5 rounded border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] text-white/70 hover:text-white text-[10px] transition-colors flex items-center gap-1"
                      >
                        <span>[{img.label}]</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setImageCollapsed((prev) => !prev)}
                    className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-0.5 ml-auto"
                  >
                    {imageCollapsed ? (
                      <>
                        <ChevronDown size={11} /> {isEn ? "Show visual" : "Voir visuel"}
                      </>
                    ) : (
                      <>
                        <ChevronUp size={11} /> {isEn ? "Hide visual" : "Masquer visuel"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Puces essentielles (lecture en 5-8 mots par puce avec positions cliquables) */}
            <div className="pt-1">
              <ul className="space-y-1.5 text-[11.5px] text-white/80">
                {currentStep.bullets?.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-white/30 shrink-0 select-none mt-0.5">•</span>
                    <span>
                      <TextWithCoords text={bullet} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Alerte critique UNIQUE si applicable */}
            {currentStep.alert && (
              <div
                className={cn(
                  "p-2 rounded border-l-2 text-[11px] leading-snug",
                  currentStep.alert.danger
                    ? "border-l-rose-500 bg-rose-500/[0.06] text-rose-200/90"
                    : "border-l-amber-500 bg-amber-500/[0.06] text-amber-200/90"
                )}
              >
                <div className="flex items-center gap-1 font-semibold mb-0.5">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span>{currentStep.alert.label}</span>
                </div>
                <p className="text-white/70">
                  <TextWithCoords text={currentStep.alert.desc} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                </p>
              </div>
            )}

            {/* Mémo Formes interactif pour Exécrabe (si -4) */}
            {currentStep.hasExecrabePad && (
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white/90">
                    {isEn ? "Execrabe 4-form sequence :" : "Ordre des 4 formes d'Exécrabe :"}
                  </span>
                  {execrabeShapes.some(Boolean) && (
                    <button
                      onClick={clearExecrabeShapes}
                      className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>

                {/* Les 4 slots */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const val = execrabeShapes[slotIdx];
                    const formObj = execrabeForms.find((s) => s.id === val);
                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "h-12 rounded border flex flex-col items-center justify-center transition-colors",
                          formObj
                            ? "bg-white/[0.06] border-cyan-400 text-white"
                            : "bg-black/30 border-dashed border-white/10 text-white/20"
                        )}
                      >
                        <span className="text-[8px] font-mono text-white/40">#{slotIdx + 1}</span>
                        {formObj ? (
                          <div className="flex items-center gap-1 mt-0.5" style={{ color: formObj.color }}>
                            {formObj.icon}
                            <span className="text-[8.5px] font-medium">{formObj.label}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sélecteurs de formes */}
                <div className="grid grid-cols-4 gap-1">
                  {execrabeForms.map((form) => {
                    const isSelected = execrabeShapes.includes(form.id);
                    return (
                      <button
                        key={form.id}
                        onClick={() => handleToggleShape(form.id)}
                        className={cn(
                          "py-1.5 px-1 rounded border text-center flex flex-col items-center transition-colors",
                          isSelected
                            ? "bg-white/10 border-cyan-400 text-white"
                            : "bg-white/[0.02] hover:bg-white/[0.06] border-white/10 text-white/70"
                        )}
                      >
                        <span style={{ color: form.color }}>{form.icon}</span>
                        <span className="text-[9px] font-medium mt-0.5">{form.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Déroulement de salle succinct avec coordonnées cliquables */}
            <div className="pt-2 border-t border-white/[0.06] space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                {isEn ? "Procedure" : "Déroulement"}
              </span>
              <ol className="space-y-1 text-[11px] text-white/70">
                {currentStep.strategy.map((st, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-white/40 font-mono text-[10px] shrink-0 mt-0.5">{i + 1}.</span>
                    <span>
                      <TextWithCoords text={st} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE ÉNIGMES : JARDIN ÉTERNEL UNIQUEMENT (4 solveurs interactifs)   */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "enigmes" && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3">
            <JardinsEnigmaTracker
              compact
              onCopyTravel={(cmd) => handleCopy(cmd, `enigma-${cmd}`)}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 2 : OUTIL STATUES D'EXÉCRABE (-4 BIS) — GIGALODON UNIQUEMENT   */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "statues" && currentRaidSlug === "gigalodon" && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div>
                <h2 className="text-[13px] font-semibold text-white">
                  {isEn ? "Statues beneath the Lake (-4)" : "Statues sous le Lac (-4)"}
                </h2>
                <p className="text-[11px] text-white/50">
                  {isEn
                    ? "Record the 4 shapes' order of appearance during the Execrabe fight."
                    : "Notez l'ordre d'apparition des 4 formes pendant le combat contre Exécrabe."}
                </p>
              </div>
              {execrabeShapes.some(Boolean) && (
                <button
                  onClick={clearExecrabeShapes}
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              )}
            </div>

            <div className="p-2 rounded border-l-2 border-l-rose-500 bg-rose-500/[0.06] text-[11px] text-rose-200/90">
              {isEn
                ? "⚠️ Warning: beneath the lake, each statue mistake subtracts 1,000 points from the raid!"
                : "⚠️ Attention : sous le lac, chaque erreur de statue retire 1 000 points au raid !"}
            </div>

            {/* Slots 1 à 4 */}
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((slotIdx) => {
                const val = execrabeShapes[slotIdx];
                const formObj = execrabeForms.find((s) => s.id === val);
                return (
                  <div
                    key={slotIdx}
                    className={cn(
                      "h-14 rounded border flex flex-col items-center justify-center transition-colors",
                      formObj
                        ? "bg-white/[0.08] border-cyan-400 text-white"
                        : "bg-black/30 border-dashed border-white/10 text-white/20"
                    )}
                  >
                    <span className="text-[8.5px] font-mono text-white/40">
                      {isEn ? `Threshold #${slotIdx + 1}` : `Seuil #${slotIdx + 1}`}
                    </span>
                    {formObj ? (
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: formObj.color }}>
                        {formObj.icon}
                        <span className="text-[9px] font-semibold">{formObj.label}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-white/20">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Boutons des 4 formes */}
            <div className="grid grid-cols-2 gap-2">
              {execrabeForms.map((form) => {
                const orderIdx = execrabeShapes.indexOf(form.id);
                const isSelected = orderIdx !== -1;
                return (
                  <button
                    key={form.id}
                    onClick={() => handleToggleShape(form.id)}
                    className={cn(
                      "p-2.5 rounded border flex items-center justify-between transition-colors",
                      isSelected
                        ? "bg-white/10 border-cyan-400 text-white"
                        : "bg-white/[0.02] hover:bg-white/[0.06] border-white/10 text-white/70"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: form.color }}>{form.icon}</span>
                      <div className="text-left">
                        <p className="text-[11.5px] font-semibold text-white">{form.label}</p>
                        <p className="text-[9px] text-white/40">{form.element}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center">
                        #{orderIdx + 1}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30">{isEn ? "+ Add" : "+ Ajouter"}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Photo des statues */}
            <div
              className="relative rounded overflow-hidden border border-white/[0.08] cursor-zoom-in group"
              onClick={() =>
                setZoomedImage({
                  src: "/images/guides/gigalodon/89-statues-enigme-execrabe.jpg",
                  title: isEn ? "Statues under the lake puzzle" : "Statues de l'énigme sous le lac",
                })
              }
            >
              <img
                src="/images/guides/gigalodon/89-statues-enigme-execrabe.jpg"
                alt={isEn ? "Statues under the lake" : "Statues sous le lac"}
                className="w-full h-20 object-cover group-hover:scale-102 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] text-white flex items-center gap-1">
                  <Maximize2 size={10} /> {isEn ? "View in-game layout" : "Voir la disposition en jeu"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 3 : TRAJETS SÉCURISÉS & GISEMENTS DE SEL                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "safe_travel" && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3 space-y-3">
            {/* Sous-onglets Itinéraires vs Sels (affichés UNIQUEMENT si le raid possède des gisements de sel, ex: Gigalodon) */}
            {hasSalts && (
              <div className="flex border-b border-white/[0.06] text-[11px]">
                <button
                  onClick={() => setTravelSubTab("routes")}
                  className={cn(
                    "pb-1.5 px-2 transition-colors border-b-2 font-medium",
                    travelSubTab === "routes"
                      ? "text-white border-cyan-400"
                      : "text-white/40 border-transparent hover:text-white/70"
                  )}
                >
                  {isEn ? "Safe Routes" : "Itinéraires Safe"}
                </button>
                <button
                  onClick={() => setTravelSubTab("salts")}
                  className={cn(
                    "pb-1.5 px-2 transition-colors border-b-2 font-medium",
                    travelSubTab === "salts"
                      ? "text-white border-cyan-400"
                      : "text-white/40 border-transparent hover:text-white/70"
                  )}
                >
                  {isEn ? "Salt Deposits" : "Gisements de Sel"}
                </button>
              </div>
            )}

            {(!hasSalts || travelSubTab === "routes") && (
              <div className="space-y-2.5">
                {/* Sélecteur d'itinéraire */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none" onWheel={handleHorizontalWheel}>
                  {raid.safeRoutes?.map((route) => {
                    const isSelected = route.id === activeTravelRouteId;
                    return (
                      <button
                        key={route.id}
                        onClick={() => setActiveTravelRouteId(route.id)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors border",
                          isSelected
                            ? "bg-white/10 text-white font-medium border-white/20"
                            : "bg-white/[0.02] text-white/40 hover:text-white/70 border-transparent"
                        )}
                      >
                        {route.title}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const currentRoute =
                    raid.safeRoutes?.find((r) => r.id === activeTravelRouteId) || raid.safeRoutes?.[0];
                  if (!currentRoute) return null;

                  return (
                    <div className="space-y-2">
                      <div className="pb-1 border-b border-white/[0.06]">
                        <h3 className="text-[12px] font-semibold text-white">{currentRoute.title}</h3>
                        <p className="text-[10.5px] text-white/50">{currentRoute.subtitle}</p>
                      </div>

                      {currentRoute.dangerWarning && (
                        <div className="p-2 rounded border-l-2 border-l-amber-500 bg-amber-500/[0.06] text-[10.5px] text-amber-200/90">
                          <TextWithCoords text={currentRoute.dangerWarning} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                        </div>
                      )}

                      {/* Étapes en liste */}
                      <div className="space-y-1">
                        {currentRoute.steps.map((st) => (
                          <div
                            key={st.stepNum}
                            className={cn(
                              "p-2 rounded border text-[11px] space-y-1 transition-colors",
                              st.isBlockPoint
                                ? "bg-amber-500/[0.05] border-amber-500/30 text-amber-200/90"
                                : "bg-white/[0.02] border-white/[0.06] text-white/80"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white">
                                {st.stepNum}. {st.label}
                              </span>
                              {st.coords && (
                                <button
                                  onClick={() => handleCopy(st.coords!, `route-cmd-${st.stepNum}`)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded font-mono text-[9.5px] transition-colors flex items-center gap-1 border",
                                    copiedKey === `route-cmd-${st.stepNum}`
                                      ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                                      : "bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border-white/10"
                                  )}
                                  title={isEn ? `Click to copy ${formatTravelCommand(st.coords)}` : `Copier ${formatTravelCommand(st.coords)}`}
                                >
                                  {copiedKey === `route-cmd-${st.stepNum}` ? (
                                    <Check size={9} />
                                  ) : (
                                    <Copy size={9} />
                                  )}
                                  <span>{copiedKey === `route-cmd-${st.stepNum}` ? (isEn ? "Copied" : "Copié") : st.coords}</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[10.5px] text-white/60">
                              <TextWithCoords text={st.action} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                            </p>
                            {st.warning && (
                              <p className="text-[10px] text-amber-300/90 font-mono">
                                <TextWithCoords text={st.warning} onCopy={handleCopy} copiedKey={copiedKey} isEn={isEn} />
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Sous-onglet : Gisements de Sel */}
            {hasSalts && travelSubTab === "salts" && (
              <div className="space-y-2">
                <p className="text-[10.5px] text-white/50">
                  {isEn
                    ? "Click on a position to copy the /travel x,y command :"
                    : "Cliquez sur une position pour copier la commande /travel x,y :"}
                </p>

                <div className="space-y-1.5">
                  {raid.saltLocations?.map((loc) => (
                    <div
                      key={loc.floor}
                      className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1.5 text-[11px]"
                    >
                      <div className="font-semibold text-white">
                        {loc.floor} · {loc.zoneName}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <span className="text-white/40">{isEn ? "Luminomachine:" : "Luminomachine :"}</span>
                        {loc.luminomachines.map((lum, idx) => {
                          const key = `lum-${loc.floor}-${idx}`;
                          const isCopied = copiedKey === key;
                          const cmd = formatTravelCommand(lum.coords || lum.command);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleCopy(cmd, key)}
                              className={cn(
                                "px-1.5 py-0.5 rounded font-mono border transition-colors flex items-center gap-1",
                                isCopied
                                  ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                                  : "bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border-white/10"
                              )}
                              title={isEn ? `Copy ${cmd}` : `Copier ${cmd}`}
                            >
                              <Flame size={9} className={isCopied ? "text-black" : "text-amber-400"} />
                              <span>{isCopied ? (isEn ? "Copied" : "Copié") : lum.coords}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <span className="text-white/40">{isEn ? "Salts:" : "Sels :"}</span>
                        {loc.salts.map((s, idx) => {
                          const key = `salt-${loc.floor}-${idx}`;
                          const isCopied = copiedKey === key;
                          const cmd = formatTravelCommand(s.coords || s.command);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleCopy(cmd, key)}
                              className={cn(
                                "px-1.5 py-0.5 rounded font-mono border transition-colors flex items-center gap-1",
                                isCopied
                                  ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                                  : "bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border-white/10"
                              )}
                              title={isEn ? `Copy ${cmd}${s.note ? ` (${s.note})` : ""}` : `Copier ${cmd}${s.note ? ` (${s.note})` : ""}`}
                            >
                              <MapPin size={9} className={isCopied ? "text-black" : "text-cyan-400"} />
                              <span>{isCopied ? (isEn ? "Copied" : "Copié") : s.coords}</span>
                              {s.note && <span className="opacity-50">({s.note})</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 4 : RÈGLES DE LA LUMIÈRE & MALUS — GIGALODON UNIQUEMENT        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "light" && currentRaidSlug === "gigalodon" && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3 space-y-3">
            <div>
              <h2 className="text-[13px] font-semibold text-white">
                {isEn ? "Light Scale" : "Barème de la Lumière"}
              </h2>
              <p className="text-[11px] text-white/50">
                {isEn
                  ? "Level 3 recommended for corridors · Level 4 required for Moray and Execrabe."
                  : "Niveau 3 recommandé pour les couloirs · Niveau 4 obligatoire pour Mureine et Exécrabe."}
              </p>
            </div>

            <div className="space-y-1">
              {lightScale.map((item) => (
                <div
                  key={item.lvl}
                  className="p-2 rounded border border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[10px] shrink-0"
                      style={{ color: item.color, backgroundColor: `${item.color}15` }}
                    >
                      {item.lvl}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-[10px] text-white/50">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2 rounded border-l-2 border-l-rose-500 bg-rose-500/[0.06] text-[10.5px] text-rose-200/90">
              {isEn
                ? "⚠️ 100 salts deposited = permanent total darkness. Do NOT attempt the Salt achievement during a score run!"
                : "⚠️ 100 sels déposés = nuit totale permanente. Ne tentez PAS le succès Sel lors d'un run de score !"}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 5 : BURST & COMPOSITIONS — DYNAMIQUE PAR RAID                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "burst" && (
          <div className="rounded-md border border-white/[0.08] bg-[#121319] p-3 space-y-3">
            <div>
              <h2 className="text-[13px] font-semibold text-white">
                {currentRaidSlug === "jardin-eternel"
                  ? (isEn ? "Boss & Setup · Sanctuary" : "Boss & Composition · Sanctuaire")
                  : (isEn ? "Gigalodon Burst · 3 Turns" : "Burst Gigalodon · 3 Tours")}
              </h2>
              <p className="text-[11px] text-white/50">
                {currentRaidSlug === "jardin-eternel"
                  ? (isEn
                      ? "Optimal setup for the 60-fight corridor, Scarlet Queen and Cursed Princess."
                      : "Composition optimale pour le corridor 60 combats, la Reine Écarlate et la Princesse Maudite.")
                  : (isEn
                      ? "Automatic end and victory on Turn 4 (Gigalodoom). Goal: max single-target damage."
                      : "Fin automatique et victoire au Tour 4 (Gigalodoom). But : max de dégâts monocible.")}
              </p>
            </div>

            {/* Règles vitales (dynamiques depuis burstOpti.rules) */}
            <div className="p-2 rounded border-l-2 border-l-rose-500 bg-rose-500/[0.06] space-y-1 text-[11px] text-rose-200/90">
              <div className="font-semibold">
                {currentRaidSlug === "jardin-eternel"
                  ? (isEn ? "Survival rules :" : "Règles de survie :")
                  : (isEn ? "3 Sacred Burst Rules :" : "3 Règles Sacrées du Burst :")}
              </div>
              <ul className="space-y-0.5 text-white/80">
                {raid.burstOpti?.rules.map((rule, i) => (
                  <li key={i}>• {rule}</li>
                ))}
              </ul>
            </div>

            {/* Barème de conversion dégâts */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                {currentRaidSlug === "jardin-eternel"
                  ? (isEn ? "Progression Milestones ➔ Score" : "Paliers de Progression ➔ Score")
                  : (isEn ? "Damage Scale ➔ Bonus Score" : "Barème Dégâts ➔ Score Bonus")}
              </span>
              <div className="grid grid-cols-2 gap-1 font-mono text-[10.5px]">
                {raid.burstOpti?.scale.map((row) => (
                  <div
                    key={row.dmg}
                    className="p-1.5 rounded bg-white/[0.02] border border-white/[0.06] flex items-center justify-between"
                  >
                    <span className="text-white/60">{row.dmg}</span>
                    <span className="font-bold text-cyan-300">{row.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Compositions & Classes Recommandées (avec vraies icônes de classes) */}
            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {isEn ? "Key Classes & Synergies" : "Classes Clés & Synergies"}
                </span>
                <span className="text-[9.5px] text-white/40">
                  {currentRaidSlug === "jardin-eternel"
                    ? (isEn ? "MP Drain & Roles" : "Entrave & Rôles")
                    : (isEn ? "Pure Single-Target" : "Mono-cible pur")}
                </span>
              </div>

              {/* Groupement des classes dynamique */}
              {Array.from(
                new Set(raid.burstOpti?.classes.map((c) => c.category) || [])
              ).map((categoryName) => {
                const classList =
                  raid.burstOpti?.classes.filter((c) => c.category === categoryName) || [];
                if (classList.length === 0) return null;

                return (
                  <div key={categoryName} className="space-y-1">
                    <div className="text-[10px] text-white/40 font-medium">{categoryName} :</div>
                    <div className="space-y-1">
                      {classList.map((clsItem) => {
                        const classData = getClass(clsItem.classId);
                        return (
                          <div
                            key={clsItem.classId}
                            className="p-1.5 rounded border border-white/[0.06] bg-white/[0.02] flex items-start gap-2 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 shrink-0">
                              {classData?.icon && (
                                <img
                                  src={classData.icon}
                                  alt={classData.name}
                                  className="w-4 h-4 object-contain rounded"
                                />
                              )}
                              <span className="font-semibold text-white whitespace-nowrap">
                                {classData?.name || clsItem.classId}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/60 min-w-0 leading-snug">
                              {clsItem.keySpells}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Équipements recommandés */}
              <div className="pt-1.5 space-y-1">
                <div className="text-[10px] text-white/40 font-medium">
                  {isEn ? "Key Equipment :" : "Équipements Clés :"}
                </div>
                <div className="space-y-0.5 text-[10.5px]">
                    {raid.burstOpti?.keyItems.map((item) => (
                      <div key={item.name} className="flex items-start gap-1.5 text-[10.5px]">
                        <span className="font-semibold text-white whitespace-nowrap shrink-0">• {item.name} :</span>
                        <span className="text-white/50 min-w-0 leading-snug">{item.desc}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MODALE D'AGRANDISSEMENT D'IMAGE (ZOOM FULLSCREEN) ── */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="max-w-[95vw] max-h-[85vh] bg-[#101217] border border-white/20 rounded-md overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 bg-white/[0.04] border-b border-white/10 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-white truncate">
                {zoomedImage.title}
              </span>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={zoomedImage.src}
                alt={zoomedImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MINI-TOAST PiP (s'affiche dans la fenêtre overlay, pas sur le dashboard) ── */}
      {pipToast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-3 right-3 z-[60] px-3 py-1.5 rounded text-[11px] font-mono font-semibold shadow-lg pointer-events-none",
            "animate-in fade-in slide-in-from-bottom-2 duration-150",
            pipToast.startsWith("✕")
              ? "bg-red-500/90 text-white"
              : "bg-emerald-500/90 text-black"
          )}
        >
          {pipToast}
        </div>
      )}
    </div>
  );
}
