"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Grid, HelpCircle, Loader2, Map as MapIcon, Move, RotateCcw, SlidersHorizontal, Sparkles, Swords, Users, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { getDofensiveMap, type DofensiveMapData, type DofensiveMapLite } from "@/server/actions/dofensive-actions";
import { SimulationTacticalLegend } from "@/components/succes/SimulationTacticalLegend";
import { SimulationSpellPicker } from "@/components/succes/SimulationSpellPicker";
import { SimulationDamageHud } from "@/components/succes/SimulationDamageHud";
import {
    damageLinesFromEffects,
    formatDamageRange,
    totalDamageRange,
    type SpellDamageLine,
    type SpellElementKey,
} from "@/lib/dofus-spells";
import {
    zoneFalloffPercent,
    zoneLinesAtOffset,
    zoneOffsetBetween,
    zoneTotalAtOffset,
} from "@/lib/dofus-zone-damage";
import { DOFUS_STAT_ASSET_BASE, STAT_THEMES, dofusStatHex } from "@/lib/dofus-stats-theme";
import {
    CellState,
    allyStartPositions,
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
    nameEn?: string;
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
    effectDetails?: {
        label: string;
        duration: string | null;
        triggers: string[];
        masks: string[];
        /** Jet de dégâts numérique de la ligne (déjà calculé côté serveur) — prévisu de dégâts. */
        damage?: { element: string; min: number; max: number } | null;
        /** Distance de poussée (cases) — affichée telle quelle, aucun dégât de poussée calculé. */
        pushDistance?: number | null;
    }[];
    /** Effets critiques (lignes) — section « Effets critiques ». */
    criticalEffects?: string[];
    /** false si le sort n'a aucun effet critique (« Aucun effet critique »). */
    hasCriticalEffects?: boolean;
    /** Zone d'effet AoE normalisée (source Dofensive) — prévisu sur la grille. */
    zone?: SpellZone;
}

interface DofusPos { x: number; y: number }
interface AllyToken { x: number; y: number; facing: number }

/**
 * Élément → entrée de notre thème de stats Dofus (icône **locale** + jeton de couleur).
 * Une seule source pour les couleurs « réelles du jeu » : `src/lib/dofus-stats-theme.ts`.
 */
const ELEMENT_STAT_KEY: Record<SpellElementKey, keyof typeof STAT_THEMES> = {
    terre: "earthDamage",
    feu: "fireDamage",
    eau: "waterDamage",
    air: "airDamage",
    neutre: "neutralDamage",
};

/** Ordre d'affichage des éléments (feu · terre · eau · air · neutre = ordre des fiches Dofus). */
const ELEMENT_ORDER: SpellElementKey[] = ["feu", "terre", "eau", "air", "neutre"];

/** Icône locale d'un élément (`/assets/dofus/stats/*.png` — aucune dépendance externe). */
function elementIcon(element: SpellElementKey): string {
    return `${DOFUS_STAT_ASSET_BASE}/${STAT_THEMES[ELEMENT_STAT_KEY[element]].asset}`;
}

/** Jeton de couleur d'un élément (thème de stats : Terre=warning, Feu=danger, Eau=info, Air=success). */
function elementColor(element: SpellElementKey): string {
    return STAT_THEMES[ELEMENT_STAT_KEY[element]].color;
}

/**
 * Couleur **réelle du jeu** d'un élément, pour les rendus **SVG** (badges de dégâts) où une classe
 * de thème ne s'applique pas. Source unique : la palette DofusBook partagée (`dofusStatHex`).
 */
function elementHex(element: SpellElementKey): string {
    return dofusStatHex(STAT_THEMES[ELEMENT_STAT_KEY[element]].asset);
}

/** Ambre du plateau — repli d'un badge de dégâts sans ligne exploitable (jamais de valeur inventée). */
const GRID_DAMAGE_FALLBACK_COLOR = "#e0a320";

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
    /** Bascule « Boss libre » **pilotée par le parent** (overlay Bestiaire) : quand elle
     *  est fournie, c'est SA valeur qui fait foi (les boutons internes remontent leur
     *  clic via `onFreeCasterMoveChange`). Absente ⇒ état interne (landing, démo). */
    freeCasterMove?: boolean;
    /** Notification d'un changement de bascule (clic interne ou parent). */
    onFreeCasterMoveChange?: (value: boolean) => void;
    /** Masque la pose d'alliés (Fécas) : toolbar, jetons et sélection (simulation de build). */
    hideAllies?: boolean;
    /** Quand défini, active la pose d'ennemis (jusqu'à `maxEnemies`) avec cette icône (ex. poutch). */
    enemyIconUrl?: string;
    /** Plafond d'ennemis posables (défaut 4). */
    maxEnemies?: number;
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
    freeCasterMove: controlledFreeCasterMove,
    onFreeCasterMoveChange,
    hideAllies = false,
    enemyIconUrl,
    maxEnemies = 4,
}: SpellRangeGridProps) {
    const { t, locale } = useI18n();
    const simT = t.tacticalSim;

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

    // Ennemis (ex. poutchs) posés sur la grille pour tester portées et zones.
    // Opt-in via `enemyIconUrl` (simulation de build) ; `hideAllies` retire les Fécas.
    const enemiesEnabled = !!enemyIconUrl;
    const MAX_ENEMIES = Math.min(8, Math.max(1, Math.floor(maxEnemies)));
    const [enemies, setEnemies] = useState<DofusPos[]>([]);
    const [selectedEnemy, setSelectedEnemy] = useState<number | null>(null);
    const [placingEnemy, setPlacingEnemy] = useState<boolean>(false);

    // Cases de départ réelles (map Dofensive).
    const [showStartCells, setShowStartCells] = useState<boolean>(false);

    // Bypass « boss libre » (opt-in landing publique) : actif par défaut quand la
    // prop est présente, désactivable via le toggle de la toolbar. Le dashboard
    // interne garde le comportement historique (boss épinglé sur son placement).
    //
    // Mode **piloté** (overlay Bestiaire) : si le parent fournit `freeCasterMove`, sa
    // valeur fait foi — l'icône compacte ET la bascule libellée remontent le clic via
    // `onFreeCasterMoveChange`, donc les deux commandes ne peuvent jamais diverger.
    // Aucune donnée n'est touchée : la position du boss reste un état de prévisualisation.
    const [internalFreeCasterMove, setInternalFreeCasterMove] = useState<boolean>(allowFreeCasterMove);
    const freeCasterMove = controlledFreeCasterMove ?? internalFreeCasterMove;
    const setFreeCasterMove = (next: boolean | ((prev: boolean) => boolean)) => {
        const value =
            typeof next === "function"
                ? (next as (prev: boolean) => boolean)(controlledFreeCasterMove ?? internalFreeCasterMove)
                : next;
        setInternalFreeCasterMove(value);
        onFreeCasterMoveChange?.(value);
    };

    // Survol souris
    const [hoveredCell, setHoveredCell] = useState<DofusPos | null>(null);

    // ── Sélecteur de map (salles du donjon, source Dofensive) ──
    const [selectedMapId, setSelectedMapId] = useState<number | "empty">("empty");
    const [mapData, setMapData] = useState<DofensiveMapData | null>(null);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    // Menu déroulant « Salle » (salles du donjon) : état local au composant. Le **sélecteur de
    // sort** vit désormais dans `SimulationSpellPicker` (source unique des deux modes) : plus de
    // second menu recopié ici.
    const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
    const mapMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (mapMenuRef.current && !mapMenuRef.current.contains(e.target as Node)) {
                setIsMapMenuOpen(false);
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
    // Panneau « Options » (placement, butin, toggles) et légende : **repliés par défaut**.
    // La simulation n'empile plus 4 à 5 niveaux de chrome au-dessus de la carte (retour user
    // 21/09/2026 : « c trop le bordel et trop slopesque dans tous les boutons au-dessus le
    // composant, faut un rangement pro »).
    const [showOptions, setShowOptions] = useState<boolean>(false);
    const [showLegend, setShowLegend] = useState<boolean>(false);
    // Prévisu de DÉGÂTS : une **option** (retour user : « pk afficher les dégâts en preview
    // (option à activer ?) »). Repliée par défaut — on affiche les jets RÉELS du grade,
    // calculés côté serveur, jamais une estimation inventée.
    const [showDamage, setShowDamage] = useState<boolean>(false);

    // Illustration titan (galerie God : /game-data/titans/<slug>.webp).
    // Convention + onError : aucune base ni session requise (marche partout,
    // y compris landing publique). Essayée seulement en contexte titan.
    const slugifyTitan = (name: string): string =>
        name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const bossScale = Math.min(5, Math.max(0.5, entityScale));
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

    // Garde « Boss libre » : dès qu'on repasse en mode épinglé, on repose le boss sur
    // son vrai placement de départ (prévisualisation pure, aucune écriture de donnée).
    useEffect(() => {
        if (!freeCasterMove && mapData && showStartCells) {
            applyStartCells(mapData, true, placementIndex);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freeCasterMove]);

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
        if (selectedMapId === "empty") return simT.emptyMap;
        const found = shownMaps.find((m) => m.id === selectedMapId);
        return found ? (found.isBoss ? `⚔ ${found.name}` : found.name) : simT.emptyMap;
    }, [selectedMapId, shownMaps, simT.emptyMap]);

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

    /**
     * Alliés (Fécas) posés sur les cases de départ **joueurs** de la carte réelle.
     * `enemyCells` = cases joueurs Dofensive (inversion conforme Dofus : les monstres sont
     * exposés dans `allyCells`). Aucune case joueur ⇒ aucun allié posé.
     */
    const allyStartTokens = (data: DofensiveMapData): AllyToken[] =>
        allyStartPositions(data.enemyCells, MAX_ALLIES).map((p) => ({ x: p.x, y: p.y, facing: 0 }));

    // Toggle « placements de départ » : pose/retire boss + alliés sur les cases réelles.
    const toggleStartCells = () => {
        const next = !showStartCells;
        setShowStartCells(next);
        if (mapData) {
            applyStartCells(mapData, next);
            // Les alliés ne sont posés qu'à l'ACTIVATION et jamais par-dessus des Fécas déjà
            // placés (le bouton « Vider » doit rester vide) : le toggle promet « boss + alliés
            // sur leurs cases réelles », or il ne posait que le boss (constat user 15/09/2026).
            if (next) {
                const tokens = allyStartTokens(mapData);
                if (tokens.length > 0) {
                    setAllies((prev) => (prev.length > 0 ? prev : tokens));
                }
            }
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

        // Sans ce `preventDefault`, le clic-molette déclenche l'**auto-défilement natif** du
        // navigateur : le panneau se déplaçait TOUT SEUL pendant qu'on croyait déplacer la carte
        // (retour user 21/09/2026 : « le composant complet peut être déplacé en maintenant
        // enfoncé la souris c pas normal »). Il coupe aussi la sélection de texte au glisser.
        e.preventDefault();

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

        if (!hideAllies && placingAlly) {
            if (x === casterPos.x && y === casterPos.y) return;
            setAllies((prev) => {
                const idx = prev.findIndex((a) => a.x === x && a.y === y);
                if (idx >= 0) return prev.filter((_, i) => i !== idx);
                if (prev.length >= MAX_ALLIES) return prev;
                return [...prev, { x, y, facing: 0 }];
            });
            return;
        }

        if (enemiesEnabled && placingEnemy) {
            if (x === casterPos.x && y === casterPos.y) return;
            if (!hideAllies && allies.some((a) => a.x === x && a.y === y)) return;
            setEnemies((prev) => {
                const idx = prev.findIndex((e) => e.x === x && e.y === y);
                if (idx >= 0) return prev.filter((_, i) => i !== idx);
                if (prev.length >= MAX_ENEMIES) return prev;
                return [...prev, { x, y }];
            });
            return;
        }

        // Un Féca est sélectionné : on le déplace ou on le fait pivoter.
        if (!hideAllies && selectedAlly !== null) {
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

        // Un ennemi est sélectionné : on le déplace (re-clic = désélection).
        if (enemiesEnabled && selectedEnemy !== null) {
            const enemy = enemies[selectedEnemy];
            if (enemy && x === enemy.x && y === enemy.y) {
                setSelectedEnemy(null);
                return;
            }
            const hitIdx = enemies.findIndex((e) => e.x === x && e.y === y);
            if (hitIdx >= 0) {
                setSelectedEnemy(hitIdx);
            } else {
                setEnemies((prev) => prev.map((e, i) => (i === selectedEnemy ? { x, y } : e)));
                setSelectedEnemy(null);
            }
            return;
        }

        // Aucun Féca sélectionné : on sélectionne un Féca.
        // Par défaut le Boss est ÉPINGLÉ sur sa case de placement (non déplaçable).
        // Bypass public (`allowFreeCasterMove` + toggle actif) : un clic sur une case
        // marchable déplace le boss librement pour jouer avec la préview des sorts.
        if (!hideAllies) {
            const allyIdx = allies.findIndex((a) => a.x === x && a.y === y);
            if (allyIdx >= 0) {
                setSelectedAlly(allyIdx);
                return;
            }
        }
        if (enemiesEnabled) {
            const enemyIdx = enemies.findIndex((e) => e.x === x && e.y === y);
            if (enemyIdx >= 0) {
                setSelectedEnemy(enemyIdx);
                return;
            }
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
            // La map est une surface interactive : la molette ZOOME (interne ET landing) et ne
            // fait JAMAIS défiler le parent (sinon la toolbar/les onglets « sortent » de
            // l'overlay et la page saute pendant la simulation).
            // `preventDefault` n'est possible que sur un listener natif NON passif : un `onWheel`
            // React est passif par défaut ⇒ `preventDefault` ignoré et le zoom restait KO.
            e.preventDefault();
            // Normalisation des unités : Firefox peut rapporter des « lignes » (deltaMode 1)
            // ou des « pages » (2) au lieu de pixels.
            const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
            setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z - pixels * 0.0015).toFixed(2)))));
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
    // Garde-fou de restauration : la restauration ne s'applique QU'UNE FOIS par carte/donjon.
    const restoredKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        // 🐞 Sans ce garde-fou, l'effet rejouait une sauvegarde TRANSITOIRE (map encore « vide »
        // au 1er rendu) dès qu'une dépendance changeait (`dungeonMaps` arrive après coup, remontage
        // d'onglet…) ⇒ il ÉCRASAIT la carte de combat auto-sélectionnée et la fiche restait bloquée
        // sur « Map Tactique Isométrique » (constat user 16/09 : landing sans carte, donc sans
        // « Placements de départ », sans Placement, sans Butin, sans alliés).
        if (restoredKeyRef.current === storageKey) return;
        restoredKeyRef.current = storageKey;
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
                if (Array.isArray(parsed.enemies)) {
                    setEnemies(parsed.enemies.filter((e: unknown) => !!e && typeof (e as DofusPos).x === "number"));
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
        // Jamais d'écriture AVANT la restauration courante : sinon on persiste l'état transitoire
        // (« mapId: empty ») qui sera relu et appliqué au remontage suivant.
        if (restoredKeyRef.current !== storageKey) return;
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    mapId: selectedMapId,
                    allies,
                    enemies,
                    casterPos,
                    showStartCells,
                })
            );
        } catch {
            // Ignorer
        }
    }, [storageKey, selectedMapId, allies, enemies, casterPos, showStartCells]);

    /**
     * **Case VISÉE** par le sort — la « cible blanche » du jeu. C'est à la fois la **matrice de la
     * zone d'effet** et l'**origine de la dégressivité** : « l'éloignement est le nombre minimal de
     * cases entre la case ciblée par le sort et le personnage qui subit les dégâts. Attention, la
     * case ciblée n'est pas forcément le centre de la zone ! » (règle du jeu).
     * Sort 0 PO = auto-ciblage ⇒ la case du lanceur ; hors case en portée ⇒ aucune visée.
     */
    const zoneAnchor = useMemo<DofusPos | null>(() => {
        const isSelfSpell = currentSpell?.range === 0 && (currentSpell?.minRange ?? 0) === 0;
        if (isSelfSpell) return casterPos;
        return hoveredCell && isCellInRange(hoveredCell.x, hoveredCell.y) ? hoveredCell : null;
    }, [hoveredCell, currentSpell, casterPos, isCellInRange]);

    // Prévisu de zone d'effet (AoE) — bâtie sur la case visée (`zoneAnchor`) : une seule source.
    const zonePreview = useMemo(() => {
        if (!zoneAnchor || !currentSpell?.zone) return null;
        const size = currentSpell.zone.size;
        if (size < 1 || size > 15) return null;
        const cells = spellZoneCells({
            zone: currentSpell.zone,
            target: zoneAnchor,
            caster: casterPos,
            cols: gridCols,
            rows: gridRows,
            isRealMap,
        });
        return new Set(cells.map((c) => `${c.x},${c.y}`));
    }, [zoneAnchor, currentSpell, casterPos, gridCols, gridRows, isRealMap]);
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

    // Ennemis touchés dans la zone d'impact actuelle (poutchs = mannequins de test).
    const hitEnemies = useMemo(() => {
        if (!zonePreview) return new Set<number>();
        const hits = new Set<number>();
        enemies.forEach((e, idx) => {
            if (zonePreview.has(`${e.x},${e.y}`)) {
                hits.add(idx);
            }
        });
        return hits;
    }, [zonePreview, enemies]);

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
                const isE = enemies.some((e) => e.x === c && e.y === r);
                let fill = "#1a1a18";
                if (state === CellState.OBSTACLE) fill = "#6b6548";
                else if (state === CellState.GROUND) fill = "#8D8A66";
                else if (state === CellState.HOLE) fill = "#050505";
                if (isC) fill = "#c53030";
                else if (isA) fill = "#3b82f6";
                else if (isE) fill = "#ef4444";
                cellsEls.push(<rect key={key} x={c * px} y={r * px} width={px - 0.5} height={px - 0.5} rx={0.6} fill={fill} />);
            }
        }
        return { rows, cols, px, w, h, cellsEls };
    }, [mapData, mapStates, casterPos, allies, enemies]);

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

    // Réglages actifs — pastille du panneau « Options » : quand le panneau est replié, on doit
    // continuer à voir QUE quelque chose est actif (boss libre, placements de départ, alliés…).
    const activeOptionCount = [
        showStartCells,
        allowFreeCasterMove && freeCasterMove,
        !hideAllies && allies.length > 0,
        enemiesEnabled && enemies.length > 0,
        showDamage,
    ].filter(Boolean).length;

    // Dégâts du sort affiché : jets **réels** du grade, par élément (données déjà calculées par le
    // serveur) + distance de poussée quand le sort pousse. Rien n'est dérivé du texte des effets.
    const damageInfo = useMemo(() => damageLinesFromEffects(currentSpell?.effectDetails), [currentSpell]);
    const damageTotal = useMemo(() => totalDamageRange(damageInfo.lines), [damageInfo.lines]);

    /**
     * **Prévisu par cible** — source **unique** des badges posés sur la grille ET du panneau de
     * prévisu. Pour chaque cible prise dans la zone (la case visée + les personnages qui s'y
     * trouvent), on applique la **dégressivité du jeu** `dégâts × (10 − éloignement)/10`,
     * l'éloignement étant mesuré depuis la **case visée** (`zoneAnchor`). Un personnage à 5 cases
     * de la visée n'affiche donc plus les dégâts pleins : il affiche ce qu'il encaisse vraiment.
     */
    const damageTargets = useMemo(() => {
        if (!showDamage || !zonePreview || !zoneAnchor || damageInfo.lines.length === 0) return [];
        const keys = new Set<string>();
        if (hoveredCell && zonePreview.has(`${hoveredCell.x},${hoveredCell.y}`)) {
            keys.add(`${hoveredCell.x},${hoveredCell.y}`);
        }
        if (!hideAllies) {
            for (const ally of allies) if (zonePreview.has(`${ally.x},${ally.y}`)) keys.add(`${ally.x},${ally.y}`);
        }
        if (enemiesEnabled) {
            for (const enemy of enemies) if (zonePreview.has(`${enemy.x},${enemy.y}`)) keys.add(`${enemy.x},${enemy.y}`);
        }
        return [...keys].map((key) => {
            const [x, y] = key.split(",").map(Number);
            const offset = zoneOffsetBetween(zoneAnchor, { x, y }, isRealMap);
            return {
                key,
                x,
                y,
                offset,
                falloff: zoneFalloffPercent(offset),
                lines: zoneLinesAtOffset(damageInfo.lines, offset),
                total: zoneTotalAtOffset(damageInfo.lines, offset),
            };
        });
    }, [showDamage, zonePreview, zoneAnchor, damageInfo.lines, hoveredCell, allies, enemies, enemiesEnabled, hideAllies, isRealMap]);

    /** Dégâts **réellement** infligés sur toute la zone (somme des cibles, dégressivité comprise). */
    const damageZoneTotal = useMemo(
        () =>
            damageTargets.reduce(
                (acc, target) => ({ min: acc.min + target.total.min, max: acc.max + target.total.max }),
                { min: 0, max: 0 }
            ),
        [damageTargets]
    );

    /**
     * Interrupteur « Dégâts estimés » — **monté dans les DEUX panneaux Options** (source unique).
     * `board` = panneau sombre posé **sur le plateau** (vue de jeu) : des jetons de thème y feraient
     * une tache claire dès que le thème clair est actif.
     */
    const damageToggle = (board: boolean) => (
        <button
            type="button"
            onClick={() => setShowDamage((v) => !v)}
            aria-pressed={showDamage}
            disabled={damageInfo.lines.length === 0}
            title={damageInfo.lines.length === 0 ? simT.damageUnavailable : simT.damageToggleTitle}
            className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors",
                damageInfo.lines.length === 0
                    ? cn(
                          "cursor-not-allowed",
                          board ? "border-white/10 bg-white/[0.03] text-zinc-500" : "border-border bg-surface text-muted-foreground/50"
                      )
                    : showDamage
                        ? cn(
                              "cursor-pointer",
                              board ? "border-warning/40 bg-warning/15 text-white" : "border-accent/40 bg-accent/10 text-foreground"
                          )
                        : cn(
                              "cursor-pointer",
                              board
                                  ? "border-white/15 bg-white/[0.04] text-zinc-300 hover:text-white"
                                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
                          )
            )}
        >
            <span className="flex min-w-0 items-center gap-1.5">
                <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{simT.damageToggle}</span>
            </span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums">
                {damageInfo.lines.length > 0
                    ? formatDamageRange(damageTotal.min, damageTotal.max)
                    : simT.damageUnavailable}
            </span>
        </button>
    );

    return (
        <div className={cn(compact ? "flex flex-col h-full space-y-1.5 p-0 bg-transparent border-0 shadow-none min-h-0" : "space-y-3 rounded-2xl bg-surface border border-border p-4 sm:p-5 shadow-xs")}>
            {/* Toolbar Simulation Compacte : Choix du sort & Paramètres de portée */}
            {!compact && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-background border border-border rounded-xl">
                    {/* Identité du SORT ACTIF : icône + nom + ses propriétés. Avant, c'était un
                        `<select>` nu collé à un libellé « Sort simulé : » — ni l'icône du sort, ni
                        une hiérarchie : on « perdait » le bandeau (retour user 21/09/2026). */}
                    <div className="flex min-w-0 shrink items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-2.5 py-1.5">
                        {currentSpell?.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={currentSpell.imageUrl}
                                alt=""
                                className="h-7 w-7 shrink-0 rounded-[4px] object-contain"
                                onError={(e) => {
                                    const el = e.target as HTMLImageElement;
                                    if (!el.dataset.fb && currentSpell.imageUrl) {
                                        el.dataset.fb = "1";
                                        el.src = `/api/assets-dofus/spells/${currentSpell.id}?url=${encodeURIComponent(currentSpell.imageUrl)}`;
                                    } else {
                                        el.style.display = "none";
                                    }
                                }}
                            />
                        ) : (
                            <Zap className="h-6 w-6 shrink-0 text-warning" />
                        )}

                        <div className="flex min-w-0 flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                {simT.simulatedSpell}
                            </span>
                            {/* Sélecteur de sort partagé (`SimulationSpellPicker`) : le `<select>`
                                natif ne pouvait ni porter l'icône du sort, ni les jets par élément,
                                ni s'accorder au thème (retour user 21/09/2026). */}
                            <SimulationSpellPicker
                                variant="page"
                                showTriggerIcon={false}
                                className="max-w-[17rem]"
                                spells={spells}
                                activeSpellId={currentSpell?.id ?? null}
                                onSelect={(spell) => {
                                    const found = spells.find((s) => s.id === spell.id);
                                    if (found) selectSpell(found);
                                }}
                                aria-label={simT.selectSpell}
                            />
                        </div>

                        {currentSpell && (
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                <span className="rounded-md border border-info/20 bg-info/10 px-1.5 py-0.5 text-[10px] font-bold text-info">
                                    {currentSpell.apCost || 0} PA
                                </span>
                                <span className="rounded-md border border-border bg-muted/15 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                    {minRange === maxRange ? `${maxRange} PO` : `${minRange} à ${maxRange} PO`}
                                </span>
                                {/* La ligne de vue est la NORME : on n'affiche que l'exception
                                    (« Sans Ligne de Vue »), pour que l'information rare se voie. */}
                                {!castTestLos && (
                                    <span className="rounded-md border border-success/30 bg-success/15 px-1.5 py-0.5 text-[10px] font-black text-success">
                                        {simT.noLos}
                                    </span>
                                )}
                                {currentSpell.zone && currentSpell.zone.shape !== "Inconnue" && (
                                    <span className="rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                                        {simT.zoneShape.replace("{shape}", currentSpell.zone.shape)}
                                    </span>
                                )}
                                {/* Dégâts estimés (option) : jets RÉELS par élément, avec les icônes et
                                    les couleurs d'éléments du jeu (thème de stats partagé). */}
                                {showDamage &&
                                    ELEMENT_ORDER.filter((el) => damageInfo.lines.some((l) => l.element === el)).map((el) => {
                                        const line = damageInfo.lines.find((l) => l.element === el) as SpellDamageLine;
                                        return (
                                            <span
                                                key={el}
                                                title={STAT_THEMES[ELEMENT_STAT_KEY[el]].label}
                                                className={cn(
                                                    "inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                                                    elementColor(el)
                                                )}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={elementIcon(el)} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                                {formatDamageRange(line.min, line.max)}
                                            </span>
                                        );
                                    })}
                                {showDamage && damageInfo.push !== null && (
                                    <span
                                        title={simT.damageToggleTitle}
                                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                                    >
                                        <Move className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        {simT.damagePush.replace("{count}", String(damageInfo.push))}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={recenter}
                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground bg-surface border border-border px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> {simT.recenter}
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
                    <div className="w-full space-y-1.5 mb-1.5 px-1 relative z-40 shrink-0 bg-[#161614] pb-1.5 border-b border-white/5" data-no-drag>
                        {/* Ligne 1 : Choix du Sort + Choix de la Salle */}
                        <div className="flex items-center gap-1.5 w-full">
                            {/* Sélecteur de sort partagé (`SimulationSpellPicker`, variante
                                « plateau ») : le même composant que le mode fiche — une seule
                                source, donc plus de menu recopié ni de sorts utilitaires. */}
                            <SimulationSpellPicker
                                variant="board"
                                className="flex-1"
                                spells={spells}
                                activeSpellId={currentSpell?.id ?? null}
                                onSelect={(spell) => {
                                    const found = spells.find((s) => s.id === spell.id);
                                    if (found) selectSpell(found);
                                }}
                                aria-label={simT.selectSpell}
                            />

                            {/* Sélecteur de salle / map stylé */}
                            {shownMaps.length > 0 && (
                                <div ref={mapMenuRef} className="relative flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMapMenuOpen((prev) => !prev);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-1.5 bg-zinc-900/95 border rounded-lg px-2 py-1 text-[11px] font-medium transition-all",
                                            isMapMenuOpen
                                                ? "border-white/20 bg-white/[0.08] text-white"
                                                : "border-white/10 hover:border-white/20 text-zinc-300 hover:text-white hover:bg-zinc-800"
                                        )}
                                        title={currentMapName}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                                            {selectedMapId === "empty" ? (
                                                <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            ) : (
                                                <MapIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            )}
                                            <span className="truncate">{currentMapName}</span>
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "w-3 h-3 text-zinc-400 transition-transform duration-200 shrink-0",
                                                isMapMenuOpen && "rotate-180 text-white/70"
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
                                                        ? "bg-white/[0.10] text-white"
                                                        : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                    <span className="truncate">{simT.emptyMapGrid}</span>
                                                </div>
                                                {selectedMapId === "empty" && <Check className="w-3 h-3 text-zinc-400 shrink-0" />}
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
                                                                ? "bg-white/[0.10] text-white"
                                                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {m.isBoss ? (
                                                                <Swords className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                            ) : (
                                                                <MapIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                            )}
                                                            <span className="truncate" title={m.name}>{m.name}</span>
                                                        </div>
                                                        {m.isBoss && (
                                                            <span className="text-[8px] px-1.5 py-0.2 rounded bg-white/[0.10] text-white/80 shrink-0">
                                                                Boss
                                                            </span>
                                                        )}
                                                        {isSelected && <Check className="w-3 h-3 text-zinc-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {mapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 shrink-0" />}
                        </div>

                        {/* Ligne 2 : Zoom + Options + Recentrer. Tout le secondaire (placement,
                            butin, toggles) vit dans le panneau « Options » replié. */}
                        <div className="relative flex items-center justify-between gap-1 flex-wrap text-[10px]">
                            {/* Zoom controls */}
                            <div className="inline-flex items-center bg-zinc-900 border border-white/10 rounded-md p-0.5">
                                <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.2).toFixed(2))))} className="px-1.5 py-0.5 font-black text-zinc-400 hover:text-white" title="Zoom arrière">−</button>
                                <span className="px-1 font-bold text-zinc-300 tabular-nums text-[9px]">{Math.round(zoom * 100)}%</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.2).toFixed(2))))} className="px-1.5 py-0.5 font-black text-zinc-400 hover:text-white" title="Zoom avant">+</button>
                                <button type="button" onClick={() => { setZoom(0.6); setPan({ x: 0, y: 0 }); }} className="px-1.5 py-0.5 font-bold text-white/70 hover:text-white" title="Ajuster et recentrer">Fit</button>
                            </div>

                            {/* Rangement : une seule rangée visible. Le reste est derrière ce
                                bouton — avec une pastille du nombre de réglages actifs pour ne
                                rien perdre de vue quand le panneau est replié. */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setShowOptions((v) => !v)}
                                    aria-expanded={showOptions}
                                    title={simT.optionsTitle}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                                        showOptions ? "bg-white/[0.12] border-white/25 text-white" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                    )}
                                >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    {simT.options}
                                    {activeOptionCount > 0 && (
                                        <span className="rounded-full bg-warning/25 px-1 text-[9px] font-black tabular-nums text-warning">
                                            {activeOptionCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={recenter}
                                    className="p-1 rounded-md bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                                    title="Recentrer le boss"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>

                            {showOptions && (
                                <div
                                    data-no-drag
                                    className="absolute right-0 top-full z-50 mt-1.5 w-[18rem] space-y-1.5 overflow-y-auto rounded-xl border border-white/15 bg-[#121218]/97 p-2 shadow-2xl backdrop-blur-md [scrollbar-width:thin]"
                                    style={{ maxHeight: "min(60vh, 22rem)" }}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                                            {simT.optionsTitle}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowOptions(false)}
                                            aria-label={simT.optionsClose}
                                            className="cursor-pointer p-0.5 text-zinc-400 transition-colors hover:text-white"
                                        >
                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    </div>

                                    {damageToggle(true)}

                            {/* Placement & Butin : libellés COMPLETS (fini les « P1 » / « B4 »
                                illisibles) et contrôles alignés sur la palette du plateau. */}
                            {mapData && (
                                <div className="space-y-1.5">
                                    {totalPlacements > 1 && (
                                        <label className="flex items-center justify-between gap-2 text-[10px] font-bold text-zinc-400">
                                            {simT.placement}
                                            <select
                                                value={placementIndex}
                                                onChange={(e) => {
                                                    const nextIdx = Number(e.target.value);
                                                    setPlacementIndex(nextIdx);
                                                    setShowStartCells(true);
                                                    applyStartCells(mapData, true, nextIdx);
                                                }}
                                                className="cursor-pointer rounded-md border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-black text-zinc-200 focus:outline-none"
                                            >
                                                {Array.from({ length: totalPlacements }).map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>
                                                        {i + 1} / {totalPlacements}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    <label className="flex items-center justify-between gap-2 text-[10px] font-bold text-zinc-400">
                                        {simT.loot}
                                        <select
                                            value={lootCount}
                                            onChange={(e) => {
                                                const nextLoot = Number(e.target.value);
                                                setLootCount(nextLoot);
                                                setShowStartCells(true);
                                                applyStartCells(mapData, true, placementIndex);
                                            }}
                                            className="cursor-pointer rounded-md border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-black text-info focus:outline-none"
                                        >
                                            {[4, 5, 6, 7, 8].map((b) => (
                                                <option key={b} value={b}>
                                                    {simT.lootOption.replace(/\{count\}/g, String(b))}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            )}

                            {/* Actions rapides icônes */}
                            <div className="inline-flex items-center gap-1">
                                {!hideAllies && (
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
                                )}
                                {enemiesEnabled && (
                                    <button
                                        type="button"
                                        onClick={() => { setPlacingEnemy((v) => !v); setSelectedEnemy(null); }}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded-md border text-[10px] font-semibold transition-colors flex items-center gap-1",
                                            placingEnemy ? "bg-red-500/20 border-red-400 text-red-300" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                        title={`Placer des ennemis (max ${MAX_ENEMIES})`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={enemyIconUrl} alt="" className="w-3 h-3 object-contain" loading="lazy" />
                                        <span>{enemies.length}</span>
                                    </button>
                                )}

                                {mapData && (
                                    <button
                                        type="button"
                                        onClick={toggleStartCells}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded-md border text-[10px] font-semibold transition-colors",
                                            showStartCells ? "bg-white/[0.12] border-white/25 text-white" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                        title="Placements de départ : pose le boss, les monstres et les alliés sur leurs cases réelles"
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
                                            freeCasterMove ? "bg-white/[0.12] border-white/25 text-white" : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                        title={freeCasterMove ? "Boss libre : cliquez une case pour le déplacer (actif)" : "Boss libre : cliquez une case pour le déplacer"}
                                    >
                                        <Move className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Mode complet standard */
                    <>
                        <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2 px-2">
                            <span className="font-bold text-zinc-300">
                                {simT.entity} <strong className="text-zinc-300">{bossName}</strong>
                            </span>
                            <span className="text-zinc-500">
                                {simT.map} <strong className="text-zinc-400">{mapData ? mapData.name : simT.tacticalMapName}</strong>
                                {mapData?.coordinates ? ` · ${mapData.coordinates.x}, ${mapData.coordinates.y}` : ""} · {simT.cellsCovered.replace("{count}", String(reachableCount))}
                            </span>
                        </div>

                        {/* Sélecteur de map (salles du donjon) — z-40 : le menu déroulant
                            doit passer AU-DESSUS des barres d'outils suivantes (z-10/z-30),
                            sinon la barre « Ordre d'apparition » masque la liste des salles. */}
                        {shownMaps.length > 0 && (
                            <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-40">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                                    <MapIcon className="w-3.5 h-3.5 text-zinc-300" /> {simT.room}
                                </span>
                                <div ref={mapMenuRef} className="relative min-w-[240px] max-w-[360px]">
                                    <button
                                        type="button"
                                        onClick={() => setIsMapMenuOpen((prev) => !prev)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 bg-zinc-900/90 border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                                            isMapMenuOpen
                                                ? "border-white/20 bg-white/[0.08] text-white"
                                                : "border-white/10 hover:border-white/20 text-zinc-200 hover:bg-zinc-800"
                                        )}
                                        title={currentMapName}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 truncate">
                                            {selectedMapId === "empty" ? (
                                                <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            ) : (
                                                <MapIcon className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                                            )}
                                            <span className="truncate">{selectedMapId === "empty" ? simT.emptyMap : currentMapName}</span>
                                        </div>
                                        <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0", isMapMenuOpen && "rotate-180 text-zinc-300")} />
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
                                                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer",
                                                    selectedMapId === "empty"
                                                        ? "bg-white/[0.10] text-white"
                                                        : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                    <span>{simT.emptyMap}</span>
                                                </div>
                                                {selectedMapId === "empty" && <Check className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
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
                                                            "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors mt-0.5 cursor-pointer",
                                                            isSelected
                                                                ? "bg-white/[0.10] text-white"
                                                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {m.isBoss ? <Swords className="w-3.5 h-3.5 text-zinc-300 shrink-0" /> : <MapIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                                                            <span className="truncate" title={m.name}>{m.name}</span>
                                                        </div>
                                                        {m.isBoss && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.10] text-white/85">Boss</span>}
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {mapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />}
                                {mapError && <span className="text-[11px] text-red-400">{mapError}</span>}
                            </div>
                        )}

                        <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                            <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                                <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.2).toFixed(2))))} className="px-2 py-1 rounded-md text-xs font-black text-muted-foreground hover:text-foreground hover:bg-elevated transition-all cursor-pointer" title={locale === "en" ? "Zoom out" : "Zoom arrière"}>−</button>
                                <span className="text-[10px] font-bold text-muted-foreground px-1 tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.2).toFixed(2))))} className="px-2 py-1 rounded-md text-xs font-black text-muted-foreground hover:text-foreground hover:bg-elevated transition-all cursor-pointer" title={locale === "en" ? "Zoom in" : "Zoom avant"}>+</button>
                                <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-1.5 py-1 rounded-md text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-all cursor-pointer" title={locale === "en" ? "1:1 (recenter)" : "1:1 (recentrer)"}>1:1</button>
                            </div>

                            {/* Rangement : la rangée ne montre plus QUE le zoom et ce bouton.
                                Le reste (alliés, ennemis, placements de départ, boss libre,
                                placement, butin, vider) est derrière, avec une pastille du
                                nombre de réglages actifs. */}
                            <button
                                type="button"
                                onClick={() => setShowOptions((v) => !v)}
                                aria-expanded={showOptions}
                                title={simT.optionsTitle}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                                    showOptions
                                        ? "border-white/25 bg-white/[0.12] text-white"
                                        : "border-border bg-surface text-muted-foreground hover:bg-elevated hover:text-foreground"
                                )}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                {simT.options}
                                {activeOptionCount > 0 && (
                                    <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-black tabular-nums text-warning">
                                        {activeOptionCount}
                                    </span>
                                )}
                            </button>

                            {showOptions && (
                                <div
                                    data-no-drag
                                    className={cn(
                                        "absolute right-2 top-full z-50 mt-1.5 w-[19rem] space-y-2 overflow-y-auto rounded-xl border p-2.5 shadow-2xl [scrollbar-width:thin]",
                                        // Mode complet : panneau clair/sombre selon le THÈME (il est
                                        // posé sur `bg-surface`) — un panneau sombre sous une page
                                        // claire serait un corps étranger.
                                        compact
                                            ? "border-white/15 bg-[#121218]/97 backdrop-blur-md"
                                            : "border-border bg-elevated"
                                    )}
                                    style={{ maxHeight: "min(65vh, 24rem)" }}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                            {simT.optionsTitle}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowOptions(false)}
                                            aria-label={simT.optionsClose}
                                            className="cursor-pointer p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    </div>
                            {damageToggle(false)}
                            {!hideAllies && (
                                <button
                                    type="button"
                                    onClick={() => { setPlacingAlly((v) => !v); setSelectedAlly(null); }}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                                        placingAlly
                                            ? "bg-sky-500/20 border-sky-400 text-sky-500 dark:text-sky-300"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    {placingAlly ? simT.alliesPlacementHint : `${simT.allies} ${allies.length}/${MAX_ALLIES}`}
                                </button>
                            )}
                            {enemiesEnabled && (
                                <button
                                    type="button"
                                    onClick={() => { setPlacingEnemy((v) => !v); setSelectedEnemy(null); }}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                                        placingEnemy
                                            ? "bg-red-500/20 border-red-400 text-red-500 dark:text-red-300"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={enemyIconUrl} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                                    {placingEnemy ? simT.enemiesPlacementHint : `${simT.enemies} ${enemies.length}/${MAX_ENEMIES}`}
                                </button>
                            )}
                            {mapData && (
                                <button
                                    type="button"
                                    onClick={toggleStartCells}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                                        showStartCells
                                            ? "bg-white/[0.12] border-white/25 text-white"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                    title={simT.startCellsTitle}
                                >
                                    <MapIcon className="w-3.5 h-3.5" /> {simT.startCells}
                                </button>
                            )}
                            {allowFreeCasterMove && (
                                <button
                                    type="button"
                                    onClick={() => setFreeCasterMove((v) => !v)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                                        freeCasterMove
                                            ? "bg-white/[0.12] border-white/25 text-white"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                    )}
                                    title={simT.freeBossTitle}
                                >
                                    <Move className="w-3.5 h-3.5" /> {freeCasterMove ? simT.freeBossOn : simT.freeBoss}
                                </button>
                            )}
                            {mapData && totalPlacements > 1 && (
                                <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                                    <span className="text-[11px] font-bold text-muted-foreground pl-2">{simT.placement}</span>
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
                                        className="bg-surface border border-border text-foreground text-xs font-black rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                                    >
                                        {Array.from({ length: totalPlacements }).map((_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {i + 1} / {totalPlacements}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowRulesModal(true)}
                                        className="p-1 text-muted-foreground hover:text-foreground transition-colors pr-1.5 cursor-pointer"
                                        title={simT.rulesModalTooltip}
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {mapData && (
                                <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                                    <span className="text-[11px] font-bold text-muted-foreground pl-2">{simT.loot}</span>
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
                                        className="bg-surface border border-border text-info text-xs font-black rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                                    >
                                        {[4, 5, 6, 7, 8].map((b) => (
                                            <option key={b} value={b}>
                                                {simT.lootOption.replace(/\{count\}/g, String(b))}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {(allies.length > 0 || enemies.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => { setAllies([]); setEnemies([]); setSelectedAlly(null); setSelectedEnemy(null); }}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 border border-white/10 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                    <RotateCcw className="w-3 h-3" /> {simT.clear}
                                </button>
                            )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Bandeau Composition de la salle */}
                {mapData && showStartCells && monsterPlacements.length > 0 && (
                    <div className="w-full flex flex-wrap items-center gap-1.5 mb-2 px-2 py-1.5 bg-zinc-900/90 border border-white/10 rounded-xl text-[11px] relative z-10 shrink-0">
                        <span className="font-bold text-zinc-300 flex items-center gap-1 shrink-0">
                            <Users className="w-3.5 h-3.5" /> {simT.appearanceOrder.replace("{count}", String(lootCount))}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {monsterPlacements.map((mp) => (
                                <span
                                    key={mp.order}
                                    className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border",
                                        mp.isBoss
                                            ? "bg-white/[0.12] text-white border-white/25"
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
                    // ⚠️ Le fond sombre est porté par le CONTENEUR (donc fixe). Avant, il était
                    // dessiné par un `<rect fill="#050505">` À L'INTÉRIEUR du calque transformé :
                    // déplacer la carte déplaçait aussi le fond, d'où l'impression que « le
                    // composant complet » bougeait. Ici, seul le plateau isométrique se déplace.
                    className={cn("relative w-full min-h-0 bg-[#050505]", compact ? "flex-1 overflow-hidden" : "overflow-x-auto")}
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
                    {/* Le fond sombre du plateau est porté par le conteneur (cf. ci-dessus) :
                        il ne défile pas avec la carte. */}
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
                                const isAllyCell = !obs && !hideAllies && allies.some((a) => a.x === c && a.y === r);
                                const isEnemyCell = !obs && enemiesEnabled && enemies.some((e) => e.x === c && e.y === r);
                                const isTokenCell = isAllyCell || isEnemyCell;
                                const inRange = !obs && isCellInRange(c, r);
                                const isHovered = hoveredCell?.x === c && hoveredCell?.y === r;
                                const isZoneAnchor = zoneAnchor?.x === c && zoneAnchor?.y === r;

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
                                } else if (isTokenCell) {
                                    fillColor = inRange ? "#a11c1c" : "#1e3a5f";
                                    strokeColor = inRange ? "#ef4444" : "#3b82f6";
                                    strokeWidth = 1.4;
                                }

                                if (isHovered && !isCaster && !isTokenCell && !obs) {
                                    fillColor = inRange ? "#9ae44c" : "#a39e90";
                                }

                                // Prévisu de zone d'effet (AoE) : ambre, prioritaire sur la portée ET
                                // sur les jetons — un personnage DANS la zone doit sauter aux yeux
                                // (retour user 21/09/2026 : « on voit pas quand on touche les cibles »).
                                if (isInZone(c, r) && !obs && !isCaster) {
                                    fillColor = isTokenCell ? "#f2b53a" : "#e0a320";
                                    strokeColor = isTokenCell ? "#ffffff" : "#ffcf5e";
                                    strokeWidth = isTokenCell ? 1.8 : 1.1;
                                }

                                // Case VISÉE (la « cible blanche » du jeu) : contour blanc posé en
                                // dernier pour rester visible par-dessus la zone.
                                if (isZoneAnchor) {
                                    strokeColor = "#ffffff";
                                    strokeWidth = 1.8;
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
                                if (!hideAllies) {
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
                                }
                                if (enemiesEnabled) {
                                    const ei = enemies.findIndex((e) => e.x === c && e.y === r);
                                    if (ei >= 0) {
                                        const isSel = selectedEnemy === ei;
                                        const isHit = hitEnemies.has(ei);
                                        return (
                                            <g key={`enemy-${ei}`} pointerEvents="none">
                                                {isSel && (<circle cx={sx} cy={sy + 10} r="22" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />)}
                                                {isHit && (
                                                    <circle cx={sx} cy={sy + 10} r="20" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" strokeWidth="2.5">
                                                        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1s" repeatCount="indefinite" />
                                                    </circle>
                                                )}
                                                <g transform={`translate(${sx - 22}, ${sy - 32})`}>
                                                    <image href={enemyIconUrl} x="0" y="0" width="44" height="44" className="drop-shadow-2xl" />
                                                </g>
                                                {isHit && (
                                                    <text x={sx} y={sy - 36} textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="900" className="select-none">ZONE</text>
                                                )}
                                            </g>
                                        );
                                    }
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
                                const isAllyCell = !hideAllies && allies.some((a) => a.x === x && a.y === y);
                                const isEnemyCell = enemiesEnabled && enemies.some((e) => e.x === x && e.y === y);
                                const isTokenCell = isAllyCell || isEnemyCell;
                                const inRange = isCellInRange(x, y);
                                const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                                const isZoneAnchor = zoneAnchor?.x === x && zoneAnchor?.y === y;
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
                                } else if (isTokenCell) {
                                    fillColor = inRange ? "#a11c1c" : "#1e3a5f";
                                    strokeColor = inRange ? "#ef4444" : "#3b82f6";
                                    strokeWidth = 1.5;
                                }

                                if (isHovered && !isCaster && !isTokenCell) {
                                    fillColor = inRange ? "#9ae44c" : "#7c7767";
                                }

                                // Prévisu de zone d'effet (AoE) : ambre, prioritaire sur la portée ET
                                // sur les jetons (une cible touchée doit être évidente).
                                if (isInZone(x, y) && !isCaster) {
                                    fillColor = isTokenCell ? "#f2b53a" : "#e0a320";
                                    strokeColor = isTokenCell ? "#ffffff" : "#ffcf5e";
                                    strokeWidth = isTokenCell ? 1.9 : 1.2;
                                }

                                // Case VISÉE (« cible blanche » du jeu) : contour blanc prioritaire.
                                if (isZoneAnchor) {
                                    strokeColor = "#ffffff";
                                    strokeWidth = 1.9;
                                }

                                const sideColor = inRange ? "#4c7a1f" : isCaster ? "#4a1212" : isTokenCell ? (inRange ? "#6f1010" : "#122a4a") : "#3a372e";

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
                                        {!hideAllies && allies.map((ally, ai) => {
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
                                        {enemiesEnabled && enemies.map((enemy, ei) => {
                                            if (enemy.x !== x || enemy.y !== y) return null;
                                            const isSel = selectedEnemy === ei;
                                            const isHit = hitEnemies.has(ei);
                                            return (
                                                <g key={`enemy-${ei}`} pointerEvents="none">
                                                    {isSel && (<circle cx={sx} cy={sy + 10} r="21" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />)}
                                                    {isHit && (
                                                        <circle cx={sx} cy={sy + 10} r="19" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" strokeWidth="2.5">
                                                            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1s" repeatCount="indefinite" />
                                                        </circle>
                                                    )}
                                                    <g transform={`translate(${sx - 21}, ${sy - 30})`}>
                                                        <image href={enemyIconUrl} x="0" y="0" width="42" height="42" className="drop-shadow-2xl" />
                                                    </g>
                                                </g>
                                            );
                                        })}
                                    </g>
                                );
                            })
                        )
                    )}
                {/* Case VISÉE — la « cible blanche » du jeu (convention relevée sur la page de
                    règles) : elle matérialise la matrice de la zone ET l'origine de la dégressivité.
                    Toujours affichée, même option de dégâts éteinte : on doit voir ce qu'on cible. */}
                {zoneAnchor && (() => {
                    const { sx, sy } = cellToScreen(zoneAnchor.x, zoneAnchor.y, tileW, tileH);
                    return (
                        <g pointerEvents="none" className="select-none" data-zone-anchor="1">
                            <circle cx={sx} cy={sy + tileHalfH} r={11} fill="none" stroke="#ffffff" strokeWidth={1.4} opacity={0.9} />
                            <circle cx={sx} cy={sy + tileHalfH} r={3.4} fill="#ffffff" opacity={0.95} />
                        </g>
                    );
                })()}

                {/* Prévisu de DÉGÂTS (option « Dégâts estimés ») : les jets RÉELS du sort sur la
                    cible visée et sur les personnages présents dans la zone — la donnée vient du
                    serveur (caractéristiques du monstre appliquées), rien n'est estimé ici.
                    Chaque badge porte la **dégressivité du jeu** propre à SA cible et affiche les
                    lignes par élément avec les couleurs réelles du jeu. */}
                {showDamage && damageInfo.lines.length > 0 && zonePreview && (
                    <g pointerEvents="none">
                        {damageTargets.map((target) => {
                            const { sx, sy } = cellToScreen(target.x, target.y, tileW, tileH);
                            const hasFalloff = target.falloff < 100;
                            const rowsTop = hasFalloff ? 40 : 29;
                            const boxW = 78;
                            const boxH = rowsTop + target.lines.length * 13 + 3;
                            const mainHex = target.lines[0] ? elementHex(target.lines[0].element) : GRID_DAMAGE_FALLBACK_COLOR;
                            return (
                                <g key={`dmg-${target.key}`} transform={`translate(${sx - boxW / 2}, ${sy - 26 - boxH})`}>
                                    <rect
                                        x={0}
                                        y={0}
                                        width={boxW}
                                        height={boxH}
                                        rx={5}
                                        fill="rgba(5,5,5,0.92)"
                                        stroke={mainHex}
                                        strokeWidth={1.2}
                                    />
                                    <text
                                        x={boxW / 2}
                                        y={14}
                                        textAnchor="middle"
                                        fill="#ffffff"
                                        fontSize={12}
                                        fontWeight="900"
                                        className="select-none"
                                    >
                                        {formatDamageRange(target.total.min, target.total.max)}
                                    </text>
                                    {hasFalloff && (
                                        <text
                                            x={boxW / 2}
                                            y={25}
                                            textAnchor="middle"
                                            fill="#fbbf24"
                                            fontSize={9}
                                            fontWeight="800"
                                            className="select-none"
                                        >
                                            {simT.damageFalloffShort.replace("{percent}", String(100 - target.falloff))}
                                        </text>
                                    )}
                                    {target.lines.map((line, i) => (
                                        <g key={line.element} transform={`translate(6, ${rowsTop + i * 13})`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <image href={elementIcon(line.element)} x={0} y={-8} width={10} height={10} />
                                            <text
                                                x={13}
                                                y={0}
                                                fill={elementHex(line.element)}
                                                fontSize={10}
                                                fontWeight="700"
                                                className="select-none"
                                            >
                                                {formatDamageRange(line.min, line.max)}
                                            </text>
                                        </g>
                                    ))}
                                </g>
                            );
                        })}
                    </g>
                )}
                </svg>
                </div>
                </div>

                {/* Légende + prévisu de dégâts **dans le plateau** : l'utilisateur n'a plus à
                    dézoomer ni à sortir du composant pour les atteindre (retour user 21/09/2026).
                    Deux panneaux flottants bornés, qui ne poussent plus la carte. */}
                <div
                    data-no-drag
                    className="pointer-events-none absolute inset-x-2 bottom-2 z-40 flex items-end justify-between gap-2"
                >
                    <SimulationTacticalLegend
                        variant="board"
                        open={showLegend}
                        onToggle={() => setShowLegend((v) => !v)}
                        isRealMap={!!mapData}
                        showAllies={!hideAllies}
                        showEnemies={enemiesEnabled}
                        enemyIconUrl={enemyIconUrl ?? ""}
                        freeBossHint={allowFreeCasterMove ? (freeCasterMove ? simT.helpers.freeBossTip : simT.helpers.pinnedBossTip) : simT.helpers.pinnedBossTip}
                    />
                    {showDamage && damageInfo.lines.length > 0 && (
                        <SimulationDamageHud
                            variant="board"
                            lines={damageInfo.lines}
                            total={damageTotal}
                            push={damageInfo.push}
                            targets={{ count: damageTargets.length, total: damageZoneTotal }}
                        />
                    )}
                </div>
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
                                <Sparkles className="w-4 h-4 text-warning" /> {simT.rulesModalTitle}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowRulesModal(false)}
                                className="text-muted-foreground hover:text-foreground font-black text-lg p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning-foreground">
                                <p className="font-bold text-foreground mb-1">🎯 {simT.rulesTeamTitle}</p>
                                <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                                    <li><strong className="text-foreground">{simT.rulesTeamRule1Label}</strong> {simT.rulesTeamRule1}</li>
                                    <li><strong className="text-foreground">{simT.rulesTeamRule2Label}</strong> {simT.rulesTeamRule2}</li>
                                    <li><strong className="text-foreground">{simT.rulesTeamRule3Label}</strong> {simT.rulesTeamRule3}</li>
                                    <li><strong className="text-foreground">{simT.rulesTeamRule4Label}</strong> {simT.rulesTeamRule4}</li>
                                </ul>
                            </div>

                            <div className="p-3 rounded-xl bg-surface-raised border border-border">
                                <p className="font-bold text-foreground mb-1">👾 {simT.rulesMonsterTitle}</p>
                                <ol className="space-y-1 list-decimal pl-4">
                                    <li>{simT.rulesMonsterStep1}</li>
                                    <li>{simT.rulesMonsterStep2}</li>
                                    <li>{simT.rulesMonsterStep3}</li>
                                </ol>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRulesModal(false)}
                                className="px-4 py-2 rounded-xl bg-warning text-warning-foreground font-black text-xs hover:brightness-110 transition-all cursor-pointer"
                            >
                                {simT.rulesModalGotIt}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
