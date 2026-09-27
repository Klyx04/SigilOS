"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  ExternalLink,
  AlertTriangle,
  Flame,
  RotateCcw,
  Compass,
  Sparkles,
  Target,
  BookOpen,
  Eye,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRaidOverlayStore, type RaidSlug } from "@/store/raid-overlay-store";
import { RAIDS_DATA, type RaidStep } from "@/lib/raid-overlay-data";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";

interface RaidOverlayClientProps {
  initialRaidSlug?: RaidSlug;
  pinned?: boolean;
  onClose?: () => void;
}

const EXECRABE_SHAPE_OPTIONS = [
  { id: "triangle", label: "Triangle", symbol: "▲" },
  { id: "circle", label: "Cercle", symbol: "●" },
  { id: "square", label: "Carré", symbol: "■" },
  { id: "star", label: "Étoile", symbol: "★" },
];

const LIGHT_SCALE = [
  { lvl: "4", name: "Pleine Lumière", desc: "0 buff monstre · Requis pour les Boss", color: "#22c55e" },
  { lvl: "3", name: "Moyenne", desc: "+20% PV / +100 Pui · Nettoyage rapide", color: "#eab308" },
  { lvl: "2", name: "Pénombre", desc: "+50% PV / +250 Pui · Remettre du sel", color: "#f97316" },
  { lvl: "1", name: "Obscurité", desc: "+100% PV / +500 Pui / +1 PM", color: "#ef4444" },
  { lvl: "0", name: "Nuit Noire", desc: "Aggro totale · +200% PV / +1000 Pui", color: "#dc2626" },
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

  const [mainView, setMainView] = useState<"step" | "statues" | "light" | "burst">("step");
  const [copiedTravel, setCopiedTravel] = useState(false);

  const handleCopyTravel = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedTravel(true);
    toast.success("Position copiée !", {
      description: cmd,
      icon: <Compass className="w-4 h-4 text-cyan-400" />,
      duration: 1500,
    });
    setTimeout(() => setCopiedTravel(false), 2000);
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
      <header className="h-11 shrink-0 px-3 bg-[#0c0d12] border-b border-white/10 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: raid.themeColor, boxShadow: `0 0 6px ${raid.themeColor}` }}
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
            <option value="gigalodon" className="bg-[#0c0d12] text-white">
              Gouffre Gigalodon
            </option>
            <option value="jardin-eternel" className="bg-[#0c0d12] text-white">
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
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
          {onClose && (
            <button
              onClick={onClose}
              title="Fermer l'overlay"
              className="p-1.5 rounded-md text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {!pinned && <OverlayPinNotice />}

      {/* ── 2. SÉLECTEUR DE SALLES / BOSS DU RAID (8 ÉTAPES SANS STEPPER SLOP) ── */}
      <div className="shrink-0 bg-[#090a0f] border-b border-white/10 px-2 py-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {raid.steps.map((st, idx) => {
          const isActive = idx === activeStepIdx && mainView === "step";
          // Abréviation ultra-compacte pour le HUD
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
              ? "Coffre"
              : idx === 5
              ? "-5 Krak'Haine"
              : idx === 6
              ? "-6 Willorque"
              : "★ Gigalodon";

          return (
            <button
              key={st.id}
              onClick={() => {
                setActiveStep(idx);
                setMainView("step");
              }}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-all border",
                isActive
                  ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                  : "bg-white/[0.03] border-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
              )}
            >
              {shortLabel}
            </button>
          );
        })}
      </div>

      {/* ── 3. ONGLETS D'OUTILS RAPIDES (STATUES / LUMIÈRE / BURST) ── */}
      <div className="grid grid-cols-4 shrink-0 bg-black/40 border-b border-white/10 text-[10px] font-mono uppercase tracking-wider text-center">
        <button
          onClick={() => setMainView("step")}
          className={cn(
            "py-1.5 border-b transition-colors",
            mainView === "step"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.02]"
              : "text-white/40 border-transparent hover:text-white/70"
          )}
        >
          Strat Salle
        </button>
        <button
          onClick={() => setMainView("statues")}
          className={cn(
            "py-1.5 border-b transition-colors flex items-center justify-center gap-1",
            mainView === "statues"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.02]"
              : "text-white/40 border-transparent hover:text-white/70"
          )}
        >
          <Sparkles size={10} /> Statues
        </button>
        <button
          onClick={() => setMainView("light")}
          className={cn(
            "py-1.5 border-b transition-colors flex items-center justify-center gap-1",
            mainView === "light"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.02]"
              : "text-white/40 border-transparent hover:text-white/70"
          )}
        >
          <Flame size={10} /> Lumière
        </button>
        <button
          onClick={() => setMainView("burst")}
          className={cn(
            "py-1.5 border-b transition-colors flex items-center justify-center gap-1",
            mainView === "burst"
              ? "text-cyan-300 border-cyan-400 bg-white/[0.02]"
              : "text-white/40 border-transparent hover:text-white/70"
          )}
        >
          <Target size={10} /> Burst
        </button>
      </div>

      {/* ── 4. CONTENU PRINCIPAL ADAPTÉ AU JEU ── */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-white/10">
        {/* VUE 1 : STRATÉGIE DE LA SALLE SÉLECTIONNÉE */}
        {mainView === "step" && currentStep && (
          <div className="space-y-3">
            {/* Barre de la salle + Commande /travel directe */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">
                    {currentStep.floor}
                  </span>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="text-xs font-bold text-white truncate">
                    {currentStep.bossName || currentStep.title}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleCopyTravel(currentStep.travelCommand)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] font-bold uppercase transition-all shrink-0 border",
                  copiedTravel
                    ? "bg-emerald-500 text-black border-emerald-400 font-black"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                )}
                title="Copier la position dans le presse-papier"
              >
                <Copy size={10} />
                <span>{copiedTravel ? "Copié !" : currentStep.coords}</span>
              </button>
            </div>

            {/* Résumé tactique direct (zéro blabla) */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-white/80 leading-relaxed">
              {currentStep.summary}
            </div>

            {/* Alertes & Dangers majeurs */}
            <div className="space-y-1.5">
              {currentStep.keyMechanics.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded-lg border text-[11px] leading-snug",
                    m.danger
                      ? "bg-rose-950/25 border-rose-800/40 text-rose-200"
                      : "bg-white/[0.02] border-white/10 text-white/80"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5 font-mono text-[10px] uppercase">
                    {m.danger ? (
                      <span className="text-rose-400">⚠️ {m.label}</span>
                    ) : (
                      <span className="text-cyan-300">ℹ️ {m.label}</span>
                    )}
                  </div>
                  <p className="text-white/70 text-[10.5px]">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Pad Exécrabe si étape 4 */}
            {currentStep.hasExecrabePad && (
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-cyan-300">
                    Ordre des 4 Statues (-4 bis)
                  </span>
                  {execrabeShapes.some(Boolean) && (
                    <button
                      onClick={clearExecrabeShapes}
                      className="text-[9px] font-mono text-white/40 hover:text-white flex items-center gap-1"
                    >
                      <RotateCcw size={9} /> Reset
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const val = execrabeShapes[slotIdx];
                    const shapeObj = EXECRABE_SHAPE_OPTIONS.find((s) => s.id === val);
                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "h-11 rounded-lg border flex flex-col items-center justify-center transition-all",
                          shapeObj
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                            : "bg-black/40 border-dashed border-white/20 text-white/20"
                        )}
                      >
                        <span className="text-[8px] font-mono text-white/40">#{slotIdx + 1}</span>
                        <span className="text-sm font-bold">{shapeObj ? shapeObj.symbol : "—"}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-4 gap-1 pt-1">
                  {EXECRABE_SHAPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleToggleShape(opt.id)}
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-center flex flex-col items-center transition-colors"
                    >
                      <span className="text-base text-cyan-400">{opt.symbol}</span>
                      <span className="text-[8px] font-mono text-white/60">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Burst Gigalodon si étape 8 */}
            {currentStep.hasBurstGuide && (
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2 text-[10.5px]">
                <div className="font-mono font-bold uppercase text-rose-300 text-[10px]">
                  ★ 3 Règles Sacrées du Burst
                </div>
                <div className="space-y-1 text-white/80">
                  <p>🚫 <strong>Jamais devant la gueule :</strong> dévoré = éliminé direct.</p>
                  <p>🛡️ <strong>Diagonales uniquement :</strong> esquive les cônes de sorts.</p>
                  <p>⚠️ <strong>3 cases d'écart :</strong> le sort ricoche et tue les alliés.</p>
                </div>
              </div>
            )}

            {/* Plan d'action concis */}
            <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-white/40">
                Déroulement
              </span>
              <div className="space-y-1 text-[11px] text-white/70">
                {currentStep.strategy.map((st, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-mono font-bold shrink-0">{i + 1}.</span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VUE 2 : OUTIL STATUES D'EXÉCRABE */}
        {mainView === "statues" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Mémo Statues du Lac</span>
                {execrabeShapes.some(Boolean) && (
                  <button
                    onClick={clearExecrabeShapes}
                    className="text-[10px] font-mono text-white/40 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw size={10} /> Effacer
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Pendant le combat contre <strong>Exécrabe</strong> (-4), cliquez sur les 4 formes dans l'ordre d'apparition pour activer les statues sous le lac :
              </p>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const val = execrabeShapes[slotIdx];
                  const shapeObj = EXECRABE_SHAPE_OPTIONS.find((s) => s.id === val);
                  return (
                    <div
                      key={slotIdx}
                      className={cn(
                        "h-14 rounded-lg border flex flex-col items-center justify-center transition-all",
                        shapeObj
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                          : "bg-white/[0.02] border-dashed border-white/10 text-white/20"
                      )}
                    >
                      <span className="text-[9px] font-mono text-white/40">#{slotIdx + 1}</span>
                      <span className="text-lg font-bold">{shapeObj ? shapeObj.symbol : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EXECRABE_SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleToggleShape(opt.id)}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-cyan-400">{opt.symbol}</span>
                    <span className="text-xs font-semibold text-white/80">{opt.label}</span>
                  </div>
                  {execrabeShapes.includes(opt.id) && (
                    <span className="w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-mono font-bold flex items-center justify-center">
                      {execrabeShapes.indexOf(opt.id) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VUE 3 : RÈGLES DE LA LUMIÈRE */}
        {mainView === "light" && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed">
              Maintenez <strong>Niveau 3</strong> en nettoyage des couloirs et montez en <strong>Niveau 4</strong> avant d'engager Mureine et Exécrabe.
            </div>

            <div className="space-y-1.5">
              {LIGHT_SCALE.map((item) => (
                <div
                  key={item.lvl}
                  className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-mono font-bold border"
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
              ⚠️ 100 sels déposés = nuit totale permanente. Ne faites pas le succès Sel lors d'une run classique !
            </div>
          </div>
        )}

        {/* VUE 4 : BURST GIGALODON */}
        {mainView === "burst" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-2 text-[11px]">
              <div className="font-mono font-bold uppercase text-rose-300 text-xs flex items-center gap-1.5">
                <Target size={13} /> Les 3 Règles d'Or (3 Tours)
              </div>
              <div className="space-y-1.5 text-white/80">
                <p>🚫 <strong>Jamais face à la gueule (3 cases) :</strong> le boss avale le joueur et l'élimine immédiatement de la run.</p>
                <p>🛡️ <strong>En diagonale uniquement :</strong> évite les gros cônes de dégâts <em>Ultrasplash</em> et <em>Tournageoire</em>.</p>
                <p>⚠️ <strong>3 cases d'écart entre chaque allié :</strong> évite le ricochet du <em>Gigarâle</em> (700 dégâts par allié).</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/10 space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-white/50">
                Paliers de Score
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
          </div>
        )}
      </main>
    </div>
  );
}
