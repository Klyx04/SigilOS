"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Move, RotateCcw, Sparkles, Target, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface SpellRangeGridProps {
    spells: SpellData[];
    activeSpellId?: number;
    onSelectSpell?: (spell: SpellData) => void;
    bossName?: string;
    bossImageUrl?: string;
}

/**
 * 🎮 SIMULATION TACTIQUE ISOMÉTRIQUE STYLE DOFUS / DOFENSIVE
 * Véritable damier en losanges isométriques avec coloration de portée temps réel.
 */
export function SpellRangeGrid({
    spells,
    activeSpellId,
    onSelectSpell,
    bossName = "Boss",
    bossImageUrl,
}: SpellRangeGridProps) {
    // Sort actif
    const currentSpell = useMemo(() => {
        if (!spells || spells.length === 0) return null;
        if (activeSpellId) {
            return spells.find((s) => s.id === activeSpellId) || spells[0];
        }
        return spells[0];
    }, [spells, activeSpellId]);

    // Dimensions du damier isométrique (17 x 17 pour un champ de vision large)
    const GRID_SIZE = 17;
    const CENTER = Math.floor(GRID_SIZE / 2); // 8

    // Position du lanceur (par défaut au centre 8, 8)
    const [casterPos, setCasterPos] = useState<{ x: number; y: number }>({ x: CENTER, y: CENTER });
    const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

    // Composition simulée : jusqu'à 4 alliés posés pour vérifier qui est touché par le sort actif.
    const [allies, setAllies] = useState<{ x: number; y: number; facing: number }[]>([]);
    const [bossFacing, setBossFacing] = useState(0);
    const [selectedAlly, setSelectedAlly] = useState<number | null>(null);
    const [placingAlly, setPlacingAlly] = useState(false);
    const MAX_ALLIES = 4;

    const handleCellClick = (x: number, y: number) => {
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

        // Aucun Féca sélectionné : on sélectionne un Féca, on pivote le boss ou on déplace le boss.
        const allyIdx = allies.findIndex((a) => a.x === x && a.y === y);
        if (allyIdx >= 0) {
            setSelectedAlly(allyIdx);
        } else if (x === casterPos.x && y === casterPos.y) {
            setBossFacing((f) => (f + 45) % 360);
        } else {
            setCasterPos({ x, y });
        }
    };

    // Zoom de la carte (boutons + molette).
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = zoomRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom((z) => Math.min(2.5, Math.max(0.5, z - e.deltaY * 0.002)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const minRange = currentSpell?.minRange ?? 0;
    const maxRange = currentSpell?.range ?? 0;
    const castInLine = currentSpell?.castInLine ?? false;
    const castInDiagonal = currentSpell?.castInDiagonal ?? false;
    const castTestLos = currentSpell?.castTestLos ?? true;

    // Calcul de portée Dofus (distance de Manhattan sur grille orthogonale pivotée)
    const isCellInRange = (x: number, y: number): boolean => {
        if (!currentSpell) return false;
        const dx = x - casterPos.x;
        const dy = y - casterPos.y;
        const distance = Math.abs(dx) + Math.abs(dy);

        // Mêlée (PO 0)
        if (distance === 0) return minRange === 0;

        // Hors des bornes de portée
        if (distance < minRange || distance > maxRange) return false;

        // Lancer en ligne uniquement (croix cardinale : dx === 0 ou dy === 0)
        if (castInLine && !castInDiagonal) {
            return dx === 0 || dy === 0;
        }

        // Lancer en diagonale uniquement (|dx| === |dy|)
        if (castInDiagonal && !castInLine) {
            return Math.abs(dx) === Math.abs(dy);
        }

        // Si à la fois ligne et diagonale (étoile à 8 branches)
        if (castInLine && castInDiagonal) {
            return dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
        }

        // Portée libre (cercle de Manhattan)
        return true;
    };

    // Nombre de cases couvertes
    const reachableCount = useMemo(() => {
        let count = 0;
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (isCellInRange(x, y)) count++;
            }
        }
        return count;
    }, [casterPos, currentSpell]);

    // Dimensions des tuiles SVG isométriques
    const tileWidth = 40;
    const tileHeight = 20;
    const DEPTH = 6; // Épaisseur 3D isométrique des tuiles (style Dofensive)
    const svgWidth = (GRID_SIZE + 1) * tileWidth;
    const svgHeight = (GRID_SIZE + 1) * tileHeight + 20 + DEPTH;
    const originX = svgWidth / 2;
    const originY = 20;

    return (
        <div className="space-y-4 rounded-3xl bg-zinc-950/90 border border-white/10 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
            {/* 1. Sélecteur de Sorts (Style Dofensive) */}
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2.5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Sorts du Boss
                </p>
                <div className="flex flex-wrap gap-2">
                    {spells.map((spell) => {
                        const isSelected = currentSpell?.id === spell.id;
                        return (
                            <button
                                key={spell.id}
                                type="button"
                                onClick={() => onSelectSpell?.(spell)}
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
                                <span>{spell.name}</span>
                                {spell.apCost !== undefined && spell.apCost > 0 && (
                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">
                                        {spell.apCost} PA
                                    </span>
                                )}
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
                            <span className="text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                                Portée : {minRange === maxRange ? `${maxRange} PO` : `${minRange} à ${maxRange} PO`}
                            </span>
                        </div>
                        {currentSpell.description && (
                            <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl font-medium">
                                {currentSpell.description}
                            </p>
                        )}
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

                        <button
                            type="button"
                            onClick={() => setCasterPos({ x: CENTER, y: CENTER })}
                            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 border border-white/10 px-2.5 py-1 rounded-lg transition-all ml-auto"
                        >
                            <RotateCcw className="w-3 h-3" /> Recentrer
                        </button>
                    </div>
                </div>
            )}

            {/* 3. SIMULATION ISOMÉTRIQUE INTERACTIVE (Style Dofensive / Dofus) */}
            <div className="relative rounded-2xl bg-[#161614] border border-white/10 p-2 sm:p-4 overflow-x-auto flex flex-col items-center justify-center select-none shadow-inner">
                <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2 px-2">
                    <span className="font-bold text-zinc-300">
                        Entité : <strong className="text-amber-400">{bossName}</strong>
                    </span>
                    <span className="text-zinc-500">
                        Carte : <strong className="text-zinc-400">Map Tactique Isométrique</strong> · {reachableCount} cases couvertes
                    </span>
                </div>

                <div className="w-full flex flex-wrap items-center gap-2 mb-2 px-2 relative z-10">
                    <div className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg p-0.5">
                        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="px-2 py-1 rounded-md text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all" title="Zoom arrière (Ctrl+molette)">−</button>
                        <span className="text-[10px] font-bold text-zinc-400 px-1 tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
                        <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} className="px-2 py-1 rounded-md text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all" title="Zoom avant">+</button>
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

                <div ref={zoomRef} className="flex justify-center relative z-0" style={{ zoom, transformOrigin: "top center" }}>
                <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="max-w-full h-auto drop-shadow-2xl"
                    style={{ minWidth: "380px", maxWidth: "680px" }}
                >
                    {/* Damier Isométrique Dofus */}
                    {Array.from({ length: GRID_SIZE }).map((_, rIdx) => {
                        return Array.from({ length: GRID_SIZE }).map((_, cIdx) => {
                            const x = cIdx;
                            const y = rIdx;

                            // Conversion grille orthogonale (x, y) vers coordonnées écran isométriques
                            const screenX = originX + (x - y) * (tileWidth / 2);
                            const screenY = originY + (x + y) * (tileHeight / 2);

                            const isCaster = x === casterPos.x && y === casterPos.y;
                            const isAllyCell = allies.some((a) => a.x === x && a.y === y);
                            const inRange = isCellInRange(x, y);
                            const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                            const isEven = (x + y) % 2 === 0;

                            // Définition du polygone losange
                            const points = `
                                ${screenX},${screenY}
                                ${screenX + tileWidth / 2},${screenY + tileHeight / 2}
                                ${screenX},${screenY + tileHeight}
                                ${screenX - tileWidth / 2},${screenY + tileHeight / 2}
                            `;

                            // Couleurs exactes Dofus / Dofensive
                            let fillColor = isEven ? "#635f52" : "#565246"; // Damier terre/roche
                            let strokeColor = "#3d3930";
                            let strokeWidth = 0.5;

                            if (inRange) {
                                fillColor = isEven ? "#79b638" : "#6ea830"; // Vert vif herbe de portée
                                strokeColor = "#8fd443";
                                strokeWidth = 0.8;
                            }

                            if (isCaster) {
                                fillColor = "#6b1d1d"; // Bordeaux lanceur
                                strokeColor = "#c53030";
                                strokeWidth = 1.5;
                            } else if (isAllyCell) {
                                // Case d'un joueur (Féca) : bleu équipe, rouge si touché par le sort actif.
                                fillColor = inRange ? "#a11c1c" : "#1e3a5f";
                                strokeColor = inRange ? "#ef4444" : "#3b82f6";
                                strokeWidth = 1.5;
                            }

                            if (isHovered && !isCaster && !isAllyCell) {
                                fillColor = inRange ? "#9ae44c" : "#7c7767";
                            }

                            // Face latérale de l'extrusion isométrique (plus sombre pour la profondeur)
                            let sideColor = inRange ? "#4c7a1f" : isCaster ? "#4a1212" : isAllyCell ? (inRange ? "#6f1010" : "#122a4a") : "#3a372e";

                            return (
                                <g key={`${x}-${y}`} className="cursor-pointer">
                                    {/* Extrusion 3D : face latérale sous la tuile */}
                                    <polygon
                                        points={`
                                            ${screenX - tileWidth / 2},${screenY + tileHeight / 2}
                                            ${screenX + tileWidth / 2},${screenY + tileHeight / 2}
                                            ${screenX + tileWidth / 2},${screenY + tileHeight / 2 + DEPTH}
                                            ${screenX - tileWidth / 2},${screenY + tileHeight / 2 + DEPTH}
                                        `}
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
                                    {/* Sprite ou Icône du Boss sur la case du lanceur */}
                                    {isCaster && (
                                        <g transform={`translate(${screenX - 20}, ${screenY - 22})`} pointerEvents="none">
                                            {bossImageUrl ? (
                                                <image
                                                    href={bossImageUrl}
                                                    x="0"
                                                    y="0"
                                                    width="40"
                                                    height="40"
                                                    className="drop-shadow-2xl"
                                                />
                                            ) : (
                                                <text
                                                    x="20"
                                                    y="26"
                                                    textAnchor="middle"
                                                    fontSize="22"
                                                    className="select-none"
                                                >
                                                    👑
                                                </text>
                                            )}
                                        </g>
                                    )}
                                    {/* Flèche d'orientation du boss */}
                                    {isCaster && (
                                        <g transform={`translate(${screenX}, ${screenY + 22}) rotate(${bossFacing})`} pointerEvents="none">
                                            <polygon points="0,-9 -5,5 5,5" fill="#fbbf24" opacity="0.95" />
                                        </g>
                                    )}

                                    {/* Alliés posés : sprite de classe posé comme le boss, case ciblée */}
                                    {allies.map((ally, ai) => {
                                        if (ally.x !== x || ally.y !== y) return null;
                                        const isSel = selectedAlly === ai;
                                        return (
                                            <g key={`ally-${ai}`} pointerEvents="none">
                                                {isSel && (<circle cx={screenX} cy={screenY + 10} r="20" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />)}
                                                <g transform={`translate(${screenX - 18}, ${screenY - 20})`}>
                                                    <image href="/assets/module-succes/feca.webp" x="0" y="0" width="36" height="36" className="drop-shadow-2xl" />
                                                </g>
                                                {/* Flèche d'orientation (comme le boss) */}
                                                <g transform={`translate(${screenX}, ${screenY + 20}) rotate(${ally.facing})`}>
                                                    <polygon points="0,-8 -4,4 4,4" fill="#ffffff" opacity="0.9" />
                                                </g>
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        });
                    })}
                </svg>
                </div>

                {/* Légende */}
                <div className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 px-2 text-[10px] font-bold text-zinc-400">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#6b1d1d", border: "1px solid #c53030" }} /> Boss</span>
                    <span className="inline-flex items-center gap-1.5"><img src="/assets/module-succes/feca.webp" alt="" className="w-4 h-4 object-contain rounded-[3px]" /> Joueur (allié)</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#79b638" }} /> Dans la portée du sort</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#1e3a5f", border: "1px solid #3b82f6" }} /> Allié hors de portée</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: "#a11c1c", border: "1px solid #ef4444" }} /> Allié touché par le sort</span>
                </div>

                <p className="text-[11px] text-zinc-400 mt-2 text-center">
                    💡 Cliquez sur un losange pour déplacer le Boss (re-cliquez sur lui pour le faire pivoter). Cliquez un Féca pour le sélectionner, une case pour le déplacer, re-cliquez pour l'orienter. « Alliés » : pose/retire des joueurs.
                </p>
            </div>
        </div>
    );
}
