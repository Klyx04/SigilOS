"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatKamas, parseKamas } from "@/lib/market/kamas";
import {
    MARKET_WANTED_TRANSCENDENCE_LABELS,
    type MarketWantedTranscendence,
} from "@/server/actions/market-constants";
import {
    createMarketListing,
    getMarketStatReferential,
    getMarketPublishContext,
    publishMarketListing,
    updateMarketListing,
    type MarketStatReferential,
} from "@/server/actions/market-actions";
import { searchLocalGameItems, type GameItemSearchResult } from "@/server/actions/game-item-actions";
import {
    firstFrenchError,
    marketListingBaseSchema,
} from "@/lib/market/listing-schemas";
import { MarketPublishStep, type MarketPublishContext } from "./market-publish-step";
import { MarketWantedCriteriaEditor, type WantedCriterionDraft } from "./market-wanted-criteria-editor";
import { MarketItemIcon } from "@/components/market/market-item-icon";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Save, Search, Upload } from "lucide-react";

interface MarketWantedCreateClientProps {
    guildId: string;
    /** Édition (`?id=`) : annonce WANTED existante pré-remplie. */
    initial?: {
        id: string;
        title: string;
        description: string | null;
        priceKamas: number | null;
        negotiable: boolean;
        quantity: number | null;
        unitLabel: string | null;
        item: GameItemSearchResult | null;
        wantedTranscendence: MarketWantedTranscendence;
        criteria: WantedCriterionDraft[];
    } | null;
}

/**
 * Lot M1 — assistant de recherche d'achat (3 étapes) : Objet → Budget &
 * critères (exo / over / trans) → Publication (aperçu Discord fidèle).
 * La validation métier reste serveur (catalogue, pastilles, quota).
 */
export function MarketWantedCreateClient({ guildId, initial = null }: MarketWantedCreateClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isEdit = initial !== null;

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [itemQuery, setItemQuery] = useState(initial?.item?.name ?? "");
    const [itemResults, setItemResults] = useState<GameItemSearchResult[]>([]);
    const [itemSearching, setItemSearching] = useState(false);
    const [item, setItem] = useState<GameItemSearchResult | null>(initial?.item ?? null);
    const [quantity, setQuantity] = useState(initial?.quantity ? String(initial.quantity) : "1");
    const [unitLabel, setUnitLabel] = useState(initial?.unitLabel ?? "");
    const [title, setTitle] = useState(initial?.title ?? "");
    const [budget, setBudget] = useState(initial?.priceKamas != null ? String(initial.priceKamas) : "");
    // Lot M1 — toujours négociable (voir cohérence serveur) : pas d'état.
    const [description, setDescription] = useState(initial?.description ?? "");
    const [transcendence, setTranscendence] = useState<MarketWantedTranscendence>(initial?.wantedTranscendence ?? "ANY");
    const [criteria, setCriteria] = useState<WantedCriterionDraft[]>(initial?.criteria ?? []);
    const [referential, setReferential] = useState<MarketStatReferential | null>(null);

    const [listingId, setListingId] = useState<string | null>(initial?.id ?? null);
    const [publishContext, setPublishContext] = useState<MarketPublishContext | null>(null);

    useEffect(() => {
        getMarketStatReferential(guildId)
            .then((res) => {
                if (res.success && res.data) setReferential(res.data);
            })
            .catch(() => {});
    }, [guildId]);

    useEffect(() => {
        if (itemQuery.trim().length < 2 || item) {
            setItemResults([]);
            return;
        }
        setItemSearching(true);
        const timer = window.setTimeout(() => {
            searchLocalGameItems(itemQuery.trim(), "all", 12)
                .then((res) => {
                    if (res.success && res.data) setItemResults(res.data);
                })
                .catch(() => {})
                .finally(() => setItemSearching(false));
        }, 250);
        return () => window.clearTimeout(timer);
    }, [itemQuery, item]);

    const parsedBudget = useMemo(() => parseKamas(budget), [budget]);
    const parsedQuantity = useMemo(() => {
        // Strict : entier brut, pas de « 3.9 » arrondi ni de négatif toléré.
        if (!/^\d+$/.test(quantity.trim())) return null;
        const n = Number(quantity.trim());
        return Number.isSafeInteger(n) && n >= 1 ? n : null;
    }, [quantity]);

    /** Affichage des erreurs inline (après une tentative de Continuer). */
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (!isEdit && item && !title) {
            setTitle(`Recherche : ${item.name}${parsedQuantity && parsedQuantity > 1 ? ` ×${parsedQuantity}` : ""}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item, parsedQuantity]);

    function buildPayload() {
        return {
            type: "WANTED" as const,
            title: title.trim(),
            description: description.trim() || null,
            forgedBy: null,
            priceKamas: parsedBudget,
            negotiable: true,
            acceptsTrade: false,
            dofusDbItemId: item?.ankamaId ?? null,
            itemName: item?.name ?? null,
            itemIconUrl: item?.iconUrl ?? null,
            itemLevel: item?.level ?? null,
            itemTypeName: item?.typeName ?? null,
            quantity: parsedQuantity,
            unitLabel: unitLabel.trim() || null,
            minQuantity: null,
            components: [],
            items: [],
            stats: [],
            wantedTranscendence: transcendence,
            criteria: criteria.map((criterion) => ({
                effectId: criterion.effectId,
                characteristic: criterion.characteristic,
                label: criterion.label,
                minValue: criterion.minValue,
                exo: criterion.exo,
            })),
        };
    }

    /**
     * Blocages STRICTS par étape (le bouton Continuer est désactivé tant
     * qu'il en reste : impossible d'avancer avec un champ invalide).
     * Le serveur revalide tout de toute façon (cohérence WANTED).
     */
    function stepBlockers(target: 1 | 2): string[] {
        if (target === 1) {
            if (!item) return ["Choisis un objet du catalogue."];
            if (!parsedQuantity) return ["Renseigne la quantité recherchée (nombre entier, au moins 1)."];
            if (title.trim().length < 3) return ["Titre trop court (3 caractères minimum)."];
            return [];
        }
        const issues = [...stepBlockers(1)];
        if (parsedBudget == null || parsedBudget <= 0) {
            issues.push("Renseigne ton budget maximum en kamas (au moins 1).");
        }
        if (description.trim().length > 2000) {
            issues.push("Note trop longue (2 000 caractères maximum).");
        }
        // Garde-fou schéma partagé (bornes, texte FR) — le métier reste serveur.
        const parsed = marketListingBaseSchema.safeParse(buildPayload());
        if (!parsed.success) issues.push(firstFrenchError(parsed.error).message);
        return issues;
    }

    function blockers(): string[] {
        return step === 1 ? stepBlockers(1) : stepBlockers(2);
    }

    function handleSave(publishNow: boolean) {
        const [blocker] = blockers();
        if (blocker) {
            setShowErrors(true);
            toast.error(blocker);
            return;
        }
        startTransition(async () => {
            if (isEdit && listingId) {
                const updated = await updateMarketListing(guildId, listingId, buildPayload());
                if (!updated.success) {
                    toast.error(updated.error || "Impossible d'enregistrer.");
                    return;
                }
                toast.success("Recherche mise à jour.");
                router.push(`/dashboard/${guildId}/marche/${listingId}`);
                router.refresh();
                return;
            }
            const created = await createMarketListing(guildId, buildPayload());
            if (!created.success || !created.data) {
                toast.error(created.error || "Impossible de créer la recherche.");
                return;
            }
            setListingId(created.data.id);
            const ctx = await getMarketPublishContext(guildId);
            if (ctx.success && ctx.data) setPublishContext(ctx.data);
            if (publishNow) {
                const published = await publishMarketListing(guildId, created.data.id);
                if (!published.success) {
                    toast.error(published.error || "Brouillon créé, publication impossible.");
                    setStep(3);
                    return;
                }
                toast.success("Recherche publiée.");
                router.push(`/dashboard/${guildId}/marche/${created.data.id}`);
                router.refresh();
                return;
            }
            setStep(3);
        });
    }

    async function handlePublishFromPreview() {
        if (!listingId) return;
        startTransition(async () => {
            const published = await publishMarketListing(guildId, listingId);
            if (!published.success) {
                toast.error(published.error || "Publication impossible.");
                return;
            }
            toast.success("Recherche publiée.");
            router.push(`/dashboard/${guildId}/marche/${listingId}`);
            router.refresh();
        });
    }

    const criteriaPreview = criteria.map(
        (criterion) => `${criterion.exo ? "✦ Exo " : ""}+${criterion.minValue} ${criterion.label} min`
    );

    // Strict : le bouton Continuer/Enregistrer est désactivé tant qu'un
    // blocage subsiste sur l'étape courante (les messages restent en toast).
    const stepBlockingErrors = blockers();

    return (
        <div className="space-y-6">
            {/* Étapes */}
            <div className="flex items-center gap-2" aria-label="Progression">
                {([1, 2, 3] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => value < step && setStep(value)}
                        disabled={value >= step || isPending}
                        className={cn(
                            "flex h-8 flex-1 items-center justify-center rounded-lg border text-xs font-black",
                            step >= value ? "border-info/40 bg-info/10 text-info" : "border-border text-muted-foreground"
                        )}
                    >
                        {value === 1 ? "1 · Objet" : value === 2 ? "2 · Budget & critères" : "3 · Publication"}
                    </button>
                ))}
            </div>

            {step === 1 && (
                <Card className="bg-surface/60 border-border">
                    <CardContent className="space-y-4 p-4">
                        <div className="space-y-2">
                            <Label>Objet recherché</Label>
                            {showErrors && !item && (
                                <p className="text-[11px] font-semibold text-danger">
                                    Objet requis : choisis-le dans le catalogue ci-dessous.
                                </p>
                            )}
                            {item ? (
                                <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
                                    <MarketItemIcon
                                        src={item.iconUrl ?? null}
                                        ankamaId={item.ankamaId ?? null}
                                        alt={item.name}
                                        size={40}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {item.typeName ?? ""}{item.level ? ` · Niv. ${item.level}` : ""}
                                        </p>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => { setItem(null); setItemQuery(""); }}>
                                        Changer
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={itemQuery}
                                            onChange={(event) => setItemQuery(event.target.value)}
                                            placeholder="Nom de l'objet (2 lettres min)…"
                                            className="h-10 pl-9"
                                            aria-label="Rechercher un objet"
                                        />
                                    </div>
                                    {itemSearching && <p className="text-[11px] text-muted-foreground">Recherche…</p>}
                                    {itemResults.length > 0 && (
                                        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-2">
                                            {itemResults.map((result) => (
                                                <li key={result.ankamaId ?? result.name}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setItem(result)}
                                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
                                                    >
                                                        <MarketItemIcon
                                                            src={result.iconUrl ?? null}
                                                            ankamaId={result.ankamaId ?? null}
                                                            alt={result.name}
                                                            size={28}
                                                        />
                                                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                                                            {result.name}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Quantité</Label>
                                <Input
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                    inputMode="numeric"
                                    maxLength={10}
                                    className={cn("h-10", showErrors && !parsedQuantity && "border-danger")}
                                    aria-invalid={showErrors && !parsedQuantity}
                                />
                                {showErrors && !parsedQuantity && (
                                    <p className="text-[11px] font-semibold text-danger">
                                        Quantité requise : nombre entier, au moins 1.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Unité (facultatif)</Label>
                                <Input value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)} placeholder="ex. lot, unité" maxLength={40} className="h-10" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Titre</Label>
                            <Input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                maxLength={120}
                                className={cn("h-10", showErrors && title.trim().length < 3 && "border-danger")}
                                aria-invalid={showErrors && title.trim().length < 3}
                            />
                            {showErrors && title.trim().length < 3 && (
                                <p className="text-[11px] font-semibold text-danger">
                                    Titre requis : 3 caractères minimum.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <Card className="bg-surface/60 border-border">
                        <CardContent className="space-y-4 p-4">
                            <div className="space-y-2">
                                <Label>Budget maximum (kamas)</Label>
                                <Input
                                    value={budget}
                                    onChange={(event) => setBudget(event.target.value)}
                                    inputMode="numeric"
                                    maxLength={20}
                                    placeholder="ex. 12 500 000"
                                    className={cn("h-10", showErrors && (parsedBudget == null || parsedBudget <= 0) && "border-danger")}
                                    aria-invalid={showErrors && (parsedBudget == null || parsedBudget <= 0)}
                                />
                                {showErrors && (parsedBudget == null || parsedBudget <= 0) ? (
                                    <p className="text-[11px] font-semibold text-danger">
                                        Budget requis : une somme en kamas (au moins 1) — sans budget, pas de recherche.
                                    </p>
                                ) : (
                                    parsedBudget != null && (
                                        <p className="text-[11px] text-muted-foreground">Soit {formatKamas(parsedBudget)}.</p>
                                    )
                                )}
                            </div>
                            {/* Lot M1 — toujours négociable (serveur : une recherche
                                non négociable serait un cul-de-sac, aucune
                                proposition possible). Pas d'interrupteur. */}
                            <p className="rounded-xl border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                Budget négociable par construction : les vendeurs proposent leur prix, tu tranches.
                            </p>
                            <div className="space-y-2">
                                <Label>Note aux vendeurs (facultatif)</Label>
                                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="Précisions : état, délai, contact en jeu…" />
                            </div>
                            <div className="space-y-2">
                                <Label>Forge souhaitée</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(MARKET_WANTED_TRANSCENDENCE_LABELS) as MarketWantedTranscendence[]).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setTranscendence(value)}
                                            className={cn(
                                                "rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors",
                                                transcendence === value
                                                    ? "border-info/50 bg-info/10 text-info"
                                                    : "border-border text-muted-foreground hover:text-foreground"
                                            )}
                                            aria-pressed={transcendence === value}
                                        >
                                            {MARKET_WANTED_TRANSCENDENCE_LABELS[value]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-surface/60 border-border">
                        <CardContent className="space-y-3 p-4">
                            <p className="text-sm font-bold text-foreground">Critères de jet (facultatif)</p>
                            <p className="text-[11px] text-muted-foreground">
                                Exige un exo, un over ou une valeur minimale — calculé et affiché en pastilles.
                            </p>
                            <MarketWantedCriteriaEditor
                                effectLabels={referential?.effectLabels ?? null}
                                value={criteria}
                                onChange={setCriteria}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            {step === 3 && (
                <MarketPublishStep
                    channelName=""
                    title={title || "Recherche"}
                    itemName={item?.name ?? null}
                    itemLevel={item?.level ?? null}
                    itemTypeName={item?.typeName ?? null}
                    priceKamas={parsedBudget}
                    negotiable
                    exoLabels={[]}
                    listingType="WANTED"
                    wantedCriteria={criteriaPreview}
                    wantedTranscendenceLabel={
                        transcendence === "ANY" ? null : MARKET_WANTED_TRANSCENDENCE_LABELS[transcendence]
                    }
                    wantedQuantity={parsedQuantity}
                    itemIconUrl={item?.iconUrl ?? null}
                    components={[]}
                    context={publishContext}
                />
            )}

            {/* Navigation */}
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" disabled={step === 1 || isPending} onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Retour
                </Button>
                {step < 3 && (
                    <Button type="button" disabled={isPending || stepBlockingErrors.length > 0} onClick={() => {
                        const [blocker] = blockers();
                        if (blocker) {
                            setShowErrors(true);
                            toast.error(blocker);
                            return;
                        }
                        if (step === 2 && !isEdit) {
                            handleSave(false);
                            return;
                        }
                        setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
                    }} className="ml-auto gap-2">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {step === 2 && !isEdit ? "Enregistrer le brouillon" : "Continuer"}
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
                {step === 2 && isEdit && (
                    <Button type="button" disabled={isPending || stepBlockingErrors.length > 0} onClick={() => handleSave(false)} className="ml-auto gap-2">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Enregistrer
                    </Button>
                )}
                {step === 3 && !isEdit && (
                    <Button type="button" disabled={isPending || !listingId} onClick={handlePublishFromPreview} className="ml-auto gap-2">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Publier la recherche
                    </Button>
                )}
            </div>
        </div>
    );
}
