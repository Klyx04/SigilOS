"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Grid, HelpCircle, Loader2, Map as MapIcon, Move, RotateCcw, Sparkles, Swords, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDofensiveMap, type DofensiveMapData, type DofensiveMapLite } from "@/server/actions/dofensive-actions";
import {
    CellState,
    castRangeDistance,
    cellIdToXY,
    cellToScreen,
    classifyGrid,
    computeMonsterPlacements,
    distance,
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

interface DofusPos { x: number; y: number }
interface AllyToken { x: number; y: number; facing: number }

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
    /** Monstres de la famille du donjon pour peupler la salle selon le butin (4..8). */
    monsters?: { id: number; name: string; isBoss?: boolean; imageUrl?: string | null }[];
    /** Mode compact optimisé pour l'overlay PiP (largeur réduite, zoom libre, marges réduites). */
    compact?: boolean;
    /** Échelle du sprite du boss (les titans occupent plusieurs cases en vrai combat). */
    entityScale?: number;
    /** Bypass public : autorise le déplacement libre du boss sur n'importe quelle
     *  case marchable (ignore les placements de départ) pour jouer avec la préview
     *  des sorts. Opt-in explicite (landing publique) — le dashboard reste épinglé. */
    allowFreeCasterMove?: boolean;
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
    monsters,
    compact = false,
    entityScale = 1,
    allowFreeCasterMove = false,
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

    // Position du lanceur (boss).
    const [casterPos, setCasterPos] = useState<DofusPos>({
        x: CENTER,
        y: CENTER,
    });

    // Orientation du lanceur (0: SE, 1: SO, 2: NO, 3: NE).
    const [casterFacing, setCasterFacing] = useState<number>(0);

    // Alliés (Fécas) posés sur la grille pour tester les zones d'effet.
    const MAX_ALLIES = 4;
    const [allies, setAllies] = useState<AllyToken[]>([]);
    const [selectedAlly, setSelectedAlly] = useState<number | null>(null);
    const [placingAlly, setPlacingAlly] = useState<boolean>(false);

    // Cases de départ réelles (map Dofensive).
    const [showStartCells, setShowStartCells] = useState<boolean>(false);

    // Bypass « boss libre » (opt-in landing publique) : actif par défaut quand la
    // prop est présente, désactivable via le toggle de la toolbar. Le dashboard
    // interne garde le comportement historique (boss épinglé sur son placement).
    const [freeCasterMove, setFreeCasterMove] = useState<boolean>(allowFreeCasterMove);

    // Survol souris
    const [hoveredCell, setHoveredCell] = useState<DofusPos | null>(null);

    // ── Sélecteur de map (salles du donjon, source Dofensive) ──
    const [selectedMapId, setSelectedMapId] = useState<number | "empty">("empty");
    const [mapData, setMapData] = useState<DofensiveMapData | null>(null);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    // Menus dropdowns personnalisés (remplacement des <select> natifs disgracieux)
    const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
    const [isSpellMenuOpen, setIsSpellMenuOpen] = useState(false);
    const mapMenuRef = useRef<HTMLDivElement>(null);
    const spellMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (mapMenuRef.current && !mapMenuRef.current.contains(e.target as Node)) {
                setIsMapMenuOpen(false);
            }
            if (spellMenuRef.current && !spellMenuRef.current.contains(e.target as Node)) {
                setIsSpellMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Index du placement actif (1..N) et Butin (4..8)
    const [placementIndex, setPlacementIndex] = useState<number>(1);
    const [lootCount, setLootCount] = useState<number>(4);
    const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
    const [showCompactLegend, setShowCompactLegend] = useState<boolean>(false);

    // Illustration titan (galerie God : /game-data/titans/<slug>.webp).
    // Convention + onError : aucune base ni session requise (marche partout,
    // y compris landing publique). Essayée seulement en contexte titan.
    const slugifyTitan = (name: string): string =>
        name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const bossScale = Math.min(5, Math.max(1, entityScale));
    const titanCandidate = bossScale > 1 && bossName ? `/game-data/titans/${slugifyTitan(bossName)}.webp` : null;
    const [artSrc, setArtSrc] = useState<string | null>(null);
    useEffect(() => {
        setArtSrc(titanCandidate ?? bossImageUrl ?? null);
    }, [titanCandidate, bossImageUrl, bossName]);

    // Bas d'encre réel du sprite (les fichiers ont des marges transparentes
    // variables — sans mesure, les pieds flottent au-dessus de la case).
    // Mesuré une fois par image via canvas (même origine OK, distant = repli).
    const [inkFile, setInkFile] = useState<{ f: number; w: number; h: number } | null>(null);
    useEffect(() => {
        setInkFile(null);
        if (!artSrc || typeof window === "undefined") return;
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (!w || !h) return;
                const cv = document.createElement("canvas");
                cv.width = w;
                cv.height = h;
                const ctx = cv.getContext("2d", { willReadFrequently: true });
                if (!ctx) return;
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, w, h).data;
                for (let y = h - 1; y >= 0; y--) {
                    for (let x = 0; x < w; x += 2) {
                        if (data[(y * w + x) * 4 + 3] > 16) {
                            setInkFile({ f: y + 1, w, h });
                            return;
                        }
                    }
                }
            } catch {
                // Canvas contaminé (CORS distant) → on garde l'ancrage historique.
            }
        };
        img.onerror = () => {};
        img.src = artSrc;
    }, [artSrc]);
    // Bas d'encre converti dans une boîte donnée (meet) + replis historiques.
    const boxInkBottom = (boxW: number, boxH: number, fallback: number): number => {
        if (!inkFile) return fallback;
        return inkFile.f * Math.min(boxW / inkFile.w, boxH / inkFile.h);
    };
    const feetY = boxInkBottom(92, 88, 56);
    const feetYFree = boxInkBottom(68, 64, 44);

    const gridRows = mapData ? mapData.cells.length : GRID_SIZE;
    const gridCols = mapData && mapData.cells[0] ? mapData.cells[0].length : GRID_SIZE;

    // États classés (VOID/HOLE/GROUND/OBSTACLE) à partir de la grille brute 0/1/2.
    const mapStates = useMemo(() => (mapData ? classifyGrid(mapData.cells) : null), [mapData]);

    const cellState = (x: number, y: number): CellState => {
        if (!mapStates) return CellState.GROUND;
        return mapStates[y]?.[x] ?? CellState.VOID;
    };
    const isObstacle = (x: number, y: number): boolean => cellState(x, y) === CellState.OBSTACLE;

    // Monstres accompagnateurs de la famille (hors boss)
    const roomMonsters = useMemo(() => {
        const nonBoss = (monsters ?? []).filter((m) => !m.isBoss && m.name.toLowerCase() !== bossName.toLowerCase());
        return nonBoss;
    }, [monsters, bossName]);

    // Calcul complet des positions de monstres pour le Butin et Placement sélectionnés
    const monsterPlacements = useMemo(() => {
        if (!mapData || !mapData.allyCells || mapData.allyCells.length === 0) return [];
        const computed = computeMonsterPlacements(mapData.allyCells, placementIndex);
        const list: {
            order: number;
            name: string;
            imageUrl?: string | null;
            cellId: number;
            x: number;
            y: number;
            isBoss: boolean;
        }[] = [];

        // 1. Boss
        const bossPos = cellIdToXY(computed.bossCell);
        list.push({
            order: 1,
            name: bossName,
            imageUrl: bossImageUrl,
            cellId: computed.bossCell,
            x: bossPos.x,
            y: bossPos.y,
            isBoss: true,
        });

        // 2..lootCount : Monstres suivants
        const needed = Math.min(lootCount - 1, computed.otherMonsterCells.length);
        for (let i = 0; i < needed; i++) {
            const cellId = computed.otherMonsterCells[i];
            const pos = cellIdToXY(cellId);
            const mob = roomMonsters[i % (roomMonsters.length || 1)];
            list.push({
                order: i + 2,
                name: mob?.name ?? `Monstre ${i + 2}`,
                imageUrl: mob?.imageUrl,
                cellId,
                x: pos.x,
                y: pos.y,
                isBoss: false,
            });
        }

        return list;
    }, [mapData, placementIndex, lootCount, bossName, bossImageUrl, roomMonsters]);

    // Cases de départ (alliés/ennemis) rendues quand le toggle est actif.
    // Inversion conforme Dofus : Dofensive expose les monstres dans allyCells et les joueurs dans enemyCells.
    // Filtrage strict : seules les cases monstres OCCUPÉES par le butin actuel (4..8) sont allumées.
    const startCells = useMemo(() => {
        if (!mapData || !showStartCells) return null;
        const ally = new Set<string>();
        const enemy = new Map<string, number>(); // key -> order (1..lootCount)

        // Joueurs (Alliés) : cases de départ joueurs
        for (const id of mapData.enemyCells) {
            const p = cellIdToXY(id);
            ally.add(`${p.x},${p.y}`);
        }

        // Monstres (Boss + Mobs) : UNIQUEMENT les cases utilisées pour ce butin
        for (const mp of monsterPlacements) {
            enemy.set(`${mp.x},${mp.y}`, mp.order);
        }

        return { ally, enemy };
    }, [mapData, showStartCells, monsterPlacements]);

    const totalPlacements = useMemo(() => {
        if (!mapData || !mapData.allyCells) return 0;
        return mapData.allyCells.length;
    }, [mapData]);

    // Placements de départ calculés selon l'algorithme Dofus :
    // - Le boss et les monstres sont positionnés selon le placement et butin choisis
    // - Les Fécas (alliés) ne sont pas posés par défaut (les cases joueurs restent libres et disponibles).
    const applyStartCells = (data: DofensiveMapData, enabled: boolean, pIdx: number = placementIndex) => {
        if (data.allyCells.length > 0) {
            const { bossCell } = computeMonsterPlacements(data.allyCells, pIdx);
            const p = cellIdToXY(bossCell);
            setCasterPos({ x: p.x, y: p.y });
        } else if (data.enemyCells.length > 0) {
            const p = cellIdToXY(data.enemyCells[0]);
            setCasterPos({ x: p.x, y: p.y });
        } else {
            setCasterPos({ x: Math.floor(gridCols / 2), y: Math.floor(gridRows / 2) });
        }
    };

    // Donjon « double boss » : on ne propose QUE la map du boss courant.
    //  - les maps marquées `isBoss` (PreferredMaps du monstre) ;
    //  - sinon celles dont le nom contient le nom du boss.
    // Si aucune map dédiée n'existe (boss sans salle spécifique), on retombe sur toutes les maps
    // pour ne jamais afficher un sélecteur vide.
    const shownMaps = useMemo(() => {
        if (!dungeonMaps || dungeonMaps.length === 0) return [];
        const boss = (bossName || "").toLowerCase();
        const filtered = dungeonMaps.filter(
            (m) => m.isBoss || (boss && m.name.toLowerCase().includes(boss))
        );
        if (filtered.length > 0) return filtered;
        // Chantier double boss : si le boss a été résolu avec un monstre Dofensive dédié
        // (nom contenu dans bossName), ne JAMAIS retomber sur toutes les maps — cela noierait
        // le sélecteur avec les autres « Balcon de … ». À la place, on retourne les maps qui
        // contiennent le même emplacement de donjon (préfixe « Balcon de … ») pour rester utile.
        const prefixMap = dungeonMaps.filter((m) => boss && /balcon/i.test(m.name) && m.name.toLowerCase().includes(boss));
        if (prefixMap.length > 0) return prefixMap;
        return dungeonMaps;
    }, [dungeonMaps, bossName]);

    const currentMapName = useMemo(() => {
        if (selectedMapId === "empty") return "Map vide";
        const found = shownMaps.find((m) => m.id === selectedMapId);
        return found ? (found.isBoss ? `⚔ ${found.name}` : found.name) : "Map vide";
    }, [selectedMapId, shownMaps]);

    // Reset / garde de cohérence quand le boss (et donc ses maps) change.
    // Sélection automatique de la première map de combat du boss (si présente).
    useEffect(() => {
        if (!shownMaps.length) {
            setSelectedMapId("empty");
            setMapData(null);
            return;
        }
        if (selectedMapId === "empty") {
            const bossMap = shownMaps.find((m) => m.isBoss);
            if (bossMap) setSelectedMapId(bossMap.id);
            return;
        }
        if (!shownMaps.some((m) => m.id === selectedMapId)) {
            setSelectedMapId("empty");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shownMaps]);

    // Chargement de la map sélectionnée : grille + placements de départ réels.
    useEffect(() => {
        setPan({ x: 0, y: 0 });
        // Recadrage auto à l'ouverture (comme le bouton Fit) : fini l'arrivée sur du vide.
        setZoom(compact ? 0.6 : 1);
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

    // Pan / Drag de la carte avec la souris (clic maintenu / glisser avec la main)
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const isPointerDownRef = useRef<boolean>(false);
    const isDraggingRef = useRef<boolean>(false);
    const justDraggedRef = useRef<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        // Clic gauche (0) ou clic molette (1)
        if (e.button !== 0 && e.button !== 1) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("[data-no-drag]")) return;

        isPointerDownRef.current = true;
        isDraggingRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };


    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isPointerDownRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            isDraggingRef.current = true;
            setIsDragging(true);
        }

        if (isDraggingRef.current) {
            setPan({
                x: Math.round(panStartRef.current.x + dx),
                y: Math.round(panStartRef.current.y + dy),
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isPointerDownRef.current) return;
        isPointerDownRef.current = false;

        if (isDraggingRef.current) {
            justDraggedRef.current = true;
            setTimeout(() => {
                justDraggedRef.current = false;
            }, 80);
            setIsDragging(false);
            isDraggingRef.current = false;
        }


    };

    const handleCellClick = (x: number, y: number) => {
        // Ignorer le clic si l'utilisateur était en train de déplacer la carte
        if (isDraggingRef.current || justDraggedRef.current) return;
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

        // Aucun Féca sélectionné : on sélectionne un Féca.
        // Par défaut le Boss est ÉPINGLÉ sur sa case de placement (non déplaçable).
        // Bypass public (`allowFreeCasterMove` + toggle actif) : un clic sur une case
        // marchable déplace le boss librement pour jouer avec la préview des sorts.
        const allyIdx = allies.findIndex((a) => a.x === x && a.y === y);
        if (allyIdx >= 0) {
            setSelectedAlly(allyIdx);
            return;
        }
        if (freeCasterMove) {
            const st = cellState(x, y);
            if (st !== CellState.GROUND) return;
            setCasterPos({ x, y });
        }
    };

    // Zoom de la carte (boutons + molette).
    const [zoom, setZoom] = useState(compact ? 0.7 : 1);
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 3.5;
    const zoomRef = useRef<HTMLDivElement | null>(null);
    // Marqueur SVG du lanceur (boss) — sert au « recentrage auto sur le lanceur ».
    const casterMarkerRef = useRef<SVGGElement | null>(null);
    useEffect(() => {
        const el = zoomRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            // La map est une surface interactive : la molette ne doit JAMAIS faire défiler
            // l'overlay parent (sinon la toolbar/tabs "sortent" de l'overlay). On bloque
            // le scroll par défaut et on ne zoome que si l'utilisateur tient Ctrl/Cmd.
            e.preventDefault();
            if (compact || e.ctrlKey || e.metaKey) {
                setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z - e.deltaY * 0.0015).toFixed(2)))));
            }
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [compact]);

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

    // Prévisu de zone d'effet (AoE) : quand on survole une case en portée (ou autour du lanceur si sort 0 PO)
    const zonePreview = useMemo(() => {
        const isSelfSpell = currentSpell?.range === 0 && (currentSpell?.minRange ?? 0) === 0;
        const target = isSelfSpell
            ? casterPos
            : hoveredCell && isCellInRange(hoveredCell.x, hoveredCell.y)
            ? hoveredCell
            : null;

        if (!target || !currentSpell?.zone) return null;
        const { shape, size } = currentSpell.zone;
        if (size < 1 || size > 15) return null;
        const cells = spellZoneCells({
            zone: currentSpell.zone,
            target,
            caster: casterPos,
            cols: gridCols,
            rows: gridRows,
            isRealMap,
        });
        return new Set(cells.map((c) => `${c.x},${c.y}`));
    }, [hoveredCell, currentSpell, casterPos, isCellInRange, gridCols, gridRows, isRealMap]);
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
        setPan({ x: 0, y: 0 });
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
    // (bossScale calculé plus haut, avec l'échelle titan explicite.)
    // Descente des pieds sur la ligne du losange repère (le sprite s'ancre
    // par défaut au centre de la case, trop haut visuellement).
    const BOSS_NUDGE = 12;
    const bossPadX = Math.ceil(46 * (bossScale - 1));
    // Ancré pieds au centre de la case : le corps s'élève au-dessus (88·s vers le haut).
    const bossPadUp = Math.ceil(88 * (bossScale - 1));

    let viewX = 0;
    let viewY = 0;
    let viewW = 1;
    let viewH = 1;
    if (mapData) {
        const pad = 36 + Math.max(bossPadX, bossPadUp); // marge (inclut la hauteur des obstacles remontés de 24 px)
        const xMax = gridCols * tileW + tileHalfW;
        const yMax = (gridRows - 1) * tileHalfH + tileH;
        viewX = -pad;
        // Le sprite monte au-dessus de sa case : étendre le haut du viewBox (pas le bas).
        viewY = -pad - bossPadUp;
        viewW = xMax + pad;
        viewH = yMax + pad + bossPadUp;
    } else {
        const originX = ((gridCols + gridRows) / 2) * tileHalfW;
        const originY = 20;
        const xMin = originX - gridRows * tileHalfW;
        const xMax = originX + gridCols * tileHalfW;
        const yMin = originY;
        const yMax = originY + (gridRows + gridCols) * tileHalfH + DEPTH;
        const padX = tileHalfW + bossPadX;
        const padY = tileHalfH;
        viewX = Math.floor(xMin - padX);
        viewY = Math.floor(yMin - padY - bossPadUp);
        viewW = Math.ceil(xMax - xMin + 2 * padX);
        viewH = Math.ceil(yMax - yMin + 2 * padY + bossPadUp);
    }

    const freeOriginX = ((gridCols + gridRows) / 2) * tileHalfW;
    const freeOriginY = 20;

    return (
        <div className={cn(compact ? "flex flex-col h-full space-y-1.5 p-0 bg-transparent border-0 shadow-none min-h-0" : "space-y-3 rounded-2xl bg-surface border border-border p-4 sm:p-5 shadow-xs")}>
            {/* Toolbar Simulation Compacte : Choix du sort & Paramètres de portée */}
            {!compact && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-background border border-border rounded-xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 shrink-0">
                            <Zap className="w-3.5 h-3.5 text-warning" /> Sort simulé :
                        </span>
                        <select
                            value={currentSpell?.id ?? ""}
                            onChange={(e) => {
                                const found = spells.find((s) => s.id === Number(e.target.value));
                                if (found) selectSpell(found);
                            }}
                            className="bg-surface border border-border text-foreground text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-warning/40 max-w-[280px]"
                        >
                            {spells.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.apCost ? `${s.apCost} PA · ` : ""}{s.minRange === s.range ? `${s.range} PO` : `${s.minRange ?? 0}-${s.range ?? 0} PO`})
                                </option>
                            ))}
                        </select>

                        {/* Badges résumés du sort */}
                        {currentSpell && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
                                    {currentSpell.apCost || 0} PA
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                                    {minRange === maxRange ? `${maxRange} PO` : `${minRange} à ${maxRange} PO`}
                                </span>
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                                    castTestLos ? "bg-muted/15 text-muted-foreground border-border" : "bg-success/15 text-success border-success/30 font-black"
                                )}>
                                    {castTestLos ? "Ligne de vue" : "Sans Ligne de Vue"}
                                </span>
                                {currentSpell.zone && currentSpell.zone.shape !== "Inconnue" && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/20">
                                        Zone {currentSpell.zone.shape}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={recenter}
                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground bg-surface border border-border px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs shrink-0"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Recentrer
                    </button>
                </div>
            )}

            {/* SIMULATION TACTIQUE — le chrome (toolbar, bandeau, légende) est fixe ;
                seule la zone viewport ci-dessous reçoit le pan/zoom. */}
            <div
                className={cn(
                    "relative rounded-xl bg-[#161614] border border-white/10 flex flex-col items-center select-none shadow-inner",
                    compact
                        ? "p-1.5 flex-1 min-h-0 justify-start overflow-hidden [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"
                        : "p-2 sm:p-4 justify-center overflow-x-auto",
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
            >
                {/* Mode compact : barre d'outils épurée en 2 lignes (sticky en haut) */}
                {compact ? (
                    <div className="w-full space-y-1.5 mb-1.5 px-1 relative z-30 shrink-0 bg-[#161614] pb-1.5 border-b border-white/5" data-no-drag>
                        {/* Ligne 1 : Choix du Sort + Choix de la Salle */}
                        <div className="flex items-center gap-1.5 w-full">
                            {/* Sélecteur de sort stylé */}
                            <div ref={spellMenuRef} className="relative flex-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSpellMenuOpen((prev) => !prev);
                                        setIsMapMenuOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-1.5 bg-zinc-900/95 border rounded-lg px-2 py-1 text-[11px] font-bold transition-all",
                                        isSpellMenuOpen
                                            ? "border-amber-500/50 bg-amber-500/[0.1] text-amber-300 shadow-md shadow-black/40"
                                            : "border-white/10 hover:border-white/20 text-amber-400 hover:bg-zinc-800"
                                    )}
                                    title={currentSpell ? `${currentSpell.name} (${currentSpell.apCost ?? 0} PA · ${currentSpell.minRange === currentSpell.range ? `${currentSpell.range} PO` : `${currentSpell.minRange ?? 0}-${currentSpell.range ?? 0} PO`})` : "Sélectionner un sort"}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                                        {currentSpell?.imageUrl ? (
                                            <img
                                                src={`/api/assets-dofus/spells/${currentSpell.id}?url=${encodeURIComponent(currentSpell.imageUrl)}`}
                                                alt=""
                                                className="w-3.5 h-3.5 object-contain rounded shrink-0"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        ) : (
                                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        )}
                                        <span className="truncate">{currentSpell?.name ?? "Sort"}</span>
                                        {currentSpell && (
                                            <span className="text-[9px] font-semibold text-white/50 shrink-0">
                                                ({currentSpell.apCost ?? 0} PA · {currentSpell.minRange === currentSpell.range ? `${currentSpell.range} PO` : `${currentSpell.minRange ?? 0}-${currentSpell.range ?? 0} PO`})
                                            </span>
                                        )}
                                    </div>
                                    <ChevronDown
                                        className={cn(
                                            "w-3 h-3 text-zinc-400 transition-transform duration-200 shrink-0",
                                            isSpellMenuOpen && "rotate-180 text-amber-400"
                                        )}
                                    />
                                </button>

                                {isSpellMenuOpen && (
                                    <div className="absolute left-0 top-full mt-1 w-64 sm:w-72 max-h-56 overflow-y-auto rounded-xl bg-[#121218]/95 backdrop-blur-md border border-white/15 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                                        <div className="px-2 py-1 text-[9px] font-bold text-white/40 uppercase tracking-wider">
                                            Sorts de combat ({spells.length})
                                        </div>
                                        {spells.map((s) => {
                                            const isSelected = currentSpell?.id === s.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        selectSpell(s);
                                                        setIsSpellMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors mt-0.5",
                                                        isSelected
                                                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                                                            : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {s.imageUrl ? (
                                                            <img
                                                                src={`/api/assets-dofus/spells/${s.id}?url=${encodeURIComponent(s.imageUrl)}`}
                                                                alt=""
                                                                className="w-4 h-4 object-contain rounded shrink-0"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                            />
                                                        ) : (
                                                            <Zap className="w-4 h-4 text-amber-400/60 shrink-0" />
                                                        )}
                                                        <span className="truncate font-medium">{s.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 text-[10px]">
                                                        <span className="text-amber-400 font-bold">{s.apCost ?? 0} PA</span>
                                                        <span className="text-sky-400 font-bold">
                                                            {s.minRange === s.range ? `${s.range} PO` : `${s.minRange ?? 0}-${s.range ?? 0} PO`}
                                                        </span>
                                                        {isSelected && <Check className="w-3 h-3 text-amber-400 ml-1" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Sélecteur de salle / map stylé */}
                            {shownMaps.length > 0 && (
                                <div ref={mapMenuRef} className="relative flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMapMenuOpen((prev) => !prev);
                                            setIsSpellMenuOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-1.5 bg-zinc-900/95 border rounded-lg px-2 py-1 text-[11px] font-medium transition-all",
                                            isMapMenuOpen
                                                ? "border-amber-500/50 bg-amber-500/[0.1] text-amber-300 shadow-md shadow-black/40"
                                                : "border-white/10 hover:border-white/20 text-zinc-300 hover:text-white hover:bg-zinc-800"
                                        )}
                                        title={currentMapName}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                                            {selectedMapId === "empty" ? (
                                                <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            ) : (
                                                <MapIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            )}
                                            <span className="truncate">{currentMapName}</span>
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "w-3 h-3 text-zinc-400 transition-transform duration-200 shrink-0",
                                                isMapMenuOpen && "rotate-180 text-amber-400"
                                            )}
                                        />
                                    </button>

                                    {isMapMenuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-64 max-h-56 overflow-y-auto rounded-xl bg-[#121218]/95 backdrop-blur-md border border-white/15 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                                            <div className="px-2 py-1 text-[9px] font-bold text-white/40 uppercase tracking-wider">
                                                Salles du Donjon
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedMapId("empty");
                                                    setIsMapMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors",
                                                    selectedMapId === "empty"
                                                        ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                                                        : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                    <span className="truncate">Map vide (Grille 17×17)</span>
                                                </div>
                                                {selectedMapId === "empty" && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                                            </button>

                                            {shownMaps.map((m) => {
                                                const isSelected = selectedMapId === m.id;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedMapId(m.id);
                                                            setIsMapMenuOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors mt-0.5",
                                                            isSelected
                                                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                                                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {m.isBoss ? (
                                                                <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                            ) : (
                                                                <MapIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                            )}
                                                            <span className="truncate" title={m.name}>{m.name}</span>
                                                        </div>
                                                        {m.isBoss && (
                                                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                                                Boss
                                                            </span>
                                                        )}
                                                        {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {mapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />}
                        </div>

                        {/* Ligne 2 : Zoom + Placement + Butin + Toggles */}
                        <div className="flex items-center justify-between gap-1 flex-wrap text-[10px]">
                            {/* Zoom controls */}
                            <div className="inline-flex items-center bg-zinc-900 border border-white/10 rounded-md p-0.5">
                                <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.2).toFixed(2))))} className="px-1.5 py-0.5 font-black text-zinc-400 hover:text-white" title="Zoom arrière">−</button>
                                <span className="px-1 font-bold text-zinc-300 tabular-nums text-[9px]">{Math.round(zoom * 100)}%</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.2).toFixed(2))))} className="px-1.5 py-0.5 font-black text-zinc-400 hover:text-white" title="Zoom avant">+</button>
                                <button type="button" onClick={() => { setZoom(0.6); setPan({ x: 0, y: 0 }); }} className="px-1.5 py-0.5 font-bold text-amber-400 hover:text-amber-300" title="Ajuster et recentrer">Fit</button>
                            </div>

                            {/* Placement & Butin compacts */}
                            {mapData && (
                                <div className="inline-flex items-center gap-1">
                                    {totalPlacements > 1 && (
                                        <select
                                            value={placementIndex}
                                            onChange={(e) => {
                                                const nextIdx = Number(e.target.value);
                                                setPlacementIndex(nextIdx);
                                                setShowStartCells(true);
                                                applyStartCells(mapData, true, nextIdx);
                                            }}
                                            className="bg-zinc-900 border border-white/10 text-amber-400 text-[10px] font-bold rounded-md px-1.5 py-0.5 focus:outline-none"
                                        >
                                            {Array.from({ length: totalPlacements }).map((_, i) => (
                                                <option key={i + 1} value={i + 1}>P{i + 1}</option>
                                            ))}
                                        </select>
                                    )}

                                    <select
                                        value={lootCount}
                                        onChange={(e) => {
                                            const nextLoot = Number(e.target.value);
                                            setLootCount(nextLoot);
                                            setShowStartCells(true);
                                            applyStartCells(mapData, true, placementIndex);
                                        }}
                                        className="bg-zinc-900 border border-white/10 text-sky-400 text-[10px] font-bold rounded-md px-1.5 py-0.5 focus:outline-none"
                                    >
                                        {[4, 5, 6, 7, 8].map((b) => (
                                            <option key={b} value={b}>B{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Actions rapides icônes */}
                            <div className="inline-flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => { setPlacingAlly((v) => !v); setSelectedAlly(null); }}
                                    className={cn(
                                        "px-1.5 py-0.5 rounded-md border text-[10px] font-semibold transition-colors flex items-center gap-1",
                                        placingAlly ? "bg-sky-500/20 border-sky-400 text-sky-300" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                    )}
                                    title="Placer des alliés"
                                >
                                    <Users className="w-3 h-3" />
                                    <span>{allies.length}</span>
                                </button>

                                {mapData && (
                                    <button
                                        type="button"
                                        onClick={toggleStartCells}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded-md border text-[10px] font-semibold transition-colors",
                                            showStartCells ? "bg-amber-500/20 border-amber-400 text-amber-300" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                        title="Toggle placements de départ"
                                    >
                                        <MapIcon className="w-3 h-3" />
                                    </button>
                                )}

                                {allowFreeCasterMove && (
                                    <button
                                        type="button"
                                        onClick={() => setFreeCasterMove((v) => !v)}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded-md border text-[10px] font-semibold transition-colors",
                                            freeCasterMove ? "bg-amber-500/20 border-amber-400 text-amber-300" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                        title={freeCasterMove ? "Boss libre : cliquez une case pour le déplacer (actif)" : "Boss libre : cliquez une case pour le déplacer"}
                                    >
                                        <Move className="w-3 h-3" />
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={recenter}
                                    className="p-1 rounded-md bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                                    title="Recentrer le boss"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Mode complet standard */
                    <>
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
                        {shownMaps.length > 0 && (
                            <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                                    <MapIcon className="w-3.5 h-3.5 text-amber-400" /> Salle :
                                </span>
                                <div ref={mapMenuRef} className="relative min-w-[240px] max-w-[360px]">
                                    <button
                                        type="button"
                                        onClick={() => setIsMapMenuOpen((prev) => !prev)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 bg-zinc-900/90 border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all",
                                            isMapMenuOpen
                                                ? "border-amber-500/50 bg-amber-500/[0.08] text-amber-300"
                                                : "border-white/10 hover:border-white/20 text-zinc-200 hover:bg-zinc-800"
                                        )}
                                        title={currentMapName}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 truncate">
                                            {selectedMapId === "empty" ? (
                                                <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            ) : (
                                                <MapIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            )}
                                            <span className="truncate">{currentMapName}</span>
                                        </div>
                                        <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0", isMapMenuOpen && "rotate-180 text-amber-400")} />
                                    </button>

                                    {isMapMenuOpen && (
                                        <div className="absolute left-0 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-[#121218]/95 backdrop-blur-md border border-white/15 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedMapId("empty");
                                                    setIsMapMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors",
                                                    selectedMapId === "empty"
                                                        ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                                                        : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                    <span>Map vide</span>
                                                </div>
                                                {selectedMapId === "empty" && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                            </button>
                                            {shownMaps.map((m) => {
                                                const isSelected = selectedMapId === m.id;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedMapId(m.id);
                                                            setIsMapMenuOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors mt-0.5",
                                                            isSelected
                                                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                                                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {m.isBoss ? <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <MapIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                                                            <span className="truncate" title={m.name}>{m.name}</span>
                                                        </div>
                                                        {m.isBoss && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Boss</span>}
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {mapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                                {mapError && <span className="text-[11px] text-red-400">{mapError}</span>}
                            </div>
                        )}

                        <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                            <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                                <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.2).toFixed(2))))} className="px-2 py-1 rounded-md text-xs font-black text-muted-foreground hover:text-foreground hover:bg-elevated transition-all" title="Zoom arrière">−</button>
                                <span className="text-[10px] font-bold text-muted-foreground px-1 tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.2).toFixed(2))))} className="px-2 py-1 rounded-md text-xs font-black text-muted-foreground hover:text-foreground hover:bg-elevated transition-all" title="Zoom avant">+</button>
                                <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-1.5 py-1 rounded-md text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-all" title="1:1 (recentrer)">1:1</button>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setPlacingAlly((v) => !v); setSelectedAlly(null); }}
                                className={cn(
                                    "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                                    placingAlly
                                        ? "bg-sky-500/20 border-sky-400 text-sky-500 dark:text-sky-300"
                                        : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
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
                                            ? "bg-amber-500/20 border-amber-400 text-amber-500 dark:text-amber-300"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                    title="Placer le boss et les monstres sur leurs cases réelles"
                                >
                                    <MapIcon className="w-3.5 h-3.5" /> Placements de départ
                                </button>
                            )}
                            {allowFreeCasterMove && (
                                <button
                                    type="button"
                                    onClick={() => setFreeCasterMove((v) => !v)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                                        freeCasterMove
                                            ? "bg-amber-500/20 border-amber-400 text-amber-500 dark:text-amber-300"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                    title="Bypass : déplacez le boss sur n'importe quelle case marchable pour tester les portées"
                                >
                                    <Move className="w-3.5 h-3.5" /> {freeCasterMove ? "Boss libre : ON" : "Boss libre"}
                                </button>
                            )}
                            {mapData && totalPlacements > 1 && (
                                <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                                    <span className="text-[11px] font-bold text-zinc-400 pl-2">Placement :</span>
                                    <select
                                        value={placementIndex}
                                        onChange={(e) => {
                                            const nextIdx = Number(e.target.value);
                                            setPlacementIndex(nextIdx);
                                            if (mapData) {
                                                setShowStartCells(true);
                                                applyStartCells(mapData, true, nextIdx);
                                            }
                                        }}
                                        className="bg-zinc-800 border border-white/10 text-amber-400 text-xs font-black rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                                    >
                                        {Array.from({ length: totalPlacements }).map((_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                Placement {i + 1} / {totalPlacements}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowRulesModal(true)}
                                        className="p-1 text-zinc-400 hover:text-amber-400 transition-colors pr-1.5"
                                        title="Comment fonctionnent les règles de placement sur Dofus ?"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {mapData && (
                                <div className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg p-0.5">
                                    <span className="text-[11px] font-bold text-zinc-400 pl-2">Butin :</span>
                                    <select
                                        value={lootCount}
                                        onChange={(e) => {
                                            const nextLoot = Number(e.target.value);
                                            setLootCount(nextLoot);
                                            if (mapData) {
                                                setShowStartCells(true);
                                                applyStartCells(mapData, true, placementIndex);
                                            }
                                        }}
                                        className="bg-zinc-800 border border-white/10 text-sky-400 text-xs font-black rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                                    >
                                        {[4, 5, 6, 7, 8].map((b) => (
                                            <option key={b} value={b}>
                                                Butin {b} ({b} monstres)
                                            </option>
                                        ))}
                                    </select>
                                </div>
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
                    </>
                )}

                {/* Bandeau Composition de la salle */}
                {mapData && showStartCells && monsterPlacements.length > 0 && (
                    <div className="w-full flex flex-wrap items-center gap-1.5 mb-2 px-2 py-1.5 bg-zinc-900/90 border border-white/10 rounded-xl text-[11px] relative z-10 shrink-0">
                        <span className="font-bold text-amber-400 flex items-center gap-1 shrink-0">
                            <Users className="w-3.5 h-3.5" /> Ordre d'apparition (Butin {lootCount}) :
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {monsterPlacements.map((mp) => (
                                <span
                                    key={mp.order}
                                    className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border",
                                        mp.isBoss
                                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-black"
                                            : "bg-zinc-800 text-zinc-300 border-white/10"
                                    )}
                                >
                                    <span className={cn(
                                        "w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] font-black text-white",
                                        mp.isBoss ? "bg-amber-600" : "bg-blue-600"
                                    )}>
                                        {mp.order}
                                    </span>
                                    {mp.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Viewport pan/zoom isolé : lui seul bouge, le chrome reste fixe. */}
                <div
                    className={cn("relative w-full min-h-0", compact ? "flex-1 overflow-hidden" : "overflow-x-auto")}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{ touchAction: "none" }}
                >
                <div
                    ref={zoomRef}
                    className={cn("flex justify-center relative z-0 w-full shrink-0 select-none", compact ? "my-auto py-1" : "")}
                    style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                        transformOrigin: "center center",
                        transition: isDragging ? "none" : "transform 0.15s ease-out",
                        willChange: isDragging ? "transform" : "auto",
                    }}
                >
                <svg
                    viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
                    className="w-full h-auto drop-shadow-2xl"
                    style={{ minWidth: compact ? "100%" : "380px" }}
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
                                const monsterOrder = startCells?.enemy?.get(key);
                                const isStartEnemy = monsterOrder !== undefined;
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
                                    // Cases de départ Alliés / Joueurs (Rouge dans Dofus)
                                    fillColor = "#8a3a30";
                                    strokeColor = "#c65a4a";
                                    strokeWidth = 1.1;
                                } else if (isStartEnemy) {
                                    // Cases de départ Monstres / Boss (Bleu dans Dofus) — filtrées sur ce butin
                                    fillColor = "#2e5a8a";
                                    strokeColor = "#4a86c4";
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

                                // Prisme 3D : seules les faces exposées vers le bas (Sud-Ouest et Sud-Est) sont rendues.
                                const isEvenRow = r % 2 === 0;
                                const obsSW = isEvenRow ? isObs(c - 1, r + 1) : isObs(c, r + 1);
                                const obsSE = isEvenRow ? isObs(c, r + 1) : isObs(c + 1, r + 1);
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
                                        {obs && !obsSW && (
                                            <polygon
                                                points={`${tLeft.x},${tLeft.y} ${tBottom.x},${tBottom.y} ${bBottom.x},${bBottom.y} ${bLeft.x},${bLeft.y}`}
                                                fill={C.obsLeft}
                                                stroke={C.obsStroke}
                                                strokeWidth={0.4}
                                                className="transition-colors duration-150"
                                            />
                                        )}
                                        {obs && !obsSE && (
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
                                    // Boss mis à l'échelle (titan ≈ 2) : les pieds restent plantés
                                    // sur la case, le sprite déborde comme en vrai combat.
                                    return (
                                        <g key="boss" ref={casterMarkerRef} transform={`translate(${sx}, ${sy + BOSS_NUDGE}) scale(${bossScale}) translate(-46, ${-feetY})`} pointerEvents="none">
                                            {artSrc ? (
                                                <image
                                                    href={artSrc}
                                                    x="0"
                                                    y="0"
                                                    width="92"
                                                    height="88"
                                                    className="drop-shadow-2xl"
                                                    preserveAspectRatio="xMidYMax meet"
                                                    onError={() => {
                                                        // Art titan HS → repli icône, puis 👑.
                                                        setArtSrc((prev) => (titanCandidate && prev === titanCandidate && bossImageUrl ? bossImageUrl : null));
                                                    }}
                                                />
                                            ) : (
                                                <text x="46" y="-40" textAnchor="middle" fontSize="44" className="select-none">👑</text>
                                            )}
                                            {showStartCells && (
                                                <g transform={`translate(38, ${feetY - 30})`}>
                                                    <circle cx="6" cy="6" r="8" fill="#d97706" stroke="#ffffff" strokeWidth="1.2" />
                                                    <text x="6" y="9" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900" className="select-none">1</text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                }

                                // Monstres accompagnateurs (ordre 2..lootCount) si placements de départ actifs
                                if (showStartCells) {
                                    const mob = monsterPlacements.find((mp) => !mp.isBoss && mp.x === c && mp.y === r);
                                    if (mob) {
                                        return (
                                            <g key={`mob-${mob.order}-${mob.cellId}`} transform={`translate(${sx - 24}, ${sy - 38})`} pointerEvents="none">
                                                {mob.imageUrl ? (
                                                    <image href={mob.imageUrl} x="0" y="0" width="48" height="48" className="drop-shadow-2xl" />
                                                ) : (
                                                    <g>
                                                        <circle cx="24" cy="24" r="18" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                                                        <text x="24" y="29" textAnchor="middle" fill="#93c5fd" fontSize="16">👾</text>
                                                    </g>
                                                )}
                                                {/* Badge numéro d'apparition (2, 3, 4...) */}
                                                <g transform="translate(4, 4)">
                                                    <circle cx="6" cy="6" r="7.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.2" />
                                                    <text x="6" y="9" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900" className="select-none">{mob.order}</text>
                                                </g>
                                            </g>
                                        );
                                    }
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
                                            <g ref={casterMarkerRef} transform={`translate(${sx}, ${sy + BOSS_NUDGE}) scale(${bossScale}) translate(-34, ${-feetYFree})`} pointerEvents="none">
                                                {artSrc ? (
                                                    <image
                                                        href={artSrc}
                                                        x="0"
                                                        y="0"
                                                        width="68"
                                                        height="64"
                                                        className="drop-shadow-2xl"
                                                        preserveAspectRatio="xMidYMax meet"
                                                        onError={() => {
                                                            setArtSrc((prev) => (titanCandidate && prev === titanCandidate && bossImageUrl ? bossImageUrl : null));
                                                        }}
                                                    />
                                                ) : (
                                                    <text x="34" y="-28" textAnchor="middle" fontSize="36" className="select-none">👑</text>
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
                </div>

                {/* Légende & Astuces */}
                {compact ? (
                    <div className="w-full mt-2 pt-1.5 border-t border-white/5 shrink-0 relative z-30 bg-[#161614]">
                        <button
                            type="button"
                            onClick={() => setShowCompactLegend((v) => !v)}
                            className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                        >
                            <span className="flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                                {showCompactLegend ? "Masquer la légende" : "Légende des couleurs & astuces"}
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showCompactLegend && "rotate-180 text-amber-400")} />
                        </button>
                        {showCompactLegend && (
                            <div className="mt-2 space-y-2 animate-in fade-in duration-150 px-1">
                                <div className="w-full flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[9px] font-bold text-zinc-400">
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#6b1d1d", border: "1px solid #c53030" }} /> Boss (lanceur)</span>
                                    <span className="inline-flex items-center gap-1"><img src="/assets/module-succes/feca.webp" alt="" className="w-3.5 h-3.5 object-contain rounded-[2px]" /> Joueur (allié)</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#79b638" }} /> Portée du sort</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#e0a320", border: "1px solid #ffcf5e" }} /> Zone d'effet / AoE</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#8a3a30", border: "1px solid #c65a4a" }} /> Départ Joueurs (Rouge)</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#2e5a8a", border: "1px solid #4a86c4" }} /> Départ Monstres (Bleu)</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#1e3a5f", border: "1px solid #3b82f6" }} /> Hors portée</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#a11c1c", border: "1px solid #ef4444" }} /> Touché par zone</span>
                                    {mapData && (
                                        <>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#8D8A66" }} /> Sol</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#777358", border: "1px solid #5C5945" }} /> Obstacle</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: "#050505", border: "1px solid #3a3a3a" }} /> Trou</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[10px] text-zinc-500 leading-tight">
                                    💡 {allowFreeCasterMove ? "Boss libre : cliquez n'importe quelle case marchable pour déplacer le boss et tester les portées. " : "Le Boss est épinglé sur sa case de placement (non déplaçable). "}Cliquez un Féca pour le sélectionner, une case pour le déplacer. « Placements de départ » pose boss + monstres sur leurs cases réelles.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 px-2 text-[10px] font-bold text-zinc-400">
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#6b1d1d", border: "1px solid #c53030" }} /> Boss (lanceur)</span>
                            <span className="inline-flex items-center gap-1.5"><img src="/assets/module-succes/feca.webp" alt="" className="w-4 h-4 object-contain rounded-[3px]" /> Joueur (allié)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#79b638" }} /> Portée du sort (cibles)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#e0a320", border: "1px solid #ffcf5e" }} /> Zone d'effet / AoE (cercle, croix...)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#8a3a30", border: "1px solid #c65a4a" }} /> Départ Joueurs (Rouge)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#2e5a8a", border: "1px solid #4a86c4" }} /> Départ Monstres (Bleu)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#1e3a5f", border: "1px solid #3b82f6" }} /> Allié hors de portée</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#a11c1c", border: "1px solid #ef4444" }} /> Allié touché par la zone</span>
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
                            💡 {allowFreeCasterMove ? "Boss libre : cliquez n'importe quelle case marchable pour déplacer le boss et tester les portées. " : "Le Boss est épinglé sur sa case de placement (non déplaçable). "}Cliquez un Féca pour le sélectionner, une case pour le déplacer, re-cliquez pour l'orienter. « Placements de départ » pose boss + alliés sur leurs cases réelles.
                        </p>
                    </>
                )}
            </div>

            {/* Modale d'explication des règles de placement Dofus */}
            {showRulesModal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
                    onClick={() => setShowRulesModal(false)}
                >
                    <div
                        className="relative w-full max-w-xl bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl text-left space-y-4 max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-base font-black text-foreground flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-warning" /> Règles des Placements en Combat Dofus
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowRulesModal(false)}
                                className="text-muted-foreground hover:text-foreground font-black text-lg p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning-foreground">
                                <p className="font-bold text-foreground mb-1">🎯 Comment le jeu choisit le placement de la team ?</p>
                                <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                                    <li><strong className="text-foreground">Règle 1 (Majorité) :</strong> Le placement possédé par le plus grand nombre de membres du groupe est choisi.</li>
                                    <li><strong className="text-foreground">Règle 2 (Incrémentation) :</strong> À la fin d'un combat réussi sur votre placement, votre numéro de placement s'incrémente de +1.</li>
                                    <li><strong className="text-foreground">Règle 3 (Points de Priorité) :</strong> Jouer sur un placement qui n'est pas le vôtre vous accorde 1 point de priorité (écrase la règle de majorité).</li>
                                    <li><strong className="text-foreground">Règle 4 (Égalité) :</strong> En cas d'égalité de points de priorité, le placement le plus éloigné du placement 1 est retenu.</li>
                                </ul>
                            </div>

                            <div className="p-3 rounded-xl bg-surface-raised border border-border">
                                <p className="font-bold text-foreground mb-1">👾 Positionnement géométrique des Monstres :</p>
                                <ol className="space-y-1 list-decimal pl-4">
                                    <li>Il y a autant de placements disponibles que de cases bleues de départ monstres (ex. 8 placements).</li>
                                    <li>Pour le <strong>Placement N</strong>, le Boss commence sur la <strong>N-ième case bleue</strong> (triées du plus petit au plus grand ID de cellule).</li>
                                    <li>Les autres monstres se placent ensuite 1 par 1 : le jeu cherche la case libre située à exactement <strong>3 PO</strong> d'un monstre déjà placé (puis 4 PO, 5 PO... ou 2 PO/1 PO), avec départage par plus petit ID de case.</li>
                                </ol>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRulesModal(false)}
                                className="px-4 py-2 rounded-xl bg-warning text-warning-foreground font-black text-xs hover:brightness-110 transition-all"
                            >
                                J'ai compris
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
