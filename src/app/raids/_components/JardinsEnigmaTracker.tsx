"use client";

import React, { useState } from "react";
import {
  Compass,
  Ship,
  Check,
  RotateCcw,
  Copy,
  ChevronDown,
  X,
  Eye,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n/client";

export interface JardinsEnigmaTrackerProps {
  compact?: boolean;
  onCopyTravel?: (cmd: string) => void;
}

const PIECES_ECHECS = [
  { id: "tour-blanche", name: "Tour blanche", sprite: "/images/guides/sanctuaire/enigmes/tour-blanche.png" },
  { id: "tour-noire", name: "Tour noire", sprite: "/images/guides/sanctuaire/enigmes/tour-noire.png" },
  { id: "fou-blanc", name: "Fou blanc", sprite: "/images/guides/sanctuaire/enigmes/fou-blanc.png" },
  { id: "fou-noir", name: "Fou noir", sprite: "/images/guides/sanctuaire/enigmes/fou-noir.png" },
];

const COLS_ECHECS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const ROWS_ECHECS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

const BELLADONE_ITEMS = [
  { id: "crayon", name: "Crayons", icon: "/images/guides/sanctuaire/enigmes/crayons.png" },
  { id: "bobine", name: "Bobine", icon: "/images/guides/sanctuaire/enigmes/bobine.png" },
  { id: "lanterne", name: "Lanterne", icon: "/images/guides/sanctuaire/enigmes/lanterne.png" },
  { id: "kamas", name: "Kamas", icon: "/images/guides/sanctuaire/enigmes/kamas.png" },
  { id: "arakne", name: "Arakne", icon: "/images/guides/sanctuaire/enigmes/arakne.png" },
  { id: "bougie", name: "Bougie", icon: "/images/guides/sanctuaire/enigmes/bougie.png" },
  { id: "bague", name: "Bague", icon: "/images/guides/sanctuaire/enigmes/bague.png" },
  { id: "regle", name: "Règle", icon: "/images/guides/sanctuaire/enigmes/regle.png" },
];

const ROMAINS = ["I", "II", "III", "IV"] as const;

const ENIGMA_COLORS = [
  { id: "orange", label: "Orange / Jaune", hex: "#EF9F27" },
  { id: "bleu", label: "Bleu", hex: "#38bdf8" },
  { id: "rouge", label: "Rouge", hex: "#f43f5e" },
  { id: "vert", label: "Vert", hex: "#10b981" },
] as const;

const STATUE_SPRITES = [
  { id: "statue1", name: "Fracamélia", sprite: "/images/guides/sanctuaire/enigmes/fracamelia.png" },
  { id: "statue2", name: "Tritulipe", sprite: "/images/guides/sanctuaire/enigmes/tritulipe.png" },
  { id: "statue3", name: "Muguégide", sprite: "/images/guides/sanctuaire/enigmes/muguegide.png" },
  { id: "statue4", name: "Dahliane", sprite: "/images/guides/sanctuaire/enigmes/dahliane.png" },
];

const JARDINS_DIRECTIONS = [
  {
    id: "haut",
    label: "Haut (Nord)",
    arrow: "▲",
    img1: "/images/guides/sanctuaire/enigmes/top.jpg",
    img2: "/images/guides/sanctuaire/enigmes/minitop.jpg",
  },
  {
    id: "bas",
    label: "Bas (Sud)",
    arrow: "▼",
    img1: "/images/guides/sanctuaire/enigmes/bottom.jpg",
    img2: "/images/guides/sanctuaire/enigmes/minibottom.jpg",
  },
  {
    id: "gauche",
    label: "Gauche (Ouest)",
    arrow: "◀",
    img1: "/images/guides/sanctuaire/enigmes/left.jpg",
    img2: "/images/guides/sanctuaire/enigmes/minileft.jpg",
  },
  {
    id: "droite",
    label: "Droite (Est)",
    arrow: "▶",
    img1: "/images/guides/sanctuaire/enigmes/right.jpg",
    img2: "/images/guides/sanctuaire/enigmes/miniright.jpg",
  },
] as const;

const STATUES_TRUTH_TABLE: Record<string, { pos: string; arrow: string; travel: string }> = {
  orange_statue1: { pos: "[11, 19]", arrow: "▲ Nord", travel: "/travel 11,19" },
  orange_statue2: { pos: "[10, 20]", arrow: "◀ Ouest", travel: "/travel 10,20" },
  orange_statue3: { pos: "[12, 20]", arrow: "▶ Est", travel: "/travel 12,20" },
  orange_statue4: { pos: "[11, 21]", arrow: "▼ Sud", travel: "/travel 11,21" },
  bleu_statue1: { pos: "[11, 21]", arrow: "▼ Sud", travel: "/travel 11,21" },
  bleu_statue2: { pos: "[12, 20]", arrow: "▶ Est", travel: "/travel 12,20" },
  bleu_statue3: { pos: "[10, 20]", arrow: "◀ Ouest", travel: "/travel 10,20" },
  bleu_statue4: { pos: "[11, 19]", arrow: "▲ Nord", travel: "/travel 11,19" },
  rouge_statue1: { pos: "[12, 20]", arrow: "▶ Est", travel: "/travel 12,20" },
  rouge_statue2: { pos: "[11, 19]", arrow: "▲ Nord", travel: "/travel 11,19" },
  rouge_statue3: { pos: "[11, 21]", arrow: "▼ Sud", travel: "/travel 11,21" },
  rouge_statue4: { pos: "[10, 20]", arrow: "◀ Ouest", travel: "/travel 10,20" },
  vert_statue1: { pos: "[10, 20]", arrow: "◀ Ouest", travel: "/travel 10,20" },
  vert_statue2: { pos: "[11, 21]", arrow: "▼ Sud", travel: "/travel 11,21" },
  vert_statue3: { pos: "[11, 19]", arrow: "▲ Nord", travel: "/travel 11,19" },
  vert_statue4: { pos: "[12, 20]", arrow: "▶ Est", travel: "/travel 12,20" },
};

export function JardinsEnigmaTracker({ compact = false, onCopyTravel }: JardinsEnigmaTrackerProps) {
  const [activeTab, setActiveTab] = useState<"echecs" | "objets" | "bateaux" | "statues">("statues");

  // 1. Échecs State
  const [piecesPos, setPiecesPos] = useState<Record<string, string>>({});
  const [openPosPickerPieceId, setOpenPosPickerPieceId] = useState<string | null>(null);

  // 2. Objets State
  const [objetsSlots, setObjetsSlots] = useState<Record<string, [string | null, string | null]>>({
    I: [null, null],
    II: [null, null],
    III: [null, null],
    IV: [null, null],
  });
  const [fleursPerRomain, setFleursPerRomain] = useState<Record<string, number | null>>({
    I: null,
    II: null,
    III: null,
    IV: null,
  });
  const [selectedColor, setSelectedColor] = useState<string | null>("orange");
  const [openObjPicker, setOpenObjPicker] = useState<{ romain: string; slotIdx: number } | null>(null);

  // 3. Bateaux State (Bataille Navale)
  const [boatsMap1, setBoatsMap1] = useState<Record<string, boolean>>({});
  const [boatsMap2, setBoatsMap2] = useState<Record<string, boolean>>({});

  // 4. Statues State
  const [statueSelected, setStatueSelected] = useState<string | null>("statue1");
  const [activeDirection, setActiveDirection] = useState<"haut" | "bas" | "gauche" | "droite">("haut");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Handlers
  const handleCopy = async (cmd: string, key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onCopyTravel) {
      onCopyTravel(cmd);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
      return;
    }
    const doc = (e?.currentTarget as HTMLElement | undefined)?.ownerDocument || document;
    const ok = await copyToClipboard(cmd, doc);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const resetAll = () => {
    setPiecesPos({});
    setOpenPosPickerPieceId(null);
    setObjetsSlots({ I: [null, null], II: [null, null], III: [null, null], IV: [null, null] });
    setFleursPerRomain({ I: null, II: null, III: null, IV: null });
    setSelectedColor("orange");
    setOpenObjPicker(null);
    setBoatsMap1({});
    setBoatsMap2({});
    setStatueSelected("statue1");
    setActiveDirection("haut");
  };

  const getUsedObjects = (currentRomain: string, currentSlot: number) => {
    const used = new Set<string>();
    Object.entries(objetsSlots).forEach(([r, slots]) => {
      slots.forEach((item, idx) => {
        if (item && !(r === currentRomain && idx === currentSlot)) {
          used.add(item);
        }
      });
    });
    return used;
  };

  const toggleBoat = (mapId: 1 | 2, cell: string) => {
    const current = mapId === 1 ? boatsMap1 : boatsMap2;
    const count = Object.values(current).filter(Boolean).length;
    const isAlready = !!current[cell];
    if (!isAlready && count >= 3) return; // max 3 bateaux par carte
    const setter = mapId === 1 ? setBoatsMap1 : setBoatsMap2;
    setter((prev) => ({ ...prev, [cell]: !prev[cell] }));
  };

  const currentStatueResult =
    selectedColor && statueSelected ? STATUES_TRUTH_TABLE[`${selectedColor}_${statueSelected}`] : null;

  const currentDirectionData = JARDINS_DIRECTIONS.find((d) => d.id === activeDirection) || JARDINS_DIRECTIONS[0];

  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
    <div className={cn("rounded-xl border border-border bg-[#0e1117] text-foreground space-y-4", compact ? "p-3" : "p-5")}>
      {/* ── HEADER / NAVIGATION SUB-TABS ── */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto reg-scrollbar">
          {[
            { id: "statues", label: "Statues", icon: "🗿" },
            { id: "echecs", label: isEn ? "Chess" : "Échecs", icon: "♟️" },
            { id: "objets", label: isEn ? "Items" : "Objets", icon: "🏺" },
            { id: "bateaux", label: isEn ? "Boats" : "Bateaux", icon: "⛵" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as any);
                setOpenPosPickerPieceId(null);
                setOpenObjPicker(null);
              }}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                activeTab === tab.id
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={resetAll}
          title={isEn ? "Reset all 4 puzzles" : "Réinitialiser l'ensemble des 4 énigmes"}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
        >
          <RotateCcw size={11} />
          <span>{isEn ? "Reset all" : "Tout reset"}</span>
        </button>
      </div>

      {/* ── 1. ÉNIGME DES STATUES ── */}
      {activeTab === "statues" && (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Comparez la vue du <strong>Clos des Protecteurs</strong> à la miniature de la <strong>Cour d'Éphèdre</strong>. Renseignez la statue apparue au centre et la couleur obtenue dans l'Ouvrage : l'outil calcule la position exacte du monstre.
          </p>

          <div className={cn("grid gap-4 items-start", compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12")}>
            {/* Visualisation Croix & Miniatures */}
            <div className={cn("space-y-3", compact ? "col-span-1" : "lg:col-span-7")}>
              {/* Croix directionnelle */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Angle de vue :
                </span>
                <div className="flex items-center gap-1">
                  {JARDINS_DIRECTIONS.map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setActiveDirection(dir.id as any)}
                      className={cn(
                        "w-7 h-7 rounded flex items-center justify-center font-bold text-xs border transition-all cursor-pointer",
                        activeDirection === dir.id
                          ? "bg-emerald-500 text-black border-emerald-400 font-black shadow-sm"
                          : "bg-surface border-border text-muted-foreground hover:text-foreground"
                      )}
                      title={dir.label}
                    >
                      {dir.arrow}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos comparatives */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-black/40 overflow-hidden">
                  <div className="px-2 py-1 bg-white/[0.03] border-b border-border text-[10px] font-medium text-muted-foreground truncate">
                    Clos des Protecteurs
                  </div>
                  <img
                    src={currentDirectionData.img1}
                    alt="Vue Clos des Protecteurs"
                    className="w-full h-32 sm:h-36 object-cover"
                  />
                </div>
                <div className="rounded-lg border border-border bg-black/40 overflow-hidden">
                  <div className="px-2 py-1 bg-white/[0.03] border-b border-border text-[10px] font-medium text-muted-foreground truncate">
                    Cour d'Éphèdre (Miniature)
                  </div>
                  <img
                    src={currentDirectionData.img2}
                    alt="Vue Cour d'Éphèdre"
                    className="w-full h-32 sm:h-36 object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Sélecteurs Statue & Couleur + Résultat */}
            <div className={cn("space-y-4", compact ? "col-span-1" : "lg:col-span-5")}>
              {/* Choix des 4 statues */}
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  1. Statue apparue au centre :
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUE_SPRITES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatueSelected(st.id)}
                      className={cn(
                        "p-1.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer",
                        statueSelected === st.id
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm"
                          : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                      )}
                      title={st.name}
                    >
                      <img src={st.sprite} alt={st.name} className="w-8 h-8 object-contain" />
                      <span className="text-[10px] font-semibold truncate w-full text-center">{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Choix de la couleur */}
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  2. Couleur (Ouvrage Monochrome) :
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {ENIGMA_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedColor(col.id)}
                      style={{
                        backgroundColor: selectedColor === col.id ? `${col.hex}33` : "transparent",
                        borderColor: selectedColor === col.id ? col.hex : "rgba(255,255,255,0.1)",
                        color: selectedColor === col.id ? col.hex : "rgba(255,255,255,0.7)",
                      }}
                      className={cn(
                        "py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.hex }} />
                      <span className="truncate">{col.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Résultat Calculé */}
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Cible calculée à éliminer :
                </span>
                {currentStatueResult ? (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-xl font-mono font-black text-foreground">
                        {currentStatueResult.pos}
                      </div>
                      <span className="text-[11px] text-emerald-300 font-medium">
                        Orientation : {currentStatueResult.arrow}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopy(currentStatueResult.travel, "statue-target", e)}
                      className={cn(
                        "px-2.5 py-1.5 rounded font-mono text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1",
                        copiedKey === "statue-target"
                          ? "bg-emerald-500 text-black border-emerald-400"
                          : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40"
                      )}
                    >
                      {copiedKey === "statue-target" ? <Check size={12} /> : <Copy size={11} />}
                      <span>{copiedKey === "statue-target" ? "Copié" : currentStatueResult.travel}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Sélectionnez une statue et une couleur pour afficher la position.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. ÉNIGME DES ÉCHECS ── */}
      {activeTab === "echecs" && (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Renseignez les coordonnées des 4 pièces d'échecs (grille A1 à K11) observées dans la Réserve pour placer vos personnages sur les cases identiques lors du combat en Cour d'Éphèdre.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PIECES_ECHECS.map((piece) => {
              const pos = piecesPos[piece.id];
              const isOpen = openPosPickerPieceId === piece.id;

              return (
                <div key={piece.id} className="p-3 rounded-lg border border-border bg-surface/50 space-y-2 relative">
                  <div className="flex items-center gap-2">
                    <img src={piece.sprite} alt={piece.name} className="w-7 h-7 object-contain shrink-0" />
                    <span className="text-xs font-bold text-foreground truncate">{piece.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {pos ? (
                      <div className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs">
                        <span>Case {pos}</span>
                        <button
                          type="button"
                          onClick={() => setPiecesPos((prev) => ({ ...prev, [piece.id]: "" }))}
                          className="text-muted-foreground hover:text-white p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenPosPickerPieceId(isOpen ? null : piece.id)}
                        className="w-full py-1.5 px-2.5 rounded border border-dashed border-border hover:border-emerald-400 text-muted-foreground hover:text-foreground text-xs font-medium transition-all text-center cursor-pointer"
                      >
                        Choisir une case…
                      </button>
                    )}
                  </div>

                  {/* Popover Grid A1..K11 */}
                  {isOpen && (
                    <div className="absolute top-full left-0 mt-1 z-30 w-72 bg-[#12161f] border border-white/20 rounded-lg p-2 shadow-2xl space-y-1 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          Grille A1..K11 ({piece.name})
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenPosPickerPieceId(null)}
                          className="text-muted-foreground hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="space-y-0.5 max-h-56 overflow-y-auto reg-scrollbar pr-0.5">
                        {COLS_ECHECS.map((col) => (
                          <div key={col} className="flex items-center gap-0.5">
                            <span className="w-4 font-mono text-[10px] font-bold text-emerald-400 shrink-0 text-center">
                              {col}
                            </span>
                            <div className="flex-1 grid grid-cols-11 gap-0.5">
                              {ROWS_ECHECS.map((row) => {
                                const fullCoord = `${col}${row}`;
                                const isCurrent = pos === fullCoord;
                                return (
                                  <button
                                    key={row}
                                    type="button"
                                    onClick={() => {
                                      setPiecesPos((prev) => ({ ...prev, [piece.id]: fullCoord }));
                                      setOpenPosPickerPieceId(null);
                                    }}
                                    className={cn(
                                      "h-5 rounded text-[9px] font-mono font-semibold transition-all cursor-pointer flex items-center justify-center",
                                      isCurrent
                                        ? "bg-emerald-500 text-black font-black"
                                        : "bg-white/[0.04] hover:bg-emerald-500/30 text-white/80"
                                    )}
                                  >
                                    {row}
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
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. ÉNIGME DES OBJETS (OUVRAGE MONOCHROME) ── */}
      {activeTab === "objets" && (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Indiquez les 2 objets présents sur chaque piédestal (I à IV). Cochez le bouton 🌸 sur l'objet associé à la fleur en papier découverte dans l'Ouvrage, puis renseignez la couleur obtenue.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {ROMAINS.map((roman) => {
              const currentSlots = objetsSlots[roman];
              const fleurIdx = fleursPerRomain[roman];

              return (
                <div key={roman} className="p-3 rounded-lg border border-border bg-surface/50 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-mono text-xs font-black text-foreground">Stèle {roman}</span>
                    <span className="text-[10px] text-muted-foreground">2 objets</span>
                  </div>

                  <div className="space-y-1.5">
                    {[0, 1].map((slotIdx) => {
                      const itemId = currentSlots[slotIdx];
                      const itemDef = itemId ? BELLADONE_ITEMS.find((b) => b.id === itemId) : null;
                      const hasFleur = fleurIdx === slotIdx;
                      const isPickerOpen =
                        openObjPicker?.romain === roman && openObjPicker?.slotIdx === slotIdx;
                      const used = getUsedObjects(roman, slotIdx);

                      return (
                        <div key={slotIdx} className="relative">
                          <div className="flex items-center gap-1.5">
                            {/* Bouton radio Fleur */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!itemId) return;
                                setFleursPerRomain((prev) => ({
                                  ...prev,
                                  [roman]: prev[roman] === slotIdx ? null : slotIdx,
                                }));
                              }}
                              title="Marquer comme objet portant la fleur en papier"
                              className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-xs border transition-all cursor-pointer shrink-0",
                                hasFleur
                                  ? "bg-rose-500 text-white border-rose-400 font-bold scale-105"
                                  : "bg-surface border-border text-muted-foreground/60 hover:text-muted-foreground"
                              )}
                            >
                              🌸
                            </button>

                            {/* Slot Item */}
                            {itemDef ? (
                              <div className="flex-1 flex items-center justify-between px-2 py-1 rounded bg-white/[0.04] border border-border text-xs">
                                <div className="flex items-center gap-1.5 truncate">
                                  <img src={itemDef.icon} alt={itemDef.name} className="w-5 h-5 object-contain" />
                                  <span className="truncate font-medium">{itemDef.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...currentSlots] as [string | null, string | null];
                                    next[slotIdx] = null;
                                    setObjetsSlots((prev) => ({ ...prev, [roman]: next }));
                                    if (fleurIdx === slotIdx) {
                                      setFleursPerRomain((prev) => ({ ...prev, [roman]: null }));
                                    }
                                  }}
                                  className="text-muted-foreground hover:text-white p-0.5 ml-1"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenObjPicker(isPickerOpen ? null : { romain: roman, slotIdx })
                                }
                                className="flex-1 py-1 px-2 rounded border border-dashed border-border hover:border-emerald-400 text-muted-foreground hover:text-foreground text-[11px] text-left truncate cursor-pointer"
                              >
                                Choisir objet…
                              </button>
                            )}
                          </div>

                          {/* Popover Objets */}
                          {isPickerOpen && (
                            <div className="absolute top-full left-0 mt-1 z-30 w-56 bg-[#12161f] border border-white/20 rounded-lg p-1.5 shadow-2xl grid grid-cols-2 gap-1 animate-in fade-in duration-100">
                              {BELLADONE_ITEMS.map((obj) => {
                                const isDis = used.has(obj.id);
                                return (
                                  <button
                                    key={obj.id}
                                    type="button"
                                    disabled={isDis}
                                    onClick={() => {
                                      const next = [...currentSlots] as [string | null, string | null];
                                      next[slotIdx] = obj.id;
                                      setObjetsSlots((prev) => ({ ...prev, [roman]: next }));
                                      setOpenObjPicker(null);
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 p-1 rounded text-[11px] transition-all cursor-pointer text-left",
                                      isDis
                                        ? "opacity-30 cursor-not-allowed"
                                        : "hover:bg-white/[0.08] text-white/90"
                                    )}
                                  >
                                    <img src={obj.icon} alt={obj.name} className="w-4 h-4 object-contain" />
                                    <span className="truncate">{obj.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Couleur finale */}
          <div className="p-3 rounded-lg border border-border bg-surface/30 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">
              Couleur finale obtenue :
            </span>
            <div className="flex items-center gap-2">
              {ENIGMA_COLORS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedColor(col.id)}
                  style={{
                    backgroundColor: selectedColor === col.id ? col.hex : `${col.hex}33`,
                    borderColor: col.hex,
                    color: selectedColor === col.id ? "#000" : col.hex,
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer flex items-center gap-1",
                    selectedColor === col.id ? "shadow-md scale-105" : "hover:opacity-100 opacity-80"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{col.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. BATAILLE NAVALE (RÉSERVE DE BELLADONE) ── */}
      {activeTab === "bateaux" && (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Positionnez les 3 bateaux en papier sur chacune des 2 cartes pour coordonner les tirs entre les deux joueurs de la Réserve.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 1 as const, label: "Map [19, 15]", state: boatsMap1 },
              { id: 2 as const, label: "Map [21, 17]", state: boatsMap2 },
            ].map((map) => {
              const count = Object.values(map.state).filter(Boolean).length;
              const isFull = count >= 3;

              return (
                <div key={map.id} className="p-3.5 rounded-lg border border-border bg-surface/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Ship size={14} className="text-sky-400" />
                      <span>{map.label}</span>
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-mono font-bold px-2 py-0.5 rounded",
                        isFull ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.04] text-muted-foreground"
                      )}
                    >
                      {count} / 3 bateaux
                    </span>
                  </div>

                  {/* Grille 4x3 */}
                  <div className="grid grid-cols-5 gap-1 text-center font-mono">
                    <div className="h-6" />
                    {["A", "B", "C", "D"].map((c) => (
                      <div key={c} className="h-6 flex items-center justify-center text-[11px] font-bold text-sky-400">
                        {c}
                      </div>
                    ))}

                    {["1", "2", "3"].map((row) => (
                      <React.Fragment key={row}>
                        <div className="h-10 flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                          {row}
                        </div>
                        {["A", "B", "C", "D"].map((col) => {
                          const cellId = `${col}${row}`;
                          const isBoat = !!map.state[cellId];

                          return (
                            <button
                              key={cellId}
                              type="button"
                              onClick={() => toggleBoat(map.id, cellId)}
                              className={cn(
                                "h-10 rounded border font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center select-none",
                                isBoat
                                  ? "bg-sky-500 text-black border-sky-400 font-black shadow-md scale-[1.02]"
                                  : "bg-[#141923] hover:bg-[#1a2230] border-border text-muted-foreground/50 hover:text-white"
                              )}
                              title={`${col}${row} : cliquer pour ${isBoat ? "retirer" : "placer"} un bateau`}
                            >
                              {isBoat ? "⛵" : `${col}${row}`}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
