"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Copy,
  ExternalLink,
  Flame,
  RotateCcw,
  Compass,
  Sparkles,
  Target,
  ZoomIn,
  ShieldAlert,
  MapPin,
  Check,
  ChevronRight,
  Route,
  Info,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRaidOverlayStore, type RaidSlug } from "@/store/raid-overlay-store";
import { RAIDS_DATA, type RaidStep, type SafeTravelRoute } from "@/lib/raid-overlay-data";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";

interface RaidOverlayClientProps {
  initialRaidSlug?: RaidSlug;
  pinned?: boolean;
  onClose?: () => void;
}

// Les 4 véritables formes élémentaires d'Exécrabe et de ses statues sous le lac
const EXECRABE_FORMS = [
  {
    id: "coquillage",
    label: "Coquillage",
    element: "Terre",
    color: "#f59e0b",
    borderColor: "rgba(245, 158, 11, 0.4)",
    bgColor: "rgba(245, 158, 11, 0.12)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.48-.99-4.73-2.61-6.38" strokeLinecap="round" />
        <path d="M12 7a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.38-.56-2.63-1.46-3.54" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "oursin",
    label: "Oursin",
    element: "Air",
    color: "#10b981",
    borderColor: "rgba(16, 185, 129, 0.4)",
    bgColor: "rgba(16, 185, 129, 0.12)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "perle",
    label: "Perle",
    element: "Feu",
    color: "#f43f5e",
    borderColor: "rgba(244, 63, 94, 0.4)",
    bgColor: "rgba(244, 63, 94, 0.12)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="7" />
        <path d="M9 9a3 3 0 0 1 3-3" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "poulpe",
    label: "Poulpe",
    element: "Eau",
    color: "#06b6d4",
    borderColor: "rgba(6, 182, 212, 0.4)",
    bgColor: "rgba(6, 182, 212, 0.12)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

const LIGHT_SCALE = [
  { lvl: "4", name: "Pleine Lumière", desc: "0 buff monstre · Requis pour Mureine & Exécrabe", color: "#22c55e" },
  { lvl: "3", name: "Moyenne", desc: "+20% PV / +100 Pui · Recommandé nettoyage couloirs", color: "#eab308" },
  { lvl: "2", name: "Pénombre", desc: "+50% PV / +250 Pui · Remettre du sel rapidement", color: "#f97316" },
  { lvl: "1", name: "Obscurité", desc: "+100% PV / +500 Pui / +1 PM · Danger", color: "#ef4444" },
  { lvl: "0", name: "Nuit Noire", desc: "Aggro auto à 10 cases (5s) · +200% PV / +1 000 Pui", color: "#dc2626" },
];

export function RaidOverlayClient({
  initialRaidSlug = "gigalodon",
  pinned = false,
  onClose,
}: RaidOverlayClientProps) {
  const payload = useRaidOverlayStore((s) => s.payload);
  const setRaid = useRaidOverlayStore((s) => s.setRaid);
  const activeStepIdx = payload?.activeStepIndex ?? 0;
  const setActiveStep = useRaidOverlayStore((s) => s.setActiveStep);
  const execrabeShapes = useRaidOverlayStore((s) => s.execrabeShapes);
  const setExecrabeShape = useRaidOverlayStore((s) => s.setExecrabeShape);
  const clearExecrabeShapes = useRaidOverlayStore((s) => s.clearExecrabeShapes);

  const currentRaidSlug = payload?.raidSlug ?? initialRaidSlug;
  const raid = RAIDS_DATA[currentRaidSlug] || RAIDS_DATA.gigalodon;
  const currentStep: RaidStep | undefined = raid.steps[activeStepIdx] || raid.steps[0];

  // Vues principales : Salles & Boss (défaut), Statues, Trajets Safe, Lumière, Burst
  const [mainView, setMainView] = useState<"step" | "statues" | "safe_travel" | "light" | "burst">("step");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string } | null>(null);

  // Sous-onglet pour la vue Trajets Safe
  const [activeTravelRouteId, setActiveTravelRouteId] = useState<string>("remontee-execrabe");
  const [travelSubTab, setTravelSubTab] = useState<"routes" | "salts">("routes");

  const floorNavRef = useRef<HTMLDivElement | null>(null);

  // Défilement horizontal avec la molette de la souris
  const handleHorizontalWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Auto-scroll pour centrer le bouton de la salle active
  useEffect(() => {
    if (mainView === "step" && floorNavRef.current) {
      const activeEl = floorNavRef.current.querySelector<HTMLButtonElement>(`[data-step-idx="${activeStepIdx}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeStepIdx, mainView]);

  const handleCopy = (text: string, key: string, label = "Position copiée !") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(label, {
      description: text,
      icon: <Compass className="w-4 h-4 text-cyan-400" />,
      duration: 1500,
    });
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
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

  return (
    <div className="w-full h-full min-h-screen bg-[#07080b] text-white flex flex-col font-sans select-none overflow-hidden isolate">
      {/* ── 1. HEADER HUD IN-GAME ── */}
      <header className="h-11 shrink-0 px-3 bg-[#0a0b10] border-b border-white/10 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: raid.themeColor, boxShadow: `0 0 8px ${raid.themeColor}` }}
          />
          <select
            value={currentRaidSlug}
            onChange={(e) => {
              setRaid(e.target.value as RaidSlug);
              setActiveStep(0);
              setMainView("step");
            }}
            aria-label="Sélectionner le raid"
            className="bg-transparent text-xs font-mono font-bold uppercase tracking-wider text-white/90 hover:text-white focus:outline-none cursor-pointer border-none p-0"
          >
            <option value="gigalodon" className="bg-[#0a0b10] text-white">
              Gouffre Gigalodon
            </option>
            <option value="jardin-eternel" className="bg-[#0a0b10] text-white">
              Jardin Éternel
            </option>
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={raid.guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ouvrir le guide complet"
            className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
          {onClose && (
            <button
              onClick={onClose}
              title="Fermer l'overlay"
              className="p-1.5 rounded-md text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {!pinned && <OverlayPinNotice />}

      {/* ── 2. ONGLETS MAJEURS : VUE SALLES VS OUTILS DÉDIÉS ── */}
      <nav className="grid grid-cols-5 shrink-0 bg-[#090a0f] border-b border-white/10 text-[10.5px] font-mono uppercase tracking-wider text-center">
        <button
          onClick={() => setMainView("step")}
          className={cn(
            "py-2 px-1 border-b-2 transition-all flex items-center justify-center gap-1 font-semibold",
            mainView === "step"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.04]"
              : "text-white/40 border-transparent hover:text-white/75 hover:bg-white/[0.02]"
          )}
        >
          <Target size={11} className={mainView === "step" ? "text-cyan-400" : "text-white/30"} />
          <span>Salles</span>
        </button>

        <button
          onClick={() => setMainView("statues")}
          className={cn(
            "py-2 px-1 border-b-2 transition-all flex items-center justify-center gap-1 font-semibold",
            mainView === "statues"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.04]"
              : "text-white/40 border-transparent hover:text-white/75 hover:bg-white/[0.02]"
          )}
        >
          <Sparkles size={11} className={mainView === "statues" ? "text-cyan-400" : "text-white/30"} />
          <span>Statues</span>
        </button>

        <button
          onClick={() => setMainView("safe_travel")}
          className={cn(
            "py-2 px-1 border-b-2 transition-all flex items-center justify-center gap-1 font-semibold",
            mainView === "safe_travel"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.04]"
              : "text-white/40 border-transparent hover:text-white/75 hover:bg-white/[0.02]"
          )}
        >
          <Route size={11} className={mainView === "safe_travel" ? "text-cyan-400" : "text-white/30"} />
          <span>Trajets</span>
        </button>

        <button
          onClick={() => setMainView("light")}
          className={cn(
            "py-2 px-1 border-b-2 transition-all flex items-center justify-center gap-1 font-semibold",
            mainView === "light"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.04]"
              : "text-white/40 border-transparent hover:text-white/75 hover:bg-white/[0.02]"
          )}
        >
          <Flame size={11} className={mainView === "light" ? "text-cyan-400" : "text-white/30"} />
          <span>Lumière</span>
        </button>

        <button
          onClick={() => setMainView("burst")}
          className={cn(
            "py-2 px-1 border-b-2 transition-all flex items-center justify-center gap-1 font-semibold",
            mainView === "burst"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.04]"
              : "text-white/40 border-transparent hover:text-white/75 hover:bg-white/[0.02]"
          )}
        >
          <Target size={11} className={mainView === "burst" ? "text-cyan-400" : "text-white/30"} />
          <span>Burst</span>
        </button>
      </nav>

      {/* ── 3. SÉLECTEUR DE SALLES HORIZONTAL AVEC DÉFILEMENT À LA MOLETTE ── */}
      {mainView === "step" && (
        <div
          ref={floorNavRef}
          onWheel={handleHorizontalWheel}
          className="shrink-0 bg-[#06070a] border-b border-white/10 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none cursor-grab active:cursor-grabbing"
          title="Faites défiler avec la molette de la souris"
        >
          {raid.steps.map((st, idx) => {
            const isActive = idx === activeStepIdx;
            const shortLabel =
              idx === 0
                ? "-1 Base"
                : idx === 1
                ? "-2 Mureine"
                : idx === 2
                ? "-3 Pont"
                : idx === 3
                ? "-4 Exécrabe"
                : idx === 4
                ? "Coffre 10k"
                : idx === 5
                ? "-5 Krak'Haine"
                : idx === 6
                ? "-6 Willorque"
                : "★ Gigalodon";

            return (
              <button
                key={st.id}
                data-step-idx={idx}
                onClick={() => {
                  setActiveStep(idx);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-all border whitespace-nowrap",
                  isActive
                    ? "bg-cyan-500/20 border-cyan-400/80 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "bg-white/[0.03] border-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                )}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 4. CONTENU PRINCIPAL ADAPTÉ AU JEU ── */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-white/10">
        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 1 : STRATÉGIE DE LA SALLE SÉLECTIONNÉE                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "step" && currentStep && (
          <div className="space-y-3">
            {/* Bannière d'en-tête de la salle */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-transparent border border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wide">
                    {currentStep.floor}
                  </span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-xs font-bold text-white truncate">
                    {currentStep.bossName || currentStep.title}
                  </span>
                  {currentStep.bossHp && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {currentStep.bossHp}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleCopy(currentStep.travelCommand, `travel-${currentStep.id}`)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase transition-all shrink-0 border",
                  copiedKey === `travel-${currentStep.id}`
                    ? "bg-emerald-500 text-black border-emerald-400 font-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30 active:scale-95"
                )}
                title="Copier la commande /travel"
              >
                {copiedKey === `travel-${currentStep.id}` ? <Check size={11} /> : <Copy size={10} />}
                <span>{copiedKey === `travel-${currentStep.id}` ? "Copié !" : currentStep.coords}</span>
              </button>
            </div>

            {/* Illustration de la salle / Boss avec option d'agrandissement */}
            {currentStep.primaryImage && (
              <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img
                  src={currentStep.primaryImage}
                  alt={currentStep.title}
                  className="w-full h-36 object-cover object-center group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                  onClick={() => setZoomedImage({ src: currentStep.primaryImage, title: currentStep.title })}
                />
                <button
                  onClick={() => setZoomedImage({ src: currentStep.primaryImage, title: currentStep.title })}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/20 text-white/80 hover:text-white transition-colors"
                  title="Agrandir l'image"
                >
                  <Maximize2 size={12} />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-[9.5px] font-mono text-white/80 truncate max-w-[70%]">
                  {currentStep.title}
                </div>
              </div>
            )}

            {/* Miniatures secondaires si existantes (blocages, solutions, hitbox) */}
            {currentStep.secondaryImages && currentStep.secondaryImages.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {currentStep.secondaryImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setZoomedImage({ src: img.src, title: img.label })}
                    className="p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 flex items-center gap-2 text-left transition-colors group"
                  >
                    <img
                      src={img.src}
                      alt={img.label}
                      className="w-10 h-8 rounded object-cover border border-white/10 shrink-0 group-hover:border-cyan-400/50 transition-colors"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-white/80 truncate group-hover:text-cyan-300">
                        {img.label}
                      </p>
                      <span className="text-[8.5px] font-mono text-white/40 flex items-center gap-0.5">
                        <ZoomIn size={8} /> Cliquer
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Résumé tactique direct */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-white/80 leading-relaxed">
              {currentStep.summary}
            </div>

            {/* Alertes & Dangers majeurs */}
            <div className="space-y-1.5">
              {currentStep.keyMechanics.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2.5 rounded-lg border text-[11px] leading-snug",
                    m.danger
                      ? "bg-rose-950/20 border-rose-800/40 text-rose-200"
                      : "bg-white/[0.02] border-white/10 text-white/80"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1 font-mono text-[10px] uppercase">
                    {m.danger ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <ShieldAlert size={12} className="shrink-0" /> {m.label}
                      </span>
                    ) : (
                      <span className="text-cyan-300 flex items-center gap-1">
                        <Info size={12} className="shrink-0" /> {m.label}
                      </span>
                    )}
                  </div>
                  <p className="text-white/70 text-[10.5px] leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Outil Pad Exécrabe interactif si étape 4 */}
            {currentStep.hasExecrabePad && (
              <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-700/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-cyan-400" />
                    <span className="text-[10.5px] font-mono uppercase font-bold text-cyan-200">
                      Mémo Formes Exécrabe (-4)
                    </span>
                  </div>
                  {execrabeShapes.some(Boolean) && (
                    <button
                      onClick={clearExecrabeShapes}
                      className="text-[9.5px] font-mono text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw size={9} /> Reset
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-white/60 leading-tight">
                  Notez l&apos;ordre d&apos;apparition des 4 formes pendant le combat :
                </p>

                {/* Les 4 slots */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const val = execrabeShapes[slotIdx];
                    const formObj = EXECRABE_FORMS.find((s) => s.id === val);
                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "h-14 rounded-lg border flex flex-col items-center justify-center transition-all",
                          formObj
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                            : "bg-black/40 border-dashed border-white/15 text-white/20"
                        )}
                      >
                        <span className="text-[8px] font-mono text-white/40">#{slotIdx + 1}</span>
                        {formObj ? (
                          <div className="flex flex-col items-center mt-0.5">
                            <span style={{ color: formObj.color }}>{formObj.icon}</span>
                            <span className="text-[8px] font-mono font-bold mt-0.5" style={{ color: formObj.color }}>
                              {formObj.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-white/20">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sélecteurs de formes */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {EXECRABE_FORMS.map((form) => {
                    const isSelected = execrabeShapes.includes(form.id);
                    return (
                      <button
                        key={form.id}
                        onClick={() => handleToggleShape(form.id)}
                        className={cn(
                          "p-1.5 rounded-lg border text-center flex flex-col items-center transition-all",
                          isSelected
                            ? "bg-white/10 border-cyan-400 text-white"
                            : "bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-white/70"
                        )}
                      >
                        <span style={{ color: form.color }}>{form.icon}</span>
                        <span className="text-[8.5px] font-mono font-bold mt-0.5">{form.label}</span>
                        <span className="text-[7.5px] font-mono opacity-50">{form.element}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Plan d'action & Déroulement */}
            <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-white/40 tracking-wider">
                Déroulement Tactique
              </span>
              <div className="space-y-1.5 text-[11px] text-white/70">
                {currentStep.strategy.map((st, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{st}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Astuces Pro */}
            {currentStep.proTips && currentStep.proTips.length > 0 && (
              <div className="p-2.5 rounded-xl bg-white/[0.015] border border-white/5 space-y-1.5 text-[10.5px]">
                <span className="font-mono font-bold uppercase text-white/40 text-[9.5px]">
                  💡 Astuces de Guilde
                </span>
                <ul className="space-y-1 text-white/60">
                  {currentStep.proTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-cyan-400/70">›</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 2 : OUTIL STATUES D'EXÉCRABE (FORMS RÉELLES DU BOSS)            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "statues" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-cyan-400" />
                  <span className="text-xs font-bold text-white font-mono uppercase">
                    Statues du Lac (-4 bis)
                  </span>
                </div>
                {execrabeShapes.some(Boolean) && (
                  <button
                    onClick={clearExecrabeShapes}
                    className="text-[9.5px] font-mono text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={10} /> Tout Effacer
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Pendant le combat contre <strong>Exécrabe</strong> (-4), cliquez sur les 4 formes dans l&apos;ordre exact des seuils de PV. Les statues au bord de la map s&apos;illuminent en bleu à chaque transition.
              </p>

              {/* Les 4 slots d'ordre */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const val = execrabeShapes[slotIdx];
                  const formObj = EXECRABE_FORMS.find((s) => s.id === val);
                  return (
                    <div
                      key={slotIdx}
                      className={cn(
                        "h-16 rounded-xl border flex flex-col items-center justify-center transition-all",
                        formObj
                          ? "border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                          : "bg-white/[0.02] border-dashed border-white/15 text-white/20"
                      )}
                      style={{
                        backgroundColor: formObj ? formObj.bgColor : undefined,
                        borderColor: formObj ? formObj.borderColor : undefined,
                      }}
                    >
                      <span className="text-[8.5px] font-mono text-white/40">Seuil #{slotIdx + 1}</span>
                      {formObj ? (
                        <div className="flex flex-col items-center mt-1">
                          <span style={{ color: formObj.color }}>{formObj.icon}</span>
                          <span className="text-[9px] font-mono font-bold mt-0.5" style={{ color: formObj.color }}>
                            {formObj.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-white/20">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Boutons des 4 formes réelles */}
            <div className="grid grid-cols-2 gap-2">
              {EXECRABE_FORMS.map((form) => {
                const orderIdx = execrabeShapes.indexOf(form.id);
                const isSelected = orderIdx !== -1;
                return (
                  <button
                    key={form.id}
                    onClick={() => handleToggleShape(form.id)}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-all",
                      isSelected
                        ? "border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                        : "bg-white/[0.025] hover:bg-white/[0.06] border-white/10"
                    )}
                    style={{
                      backgroundColor: isSelected ? form.bgColor : undefined,
                      borderColor: isSelected ? form.color : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10" style={{ color: form.color }}>
                        {form.icon}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-white">{form.label}</p>
                        <p className="text-[9px] font-mono uppercase" style={{ color: form.color }}>
                          Élément {form.element}
                        </p>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-cyan-400 text-black text-xs font-mono font-bold flex items-center justify-center">
                        #{orderIdx + 1}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-white/30">+ Ajouter</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Aperçu des statues du jeu sous le lac */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-bold text-white/50">
                  Aperçu en jeu des Statues sous le Lac
                </span>
                <span className="text-[9px] font-mono text-rose-300">⚠️ -1 000 pts / erreur</span>
              </div>
              <div
                className="relative rounded-lg overflow-hidden border border-white/10 cursor-zoom-in group"
                onClick={() =>
                  setZoomedImage({
                    src: "/images/guides/gigalodon/89-statues-enigme-execrabe.jpg",
                    title: "Statues de l'énigme sous le lac",
                  })
                }
              >
                <img
                  src="/images/guides/gigalodon/89-statues-enigme-execrabe.jpg"
                  alt="Statues sous le lac"
                  className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-2 py-1 rounded bg-black/80 text-[10px] font-mono text-white flex items-center gap-1">
                    <Maximize2 size={10} /> Agrandir la photo des statues
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 3 : TRAJETS SÉCURISÉS & GISEMENTS DE SEL                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "safe_travel" && (
          <div className="space-y-3">
            {/* Sous-navigation Trajets vs Sels */}
            <div className="grid grid-cols-2 p-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] font-mono uppercase">
              <button
                onClick={() => setTravelSubTab("routes")}
                className={cn(
                  "py-1.5 rounded-md font-bold transition-all",
                  travelSubTab === "routes"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                    : "text-white/40 hover:text-white"
                )}
              >
                Itinéraires Sécurisés
              </button>
              <button
                onClick={() => setTravelSubTab("salts")}
                className={cn(
                  "py-1.5 rounded-md font-bold transition-all",
                  travelSubTab === "salts"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                    : "text-white/40 hover:text-white"
                )}
              >
                Gisements de Sel
              </button>
            </div>

            {travelSubTab === "routes" && (
              <div className="space-y-3">
                {/* Sélecteur d'itinéraire */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none" onWheel={handleHorizontalWheel}>
                  {raid.safeRoutes?.map((route) => {
                    const isSelected = route.id === activeTravelRouteId;
                    return (
                      <button
                        key={route.id}
                        onClick={() => setActiveTravelRouteId(route.id)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[9.5px] font-mono uppercase tracking-wider shrink-0 border transition-all text-left",
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white"
                        )}
                      >
                        <div className="font-bold">{route.title.split(" ")[0]} {route.title.split(" ")[1]}</div>
                        <div className="text-[8px] opacity-60">{route.badge}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Itinéraire sélectionné */}
                {(() => {
                  const currentRoute =
                    raid.safeRoutes?.find((r) => r.id === activeTravelRouteId) || raid.safeRoutes?.[0];
                  if (!currentRoute) return null;

                  return (
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white font-mono uppercase">
                            {currentRoute.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {currentRoute.badge}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-white/60">{currentRoute.subtitle}</p>

                        {currentRoute.dangerWarning && (
                          <div className="mt-2 p-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-[10px] text-rose-200 flex items-start gap-1.5 leading-snug">
                            <ShieldAlert size={12} className="text-rose-400 shrink-0 mt-0.5" />
                            <span>{currentRoute.dangerWarning}</span>
                          </div>
                        )}
                      </div>

                      {/* Étapes séquentielles */}
                      <div className="space-y-1.5">
                        {currentRoute.steps.map((st) => (
                          <div
                            key={st.stepNum}
                            className={cn(
                              "p-2.5 rounded-xl border text-[11px] transition-all space-y-1.5",
                              st.isBlockPoint
                                ? "bg-amber-950/20 border-amber-600/40 text-amber-200"
                                : "bg-white/[0.02] border-white/10 text-white/80"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase">
                                <span
                                  className={cn(
                                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                                    st.isBlockPoint
                                      ? "bg-amber-500 text-black font-black"
                                      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                  )}
                                >
                                  {st.stepNum}
                                </span>
                                <span className={st.isBlockPoint ? "text-amber-300" : "text-white"}>
                                  {st.label}
                                </span>
                              </div>

                              {st.command && (
                                <button
                                  onClick={() => handleCopy(st.command!, `route-cmd-${st.stepNum}`)}
                                  className={cn(
                                    "px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase transition-all flex items-center gap-1 border",
                                    copiedKey === `route-cmd-${st.stepNum}`
                                      ? "bg-emerald-500 text-black border-emerald-400"
                                      : "bg-white/5 hover:bg-white/10 text-cyan-300 border-white/10"
                                  )}
                                >
                                  {copiedKey === `route-cmd-${st.stepNum}` ? (
                                    <Check size={9} />
                                  ) : (
                                    <Copy size={9} />
                                  )}
                                  <span>{copiedKey === `route-cmd-${st.stepNum}` ? "Copié" : st.coords}</span>
                                </button>
                              )}
                            </div>

                            <p className="text-[10px] text-white/70 leading-relaxed">{st.action}</p>

                            {st.warning && (
                              <div className="text-[9.5px] font-mono text-amber-300/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                {st.warning}
                              </div>
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
            {travelSubTab === "salts" && (
              <div className="space-y-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[10.5px] text-cyan-200/90 leading-relaxed">
                  Cliquez sur n&apos;importe quelle position pour copier sa commande <code>/travel</code> instantanément :
                </div>

                <div className="space-y-2">
                  {raid.saltLocations?.map((loc) => (
                    <div
                      key={loc.floor}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-mono font-bold text-cyan-300 uppercase">
                          {loc.floor} · {loc.zoneName}
                        </span>
                      </div>

                      {/* Luminomachines de l'étage */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="text-white/40 font-mono text-[9px]">Luminomachine :</span>
                        {loc.luminomachines.map((lum, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCopy(lum.command, `lum-${loc.floor}-${idx}`)}
                            className={cn(
                              "px-1.5 py-0.5 rounded font-mono text-[9.5px] border transition-all flex items-center gap-1",
                              copiedKey === `lum-${loc.floor}-${idx}`
                                ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                                : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
                            )}
                          >
                            <Flame size={9} className="text-amber-400" />
                            <span>{lum.coords}</span>
                          </button>
                        ))}
                      </div>

                      {/* Gisements de sel */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="text-white/40 font-mono text-[9px]">Sels :</span>
                        {loc.salts.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCopy(s.command, `salt-${loc.floor}-${idx}`)}
                            className={cn(
                              "px-1.5 py-0.5 rounded font-mono text-[9.5px] border transition-all flex items-center gap-1",
                              copiedKey === `salt-${loc.floor}-${idx}`
                                ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                                : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/20"
                            )}
                            title={s.note || "Gisement de sel"}
                          >
                            <MapPin size={9} />
                            <span>{s.coords}</span>
                            {s.note && <span className="text-[8px] opacity-60">({s.note})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 4 : RÈGLES DE LA LUMIÈRE & MALUS IDÉES NOIRES                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "light" && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed">
              Maintenez <strong>Niveau 3</strong> en nettoyage des couloirs et montez impérativement en <strong>Niveau 4</strong> avant d&apos;engager Mureine et Exécrabe.
            </div>

            <div className="space-y-1.5">
              {LIGHT_SCALE.map((item) => (
                <div
                  key={item.lvl}
                  className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold border shrink-0"
                      style={{
                        color: item.color,
                        borderColor: `${item.color}40`,
                        backgroundColor: `${item.color}15`,
                      }}
                    >
                      {item.lvl}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-white/50">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-800/30 text-[10px] text-rose-200/80 leading-relaxed">
              ⚠️ 100 sels déposés = nuit totale permanente. Ne tentez PAS le succès Sel lors d&apos;un run de score !
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VUE 5 : BURST GIGALODON (RÈGLES D'OR & SCORES)                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {mainView === "burst" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-2 text-[11px]">
              <div className="font-mono font-bold uppercase text-rose-300 text-xs flex items-center gap-1.5">
                <Target size={13} /> Les 3 Règles Sacrées du Burst (3 Tours)
              </div>
              <div className="space-y-1.5 text-white/80">
                <p>
                  🚫 <strong>Jamais devant la gueule (3 cases) :</strong> le boss avale le joueur et pose un glyphe noir. Si un allié marche dessus = mort définitive !
                </p>
                <p>
                  🛡️ <strong>Diagonales uniquement :</strong> esquive les cônes d&apos;eau <em>Ultrasplash</em> et tenez-vous loin des bords pour éviter la repousse de 7 cases de <em>Tournageoire</em>.
                </p>
                <p>
                  ⚠️ <strong>3 cases d&apos;écart entre alliés :</strong> le sort <em>Gigarâle</em> ricoche à 2 PO de distance (700 dégâts par allié). 3 cases d&apos;écart = 0 dégât !
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-white/50">
                Barème de Conversion Dégâts ➔ Score Bonus
              </span>
              <div className="space-y-1 font-mono text-[11px]">
                {[
                  { dmg: "100 000 dmg", pts: "+5 000 pts" },
                  { dmg: "250 000 dmg", pts: "+9 000 pts" },
                  { dmg: "500 000 dmg", pts: "+12 000 pts" },
                  { dmg: "1 000 000 dmg", pts: "+15 000 pts ★" },
                ].map((row) => (
                  <div
                    key={row.dmg}
                    className="flex items-center justify-between p-1.5 rounded bg-white/[0.02] border border-white/5"
                  >
                    <span className="text-white/60">{row.dmg}</span>
                    <span className="font-bold text-cyan-300">{row.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-white/50 space-y-1">
              <p>• Le Gigalodon joue deux fois par tour (début de tour et milieu de groupe).</p>
              <p>• Fin automatique au début du Tour 4 via Gigalodoom (victoire garantie).</p>
              <p>• Priorisez les dégâts monocible (les sorts de zone ne tapent qu&apos;une seule fois sur la hitbox).</p>
            </div>
          </div>
        )}
      </main>

      {/* ── MODALE D'AGRANDISSEMENT D'IMAGE ── */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="max-w-[95vw] max-h-[85vh] bg-[#0c0d12] border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 bg-white/[0.04] border-b border-white/10 flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-white truncate">
                {zoomedImage.title}
              </span>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={zoomedImage.src}
                alt={zoomedImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
