"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getClassName, processDofusbookRawData, dofusbookItemIconUrl, dofusbookItemIconId, dofusbookCharacteristicRows, DOFUSBOOK_STAT_LABELS as statLabelMapping, type DofusbookPreviewData, type DofusbookItem } from "@/lib/dofusbook-utils";
import { bakeDofusbookFromBrowser } from "@/lib/dofusbook-client-bake";
import { ExternalLink, Users, Loader2, Zap, Move, Shield, Sparkles, RefreshCw, Copy, X } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { TagWithIcons } from "@/components/gallery/gallery-filters";
import { getClassColor } from "@/components/shared/class-icon";
import { resolveDofusStatTheme, dofusStatAssetUrl } from "@/lib/dofus-stats-theme";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DofusSpellsTab } from "@/components/dofus/dofus-spells-tab";
import { DofusbookSimulationTab } from "@/components/dofus/dofusbook-simulation-tab";
import type { BuildStatsForSpells } from "@/lib/dofus-spells";
import { getRuneForStat } from "@/lib/dofus-runes";
import { ItemVariantModal } from "@/components/dofus/item-variant-modal";
import { applyVariantsToBuild } from "@/lib/dofus-variant-utils";
import { getPassiveDescription } from "@/lib/dofus-passives";

/** Icônes des onglets : vrais assets du jeu (aucune illustration IA). */
const BUILD_TABS = [
    { id: "build", label: "Build", icon: "/assets/dofus/game-icons/crossed-swords.png" },
    { id: "sorts", label: "Sorts", icon: "/assets/dofus-ui/pictos/sort.png" },
    { id: "equipement", label: "Équipement", icon: "/assets/dofus/game-icons/chest.png" },
    { id: "simulation", label: "Simulation", icon: "/assets/dofus-ui/pictos/combat-tactique.png" },
] as const;

type BuildTabId = (typeof BUILD_TABS)[number]["id"];

type ClothData = { name: string; count: number; total: number; clothItems?: DofusbookItem[]; bonuses?: Record<string, number> };

/**
 * `statLabelMapping` est importé sous cet alias depuis `@/lib/dofusbook-utils`
 * (`DOFUSBOOK_STAT_LABELS`) : table **pure et testée** (codes réels des payloads
 * Dofusbook, libellés ancrés sur le référentiel DofusDB). Ne pas la redéclarer ici.
 */

interface DofusbookPreviewProps {
    url: string;
    title?: string;
    className?: string;
    tags?: string[];
    classId?: number;
    initialData?: DofusbookPreviewData;
    /** Guilde courante : permet d'**enregistrer** les données récupérées par le navigateur. */
    guildId?: string;
}

const parseDofusbookSmithmagic = (smithmagic: any, items: any) => {
    if (!smithmagic || typeof smithmagic !== "object") return [];
    
    const entries: Array<{
        stat: string;
        value: number;
        slotKey: string;
        itemName: string;
        itemImage: string;
    }> = [];
    
    const slotMapping: Record<string, string> = {
        "1": "coiffe", "2": "cape", "3": "amulette", "4": "anneau1",
        "5": "anneau2", "6": "ceinture", "7": "bottes", "8": "corps-a-corps",
        "9": "bouclier", "15": "familier"
    };
    
    for (const [slotKey, fmStats] of Object.entries(smithmagic)) {
        if (!fmStats || typeof fmStats !== "object") continue;
        
        const resolvedSlot = slotMapping[slotKey] || slotKey;
        const item = items?.[slotKey];
        if (!item) continue;

        // ⚠️ IconId DofusDB (`picture`) — l'id interne Dofusbook affichait une autre icône.
        const iconId = dofusbookItemIconId(item);
        
        for (const [statKey, val] of Object.entries(fmStats as Record<string, any>)) {
            const numVal = Number(val);
            if (!numVal || numVal === 0) continue;
            
            entries.push({
                stat: statLabelMapping[statKey] || statKey,
                value: numVal,
                slotKey: resolvedSlot,
                itemName: item.name || "Équipement",
                itemImage: iconId ? dofusbookItemIconUrl(iconId) : ""
            });
        }
    }
    
    return entries;
};

const getIconId = (id: number) => id === 19 ? 20 : id;

/** Convertit un `DofusbookPreviewData` en stats exploitables par `computeSpellDamage`. */
function spellsBuild(data: DofusbookPreviewData): BuildStatsForSpells {
    return {
        elements: {
            fo: data.elements?.fo ?? 0,
            in: data.elements?.in ?? 0,
            ch: data.elements?.ch ?? 0,
            ag: data.elements?.ag ?? 0,
            sa: data.elements?.sa ?? 0,
            pu: data.elements?.pu ?? 0,
        },
        damages: {
            neutre: data.damages?.neutre ?? 0,
            terre: data.damages?.terre ?? 0,
            feu: data.damages?.feu ?? 0,
            eau: data.damages?.eau ?? 0,
            air: data.damages?.air ?? 0,
            general: data.damages?.general ?? 0,
            critique: data.damages?.critique ?? 0,
            poussee: data.damages?.poussee ?? 0,
            armes: data.damages?.armes ?? 0,
            sorts: data.damages?.sorts ?? 0,
            melee: data.damages?.melee ?? 0,
            distance: data.damages?.distance ?? 0,
        },
    };
}

const SLOT_LABELS: Record<string, string> = {
    am: "Amulette", ca: "Cape", ch: "Coiffe", ce: "Ceinture", bo: "Bottes",
    a1: "Anneau 1", a2: "Anneau 2", ar: "Arme", fa: "Familier", mo: "Monture",
    br: "Bouclier", d1: "Dofus 1", d2: "Dofus 2", d3: "Dofus 3", d4: "Dofus 4", d5: "Dofus 5", d6: "Dofus 6",
};

/**
 * Icône d'item 100 % interne : proxy auto-siphon (aucun hotlink Dofusbook/DofusDB).
 * L'id utilisé est l'`iconId` DofusDB (`item.picture`) — jamais l'id interne Dofusbook
 * ni l'id Ankama, qui produisaient des icônes d'autres items (voir `dofusbookItemIconId`).
 */
function ItemIcon({ item, size = 44, className }: { item: DofusbookItem; size?: number; className?: string }) {
    const iconId = dofusbookItemIconId(item);
    if (!iconId) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={dofusbookItemIconUrl(iconId)}
            alt={item.name}
            width={size}
            height={size}
            loading="lazy"
            className={cn("object-contain", className)}
        />
    );
}

export type SelectedBuildItem = { item: DofusbookItem; slotLabel: string };

/** Modale interne d'item : infos + effets du build + forgemagie, assets du jeu, aucun lien externe. */
function ItemDetailModal({
    selection,
    clothName,
    fmLines,
    onClose,
}: {
    selection: SelectedBuildItem;
    clothName?: string | null;
    fmLines?: Array<{ stat: string; value: number }>;
    onClose: () => void;
}) {
    const { item, slotLabel } = selection;
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={item.name}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-background border border-border rounded-[4px] p-5 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-[4px] bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                        <ItemIcon item={item} size={48} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{slotLabel}</p>
                        <h4 className="text-base font-bold text-foreground leading-tight">{item.name}</h4>
                        <p className="text-caption text-muted-foreground mt-0.5">
                            {[item.typeName, typeof item.level === "number" ? `Niv. ${item.level}` : null, clothName].filter(Boolean).join(" · ") || "Équipement du build"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer"
                        className="p-1.5 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {(() => {
                    const passiveDesc = getPassiveDescription(item.name);
                    const regularEffects = (item.effects || []).filter((fx) => fx.code !== "sp");
                    const hasPassive = !!passiveDesc || (item.effects || []).some((fx) => fx.code === "sp");

                    return (
                        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                            {/* Pouvoir Passif Officiel (Dofus, Prymaradites, etc.) */}
                            {hasPassive && (
                                <div className="flex flex-col gap-1.5 p-3 rounded-[6px] bg-warning/10 border border-warning/25">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-warning uppercase tracking-wide">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        <span>Pouvoir Passif</span>
                                    </div>
                                    <p className="text-caption font-medium text-foreground leading-relaxed">
                                        {passiveDesc || "Effet passif unique déclenché en combat."}
                                    </p>
                                </div>
                            )}

                            {/* Effets & Caractéristiques numériques standard */}
                            {regularEffects.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {regularEffects.map((fx) => {
                                        const theme = resolveDofusStatTheme(null, null, fx.code, null);
                                        const label = statLabelMapping[fx.code] || fx.code;
                                        const range = fx.min !== fx.max ? `${fx.min}–${fx.max}` : `${fx.value}`;
                                        return (
                                            <div key={fx.code} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                                                <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground min-w-0">
                                                    {theme && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={dofusStatAssetUrl(theme.asset)} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                                    )}
                                                    <span className="truncate">{label}</span>
                                                </span>
                                                <span className="font-bold tabular-nums text-caption text-foreground whitespace-nowrap ml-2">
                                                    {fx.value > 0 && fx.min === fx.max ? `+${range}` : range}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !hasPassive ? (
                                <p className="text-caption text-muted-foreground">
                                    Caractéristiques détaillées non exposées par ce build.
                                </p>
                            ) : null}
                        </div>
                    );
                })()}

                {fmLines && fmLines.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Forgemagie sur cet objet</p>
                        <div className="flex flex-wrap gap-1.5">
                            {fmLines.map((fm, i) => {
                                const rune = getRuneForStat(fm.stat, fm.value);
                                return (
                                    <span
                                        key={i}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-[4px] text-[11px] font-bold tabular-nums",
                                            rune.isExo ? "bg-warning/15 border-warning/30 text-warning" : "bg-elevated border-border text-foreground"
                                        )}
                                        title={rune.runeName}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={rune.assetUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                        <span>{fm.value > 0 ? `+${fm.value}` : fm.value} {fm.stat}</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Grille d'équipement détaillée pour l'onglet « Équipement » (clic = modale interne). */
function EquipmentGrid({
    items,
    variants = {},
    onSelect,
    onOpenVariant,
}: {
    items?: Record<string, DofusbookItem | null>;
    variants?: Record<string, DofusbookItem>;
    onSelect: (sel: SelectedBuildItem) => void;
    onOpenVariant?: (slot: string) => void;
}) {
    if (!items || Object.keys(items).length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-[4px] border border-border text-center gap-5">
                <div className="w-16 h-16 rounded-[4px] bg-surface border border-border flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="max-w-xs">
                    <h4 className="text-lg font-bold text-foreground uppercase mb-2">Aucun équipement</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Les données d'équipement n'ont pas encore été chargées pour ce build.
                    </p>
                </div>
            </div>
        );
    }

    const entries = Object.entries(items).filter(([, it]) => !!it) as [string, DofusbookItem][];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {entries.map(([slot, item]) => {
                const isVariant = !!variants[slot];
                return (
                    <div key={slot} className="relative group/eq flex items-center">
                        <button
                            type="button"
                            onClick={() => onSelect({ item, slotLabel: SLOT_LABELS[slot] || slot })}
                            className={cn(
                                "flex-1 flex items-center gap-3 bg-surface p-3 rounded-[4px] border transition-colors group text-left cursor-pointer",
                                isVariant
                                    ? "border-warning/60 bg-warning/5"
                                    : "border-border hover:border-border-strong hover:bg-elevated"
                            )}
                        >
                            <div className="w-12 h-12 bg-elevated border border-border rounded-[4px] flex items-center justify-center overflow-hidden shrink-0 relative">
                                <ItemIcon item={item} size={44} />
                                {isVariant && (
                                    <span className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-warning text-[8px] font-black text-black">
                                        VAR
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 pr-14">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                    {SLOT_LABELS[slot] || slot} {isVariant && "• Variante active"}
                                </p>
                                <p className="text-label font-bold text-foreground truncate">{item.name}</p>
                            </div>
                        </button>
                        {onOpenVariant && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenVariant(slot);
                                }}
                                title={`Changer la variante (${SLOT_LABELS[slot] || slot})`}
                                className={cn(
                                    "absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded border text-caption font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer",
                                    isVariant
                                        ? "bg-warning text-black border-warning font-black"
                                        : "bg-surface border-border hover:bg-elevated text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span>⇄</span>
                                <span className="text-[10px] hidden sm:inline">Variante</span>
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Slot d'équipement : clic = modale interne (plus aucun lien DofusDB) + bouton switch variante. */
function GearSlotItem({
    slot,
    item,
    label,
    isVariant,
    onSelect,
    onOpenVariant,
}: {
    slot: string;
    item: DofusbookItem | null | undefined;
    label: string;
    isVariant?: boolean;
    onSelect?: (sel: SelectedBuildItem) => void;
    onOpenVariant?: (slot: string) => void;
}) {
    return (
        <div className="relative group/slot-container">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        disabled={!item}
                        onClick={() => item && onSelect?.({ item, slotLabel: label })}
                        aria-label={item ? `${label} : ${item.name}` : `${label} vide`}
                        className={cn(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-[4px] flex items-center justify-center p-1.5 relative transition-colors group/slot",
                            isVariant
                                ? "bg-warning/10 border-2 border-warning shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:bg-warning/15 cursor-pointer"
                                : item
                                  ? "bg-surface border border-border hover:border-border-strong hover:bg-elevated cursor-pointer"
                                  : "bg-surface/30 border border-border/30 opacity-30 cursor-default"
                        )}
                    >
                        {item ? (
                            <ItemIcon item={item} size={48} />
                        ) : (
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-50">
                                {slot}
                            </span>
                        )}
                        {isVariant && (
                            <span className="absolute -top-1.5 -left-1.5 px-1 py-0.2 rounded bg-warning text-[8px] font-black text-black uppercase shadow-xs">
                                VAR
                            </span>
                        )}
                    </button>
                </TooltipTrigger>
                {item && (
                    <TooltipContent className="bg-background border border-border text-foreground p-2 rounded-[4px] max-w-[220px] text-center" side="top">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                            {label} {isVariant && "• Variante active"}
                        </p>
                        <p className="font-bold text-body-sm text-foreground">{item.name}</p>
                    </TooltipContent>
                )}
            </Tooltip>

            {/* Bouton switch / variante (style Duffus) */}
            {onOpenVariant && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenVariant(slot);
                    }}
                    title={`Changer de variante pour ${label}`}
                    aria-label={`Changer de variante pour ${label}`}
                    className={cn(
                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all z-20 shadow-md cursor-pointer",
                        isVariant
                            ? "bg-warning text-black hover:scale-110 ring-1 ring-background"
                            : "bg-surface border border-border text-muted-foreground hover:bg-elevated hover:text-foreground hover:scale-110 opacity-70 group-hover/slot-container:opacity-100"
                    )}
                >
                    ⇄
                </button>
            )}
        </div>
    );
}

export const DofusbookPreview = memo(function DofusbookPreview({ url, title, className, tags = [], classId, initialData, guildId }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [lastRefresh, setLastRefresh] = useState(0);
    const [activeTab, setActiveTab] = useState<BuildTabId>("build");
    // Item sélectionné pour la modale interne (aucun appel réseau : données du build).
    const [selected, setSelected] = useState<SelectedBuildItem | null>(null);

    // Système de variantes d'équipement interactives (0 synchro Dofusbook destructive)
    const [variants, setVariants] = useState<Record<string, DofusbookItem>>({});
    const [variantModalSlot, setVariantModalSlot] = useState<string | null>(null);

    /** Build effectif avec les variantes appliquées (données Dofusbook d'origine préservées). */
    const effectiveData = useMemo(() => {
        if (!data) return null;
        return applyVariantsToBuild(data, variants) ?? data;
    }, [data, variants]);

    /**
     * Stats du build pour les sorts & la simulation — recalculées instantanément avec les variantes.
     */
    const buildForSpells = useMemo(() => spellsBuild((effectiveData ?? {}) as DofusbookPreviewData), [effectiveData]);

    const idMatch = url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
    const buildId = idMatch ? (idMatch[1] || idMatch[2]) : null;

    const fetchBuild = async (force: boolean = false, silent: boolean = false) => {
        if (!buildId) return;

        if (force) {
            const now = Date.now();
            const cooldown = 30000; // 30s
            if (now - lastRefresh < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastRefresh)) / 1000);
                toast.error(`Veuillez attendre ${remaining}s avant de rafraîchir à nouveau`);
                return;
            }
            setLastRefresh(now);
        }

        if (!silent) setLoading(true);
        try {
            // 1) Bake « navigateur » : Dofusbook (Cloudflare) refuse les clients serveur
            //    → seul un vrai navigateur passe. Il appelle le worker CF via une URL
            //    signée, puis les données sont enregistrées côté serveur (profil propriétaire).
            const baked = await bakeDofusbookFromBrowser(url, guildId);
            if (baked.ok) {
                setData(baked.data);
                if (force && !silent) {
                    toast.success(baked.persisted ? "Données actualisées" : "Données actualisées (affichage seul)");
                }
                return;
            }

            // 2) Repli : proxy serveur (cache Redis 24 h / données « stale »)
            const response = await fetch(`/api/dofusbook/proxy/${buildId}`, {
                headers: force ? { "Cache-Control": "no-cache" } : {}
            });

            if (response.headers.get("X-Throttled") === "true") {
                toast.info("Données déjà à jour (cache récent)");
            }

            if (response.ok) {
                const raw = await response.json();
                if (raw) {
                    setData(processDofusbookRawData(buildId, raw));
                    if (force && response.headers.get("X-Throttled") !== "true" && !silent) {
                        toast.success("Données actualisées");
                    }
                }
            } else if (force && !silent) {
                // 403 / 429 / 5xx = Dofusbook refuse l'appel serveur (challenge anti-bot) :
                // on conserve les dernières données connues.
                toast.warning(baked.error || "Dofusbook bloque temporairement les requêtes — dernières données connues conservées.");
            }
        } catch (err) {
            if (force && !silent) toast.error("Erreur réseau");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!buildId) { setLoading(false); return; }
        if (!initialData) {
            fetchBuild(false);
            return;
        }
        // Données au vieux format (sans effets d'items pour la modale) :
        // refresh silencieux via le cache brut (aucun appel Dofusbook).
        if ((initialData as { v?: number }).v !== 2) {
            fetchBuild(false, true);
        } else {
            setLoading(false);
        }
    }, [buildId, initialData]);

    /**
     * Détail Total / ⚡ / Base / Parcho par caractéristique primaire (colonnes du panneau
     * Dofusbook). Vide pour une préview au format antérieur (sans `characteristics`) :
     * aucun tableau plutôt que des zéros inventés — « Actualiser » régénère le détail.
     */
    const characteristicRows = useMemo(() => dofusbookCharacteristicRows(effectiveData), [effectiveData]);

    const hasData = !!data;

    const { guessedClassId } = useMemo(() => {
        const searchString = `${title} ${url.split('/').pop()} ${tags.join(' ')}`.toLowerCase();
        const classesMap: Record<string, number> = {
            "feca": 1, "osamodas": 2, "osa": 2, "enutrof": 3, "enu": 3, "sram": 4, "xelor": 5, "xel": 5,
            "ecaflip": 6, "eca": 6, "eniripsa": 7, "eni": 7, "iop": 8, "cra": 9, "sadida": 10, "sadi": 10,
            "sacrieur": 11, "sacri": 11, "pandawa": 12, "panda": 12, "roublard": 13, "roub": 13,
            "zobal": 14, "steamer": 15, "steam": 15, "eliotrope": 16, "elio": 16,
            "huppermage": 17, "hupper": 17, "ouginak": 18, "ougi": 18, "forgelance": 19, "forg": 19
        };

        let gId = classId || data?.classId || 0;
        if (!gId) {
            for (const [key, id] of Object.entries(classesMap)) {
                if (searchString.includes(key)) {
                    gId = id;
                    break;
                }
            }
        }

        return { guessedClassId: gId };
    }, [title, url, tags, classId, data?.classId]);

    const resolvedClassName = data?.className && data.className !== "Inconnu"
        ? data.className
        : (getClassName(guessedClassId) || "Classe inconnue");

    const classArtColor = useMemo(() => {
        const name = resolvedClassName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return getClassColor(name);
    }, [resolvedClassName]);

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center bg-surface/50 rounded-[2.5rem] border border-border min-h-[300px]", className)}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const cardContent = (
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-surface border border-border rounded-[4px] p-5 sm:p-6 transition-colors hover:border-border-strong cursor-pointer", className)}>

            <div className="flex flex-col gap-4 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 shrink-0 bg-background rounded-[4px] border border-border flex items-center justify-center overflow-hidden">
                        {(data?.classId || guessedClassId) > 0 ? (
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                alt={data?.className || "Class"}
                                width={38}
                                height={38}
                                className="object-contain p-0.5 relative z-10"
                            />
                        ) : (
                            <Users className="w-5 h-5 text-muted-foreground relative z-10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-sm text-foreground truncate uppercase tracking-tight leading-tight group-hover:text-success transition-colors" title={title || data?.name}>{title || data?.name || "Build Dofusbook"}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 rounded-lg bg-background border border-border/80 text-[10px] font-extrabold text-foreground tracking-tight shadow-2xs">
                                Lvl {data?.level || "???"}
                            </span>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">{resolvedClassName}</p>
                        </div>
                    </div>
                </div>

                {/* Mini Equipment Grid Preview */}
                <div className="relative aspect-square w-full bg-background p-2.5 rounded-[4px] border border-border flex items-center justify-center group-hover:border-border-strong transition-colors">

                    <TooltipProvider>
                        {hasData && data ? (
                            <div className="grid grid-cols-6 grid-rows-5 gap-1.5 relative z-10 w-full h-full p-1">
                                {/* Icône de classe centrale */}
                                {(data?.classId || guessedClassId) > 0 && (
                                    <div className="absolute top-1 inset-x-0 bottom-11 flex items-center justify-center pointer-events-none z-0">
                                        <div className="w-20 h-20 rounded-[4px] bg-elevated border border-border flex items-center justify-center relative">
                                            <NextImage
                                                src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                                alt={data?.className || "Class"}
                                                width={58}
                                                height={58}
                                                className="object-contain opacity-90"
                                            />
                                        </div>
                                    </div>
                                )}
                                {[
                                    { s: 'ch', c: 1, r: 1 }, { s: 'ca', c: 1, r: 2 }, { s: 'ce', c: 1, r: 3 }, { s: 'bo', c: 1, r: 4 },
                                    { s: 'am', c: 6, r: 1 }, { s: 'a1', c: 6, r: 2 }, { s: 'a2', c: 6, r: 3 }, { s: 'br', c: 6, r: 4 },
                                    { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                                    { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                                    { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                                ].map((slot) => {
                                    const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];
                                    const iconId = dofusbookItemIconId(item);
                                    return (
                                        <Tooltip key={slot.s}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "w-[33px] h-[33px] rounded-[4px] flex items-center justify-center p-1 relative group/mini-slot",
                                                        item ? "bg-elevated border border-border" : "bg-surface border border-border opacity-40"
                                                    )}
                                                    style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                                >
                                                    {item && iconId && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={dofusbookItemIconUrl(iconId)}
                                                            alt={item.name}
                                                            width={30}
                                                            height={30}
                                                            className="object-contain"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            {item && (
                                                <TooltipContent className="bg-background border-border text-foreground p-2 rounded-xl text-caption font-bold shadow-2xl max-w-[200px]">
                                                    {item.name}
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-muted-foreground opacity-60" />
                            </div>
                        )}
                    </TooltipProvider>
                </div>

                {/* Bandeau Stats Clés (assets du jeu) sous la grille */}
                {hasData && data && (
                    <div className="flex items-center justify-center gap-2.5 py-1 px-3 bg-surface border border-border rounded-[4px] text-caption font-bold tabular-nums">
                        <span className="flex items-center gap-1 text-foreground">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3.5 h-3.5 object-contain" loading="lazy" /> {data.stats?.pa ?? 0}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="flex items-center gap-1 text-foreground">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/dofus/stats/pm.png" alt="PM" className="w-3.5 h-3.5 object-contain" loading="lazy" /> {data.stats?.pm ?? 0}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="flex items-center gap-1 text-foreground">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3.5 h-3.5 object-contain" loading="lazy" /> {data.stats?.po ?? 0}
                        </span>
                        {(data.stats?.cc ?? 0) > 0 && (
                            <>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="flex items-center gap-1 text-foreground">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/assets/dofus/stats/critique.png" alt="Critique" className="w-3.5 h-3.5 object-contain" loading="lazy" /> {data.stats?.cc}%
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 4).map(tagId => {
                            const tagDef = DO_TAGS.find(t => t.id === tagId);
                            return tagDef ? (
                                <span key={tagId} className={cn("px-1.5 py-0.5 text-caption rounded font-black uppercase tracking-tighter inline-flex", tagDef.className)}>
                                    <TagWithIcons tag={tagDef} size={12} />
                                </span>
                            ) : null;
                        })}
                        {tags.length > 4 && (
                            <span className="px-1.5 py-0.5 text-caption rounded font-black uppercase tracking-tighter bg-surface text-muted-foreground border border-border">
                                +{tags.length - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Dialog>
            <DialogTrigger asChild>
                {cardContent}
            </DialogTrigger>
            <DialogContent className="max-w-[1600px] w-[96vw] max-h-[96vh] bg-background border-border p-0 overflow-y-auto custom-scrollbar rounded-[4px]">
                <TooltipProvider>
                    <div className="relative p-5 sm:p-6 lg:p-8 flex flex-col gap-6">
                        {/* Navigation des Onglets : Build / Sorts / Équipement */}
                        <div className="relative z-10 w-full flex items-center justify-between gap-3 bg-surface p-1.5 rounded-[4px] border border-border">
                            <div className="flex items-center gap-1.5 flex-1 max-w-2xl">
                                {BUILD_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[4px] text-label font-bold uppercase tracking-wider transition-colors cursor-pointer",
                                            activeTab === tab.id
                                                ? "bg-elevated text-foreground border border-border"
                                                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                                        )}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={tab.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" loading="lazy" />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                {Object.keys(variants).length > 0 && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/15 border border-warning/30 rounded-xl text-xs font-bold text-warning">
                                        <span>{Object.keys(variants).length} variante(s)</span>
                                        <button
                                            type="button"
                                            onClick={() => setVariants({})}
                                            className="hover:underline text-[10px] font-black text-foreground ml-1 cursor-pointer"
                                            title="Rétablir le build d'origine"
                                        >
                                            (Réinitialiser)
                                        </button>
                                    </div>
                                )}
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        fetchBuild(true);
                                    }}
                                    disabled={loading}
                                    className="bg-surface/80 border-border hover:bg-elevated text-muted-foreground hover:text-foreground rounded-xl h-9 px-3 text-caption font-bold"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
                                    Actualiser
                                </Button>
                            </div>
                        </div>

                        {/* Contenu de l'onglet actif */}
                        <div className="relative z-10 w-full">
                            {activeTab === "build" && data ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    
                                    {/* ─── COLONNE GAUCHE (4 cols) : Caractéristiques & Éléments & Résistances ─── */}
                                    <div className="lg:col-span-4 flex flex-col gap-4">
                                        
                                        {/* 1. Éléments Primaires (vraies icônes Dofus : set officiel `assets/dofus/stats/*`) */}
                                        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2">
                                            {([
                                                { label: "Vitalité", val: effectiveData?.stats?.vit ?? data.stats?.vit ?? 0, img: "/assets/dofus/stats/pv.png", text: "text-danger", bg: "bg-danger/10", border: "border-danger/20" },
                                                { label: "Sagesse", val: effectiveData?.elements?.sa ?? data.elements?.sa ?? 0, img: "/assets/dofus/stats/sagesse.png", text: "text-foreground", bg: "bg-surface", border: "border-border" },
                                                { label: "Force", val: effectiveData?.elements?.fo ?? data.elements?.fo ?? 0, img: "/assets/module-succes/terre.png", text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
                                                { label: "Intelligence", val: effectiveData?.elements?.in ?? data.elements?.in ?? 0, img: "/assets/module-succes/Intelligence.png", text: "text-danger", bg: "bg-danger/10", border: "border-danger/20" },
                                                { label: "Chance", val: effectiveData?.elements?.ch ?? data.elements?.ch ?? 0, img: "/assets/module-succes/eau.png", text: "text-info", bg: "bg-info/10", border: "border-info/20" },
                                                { label: "Agilité", val: effectiveData?.elements?.ag ?? data.elements?.ag ?? 0, img: "/assets/module-succes/Agility.png", text: "text-success", bg: "bg-success/10", border: "border-success/20" },
                                            ] as { label: string; val: number; img: string; text: string; bg: string; border: string }[]).map((el) => (
                                                <div key={el.label} className={cn("flex flex-col p-2.5 rounded-[4px] border", el.bg, el.border)}>
                                                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase">
                                                        <span>{el.label}</span>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={el.img} alt="" aria-hidden="true" className="w-4 h-4 object-contain" loading="lazy" />
                                                    </div>
                                                    <span className={cn("text-lg font-bold tabular-nums mt-0.5", el.text)}>
                                                        {el.val}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 2. Tableau des Caractéristiques de Combat */}
                                        <div className="bg-surface p-4 sm:p-5 rounded-[4px] border border-border flex flex-col gap-3">
                                            <div className="flex items-center justify-between border-b border-border pb-2">
                                                <h4 className="text-caption font-bold text-foreground/80 uppercase flex items-center gap-1.5">
                                                    <Move className="w-3.5 h-3.5 text-success" /> Statistiques Générales
                                                </h4>
                                            </div>

                                            {/* Détail des caractéristiques primaires — mêmes colonnes que le
                                                panneau Dofusbook (`+` / Base / Parcho), Puissance comprise. */}
                                            {characteristicRows.length > 0 && (
                                                <div className="flex flex-col text-caption">
                                                    <div className="grid grid-cols-[minmax(0,1fr)_3rem_2.75rem_2.75rem_2.75rem] items-center gap-x-1 pb-1 border-b border-border/60 text-[10px] font-bold uppercase text-muted-foreground">
                                                        <span className="truncate">Caractéristique</span>
                                                        <span className="text-right">Total</span>
                                                        <span className="inline-flex items-center justify-end" title="Caractéristique + Puissance (valeur effective des dommages)">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src="/assets/dofus/stats/puissance.png" alt="" aria-hidden="true" className="w-3 h-3 object-contain" loading="lazy" />
                                                        </span>
                                                        <span className="text-right" title="Points investis à la main (capital)">Base</span>
                                                        <span className="text-right" title="Parchotage (parchemins de caractéristique)">Parcho</span>
                                                    </div>

                                                    {characteristicRows.map((row) => (
                                                        <div
                                                            key={row.key}
                                                            title={row.breakdown}
                                                            className="grid grid-cols-[minmax(0,1fr)_3rem_2.75rem_2.75rem_2.75rem] items-center gap-x-1 py-0.5 border-b border-border/40"
                                                        >
                                                            <span className="flex items-center gap-1.5 min-w-0">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={dofusStatAssetUrl(row.asset)} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                                                <span className={cn("truncate font-bold", row.color)}>{row.label}</span>
                                                            </span>
                                                            <span className={cn("text-right font-bold tabular-nums", row.color)}>{row.total}</span>
                                                            <span className="text-right tabular-nums text-muted-foreground">{row.power ?? "—"}</span>
                                                            <span className={cn("text-right tabular-nums", row.base ? "text-muted-foreground" : "text-muted-foreground/40")}>{row.base}</span>
                                                            <span className={cn("text-right tabular-nums", row.scroll ? "text-muted-foreground" : "text-muted-foreground/40")}>{row.scroll}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
                                                {([
                                                    { label: "Points d'Action (PA)", val: effectiveData?.stats?.pa ?? data.stats?.pa ?? 0, img: "/assets/dofus/stats/pa.png", color: "text-info" },
                                                    { label: "Points de Mouvement", val: effectiveData?.stats?.pm ?? data.stats?.pm ?? 0, img: "/assets/dofus/stats/pm.png", color: "text-success" },
                                                    { label: "Portée (PO)", val: effectiveData?.stats?.po ?? data.stats?.po ?? 0, img: "/assets/dofus/stats/po.png", color: "text-success" },
                                                    { label: "% Coup Critique", val: `${effectiveData?.stats?.cc ?? data.stats?.cc ?? 0}%`, img: "/assets/dofus/stats/critique.png", color: "text-danger" },
                                                    { label: "Invocations", val: effectiveData?.stats?.invo ?? data.stats?.invo ?? 0, img: "/assets/dofus/stats/invocation.png", color: "text-warning" },
                                                    { label: "Soins", val: effectiveData?.stats?.so ?? data.stats?.so ?? 0, img: "/assets/dofus/stats/soin.png", color: "text-danger" },
                                                    { label: "Initiative", val: effectiveData?.stats?.ini ?? data.stats?.ini ?? 0, img: "/assets/dofus/stats/initiative.png", color: "text-foreground" },
                                                    { label: "Prospection", val: effectiveData?.stats?.pp ?? data.stats?.pp ?? 0, img: "/assets/dofus/stats/pp.png", color: "text-info" },
                                                    { label: "Fuite", val: effectiveData?.stats?.fuite ?? data.stats?.fuite ?? 0, img: "/assets/dofus/stats/fuite.png", color: "text-info" },
                                                    { label: "Tacle", val: effectiveData?.stats?.tacle ?? data.stats?.tacle ?? 0, img: "/assets/dofus/stats/tacle.png", color: "text-success" },
                                                    { label: "Retrait PA / PM", val: `${effectiveData?.stats?.retpa ?? data.stats?.retpa ?? 0} / ${effectiveData?.stats?.retpm ?? data.stats?.retpm ?? 0}`, img: "/assets/dofus/stats/sablier.png", color: "text-warning" },
                                                    { label: "Do Critique", val: effectiveData?.damages?.critique ?? data.damages?.critique ?? 0, img: "/assets/dofus/stats/dmgCritique.png", color: "text-danger" },
                                                ] as { label: string; val: number | string; img: string; color: string }[]).map((s) => (
                                                    <div key={s.label} className="flex items-center justify-between py-1 border-b border-border/40 hover:border-border transition-colors">
                                                        <span className="text-muted-foreground truncate inline-flex items-center gap-1.5 min-w-0">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={s.img} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                                            <span className="truncate">{s.label}</span>
                                                        </span>
                                                        <span className={cn("font-bold tabular-nums whitespace-nowrap ml-2", s.color)}>{s.val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 3. Dommages Fixes & % Dommages */}
                                        <div className="bg-surface p-4 sm:p-5 rounded-[4px] border border-border flex flex-col gap-3">
                                            <h4 className="text-caption font-bold text-foreground/80 uppercase flex items-center gap-1.5 border-b border-border pb-2">
                                                <Zap className="w-3.5 h-3.5 text-warning" /> Dommages Fixes & %
                                            </h4>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                                                {([
                                                    { label: "Do Terre", val: effectiveData?.damages?.terre ?? data.damages?.terre ?? 0, img: "/assets/dofus/stats/terre.png", color: "text-warning" },
                                                    { label: "Do Feu", val: effectiveData?.damages?.feu ?? data.damages?.feu ?? 0, img: "/assets/dofus/stats/feu.png", color: "text-danger" },
                                                    { label: "Do Eau", val: effectiveData?.damages?.eau ?? data.damages?.eau ?? 0, img: "/assets/dofus/stats/eau.png", color: "text-info" },
                                                    { label: "Do Air", val: effectiveData?.damages?.air ?? data.damages?.air ?? 0, img: "/assets/dofus/stats/air.png", color: "text-success" },
                                                    { label: "Do Neutre", val: effectiveData?.damages?.neutre ?? data.damages?.neutre ?? 0, img: "/assets/dofus/stats/neutre.png", color: "text-foreground" },
                                                    { label: "Do Généraux", val: effectiveData?.damages?.general ?? data.damages?.general ?? 0, color: "text-foreground" },
                                                ] as { label: string; val: number; img?: string; color: string }[]).map((d) => (
                                                    <div key={d.label} className="flex items-center justify-between py-0.5 border-b border-border/40">
                                                        <span className="text-muted-foreground font-medium inline-flex items-center gap-1.5 min-w-0">
                                                            {d.img && (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={d.img} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                                            )}
                                                            <span className="truncate">{d.label}</span>
                                                        </span>
                                                        <span className={cn("font-bold tabular-nums", d.color)}>+{d.val}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                                                {[
                                                    { label: "% Do Sorts", val: effectiveData?.damages?.sorts ?? data.damages?.sorts ?? 0, img: "/assets/dofus/stats/dmgSort.png" },
                                                    { label: "% Do Mêlée", val: effectiveData?.damages?.melee ?? data.damages?.melee ?? 0, img: "/assets/dofus/stats/dmgMelee.png" },
                                                    { label: "% Do Dist.", val: effectiveData?.damages?.distance ?? data.damages?.distance ?? 0, img: "/assets/dofus/stats/dmgDistance.png" },
                                                    { label: "% Do Armes", val: effectiveData?.damages?.armes ?? data.damages?.armes ?? 0, img: "/assets/dofus/stats/dmgArme.png" },
                                                ].map((p) => (
                                                    <div key={p.label} className="flex flex-col items-center bg-surface px-2 py-1.5 rounded-xl border border-border">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase inline-flex items-center gap-1">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={p.img} alt="" aria-hidden="true" className="w-3 h-3 object-contain" loading="lazy" />
                                                            {p.label}
                                                        </span>
                                                        <span className="font-bold text-foreground text-caption tabular-nums">+{p.val}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 4. Résistances élémentaires (icônes bouclier du set officiel) */}
                                        <div className="bg-surface p-3.5 rounded-2xl border border-border flex items-center justify-between gap-1.5">
                                            {[
                                                { label: "Neutre", val: effectiveData?.resists?.neutre ?? data.resists?.neutre ?? 0, img: "/assets/dofus/stats/resNeutre.png", color: "text-foreground", bg: "bg-surface" },
                                                { label: "Terre", val: effectiveData?.resists?.terre ?? data.resists?.terre ?? 0, img: "/assets/dofus/stats/resTerre.png", color: "text-warning", bg: "bg-warning/10" },
                                                { label: "Feu", val: effectiveData?.resists?.feu ?? data.resists?.feu ?? 0, img: "/assets/dofus/stats/resFeu.png", color: "text-danger", bg: "bg-danger/10" },
                                                { label: "Eau", val: effectiveData?.resists?.eau ?? data.resists?.eau ?? 0, img: "/assets/dofus/stats/resEau.png", color: "text-info", bg: "bg-info/10" },
                                                { label: "Air", val: effectiveData?.resists?.air ?? data.resists?.air ?? 0, img: "/assets/dofus/stats/resAir.png", color: "text-success", bg: "bg-success/10" },
                                            ].map((r) => (
                                                <div key={r.label} className={cn("flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl border border-border/60", r.bg)}>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase inline-flex items-center gap-1">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={r.img} alt="" aria-hidden="true" className="w-3 h-3 object-contain" loading="lazy" />
                                                        {r.label}
                                                    </span>
                                                    <span className={cn("font-bold text-caption tabular-nums mt-0.5", r.color)}>
                                                        {r.val}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                    </div>

                                    {/* ─── COLONNE CENTRALE (4 cols) : Personnage, Slots Symétriques & Vitals ─── */}
                                    <div className="lg:col-span-4 flex flex-col items-center justify-center gap-4 bg-surface/30 backdrop-blur-md p-6 rounded-[2.5rem] border border-border shadow-xl relative overflow-hidden">
                                        
                                        {/* Podium Glow Background */}
                                        <div
                                            className="absolute w-72 h-72 rounded-full blur-[90px] opacity-25 pointer-events-none"
                                            style={{ backgroundColor: classArtColor }}
                                        />

                                        {/* Titre & Classe Centrés */}
                                        <div className="text-center z-10">
                                            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-surface border border-border text-caption font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                                <span>{resolvedClassName}</span>
                                                <span>•</span>
                                                <span className="text-foreground font-black">Niv. {data.level}</span>
                                            </div>
                                            <h3 className="text-2xl font-black text-foreground uppercase tracking-tight line-clamp-1">
                                                {title || data.name}
                                            </h3>
                                        </div>

                                        {/* Grille Symétrique Équipement & Personnage (Style Duffus / DofusDB) */}
                                        <div className="relative w-full max-w-[340px] aspect-[4/3.8] flex items-center justify-center my-2 z-10">
                                            
                                            {/* Illustration centrale de la classe */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                                <div className="w-36 h-36 rounded-full bg-elevated/40 border border-border/50 flex items-center justify-center shadow-inner relative">
                                                    {(data?.classId || guessedClassId) > 0 && (
                                                        <NextImage
                                                            src={`/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png`}
                                                            alt={data?.className || "Class"}
                                                            width={90}
                                                            height={90}
                                                            className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] opacity-80"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Disposition des 8 slots principaux autour du personnage */}
                                            <div className="w-full h-full flex justify-between items-center relative z-10 px-2">
                                                {/* Colonne Gauche (4 slots) */}
                                                <div className="flex flex-col gap-2.5">
                                                    <GearSlotItem
                                                        slot="ch"
                                                        item={effectiveData?.items?.['ch']}
                                                        label="Coiffe"
                                                        isVariant={!!variants['ch']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="ca"
                                                        item={effectiveData?.items?.['ca']}
                                                        label="Cape"
                                                        isVariant={!!variants['ca']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="ce"
                                                        item={effectiveData?.items?.['ce']}
                                                        label="Ceinture"
                                                        isVariant={!!variants['ce']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="bo"
                                                        item={effectiveData?.items?.['bo']}
                                                        label="Bottes"
                                                        isVariant={!!variants['bo']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                </div>

                                                {/* Colonne Droite (4 slots) */}
                                                <div className="flex flex-col gap-2.5">
                                                    <GearSlotItem
                                                        slot="am"
                                                        item={effectiveData?.items?.['am']}
                                                        label="Amulette"
                                                        isVariant={!!variants['am']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="a1"
                                                        item={effectiveData?.items?.['a1']}
                                                        label="Anneau 1"
                                                        isVariant={!!variants['a1']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="a2"
                                                        item={effectiveData?.items?.['a2']}
                                                        label="Anneau 2"
                                                        isVariant={!!variants['a2']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                    <GearSlotItem
                                                        slot="br"
                                                        item={effectiveData?.items?.['br']}
                                                        label="Bouclier"
                                                        isVariant={!!variants['br']}
                                                        onSelect={setSelected}
                                                        onOpenVariant={setVariantModalSlot}
                                                    />
                                                </div>
                                            </div>

                                            {/* Slots Arme & Familier (Au centre, sous le personnage) */}
                                            <div className="absolute bottom-1 flex items-center gap-3 z-10">
                                                <GearSlotItem
                                                    slot="ar"
                                                    item={effectiveData?.items?.['ar']}
                                                    label="Arme"
                                                    isVariant={!!variants['ar']}
                                                    onSelect={setSelected}
                                                    onOpenVariant={setVariantModalSlot}
                                                />
                                                <GearSlotItem
                                                    slot="fa"
                                                    item={effectiveData?.items?.['fa'] || effectiveData?.items?.['mo']}
                                                    label="Familier / Monture"
                                                    isVariant={!!variants['fa'] || !!variants['mo']}
                                                    onSelect={setSelected}
                                                    onOpenVariant={setVariantModalSlot}
                                                />
                                            </div>
                                        </div>

                                        {/* Bandeau Vitals (set officiel `assets/dofus/stats/*`) */}
                                        <div className="flex flex-wrap items-center justify-center gap-2 bg-surface px-4 py-2 rounded-2xl border border-border z-10">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated rounded-xl">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/stats/pv.png" alt="Vitalité" className="w-4 h-4 object-contain" loading="lazy" />
                                                <span className="font-bold text-body-sm text-foreground tabular-nums">{effectiveData?.stats?.vit ?? data.stats?.vit ?? 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-info/10 border border-info/20 rounded-xl">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-4 h-4 object-contain" loading="lazy" />
                                                <span className="font-bold text-body-sm text-info tabular-nums">{effectiveData?.stats?.pa ?? data.stats?.pa ?? 0} PA</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-xl">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/stats/pm.png" alt="PM" className="w-4 h-4 object-contain" loading="lazy" />
                                                <span className="font-bold text-body-sm text-success tabular-nums">{effectiveData?.stats?.pm ?? data.stats?.pm ?? 0} PM</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-xl">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/stats/po.png" alt="PO" className="w-4 h-4 object-contain" loading="lazy" />
                                                <span className="font-bold text-body-sm text-success tabular-nums">{effectiveData?.stats?.po ?? data.stats?.po ?? 0} PO</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-danger/10 border border-danger/20 rounded-xl">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/stats/critique.png" alt="Critique" className="w-4 h-4 object-contain" loading="lazy" />
                                                <span className="font-bold text-body-sm text-danger tabular-nums">{effectiveData?.stats?.cc ?? data.stats?.cc ?? 0}%</span>
                                            </div>
                                        </div>

                                        {/* Rangée des 6 Dofus / Trophées */}
                                        <div className="w-full flex items-center justify-center gap-2 pt-2 border-t border-border/50 z-10">
                                            {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((slot, idx) => (
                                                <GearSlotItem
                                                    key={slot}
                                                    slot={slot}
                                                    item={effectiveData?.items?.[slot]}
                                                    label={`Dofus / Trophée ${idx + 1}`}
                                                    isVariant={!!variants[slot]}
                                                    onSelect={setSelected}
                                                    onOpenVariant={setVariantModalSlot}
                                                />
                                            ))}
                                        </div>

                                    </div>

                                    {/* ─── COLONNE DROITE (4 cols) : Panoplies, Forgemagie & Actions ─── */}
                                    <div className="lg:col-span-4 flex flex-col gap-4">
                                        
                                        {/* 1. Carte Panoplies & Bonus de sets */}
                                        <div className="bg-surface p-5 rounded-[4px] border border-border flex flex-col gap-3">
                                            <h4 className="text-caption font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
                                                <Shield className="w-3.5 h-3.5 text-success" /> Bonus de Panoplie(s)
                                            </h4>

                                            {data.cloths && data.cloths.length > 0 ? (
                                                <div className="flex flex-col gap-3">
                                                    {data.cloths.map((cloth, idx) => (
                                                        <div key={idx} className="flex flex-col gap-2 p-3 bg-surface rounded-[4px] border border-border">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-label font-bold text-foreground truncate">{cloth.name}</span>
                                                                <span className="px-2 py-0.5 rounded-[4px] bg-elevated text-caption font-bold text-success tabular-nums">
                                                                    {cloth.count}/{cloth.total}
                                                                </span>
                                                            </div>

                                                            {/* Miniatures des items portés (clic = modale interne) */}
                                                            {cloth.clothItems && cloth.clothItems.length > 0 && (
                                                                <div className="flex items-center gap-1.5">
                                                                    {cloth.clothItems.map((item) => (
                                                                        <button
                                                                            key={item.id}
                                                                            type="button"
                                                                            onClick={() => setSelected({ item, slotLabel: cloth.name })}
                                                                            title={item.name}
                                                                            aria-label={`${item.name} (${cloth.name})`}
                                                                            className="w-8 h-8 rounded-[4px] bg-elevated border border-border flex items-center justify-center overflow-hidden hover:border-border-strong transition-colors cursor-pointer"
                                                                        >
                                                                            <ItemIcon item={item} size={28} />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Liste des stats conférées par la panoplie */}
                                                            {cloth.bonuses && Object.keys(cloth.bonuses).length > 0 && (
                                                                <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                                                                    {Object.entries(cloth.bonuses).map(([stat, val]) => {
                                                                        const label = statLabelMapping[stat] || stat;
                                                                        // Asset officiel de la stat (jamais d'icône inventée : inconnu ⇒ pas d'icône).
                                                                        const theme = resolveDofusStatTheme(null, null, stat, label);
                                                                        return (
                                                                            <span
                                                                                key={stat}
                                                                                title={theme?.label ?? label}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-background/60 rounded-md text-[11px] font-bold text-success/90 tabular-nums"
                                                                            >
                                                                                {theme && (
                                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                                    <img
                                                                                        src={dofusStatAssetUrl(theme.asset)}
                                                                                        alt=""
                                                                                        aria-hidden="true"
                                                                                        className="w-3.5 h-3.5 object-contain shrink-0"
                                                                                        loading="lazy"
                                                                                    />
                                                                                )}
                                                                                {val > 0 ? `+${val}` : val} {label}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-caption text-muted-foreground italic py-3 text-center">
                                                    Aucun bonus de panoplie actif.
                                                </p>
                                            )}
                                        </div>

                                        {/* 2. Carte Forgemagie (Exo / Over, compacte avec vraies runes) */}
                                        <div className="bg-surface p-4 sm:p-5 rounded-[4px] border border-border flex flex-col gap-3">
                                            {(() => {
                                                const fmEntries = parseDofusbookSmithmagic(data.smithmagic, data.items);
                                                const exoCount = fmEntries.filter((fm) => getRuneForStat(fm.stat, fm.value).isExo).length;
                                                const overCount = fmEntries.length - exoCount;

                                                return (
                                                    <>
                                                        <div className="flex items-center justify-between border-b border-border pb-2">
                                                            <h4 className="text-caption font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Sparkles className="w-3.5 h-3.5 text-warning" /> Forgemagie (Exo / Over)
                                                            </h4>
                                                            {fmEntries.length > 0 && (
                                                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                                                                    {exoCount > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                                                                            {exoCount} Exo{exoCount > 1 ? "s" : ""}
                                                                        </span>
                                                                    )}
                                                                    {overCount > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30">
                                                                            {overCount} Over{overCount > 1 ? "s" : ""}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {fmEntries.length === 0 ? (
                                                            <p className="text-caption text-muted-foreground py-2 text-center italic">
                                                                Aucune forgemagie (Exo/Over) détectée.
                                                            </p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                                                                {fmEntries.map((fm, idx) => {
                                                                    const rune = getRuneForStat(fm.stat, fm.value);
                                                                    const target = data.items ? Object.values(data.items).find((it) => it?.name === fm.itemName) ?? null : null;

                                                                    return (
                                                                        <button
                                                                            key={idx}
                                                                            type="button"
                                                                            disabled={!target}
                                                                            onClick={() => target && setSelected({ item: target, slotLabel: fm.slotKey })}
                                                                            className={cn(
                                                                                "flex items-center gap-2 p-2 rounded-[4px] border transition-colors text-left group",
                                                                                target ? "cursor-pointer hover:border-border-strong hover:bg-elevated" : "cursor-default",
                                                                                rune.isExo
                                                                                    ? "bg-warning/10 border-warning/30 hover:border-warning/50"
                                                                                    : "bg-surface border-border hover:border-success/40"
                                                                            )}
                                                                        >
                                                                            {/* Vraie Rune du jeu */}
                                                                            <div
                                                                                className="w-8 h-8 rounded-[4px] bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-2xs"
                                                                                title={rune.runeName}
                                                                            >
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                <img
                                                                                    src={rune.assetUrl}
                                                                                    alt={rune.runeName}
                                                                                    width={26}
                                                                                    height={26}
                                                                                    className="object-contain p-0.5"
                                                                                    loading="lazy"
                                                                                />
                                                                            </div>

                                                                            {/* Stat & Équipement */}
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center justify-between gap-1">
                                                                                    <span className={cn(
                                                                                        "text-[12px] font-black tabular-nums tracking-tight truncate",
                                                                                        rune.isExo ? "text-warning" : "text-success"
                                                                                    )}>
                                                                                        {fm.value > 0 ? `+${fm.value}` : fm.value} {fm.stat}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    {fm.itemImage && (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img src={fm.itemImage} alt="" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
                                                                                    )}
                                                                                    <span className="text-[10px] text-muted-foreground truncate block font-medium" title={fm.itemName}>
                                                                                        {fm.itemName}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* 3. Boutons d'Action */}
                                        <div className="flex flex-col gap-2 pt-1">
                                            <Button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="w-full h-11 rounded-xl text-label font-bold gap-2 flex items-center justify-center shadow-md cursor-pointer"
                                            >
                                                <Copy className="w-4 h-4" /> Copier le lien du build
                                            </Button>
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full h-11 bg-surface/80 text-foreground hover:bg-elevated rounded-xl text-center text-label font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-border shadow-sm"
                                            >
                                                Ouvrir sur Dofusbook <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                            </a>
                                        </div>

                                    </div>

                                </div>
                            ) : activeTab === "sorts" ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-border pb-4">
                                        <div>
                                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Sorts de classe & Variantes</h3>
                                            <p className="text-caption text-muted-foreground">
                                                Dégâts réels calculés selon les statistiques élémentaires, la puissance et les dommages fixes du stuff.
                                            </p>
                                        </div>
                                    </div>
                                    <DofusSpellsTab
                                        classId={data?.classId || guessedClassId}
                                        level={data?.level || 200}
                                        build={buildForSpells}
                                    />
                                </div>
                            ) : activeTab === "simulation" ? (
                                <DofusbookSimulationTab
                                    classId={data?.classId || guessedClassId}
                                    level={data?.level || 200}
                                    casterName={title || data?.name}
                                    casterIcon={(data?.classId || guessedClassId) > 0 ? `/assets/dofus/classes/${getIconId(data?.classId || guessedClassId)}.png` : undefined}
                                    build={buildForSpells}
                                />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-border pb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Inventaire d'équipement</h3>
                                            <p className="text-caption text-muted-foreground">
                                                Détail de tous les équipements — cliquez sur un objet pour voir sa fiche.
                                            </p>
                                        </div>
                                    </div>
                                    <EquipmentGrid
                                        items={effectiveData?.items}
                                        variants={variants}
                                        onSelect={setSelected}
                                        onOpenVariant={setVariantModalSlot}
                                    />
                                </div>
                            )}
                        </div>

                    </div>
                    {selected && data && (() => {
                        const fmEntries = parseDofusbookSmithmagic(data.smithmagic, data.items);
                        const fmLines = fmEntries.filter((fm) => fm.itemName === selected.item.name).map((fm) => ({ stat: fm.stat, value: fm.value }));
                        const clothName = data.cloths?.find((c) => c.clothItems?.some((ci) => ci.id === selected.item.id))?.name ?? null;
                        return (
                            <ItemDetailModal
                                selection={selected}
                                clothName={clothName}
                                fmLines={fmLines}
                                onClose={() => setSelected(null)}
                            />
                        );
                    })()}

                    {/* Modale de sélection de variante interactive (style Duffus) */}
                    <ItemVariantModal
                        slot={variantModalSlot}
                        currentVariant={variantModalSlot ? variants[variantModalSlot] : null}
                        originalItem={variantModalSlot ? data?.items?.[variantModalSlot] : null}
                        buildLevel={data?.level || 200}
                        onSelect={(s, it) => {
                            setVariants((prev) => ({ ...prev, [s]: it }));
                            toast.success(`Variante appliquée : ${it.name} — Caractéristiques & dégâts recalculés en direct !`);
                        }}
                        onRemoveVariant={(s) => {
                            setVariants((prev) => {
                                const next = { ...prev };
                                delete next[s];
                                return next;
                            });
                            toast.info("Variante retirée : objet d'origine restauré.");
                        }}
                        onClose={() => setVariantModalSlot(null)}
                    />
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
});
