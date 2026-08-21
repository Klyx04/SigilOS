"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Map as MapIcon, Move, RotateCcw, Sparkles, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDofensiveMap, type DofensiveMapData, type DofensiveMapLite } from "@/server/actions/dofensive-actions";
import {
    CellState,
    castRangeDistance,
    cellIdToXY,
    cellToScreen,
    classifyGrid,
    getLosPath,
    getSpellRangeDistance,
    spellZoneCells,
    toLos,
} from "@/lib/dofus-grid";

export interface SpellZone {
    shape: "Cercle" | "Croix" | "Ligne" | "Cône" | "Perpend" | "Rectangle" | "Point" | "Inconnue";
    size: number;
    range: number;
}

export interface SpellData {
    id: number;
    name: string;
    imageUrl?: string;
    description?: string;
    apCost?: number;
    minRange?: number;
    range?: number;
    castTestLos?: boolean;
    castInLine?: boolean;
    castInDiagonal?: boolean;
    /** Probabilité de coup critique (%). */
    criticalChance?: number;
    /** Nombre de lancers par tour. */
    maxCastPerTurn?: number;
    /** Nombre de lancers par cible. */
    maxCastPerTarget?: number;
    /** Cooldown (tours d'intervalle minimum). */
    minCastInterval?: number;
    /** Effets résumés (texte FR formaté, source Dofensive). */
    effects?: string[];
    /** Grade/Niveau Dofensive du level utilisé (« Niv. X »). */
    grade?: number;
    /** Effets structurés (durées, déclencheurs, masques) — affichage détaillé. */
    effectDetails?: { label: string; duration: string | null; triggers: string[]; masks: string[] }[];
    /** Effets critiques (lignes) — section « Effets critiques ». */
    criticalEffects?: string[];
    /** false si le sort n'a aucun effet critique (« Aucun effet critique »). */
    hasCriticalEffects?: boolean;
    /** Zone d'effet AoE normalisée (source Dofensive) — prévisu sur la grille. */
    zone?: SpellZone;
}

interface SpellRangeGridProps {
    spells: SpellData[];
    activeSpellId?: number;
    onSelectSpell?: (spell: SpellData) => void;
    bossName?: string;
    bossImageUrl?: string;
    /** Salles du donjon du boss (Dofensive) — alimentent le sélecteur de map. */
    dungeonMaps?: DofensiveMapLite[];
    /** Nom du donjon (label du sélecteur). */
    dungeonName?: string;
    /** Grades du monstre (fiche) — affiche un sélecteur de grade dans la simulation. */
    grades?: { level: number }[];
    /** Index du grade actif (fiche). Lié au grade affiché côté fiche. */
    activeGradeIndex?: number;
    onGradeChange?: (idx: number) => void;
}

// Ligne de Bresenham entre deux cellules (grille orthogonale) — pour la ligne de vue.
function lineCells(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
        pts.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
    return pts;
}

/**
 * 🎮 SIMULATION TACTIQUE STYLE DOFUS / DOFENSIVE
 * Grille en quinconce authentique (40×14) sur les maps réelles Dofensive :
 * obstacles réels, placements de départ (toggle), ligne de vue, portée temps réel.
 * « Map vide » conserve la grille libre 17×17.
 */
export function SpellRangeGrid({
    spells,
    activeSpellId,
    onSelectSpell,
    bossName = "Boss",
    bossImageUrl,
    dungeonMaps,
    dungeonName,
    grades,
    activeGradeIndex,
    onGradeChange,
}: SpellRangeGridProps) {
    // Sort actif — le parent peut contrôler la sélection (activeSpellId/onSelectSpell) ;
    // sinon l'état interne prend le relais (cas de la démo /demo/boss-sim).
    const [internalSpellId, setInternalSpellId] = useState<number | undefined>(activeSpellId);
    const effectiveSpellId = activeSpellId ?? internalSpellId;
    const currentSpell = useMemo(() => {
        if (!spells || spells.length === 0) return null;
        if (effectiveSpellId !== undefined) {
            return spells.find((s) => s.id === effectiveSpellId) || spells[0];
        }
        return spells[0];
    }, [spells, effectiveSpellId]);

    const selectSpell = (spell: SpellData) => {
        setInternalSpellId(spell.id);
        onSelectSpell?.(spell);
    };

    // Grille libre par défaut (17×17) ; dimensionnée par la map réelle sinon.
    const GRID_SIZE = 17;
    const CENTER = Math.floor(GRID_SIZE / 2);

    // Position du lanceur
    const [casterPos, setCasterPos] = useState<{ x: number; y: number }>({ x: CENTER, y: CENTER });
    const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

    // Composition simulée : jusqu'à 4 alliés.
    const [allies, setAllies] = useState<{ x: number; y: number; facing: number }[]>([]);
    const [selectedAlly, setSelectedAlly] = useState<number | null>(null);
    const [placingAlly, setPlacingAlly] = useState(false);
    const [showStartCells, setShowStartCells] = useState(false);
    const MAX_ALLIES = 4;

    // ── Sélecteur de map (salles du donjon, source Dofensive) ──
    const [selectedMapId, setSelectedMapId] = useState<number | "empty">("empty");
    const [mapData, setMapData] = useState<DofensiveMapData | null>(null);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    const gridRows = mapData ? mapData.cells.length : GRID_SIZE;
    const gridCols = mapData && mapData.cells[0] ? mapData.cells[0].length : GRID_SIZE;

    // États classés (VOID/HOLE/GROUND/OBSTACLE) à partir de la grille brute 0/1/2.
    const mapStates = useMemo(() => (mapData ? classifyGrid(mapData.cells) : null), [mapData]);

    const cellState = (x: number, y: number): CellState => {
        if (!mapStates) return CellState.GROUND;
        return mapStates[y]?.[x] ?? CellState.VOID;
    };
    const isObstacle = (x: number, y: number): boolean => cellState(x, y) === CellState.OBSTACLE;

    // Cases de départ (alliés/ennemis) rendues quand le toggle est actif.
    const startCells = useMemo(() => {
        if (!mapData || !showStartCells) return null;
        const ally = new Set<string>();
        const enemy = new Set<string>();
        for (const id of mapData.allyCells) { const p = cellIdToXY(id); ally.add(`${p.x},${p.y}`); }
        for (const id of mapData.enemyCells) { const p = cellIdToXY(id); enemy.add(`${p.x},${p.y}`); }
        return { ally, enemy };
    }, [mapData, showStartCells]);

    // Placements de départ : le boss va toujours sur sa case réelle (enemyCells[0],
    // toujours libre) ; les alliés (fecas) ne sont posés que si le toggle est actif.
    const applyStartCells = (data: DofensiveMapData, enabled: boolean) => {
        const enemy = data.enemyCells.length ? data.enemyCells[0] : null;
        if (enemy !== null) {
            const p = cellIdToXY(enemy);
            setCasterPos({ x: p.x, y: p.y });
        } else {
            setCasterPos({ x: Math.floor(gridCols / 2), y: Math.floor(gridRows / 2) });
        }
        if (enabled) {
            setAllies(
                data.allyCells.slice(0, MAX_ALLIES).map((id) => {
                    const q = cellIdToXY(id);
                    return { x: q.x, y: q.y, facing: 0 };
                })
            );
        } else {
            setAllies([]);
        }
    };

    // Reset / garde de cohérence quand le boss (et donc ses maps) change.
    // Sélection automatique de la première map de combat du boss (si présente).
    useEffect(() => {
        if (!dungeonMaps?.length) {
            setSelectedMapId("empty");
            setMapData(null);
            return;
        }
        if (selectedMapId === "empty") {
            const bossMap = dungeonMaps.find((m) => m.isBoss);
            if (bossMap) setSelectedMapId(bossMap.id);
            return;
        }
        if (!dungeonMaps.some((m) => m.id === selectedMapId)) {
            setSelectedMapId("empty");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dungeonMaps]);

    // Chargement de la map sélectionnée : grille + placements de départ réels.
    useEffect(() => {
        if (selectedMapId === "empty") {
            setMapData(null);
            setMapError(null);
            setMapLoading(false);
            setAllies([]);
            setCasterPos({ x: CENTER, y: CENTER });
            return;
        }
        let cancelled = false;
        setMapLoading(true);
        setMapError(null);
        getDofensiveMap(selectedMapId)
            .then((res) => {
                if (cancelled) return;
                setMapLoading(false);
                if (res.success && res.data) {
                    setMapData(res.data);
                    applyStartCells(res.data, showStartCells);
                    setSelectedAlly(null);
                    setPlacingAlly(false);
                } else {
                    setMapError(res.error ?? "Erreur de chargement de la map");
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMapLoading(false);
                    setMapError("Erreur réseau Dofensive");
                }
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMapId]);

    // Toggle « placements de départ » : pose/retire boss + alliés sur les cases réelles.
    const toggleStartCells = () => {
        const next = !showStartCells;
        setShowStartCells(next);
        if (mapData) {
            applyStartCells(mapData, next);
        }
    };

    const handleCellClick = (x: number, y: number) => {
        if (isObstacle(x, y)) return;

        if (placingAlly) {
            if (x === casterPos.x && y === casterPos.y) return;
            setAllies((prev) => {
                const idx = prev.findIndex((a) => a.x === x && a.y === y);
                if (idx >= 0) return prev.filter((_, i) => i !== idx);
                if (prev.length >= MAX_ALLIES) return prev;
                return [...prev, { x, y, facing: 0 }];
            });
            return;
        }

        // Un Féca est sélectionné : on le déplace ou on le fait pivoter.
        if (selectedAlly !== null) {
            const ally = allies[selectedAlly];
            if (ally && x === ally.x && y === ally.y) {
                setAllies((prev) => prev.map((a, i) => (i === selectedAlly ? { ...a, facing: (a.facing + 45) % 360 } : a)));
                return;
            }
            const hitIdx = allies.findIndex((a) => a.x === x && a.y === y);
            if (hitIdx >= 0) {
                setSelectedAlly(hitIdx);
            } else {
                setAllies((prev) => prev.map((a, i) => (i === selectedAlly ? { ...a, x, y } : a)));
                setSelectedAlly(null);
            }
            return;
        }

        // Aucun Féca sélectionné : on sélectionne un Féca ou on déplace le boss.
        const allyIdx = allies.findIndex((a) => a.x === x && a.y === y);
        if (allyIdx >= 0) {
            setSelectedAlly(allyIdx);
        } else {
            setCasterPos({ x, y });
        }
    };

    // Zoom de la carte (boutons + molette).
    const [zoom, setZoom] = useState(1);
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 3.5;
    const zoomRef = useRef<HTMLDivElement | null>(null);
    // Marqueur SVG du lanceur (boss) — sert au « recentrage auto sur le lanceur ».
    const casterMarkerRef = useRef<SVGGElement | null>(null);
    useEffect(() => {
        const el = zoomRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.002)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const minRange = currentSpell?.minRange ?? 0;
    const maxRange = currentSpell?.range ?? 0;
    const castInLine = currentSpell?.castInLine ?? false;
    const castInDiagonal = currentSpell?.castInDiagonal ?? false;
    const castTestLos = currentSpell?.castTestLos ?? true;

    const isRealMap = !!mapData;

    // Calcul de portée Dofus robuste et unifié :
    // - Sur map réelle (40x14) : repère Losange (u, v)
    // - Sur grille libre (17x17) : repère orthogonal Losange direct (x, y)
    const isCellInRange = (x: number, y: number): boolean => {
        if (!currentSpell) return false;
        if (isObstacle(x, y)) return false;

        const a = isRealMap ? toLos(casterPos.x, casterPos.y) : { x: casterPos.x, y: casterPos.y };
        const b = isRealMap ? toLos(x, y) : { x, y };
        const du = b.x - a.x;
        const dv = b.y - a.y;

        // Auto-ciblage / mêlée PO 0
        if (du === 0 && dv === 0) {
            return minRange === 0;
        }

        // Distance de lancer selon contraintes de lancer (ligne, diagonale, étoile, libre)
        const dist = getSpellRangeDistance(du, dv, castInLine, castInDiagonal);
        if (dist < 0) return false;
        if (dist < minRange || dist > maxRange) return false;

        // Test Ligne de Vue (LoS) : aucun obstacle 3D ou bordure opaque traversée
        if (castTestLos) {
            const path = getLosPath(casterPos, { x, y }, isRealMap);
            if (path.some((c) => isObstacle(c.x, c.y))) return false;
        }

        return true;
    };

    // Nombre de cases couvertes
    const reachableCount = useMemo(() => {
        let count = 0;
        for (let y = 0; y < gridRows; y++) {
            for (let x = 0; x < gridCols; x++) {
                if (isCellInRange(x, y)) count++;
            }
        }
        return count;
    }, [casterPos, currentSpell, gridRows, gridCols, mapData]);

    // Persistance localStorage (placements, map sélectionnée, toggle départ)
    const storageKey = `sigilos_sim_${dungeonName || bossName || "default"}`;

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.mapId && (parsed.mapId === "empty" || dungeonMaps?.some((m) => m.id === parsed.mapId))) {
                    setSelectedMapId(parsed.mapId);
                }
                if (Array.isArray(parsed.allies)) {
                    setAllies(parsed.allies);
                }
                if (parsed.casterPos && typeof parsed.casterPos.x === "number") {
                    setCasterPos(parsed.casterPos);
                }
                if (typeof parsed.showStartCells === "boolean") {
                    setShowStartCells(parsed.showStartCells);
                }
            }
        } catch {
            // Ignorer si parse error
        }
    }, [storageKey, dungeonMaps]);

    // Sauvegarde automatique des changements dans localStorage
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    mapId: selectedMapId,
                    allies,
                    casterPos,
                    showStartCells,
                })
            );
        } catch {
            // Ignorer
        }
    }, [storageKey, selectedMapId, allies, casterPos, showStartCells]);

    // Prévisu de zone d'effet (AoE) : quand on survole une case en portée, on
    // calcule toutes les cases touchées (Cercle, Croix, Ligne, Cône, Rectangle).
    const zonePreview = useMemo(() => {
        if (!hoveredCell || !currentSpell?.zone || !isCellInRange(hoveredCell.x, hoveredCell.y)) return null;
        const { shape, size } = currentSpell.zone;
        if (size < 1 || size > 15) return null;
        const cells = spellZoneCells({
            zone: currentSpell.zone,
            target: hoveredCell,
            caster: casterPos,
            cols: gridCols,
            rows: gridRows,
        });
        return new Set(cells.map((c) => `${c.x},${c.y}`));
    }, [hoveredCell, currentSpell, casterPos, isCellInRange, gridCols, gridRows]);
    const isInZone = (x: number, y: number): boolean => !!zonePreview && zonePreview.has(`${x},${y}`);

    // Alliés touchés dans la zone d'impact actuelle
    const hitAllies = useMemo(() => {
        if (!zonePreview) return new Set<number>();
        const hits = new Set<number>();
        allies.forEach((a, idx) => {
            if (zonePreview.has(`${a.x},${a.y}`)) {
                hits.add(idx);
            }
        });
        return hits;
    }, [zonePreview, allies]);

    // Recentre sur la case de départ du boss (map) ou le centre (grille libre).
    const recenter = () => {
        if (mapData && mapData.enemyCells.length) {
            const p = cellIdToXY(mapData.enemyCells[0]);
            setCasterPos({ x: p.x, y: p.y });
            return;
        }
        setCasterPos({ x: Math.floor(gridCols / 2), y: Math.floor(gridRows / 2) });
    };

    // Scrolle le conteneur pour ramener le lanceur au centre (mini-carte / zoom).
    const scrollCasterIntoView = () => {
        if (typeof window === "undefined") return;
        try {
            casterMarkerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } catch {
            // scrollIntoView non supporté → on ne fait rien
        }
    };

    // Recentrage auto sur le lanceur quand on passe au-dessus du seuil de zoom.
    const wasZoomed = useRef(false);
    useEffect(() => {
        const isZoomed = zoom > 1.2;
        if (isZoomed && !wasZoomed.current) {
            const t = window.setTimeout(scrollCasterIntoView, 60);
            return () => window.clearTimeout(t);
        }
        wasZoomed.current = isZoomed;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    // Mini-carte : pixels 1 case → 1 px pour l'aperçu global (cliquable → déplacer le lanceur).
    const miniMap = useMemo(() => {
        if (!mapData) return null;
        const rows = mapData.cells.length;
        const cols = mapData.cells[0]?.length ?? 0;
        if (rows === 0 || cols === 0) return null;
        const px = 4;
        const w = cols * px;
        const h = rows * px;
        const cellsEls: React.ReactNode[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const state = mapStates?.[r]?.[c];
                const key = `${c},${r}`;
                const isC = c === casterPos.x && r === casterPos.y;
                const isA = allies.some((a) => a.x === c && a.y === r);
                let fill = "#1a1a18";
                if (state === CellState.OBSTACLE) fill = "#6b6548";
                else if (state === CellState.GROUND) fill = "#8D8A66";
                else if (state === CellState.HOLE) fill = "#050505";
                if (isC) fill = "#c53030";
                else if (isA) fill = "#3b82f6";
                cellsEls.push(<rect key={key} x={c * px} y={r * px} width={px - 0.5} height={px - 0.5} rx={0.6} fill={fill} />);
            }
        }
        return { rows, cols, px, w, h, cellsEls };
    }, [mapData, mapStates, casterPos, allies]);

    // ── Dimensions de rendu ──
    // Maps réelles : grille brick Dofus (losanges 64×32, quinconce). Grille libre : 17×17 isométrique.
    const tileW = mapData ? 64 : 40;
    const tileH = mapData ? 32 : 20;
    const tileHalfW = tileW / 2;
    const tileHalfH = tileH / 2;
    const DEPTH = mapData ? 0 : 6; // extrusion 3D réservée à la grille libre

    let viewX = 0;
    let viewY = 0;
    let viewW = 1;
    let viewH = 1;
    if (mapData) {
        const pad = 36; // marge (inclut la hauteur des obstacles remontés de 24 px)
        const xMax = gridCols * tileW + tileHalfW;
        const yMax = (gridRows - 1) * tileHalfH + tileH;
        viewX = -pad;
        viewY = -pad;
        viewW = xMax + pad;
        viewH = yMax + pad;
    } else {
        const originX = ((gridCols + gridRows) / 2) * tileHalfW;
        const originY = 20;
        const xMin = originX - gridRows * tileHalfW;
        const xMax = originX + gridCols * tileHalfW;
        const yMin = originY;
        const yMax = originY + (gridRows + gridCols) * tileHalfH + DEPTH;
        const padX = tileHalfW;
        const padY = tileHalfH;
        viewX = Math.floor(xMin - padX);
        viewY = Math.floor(yMin - padY);
        viewW = Math.ceil(xMax - xMin + 2 * padX);
        viewH = Math.ceil(yMax - yMin + 2 * padY);
    }

    const freeOriginX = ((gridCols + gridRows) / 2) * tileHalfW;
    const freeOriginY = 20;

    return (
        <div className="space-y-4 rounded-3xl bg-zinc-950/90 border border-white/10 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
            {/* 1. Sélecteur de Sorts (Style Dofensive) */}
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2.5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Sorts du Boss{dungeonName ? ` — ${dungeonName}` : ""}
                </p>
                {grades && grades.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2.5" aria-label="Sélecteur de grade (lié à la fiche)">
                        <span className="text-[11px] font-bold text-zinc-500 mr-1">Grade :</span>
                        {grades.map((gr, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onGradeChange?.(idx)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all",
                                    (activeGradeIndex ?? grades.length - 1) === idx
                                        ? "bg-amber-500/20 border-amber-400 text-amber-300"
                                        : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                                )}
                            >
                                Niv {gr.level}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {spells.map((spell) => {
                        const isSelected = currentSpell?.id === spell.id;
                        return (
                            <button
                                key={spell.id}
                                type="button"
                                onClick={() => selectSpell(spell)}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-black transition-all shadow-sm",
                                    isSelected
                                        ? "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/30 scale-105 z-10"
                                        : "bg-zinc-900/90 border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                )}
                            >
                                <div className="w-6 h-6 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                                    {spell.imageUrl ? (
                                        <img src={spell.imageUrl} alt="" className="w-full h-full object-contain" />
                                    ) : (
                                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    )}
                                </div>
                                <div className="flex flex-col items-start min-w-0 gap-0.5">
                                    <span className="truncate max-w-[150px]">{spell.name}</span>
                                    <span className="flex flex-wrap items-center gap-1">
                                        {spell.apCost !== undefined && spell.apCost > 0 && (
                                            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-px rounded">
                                                {spell.apCost} PA
                                            </span>
                                        )}
                                        {(spell.minCastInterval ?? 0) > 0 && (
                                            <span
                                                className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-px rounded"
                                                title={`Cooldown : relance possible après ${spell.minCastInterval} tour${(spell.minCastInterval ?? 0) > 1 ? "s" : ""}`}
                                            >
                                                ⏳ {spell.minCastInterval} t
                                            </span>
                                        )}
                                        {(spell.maxCastPerTurn ?? 0) > 0 && (
                                            <span
                                                className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-px rounded"
                                                title={`Lancers max par tour : ${spell.maxCastPerTurn}`}
                                            >
                                                {spell.maxCastPerTurn}×/tour
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Détails du Sort Actif */}
            {currentSpell && (
                <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white">{currentSpell.name}</h4>
                            {currentSpell.grade !== undefined && (
                                <span className="text-[10px] font-black uppercase text-zinc-400 bg-zinc-800 border border-white/10 px-1.5 py-0.5 rounded">
                                    Niv. {currentSpell.grade}
                                </span>
                            )}
                            <span className="text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                                Portée : {minRange === maxRange ? `${maxRange} PO` : `${minRange} à ${maxRange} PO`}
                            </span>
                        </div>
                        {currentSpell.description && (
                            <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl font-medium">
                                {currentSpell.description}
                            </p>
                        )}
                        {(() => {
                            const details =
                                currentSpell.effectDetails && currentSpell.effectDetails.length > 0
                                    ? currentSpell.effectDetails
                                    : (Array.isArray(currentSpell.effects) ? currentSpell.effects.slice(0, 20).map((e) => ({ label: e, duration: null, triggers: [] as string[], masks: [] as string[] })) : []);
                            if (details.length === 0) return null;
                            return (
                                <div className="pt-1 space-y-1">
                                    {details.map((det, i) => (
                                        <div key={i} className="text-[11px] leading-snug">
                                            <span className="font-semibold text-amber-300/90">
                                                {det.label}
                                                {det.duration ? ` (${det.duration})` : ""}
                                            </span>
                                            {det.masks.length > 0 && (
                                                <span className="block text-zinc-500">{det.masks.join(" · ")}</span>
                                            )}
                                            {det.triggers.map((tr, j) => (
                                                <span key={j} className="block text-zinc-500 italic">{tr}</span>
                                            ))}
                                        </div>
                                    ))}
                                    {currentSpell.hasCriticalEffects === false ? (
                                        <p className="text-[11px] text-zinc-500 pt-1">Effets critiques : aucun.</p>
                                    ) : Array.isArray(currentSpell.criticalEffects) && currentSpell.criticalEffects.length > 0 ? (
                                        <div className="pt-1">
                                            <span className="text-[11px] font-black text-pink-400/90">Effets critiques :</span>
                                            <ul className="pl-3 space-y-0.5">
                                                {currentSpell.criticalEffects.map((ce, k) => (
                                                    <li key={k} className="text-[11px] text-zinc-300">• {ce}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border",
                            castTestLos
                                ? "bg-zinc-800/80 text-zinc-300 border-white/10"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black"
                        )}>
                            {castTestLos ? <Eye className="w-3 h-3 text-zinc-400" /> : <EyeOff className="w-3 h-3 text-emerald-400" />}
                            {castTestLos ? "Ligne de vue requise" : "Sans ligne de vue"}
                        </span>

                        {(currentSpell.criticalChance ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/30">
                                <Sparkles className="w-3 h-3" /> {currentSpell.criticalChance}% CC
                            </span>
                        )}

                        {castInLine && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Move className="w-3 h-3" /> Ligne uniquement
                            </span>
                        )}

                        {castInDiagonal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                <Sparkles className="w-3 h-3" /> Diagonale
                            </span>
                        )}

                        {currentSpell.maxCastPerTurn !== undefined && currentSpell.maxCastPerTurn > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-800/80 text-zinc-300 border border-white/10">
                                <Zap className="w-3 h-3 text-amber-400" />
                                {currentSpell.maxCastPerTurn}×/tour
                            </span>
                        )}

                        {(currentSpell.maxCastPerTarget ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-800/80 text-zinc-300 border border-white/10">
                                <Users className="w-3 h-3 text-amber-400" />
                                {currentSpell.maxCastPerTarget}×/cible
                            </span>
                        )}

                        {(currentSpell.minCastInterval ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">
                                Cooldown {currentSpell.minCastInterval} tour{currentSpell.minCastInterval! > 1 ? "s" : ""}
                            </span>
                        )}

                        {currentSpell.zone && currentSpell.zone.shape !== "Inconnue" && currentSpell.zone.size <= 12 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Sparkles className="w-3 h-3" />
                                Zone {currentSpell.zone.shape}
                                {currentSpell.zone.size > 0 ? ` ${currentSpell.zone.size}` : ""}
                                {currentSpell.zone.range > 0 ? ` (portée ${currentSpell.zone.range})` : ""}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={recenter}
                            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 border border-white/10 px-2.5 py-1 rounded-lg transition-all ml-auto"
                        >
                            <RotateCcw className="w-3 h-3" /> Recentrer
                        </button>
                    </div>
                </div>
            )}

            {/* 3. SIMULATION TACTIQUE (style Dofensive / Dofus) */}
            <div className="relative rounded-2xl bg-[#161614] border border-white/10 p-2 sm:p-4 overflow-x-auto flex flex-col items-center justify-center select-none shadow-inner">
                {/* Mini-carte (aperçu global) — cliquer recentre sur le lanceur */}
                {miniMap && zoom > 1.2 && (
                    <button
                        type="button"
                        onClick={scrollCasterIntoView}
                        className="absolute top-2 right-2 z-20 rounded-lg border border-white/10 bg-black/75 p-1.5 shadow-lg hover:border-amber-400/50 transition-colors"
                        title="Mini-carte — cliquer pour recentrer sur le lanceur"
                        aria-label="Mini-carte — recentrer sur le lanceur"
                    >
                        <svg width={miniMap.w} height={miniMap.h} viewBox={`0 0 ${miniMap.w} ${miniMap.h}`} className="block" shapeRendering="crispEdges">
                            {miniMap.cellsEls}
                            <rect x={0} y={0} width={miniMap.w} height={miniMap.h} fill="none" stroke="#fbbf24" strokeWidth={1} />
                        </svg>
                    </button>
                )}
                <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2 px-2">
                    <span className="font-bold text-zinc-300">
                        Entité : <strong className="text-amber-400">{bossName}</strong>
                    </span>
                    <span className="text-zinc-500">
                        Carte : <strong className="text-zinc-400">{mapData ? mapData.name : "Map Tactique Isométrique"}</strong>
                        {mapData?.coordinates ? ` · ${mapData.coordinates.x}, ${mapData.coordinates.y}` : ""} · {reachableCount} cases couvertes
                    </span>
                </div>

                {/* Sélecteur de map (salles du donjon) */}
                {dungeonMaps && dungeonMaps.length > 0 && (
                    <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                            <MapIcon className="w-3.5 h-3.5 text-amber-400" /> Salle :
                        </span>
                        <select
                            value={selectedMapId === "empty" ? "" : String(selectedMapId)}
                            onChange={(e) => setSelectedMapId(e.target.value ? Number(e.target.value) : "empty")}
                            className="bg-zinc-900 border border-white/10 text-zinc-200 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40 max-w-[320px]"
                        >
                            <option value="">Map vide</option>
                            {dungeonMaps.map((m) => (
                                <option key={m.id} value={m.id}>{m.isBoss ? "⚔ " : ""}{m.name}</option>
                            ))}
                        </select>
                        {mapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                        {mapData && (
                            <span className="text-[11px] text-zinc-400">
                                Obstacles &amp; salle chargés
                            </span>
                        )}
                        {mapError && <span className="text-[11px] text-red-400">{mapError}</span>}
                    </div>
                )}

                <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                    <div className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg p-0.5">
                        <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25))} className="px-2 py-1 rounded-md text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all" title="Zoom arrière (Ctrl+molette)">−</button>
                        <span className="text-[10px] font-bold text-zinc-400 px-1 tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
                        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25))} className="px-2 py-1 rounded-md text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all" title="Zoom avant">+</button>
                        <button type="button" onClick={() => setZoom(1)} className="px-1.5 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all" title="Réinitialiser le zoom">1:1</button>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setPlacingAlly((v) => !v); setSelectedAlly(null); }}
                        className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                            placingAlly
                                ? "bg-sky-500/20 border-sky-400 text-sky-300"
                                : "bg-zinc-800 border-white/10 text-zinc-300 hover:text-white"
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        {placingAlly ? "Clique sur une case pour poser/retirer un allié" : `Alliés ${allies.length}/${MAX_ALLIES}`}
                    </button>
                    {mapData && (
                        <button
                            type="button"
                            onClick={toggleStartCells}
                            className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                                showStartCells
                                    ? "bg-amber-500/20 border-amber-400 text-amber-300"
                                    : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                            )}
                            title="Placer le boss et les alliés sur leurs cases de départ réelles"
                        >
                            <MapIcon className="w-3.5 h-3.5" /> Placements de départ
                        </button>
                    )}
                    {allies.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setAllies([])}
                            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 border border-white/10 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                            <RotateCcw className="w-3 h-3" /> Vider
                        </button>
                    )}
                </div>

                <div ref={zoomRef} className="flex justify-center relative z-0 w-full" style={{ zoom, transformOrigin: "top center" }}>
                <svg
                    viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
                    className="w-full h-auto drop-shadow-2xl"
                    style={{ minWidth: "380px" }}
                >
                    {/* Fond noir (le vide autour des maps ressort en noir franc) */}
                    {mapData && <rect x={viewX} y={viewY} width={viewW} height={viewH} fill="#050505" />}
                    {mapData ? (
                        /* ── MAP RÉELLE : grille en quinconce Dofus (40×14) ── */
                        (() => {
                            // Palette structurelle style Dofensive (kaki/beige désaturé).
                            const C = {
                                floor: "#8D8A66",
                                floorMuted: "#777457",
                                grid: "rgba(215, 208, 164, 0.20)",
                                obsTop: "#777358",
                                obsLeft: "#5C5945",
                                obsRight: "#484638",
                                obsStroke: "rgba(230, 224, 185, 0.35)",
                            };
                            const OBST_H = 24;
                            const isObs = (cc: number, rr: number) => cellState(cc, rr) === CellState.OBSTACLE;

                            // Cellules non-VOID triées par profondeur isométrique (row + col).
                            const cells: { c: number; r: number; depth: number }[] = [];
                            for (let r = 0; r < gridRows; r++) {
                                for (let c = 0; c < gridCols; c++) {
                                    if (cellState(c, r) === CellState.VOID) continue;
                                    cells.push({ c, r, depth: r + c });
                                }
                            }
                            cells.sort((a, b) => a.depth - b.depth || a.r - b.r || a.c - b.c);

                            return [
                                cells.map(({ c, r }) => {
                                const state = cellState(c, r);
                                // HOLE (trou) : case impossible → noir, non rendue.
                                if (state === CellState.HOLE) return null;
                                const obs = state === CellState.OBSTACLE;
                                const key = `${c},${r}`;
                                const isStartAlly = !!startCells?.ally.has(key);
                                const isStartEnemy = !!startCells?.enemy.has(key);
                                const { sx, sy } = cellToScreen(c, r, tileW, tileH);
                                const isCaster = !obs && c === casterPos.x && r === casterPos.y;
                                const isAllyCell = !obs && allies.some((a) => a.x === c && a.y === r);
                                const inRange = !obs && isCellInRange(c, r);
                                const isHovered = hoveredCell?.x === c && hoveredCell?.y === r;

                                const points = `
                                    ${sx},${sy}
                                    ${sx + tileHalfW},${sy + tileHalfH}
                                    ${sx},${sy + tileH}
                                    ${sx - tileHalfW},${sy + tileHalfH}
                                `;

                                let fillColor = r % 2 === 0 ? C.floor : C.floorMuted;
                                let strokeColor = C.grid;
                                let strokeWidth = 0.4;

                                if (obs) {
                                    fillColor = C.obsTop;
                                    strokeColor = C.obsStroke;
                                    strokeWidth = 0.5;
                                } else if (isStartAlly) {
                                    fillColor = "#2e5a8a";
                                    strokeColor = "#4a86c4";
                                    strokeWidth = 1.1;
                                } else if (isStartEnemy) {
                                    fillColor = "#8a3a30";
                                    strokeColor = "#c65a4a";
                                    strokeWidth = 1.1;
                                }

                                if (inRange && !obs) {
                                    fillColor = r % 2 === 0 ? "#79b638" : "#6ea830";
                                    strokeColor = "#8fd443";
                                    strokeWidth = 0.7;
                                }

                                if (isCaster) {
                                    fillColor = "#6b1d1d";
                                    strokeColor = "#c53030";
                                    strokeWidth = 1.4;
                                } else if (isAllyCell) {
                                    fillColor = inRange ? "#a11c1c" : "#1e3a5f";
                                    strokeColor = inRange ? "#ef4444" : "#3b82f6";
                                    strokeWidth = 1.4;
                                }

                                if (isHovered && !isCaster && !isAllyCell && !obs) {
                                    fillColor = inRange ? "#9ae44c" : "#a39e90";
                                }

                                // Prévisu de zone d'effet (AoE) : ambre, prioritaire sur la portée.
                                if (isInZone(c, r) && !obs && !isCaster && !isAllyCell) {
                                    fillColor = "#e0a320";
                                    strokeColor = "#ffcf5e";
                                    strokeWidth = 1.1;
                                }

                                // Prisme 3D : seules les faces exposées sont rendues.
                                const obsLeft = isObs(c - 1, r);
                                const obsRight = isObs(c + 1, r);
                                const ty = sy - OBST_H;
                                const tTop = { x: sx, y: ty };
                                const tRight = { x: sx + tileHalfW, y: ty + tileHalfH };
                                const tBottom = { x: sx, y: ty + tileH };
                                const tLeft = { x: sx - tileHalfW, y: ty + tileHalfH };
                                const bRight = { x: sx + tileHalfW, y: sy + tileHalfH };
                                const bBottom = { x: sx, y: sy + tileH };
                                const bLeft = { x: sx - tileHalfW, y: sy + tileHalfH };

                                return (
                                    <g key={`${c}-${r}`} className={obs ? "" : "cursor-pointer"}>
                                        {obs && !obsLeft && (
                                            <polygon
                                                points={`${tLeft.x},${tLeft.y} ${tBottom.x},${tBottom.y} ${bBottom.x},${bBottom.y} ${bLeft.x},${bLeft.y}`}
                                                fill={C.obsLeft}
                                                stroke={C.obsStroke}
                                                strokeWidth={0.4}
                                                className="transition-colors duration-150"
                                            />
                                        )}
                                        {obs && !obsRight && (
                                            <polygon
                                                points={`${tRight.x},${tRight.y} ${bRight.x},${bRight.y} ${bBottom.x},${bBottom.y} ${tBottom.x},${tBottom.y}`}
                                                fill={C.obsRight}
                                                stroke={C.obsStroke}
                                                strokeWidth={0.4}
                                                className="transition-colors duration-150"
                                            />
                                        )}
                                        <polygon
                                            points={obs ? `${tTop.x},${tTop.y} ${tRight.x},${tRight.y} ${tBottom.x},${tBottom.y} ${tLeft.x},${tLeft.y}` : points}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={strokeWidth}
                                            onClick={() => handleCellClick(c, r)}
                                            onMouseEnter={() => setHoveredCell({ x: c, y: r })}
                                            onMouseLeave={() => setHoveredCell(null)}
                                            className="transition-colors duration-150"
                                        />
                                    </g>
                                );
                            }),
                            /* Passe 2 — entités triées par profondeur (au-dessus des obstacles) */
                            cells.map(({ c, r }) => {
                                if (cellState(c, r) === CellState.OBSTACLE) return null;
                                const { sx, sy } = cellToScreen(c, r, tileW, tileH);
                                if (c === casterPos.x && r === casterPos.y) {
                                    return (
                                        <g key="boss" ref={casterMarkerRef} transform={`translate(${sx - 28}, ${sy - 44})`} pointerEvents="none">
                                            {bossImageUrl ? (
                                                <image href={bossImageUrl} x="0" y="0" width="56" height="56" className="drop-shadow-2xl" />
                                            ) : (
                                                <text x="28" y="36" textAnchor="middle" fontSize="30" className="select-none">👑</text>
                                            )}
                                        </g>
                                    );
                                }
                                const ai = allies.findIndex((a) => a.x === c && a.y === r);
                                if (ai >= 0) {
                                    const isSel = selectedAlly === ai;
                                    const isHit = hitAllies.has(ai);
                                    return (
                                        <g key={`ally-${ai}`} pointerEvents="none">
                                            {isSel && (<circle cx={sx} cy={sy + 10} r="22" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />)}
                                            {isHit && (
                                                <circle cx={sx} cy={sy + 10} r="20" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" strokeWidth="2.5">
                                                    <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1s" repeatCount="indefinite" />
                                                </circle>
                                            )}
                                            <g transform={`translate(${sx - 22}, ${sy - 32})`}>
                                                <image href="/assets/module-succes/feca.webp" x="0" y="0" width="44" height="44" className="drop-shadow-2xl" />
                                            </g>
                                            {isHit && (
                                                <text x={sx} y={sy - 36} textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="900" className="select-none">⚠️ ZONE</text>
                                            )}
                                        </g>
                                    );
                                }
                                return null;
                            }),
                        ];
                    })()
                    ) : (
                        /* ── GRILLE LIBRE : damier isométrique 17×17 ── */
                        Array.from({ length: gridRows }).map((_, rIdx) =>
                            Array.from({ length: gridCols }).map((_, cIdx) => {
                                const x = cIdx;
                                const y = rIdx;
                                const sx = freeOriginX + (x - y) * tileHalfW;
                                const sy = freeOriginY + (x + y) * tileHalfH;
                                const isCaster = x === casterPos.x && y === casterPos.y;
                                const isAllyCell = allies.some((a) => a.x === x && a.y === y);
                                const inRange = isCellInRange(x, y);
                                const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                                const isEven = (x + y) % 2 === 0;

                                const points = `
                                    ${sx},${sy}
                                    ${sx + tileHalfW},${sy + tileHalfH}
                                    ${sx},${sy + tileH}
                                    ${sx - tileHalfW},${sy + tileHalfH}
                                `;

                                let fillColor = isEven ? "#635f52" : "#565246";
                                let strokeColor = "#3d3930";
                                let strokeWidth = 0.5;

                                if (inRange) {
                                    fillColor = isEven ? "#79b638" : "#6ea830";
                                    strokeColor = "#8fd443";
                                    strokeWidth = 0.8;
                                }

                                if (isCaster) {
                                    fillColor = "#6b1d1d";
                                    strokeColor = "#c53030";
                                    strokeWidth = 1.5;
                                } else if (isAllyCell) {
                                    fillColor = inRange ? "#a11c1c" : "#1e3a5f";
                                    strokeColor = inRange ? "#ef4444" : "#3b82f6";
                                    strokeWidth = 1.5;
                                }

                                if (isHovered && !isCaster && !isAllyCell) {
                                    fillColor = inRange ? "#9ae44c" : "#7c7767";
                                }

                                // Prévisu de zone d'effet (AoE) : ambre, prioritaire sur la portée.
                                if (isInZone(x, y) && !isCaster && !isAllyCell) {
                                    fillColor = "#e0a320";
                                    strokeColor = "#ffcf5e";
                                    strokeWidth = 1.2;
                                }

                                const sideColor = inRange ? "#4c7a1f" : isCaster ? "#4a1212" : isAllyCell ? (inRange ? "#6f1010" : "#122a4a") : "#3a372e";

                                return (
                                    <g key={`${x}-${y}`} className="cursor-pointer">
                                        <polygon
                                            points={`${sx - tileHalfW},${sy + tileHalfH} ${sx + tileHalfW},${sy + tileHalfH} ${sx + tileHalfW},${sy + tileHalfH + DEPTH} ${sx - tileHalfW},${sy + tileHalfH + DEPTH}`}
                                            fill={sideColor}
                                            stroke={sideColor}
                                            strokeWidth={0.4}
                                            onClick={() => handleCellClick(x, y)}
                                            onMouseEnter={() => setHoveredCell({ x, y })}
                                            onMouseLeave={() => setHoveredCell(null)}
                                            className="transition-colors duration-150"
                                        />
                                        <polygon
                                            points={points}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={strokeWidth}
                                            onClick={() => handleCellClick(x, y)}
                                            onMouseEnter={() => setHoveredCell({ x, y })}
                                            onMouseLeave={() => setHoveredCell(null)}
                                            className="transition-colors duration-150"
                                        />
                                        {isCaster && (
                                            <g ref={casterMarkerRef} transform={`translate(${sx - 26}, ${sy - 36})`} pointerEvents="none">
                                                {bossImageUrl ? (
                                                    <image href={bossImageUrl} x="0" y="0" width="52" height="52" className="drop-shadow-2xl" />
                                                ) : (
                                                    <text x="26" y="34" textAnchor="middle" fontSize="28" className="select-none">👑</text>
                                                )}
                                            </g>
                                        )}
                                        {allies.map((ally, ai) => {
                                            if (ally.x !== x || ally.y !== y) return null;
                                            const isSel = selectedAlly === ai;
                                            return (
                                                <g key={`ally-${ai}`} pointerEvents="none">
                                                    {isSel && (<circle cx={sx} cy={sy + 10} r="21" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />)}
                                                    <g transform={`translate(${sx - 21}, ${sy - 30})`}>
                                                        <image href="/assets/module-succes/feca.webp" x="0" y="0" width="42" height="42" className="drop-shadow-2xl" />
                                                    </g>
                                                </g>
                                            );
                                        })}
                                    </g>
                                );
                            })
                        )
                    )}
                </svg>
                </div>

                {/* Légende */}
                <div className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 px-2 text-[10px] font-bold text-zinc-400">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#6b1d1d", border: "1px solid #c53030" }} /> Boss</span>
                    <span className="inline-flex items-center gap-1.5"><img src="/assets/module-succes/feca.webp" alt="" className="w-4 h-4 object-contain rounded-[3px]" /> Joueur (allié)</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#79b638" }} /> Dans la portée du sort</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#1e3a5f", border: "1px solid #3b82f6" }} /> Allié hors de portée</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#a11c1c", border: "1px solid #ef4444" }} /> Allié touché par le sort</span>
                    {mapData && (
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#8D8A66" }} /> Sol</span>
                    )}
                    {mapData && (
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#777358", border: "1px solid #5C5945" }} /> Obstacle</span>
                    )}
                    {mapData && (
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#050505", border: "1px solid #3a3a3a" }} /> Trou / case impossible</span>
                    )}
                </div>

                <p className="text-[11px] text-zinc-400 mt-2 text-center">
                    💡 Cliquez sur un losange pour déplacer le Boss (re-cliquez sur lui pour le faire pivoter). Cliquez un Féca pour le sélectionner, une case pour le déplacer, re-cliquez pour l'orienter. « Placements de départ » pose boss + alliés sur leurs cases réelles.
                </p>
            </div>
        </div>
    );
}
