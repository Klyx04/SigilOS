"use client";

import { useEffect, useMemo, useState } from "react";
import { Swords, Users, RotateCcw, TriangleAlert, Move } from "lucide-react";
import { DOFUS_CLASSES, dofusClassHead } from "@/lib/dofus-assets";
import {
    DOFUS_MAP_ROWS,
    DOFUS_MAP_WIDTH,
    cellIdToXY,
    cellToScreen,
    getLosPath,
    getSpellRangeDistance,
    positionToCellId,
    spellZoneCells,
    splitHoles,
    toLos,
} from "@/lib/dofus-grid";
import type { SpellData } from "@/components/succes/SpellRangeGrid";
import { getMonsterStats } from "@/server/actions/game-data-actions";
import { DOFUS_STAT_ASSET_BASE, STAT_THEMES } from "@/lib/dofus-stats-theme";
import type {
    TacticalDungeon,
    TacticalMonster,
} from "@/lib/dungeons/tactical-dungeon";
import {
    activeTacticalLayout,
    autoPlaceTactical,
    clampTacticalTeam,
    getTacticalRoom,
} from "@/lib/dungeons/tactical-dungeon";

/**
 * Moteur de rendu : grille brick Dofus en quinconce (`cellToScreen`, losanges
 * 64×32), **identique à `SpellRangeGrid`** (simulations des fiches boss) pour
 * que la salle 1 soit la même des deux côtés. Palette structurelle style
 * Dofensive (kaki/beige désaturé), mêmes losanges de départ (joueurs = bleu,
 * monstres = rouge), mêmes prismes d'obstacles (faces Sud exposées).
 */
const TILE_W = 64;
const TILE_H = 32;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
const PAD = 36;
/** Hauteur des prismes d'obstacle (comme `SpellRangeGrid`). */
const OBST_H = 24;

const C = {
    floor: "#8D8A66",
    floorMuted: "#777457",
    grid: "rgba(215, 208, 164, 0.20)",
    obsTop: "#777358",
    obsLeft: "#5C5945",
    obsRight: "#484638",
    obsStroke: "rgba(230, 224, 185, 0.35)",
    board: "#050505",
};
/** Départs monstres/défenseurs (cases bleues en jeu) / joueurs/attaquants (cases rouges) — mêmes teintes que `SpellRangeGrid`. */
const START_ALLY = "#2e5a8a";
const START_ALLY_EDGE = "#4a86c4";
const START_ENEMY = "#8a3a30";
const START_ENEMY_EDGE = "#c65a4a";
/** Portée / zone / sélection — mêmes teintes que `SpellRangeGrid`. */
const RANGE_A = "#79b638";
const RANGE_B = "#6ea830";
const RANGE_EDGE = "#8fd443";
const ZONE = "#e0a320";
const ZONE_TOKEN = "#f2b53a";
const ZONE_EDGE = "#ffcf5e";

interface PlacedClass {
    cellId: number;
    classId: string;
}

interface MonsterInstance {
    key: string;
    monsterId: number;
    cellId: number;
}

interface PawnSelection {
    kind: "class" | "monster";
    cellId: number;
    refId: string | number;
}

interface MonsterSpellState {
    loading: boolean;
    error: string | null;
    imageUrl: string | null;
    spells: SpellData[];
}

/** Élément de dégâts (libellé DofusDB, tolérant) → asset local + couleur. */
function elementTheme(element: string | null | undefined): { icon: string; color: string } {
    const e = (element ?? "").toLowerCase();
    if (e.includes("feu")) return { icon: "feu.png", color: "#f97316" };
    if (e.includes("eau")) return { icon: "eau.png", color: "#38bdf8" };
    if (e.includes("air")) return { icon: "air.png", color: "#4ade80" };
    if (e.includes("terre")) return { icon: "terre.png", color: "#facc15" };
    if (e.includes("neutre")) return { icon: "neutre.png", color: "#cbd5e1" };
    if (e.includes("soin")) return { icon: "soin.png", color: "#4ade80" };
    return { icon: STAT_THEMES.damage.asset, color: "#f87171" };
}

function loadPersisted(
    storageKey: string,
    rooms: TacticalDungeon["rooms"]
): {
    roomIndex: number;
    teamSize: number;
    variantKey: string;
    placed: PlacedClass[];
    monsterCounts: Record<number, number>;
} | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
            roomIndex?: number;
            teamSize?: number;
            variantKey?: string;
            placed?: PlacedClass[];
            monsterCounts?: Record<number, number>;
        };
        if (!getTacticalRoom(rooms, parsed.roomIndex ?? 0)) return null;
        return {
            roomIndex: parsed.roomIndex ?? 1,
            teamSize: clampTacticalTeam(parsed.teamSize),
            variantKey: typeof parsed.variantKey === "string" ? parsed.variantKey : "alt",
            placed: Array.isArray(parsed.placed) ? parsed.placed : [],
            monsterCounts: parsed.monsterCounts ?? {},
        };
    } catch {
        return null;
    }
}

/**
 * Simulateur tactique de donjon (salles N).
 *
 * Même carte que les simulations des fiches boss (`SpellRangeGrid`) : mêmes
 * données (`cellsData` siphonées du client, vérifiées case par case contre
 * Dofensive), même moteur brick (`cellToScreen`, 64×32), mêmes couleurs.
 * Layout « Dofensive » par défaut (la référence du site), layout `DungeonData`
 * en variante. Convention Dofus confirmée (capture combat Trône de Sang) :
 * **joueurs sur les bleues, monstres sur les rouges**.
 *
 * - butin 1-8, 19 classes posables sur les cases bleues (portraits HD réels) ;
 * - déplacement libre de tout pion (classes comme monstres) ;
 * - sorts + jets de dégâts via `getMonsterStats` (DofusDB + Dofensive — les
 *   dégâts des sorts de monstres Dofus 3 sont calculés par scripts serveur) ;
 * - compo par salle/butin : serveurs Ankama (ni `DungeonData`, ni Dofensive,
 *   ni les scénarios ne la donnent) — roster = pool de la sous-zone, modifiable.
 */
export function DungeonTactical({ dungeon }: { dungeon: TacticalDungeon }) {
    // État initial restauré une fois (localStorage, SSR-safe) — pas de ref lue
    // pendant le rendu : l'initialiseur paresseux de useState ne joue qu'au montage.
    const [initial] = useState(() => loadPersisted(dungeon.storageKey, dungeon.rooms));

    const [roomIndex, setRoomIndex] = useState(initial?.roomIndex ?? 1);
    const [variantKey, setVariantKey] = useState(initial?.variantKey ?? "alt");
    const [teamSize, setTeamSize] = useState(initial?.teamSize ?? 4);
    const [armedClassId, setArmedClassId] = useState<string>("cra");
    const [placed, setPlaced] = useState<PlacedClass[]>(initial?.placed ?? []);
    const [monsterCounts, setMonsterCounts] = useState<Record<number, number>>(() => {
        if (initial && Object.keys(initial.monsterCounts).length > 0) return initial.monsterCounts;
        const counts: Record<number, number> = {};
        for (const id of dungeon.defaultRoster(initial?.roomIndex ?? 1)) counts[id] = (counts[id] ?? 0) + 1;
        return counts;
    });
    // Instances explicites dès qu'un monstre est déplacé à la main (null = pose auto).
    const [monsterInstances, setMonsterInstances] = useState<MonsterInstance[] | null>(null);
    const [selection, setSelection] = useState<PawnSelection | null>(null);
    const [moving, setMoving] = useState<PawnSelection | null>(null);
    const [simActive, setSimActive] = useState(false);
    const [hoverCellId, setHoverCellId] = useState<number | null>(null);
    const [spellStates, setSpellStates] = useState<Record<number, MonsterSpellState>>({});
    const [selectedSpellId, setSelectedSpellId] = useState<number | null>(null);

    const room = getTacticalRoom(dungeon.rooms, roomIndex) ?? dungeon.rooms[0];
    const layout = useMemo(() => activeTacticalLayout(room, variantKey), [room, variantKey]);

    const blockedSet = useMemo(() => new Set(layout.blocked), [layout]);
    /** Cases bleues = monstres/défenseurs (pose auto). Les rouges = joueurs/attaquants (posables). */
    const blueSet = useMemo(() => new Set(layout.blue), [layout]);
    const redSet = useMemo(() => new Set(layout.red), [layout]);
    const holeSet = useMemo(() => new Set(layout.holes), [layout]);
    /**
     * Compte des puisards pour le libellé (`layout.holes` mélange vide
     * hors-carte et enclavés — salle 1 Dofensive : 221 vides + puisard 358).\n
     * Au rendu, comme `SpellRangeGrid`, les trous ne sont pas dessinés (le
     * fond du plateau transparaît). `splitHoles` est pur et testé.
     */
    const { pits } = useMemo(() => splitHoles(layout.holes), [layout]);

    const rosterIds = useMemo(() => {
        const ids: number[] = [];
        for (const m of dungeon.monsters) {
            const n = monsterCounts[m.id] ?? 0;
            for (let i = 0; i < Math.min(8, n); i++) ids.push(m.id);
        }
        return ids;
    }, [monsterCounts, dungeon.monsters]);
    const placements = useMemo(() => {
        if (monsterInstances) return monsterInstances.map((inst) => ({ cellId: inst.cellId, monsterId: inst.monsterId }));
        return autoPlaceTactical({ ...room, blue: layout.blue }, rosterIds);
    }, [monsterInstances, room, layout.blue, rosterIds]);
    const monsterByCell = useMemo(() => {
        const map = new Map<number, number[]>();
        for (const p of placements) {
            const list = map.get(p.cellId) ?? [];
            list.push(p.monsterId);
            map.set(p.cellId, list);
        }
        return map;
    }, [placements]);
    const classByCell = useMemo(() => {
        const map = new Map<number, string>();
        for (const p of placed) map.set(p.cellId, p.classId);
        return map;
    }, [placed]);

    const resetRoom = (index: number, variant: string) => {
        const next = getTacticalRoom(dungeon.rooms, index);
        if (!next) return;
        setRoomIndex(index);
        setVariantKey(variant);
        setPlaced([]);
        const counts: Record<number, number> = {};
        for (const id of dungeon.defaultRoster(index)) counts[id] = (counts[id] ?? 0) + 1;
        setMonsterCounts(counts);
        setMonsterInstances(null);
        setSelection(null);
        setMoving(null);
        setSelectedSpellId(null);
    };
    const selectRoom = (index: number) => resetRoom(index, "alt");
    const selectVariant = (key: string) => {
        setVariantKey(key);
        setMonsterInstances(null);
        setSelection(null);
        setMoving(null);
        setSelectedSpellId(null);
    };

    const changeTeamSize = (n: number) => {
        const size = clampTacticalTeam(n);
        setTeamSize(size);
        setPlaced((prev) => prev.slice(0, size));
    };

    const isFreeWalkable = (cellId: number): boolean =>
        cellId >= 0 &&
        cellId < DOFUS_MAP_WIDTH * DOFUS_MAP_ROWS &&
        !blockedSet.has(cellId) &&
        !holeSet.has(cellId) &&
        !classByCell.has(cellId) &&
        !monsterByCell.has(cellId);

    const placeArmedClass = (cellId: number) => {
        if (!redSet.has(cellId) || !isFreeWalkable(cellId)) return;
        if (placed.length >= teamSize) return;
        setPlaced((prev) => [...prev, { cellId, classId: armedClassId }]);
        setSelection({ kind: "class", cellId, refId: armedClassId });
    };

    const removePlacedClass = (cellId: number) => {
        setPlaced((prev) => prev.filter((p) => p.cellId !== cellId));
        if (selection?.kind === "class" && selection.cellId === cellId) setSelection(null);
        if (moving?.kind === "class" && moving.cellId === cellId) setMoving(null);
    };

    const ensureInstances = (): MonsterInstance[] => {
        if (monsterInstances) return monsterInstances;
        const auto = autoPlaceTactical({ ...room, blue: layout.blue }, rosterIds);
        return auto.map((p, i) => ({ key: `m${i}`, monsterId: p.monsterId, cellId: p.cellId }));
    };

    const movePawn = (pawn: PawnSelection, toCellId: number) => {
        if (!isFreeWalkable(toCellId)) return;
        if (pawn.kind === "class") {
            setPlaced((prev) => prev.map((p) => (p.cellId === pawn.cellId ? { ...p, cellId: toCellId } : p)));
            setSelection({ kind: "class", cellId: toCellId, refId: pawn.refId });
        } else {
            setMonsterInstances(
                ensureInstances().map((inst) =>
                    inst.cellId === pawn.cellId && inst.monsterId === pawn.refId
                        ? { ...inst, cellId: toCellId }
                        : inst
                )
            );
            setSelection({ kind: "monster", cellId: toCellId, refId: pawn.refId });
        }
        setMoving(null);
    };

    const bumpMonster = (monsterId: number, delta: number) => {
        setMonsterCounts((prev) => {
            const next = { ...prev };
            next[monsterId] = Math.min(8, Math.max(0, (next[monsterId] ?? 0) + delta));
            return next;
        });
        setMonsterInstances(null);
    };

    const selectedMonster =
        selection?.kind === "monster"
            ? dungeon.monsters.find((m) => m.id === selection.refId)
            : undefined;
    const selectedClass =
        selection?.kind === "class"
            ? DOFUS_CLASSES.find((c) => c.id === selection.refId)
            : undefined;

    // Sorts du monstre sélectionné, chargés à la demande (même source que les
    // fiches boss : DofusDB + merge Dofensive côté action).
    useEffect(() => {
        if (!selectedMonster) return;
        const id = selectedMonster.id;
        setSpellStates((prev) => {
            if (prev[id]) return prev;
            return { ...prev, [id]: { loading: true, error: null, imageUrl: null, spells: [] } };
        });
        let cancelled = false;
        getMonsterStats(selectedMonster.name, dungeon.dungeonName)
            .then((res) => {
                if (cancelled) return;
                if (!res.success || !res.data) {
                    setSpellStates((prev) => ({
                        ...prev,
                        [id]: {
                            loading: false,
                            error: res.error ?? "Sorts introuvables pour ce monstre",
                            imageUrl: null,
                            spells: [],
                        },
                    }));
                    return;
                }
                setSpellStates((prev) => ({
                    ...prev,
                    [id]: {
                        loading: false,
                        error: null,
                        imageUrl: res.data.imageUrl ?? null,
                        spells: Array.isArray(res.data.spells) ? res.data.spells : [],
                    },
                }));
            })
            .catch(() => {
                if (!cancelled) {
                    setSpellStates((prev) => ({
                        ...prev,
                        [id]: { loading: false, error: "Erreur réseau", imageUrl: null, spells: [] },
                    }));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [selectedMonster, dungeon.dungeonName]);

    const monsterSpells = selectedMonster ? spellStates[selectedMonster.id] : undefined;
    const currentSpell: SpellData | null = useMemo(() => {
        if (!monsterSpells || monsterSpells.spells.length === 0) return null;
        return monsterSpells.spells.find((s) => s.id === selectedSpellId) ?? monsterSpells.spells[0] ?? null;
    }, [monsterSpells, selectedSpellId]);

    useEffect(() => {
        setSelectedSpellId(null);
    }, [selection?.refId, selection?.kind]);

    // Persistance locale (salle + variante + butin + positions).
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(
                dungeon.storageKey,
                JSON.stringify({ roomIndex, variantKey, teamSize, placed, monsterCounts })
            );
        } catch {
            // Stockage indisponible : simulation non persistée, rien de bloquant.
        }
    }, [roomIndex, variantKey, teamSize, placed, monsterCounts, dungeon.storageKey]);

    const isObstacleCell = (col: number, row: number): boolean =>
        blockedSet.has(positionToCellId({ x: col, y: row })) ||
        holeSet.has(positionToCellId({ x: col, y: row }));

    /** Les trous (`los == 1`) bloquent le passage mais PAS la ligne de vue. */
    const isSightBlocker = (col: number, row: number): boolean =>
        blockedSet.has(positionToCellId({ x: col, y: row }));

    const casterPos = selection ? cellIdToXY(selection.cellId) : null;

    const isCellInRange = (col: number, row: number): boolean => {
        if (!currentSpell || !casterPos) return false;
        if (isObstacleCell(col, row)) return false;
        const minRange = currentSpell.minRange ?? 0;
        const maxRange = currentSpell.range ?? 0;
        const a = toLos(casterPos.x, casterPos.y);
        const b = toLos(col, row);
        const du = b.x - a.x;
        const dv = b.y - a.y;
        if (du === 0 && dv === 0) return minRange === 0;
        const dist = getSpellRangeDistance(du, dv, !!currentSpell.castInLine, !!currentSpell.castInDiagonal);
        if (dist < 0 || dist < minRange || dist > maxRange) return false;
        if (currentSpell.castTestLos !== false) {
            const path = getLosPath(casterPos, { x: col, y: row }, true);
            if (path.some((c) => isSightBlocker(c.x, c.y))) return false;
        }
        return true;
    };

    const rangeCells = useMemo(() => {
        if (!simActive || !currentSpell || !casterPos) return new Set<number>();
        const set = new Set<number>();
        for (let row = 0; row < DOFUS_MAP_ROWS; row++) {
            for (let col = 0; col < DOFUS_MAP_WIDTH; col++) {
                if (isCellInRange(col, row)) set.add(positionToCellId({ x: col, y: row }));
            }
        }
        return set;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simActive, currentSpell, casterPos, roomIndex, variantKey]);

    const zoneCells = useMemo(() => {
        if (!simActive || !currentSpell || !currentSpell.zone || !casterPos || hoverCellId === null) return new Set<number>();
        const target = cellIdToXY(hoverCellId);
        try {
            const cells = spellZoneCells({
                zone: { shape: currentSpell.zone.shape, size: currentSpell.zone.size, range: currentSpell.range ?? 0 },
                target,
                caster: casterPos,
                cols: DOFUS_MAP_WIDTH,
                rows: DOFUS_MAP_ROWS,
                isRealMap: true,
            });
            return new Set(cells.map((c) => positionToCellId(c)));
        } catch {
            return new Set<number>();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simActive, currentSpell, casterPos, hoverCellId, roomIndex, variantKey]);

    const proj = (col: number, row: number) => cellToScreen(col, row, TILE_W, TILE_H);

    const orderedCells = useMemo(() => {
        const cells: { col: number; row: number; id: number; sx: number; sy: number; depth: number }[] = [];
        for (let row = 0; row < DOFUS_MAP_ROWS; row++) {
            for (let col = 0; col < DOFUS_MAP_WIDTH; col++) {
                const { sx, sy } = proj(col, row);
                cells.push({ col, row, id: positionToCellId({ x: col, y: row }), sx, sy, depth: row + col });
            }
        }
        cells.sort((a, b) => a.depth - b.depth || a.row - b.row || a.col - b.col);
        return cells;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Cadrage resserré sur le jouable (les trous ne sont pas dessinés, comme
     * `SpellRangeGrid`). Bornes sur les cases dessinées, marges tuile +
     * hauteur de prisme.
     */
    const viewBox = useMemo(() => {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (let row = 0; row < DOFUS_MAP_ROWS; row++) {
            for (let col = 0; col < DOFUS_MAP_WIDTH; col++) {
                const id = positionToCellId({ x: col, y: row });
                if (holeSet.has(id)) continue;
                const { sx, sy } = proj(col, row);
                if (sx - HALF_W < minX) minX = sx - HALF_W;
                if (sx + HALF_W > maxX) maxX = sx + HALF_W;
                if (sy - OBST_H < minY) minY = sy - OBST_H;
                if (sy + TILE_H > maxY) maxY = sy + TILE_H;
            }
        }
        if (!Number.isFinite(minX)) {
            return `${-PAD} ${-PAD - OBST_H} ${DOFUS_MAP_WIDTH * TILE_W + HALF_W + PAD * 2} ${(DOFUS_MAP_ROWS - 1) * HALF_H + TILE_H + OBST_H + PAD * 2}`;
        }
        return `${minX - PAD} ${minY - PAD} ${maxX - minX + PAD * 2} ${maxY - minY + PAD * 2}`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [holeSet, roomIndex, variantKey]);

    const handleCellClick = (cellId: number) => {
        if (!simActive) return;
        if (moving) {
            if (cellId === moving.cellId) {
                setMoving(null);
                return;
            }
            if (isFreeWalkable(cellId)) {
                movePawn(moving, cellId);
                return;
            }
            setMoving(null);
            return;
        }
        if (blockedSet.has(cellId) || holeSet.has(cellId)) return;
        const classId = classByCell.get(cellId);
        if (classId !== undefined) {
            setSelection({ kind: "class", cellId, refId: classId });
            return;
        }
        const monsters = monsterByCell.get(cellId);
        if (monsters && monsters.length > 0) {
            setSelection({ kind: "monster", cellId, refId: monsters[0] });
            return;
        }
        if (redSet.has(cellId)) {
            placeArmedClass(cellId);
            return;
        }
        setSelection(null);
    };

    return (
        <div className="space-y-4">
            {/* Salles */}
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Salles du donjon">
                {dungeon.rooms.map((r) => (
                    <button
                        key={r.mapId}
                        role="tab"
                        aria-selected={r.index === roomIndex}
                        onClick={() => selectRoom(r.index)}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            r.index === roomIndex
                                ? "border-info bg-info/15 text-foreground"
                                : "border-border bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Salle {r.index}
                        <span className="ml-2 text-xs font-medium opacity-70">
                            {r.index === 5 ? "boss" : `${r.blocked.length} obst.`}
                        </span>
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Mode d'affichage">
                    {(["preview", "sim"] as const).map((m) => (
                        <button
                            key={m}
                            role="tab"
                            aria-selected={(m === "sim") === simActive}
                            onClick={() => {
                                setSimActive(m === "sim");
                                setMoving(null);
                                if (m === "preview") setSelection(null);
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-black transition-colors ${
                                (m === "sim") === simActive
                                    ? "bg-info text-info-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {m === "preview" ? "Aperçu L" : "Simulation"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Placement (variante = contenu de carte) + contrôles de simulation */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="text-sm font-bold">Placement</span>
                    <div className="flex items-center gap-1" role="tablist" aria-label="Variante de placement">
                        <button
                            role="tab"
                            aria-selected={variantKey === "normal"}
                            onClick={() => selectVariant("normal")}
                            className={`rounded-md px-2 py-1 text-xs font-black transition-colors ${
                                variantKey === "normal"
                                    ? "bg-info text-info-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            Normal ({room.red.length}/{room.blue.length})
                        </button>
                        {room.variants.map((v) => (
                            <button
                                key={v.key}
                                role="tab"
                                aria-selected={variantKey === v.key}
                                onClick={() => selectVariant(v.key)}
                                className={`rounded-md px-2 py-1 text-xs font-black transition-colors ${
                                    variantKey === v.key
                                        ? "bg-info text-info-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>
                {simActive && (
                    <>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold">Butin</span>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <button
                                key={n}
                                onClick={() => changeTeamSize(n)}
                                aria-pressed={teamSize === n}
                                className={`h-7 w-7 rounded-md text-xs font-black transition-colors ${
                                    teamSize === n
                                        ? "bg-info text-info-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {placed.length}/{teamSize} posés
                    </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="text-sm font-bold">Classe</span>
                    <div className="flex flex-wrap items-center gap-1">
                        {DOFUS_CLASSES.map((c) => (
                            <button
                                key={c.id}
                                title={c.name}
                                onClick={() => setArmedClassId(c.id)}
                                aria-pressed={armedClassId === c.id}
                                className={`rounded-md p-0.5 transition-colors ${
                                    armedClassId === c.id
                                        ? "bg-info/20 ring-2 ring-info"
                                        : "hover:bg-muted"
                                }`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={dofusClassHead(c.breed)} alt={c.name} width={30} height={30} loading="lazy" className="rounded" />
                            </button>
                        ))}
                    </div>
                </div>
                    </>
                )}
            </div>

            {moving && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-bold text-warning">
                    Déplacement : clique une case libre pour y poser le pion (recliquer dessus annule).
                </p>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* Grille brick Dofus (preview touche L) — même moteur que `SpellRangeGrid` */}
                {/* eslint-disable-next-line sigil/no-hardcoded-colors -- fond plateau #050505 identique à SpellRangeGrid (les trous s'y révèlent par transparence) */}
                <div className="overflow-auto rounded-xl border border-border bg-[#050505] p-2">
                    <div className="mb-1 flex items-center gap-4 px-1 text-xs font-bold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <svg width="14" height="10" viewBox="0 0 14 10"><polygon points="7,0 14,5 7,10 0,5" fill={START_ALLY} stroke={START_ALLY_EDGE} /></svg>
                            Alliés
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg width="14" height="10" viewBox="0 0 14 10"><polygon points="7,0 14,5 7,10 0,5" fill={START_ENEMY} stroke={START_ENEMY_EDGE} /></svg>
                            Ennemis
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg width="14" height="10" viewBox="0 0 14 10"><polygon points="7,0 14,5 7,10 0,5" fill={C.obsTop} stroke={C.obsStroke} /></svg>
                            Obstacle
                        </span>
                        {pits.length > 0 && (
                            <span className="flex items-center gap-1.5">
                                <svg width="14" height="10" viewBox="0 0 14 10"><polygon points="7,0 14,5 7,10 0,5" fill={C.board} stroke={C.grid} /></svg>
                                Trou
                            </span>
                        )}
                    </div>
                    <svg
                        viewBox={viewBox}
                        className="mx-auto h-auto w-full"
                        style={{ maxHeight: "72vh" }}
                        role="img"
                        aria-label={`Prévisualisation de la carte de combat, ${room.name} (map ${layout.mapId})`}
                    >
                        {orderedCells.map(({ col, row, id, sx, sy }) => {
                            // Trous (et vide) : non dessinés, le fond du plateau transparaît (comme `SpellRangeGrid`).
                            if (holeSet.has(id)) return null;
                            const isBlocked = blockedSet.has(id);
                            const isStartAlly = blueSet.has(id);
                            const isStartEnemy = redSet.has(id);
                            const hasPawn = classByCell.has(id) || monsterByCell.has(id);
                            const inRange = rangeCells.has(id);
                            const inZone = zoneCells.has(id);
                            const isHovered = hoverCellId === id;
                            const isCaster = selection?.cellId === id;
                            const points = `${sx},${sy} ${sx + HALF_W},${sy + HALF_H} ${sx},${sy + TILE_H} ${sx - HALF_W},${sy + HALF_H}`;

                            // Prisme 3D : seules les faces exposées vers le bas (Sud-Ouest / Sud-Est) sont rendues.
                            const isEvenRow = row % 2 === 0;
                            const isObs = (cc: number, rr: number) =>
                                rr >= 0 &&
                                rr < DOFUS_MAP_ROWS &&
                                cc >= 0 &&
                                cc < DOFUS_MAP_WIDTH &&
                                blockedSet.has(positionToCellId({ x: cc, y: rr }));
                            const obsSW = isEvenRow ? isObs(col - 1, row + 1) : isObs(col, row + 1);
                            const obsSE = isEvenRow ? isObs(col, row + 1) : isObs(col + 1, row + 1);
                            const ty = sy - OBST_H;
                            const tTop = { x: sx, y: ty };
                            const tRight = { x: sx + HALF_W, y: ty + HALF_H };
                            const tBottom = { x: sx, y: ty + TILE_H };
                            const tLeft = { x: sx - HALF_W, y: ty + HALF_H };
                            const bRight = { x: sx + HALF_W, y: sy + HALF_H };
                            const bBottom = { x: sx, y: sy + TILE_H };
                            const bLeft = { x: sx - HALF_W, y: sy + HALF_H };

                            if (isBlocked) {
                                return (
                                    <g key={id}>
                                        {!obsSW && (
                                            <polygon
                                                points={`${tLeft.x},${tLeft.y} ${tBottom.x},${tBottom.y} ${bBottom.x},${bBottom.y} ${bLeft.x},${bLeft.y}`}
                                                fill={C.obsLeft}
                                                stroke={C.obsStroke}
                                                strokeWidth={0.4}
                                            />
                                        )}
                                        {!obsSE && (
                                            <polygon
                                                points={`${tRight.x},${tRight.y} ${bRight.x},${bRight.y} ${bBottom.x},${bBottom.y} ${tBottom.x},${tBottom.y}`}
                                                fill={C.obsRight}
                                                stroke={C.obsStroke}
                                                strokeWidth={0.4}
                                            />
                                        )}
                                        <polygon
                                            points={`${tTop.x},${tTop.y} ${tRight.x},${tRight.y} ${tBottom.x},${tBottom.y} ${tLeft.x},${tLeft.y}`}
                                            fill={C.obsTop}
                                            stroke={C.obsStroke}
                                            strokeWidth={0.5}
                                            onClick={() => handleCellClick(id)}
                                            onMouseEnter={() => setHoverCellId(id)}
                                            onMouseLeave={() => setHoverCellId(null)}
                                        />
                                    </g>
                                );
                            }

                            let fill = row % 2 === 0 ? C.floor : C.floorMuted;
                            let stroke = C.grid;
                            let strokeWidth = 0.4;
                            if (isStartAlly) {
                                // Cases bleues = monstres / défenseurs (convention Dofus prouvée).
                                fill = START_ALLY;
                                stroke = START_ALLY_EDGE;
                                strokeWidth = 1.1;
                            } else if (isStartEnemy || hasPawn) {
                                // Cases rouges = joueurs / attaquants.
                                fill = START_ENEMY;
                                stroke = START_ENEMY_EDGE;
                                strokeWidth = 1.1;
                            }
                            if (inRange) {
                                fill = row % 2 === 0 ? RANGE_A : RANGE_B;
                                stroke = RANGE_EDGE;
                                strokeWidth = 0.7;
                            }
                            if (hasPawn) {
                                fill = inRange ? "#a11c1c" : "#1e3a5f";
                                stroke = inRange ? "#ef4444" : "#3b82f6";
                                strokeWidth = 1.4;
                            }
                            if (inZone) {
                                fill = hasPawn ? ZONE_TOKEN : ZONE;
                                stroke = hasPawn ? "#ffffff" : ZONE_EDGE;
                                strokeWidth = hasPawn ? 1.8 : 1.1;
                            }
                            if (isCaster) {
                                fill = "#6b1d1d";
                                stroke = "#c53030";
                                strokeWidth = 1.4;
                            } else if (isHovered && !hasPawn) {
                                fill = inRange ? "#9ae44c" : "#a39e90";
                            }
                            if (moving && isFreeWalkable(id)) {
                                stroke = "#22d3ee";
                                strokeWidth = 1;
                            }

                            return (
                                <polygon
                                    key={id}
                                    points={points}
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={moving && isFreeWalkable(id) ? "3 2" : undefined}
                                    onClick={() => handleCellClick(id)}
                                    onMouseEnter={() => setHoverCellId(id)}
                                    onMouseLeave={() => setHoverCellId(null)}
                                    className="cursor-pointer"
                                />
                            );
                        })}
                        {orderedCells.map(({ id, sx, sy }) => {
                            if (!simActive) return null;
                            if (blockedSet.has(id) || holeSet.has(id)) return null;
                            const cy = sy + HALF_H;
                            const classId = classByCell.get(id);
                            const monsters = monsterByCell.get(id);
                            if (classId !== undefined) {
                                const cls = DOFUS_CLASSES.find((c) => c.id === classId);
                                return (
                                    <g key={`pawn-${id}`} pointerEvents="none">
                                        <circle cx={sx} cy={cy} r={14} fill="#0b0d12" opacity={0.8} />
                                        {cls && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <image href={dofusClassHead(cls.breed)} x={sx - 12} y={cy - 14} width={24} height={26} />
                                        )}
                                        {selection?.cellId === id && (
                                            <ellipse cx={sx} cy={cy} rx={18} ry={11.5} fill="none" stroke="#ffffff" strokeWidth={1.6} />
                                        )}
                                    </g>
                                );
                            }
                            if (monsters && monsters.length > 0) {
                                const monster = dungeon.monsters.find((m) => m.id === monsters[0]);
                                return (
                                    <g key={`pawn-${id}`} pointerEvents="none">
                                        <circle cx={sx} cy={cy} r={14} fill="#0b0d12" opacity={0.8} />
                                        {monster ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <image href={monster.portrait} x={sx - 11} y={cy - 14} width={22} height={26} />
                                        ) : (
                                            <text x={sx} y={cy + 4.5} textAnchor="middle" fontSize={11} fontWeight={900} fill="currentColor" className="text-primary-foreground">?</text>
                                        )}
                                        {selection?.cellId === id && (
                                            <ellipse cx={sx} cy={cy} rx={18} ry={11.5} fill="none" stroke="#ffffff" strokeWidth={1.6} />
                                        )}
                                    </g>
                                );
                            }
                            return null;
                        })}
                    </svg>
                    <p className="px-1 pb-1 pt-2 text-xs text-muted-foreground">
                        {room.name} · {layout.label} · map {layout.mapId} · {layout.blocked.length} obstacles
                        {pits.length > 0 && ` · ${pits.length} trou${pits.length > 1 ? "s" : ""}`} · bleu = joueurs, rouge = monstres.
                        {hoverCellId !== null && ` · case ${hoverCellId}`}
                    </p>
                </div>

                {/* Panneau latéral */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-surface p-3">
                        <p className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                            <Swords className="h-4 w-4" /> Monstres ({placements.length}/{layout.red.length})
                        </p>
                        <div className="space-y-1.5">
                            {dungeon.monsters.map((m) => {
                                const count = monsterCounts[m.id] ?? 0;
                                return (
                                    <div key={m.id} className="flex items-center gap-2 text-sm">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={m.portrait} alt="" width={24} height={26} loading="lazy" className="rounded" />
                                        <span className="min-w-0 flex-1 truncate font-bold">
                                            {m.name}
                                            <span className="ml-1 font-medium text-muted-foreground">Nv.{m.level}</span>
                                        </span>
                                        {simActive && (
                                        <button
                                            onClick={() => bumpMonster(m.id, -1)}
                                            className="h-6 w-6 rounded bg-muted font-black text-muted-foreground hover:text-foreground"
                                            aria-label={`Retirer ${m.name}`}
                                        >
                                            −
                                        </button>
                                        )}
                                        <span className="w-4 text-center font-black">{count}</span>
                                        {simActive && (
                                        <button
                                            onClick={() => bumpMonster(m.id, 1)}
                                            className="h-6 w-6 rounded bg-muted font-black text-muted-foreground hover:text-foreground"
                                            aria-label={`Ajouter ${m.name}`}
                                        >
                                            +
                                        </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Pose auto sur les rouges, dans l'ordre. Clique un monstre posé pour le
                            déplacer librement. La compo réelle par salle et par butin est décidée
                            par les serveurs de jeu (pool de la sous-zone ci-dessus, modifiable).
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-3">
                        {selectedMonster ? (
                            <MonsterSpellPanel
                                monster={selectedMonster}
                                state={monsterSpells}
                                selectedSpellId={currentSpell?.id ?? null}
                                onSelectSpell={setSelectedSpellId}
                            />
                        ) : selectedClass ? (
                            <div className="text-sm">
                                <p className="font-black">
                                    {selectedClass.name}{" "}
                                    <span className="font-medium text-muted-foreground">
                                        · case {selection?.cellId}
                                    </span>
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    Pion allié posé sur une case bleue. Les sorts de classes vivent
                                    déjà dans l'onglet Simulation des fiches stuff — ici on prévisualise
                                    les sorts des monstres.
                                </p>
                                {selection && simActive && (
                                    <div className="mt-2 flex gap-2">
                                        <button
                                            onClick={() => setMoving(moving ? null : selection)}
                                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                                        >
                                            <Move className="h-3 w-3" /> {moving ? "Annuler" : "Déplacer"}
                                        </button>
                                        <button
                                            onClick={() => removePlacedClass(selection.cellId)}
                                            className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                                        >
                                            Retirer ce pion
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Clique une case <strong className="text-info">bleue</strong> pour poser la
                                classe armée, un <strong className="text-danger">monstre</strong> pour voir
                                ses sorts et leurs dégâts.
                            </p>
                        )}
                        {selectedMonster && selection && simActive && (
                            <button
                                onClick={() => setMoving(moving ? null : selection)}
                                className="mt-2 flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                            >
                                <Move className="h-3 w-3" /> {moving ? "Annuler le déplacement" : "Déplacer ce monstre"}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => resetRoom(roomIndex, "alt")}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4" /> Réinitialiser la salle
                    </button>
                    <p className="flex gap-2 text-xs text-muted-foreground">
                        <TriangleAlert className="h-4 w-4 shrink-0" />
                        <span>
                            Placements mesurés du client {dungeon.gameVersion}. Ils changent parfois
                            aux mises à jour : un re-siphon = un seul fichier à mettre à jour
                            (`fers-tyrannie.ts`, script `scripts/siphon-tactical-maps.py`).
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

function MonsterSpellPanel({
    monster,
    state,
    selectedSpellId,
    onSelectSpell,
}: {
    monster: TacticalMonster;
    state: MonsterSpellState | undefined;
    selectedSpellId: number | null;
    onSelectSpell: (id: number) => void;
}) {
    const active = state?.spells.find((s) => s.id === selectedSpellId) ?? state?.spells[0] ?? null;
    return (
        <div className="text-sm">
            <p className="font-black">
                {monster.name}{" "}
                <span className="font-medium text-muted-foreground">
                    · {monster.lifePoints.toLocaleString("fr-FR")} PV · {monster.actionPoints} PA ·{" "}
                    {monster.movementPoints} PM
                </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                Résis N/T/F/E/A : {monster.resistances.neutral}/{monster.resistances.earth}/
                {monster.resistances.fire}/{monster.resistances.water}/{monster.resistances.air}
            </p>
            {!state || state.loading ? (
                <p className="mt-2 text-muted-foreground">Chargement des sorts…</p>
            ) : state.error ? (
                <p className="mt-2 text-danger">{state.error} (affichage refusé, aucune donnée inventée).</p>
            ) : state.spells.length === 0 ? (
                <p className="mt-2 text-muted-foreground">Aucun sort remonté pour ce monstre.</p>
            ) : (
                <div className="mt-2 space-y-1.5">
                    {state.spells.map((spell) => (
                        <button
                            key={spell.id}
                            onClick={() => onSelectSpell(spell.id)}
                            aria-pressed={active?.id === spell.id}
                            className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                                active?.id === spell.id
                                    ? "border-warning bg-warning/10"
                                    : "border-border hover:border-muted-foreground"
                            }`}
                        >
                            <span className="flex items-center gap-2 font-bold">
                                {spell.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={spell.imageUrl} alt="" width={20} height={20} loading="lazy" className="rounded" />
                                )}
                                <span className="min-w-0 flex-1 truncate">{spell.name}</span>
                                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                    {spell.apCost ?? "?"} PA · {spell.minRange ?? 0}-{spell.range ?? "?"} PO
                                </span>
                            </span>
                            {active?.id === spell.id && (
                                <span className="mt-1 block space-y-0.5">
                                    {(spell.effectDetails ?? [])
                                        .filter((d) => d.damage)
                                        .map((d, i) => {
                                            const theme = elementTheme(d.damage?.element);
                                            return (
                                                <span key={i} className="flex items-center gap-1.5 text-xs">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={`${DOFUS_STAT_ASSET_BASE}/${theme.icon}`}
                                                        alt=""
                                                        width={14}
                                                        height={14}
                                                        loading="lazy"
                                                    />
                                                    <span className="font-bold" style={{ color: theme.color }}>
                                                        {d.damage?.min} – {d.damage?.max}
                                                    </span>
                                                    <span className="truncate text-muted-foreground">{d.label}</span>
                                                </span>
                                            );
                                        })}
                                </span>
                            )}
                        </button>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        Survole la grille : vert = portée, ambre = zone d'effet du sort actif.
                    </p>
                </div>
            )}
        </div>
    );
}
