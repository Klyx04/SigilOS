"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
    Calculator, 
    Clock, 
    Coins, 
    GitBranch, 
    BookOpen, 
    ArrowRight, 
    Search, 
    GitMerge, 
    Calendar
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { MOUNT_DATABASE, StatTag } from "@/data/mount-data";
import { MountSelectCombobox } from "./MountSelectCombobox";
import { MountStatBadges } from "./MountStatBadges";

type MountFamily = "dragodinde" | "muldo" | "volkorne";
type ActiveTab = "croisements" | "serenite" | "xp" | "arbres";
type CatalystTier = 1 | 2 | 3 | 4;

const FAMILY_CONFIG: Record<MountFamily, { 
    name: string; 
    count: number; 
    icon: string; 
    bonus: string;
}> = {
    dragodinde: {
        name: "Dragodindes",
        count: 66,
        icon: "/images/guides/elevage/dragodindes.png",
        bonus: "Vitalité (jusqu'à 400), Puissance & Caractéristiques",
    },
    muldo: {
        name: "Muldos",
        count: 82,
        icon: "/images/guides/elevage/muldos.png",
        bonus: "+1 PM garanti (lvl 100+), Résistances % & Stats",
    },
    volkorne: {
        name: "Volkornes",
        count: 80,
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
    1: { name: "Tier 1", xpPer10s: 20, item: "Extrait de Mangeoire", img: "/images/guides/elevage/carburant_extrait.png" },
    2: { name: "Tier 2", xpPer10s: 40, item: "Philtre de Mangeoire", img: "/images/guides/elevage/carburant_philtre.png" },
    3: { name: "Tier 3", xpPer10s: 60, item: "Potion de Mangeoire", img: "/images/guides/elevage/carburant_potion.png" },
    4: { name: "Tier 4", xpPer10s: 80, item: "Élixir de Mangeoire", img: "/images/guides/elevage/carburant_elixir.png" },
};

export function ElevageStudioClient() {
    const { t, locale } = useI18n();
    const l10n = t.elevageStudio;

    const [activeTab, setActiveTab] = useState<ActiveTab>("croisements");
    const [selectedFamily, setSelectedFamily] = useState<MountFamily>("dragodinde");

    // Onglet 1 : Niveaux des parents et catalyseurs
    const [parent1Lvl, setParent1Lvl] = useState<number>(100);
    const [parent2Lvl, setParent2Lvl] = useState<number>(100);
    const [useOptimakina, setUseOptimakina] = useState<boolean>(true);
    const [useTakeza, setUseTakeza] = useState<boolean>(false);
    const [useAnimakina, setUseAnimakina] = useState<boolean>(false);
    const [selectedSex, setSelectedSex] = useState<"male" | "female">("female");

    // Onglet 2 : Minuteur de sérénité
    const [currentSerenity, setCurrentSerenity] = useState<number>(3700);
    const [targetZone, setTargetZone] = useState<"endurance" | "maturite" | "amour">("maturite");
    const [catalystTier, setCatalystTier] = useState<CatalystTier>(2);

    // Onglet 3 : Calculateur XP
    const [startLvl, setStartLvl] = useState<number>(1);
    const [targetLvl, setTargetLvl] = useState<number>(200);
    const [hasSage, setHasSage] = useState<boolean>(false);
    const [selectedGen, setSelectedGen] = useState<number>(3);

    // Onglet 4 : Matrice de croisement & Recherche catalogue
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedGenFilter, setSelectedGenFilter] = useState<number | "all">("all");
    const [selectedStatTag, setSelectedStatTag] = useState<StatTag | "all">("all");
    const [matrixParent1, setMatrixParent1] = useState<string>("Dragodinde Amande");
    const [matrixParent2, setMatrixParent2] = useState<string>("Dragodinde Rousse");
    const [flashSimulator, setFlashSimulator] = useState<boolean>(false);
    const simulatorRef = useRef<HTMLDivElement>(null);

    // Chargement de recette avec bascule d'onglet et scroll propre vers le haut du simulateur
    const handleLoadRecipe = (p1: string, p2: string) => {
        setActiveTab("arbres");
        setMatrixParent1(p1);
        setMatrixParent2(p2);
        setFlashSimulator(true);
        setTimeout(() => setFlashSimulator(false), 1400);

        setTimeout(() => {
            if (simulatorRef.current) {
                simulatorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 60);
    };

    // Données des montures pour l'espèce sélectionnée
    const familyMounts = useMemo(() => {
        return MOUNT_DATABASE.filter(m => m.family === selectedFamily);
    }, [selectedFamily]);

    // Parent 1 & 2 pour la matrice
    const parent1Info = familyMounts.find(m => m.name === matrixParent1) || familyMounts[0] || MOUNT_DATABASE[0];
    const parent2Info = familyMounts.find(m => m.name === matrixParent2) || familyMounts[1] || familyMounts[0] || MOUNT_DATABASE[0];

    // Recherche de la descendance directe
    const potentialMutation = useMemo(() => {
        if (!parent1Info || !parent2Info) return null;
        return familyMounts.find(m => {
            if (!m.parents) return false;
            return (
                (m.parents[0] === parent1Info.name && m.parents[1] === parent2Info.name) ||
                (m.parents[1] === parent1Info.name && m.parents[0] === parent2Info.name)
            );
        });
    }, [familyMounts, parent1Info, parent2Info]);

    const isSameBreed = parent1Info.name === parent2Info.name;

    // Calcul de probabilité de génération cible 3.7
    const baseChance = 30;
    const parent1Bonus = parent1Lvl * 0.15;
    const parent2Bonus = parent2Lvl * 0.15;
    const optimakinaBonus = useOptimakina ? 20 : 0;
    const takezaBonus = useTakeza ? 20 : 0;
    const rawTotalChance = baseChance + parent1Bonus + parent2Bonus + optimakinaBonus + takezaBonus;
    const totalChance = Math.min(100, Math.round(rawTotalChance * 10) / 10);

    // Niveaux requis pour atteindre 100%
    const neededFromParents = Math.max(0, 100 - baseChance - optimakinaBonus - takezaBonus);
    const totalLevelsNeeded = Math.ceil(neededFromParents / 0.15);
    const avgLevelNeeded = Math.ceil(totalLevelsNeeded / 2);

    // Calculs de sérénité
    const currentSpeed = catalystTier * 20; // 20, 40, 60, 80 pts / 10s
    let targetRange = { min: -2000, max: 2000, label: "Maturité (Neutre)" };
    let requiredAction = "Aucun (Déjà dans la zone)";

    if (targetZone === "endurance") {
        targetRange = { min: -5000, max: -2001, label: "Endurance (Négative)" };
        if (currentSerenity >= -2000) {
            requiredAction = "Baffeur (-) pour descendre sous -2 000";
        }
    } else if (targetZone === "amour") {
        targetRange = { min: 2001, max: 5000, label: "Amour (Positive)" };
        if (currentSerenity <= 2000) {
            requiredAction = "Caresseur (+) pour monter au-dessus de +2 000";
        }
    } else {
        if (currentSerenity < -2000) {
            requiredAction = "Caresseur (+) pour remonter entre -2 000 et +2 000";
        } else if (currentSerenity > 2000) {
            requiredAction = "Baffeur (-) pour redescendre entre -2 000 et +2 000";
        }
    }

    let distanceToRange = 0;
    if (currentSerenity < targetRange.min) {
        distanceToRange = targetRange.min - currentSerenity;
    } else if (currentSerenity > targetRange.max) {
        distanceToRange = currentSerenity - targetRange.max;
    }
    const secondsToTarget = (distanceToRange / currentSpeed) * 10;
    const minutesToTarget = Math.ceil(secondsToTarget / 60);

    // Calculs XP
    const XP_TABLE_TOTAL = 867582; // Niv 1 -> 200
    const xpRatio = (targetLvl ** 2.2 - startLvl ** 2.2) / (200 ** 2.2 - 1);
    const xpNeeded = Math.max(0, Math.round(XP_TABLE_TOTAL * Math.max(0, Math.min(1, xpRatio))));
    const xpSpeedPer10s = XP_TIERS[catalystTier].xpPer10s * (hasSage ? 2 : 1);
    const totalSecondsXp = (xpNeeded / xpSpeedPer10s) * 10;
    const hoursXp = Math.round((totalSecondsXp / 3600) * 10) / 10;
    const daysXp = Math.round((hoursXp / 24) * 10) / 10;
    const currentGenetons = GENETON_TABLE[selectedGen] || 1;

    // Filtrage du catalogue
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filteredMounts = useMemo(() => {
        return familyMounts.filter(mount => {
            if (selectedGenFilter !== "all" && mount.generation !== selectedGenFilter) {
                return false;
            }
            if (selectedStatTag !== "all" && !mount.statTags.includes(selectedStatTag)) {
                return false;
            }
            if (!searchQuery.trim()) return true;
            const q = norm(searchQuery.trim());
            const matchName = norm(mount.name).includes(q);
            const matchStats = norm(mount.stats).includes(q);
            const matchGen = `gen ${mount.generation}`.includes(q) || `g${mount.generation}` === q;
            return matchName || matchStats || matchGen;
        });
    }, [familyMounts, selectedGenFilter, selectedStatTag, searchQuery]);

    return (
        <div className="space-y-8">
            {/* ── EN-TÊTE FACTUEL & ÉPURÉ DU STUDIO ─────────────────────────── */}
            <div className="border-b border-border pb-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <p className="reg-eyebrow flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                            <span>{l10n.heroTag}</span>
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {l10n.heroTitle}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {l10n.heroSubtitle}
                        </p>
                    </div>

                    <Link
                        href={locale === "en" ? "/en/guides/guide-elevage-enclos-guilde-dofus" : "/guides/guide-elevage-enclos-guilde-dofus"}
                        className="reg-btn reg-btn-secondary text-xs shrink-0 self-start"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>{l10n.guideLinkText}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                </div>

                {/* SÉLECTEUR D'ESPÈCE (DRAGODINDES, MULDOS, VOLKORNES) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                    {(Object.keys(FAMILY_CONFIG) as MountFamily[]).map((famKey) => {
                        const fam = FAMILY_CONFIG[famKey];
                        const isSelected = selectedFamily === famKey;

                        return (
                            <button
                                key={famKey}
                                type="button"
                                onClick={() => setSelectedFamily(famKey)}
                                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 ${
                                    isSelected
                                        ? "border-foreground bg-surface text-foreground shadow-xs"
                                        : "border-border bg-surface/30 text-muted-foreground hover:text-foreground hover:bg-surface/60 hover:border-border-strong"
                                }`}
                            >
                                <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center p-1 shrink-0">
                                    <Image
                                        src={fam.icon}
                                        alt={fam.name}
                                        width={32}
                                        height={32}
                                        unoptimized
                                        className="object-contain"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-sm text-foreground">{fam.name}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                                            {fam.count} races
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{fam.bonus}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── BARRE D'ONGLETS FACTUELLE STYLE PRODUIT / LANDING ─────────── */}
            <div className="flex border-b border-border gap-6 overflow-x-auto text-xs font-semibold scrollbar-none pb-px">
                <button
                    type="button"
                    onClick={() => setActiveTab("croisements")}
                    className={`pb-3 border-b-2 inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                        activeTab === "croisements"
                            ? "border-foreground text-foreground font-bold"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Calculator className="w-4 h-4" />
                    <span>{l10n.tabs.croisements}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("serenite")}
                    className={`pb-3 border-b-2 inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                        activeTab === "serenite"
                            ? "border-foreground text-foreground font-bold"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    <span>{l10n.tabs.serenite}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("xp")}
                    className={`pb-3 border-b-2 inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                        activeTab === "xp"
                            ? "border-foreground text-foreground font-bold"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Coins className="w-4 h-4" />
                    <span>{l10n.tabs.xp}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("arbres")}
                    className={`pb-3 border-b-2 inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                        activeTab === "arbres"
                            ? "border-foreground text-foreground font-bold"
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
                    {/* Colonne Gauche : Configuration des Parents & Catalyseurs */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Paramètres d'Accouplement & Niveaux
                            </h2>

                            {/* Parent 1 (Mâle) */}
                            <div className="space-y-3 p-4 rounded-lg border border-border bg-surface/50">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-mono">♂</span>
                                        <span>{l10n.parentsSection.parent1}</span>
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-foreground px-2 py-0.5 rounded bg-muted/60 border border-border/50">
                                        Niveau {parent1Lvl} <span className="text-muted-foreground font-normal">+{(parent1Lvl * 0.15).toFixed(1)}%</span>
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="200"
                                    value={parent1Lvl}
                                    onChange={(e) => setParent1Lvl(parseInt(e.target.value, 10))}
                                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
                                />
                                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                                    <span>Lvl 1 (+0.15%)</span>
                                    <span>Lvl 100 (+15%)</span>
                                    <span>Lvl 167 (+25%)</span>
                                    <span>Lvl 200 (+30%)</span>
                                </div>
                            </div>

                            {/* Parent 2 (Femelle) */}
                            <div className="space-y-3 p-4 rounded-lg border border-border bg-surface/50">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-mono">♀</span>
                                        <span>{l10n.parentsSection.parent2}</span>
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-foreground px-2 py-0.5 rounded bg-muted/60 border border-border/50">
                                        Niveau {parent2Lvl} <span className="text-muted-foreground font-normal">+{(parent2Lvl * 0.15).toFixed(1)}%</span>
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="200"
                                    value={parent2Lvl}
                                    onChange={(e) => setParent2Lvl(parseInt(e.target.value, 10))}
                                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
                                />
                                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                                    <span>Lvl 1 (+0.15%)</span>
                                    <span>Lvl 100 (+15%)</span>
                                    <span>Lvl 167 (+25%)</span>
                                    <span>Lvl 200 (+30%)</span>
                                </div>
                            </div>

                            {/* Catalyseurs & Makinas 3.7 */}
                            <div className="space-y-2.5 pt-2 border-t border-border">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                    Catalyseurs & Bonus (MàJ 3.7)
                                </span>

                                {/* Optimakina */}
                                <label className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                                    useOptimakina ? "border-border-strong bg-surface" : "border-border bg-surface/30 hover:bg-surface/60"
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={useOptimakina}
                                        onChange={(e) => setUseOptimakina(e.target.checked)}
                                        className="mt-1 rounded text-foreground focus:ring-0 w-4 h-4 shrink-0"
                                    />
                                    <div className="w-8 h-8 shrink-0 rounded bg-background border border-border p-1 flex items-center justify-center">
                                        <Image
                                            src="/images/guides/elevage/optimakina.png"
                                            alt="Optimakina"
                                            width={28}
                                            height={28}
                                            unoptimized
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-foreground">{l10n.options.optimakina}</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">+20% Fixe</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            Passé de +10% à +20% avec la MàJ 3.7. Réduit considérablement l'XP parent requise pour 100%.
                                        </p>
                                    </div>
                                </label>

                                {/* Takeza */}
                                <label className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                                    useTakeza ? "border-border-strong bg-surface" : "border-border bg-surface/30 hover:bg-surface/60"
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={useTakeza}
                                        onChange={(e) => setUseTakeza(e.target.checked)}
                                        className="mt-1 rounded text-foreground focus:ring-0 w-4 h-4 shrink-0"
                                    />
                                    <div className="w-8 h-8 shrink-0 rounded bg-background border border-border p-1 flex items-center justify-center text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-foreground">{l10n.options.takeza}</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">11 Octobre 2027</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            {locale === "fr"
                                                ? "Bonus Méryde Takeza (Action de grâce, 11 Octobre 2027). Confère +20% à la génération cible sur tous les accouplements."
                                                : "Takeza Meridia bonus (Thanksgiving, October 11, 2027). Confers +20% target generation chance on all matings."}
                                        </p>
                                    </div>
                                </label>

                                {/* Animakina */}
                                <label className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                                    useAnimakina ? "border-border-strong bg-surface" : "border-border bg-surface/30 hover:bg-surface/60"
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={useAnimakina}
                                        onChange={(e) => setUseAnimakina(e.target.checked)}
                                        className="mt-1 rounded text-foreground focus:ring-0 w-4 h-4 shrink-0"
                                    />
                                    <div className="w-8 h-8 shrink-0 rounded bg-background border border-border p-1 flex items-center justify-center">
                                        <Image
                                            src="/images/guides/elevage/animakina.png"
                                            alt="Animakina"
                                            width={28}
                                            height={28}
                                            unoptimized
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-foreground">{l10n.options.animakina}</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">Sexe Choisi</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            Nouveauté 3.7 : Verrouille et garantit le sexe du bébé souhaité à 100%.
                                        </p>

                                        {useAnimakina && (
                                            <div className="flex items-center gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); setSelectedSex("male"); }}
                                                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                                        selectedSex === "male"
                                                            ? "bg-foreground text-background border-foreground"
                                                            : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    ♂ {l10n.options.male}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); setSelectedSex("female"); }}
                                                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                                        selectedSex === "female"
                                                            ? "bg-foreground text-background border-foreground"
                                                            : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    ♀ {l10n.options.female}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Colonne Droite : Scorecard / Verdict */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Synthèse du Croisement 3.7
                            </h3>

                            {/* Probabilité de génération cible */}
                            <div className="p-5 rounded-lg border border-border bg-surface/50 text-center space-y-3">
                                <span className="text-xs text-muted-foreground block font-medium">
                                    Probabilité de Génération Cible
                                </span>
                                <div className="text-4xl font-extrabold font-mono tracking-tight text-foreground">
                                    {totalChance}%
                                </div>

                                <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full bg-foreground transition-all duration-300 rounded-full"
                                        style={{ width: `${Math.min(100, totalChance)}%` }}
                                    />
                                </div>

                                <span className="text-[11px] text-muted-foreground block font-mono">
                                    {totalChance >= 100 
                                        ? "Seuil garanti à 100%" 
                                        : `Manque ${(100 - totalChance).toFixed(1)}% pour le 100% garanti`}
                                </span>
                            </div>

                            {/* Décomposition du calcul */}
                            <div className="divide-y divide-border/60 text-xs font-mono">
                                <div className="py-2 flex justify-between text-muted-foreground">
                                    <span>Probabilité de base</span>
                                    <span className="text-foreground">+30.0%</span>
                                </div>
                                <div className="py-2 flex justify-between text-muted-foreground">
                                    <span>Parent 1 (Niv. {parent1Lvl})</span>
                                    <span className="text-foreground">+{(parent1Lvl * 0.15).toFixed(1)}%</span>
                                </div>
                                <div className="py-2 flex justify-between text-muted-foreground">
                                    <span>Parent 2 (Niv. {parent2Lvl})</span>
                                    <span className="text-foreground">+{(parent2Lvl * 0.15).toFixed(1)}%</span>
                                </div>
                                {useOptimakina && (
                                    <div className="py-2 flex justify-between text-muted-foreground">
                                        <span>Optimakina 3.7</span>
                                        <span className="text-foreground">+20.0%</span>
                                    </div>
                                )}
                                {useTakeza && (
                                    <div className="py-2 flex justify-between text-muted-foreground">
                                        <span>Almanax Takeza</span>
                                        <span className="text-foreground">+20.0%</span>
                                    </div>
                                )}
                                <div className="py-2.5 flex justify-between font-bold text-foreground text-sm">
                                    <span>Total Calculé</span>
                                    <span>{rawTotalChance.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Conseil technique d'élevage */}
                            <div className="p-4 rounded-lg border border-border bg-surface/60 text-xs space-y-1.5">
                                <span className="font-bold text-foreground block">{l10n.results.optimalLevelTip}</span>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {l10n.results.optimalLevelDesc}
                                </p>
                                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                                    <span>Cumul requis :</span>
                                    <span className="font-bold text-foreground">
                                        {totalLevelsNeeded} niveaux (ex: {avgLevelNeeded} + {Math.max(0, totalLevelsNeeded - avgLevelNeeded)})
                                    </span>
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
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {l10n.sereniteTool.title}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {l10n.sereniteTool.desc}
                                </p>
                            </div>

                            {/* Curseur de sérénité */}
                            <div className="space-y-4 p-4 rounded-lg border border-border bg-surface/50">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-foreground">{l10n.sereniteTool.currentSerenity}</span>
                                    <span className="font-mono text-sm font-bold text-foreground px-2 py-0.5 rounded bg-muted/60 border border-border/50">
                                        {currentSerenity > 0 ? `+${currentSerenity}` : currentSerenity}
                                    </span>
                                </div>

                                <input
                                    type="range"
                                    min="-5000"
                                    max="5000"
                                    step="50"
                                    value={currentSerenity}
                                    onChange={(e) => setCurrentSerenity(parseInt(e.target.value, 10))}
                                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
                                />

                                {/* 3 Plages de sérénité sobres */}
                                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                                    <div className={`p-2.5 rounded-lg border transition-all ${
                                        currentSerenity < -2000 
                                            ? "bg-surface border-foreground text-foreground font-bold shadow-xs" 
                                            : "bg-surface/30 border-border text-muted-foreground"
                                    }`}>
                                        <span className="block font-semibold">Endurance</span>
                                        <span className="text-[10px] text-muted-foreground">-5 000 à -2 000</span>
                                    </div>

                                    <div className={`p-2.5 rounded-lg border transition-all ${
                                        currentSerenity >= -2000 && currentSerenity <= 2000 
                                            ? "bg-surface border-foreground text-foreground font-bold shadow-xs" 
                                            : "bg-surface/30 border-border text-muted-foreground"
                                    }`}>
                                        <span className="block font-semibold">Maturité</span>
                                        <span className="text-[10px] text-muted-foreground">-2 000 à +2 000</span>
                                    </div>

                                    <div className={`p-2.5 rounded-lg border transition-all ${
                                        currentSerenity > 2000 
                                            ? "bg-surface border-foreground text-foreground font-bold shadow-xs" 
                                            : "bg-surface/30 border-border text-muted-foreground"
                                    }`}>
                                        <span className="block font-semibold">Amour</span>
                                        <span className="text-[10px] text-muted-foreground">+2 000 à +5 000</span>
                                    </div>
                                </div>
                            </div>

                            {/* Choix de l'objectif */}
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                    {l10n.sereniteTool.targetZone}
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("endurance")}
                                        className={`p-3 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                                            targetZone === "endurance"
                                                ? "border-foreground bg-surface text-foreground shadow-xs"
                                                : "border-border bg-surface/30 text-muted-foreground hover:text-foreground hover:bg-surface/60"
                                        }`}
                                    >
                                        Endurance (&lt; -2 000)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("maturite")}
                                        className={`p-3 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                                            targetZone === "maturite"
                                                ? "border-foreground bg-surface text-foreground shadow-xs"
                                                : "border-border bg-surface/30 text-muted-foreground hover:text-foreground hover:bg-surface/60"
                                        }`}
                                    >
                                        Maturité ([-2 000, +2 000])
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTargetZone("amour")}
                                        className={`p-3 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                                            targetZone === "amour"
                                                ? "border-foreground bg-surface text-foreground shadow-xs"
                                                : "border-border bg-surface/30 text-muted-foreground hover:text-foreground hover:bg-surface/60"
                                        }`}
                                    >
                                        Amour (&gt; +2 000)
                                    </button>
                                </div>
                            </div>

                            {/* Choix du Tier de Carburant */}
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                    {l10n.sereniteTool.tierSelect} (Efficacité doublée 3.7)
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {(Object.keys(XP_TIERS) as unknown as CatalystTier[]).map((tierNum) => {
                                        const tInfo = XP_TIERS[tierNum];
                                        const isSelected = catalystTier === tierNum;
                                        return (
                                            <button
                                                key={tierNum}
                                                type="button"
                                                onClick={() => setCatalystTier(tierNum)}
                                                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                                                    isSelected
                                                        ? "border-foreground bg-surface text-foreground shadow-xs"
                                                        : "border-border bg-surface/30 text-muted-foreground hover:text-foreground hover:bg-surface/60"
                                                }`}
                                            >
                                                <div className="w-7 h-7 shrink-0 rounded bg-background border border-border p-0.5 flex items-center justify-center">
                                                    <Image
                                                        src={tInfo.img}
                                                        alt={tInfo.name}
                                                        width={24}
                                                        height={24}
                                                        unoptimized
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="block font-bold text-xs truncate">{tInfo.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono block">
                                                        {tierNum * 20} pts/10s
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Verdict de Chrono & Consignes */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Horodateur d'Enclos 3.7
                            </h3>

                            <div className="p-5 rounded-lg border border-border bg-surface/50 space-y-2 text-center">
                                <span className="text-xs text-muted-foreground font-medium block">{l10n.sereniteTool.timeNeeded}</span>
                                <div className="text-3xl font-extrabold text-foreground font-mono tracking-tight">
                                    {distanceToRange === 0 ? "Déjà atteint" : `${minutesToTarget} min`}
                                </div>
                                <span className="text-[11px] text-muted-foreground block font-mono">
                                    Écart à combler : {distanceToRange} points
                                </span>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Actionneur requis :</span>
                                    <strong className="text-foreground font-mono block mt-0.5">{requiredAction}</strong>
                                </div>

                                <div className="p-3.5 rounded-lg border border-border bg-surface/60 space-y-1 text-muted-foreground text-[11px]">
                                    <strong className="text-foreground block">⚠️ Vigilance Sur-Dérive (3.7)</strong>
                                    <p className="leading-relaxed">
                                        Retirez votre monture dès que l'horloge atteint zéro pour éviter de basculer dans l'extrême opposé.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ONGLET 3 : CALCULATEUR XP & DURABILITÉ ───────────────────── */}
            {activeTab === "xp" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {l10n.xpTool.title}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {l10n.xpTool.desc}
                                </p>
                            </div>

                            {/* Paliers de niveau */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border border-border bg-surface/50 space-y-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold">{l10n.xpTool.currentLvl}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="199"
                                        value={startLvl}
                                        onChange={(e) => setStartLvl(Math.max(1, Math.min(199, parseInt(e.target.value, 10) || 1)))}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:border-foreground font-mono"
                                    />
                                </div>
                                <div className="p-4 rounded-lg border border-border bg-surface/50 space-y-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold">{l10n.xpTool.targetLvl}</span>
                                    <input
                                        type="number"
                                        min="2"
                                        max="200"
                                        value={targetLvl}
                                        onChange={(e) => setTargetLvl(Math.max(2, Math.min(200, parseInt(e.target.value, 10) || 200)))}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:border-foreground font-mono"
                                    />
                                </div>
                            </div>

                            {/* Raccourcis de paliers */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="text-muted-foreground font-medium">Paliers :</span>
                                <button
                                    type="button"
                                    onClick={() => { setStartLvl(1); setTargetLvl(100); }}
                                    className="px-2.5 py-1 rounded border border-border bg-surface/50 hover:bg-surface text-foreground font-mono transition-colors cursor-pointer"
                                >
                                    Lvl 1 ➔ 100
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setStartLvl(1); setTargetLvl(167); }}
                                    className="px-2.5 py-1 rounded border border-border bg-surface/50 hover:bg-surface text-foreground font-mono font-semibold transition-colors cursor-pointer"
                                >
                                    Lvl 1 ➔ 167 (Seuil Optimakina)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setStartLvl(1); setTargetLvl(200); }}
                                    className="px-2.5 py-1 rounded border border-border bg-surface/50 hover:bg-surface text-foreground font-mono transition-colors cursor-pointer"
                                >
                                    Lvl 1 ➔ 200 (Max)
                                </button>
                            </div>

                            {/* Capacité Sage */}
                            <label className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                                hasSage ? "border-border-strong bg-surface" : "border-border bg-surface/30 hover:bg-surface/60"
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={hasSage}
                                    onChange={(e) => setHasSage(e.target.checked)}
                                    className="mt-1 rounded text-foreground focus:ring-0 w-4 h-4 shrink-0"
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-foreground">{l10n.xpTool.hasSage}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">
                                            XP ×2
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                        Double tout le gain d'XP en mangeoire. Permet d'atteindre le niveau 200 en ~30h chrono.
                                    </p>
                                </div>
                            </label>

                            {/* Sélecteur de Génération pour les Génétons */}
                            <div className="space-y-2.5 pt-2 border-t border-border">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground uppercase tracking-wider font-semibold">{l10n.xpTool.genSelect}</span>
                                    <span className="font-mono text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
                                        <Image src="/images/guides/elevage/geneton.png" alt="" width={15} height={15} unoptimized className="object-contain" />
                                        <span>Génération {selectedGen} (+{currentGenetons} Génétons)</span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((gen) => {
                                        const isSelected = selectedGen === gen;
                                        return (
                                            <button
                                                key={gen}
                                                type="button"
                                                onClick={() => setSelectedGen(gen)}
                                                className={`py-2 rounded border text-xs font-mono font-semibold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "border-foreground bg-foreground text-background shadow-xs"
                                                        : "border-border bg-surface/40 text-muted-foreground hover:text-foreground hover:bg-surface"
                                                }`}
                                            >
                                                G{gen}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Synthèse Droite */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-border bg-surface/40 space-y-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Synthèse de Production
                            </h3>

                            <div className="divide-y divide-border/60 text-xs font-mono">
                                <div className="py-2.5 flex justify-between text-muted-foreground">
                                    <span>XP Requise</span>
                                    <span className="text-foreground font-bold">{xpNeeded.toLocaleString()} XP</span>
                                </div>
                                <div className="py-2.5 flex justify-between text-muted-foreground">
                                    <span>Temps estimé ({XP_TIERS[catalystTier].name})</span>
                                    <span className="text-foreground font-bold">{hoursXp}h (~{daysXp}j)</span>
                                </div>
                                <div className="py-2.5 flex justify-between items-center text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Image src="/images/guides/elevage/geneton.png" alt="" width={14} height={14} unoptimized className="object-contain" />
                                        <span>Génétons à l'accouplement</span>
                                    </span>
                                    <span className="text-foreground font-bold">+{currentGenetons} Génétons</span>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-lg border border-border bg-surface/60 text-[11px] text-muted-foreground space-y-1">
                                <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                                    <Image src="/images/guides/elevage/geneton.png" alt="" width={14} height={14} unoptimized className="object-contain" />
                                    <span>Astuce Génétons 3.7</span>
                                </span>
                                <p className="leading-relaxed">
                                    Les Génétons sont attribués seulement si le bébé dépasse tous les ancêtres. Au palier 9 et 10, le gain atteint 500 Génétons par portée.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ONGLET 4 : ARBRES & MATRICE DE CROISEMENTS ───────────────── */}
            {activeTab === "arbres" && (
                <div className="space-y-8">
                    {/* SIMULATEUR DE CROISEMENT DIRECT AVEC SCROLL PROPRE */}
                    <div 
                        id="simulateur-croisement"
                        ref={simulatorRef}
                        className={`scroll-mt-24 p-6 rounded-xl border transition-all duration-300 space-y-5 ${
                            flashSimulator 
                                ? "border-foreground ring-2 ring-foreground/20 bg-surface shadow-md" 
                                : "border-border bg-surface/40"
                        }`}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-foreground">
                                    {l10n.treesTool.crossSimulatorTitle} — {FAMILY_CONFIG[selectedFamily].name}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {l10n.treesTool.crossSimulatorDesc}
                                </p>
                            </div>
                        </div>

                        {/* Sélecteurs des deux parents */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                                <MountSelectCombobox
                                    value={matrixParent1}
                                    onChange={setMatrixParent1}
                                    mounts={familyMounts}
                                    label={l10n.treesTool.selectParent1}
                                    genderLabel="♂ Mâle"
                                />
                            </div>

                            <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                                <MountSelectCombobox
                                    value={matrixParent2}
                                    onChange={setMatrixParent2}
                                    mounts={familyMounts}
                                    label={l10n.treesTool.selectParent2}
                                    genderLabel="♀ Femelle"
                                />
                            </div>
                        </div>

                        {/* Résultat du croisement direct */}
                        <div className="p-4 rounded-lg border border-border bg-surface/50 space-y-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                {l10n.treesTool.possibleOutcomes}
                            </span>

                            {potentialMutation ? (
                                <div className="p-4 rounded-lg border border-border bg-surface/80 space-y-3 shadow-xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/60 text-foreground font-semibold border border-border/50">
                                            Mutation Débloquée (Gen {potentialMutation.generation})
                                        </span>
                                        <span className="text-xs font-mono font-bold text-foreground">
                                            {totalChance}% de chance
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-3.5 pt-1">
                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={potentialMutation.img}
                                                alt={potentialMutation.name}
                                                width={40}
                                                height={40}
                                                unoptimized
                                                className="object-contain"
                                            />
                                        </div>
                                        <div className="min-w-0 space-y-1.5 flex-1">
                                            <h3 className="text-sm font-bold text-foreground">
                                                {potentialMutation.name}
                                            </h3>
                                            <div>
                                                <MountStatBadges stats={potentialMutation.stats} variant="badges" />
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-mono pt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                                                <span className="inline-flex items-center gap-1">
                                                    <Image src="/images/guides/elevage/geneton.png" alt="" width={13} height={13} unoptimized className="object-contain" />
                                                    <span>+{GENETON_TABLE[potentialMutation.generation] || 1} Génétons</span>
                                                </span>
                                                <span>•</span>
                                                <span>{potentialMutation.type === "pure" ? l10n.treesTool.pureRace : l10n.treesTool.bicoloreRace}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : isSameBreed ? (
                                <div className="p-4 rounded-lg border border-border bg-surface/60 space-y-1 text-xs">
                                    <span className="font-bold text-foreground block">Lignée Identique</span>
                                    <p className="text-muted-foreground leading-relaxed">
                                        100% {parent1Info.name} (si arbre pur). Stabilise et purifie un arbre généalogique.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg border border-border bg-surface/60 space-y-1 text-xs">
                                    <span className="font-bold text-foreground block">Croisement sans mutation directe</span>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Ce croisement ne débloque pas de nouvelle race au palier supérieur. La descendance se répartit entre {parent1Info.name} et {parent2Info.name}.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CATALOGUE DES MONTURES & RECHERCHE */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    {l10n.treesTool.title} — {FAMILY_CONFIG[selectedFamily].name}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {filteredMounts.length} montures répertoriées. Cliquez sur une recette pour la simuler instantanément.
                                </p>
                            </div>
                        </div>

                        {/* Barre de recherche */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={l10n.treesTool.searchPlaceholder}
                                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-lg bg-surface/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                            />
                        </div>

                        {/* Filtres de Générations sobres */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-mono">
                            <button
                                type="button"
                                onClick={() => setSelectedGenFilter("all")}
                                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                                    selectedGenFilter === "all"
                                        ? "bg-foreground text-background font-bold"
                                        : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Toutes
                            </button>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((gen) => (
                                <button
                                    key={gen}
                                    type="button"
                                    onClick={() => setSelectedGenFilter(gen)}
                                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                                        selectedGenFilter === gen
                                            ? "bg-foreground text-background font-bold"
                                            : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    G{gen}
                                </button>
                            ))}
                        </div>

                        {/* Filtres de Stats sobres */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                            <button
                                type="button"
                                onClick={() => setSelectedStatTag("all")}
                                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                    selectedStatTag === "all"
                                        ? "bg-foreground text-background font-bold"
                                        : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Toutes les stats
                            </button>
                            {(["pm", "pa", "po", "vita", "stats", "puissance", "invoc", "ini", "prosp", "cc", "sagesse", "res"] as StatTag[]).map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedStatTag(tag)}
                                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                        selectedStatTag === tag
                                            ? "bg-foreground text-background font-bold"
                                            : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {tag === "pm" ? "+1 PM" : tag === "pa" ? "+1 PA" : tag === "po" ? "+1 PO" : tag === "vita" ? "Vitalité" : tag === "stats" ? "Caractéristique" : tag === "puissance" ? "Puissance" : tag === "invoc" ? "Invocation" : tag === "ini" ? "Initiative" : tag === "prosp" ? "Prospection" : tag === "cc" ? "Coup Critique" : tag === "sagesse" ? "Sagesse" : "Résistances"}
                                </button>
                            ))}
                        </div>

                        {/* Grille des montures */}
                        {filteredMounts.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                                Aucune monture ne correspond à vos critères de recherche.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                                {filteredMounts.map((mount) => {
                                    const genetons = GENETON_TABLE[mount.generation] || 1;
                                    return (
                                        <div
                                            key={mount.id}
                                            className="p-4 rounded-lg border border-border bg-surface/40 hover:bg-surface/80 hover:border-border-strong transition-all flex flex-col justify-between space-y-3.5 shadow-2xs group"
                                        >
                                            <div className="space-y-2.5">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-12 h-12 shrink-0 rounded-md bg-background border border-border p-1 flex items-center justify-center overflow-hidden">
                                                        <Image
                                                            src={mount.img}
                                                            alt={mount.name}
                                                            width={40}
                                                            height={40}
                                                            unoptimized
                                                            className="object-contain"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50 uppercase">
                                                                Gen {mount.generation}
                                                            </span>
                                                            <span className="text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1">
                                                                <Image src="/images/guides/elevage/geneton.png" alt="" width={12} height={12} unoptimized className="object-contain" />
                                                                <span>+{genetons}</span>
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-foreground truncate block pt-0.5">
                                                            {mount.name}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div>
                                                    <MountStatBadges stats={mount.stats} variant="compact" />
                                                </div>
                                            </div>

                                            {/* Action & Recette */}
                                            <div className="pt-2.5 border-t border-border/60 space-y-2">
                                                {mount.parents ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                                            <span>Croisement :</span>
                                                            <span className="text-foreground font-semibold truncate max-w-[65%]">
                                                                {mount.parents[0].replace(/Dragodinde |Muldo |Volkorne /g, "")} + {mount.parents[1].replace(/Dragodinde |Muldo |Volkorne /g, "")}
                                                            </span>
                                                        </div>

                                                        {/* Bouton CTA propre, style landing */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLoadRecipe(mount.parents![0], mount.parents![1])}
                                                            className="reg-btn reg-btn-secondary !min-h-0 w-full py-1.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <GitMerge className="w-3.5 h-3.5" />
                                                            <span>Simuler ce croisement</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 pt-0.5">
                                                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                                            <span>Lignée :</span>
                                                            <span className="text-foreground font-semibold">Race Pure Sauvage</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLoadRecipe(mount.name, matrixParent2)}
                                                            className="reg-btn reg-btn-secondary !min-h-0 w-full py-1.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100"
                                                        >
                                                            <GitMerge className="w-3.5 h-3.5" />
                                                            <span>Utiliser comme parent</span>
                                                        </button>
                                                    </div>
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
