"use client";

import React, { useState } from "react";
import { Compass, Sparkles, Ship, Grid3X3, Check, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type {
    BelladoneState,
    BelladoneItemKey,
    StatueColorKey,
    StatueSpriteKey,
} from "../types";

const COLS_ECHECS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const ROWS_ECHECS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

const BELLADONE_ITEMS: { key: BelladoneItemKey; label: string; symbol: string }[] = [
    { key: "crayon", label: "Crayons", symbol: "✏️" },
    { key: "bobine", label: "Bobine", symbol: "🧵" },
    { key: "lanterne", label: "Lanterne", symbol: "🏮" },
    { key: "kamas", label: "Kamas", symbol: "🪙" },
    { key: "arakne", label: "Arakne", symbol: "🕷️" },
    { key: "bougie", label: "Bougie", symbol: "🕯️" },
    { key: "bague", label: "Bague", symbol: "💍" },
    { key: "regle", label: "Règle", symbol: "📏" },
];

const STATUES_TRUTH_TABLE: Record<string, { pos: string; arrow: string }> = {
    orange_fracamelia: { pos: "[11, 19]", arrow: "▲ Nord" },
    orange_tritulipe: { pos: "[10, 20]", arrow: "◀ Ouest" },
    orange_muguegide: { pos: "[12, 20]", arrow: "▶ Est" },
    orange_dahliane: { pos: "[11, 21]", arrow: "▼ Sud" },
    bleu_fracamelia: { pos: "[11, 21]", arrow: "▼ Sud" },
    bleu_tritulipe: { pos: "[12, 20]", arrow: "▶ Est" },
    bleu_muguegide: { pos: "[10, 20]", arrow: "◀ Ouest" },
    bleu_dahliane: { pos: "[11, 19]", arrow: "▲ Nord" },
    rouge_fracamelia: { pos: "[12, 20]", arrow: "▶ Est" },
    rouge_tritulipe: { pos: "[11, 19]", arrow: "▲ Nord" },
    rouge_muguegide: { pos: "[11, 21]", arrow: "▼ Sud" },
    rouge_dahliane: { pos: "[10, 20]", arrow: "◀ Ouest" },
    vert_fracamelia: { pos: "[10, 20]", arrow: "◀ Ouest" },
    vert_tritulipe: { pos: "[11, 21]", arrow: "▼ Sud" },
    vert_muguegide: { pos: "[11, 19]", arrow: "▲ Nord" },
    vert_dahliane: { pos: "[12, 20]", arrow: "▶ Est" },
};

export function JardinsEnigmaTracker() {
    const { t } = useI18n();
    const l10n = t.raidStudio.enigmes;

    const [activeSubTab, setActiveSubTab] = useState<"echecs" | "objets" | "bateaux" | "statues">("statues");

    // 1. Échecs State
    const [echecs, setEchecs] = useState<{
        tourBlanche: string;
        tourNoire: string;
        fouBlanc: string;
        fouNoir: string;
    }>({
        tourBlanche: "",
        tourNoire: "",
        fouBlanc: "",
        fouNoir: "",
    });

    // 2. Belladone State
    const [belladone, setBelladone] = useState<BelladoneState>({
        I: { items: [null, null], hasFlower: false },
        II: { items: [null, null], hasFlower: false },
        III: { items: [null, null], hasFlower: false },
        IV: { items: [null, null], hasFlower: false },
    });

    // 3. Bataille Navale State
    const [boats, setBoats] = useState<Record<string, boolean>>({});

    // 4. Statues State
    const [activeColor, setActiveColor] = useState<StatueColorKey>("orange");
    const [activeStatue, setActiveStatue] = useState<StatueSpriteKey>("fracamelia");

    const toggleBoat = (mapId: string, coord: string) => {
        const key = `${mapId}-${coord}`;
        const currentInMap = Object.keys(boats).filter((k) => k.startsWith(`${mapId}-`) && boats[k]).length;
        if (!boats[key] && currentInMap >= 3) return; // Max 3 par carte
        setBoats((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const currentStatueResult = STATUES_TRUTH_TABLE[`${activeColor}_${activeStatue}`];

    return (
        <div className="rounded-xl border border-border bg-surface/60 p-5 md:p-6 backdrop-blur-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Compass className="w-5 h-5 text-accent" />
                        <span>{l10n.title}</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        {l10n.desc}
                    </p>
                </div>

                {/* Onglets des 4 énigmes */}
                <div className="flex flex-wrap items-center gap-1 bg-background/80 p-1 rounded-lg border border-border shrink-0">
                    <button
                        onClick={() => setActiveSubTab("statues")}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeSubTab === "statues"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.tabs.statues}
                    </button>
                    <button
                        onClick={() => setActiveSubTab("echecs")}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeSubTab === "echecs"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.tabs.echecs}
                    </button>
                    <button
                        onClick={() => setActiveSubTab("objets")}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeSubTab === "objets"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.tabs.objets}
                    </button>
                    <button
                        onClick={() => setActiveSubTab("bateaux")}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeSubTab === "bateaux"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {l10n.tabs.bateaux}
                    </button>
                </div>
            </div>

            {/* 1. Énigme des Statues & Stèles */}
            {activeSubTab === "statues" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-7 space-y-4">
                        <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {l10n.chooseColor}
                            </span>
                            <div className="grid grid-cols-4 gap-2.5 mt-2">
                                {(
                                    [
                                        { key: "orange", label: "Orange", hex: "#f97316" },
                                        { key: "bleu", label: "Bleu", hex: "#38bdf8" },
                                        { key: "rouge", label: "Rouge", hex: "#f43f5e" },
                                        { key: "vert", label: "Vert", hex: "#10b981" },
                                    ] as const
                                ).map((col) => (
                                    <button
                                        key={col.key}
                                        onClick={() => setActiveColor(col.key)}
                                        className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                            activeColor === col.key
                                                ? "ring-2 ring-foreground/40 border-transparent shadow-md"
                                                : "bg-surface border-border opacity-70 hover:opacity-100"
                                        }`}
                                        style={{ backgroundColor: `${col.hex}22`, color: col.hex }}
                                    >
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.hex }} />
                                        <span>{col.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {l10n.chooseStatue}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                                {(
                                    [
                                        { key: "fracamelia", label: "Fracamélia", icon: "🌸" },
                                        { key: "tritulipe", label: "Tritulipe", icon: "🌷" },
                                        { key: "muguegide", label: "Muguégide", icon: "🔔" },
                                        { key: "dahliane", label: "Dahliane", icon: "🌺" },
                                    ] as const
                                ).map((st) => (
                                    <button
                                        key={st.key}
                                        onClick={() => setActiveStatue(st.key)}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-semibold ${
                                            activeStatue === st.key
                                                ? "bg-accent/20 border-accent text-accent-foreground shadow-sm"
                                                : "bg-surface/50 border-border hover:border-border-strong text-muted-foreground"
                                        }`}
                                    >
                                        <span className="text-2xl">{st.icon}</span>
                                        <span>{st.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Résultat Calculé Coordonnées & Flèche */}
                    <div className="md:col-span-5 p-5 rounded-xl border border-accent/30 bg-accent/5 flex flex-col items-center justify-center text-center space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent">
                            {l10n.computedPosition}
                        </span>
                        {currentStatueResult ? (
                            <div className="space-y-1">
                                <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                                    {currentStatueResult.pos}
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/20 text-accent font-bold text-xs">
                                    <span>Orientation :</span>
                                    <span>{currentStatueResult.arrow}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground">Sélectionnez pour calculer</span>
                        )}
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                            Positionnez votre personnage sur la stèle indiquée et orientez-vous dans la direction de la flèche pour valider.
                        </p>
                    </div>
                </div>
            )}

            {/* 2. Énigme des Échecs (Ouvrage Monochrome) */}
            {activeSubTab === "echecs" && (
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">{l10n.echecsDesc}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { key: "tourBlanche", label: "Tour Blanche", icon: "♖" },
                            { key: "tourNoire", label: "Tour Noire", icon: "♜" },
                            { key: "fouBlanc", label: "Fou Blanc", icon: "♗" },
                            { key: "fouNoir", label: "Fou Noir", icon: "♝" },
                        ].map((piece) => (
                            <div key={piece.key} className="p-3 rounded-xl border border-border bg-background/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <span className="text-lg">{piece.icon}</span>
                                        <span>{piece.label}</span>
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={echecs[piece.key as keyof typeof echecs]?.charAt(0) || ""}
                                        onChange={(e) => {
                                            const col = e.target.value;
                                            const row = echecs[piece.key as keyof typeof echecs]?.slice(1) || "1";
                                            setEchecs((prev) => ({ ...prev, [piece.key]: col ? `${col}${row}` : "" }));
                                        }}
                                        className="w-1/2 p-2 rounded-lg border border-border bg-surface text-xs font-mono font-bold text-foreground"
                                    >
                                        <option value="">Col...</option>
                                        {COLS_ECHECS.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={echecs[piece.key as keyof typeof echecs]?.slice(1) || ""}
                                        onChange={(e) => {
                                            const row = e.target.value;
                                            const col = echecs[piece.key as keyof typeof echecs]?.charAt(0) || "A";
                                            setEchecs((prev) => ({ ...prev, [piece.key]: row ? `${col}${row}` : "" }));
                                        }}
                                        className="w-1/2 p-2 rounded-lg border border-border bg-surface text-xs font-mono font-bold text-foreground"
                                    >
                                        <option value="">Lig...</option>
                                        {ROWS_ECHECS.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Énigme des Objets (Réserve de Belladone) */}
            {activeSubTab === "objets" && (
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">{l10n.objetsDesc}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(["I", "II", "III", "IV"] as const).map((roman) => (
                            <div key={roman} className="p-3.5 rounded-xl border border-border bg-background/50 space-y-3">
                                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                    <span className="font-mono text-sm font-black text-foreground">Stèle {roman}</span>
                                    <button
                                        onClick={() =>
                                            setBelladone((prev) => ({
                                                ...prev,
                                                [roman]: { ...prev[roman], hasFlower: !prev[roman].hasFlower },
                                            }))
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                            belladone[roman].hasFlower
                                                ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                                                : "bg-surface border-border text-muted-foreground"
                                        }`}
                                    >
                                        <span>🌸 Fleur</span>
                                        {belladone[roman].hasFlower && <Check className="w-3 h-3" />}
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {[0, 1].map((idx) => (
                                        <select
                                            key={idx}
                                            value={belladone[roman].items[idx] || ""}
                                            onChange={(e) => {
                                                const val = (e.target.value as BelladoneItemKey) || null;
                                                const nextItems = [...belladone[roman].items];
                                                nextItems[idx] = val;
                                                setBelladone((prev) => ({
                                                    ...prev,
                                                    [roman]: { ...prev[roman], items: nextItems },
                                                }));
                                            }}
                                            className="w-full p-2 rounded-lg border border-border bg-surface text-xs text-foreground"
                                        >
                                            <option value="">Objet {idx + 1}...</option>
                                            {BELLADONE_ITEMS.map((item) => (
                                                <option key={item.key} value={item.key}>
                                                    {item.symbol} {item.label}
                                                </option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Bataille Navale (Cour d'Éphèdre) */}
            {activeSubTab === "bateaux" && (
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">{l10n.bateauxDesc}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { id: "map1", label: "Map [19, 15]" },
                            { id: "map2", label: "Map [21, 17]" },
                        ].map((m) => {
                            const mapBoatsCount = ["A", "B", "C", "D"].reduce(
                                (acc, c) =>
                                    acc +
                                    ["1", "2", "3"].reduce((sub, r) => sub + (boats[`${m.id}-${c}${r}`] ? 1 : 0), 0),
                                0
                            );

                            return (
                                <div key={m.id} className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Ship className="w-4 h-4 text-accent" />
                                            <span>{m.label}</span>
                                        </span>
                                        <span className={`text-xs font-mono font-bold ${mapBoatsCount === 3 ? "text-emerald-400" : "text-muted-foreground"}`}>
                                            {mapBoatsCount} / 3 bateaux
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2">
                                        {["A", "B", "C", "D"].map((col) => (
                                            <div key={col} className="space-y-2">
                                                <div className="text-center font-mono text-[11px] font-bold text-muted-foreground">
                                                    {col}
                                                </div>
                                                {["1", "2", "3"].map((row) => {
                                                    const key = `${m.id}-${col}${row}`;
                                                    const isBoat = !!boats[key];
                                                    return (
                                                        <button
                                                            key={key}
                                                            onClick={() => toggleBoat(m.id, `${col}${row}`)}
                                                            className={`w-full h-10 rounded-lg border flex items-center justify-center font-mono text-xs font-bold transition-all ${
                                                                isBoat
                                                                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                                                                    : "bg-surface border-border hover:border-border-strong text-muted-foreground"
                                                            }`}
                                                        >
                                                            {isBoat ? "⛵" : `${col}${row}`}
                                                        </button>
                                                    );
                                                })}
                                            </div>
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
