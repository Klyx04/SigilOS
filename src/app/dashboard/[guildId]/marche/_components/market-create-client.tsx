"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatKamas, parseKamas } from "@/lib/market/kamas";
import { MARKET_LIMITS } from "@/server/actions/market-constants";
import { createMarketListing, publishMarketListing, updateMarketListing, getMarketPublishContext } from "@/server/actions/market-actions";
import { getGuildRoles } from "@/server/actions/bonus-actions";
import { searchLocalGameItems, type GameItemSearchResult } from "@/server/actions/game-item-actions";
import { buildNativeStatDrafts, type MarketStatDraft, type MarketNativeEffect } from "@/lib/market/effects";
import { MarketJetEditor } from "./market-jet-editor";
import { MarketPublishStep, type MarketPublishContext } from "./market-publish-step";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Hammer, Loader2, Package, Plus, Save, Search, Store, X } from "lucide-react";

type ListingKind = "EQUIPMENT" | "RESOURCE";

export type ComponentDraft = {
    key: string;
    dofusDbItemId: number | null;
    name: string;
    iconUrl: string | null;
    quantity: number;
    unitLabel: string | null;
};

/**
 * S7.11/S7.12 — **état initial** d'une annonce à modifier (mode `edit`).
 *
 * Le même assistant 4 étapes est rejoué sur ces valeurs : aucune duplication du
 * parcours, et **aucun** champ `quality` n'est transmis (il est **recalculé**
 * côté serveur par `updateMarketListing`, cf. D17).
 */
export type MarketListingEditInitial = {
    id: string;
    type: ListingKind;
    title: string;
    description: string | null;
    forgedBy: string | null;
    priceKamas: number | null;
    negotiable: boolean;
    acceptsTrade: boolean;
    quantity: number | null;
    unitLabel: string | null;
    minQuantity: number | null;
    /** Objet du catalogue (jamais inventé : il vient de la fiche persistée). */
    item: GameItemSearchResult | null;
    stats: MarketStatDraft[];
    components: ComponentDraft[];
};

interface MarketCreateClientProps {
    guildId: string;
    /** S7.12 — annonce existante ⇒ mode **édition** (sinon création). */
    initial?: MarketListingEditInitial | null;
}

export function MarketCreateClient({ guildId, initial = null }: MarketCreateClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    /** S7.12 — édition d'une annonce existante : l'étape 4 (Discord) disparaît. */
    const isEdit = initial !== null;

    // Édition : on démarre directement sur « Objet / Jet », pré-rempli.
    const [step, setStep] = useState<1 | 2 | 3 | 4>(initial ? 2 : 1);
    const [kind, setKind] = useState<ListingKind>(initial?.type ?? "EQUIPMENT");

    // Équipement
    const [item, setItem] = useState<GameItemSearchResult | null>(initial?.item ?? null);

    // S2.10 — lignes de jet, pré-remplies depuis les plages natives du catalogue.
    const [stats, setStats] = useState<MarketStatDraft[]>(initial?.stats ?? []);

    // S3.14 — contexte de publication Discord (salon, rôles pinguables).
    const [publishContext, setPublishContext] = useState<MarketPublishContext | null>(null);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);

    useEffect(() => {
        // S7.12 — en édition il n'y a **pas** d'étape de publication Discord :
        // on évite deux appels serveur inutiles.
        if (isEdit) return;
        let cancelled = false;
        getMarketPublishContext(guildId).then((res) => {
            if (!cancelled && res.success && res.data) setPublishContext(res.data);
        });
        getGuildRoles(guildId).then((res) => {
            if (!cancelled && res.success && res.data) {
                setRoles(res.data.map((role) => ({ id: role.id, name: role.name })));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [guildId, isEdit]);

    // Ressources (lot simple ou composite)
    const [components, setComponents] = useState<ComponentDraft[]>(initial?.components ?? []);

    // Commun
    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [forgedBy, setForgedBy] = useState(initial?.forgedBy ?? "");
    const [priceInput, setPriceInput] = useState(
        initial?.priceKamas != null ? String(initial.priceKamas) : ""
    );
    const [negotiable, setNegotiable] = useState(initial?.negotiable ?? true);
    const [acceptsTrade, setAcceptsTrade] = useState(initial?.acceptsTrade ?? false);
    const [minQuantity, setMinQuantity] = useState(
        initial?.minQuantity != null ? String(initial.minQuantity) : ""
    );

    const parsedPrice = parseKamas(priceInput);
    const priceInvalid = priceInput.trim().length > 0 && parsedPrice === null;

    const canGoNext = step === 1
        ? true
        : step === 2
            ? kind === "EQUIPMENT"
                ? !!item
                : components.length > 0
            : step === 3
                ? title.trim().length >= 3 && !priceInvalid
                : true; // étape 4 — publication Discord

    function togglePing(roleId: string) {
        setPingRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId].slice(0, 3)
        );
    }

    /**
     * Charge utile **commune** création / mise à jour.
     * ⚠️ Aucun champ `quality` ni plage native calculée côté client : le serveur
     * **recalcule** tout (§12.8, D17).
     */
    function buildPayload() {
        return {
            type: kind,
            title: title.trim(),
            description: description.trim() || null,
            forgedBy: forgedBy.trim() || null,
            priceKamas: parsedPrice,
            negotiable,
            acceptsTrade,
            dofusDbItemId: kind === "EQUIPMENT" ? item?.ankamaId ?? null : null,
            itemName: kind === "EQUIPMENT" ? item?.name ?? null : null,
            itemIconUrl: kind === "EQUIPMENT" ? item?.iconUrl ?? null : null,
            itemLevel: kind === "EQUIPMENT" ? item?.level ?? null : null,
            itemTypeName: kind === "EQUIPMENT" ? item?.typeName ?? null : null,
            quantity: kind === "RESOURCE" && components.length === 1 ? components[0].quantity : null,
            unitLabel: kind === "RESOURCE" && components.length === 1 ? components[0].unitLabel : null,
            minQuantity: kind === "RESOURCE" ? parseKamas(minQuantity) ?? null : null,
            components: components.map((component) => ({
                dofusDbItemId: component.dofusDbItemId,
                name: component.name,
                iconUrl: component.iconUrl,
                quantity: component.quantity,
                unitLabel: component.unitLabel,
            })),
            stats: stats.map((stat) => ({
                effectId: stat.effectId,
                characteristic: stat.characteristic,
                label: stat.label,
                naturalMin: stat.naturalMin,
                naturalMax: stat.naturalMax,
                actualValue: stat.actualValue,
                origin: stat.origin,
            })),
        };
    }

    /** Champs communs aux deux modes. `true` si le formulaire est inutilisable. */
    function hasFormError(): boolean {
        if (!title.trim()) {
            toast.error("Renseigne un titre pour ton annonce.");
            return true;
        }
        if (priceInvalid) {
            toast.error("Prix invalide (entier de kamas attendu).");
            return true;
        }
        return false;
    }

    /**
     * S7.12 — enregistre les modifications d'une annonce existante.
     * `updateMarketListing` revalide tout côté serveur : **vendeur** propriétaire,
     * statut éditable (`DRAFT`/`ACTIVE`/`EXPIRED`), **jet recalculé** (plages
     * natives du catalogue), `statsHash` rejoué et journal `LISTING_UPDATED`.
     */
    function handleUpdate() {
        if (!initial || hasFormError()) return;

        startTransition(async () => {
            const updated = await updateMarketListing(guildId, initial.id, buildPayload());
            if (!updated.success) {
                toast.error(updated.error || "Impossible d'enregistrer les modifications.");
                return;
            }

            toast.success("Annonce mise à jour.");
            router.push(`/dashboard/${guildId}/marche/${initial.id}`);
            router.refresh();
        });
    }

    function handleSubmit(publishNow: boolean) {
        if (hasFormError()) return;

        startTransition(async () => {
            const created = await createMarketListing(guildId, buildPayload());

            if (!created.success || !created.data) {
                toast.error(created.error || "Impossible de créer l'annonce.");
                return;
            }

            if (!publishNow) {
                toast.success("Brouillon enregistré. Publie-le depuis « Mes espaces ».");
                router.push(`/dashboard/${guildId}/marche/mes-espaces`);
                return;
            }

            const published = await publishMarketListing(guildId, created.data.id, pingRoleIds);
            if (!published.success) {
                toast.error(published.error || "L'annonce est créée mais la publication a échoué.");
                router.push(`/dashboard/${guildId}/marche/mes-espaces`);
                return;
            }

            toast.success("Annonce publiée sur le marché !");
            router.push(`/dashboard/${guildId}/marche/${created.data.id}`);
        });
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <StepIndicator step={step} stepCount={isEdit ? 3 : 4} />

            {step === 1 && (
                <StepNature
                    kind={kind}
                    onPick={(picked) => {
                        setKind(picked);
                        setStep(2);
                    }}
                />
            )}

            {step === 2 && kind === "EQUIPMENT" && (
                <>
                    <StepEquipment
                        item={item}
                        onSelect={(picked) => {
                            setItem(picked);
                            if (!title.trim()) setTitle(picked.name);
                            // S2.8 — plages natives pré-remplies (source catalogue).
                            setStats(
                                buildNativeStatDrafts(
                                    (picked.nativeEffects as MarketNativeEffect[] | null) ?? null
                                )
                            );
                        }}
                        onClear={() => {
                            setItem(null);
                            setStats([]);
                        }}
                    />
                    {item && (
                        <Card className="bg-surface/60 border-border">
                            <CardHeader>
                                <CardTitle className="text-base">Déclare ton jet</CardTitle>
                                <CardDescription>
                                    Les lignes natives sont pré-remplies depuis le catalogue. Ajuste la valeur
                                    réelle, ajoute un exo, ou clique « ✦ Jet parfait ».
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <MarketJetEditor stats={stats} onChange={setStats} />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {step === 2 && kind === "RESOURCE" && (
                <StepResources
                    components={components}
                    onAdd={(source) => setComponents((prev) => [...prev.slice(0, MARKET_LIMITS.MAX_COMPONENTS - 1), source])}
                    onChangeQuantity={(index, quantity) =>
                        setComponents((prev) => prev.map((row, i) => (i === index ? { ...row, quantity } : row)))
                    }
                    onRemove={(index) => setComponents((prev) => prev.filter((_, i) => i !== index))}
                    minQuantity={minQuantity}
                    onMinQuantityChange={setMinQuantity}
                />
            )}

            {step === 3 && (
                <StepPricing
                    kind={kind}
                    item={item}
                    components={components}
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    forgedBy={forgedBy}
                    setForgedBy={setForgedBy}
                    priceInput={priceInput}
                    setPriceInput={setPriceInput}
                    priceInvalid={priceInvalid}
                    negotiable={negotiable}
                    setNegotiable={setNegotiable}
                    acceptsTrade={acceptsTrade}
                    setAcceptsTrade={setAcceptsTrade}
                />
            )}

            {!isEdit && step === 4 && (
                <MarketPublishStep
                    channelName=""
                    title={title || item?.name || "Annonce"}
                    itemName={kind === "EQUIPMENT" ? item?.name ?? null : null}
                    itemLevel={kind === "EQUIPMENT" ? item?.level ?? null : null}
                    itemTypeName={kind === "EQUIPMENT" ? item?.typeName ?? null : null}
                    priceKamas={parsedPrice}
                    unitLabel={kind === "RESOURCE" && components.length === 1 ? components[0].unitLabel : null}
                    negotiable={negotiable}
                    forgedBy={forgedBy.trim() || null}
                    exoLabels={stats.filter((stat) => stat.origin === "EXO").map((stat) => stat.label)}
                    components={components.map((component) => ({ name: component.name, quantity: component.quantity }))}
                    context={publishContext}
                    roles={roles}
                    selectedPingIds={pingRoleIds}
                    onTogglePing={togglePing}
                />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                    type="button"
                    variant="ghost"
                    className="gap-2"
                    disabled={step === 1 || isPending}
                    onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev))}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Retour
                </Button>

                {/* S7.12 — en édition, la dernière étape enregistre les modifications. */}
                {isEdit && step === 3 ? (
                    <Button
                        type="button"
                        className="gap-2"
                        disabled={isPending || !canGoNext}
                        onClick={handleUpdate}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer les modifications
                    </Button>
                ) : !isEdit && step === 4 ? (
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={isPending || !canGoNext} onClick={() => handleSubmit(false)}>
                            Enregistrer en brouillon
                        </Button>
                        <Button type="button" className="gap-2" disabled={isPending || !canGoNext} onClick={() => handleSubmit(true)}>
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Publier l&apos;annonce
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        className="gap-2"
                        disabled={!canGoNext}
                        onClick={() => setStep((prev) => ((prev + 1) as 2 | 3 | 4))}
                    >
                        Continuer
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}


/** Fil des étapes (1 Nature → 2 Objet/Lot + jet → 3 Prix → 4 Publication). */
/**
 * Fil des étapes — **4** en création (jusqu'à la publication Discord), **3** en
 * édition (S7.12 : l'annonce existe déjà, on ne rejoue pas l'étape Discord).
 */
function StepIndicator({ step, stepCount = 4 }: { step: 1 | 2 | 3 | 4; stepCount?: 3 | 4 }) {
    const labels =
        stepCount === 3
            ? ["Nature", "Objet / Jet", "Prix"]
            : ["Nature", "Objet / Jet", "Prix", "Publication"];
    return (
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-black">
            {labels.map((label, index) => {
                const value = index + 1;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <span
                            className={cn(
                                "h-7 w-7 rounded-full border flex items-center justify-center",
                                step >= value ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-muted-foreground"
                            )}
                        >
                            {value}
                        </span>
                        <span className={step >= value ? "text-foreground" : "text-muted-foreground"}>
                            {label}
                        </span>
                        {value < labels.length && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                );
            })}
        </div>
    );
}

/** Étape 1 — nature de l'annonce (MVP : équipement / lot de ressources). */
function StepNature({ kind, onPick }: { kind: ListingKind; onPick: (kind: ListingKind) => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
                type="button"
                onClick={() => onPick("EQUIPMENT")}
                className={cn(
                    "text-left rounded-2xl border p-5 transition-colors",
                    kind === "EQUIPMENT" ? "border-gold/40 bg-gold/5" : "border-border bg-surface/60 hover:border-border-strong"
                )}
            >
                <Hammer className="w-6 h-6 text-gold mb-3" />
                <p className="font-bold text-foreground">Équipement forgemagie</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Choisis un objet du catalogue et déclare son prix (l&apos;éditeur de jet complet arrive en S2).
                </p>
            </button>
            <button
                type="button"
                onClick={() => onPick("RESOURCE")}
                className={cn(
                    "text-left rounded-2xl border p-5 transition-colors",
                    kind === "RESOURCE" ? "border-info/40 bg-info/5" : "border-border bg-surface/60 hover:border-border-strong"
                )}
            >
                <Package className="w-6 h-6 text-info mb-3" />
                <p className="font-bold text-foreground">Lot de ressources</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Lot simple (une ressource) ou composite (plusieurs ressources) avec quantité minimale.
                </p>
            </button>
        </div>
    );
}


/** Étape 2 (équipement) — sélection d'un objet du catalogue local. */
function StepEquipment({
    item,
    onSelect,
    onClear,
}: {
    item: GameItemSearchResult | null;
    onSelect: (item: GameItemSearchResult) => void;
    onClear: () => void;
}) {
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Choisis l&apos;objet du catalogue</CardTitle>
                <CardDescription>Recherche par nom dans le catalogue local Dofus (aucun item inventé).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {item ? (
                    <SelectedItem item={item} onClear={onClear} />
                ) : (
                    <CataloguePicker category="equipment" placeholder="Ex. Anneau de Force…" onSelect={onSelect} />
                )}
            </CardContent>
        </Card>
    );
}

/** Étape 2 (ressources) — lot simple ou composite (S1.33). */
function StepResources({
    components,
    onAdd,
    onChangeQuantity,
    onRemove,
    minQuantity,
    onMinQuantityChange,
}: {
    components: ComponentDraft[];
    onAdd: (component: ComponentDraft) => void;
    onChangeQuantity: (index: number, quantity: number) => void;
    onRemove: (index: number) => void;
    minQuantity: string;
    onMinQuantityChange: (value: string) => void;
}) {
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Compose ton lot de ressources</CardTitle>
                <CardDescription>
                    Jusqu&apos;à {MARKET_LIMITS.MAX_COMPONENTS} ressources. La quantité minimale s&apos;applique à tout le lot.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <CataloguePicker
                    category="resources"
                    placeholder="Ex. Bois de Frêne…"
                    onSelect={(picked) =>
                        onAdd({
                            key: `${picked.ankamaId}-${components.length}-${picked.name}`,
                            dofusDbItemId: picked.ankamaId,
                            name: picked.name,
                            iconUrl: picked.iconUrl,
                            quantity: 1,
                            unitLabel: null,
                        })
                    }
                />

                {components.length > 0 && (
                    <div className="space-y-2">
                        {components.map((component, index) => (
                            <div key={component.key} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                                <span className="text-sm font-semibold text-foreground truncate flex-1">{component.name}</span>
                                <Input
                                    type="number"
                                    min={1}
                                    value={component.quantity}
                                    onChange={(event) => {
                                        const value = Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1);
                                        onChangeQuantity(index, value);
                                    }}
                                    className="w-28"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        <div className="space-y-1.5 pt-1">
                            <Label className="text-xs">Quantité minimale par acheteur (facultatif)</Label>
                            <Input
                                placeholder="Ex. 100"
                                value={minQuantity}
                                onChange={(event) => onMinQuantityChange(event.target.value)}
                                inputMode="numeric"
                                className="max-w-xs"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


/** Étape 3 — titre, description, prix et conditions. */
function StepPricing(props: {
    kind: ListingKind;
    item: GameItemSearchResult | null;
    components: ComponentDraft[];
    title: string;
    setTitle: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    forgedBy: string;
    setForgedBy: (value: string) => void;
    priceInput: string;
    setPriceInput: (value: string) => void;
    priceInvalid: boolean;
    negotiable: boolean;
    setNegotiable: (value: boolean) => void;
    acceptsTrade: boolean;
    setAcceptsTrade: (value: boolean) => void;
}) {
    const preview = parseKamas(props.priceInput);
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Prix & conditions</CardTitle>
                <CardDescription>
                    {props.kind === "EQUIPMENT"
                        ? props.item?.name ?? "Objet du catalogue"
                        : `${props.components.length} ressource(s)`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">Titre de l&apos;annonce</Label>
                    <Input
                        value={props.title}
                        onChange={(event) => props.setTitle(event.target.value)}
                        maxLength={MARKET_LIMITS.TITLE_MAX}
                        placeholder="Ex. Anneau de Force +12 Vitalité, over 300"
                    />
                </div>

                {props.kind === "EQUIPMENT" && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Modifié par (facultatif)</Label>
                        <Input
                            value={props.forgedBy}
                            onChange={(event) => props.setForgedBy(event.target.value)}
                            maxLength={80}
                            placeholder="Pseudo de l'artisan FM"
                        />
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label className="text-xs">Description (facultatif)</Label>
                    <Textarea
                        value={props.description}
                        onChange={(event) => props.setDescription(event.target.value)}
                        maxLength={MARKET_LIMITS.DESCRIPTION_MAX}
                        rows={3}
                        placeholder="Précise l'état, les conditions d'échange, tes disponibilités… (les liens sont retirés)"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Prix en kamas *</Label>
                    <Input
                        value={props.priceInput}
                        onChange={(event) => props.setPriceInput(event.target.value)}
                        inputMode="numeric"
                        placeholder="Ex. 12 500"
                        className={props.priceInvalid ? "border-danger" : undefined}
                    />
                    <p className="text-[11px] text-muted-foreground">
                        {props.priceInvalid
                            ? "Prix invalide : saisis un entier de kamas."
                            : `Aperçu : ${formatKamas(preview)}`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch checked={props.negotiable} onCheckedChange={props.setNegotiable} />
                        Prix négociable
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch checked={props.acceptsTrade} onCheckedChange={props.setAcceptsTrade} />
                        Troc accepté
                    </label>
                </div>
            </CardContent>
        </Card>
    );
}

/** Aperçu de l'objet sélectionné. */
function SelectedItem({ item, onClear }: { item: GameItemSearchResult; onClear: () => void }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
            <div className="relative h-12 w-12 shrink-0 rounded-xl border border-border bg-background/60 overflow-hidden">
                {item.iconUrl ? (
                    <Image src={item.iconUrl} alt={item.name} fill sizes="48px" className="object-contain p-1" unoptimized />
                ) : (
                    <Store className="w-5 h-5 text-muted-foreground absolute inset-0 m-auto" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                    {item.typeName} · Niv. {item.level}
                </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                Changer
            </Button>
        </div>
    );
}


/** Recherche dans le catalogue local (consomme `searchLocalGameItems`, D29). */
function CataloguePicker({
    category,
    placeholder,
    onSelect,
}: {
    category: "equipment" | "resources";
    placeholder: string;
    onSelect: (item: GameItemSearchResult) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameItemSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** `true` dès qu'une recherche aboutie correspond à la saisie courante. */
    const [searched, setSearched] = useState(false);
    /** Anti-course : seule la **dernière** frappe peut écrire les résultats (S7.15). */
    const requestId = useRef(0);

    /**
     * S7.15 — recherche **déclenchée à la frappe** : plus besoin de cliquer sur
     * « Rechercher ». Le bouton reste (accessibilité et repli explicite) et les
     * réponses obsolètes sont ignorées (`requestId`).
     */
    function runSearch(term: string) {
        const trimmed = term.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setError(null);
            setSearched(false);
            return;
        }

        const id = ++requestId.current;
        setIsSearching(true);
        setError(null);
        void searchLocalGameItems(trimmed, category, 12)
            .then((res) => {
                if (id !== requestId.current) return;
                if (!res.success) {
                    setError(res.error || "Recherche indisponible");
                    setResults([]);
                } else {
                    setResults(res.data || []);
                }
            })
            .catch(() => {
                if (id === requestId.current) setError("Recherche indisponible pour le moment.");
            })
            .finally(() => {
                if (id === requestId.current) {
                    setIsSearching(false);
                    setSearched(true);
                }
            });
    }

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setError(null);
            setSearched(false);
            return;
        }
        // Debounce : on attend 300 ms d'inactivité avant d'interroger le catalogue.
        const timer = setTimeout(() => runSearch(trimmed), 300);
        return () => clearTimeout(timer);
        // `runSearch` ne dépend que de `category` (rejouée si la nature change).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, category]);

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                runSearch(query);
                            }
                        }}
                        placeholder={placeholder}
                        className="pl-9 pr-9"
                    />
                    {/* S7.15 — la recherche se déclenche à la frappe : le témoin de
                        chargement remplace le clic obligatoire d'avant. */}
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                </div>
                <Button type="button" variant="outline" onClick={() => runSearch(query)} disabled={isSearching || query.trim().length < 2}>
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rechercher"}
                </Button>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            {results.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                    {results.map((result) => (
                        <button
                            key={result.ankamaId}
                            type="button"
                            onClick={() => onSelect(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-foreground/[0.03] transition-colors"
                        >
                            <span className="relative h-8 w-8 shrink-0 rounded-lg border border-border bg-background/60 overflow-hidden">
                                {result.iconUrl ? (
                                    <Image src={result.iconUrl} alt={result.name} fill sizes="32px" className="object-contain p-0.5" unoptimized />
                                ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground truncate">{result.name}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                    {result.typeName} · Niv. {result.level}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {searched && !isSearching && !error && results.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun objet trouvé. Essaie un autre nom.</p>
            )}
        </div>
    );
}

