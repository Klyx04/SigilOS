"use client";

import React, { useState } from "react";
import { Lightbulb, RotateCcw, Play, Shuffle, CheckCircle2, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

const GRID_SIZE = 4;

export function LuminariumSolver() {
    const { t } = useI18n();
    const l10n = t.raidStudio.luminarium;

    const [mode, setMode] = useState<"solveur" | "entrainement">("solveur");
    const [grid, setGrid] = useState<number[][]>(() =>
        Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
    );
    const [solutionSteps, setSolutionSteps] = useState<Record<string, number>>({});
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
    const [trainingMoves, setTrainingMoves] = useState(0);

    // Bascule l'état d'une case et de ses 4 voisins (règle Lights Out Dofus)
    const toggleCellAndNeighbors = (matrix: number[][], x: number, y: number): number[][] => {
        const next = matrix.map((row) => [...row]);
        const deltas = [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];
        for (const [dx, dy] of deltas) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                next[ny][nx] ^= 1;
            }
        }
        return next;
    };

    const isAllLit = (matrix: number[][]) => matrix.flat().every((val) => val === 1);

    // Clic sur une case de la grille
    const handleCellClick = (x: number, y: number) => {
        if (mode === "entrainement") {
            const newGrid = toggleCellAndNeighbors(grid, x, y);
            const moves = trainingMoves + 1;
            setGrid(newGrid);
            setTrainingMoves(moves);
            if (isAllLit(newGrid)) {
                setStatusMessage({
                    type: "success",
                    text: l10n.trainingWin.replace("{count}", moves.toString()),
                });
            } else {
                setStatusMessage(null);
            }
        } else {
            // Mode solveur : on active/désactive directement la lanterne pour refléter le jeu
            const next = grid.map((row) => [...row]);
            next[y][x] ^= 1;
            setGrid(next);
            setSolutionSteps({});
            setStatusMessage(null);
        }
    };

    // Résolution exacte par recherche de masque binaire (2^16 = 65 536 états)
    const solveLuminarium = () => {
        let bestMoves: [number, number][] | null = null;

        for (let mask = 0; mask < 65536; mask++) {
            let sim = grid.map((r) => [...r]);
            const currentMoves: [number, number][] = [];

            for (let i = 0; i < 16; i++) {
                if (mask & (1 << i)) {
                    const x = i % 4;
                    const y = Math.floor(i / 4);
                    sim = toggleCellAndNeighbors(sim, x, y);
                    currentMoves.push([x, y]);
                }
            }

            if (isAllLit(sim)) {
                if (!bestMoves || currentMoves.length < bestMoves.length) {
                    bestMoves = currentMoves;
                }
            }
        }

        if (bestMoves) {
            const stepsMap: Record<string, number> = {};
            bestMoves.forEach(([x, y], idx) => {
                stepsMap[`${x}-${y}`] = idx + 1;
            });
            setSolutionSteps(stepsMap);
            setStatusMessage({
                type: "success",
                text: l10n.solvedInMoves.replace("{count}", bestMoves.length.toString()),
            });
        } else {
            setSolutionSteps({});
            setStatusMessage({
                type: "error",
                text: l10n.noSolution,
            });
        }
    };

    const resetGrid = () => {
        setGrid(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0)));
        setSolutionSteps({});
        setStatusMessage(null);
        setTrainingMoves(0);
    };

    const shuffleTraining = () => {
        let matrix: number[][];
        do {
            matrix = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1));
            const randomMoves = 4 + Math.floor(Math.random() * 5);
            const applied = new Set<string>();
            let count = 0;
            while (count < randomMoves) {
                const rx = Math.floor(Math.random() * GRID_SIZE);
                const ry = Math.floor(Math.random() * GRID_SIZE);
                const key = `${rx}-${ry}`;
                if (applied.has(key)) continue;
                applied.add(key);
                matrix = toggleCellAndNeighbors(matrix, rx, ry);
                count++;
            }
        } while (isAllLit(matrix));

        setGrid(matrix);
        setSolutionSteps({});
        setTrainingMoves(0);
        setStatusMessage(null);
    };

    return (
        <div className="rounded-xl border border-border bg-surface/60 p-5 md:p-6 backdrop-blur-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-warning" />
                        <span>{l10n.title}</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        {l10n.desc}
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-background/80 p-1 rounded-lg border border-border shrink-0 self-start sm:self-auto">
                    <button
                        onClick={() => {
                            setMode("solveur");
                            resetGrid();
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            mode === "solveur"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.modeSolveur}
                    </button>
                    <button
                        onClick={() => {
                            setMode("entrainement");
                            shuffleTraining();
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            mode === "entrainement"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.modeEntrainement}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Grille 4x4 interactive */}
                <div className="md:col-span-6 flex flex-col items-center justify-center p-4 bg-background/40 rounded-xl border border-border">
                    <div className="grid grid-cols-4 gap-2.5 sm:gap-3 p-2">
                        {grid.map((row, y) =>
                            row.map((cellState, x) => {
                                const stepNumber = solutionSteps[`${x}-${y}`];
                                const isLit = cellState === 1;

                                return (
                                    <button
                                        key={`${x}-${y}`}
                                        onClick={() => handleCellClick(x, y)}
                                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 select-none ${
                                            isLit
                                                ? "bg-amber-500/20 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-300"
                                                : "bg-surface/90 border-border/70 hover:border-border-strong text-muted-foreground/60"
                                        }`}
                                        title={`Poisson (${x + 1}, ${y + 1}) — ${isLit ? "Allumé" : "Éteint"}`}
                                    >
                                        {/* Picto Poisson Lanterne SVG Natif */}
                                        <svg
                                            className={`w-7 h-7 transition-transform ${isLit ? "scale-110 drop-shadow" : "opacity-40"}`}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M6.5 12c.94-2.07 2.94-3.5 5.5-3.5 3.31 0 6 2.69 6 6 0 1.25-.38 2.41-1.03 3.37L20 20" />
                                            <path d="M12 8.5V4m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1 4 0" />
                                            <circle cx="10" cy="13" r="1" fill="currentColor" />
                                            <path d="M2 13s2-2 4.5-2" />
                                            <path d="M2 17s2 2 4.5 2" />
                                        </svg>

                                        {/* Badge Étape Solution */}
                                        {stepNumber !== undefined && (
                                            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent text-accent-foreground font-mono text-xs font-black flex items-center justify-center shadow-md animate-in zoom-in-75">
                                                {stepNumber}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <p className="mt-3 text-[11px] font-mono text-muted-foreground text-center">
                        {mode === "solveur"
                            ? "Cliquez pour allumer/éteindre comme dans votre salle -3"
                            : `Coups joués : ${trainingMoves}`}
                    </p>
                </div>

                {/* Panneau de contrôle & Notice */}
                <div className="md:col-span-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {mode === "solveur" ? (
                            <button
                                onClick={solveLuminarium}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-xs shadow-md hover:bg-accent/90 transition-all"
                            >
                                <Play className="w-4 h-4" />
                                <span>{l10n.resolveBtn}</span>
                            </button>
                        ) : (
                            <button
                                onClick={shuffleTraining}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-xs shadow-md hover:bg-accent/90 transition-all"
                            >
                                <Shuffle className="w-4 h-4" />
                                <span>{l10n.shuffleBtn}</span>
                            </button>
                        )}

                        <button
                            onClick={resetGrid}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-xs text-foreground transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{l10n.resetBtn}</span>
                        </button>
                    </div>

                    {/* Retour de statut */}
                    {statusMessage && (
                        <div
                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in-50 ${
                                statusMessage.type === "success"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : statusMessage.type === "error"
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                      : "bg-surface border-border text-muted-foreground"
                            }`}
                        >
                            {statusMessage.type === "success" ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            )}
                            <div className="font-medium leading-relaxed">{statusMessage.text}</div>
                        </div>
                    )}

                    {/* Explications & Règles */}
                    <div className="rounded-lg border border-border/80 bg-background/50 p-4 text-xs space-y-2 text-muted-foreground leading-relaxed">
                        <div className="font-bold text-foreground">
                            {mode === "solveur" ? "Comment utiliser le solveur :" : "Objectif de l'entraînement :"}
                        </div>
                        {mode === "solveur" ? (
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Allumez les cases dorées correspondant aux poissons allumés en jeu.</li>
                                <li>Cliquez sur <strong>« Résoudre l'énigme »</strong>.</li>
                                <li>Suivez les pastilles numérotées dans l'ordre exact pour ouvrir la grille.</li>
                            </ol>
                        ) : (
                            <ul className="list-disc list-inside space-y-1">
                                <li>Cliquez sur une case pour l'inverser avec ses voisins en croix.</li>
                                <li>Le but est d'allumer l'ensemble des 16 poissons avec le moins de coups possible.</li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
