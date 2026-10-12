"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
    Calculator, 
    Sparkles, 
    Clock, 
    ShieldAlert, 
    Coins, 
    GitBranch, 
    BookOpen, 
    CheckCircle2, 
    HelpCircle,
    ArrowRight,
    Flame,
    Search,
    Filter,
    GitMerge,
    Info
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { MOUNT_DATABASE, MountInfo, StatTag } from "@/data/mount-data";

type MountFamily = "dragodinde" | "muldo" | "volkorne";
type ActiveTab = "croisements" | "serenite" | "xp" | "arbres";
type CatalystTier = 1 | 2 | 3 | 4;

const FAMILY_CONFIG: Record<MountFamily, { name: string; maxGen: number; icon: string; bonus: string }> = {
    dragodinde: {
        name: "Dragodindes",
        maxGen: 10,
        icon: "/images/guides/elevage/dragodindes.png",
        bonus: "Vitalité (jusqu'à 400), Puissance & Caractéristiques",
    },
    muldo: {
        name: "Muldos",
        maxGen: 10,
        icon: "/images/guides/elevage/muldos.png",
        bonus: "+1 PM garanti (lvl 100+), Résistances % & Stats",
    },
    volkorne: {
        name: "Volkornes",
        maxGen: 10,
        icon: "/images/guides/elevage/volkornes.png",
        bonus: "+1 PA garanti (lvl 100+), Coups Critiques & Stats",
    },
};

const GENETON_TABLE: Record<number, number> = {
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 15,
    6: 30,
    7: 60,
    8: 120,
    9: 250,
    10: 500,
};

const XP_TIERS: Record<CatalystTier, { name: string; xpPer10s: number; item: string; img: string }> = {
    1: { name: "Tier 1", xpPer10s: 10, item: "Extrait de Mangeoire", img: "/images/guides/elevage/carburant_extrait.png" },
    2: { name: "Tier 2", xpPer10s: 20, item: "Philtre de Mangeoire", img: "/images/guides/elevage/carburant_philtre.png" },
    3: { name: "Tier 3", xpPer10s: 30, item: "Potion de Mangeoire", img: "/images/guides/elevage/carburant_potion.png" },
    4: { name: "Tier 4", xpPer10s: 40, item: "Élixir de Mangeoire", img: "/images/guides/elevage/carburant_elixir.png" },
};

export function ElevageStudioClient() {
    const { t, locale } = useI18n();
    const l10n = t.elevageStudio;

    const [activeTab, setActiveTab] = useState<ActiveTab>("croisements");
    const [selectedFamily, setSelectedFamily] = useState<MountFamily>("dragodinde");

    // Calculateur de croisement
    const [parent1Lvl, setParent1Lvl] = useState<number>(100);
    const [parent2Lvl, setParent2Lvl] = useState<number>(100);
    const [useOptimakina, setUseOptimakina] = useState<boolean>(true);
    const [useTakeza, setUseTakeza] = useState<boolean>(false);
    const [useAnimakina, setUseAnimakina] = useState<boolean>(false);
    const [selectedSex, setSelectedSex] = useState<"male" | "female">("female");

    // Simulateur de Sérénité
    const [currentSerenity, setCurrentSerenity] = useState<number>(-1500);
    const [targetZone, setTargetZone] = useState<"endurance" | "maturite" | "amour">("maturite");
    const [catalystTier, setCatalystTier] = useState<CatalystTier>(2);

    // Calculateur XP & Génétons
    const [startLvl, setStartLvl] = useState<number>(1);
    const [targetLvl, setTargetLvl] = useState<number>(200);
    const [hasSage, setHasSage] = useState<boolean>(false);
    const [selectedGen, setSelectedGen] = useState<number>(10);

    // Onglet Arbres & Matrice de croisement
    const [mountSearch, setMountSearch] = useState<string>("");
    const [selectedGenFilter, setSelectedGenFilter] = useState<number | "all">("all");
    const [selectedStatTag, setSelectedStatTag] = useState<StatTag | "all">("all");
    const [matrixParent1, setMatrixParent1] = useState<string>("Dragodinde Amande");
    const [matrixParent2, setMatrixParent2] = useState<string>("Dragodinde Rousse");

    // Données des montures pour l'espèce sélectionnée
    const familyMounts = MOUNT_DATABASE.filter(m => m.family === selectedFamily);

    // Changement d'espèce : on recale aussi les parents du simulateur (sinon
    // ils pointent vers l'ancienne espèce : select vide + résultat incohérent).
    const handleFamilyChange = (famKey: MountFamily) => {
        setSelectedFamily(famKey);
        const next = MOUNT_DATABASE.filter((m) => m.family === famKey);
        setMatrixParent1(next[0]?.name ?? "");
        setMatrixParent2(next[1]?.name ?? next[0]?.name ?? "");
    };

    // Recherche insensible aux accents (« émeraude » trouve « Emeraude » et inversement).
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Filtrage du catalogue
    const filteredMounts = familyMounts.filter(mount => {
        if (selectedGenFilter !== "all" && mount.generation !== selectedGenFilter) {
            return false;
        }
        if (selectedStatTag !== "all" && !mount.statTags.includes(selectedStatTag)) {
            return false;
        }
        if (mountSearch.trim()) {
            const query = norm(mountSearch);
            const matchName = norm(mount.name).includes(query);
            const matchStats = norm(mount.stats).includes(query);
            return matchName || matchStats;
        }
        return true;
    });

    // Données des parents pour le simulateur de croisement direct
    const parent1Info = familyMounts.find(m => m.name === matrixParent1) || familyMounts[0] || MOUNT_DATABASE[0];
    const parent2Info = familyMounts.find(m => m.name === matrixParent2) || familyMounts[1] || familyMounts[0] || MOUNT_DATABASE[0];

    // Recherche d'une éventuelle mutation connue issue de ces deux parents
    const potentialMutation = familyMounts.find(m => {
        if (!m.parents) return false;
        const [pA, pB] = m.parents;
        return (pA === parent1Info.name && pB === parent2Info.name) ||
               (pB === parent1Info.name && pA === parent2Info.name);
    });

    const isSameBreed = parent1Info.name === parent2Info.name;

    // Formule probabilité génération cible (MàJ 3.7)
    // Base 30% + (lvl1 * 0.15%) + (lvl2 * 0.15%) + Optimakina (+20%) + Takeza (+20%)
    const baseChance = 30;
    const parent1Bonus = parent1Lvl * 0.15;
    const parent2Bonus = parent2Lvl * 0.15;
    const optiBonus = useOptimakina ? 20 : 0;
    const takezaBonus = useTakeza ? 20 : 0;
    const rawTotalChance = baseChance + parent1Bonus + parent2Bonus + optiBonus + takezaBonus;
    const totalChance = Math.min(100, Math.round(rawTotalChance * 10) / 10);

    // Calcul du niveau moyen requis pour 100% avec les bonus actifs
    const neededFromParents = Math.max(0, 100 - baseChance - optiBonus - takezaBonus);
    const totalLevelsNeeded = Math.ceil(neededFromParents / 0.15);
    const avgLevelNeeded = Math.ceil(totalLevelsNeeded / 2);

    // Calcul Sérénité & temps estimé
    // Vitesse de déplacement sérénité :
    // Tier 1: 10 pts/10s, Tier 2: 20 pts/10s, Tier 3: 30 pts/10s, Tier 4: 40 pts/10s
    // (Note: en 3.7, l'effet est doublé = 20, 40, 60, 80 pts/10s)
    const serenitySpeedPer10s = catalystTier * 20; // 3.7 boosted
    let targetRangeDesc = "";
    let distanceToRange = 0;
    let actionDevice = "";

    if (targetZone === "endurance") {
        targetRangeDesc = "Zone Négative (< 0) — Smiley Bleu :( ou Rouge :C";
        actionDevice = "Baffeur (-) pour baisser la sérénité";
        if (currentSerenity >= 0) distanceToRange = currentSerenity + 1;
    } else if (targetZone === "maturite") {
        targetRangeDesc = "Zone Neutre (-2000 à +2000) — Smiley Bleu :( ou Violet :)";
        actionDevice = currentSerenity < -2000 ? "Caresseur (+) pour monter" : "Baffeur (-) pour descendre";
        if (currentSerenity < -2000) distanceToRange = -2000 - currentSerenity;
        else if (currentSerenity > 2000) distanceToRange = currentSerenity - 2000;
    } else {
        targetRangeDesc = "Zone Positive (> 0) — Smiley Violet :) ou Vert :D";
        actionDevice = "Caresseur (+) pour monter la sérénité";
        if (currentSerenity <= 0) distanceToRange = 1 - currentSerenity;
    }

    const secondsToTarget = (distanceToRange / serenitySpeedPer10s) * 10;
    const minutesToTarget = Math.round(secondsToTarget / 60);

    // Calcul XP Monture (1 à 200 = 867 582 XP)
    // Au niveau 100: 172 668 XP
    const TOTAL_XP_200 = 867582;
    const TOTAL_XP_100 = 172668;
    const calcXPNeeded = (start: number, target: number) => {
        if (target <= start) return 0;
        const xpRatio = (target / 200) ** 2.2;
        const startRatio = (start / 200) ** 2.2;
        return Math.round((xpRatio - startRatio) * TOTAL_XP_200);
    };

    const xpNeeded = calcXPNeeded(startLvl, targetLvl);
    const xpPer10s = XP_TIERS[catalystTier].xpPer10s * (hasSage ? 2 : 1);
    const xpSeconds = Math.ceil(xpNeeded / xpPer10s) * 10;
    const xpHours = Math.round((xpSeconds / 3600) * 10) / 10;

    return (
        <div className="space-y-8">
            {/* ── BANNIÈRE HERO COCKPIT ────────────────────────────────────────── */}
            <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border text-xs font-medium text-muted-foreground">
                            <Sparkles className="w-3.5 h-3.5 text-foreground/70" />
                            <span>{l10n.heroTag}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {l10n.heroTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            {l10n.heroSubtitle}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/guides/guide-elevage-enclos-guilde-dofus"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-elevated text-xs font-medium text-foreground transition-colors"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{l10n.guideLinkText}</span>
                        </Link>
                    </div>
                </div>

                {/* Sélecteur d'espèce */}
                <div className="mt-6 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(Object.keys(FAMILY_CONFIG) as MountFamily[]).map((famKey) => {
                        const fam = FAMILY_CONFIG[famKey];
                        const isSelected = selectedFamily === famKey;
                        return (
                            <button
                                key={famKey}
                                type="button"
                                onClick={() => handleFamilyChange(famKey)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                                    isSelected
                                        ? "border-primary/50 bg-primary/5 text-foreground font-semibold"
                                        : "border-border bg-surface/40 hover:bg-surface text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <div className="relative w-11 h-11 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center">
                                    <Image
                                        src={fam.icon}
                                        alt={fam.name}
                                        width={36}
                                        height={36}
                                        className="object-contain"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <strong className="text-xs font-semibold block truncate text-foreground">{fam.name}</strong>
                                    <span className="text-[11px] text-muted-foreground block truncate">{fam.bonus}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── ONGLETS PRINCIPAUX ────────────────────────────────────────── */}
            <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px">
                <button
                    type="button"
                    onClick={() => setActiveTab("croisements")}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === "croisements"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Calculator className="w-4 h-4" />
                    <span>{l10n.tabs.croisements}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("serenite")}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === "serenite"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    <span>{l10n.tabs.serenite}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("xp")}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === "xp"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Coins className="w-4 h-4" />
                    <span>{l10n.tabs.xp}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("arbres")}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === "arbres"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <GitBranch className="w-4 h-4" />
                    <span>{l10n.tabs.arbres}</span>
                </button>
            </div>

            {/* ── ONGLET 1 : CALCULATEUR DE CROISEMENT ───────────────────────── */}
            {activeTab === "croisements" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Colonne Gauche : Configuration des Parents */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-foreground/70" />
                                <span>Paramètres d'Accouplement & Niveaux</span>
                            </h2>

                            {/* Parent 1 (Mâle) */}
                            <div className="space-y-3 p-4 rounded-xl bg-surface/50 border border-border">
                                <div className="flex items-center justify-between text-xs">
                                    <strong className="text-foreground flex items-center gap-2">
                                        <span className="text-cyan-400 font-bold">♂</span>
                                        {l10n.parentsSection.parent1}
                                    </strong>
                                    <span className="font-mono text-foreground font-semibold">Niveau {parent1Lvl} (+{(parent1Lvl * 0.15).toFixed(1)}%)</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="200"
                                    value={parent1Lvl}
                                    onChange={(e) => setParent1Lvl(parseInt(e.target.value, 10))}
                                    className="w-full accent-foreground"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                    <span>Lvl 1 (+0.15%)</span>
                                    <span>Lvl 100 (+15%)</span>
                                    <span>Lvl 167 (+25%)</span>
                                    <span>Lvl 200 (+30%)</span>
                                </div>
                            </div>

                            {/* Parent 2 (Femelle) */}
                            <div className="space-y-3 p-4 rounded-xl bg-surface/50 border border-border">
                                <div className="flex items-center justify-between text-xs">
                                    <strong className="text-foreground flex items-center gap-2">
                                        <span className="text-rose-400 font-bold">♀</span>
                                        {l10n.parentsSection.parent2}
                                    </strong>
                                    <span className="font-mono text-foreground font-semibold">Niveau {parent2Lvl} (+{(parent2Lvl * 0.15).toFixed(1)}%)</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="200"
                                    value={parent2Lvl}
                                    onChange={(e) => setParent2Lvl(parseInt(e.target.value, 10))}
                                    className="w-full accent-foreground"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                    <span>Lvl 1 (+0.15%)</span>
                                    <span>Lvl 100 (+15%)</span>
                                    <span>Lvl 167 (+25%)</span>
                                    <span>Lvl 200 (+30%)</span>
                                </div>
                            </div>

                            {/* Catalyseurs & Makinas 3.7 */}
                            <div className="space-y-3 pt-4 border-t border-border">
                                <strong className="text-xs font-semibold text-foreground block">Catalyseurs & Bonus Spéciaux (3.7) :</strong>

                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer hover:bg-surface transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={useOptimakina}
                                        onChange={(e) => setUseOptimakina(e.target.checked)}
                                        className="mt-0.5 rounded text-foreground focus:ring-foreground w-4 h-4"
                                    />
                                    <div className="space-y-1">
                                        <strong className="text-xs text-foreground block">{l10n.options.optimakina}</strong>
                                        <p className="text-[11px] text-muted-foreground">Passé de +10% à +20% avec la MàJ 3.7. Réduit considérablement l'XP parent requise pour 100%.</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer hover:bg-surface transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={useTakeza}
                                        onChange={(e) => setUseTakeza(e.target.checked)}
                                        className="mt-0.5 rounded text-foreground focus:ring-foreground w-4 h-4"
                                    />
                                    <div className="space-y-1">
                                        <strong className="text-xs text-foreground block">{l10n.options.takeza}</strong>
                                        <p className="text-[11px] text-muted-foreground">Bonus Méryde du 12 Octobre. Confère +20% à tous les accouplements de la journée.</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer hover:bg-surface transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={useAnimakina}
                                        onChange={(e) => setUseAnimakina(e.target.checked)}
                                        className="mt-0.5 rounded text-foreground focus:ring-foreground w-4 h-4"
                                    />
                                    <div className="space-y-1">
                                        <strong className="text-xs text-foreground block">{l10n.options.animakina}</strong>
                                        <p className="text-[11px] text-muted-foreground">Nouveauté 3.7 : Ne donne plus de capacité aléatoire mais verrouille le sexe du bébé souhaité.</p>
                                        
                                        {useAnimakina && (
                                            <div className="flex items-center gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSex("male")}
                                                    className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                                        selectedSex === "male"
                                                            ? "bg-foreground text-background border-foreground"
                                                            : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {l10n.options.male}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSex("female")}
                                                    className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                                        selectedSex === "female"
                                                            ? "bg-foreground text-background border-foreground"
                                                            : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {l10n.options.female}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Colonne Droite : Carte de Verdict & Optimisation */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Résultat du Croisement 3.7
                            </h3>

                            {/* Jauge Principale de Chance */}
                            <div className="text-center py-4 space-y-2">
                                <span className="text-xs text-muted-foreground block">{l10n.results.targetGenChance}</span>
                                <div className="text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1 font-mono">
                                    <span>{totalChance}%</span>
                                </div>
                                {totalChance >= 100 && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/10 border border-success/30 text-success text-[11px] font-semibold">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        100% Garanti
                                    </span>
                                )}
                            </div>

                            {/* Décomposition mathématique */}
                            <div className="p-4 rounded-xl bg-surface/50 border border-border text-xs space-y-2 font-mono">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Probabilité de Base :</span>
                                    <span>+30.0%</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Parent 1 (Lvl {parent1Lvl}) :</span>
                                    <span>+{parent1Bonus.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Parent 2 (Lvl {parent2Lvl}) :</span>
                                    <span>+{parent2Bonus.toFixed(1)}%</span>
                                </div>
                                {useOptimakina && (
                                    <div className="flex justify-between text-foreground font-semibold">
                                        <span>Optimakina 3.7 :</span>
                                        <span>+20.0%</span>
                                    </div>
                                )}
                                {useTakeza && (
                                    <div className="flex justify-between text-foreground font-semibold">
                                        <span>Almanax Takeza :</span>
                                        <span>+20.0%</span>
                                    </div>
                                )}
                                <div className="pt-2 border-t border-border flex justify-between font-bold text-foreground">
                                    <span>Total Calculé :</span>
                                    <span>{rawTotalChance.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Conseil d'ingénieur Élevage */}
                            <div className="p-4 rounded-xl bg-surface/50 border border-border text-xs space-y-1.5">
                                <strong className="text-foreground font-semibold flex items-center gap-1.5">
                                    <Flame className="w-4 h-4 text-muted-foreground shrink-0" />
                                    {l10n.results.optimalLevelTip}
                                </strong>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    {l10n.results.optimalLevelDesc}
                                </p>
                                <div className="mt-2 pt-2 border-t border-border text-muted-foreground text-[11px] font-mono">
                                    Cumul de niveaux requis : <strong className="text-foreground">{totalLevelsNeeded}</strong> (ex: {avgLevelNeeded} + {totalLevelsNeeded - avgLevelNeeded})
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ONGLET 2 : SÉRÉNITÉ & ENCLOS ANTI-DÉRIVE ──────────────────── */}
            {activeTab === "serenite" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-foreground/70" />
                                    <span>{l10n.sereniteTool.title}</span>
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {l10n.sereniteTool.desc}
                                </p>
                            </div>

                            {/* Curseur de sérénité */}
                            <div className="space-y-4 p-4 rounded-xl bg-surface/50 border border-border">
                                <div className="flex items-center justify-between text-xs">
                                    <strong className="text-foreground">{l10n.sereniteTool.currentSerenity}</strong>
                                    <span className="font-mono text-base font-bold text-foreground">{currentSerenity}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-5000"
                                    max="5000"
                                    step="50"
                                    value={currentSerenity}
                                    onChange={(e) => setCurrentSerenity(parseInt(e.target.value, 10))}
                                    className="w-full accent-foreground"
                                />

                                {/* Repères visuels des 4 zones */}
                                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                                    <div className={`p-2 rounded-lg border ${currentSerenity < -2000 ? "bg-muted/70 border-border-strong text-foreground font-semibold" : "bg-surface/30 border-border text-muted-foreground"}`}>
                                        -5000 à -2000<br /><span className="text-[9px]">Endurance pure :C</span>
                                    </div>
                                    <div className={`p-2 rounded-lg border ${currentSerenity >= -2000 && currentSerenity <= 2000 ? "bg-muted/70 border-border-strong text-foreground font-semibold" : "bg-surface/30 border-border text-muted-foreground"}`}>
                                        -2000 à +2000<br /><span className="text-[9px]">Maturité & Mix :)</span>
                                    </div>
                                    <div className={`p-2 rounded-lg border ${currentSerenity > 2000 ? "bg-muted/70 border-border-strong text-foreground font-semibold" : "bg-surface/30 border-border text-muted-foreground"}`}>
                                        +2000 à +5000<br /><span className="text-[9px]">Amour pur :D</span>
                                    </div>
                                </div>
                            </div>

                            {/* Choix de l'objectif */}
                            <div className="space-y-2.5">
                                <strong className="text-xs font-semibold text-foreground block">{l10n.sereniteTool.targetZone}</strong>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("endurance")}
                                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors ${
                                            targetZone === "endurance"
                                                ? "border-primary/50 bg-primary/5 text-foreground"
                                                : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        ⚡ Endurance (&lt; 0)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("maturite")}
                                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors ${
                                            targetZone === "maturite"
                                                ? "border-primary/50 bg-primary/5 text-foreground"
                                                : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        💧 Maturité ([-2k, +2k])
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("amour")}
                                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors ${
                                            targetZone === "amour"
                                                ? "border-primary/50 bg-primary/5 text-foreground"
                                                : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        ❤️ Amour (&gt; 0)
                                    </button>
                                </div>
                            </div>

                            {/* Choix du Tier de Carburant */}
                            <div className="space-y-2.5">
                                <strong className="text-xs font-semibold text-foreground block">{l10n.sereniteTool.tierSelect}</strong>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {(Object.keys(XP_TIERS) as unknown as CatalystTier[]).map((tierNum) => {
                                        const tInfo = XP_TIERS[tierNum];
                                        return (
                                            <button
                                                key={tierNum}
                                                type="button"
                                                onClick={() => setCatalystTier(tierNum)}
                                                className={`p-2.5 rounded-lg border text-xs text-center transition-colors ${
                                                    catalystTier === tierNum
                                                        ? "border-foreground/40 bg-surface-elevated text-foreground font-semibold"
                                                        : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <span className="block font-semibold">{tInfo.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{tierNum * 20} pts/10s</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Verdict de Chrono & Consignes */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Horodateur d'Enclos 3.7
                            </h3>

                            <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-2 text-center">
                                <span className="text-xs text-muted-foreground block">{l10n.sereniteTool.timeNeeded}</span>
                                <div className="text-3xl font-bold text-foreground font-mono">
                                    {distanceToRange === 0 ? "Déjà atteint !" : `${minutesToTarget} min`}
                                </div>
                                <span className="text-[11px] text-muted-foreground block font-mono">
                                    Écart à combler : {distanceToRange} points
                                </span>
                            </div>

                            <div className="space-y-1.5 text-xs">
                                <strong className="text-foreground block font-semibold">Actionneur requis :</strong>
                                <div className="p-2.5 rounded-lg bg-surface/50 border border-border text-foreground/80 font-mono text-[11px]">
                                    {actionDevice}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl border border-warning/30 bg-warning/5 text-xs space-y-1">
                                <div className="flex items-center gap-1.5 text-warning font-semibold">
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                    <span>Piège de Sur-Dérive (3.7)</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {l10n.sereniteTool.warningOvershoot}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ONGLET 3 : CALCULATEUR XP & GÉNÉTONS ──────────────────────── */}
            {activeTab === "xp" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Coins className="w-4 h-4 text-foreground/70" />
                                    <span>{l10n.xpTool.title}</span>
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {l10n.xpTool.desc}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold">{l10n.xpTool.currentLvl}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="199"
                                        value={startLvl}
                                        onChange={(e) => setStartLvl(Math.max(1, Math.min(199, parseInt(e.target.value, 10) || 1)))}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-border-strong font-mono"
                                    />
                                </div>
                                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold">{l10n.xpTool.targetLvl}</span>
                                    <input
                                        type="number"
                                        min="2"
                                        max="200"
                                        value={targetLvl}
                                        onChange={(e) => setTargetLvl(Math.max(2, Math.min(200, parseInt(e.target.value, 10) || 200)))}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-border-strong font-mono"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer hover:bg-surface transition-colors">
                                <input
                                    type="checkbox"
                                    checked={hasSage}
                                    onChange={(e) => setHasSage(e.target.checked)}
                                    className="rounded text-foreground focus:ring-foreground w-4 h-4"
                                />
                                <div>
                                    <strong className="text-xs text-foreground block">{l10n.xpTool.hasSage}</strong>
                                    <span className="text-[11px] text-muted-foreground">Double tout le gain d'XP en mangeoire. Permet d'atteindre le niveau 200 en ~30h chrono.</span>
                                </div>
                            </label>

                            {/* Sélecteur de Génération pour les Génétons */}
                            <div className="space-y-2.5 pt-4 border-t border-border">
                                <div className="flex items-center justify-between text-xs">
                                    <strong className="text-foreground">{l10n.xpTool.genSelect}</strong>
                                    <span className="font-mono text-muted-foreground font-semibold">Génération {selectedGen}</span>
                                </div>
                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                                    {Array.from({ length: FAMILY_CONFIG[selectedFamily].maxGen }, (_, i) => i + 1).map((gen) => (
                                        <button
                                            key={gen}
                                            type="button"
                                            onClick={() => setSelectedGen(gen)}
                                            className={`p-2 rounded-lg border text-xs font-mono font-semibold transition-colors ${
                                                selectedGen === gen
                                                    ? "bg-foreground text-background border-foreground"
                                                    : "bg-surface/50 border-border text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {gen}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Résumé des Durées & Génétons */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Synthèse de Production
                            </h3>

                            <div className="space-y-2.5 text-xs">
                                <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                                    <span className="text-muted-foreground">XP Total Requise :</span>
                                    <div className="text-xl font-bold text-foreground font-mono">
                                        {xpNeeded.toLocaleString("fr-FR")} XP
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                                    <span className="text-muted-foreground">Temps estimé (Tier {catalystTier}) :</span>
                                    <div className="text-xl font-bold text-foreground font-mono">
                                        {xpHours} heures (~{(xpHours / 24).toFixed(1)} jours)
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                                    <span className="text-foreground font-semibold">{l10n.xpTool.genetonsWon}</span>
                                    <div className="text-xl font-bold text-foreground font-mono">
                                        +{GENETON_TABLE[selectedGen] || 1} Génétons
                                    </div>
                                    <span className="text-[10px] text-muted-foreground block">
                                        Gen 10 : 500 Génétons par accouplement (3.7)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ONGLET 4 : ARBRES & MATRICE DE CROISEMENTS ───────────────── */}
            {activeTab === "arbres" && (
                <div className="space-y-6">
                    {/* Simulateur de croisement direct */}
                    <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-medium text-muted-foreground">
                                    <GitMerge className="w-3 h-3 text-foreground/70" />
                                    <span>{l10n.treesTool.crossSimulatorTitle}</span>
                                </div>
                                <h2 className="text-base font-bold text-foreground">
                                    {l10n.treesTool.crossSimulatorTitle} — {FAMILY_CONFIG[selectedFamily].name}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {l10n.treesTool.crossSimulatorDesc}
                                </p>
                            </div>
                        </div>

                        {/* Sélecteurs des deux parents */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 p-3.5 rounded-xl bg-surface/50 border border-border">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>{l10n.treesTool.selectParent1}</span>
                                    <span className="text-[11px] font-normal text-muted-foreground">Gen {parent1Info.generation}</span>
                                </label>
                                <select
                                    value={matrixParent1}
                                    onChange={(e) => setMatrixParent1(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-foreground transition-colors"
                                >
                                    {familyMounts.map((m) => (
                                        <option key={m.id} value={m.name}>
                                            Gen {m.generation} — {m.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="relative w-12 h-12 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden">
                                        <Image
                                            src={parent1Info.img}
                                            alt={parent1Info.name}
                                            width={40}
                                            height={40}
                                            unoptimized
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-xs font-semibold block text-foreground truncate">{parent1Info.name}</span>
                                        <span className="text-[11px] text-muted-foreground block truncate">{parent1Info.stats}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 p-3.5 rounded-xl bg-surface/50 border border-border">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>{l10n.treesTool.selectParent2}</span>
                                    <span className="text-[11px] font-normal text-muted-foreground">Gen {parent2Info.generation}</span>
                                </label>
                                <select
                                    value={matrixParent2}
                                    onChange={(e) => setMatrixParent2(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-foreground transition-colors"
                                >
                                    {familyMounts.map((m) => (
                                        <option key={m.id} value={m.name}>
                                            Gen {m.generation} — {m.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="relative w-12 h-12 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden">
                                        <Image
                                            src={parent2Info.img}
                                            alt={parent2Info.name}
                                            width={40}
                                            height={40}
                                            unoptimized
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-xs font-semibold block text-foreground truncate">{parent2Info.name}</span>
                                        <span className="text-[11px] text-muted-foreground block truncate">{parent2Info.stats}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Résultat du croisement */}
                        <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-3">
                            <span className="text-xs font-semibold text-foreground block">
                                {l10n.treesTool.possibleOutcomes}
                            </span>

                            {potentialMutation ? (
                                <div className="p-4 rounded-lg bg-background border border-primary/40 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                Mutation Nouvelle Race !
                                            </span>
                                            <span className="text-xs font-mono text-muted-foreground">
                                                Génération {potentialMutation.generation}
                                            </span>
                                        </div>
                                        <div className="text-xs font-bold text-foreground font-mono">
                                            {totalChance}% de chance de mutation
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 pt-1">
                                        <div className="relative w-14 h-14 shrink-0 rounded-lg bg-surface border border-border p-1 flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={potentialMutation.img}
                                                alt={potentialMutation.name}
                                                width={48}
                                                height={48}
                                                unoptimized
                                                className="object-contain"
                                            />
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <h3 className="text-sm font-bold text-foreground">
                                                {potentialMutation.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                {potentialMutation.stats}
                                            </p>
                                            <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                                                <span>+{GENETON_TABLE[potentialMutation.generation] || 1} Génétons</span>
                                                <span>•</span>
                                                <span>{potentialMutation.type === "pure" ? l10n.treesTool.pureRace : l10n.treesTool.bicoloreRace}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                        <span>
                                            Chances restantes (arbre génétique) : ~{Math.round((100 - totalChance) / 2)}% {parent1Info.name} et ~{Math.round((100 - totalChance) / 2)}% {parent2Info.name}
                                        </span>
                                        <span className="text-[10px] font-mono text-muted-foreground/80">
                                            Formule 3.7 : Base 30% + Niveaux + Catalyseurs
                                        </span>
                                    </div>
                                </div>
                            ) : isSameBreed ? (
                                <div className="p-4 rounded-lg bg-background border border-border space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-foreground border border-border">
                                            Lignée Identique
                                        </span>
                                        <span className="text-xs font-mono text-foreground font-bold">
                                            100% {parent1Info.name} (si arbre pur)
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Croiser deux montures de même race permet de stabiliser et purifier un arbre généalogique pour maximiser la transmission héréditaire de la race et des capacités.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-background border border-border space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-foreground border border-border">
                                            Croisement sans mutation directe
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Ce croisement ne débloque pas de nouvelle race directe au palier supérieur. La descendance se répartira à ~50% sur <strong>{parent1Info.name}</strong> et ~50% sur <strong>{parent2Info.name}</strong> (ou régressions vers les ancêtres non purs).
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Catalogue complet & filtres */}
                    <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-foreground">
                                    {l10n.treesTool.title} — {FAMILY_CONFIG[selectedFamily].name}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {l10n.treesTool.desc}
                                </p>
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                                {filteredMounts.length} race{filteredMounts.length > 1 ? "s" : ""} affichée{filteredMounts.length > 1 ? "s" : ""}
                            </div>
                        </div>

                        {/* Barre de filtres et recherche */}
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={mountSearch}
                                    onChange={(e) => setMountSearch(e.target.value)}
                                    placeholder={l10n.treesTool.searchPlaceholder}
                                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                                />
                            </div>

                            {/* Filtres par Génération */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGenFilter("all")}
                                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                                        selectedGenFilter === "all"
                                            ? "border-foreground bg-foreground text-background font-semibold"
                                            : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {l10n.treesTool.allGens}
                                </button>
                                {Array.from({ length: FAMILY_CONFIG[selectedFamily].maxGen }, (_, idx) => {
                                    const g = idx + 1;
                                    const isSel = selectedGenFilter === g;
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setSelectedGenFilter(g)}
                                            className={`px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                                                isSel
                                                    ? "border-foreground bg-foreground text-background font-semibold"
                                                    : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            Gen {g}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Filtres par Statistiques */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                                {[
                                    { tag: "all" as const, label: l10n.treesTool.filterAllStats },
                                    { tag: "pm" as const, label: l10n.treesTool.filterPm },
                                    { tag: "pa" as const, label: l10n.treesTool.filterPa },
                                    { tag: "po" as const, label: l10n.treesTool.filterPo },
                                    { tag: "vita" as const, label: l10n.treesTool.filterVita },
                                    { tag: "stats" as const, label: l10n.treesTool.filterStats },
                                    { tag: "puissance" as const, label: l10n.treesTool.filterPuissance },
                                    { tag: "invoc" as const, label: l10n.treesTool.filterInvoc },
                                    { tag: "ini" as const, label: l10n.treesTool.filterIni },
                                    { tag: "prosp" as const, label: l10n.treesTool.filterProsp },
                                ].map((filter) => {
                                    const isSel = selectedStatTag === filter.tag;
                                    return (
                                        <button
                                            key={filter.tag}
                                            type="button"
                                            onClick={() => setSelectedStatTag(filter.tag)}
                                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-colors ${
                                                isSel
                                                    ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                                                    : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {filter.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grille de montures */}
                        {filteredMounts.length === 0 ? (
                            <div className="p-8 text-center rounded-xl bg-surface/40 border border-border space-y-2">
                                <p className="text-xs text-muted-foreground">
                                    {l10n.treesTool.emptySearch}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMountSearch("");
                                        setSelectedGenFilter("all");
                                        setSelectedStatTag("all");
                                    }}
                                    className="text-xs font-semibold text-foreground underline underline-offset-4"
                                >
                                    Réinitialiser les filtres
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredMounts.map((mount) => {
                                    const genetons = GENETON_TABLE[mount.generation] || 1;
                                    return (
                                        <div
                                            key={mount.id}
                                            className="p-4 rounded-xl bg-surface/50 border border-border hover:border-border-strong transition-all flex flex-col justify-between space-y-3"
                                        >
                                            <div className="space-y-2.5">
                                                <div className="flex items-start gap-3">
                                                    <div className="relative w-12 h-12 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden">
                                                        <Image
                                                            src={mount.img}
                                                            alt={mount.name}
                                                            width={44}
                                                            height={44}
                                                            unoptimized
                                                            className="object-contain"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold">
                                                                Gen {mount.generation}
                                                            </span>
                                                            <span className="text-[11px] font-mono text-muted-foreground">
                                                                +{genetons} {l10n.treesTool.genetonYield}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-xs font-bold text-foreground mt-1 truncate">
                                                            {mount.name}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <p className="text-xs text-foreground/90 font-medium leading-snug">
                                                    {mount.stats}
                                                </p>
                                            </div>

                                            <div className="pt-2.5 border-t border-border/80 text-[11px] text-muted-foreground space-y-1.5">
                                                {mount.parents ? (
                                                    <div className="space-y-1">
                                                        <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                                                            {l10n.treesTool.parentsFormula}
                                                        </span>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[11px] text-foreground truncate">
                                                                {mount.parents[0].replace(/Dragodinde |Muldo |Volkorne /g, "")} + {mount.parents[1].replace(/Dragodinde |Muldo |Volkorne /g, "")}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (mount.parents) {
                                                                        setMatrixParent1(mount.parents[0]);
                                                                        setMatrixParent2(mount.parents[1]);
                                                                        window.scrollTo({ top: 400, behavior: "smooth" });
                                                                    }
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/80 hover:bg-muted text-foreground font-medium text-[10px] transition-colors shrink-0"
                                                                title="Charger dans le simulateur de croisement"
                                                            >
                                                                <GitMerge className="w-2.5 h-2.5" />
                                                                <span>{l10n.treesTool.simulateCrossBtn}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground block italic">
                                                        {l10n.treesTool.pureAncestry}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
