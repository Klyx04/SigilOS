"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Tv2,
  ChevronRight,
  Compass,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Shield,
  Target,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRaidOverlay } from "@/hooks/use-raid-overlay";
import { isDocumentPipSupported } from "@/hooks/use-guide-pip";

interface RaidStratDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  worldId: number;
  onSelectCoords?: (x: number, y: number) => void;
}

type TabKey = "steps" | "mechanics" | "memo" | "burst";

const GIGALODON_STEPS = [
  {
    floor: "Étage -1",
    name: "Avant-poste des Explorateurs",
    coords: { x: 3, y: 2 },
    role: "Logistique & Nettoyage",
    tip: "Scinder en 3 escouades de 4. Vider les 18 groupes et miner les 4 filons de sel marin.",
    warning: "Sécurisez les 10 000 pts au coffre après les 2 premiers boss pour faire bondir le drop à 20%.",
  },
  {
    floor: "Étage -2",
    name: "Boss : Mureine des Abysses",
    coords: { x: 4, y: 7 },
    role: "Combat Boss 1",
    tip: "Pleine lumière (Niv. 4) obligatoire. Tuez les 3 monstres normaux (Madrépire, Kokayou, Léviatank) en priorité.",
    warning: "Pandawa cale la Mureine en coin ou combat à >10 PO pour bloquer Disperssssion.",
  },
  {
    floor: "Étage -3",
    name: "Falaise & Luminarium",
    coords: { x: 4, y: 12 },
    role: "Énigme du Mur",
    tip: "1 seul joueur clique sur la grille murale 4×4 des poissons-lanternes. ZÉRO sel à dépenser.",
    warning: "Si plusieurs joueurs cliquent en même temps, les états s'annulent et vous perdez du temps.",
  },
  {
    floor: "Étage -4",
    name: "Boss : Exécrabe le Géant",
    coords: { x: 9, y: 11 },
    role: "Combat Boss 2",
    tip: "Affrontez le crabe en Niv. 4. Notez l'ordre des 4 formes : Coquillage, Oursin, Perle, Poulpe !",
    warning: "Chaque erreur aux statues sous le lac inflige un malus direct de -1 000 points au raid.",
  },
  {
    floor: "Retour -1",
    name: "Dépôt des Récoltes (10 000 pts)",
    coords: { x: 3, y: 2 },
    role: "Validation Palier 20%",
    tip: "AUCUN échange en raid : TOUS les 12 joueurs doivent remonter au coffre déposer leurs ressources.",
    warning: "Dépasser 10 000 points fait bondir le drop du 4e fragment de 1% à 20% sur les Krak'Haine !",
  },
  {
    floor: "Étage -5",
    name: "Ossuaire & Krak'Haine",
    coords: { x: 10, y: 14 },
    role: "Drop Fragment 4",
    tip: "Avec le bonus 20% activé, le fragment tombe en 1 à 3 combats. Attention à l'os marin en [12,13] qui coupe l'autopilote !",
    warning: "Une fois les 4 fragments validés, tout le raid prend la cage de plongée en [10,14].",
  },
  {
    floor: "Étage -6",
    name: "Boss : Willorque des Profondeurs",
    coords: { x: 11, y: 16 },
    role: "Combat Boss 3",
    tip: "Willorque est SEUL. Pandawa le porte T1 et l'isole dans un coin à plus de 3 PO de toute lanterne/statue.",
    warning: "Zéro monstre, zéro orque spectre. Focus 100% DPS sur le boss (+10 000 pts au coffre).",
  },
  {
    floor: "Final ★",
    name: "Gigalodon le Souverain",
    coords: { x: 3, y: 2 },
    role: "Burst 3 Tours",
    tip: "3 tours pour envoyer un maximum de dégâts monocible. Jamais sur les 3 cases mêlée devant la gueule !",
    warning: "Restez en diagonale (évite Ultrasplash/Tournageoire) et gardez 3 cases d'écart (évite Gigarâle).",
  },
];

const LIGHT_LEVELS = [
  {
    lvl: "Niv. 4",
    title: "Pleine Lumière",
    status: "Idéal pour les Boss",
    desc: "Aucun buff pour les monstres. Niveau obligatoire avant de lancer Mureine et Exécrabe.",
    color: "#22c55e",
  },
  {
    lvl: "Niv. 3",
    title: "Lumière Moyenne",
    status: "Optimum Nettoyage",
    desc: "Monstres : +20% PV / +100 Puissance. Bon compromis rapidité / visibilité en exploration.",
    color: "#eab308",
  },
  {
    lvl: "Niv. 2",
    title: "Pénombre",
    status: "Dangereux",
    desc: "Monstres : +50% PV / +250 Puissance. Remettez du sel rapidement.",
    color: "#f97316",
  },
  {
    lvl: "Niv. 1",
    title: "Obscurité",
    status: "Critique",
    desc: "Monstres : +100% PV / +500 Puissance / +1 PM. Portée réduite.",
    color: "#ef4444",
  },
  {
    lvl: "Niv. 0",
    title: "Nuit Noire",
    status: "Aggro Totale",
    desc: "Monstres : +200% PV / +1000 Puissance / +2 PM. Aggro automatique sur toute la carte !",
    color: "#dc2626",
  },
];

const SHAPES = [
  { id: "coquillage", label: "Coquillage", symbol: "🐚", element: "Terre", color: "#f59e0b" },
  { id: "oursin", label: "Oursin", symbol: "🦔", element: "Air", color: "#10b981" },
  { id: "perle", label: "Perle", symbol: "⚪", element: "Feu", color: "#f43f5e" },
  { id: "poulpe", label: "Poulpe", symbol: "🐙", element: "Eau", color: "#06b6d4" },
];

export function RaidStratDrawer({
  isOpen,
  onClose,
  worldId,
  onSelectCoords,
}: RaidStratDrawerProps) {
  const { openRaidOverlay, closeRaidOverlay, isOpen: overlayIsOpen } = useRaidOverlay();
  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [launchLoading, setLaunchLoading] = useState(false);

  const pipSupported = isDocumentPipSupported();
  const isGigalodon = worldId === 37;
  const raidSlug = isGigalodon ? "gigalodon" : "jardin-eternel";
  const raidName = isGigalodon ? "Gouffre du Gigalodon" : "Sanctuaire des Jardins Éternels";
  const themeColor = isGigalodon ? "#06b6d4" : "#10b981";

  const handleLaunchOverlay = async () => {
    if (overlayIsOpen) {
      closeRaidOverlay();
      return;
    }
    setLaunchLoading(true);
    try {
      await openRaidOverlay({ raidSlug: isGigalodon ? "gigalodon" : "jardin-eternel" });
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleToggleShape = (shapeId: string) => {
    if (selectedShapes.includes(shapeId)) {
      setSelectedShapes(selectedShapes.filter((s) => s !== shapeId));
    } else if (selectedShapes.length < 4) {
      setSelectedShapes([...selectedShapes, shapeId]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0, x: -420 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -420 }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
          className="absolute top-0 left-0 h-full w-[380px] sm:w-[420px] max-w-[95vw] z-[490] flex flex-col bg-[#08090c]/98 backdrop-blur-2xl border-r border-white/10 shadow-[24px_0_60px_rgba(0,0,0,0.65)] text-white overflow-hidden select-none"
        >
          {/* ── EN-TÊTE SOBRE (STYLE REGISTRE) ──────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: themeColor, boxShadow: `0 0 8px ${themeColor}` }}
                />
                <p
                  className="text-[10px] font-mono uppercase tracking-widest font-semibold"
                  style={{ color: themeColor }}
                >
                  Stratégie de Raid · 12 Joueurs
                </p>
              </div>
              <h2 className="text-base font-bold tracking-tight text-white/95 mt-0.5">
                {raidName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              title="Fermer la stratégie (Echap)"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── BANDEAU OVERLAY IN-GAME (HERO CTA) ─────────────────────────── */}
          <div className="p-4 border-b border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent shrink-0">
            <div
              className="p-3.5 rounded-xl border relative overflow-hidden"
              style={{
                borderColor: `${themeColor}35`,
                background: `linear-gradient(135deg, ${themeColor}12 0%, rgba(255,255,255,0.01) 100%)`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs border"
                    style={{
                      backgroundColor: `${themeColor}20`,
                      borderColor: `${themeColor}40`,
                      color: themeColor,
                    }}
                  >
                    <Tv2 size={13} />
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide">
                    Overlay In-Game
                  </span>
                </div>
                {pipSupported && (
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${themeColor}20`,
                      color: themeColor,
                      border: `1px solid ${themeColor}40`,
                    }}
                  >
                    PiP ✓ Détachable
                  </span>
                )}
              </div>

              <p className="text-[11px] text-white/60 mb-3 leading-relaxed">
                Gardez les strats, positions et l'énigme des statues toujours affichées par-dessus votre jeu Dofus, sans alt-tab.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLaunchOverlay}
                  disabled={launchLoading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border shadow-sm",
                    overlayIsOpen
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                      : "text-black hover:brightness-110 active:scale-[0.98]"
                  )}
                  style={
                    overlayIsOpen
                      ? {}
                      : {
                          backgroundColor: themeColor,
                          borderColor: themeColor,
                          boxShadow: `0 2px 14px ${themeColor}35`,
                        }
                  }
                >
                  {launchLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : overlayIsOpen ? (
                    <Tv2 size={13} />
                  ) : (
                    <Tv2 size={13} />
                  )}
                  <span>
                    {launchLoading
                      ? "Ouverture…"
                      : overlayIsOpen
                      ? "Fermer l'overlay"
                      : "Lancer l'Overlay In-Game"}
                  </span>
                </button>

                {isGigalodon && (
                  <a
                    href="/guides/raid-gigalodon-dofus-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
                    title="Ouvrir le guide complet sur le site"
                  >
                    <FileText size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── ONGLETS DE NAVIGATION SOBRES ───────────────────────────────── */}
          <div className="grid grid-cols-4 border-b border-white/10 bg-black/30 shrink-0 text-center text-[11px] font-semibold">
            {[
              { id: "steps" as TabKey, label: "Étapes" },
              { id: "mechanics" as TabKey, label: "Lumière" },
              { id: "memo" as TabKey, label: "Statues" },
              { id: "burst" as TabKey, label: "Burst" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "py-2.5 transition-colors border-b-2 font-mono uppercase tracking-wider text-[10px]",
                  activeTab === tab.id
                    ? "text-white border-cyan-400 bg-white/[0.04]"
                    : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.02]"
                )}
                style={
                  activeTab === tab.id
                    ? { borderColor: themeColor, color: themeColor }
                    : {}
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── CONTENU SCROLLABLE ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
            {/* TAB 1 : ÉTAPES & PARCOURS */}
            {activeTab === "steps" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-white/50 px-1 font-mono">
                  <span>Progression en 8 Étapes</span>
                  <span>Cliquez sur une coordonnée pour centrer</span>
                </div>

                {GIGALODON_STEPS.map((step, index) => (
                  <div
                    key={step.floor}
                    className="p-3 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/10 transition-colors group relative"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
                          style={{
                            borderColor: `${themeColor}35`,
                            color: themeColor,
                            backgroundColor: `${themeColor}10`,
                          }}
                        >
                          {step.floor}
                        </span>
                        <h3 className="text-xs font-bold text-white/95">
                          {step.name}
                        </h3>
                      </div>

                      {onSelectCoords && (
                        <button
                          onClick={() => onSelectCoords(step.coords.x, step.coords.y)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors shrink-0"
                          title="Centrer la carte sur cette coordonnée"
                        >
                          <Compass size={10} />
                          <span>[{step.coords.x}, {step.coords.y}]</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {step.tip}
                    </p>

                    {step.warning && (
                      <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-start gap-1.5 text-[10px] text-amber-300/80">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <span>{step.warning}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2 : GESTION DE LA LUMIÈRE */}
            {activeTab === "mechanics" && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-cyan-300 font-mono text-[10px] uppercase tracking-wider">
                    <Flame size={12} />
                    Règle du Gouffre
                  </div>
                  Le sel marin miné sur les filons permet d'alimenter les lampes.
                  Maintenez le <strong>Niveau 3</strong> pendant le nettoyage des couloirs,
                  et passez au <strong>Niveau 4</strong> avant d'engager Mureine et Exécrabe.
                </div>

                <div className="space-y-2">
                  {LIGHT_LEVELS.map((level) => (
                    <div
                      key={level.lvl}
                      className="p-3 rounded-xl bg-white/[0.025] border border-white/10 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: level.color }}
                          />
                          <span className="text-xs font-mono font-bold text-white">
                            {level.lvl} · {level.title}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                          style={{
                            color: level.color,
                            borderColor: `${level.color}35`,
                            backgroundColor: `${level.color}10`,
                          }}
                        >
                          {level.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">
                        {level.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/30 text-[10px] text-rose-200/80 leading-relaxed">
                  ⚠️ <strong>Succès "Sel" :</strong> Si votre équipe dépose 100 sels dans le coffre, la lumière s'éteint définitivement pour toute la run. À proscrire pour une complétion de raid sereine !
                </div>
              </div>
            )}

            {/* TAB 3 : MÉMO STATUES EXÉCRABE */}
            {activeTab === "memo" && (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-white/[0.025] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Ordre des Statues du Lac (-4 bis)
                    </span>
                    {selectedShapes.length > 0 && (
                      <button
                        onClick={() => setSelectedShapes([])}
                        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors font-mono"
                      >
                        <RotateCcw size={10} />
                        Effacer
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Pendant le combat contre <strong>Exécrabe</strong> (-4), 4 formes apparaissent tour à tour. Notez leur ordre ici d'un simple clic pour aller activer les statues correspondantes au fond du lac :
                  </p>

                  {/* Séquence actuelle */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[0, 1, 2, 3].map((idx) => {
                      const shapeId = selectedShapes[idx];
                      const shape = SHAPES.find((s) => s.id === shapeId);
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "h-14 rounded-lg border flex flex-col items-center justify-center transition-all",
                            shape
                              ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300"
                              : "bg-white/[0.02] border-white/10 text-white/20 border-dashed"
                          )}
                        >
                          <span className="text-[9px] font-mono text-white/40 mb-0.5">
                            #{idx + 1}
                          </span>
                          <span className="text-base font-bold">
                            {shape ? shape.symbol : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Boutons de sélection */}
                <div className="grid grid-cols-2 gap-2">
                  {SHAPES.map((shape) => {
                    const isSelected = selectedShapes.includes(shape.id);
                    const positionIndex = selectedShapes.indexOf(shape.id);
                    return (
                      <button
                        key={shape.id}
                        onClick={() => handleToggleShape(shape.id)}
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between transition-all",
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-400/40 text-white"
                            : "bg-white/[0.025] hover:bg-white/[0.06] border-white/10 text-white/70"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg text-cyan-400">{shape.symbol}</span>
                          <span className="text-xs font-semibold">{shape.label}</span>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-black flex items-center justify-center font-mono">
                            {positionIndex + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] text-white/40 italic text-center">
                  Astuce : ces formes sont synchronisées en direct dans l'Overlay In-Game.
                </p>
              </div>
            )}

            {/* TAB 4 : BURST GIGALODON */}
            {activeTab === "burst" && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <Target size={13} />
                    Les 3 Règles Sacrées (3 Tours de Burst)
                  </div>
                  <div className="space-y-2 pt-1 text-[11px]">
                    <div className="flex items-start gap-2 text-white/80">
                      <span className="text-rose-400 font-black">1.</span>
                      <span>
                        <strong>Jamais sur les 3 cases face à la gueule :</strong> le monstre avale tout joueur devant lui et l'élimine immédiatement de la run.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-white/80">
                      <span className="text-emerald-400 font-black">2.</span>
                      <span>
                        <strong>Placement en diagonale :</strong> esquive automatiquement les cônes de sorts <em>Ultrasplash</em> et <em>Tournageoire</em>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-white/80">
                      <span className="text-amber-400 font-black">3.</span>
                      <span>
                        <strong>3 cases d'écart minimum entre chaque allié :</strong> le sort <em>Gigarâle</em> ricoche et inflige 700 dégâts par allié à portée.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.025] border border-white/10 space-y-2">
                  <span className="text-xs font-mono font-bold text-white/80 uppercase tracking-wider">
                    Paliers de Score & Dégâts
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { dmg: "100 000 dégâts", pts: "+5 000 pts" },
                      { dmg: "250 000 dégâts", pts: "+9 000 pts" },
                      { dmg: "500 000 dégâts", pts: "+12 000 pts" },
                      { dmg: "1 000 000 dégâts (Palier Max)", pts: "+15 000 pts ★" },
                    ].map((row) => (
                      <div
                        key={row.dmg}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs font-mono"
                      >
                        <span className="text-white/60">{row.dmg}</span>
                        <span className="font-bold text-cyan-300">{row.pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
