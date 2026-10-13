"use client";

/**
 * Sondages **programmés** (module staff) — **formulaire** d'un créneau.
 *
 * Mêmes champs que le module Sondages (question, description, catégorie, choix,
 * votes multiples, anonymat, source externe, salon, pings) : un créneau produit
 * un **sondage normal** à l'échéance, donc l'auteur doit tout pouvoir régler
 * ici. Les réglages du vote (votes multiples, anonymat, expiration, lien
 * externe) sont le **composant partagé** `PollVoteSettings` — mêmes cartes et
 * mêmes durées proposées que la modale membre, zéro duplication. La seule
 * différence de fond : on choisit **quand** publier (date, heure, minute) ;
 * la durée du vote court **à partir de la publication**.
 *
 * Bornes : elles viennent toutes de `@/lib/polls/limits` et
 * `@/lib/polls/scheduling` (une seule source, testée) — `min`/`max` du
 * sélecteur comme bornes serveur, jamais des valeurs recopiées à la main.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Info, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { createScheduledPoll, updateScheduledPoll, type ScheduledPollSlotView } from "@/server/actions/scheduled-poll-actions";
import {
    POLL_DESCRIPTION_MAX_LENGTH,
    POLL_OPTION_MAX_COUNT,
    POLL_OPTION_MIN_COUNT,
    POLL_TITLE_MAX_LENGTH,
} from "@/lib/polls/limits";
import {
    DURATION_PRESETS,
    MAX_HORIZON_DAYS,
    MIN_LEAD_MINUTES,
} from "@/lib/polls/scheduling";
import { formatPollEnd } from "@/lib/poll-format";
import { POLL_SLOT_COUNTER } from "@/lib/polls/ui";
import { PollCategoryTiles } from "../poll-category-tiles";
import { PollVoteSettings } from "../poll-vote-settings";
import { EmojiPicker } from "@/components/editor/emoji-picker";
import {
    MAX_REPEAT_EVERY,
    MAX_REPEAT_UNTIL_DAYS,
    repeatLabel,
    repeatOccurrences,
    type ScheduledRepeatUnit,
} from "@/lib/polls/scheduling";
import { cn } from "@/lib/utils";

interface ScheduledPollFormProps {
    guildId: string;
    /** Créneau à modifier (absent = création). */
    slot?: ScheduledPollSlotView;
    defaultChannelId: string | null;
    defaultDurationH: number | null;
    /** Nombre de places restantes (création). */
    slotsLeft: number;
    trigger?: React.ReactNode;
}

/** `Date` → valeur d'un `<input type="datetime-local">` (heure du navigateur, minute exacte). */
function toLocalInputValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduledPollForm({
    guildId,
    slot,
    defaultChannelId,
    defaultDurationH,
    slotsLeft,
    trigger,
}: ScheduledPollFormProps) {
    const router = useRouter();
    const isEdit = Boolean(slot);
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Bornes du sélecteur : maintenant + délai minimal → maintenant + horizon.
    // Calculées à l'OUVERTURE (jamais pendant le rendu : `Date.now()` est impur).
    const [bounds, setBounds] = useState<{ min?: string; max?: string; maxUntil?: string }>({});

    useEffect(() => {
        if (!open) return;
        const now = Date.now();
        setBounds({
            min: toLocalInputValue(new Date(now + MIN_LEAD_MINUTES * 60_000)),
            max: toLocalInputValue(new Date(now + MAX_HORIZON_DAYS * 24 * 60 * 60_000)),
            maxUntil: toLocalInputValue(new Date(now + MAX_REPEAT_UNTIL_DAYS * 24 * 60 * 60_000)),
        });
    }, [open]);

    const [title, setTitle] = useState(slot?.title ?? "");
    const [description, setDescription] = useState(slot?.description ?? "");
    const [category, setCategory] = useState(slot?.category ?? "SUGGESTION");
    const [options, setOptions] = useState<{ label: string; emoji: string }[]>(
        slot?.options.map((o) => ({ label: o.label, emoji: o.emoji ?? "" })) ?? [
            { label: "", emoji: "" },
            { label: "", emoji: "" },
        ],
    );
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(slot?.allowMultipleVotes ?? false);
    const [isAnonymous, setIsAnonymous] = useState(slot?.isAnonymous ?? false);
    const [externalUrl, setExternalUrl] = useState(slot?.externalUrl ?? "");
    const [scheduledAt, setScheduledAt] = useState(slot ? toLocalInputValue(new Date(slot.scheduledAt)) : "");
    const [repeatUnit, setRepeatUnit] = useState<"" | ScheduledRepeatUnit>((slot?.repeatUnit as ScheduledRepeatUnit) ?? "");
    const [repeatEvery, setRepeatEvery] = useState<string>(slot?.repeatEvery ? String(slot.repeatEvery) : "1");
    const [repeatUntil, setRepeatUntil] = useState<string>(slot?.repeatUntil ? toLocalInputValue(new Date(slot.repeatUntil)) : "");
    const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
    // Durée du vote : celle du créneau, sinon le défaut de la guilde, sinon la
    // première durée proposée — et jamais un champ libre (les quatre durées du
    // module se choisissent d'un clic, la valeur courante restant affichée).
    const [hasExpiry, setHasExpiry] = useState<boolean>(
        slot ? slot.durationHours !== null : defaultDurationH !== null,
    );
    const [expiryHours, setExpiryHours] = useState<number>(
        slot?.durationHours ?? defaultDurationH ?? DURATION_PRESETS[0].hours,
    );
    const [channelId, setChannelId] = useState(slot?.discordChannelId ?? "");
    const [mentionRoleIds, setMentionRoleIds] = useState<string[]>(slot?.mentionRoleIds ?? []);
    const [roles, setRoles] = useState<{ id: string; name: string; color: string }[]>([]);

    // Rôles de ping : whitelist dédiée au module (fail-closed côté serveur aussi).
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        getDiscordRolesAction(guildId, { context: "scheduledPolls" })
            .then((res) => {
                if (!cancelled && res.success && res.roles) setRoles(res.roles as any);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [open, guildId]);

    const filledOptions = options.filter((option) => option.label.trim().length > 0);

    /** Occurrences suivantes (aperçu) : la répétition doit être LUE avant d'être posée. */
    const repeatPreview = useMemo(() => {
        if (!repeatUnit || !scheduledAt) return [];
        const from = new Date(scheduledAt);
        if (Number.isNaN(from.getTime())) return [];
        return repeatOccurrences({
            from,
            every: Number(repeatEvery) || 1,
            unit: repeatUnit,
            until: repeatUntil ? new Date(repeatUntil) : null,
        });
    }, [repeatUnit, repeatEvery, repeatUntil, scheduledAt]);

    const repeatSummary = repeatLabel({ every: Number(repeatEvery) || 1, unit: repeatUnit || null });

    /** Insertion d'un emoji **au curseur** (même comportement que le module membre). */
    const insertEmoji = (emoji: string) => {
        const el = descriptionRef.current;
        if (!el) {
            setDescription((prev) => prev + emoji);
            return;
        }
        const start = el.selectionStart ?? description.length;
        const end = el.selectionEnd ?? start;
        setDescription(description.slice(0, start) + emoji + description.slice(end));
        requestAnimationFrame(() => {
            el.focus();
            const caret = start + emoji.length;
            el.setSelectionRange(caret, caret);
        });
    };

    const canSubmit =
        title.trim().length >= 3 &&
        title.trim().length <= POLL_TITLE_MAX_LENGTH &&
        description.trim().length >= 5 &&
        filledOptions.length >= POLL_OPTION_MIN_COUNT &&
        scheduledAt.length > 0;

    const handleSubmit = () => {
        startTransition(async () => {
            const payload = {
                guildId,
                title: title.trim(),
                description: description.trim(),
                category,
                options: filledOptions.map((option) => ({ label: option.label.trim(), emoji: option.emoji || undefined })),
                allowMultipleVotes,
                isAnonymous,
                scheduledAt: new Date(scheduledAt).toISOString(),
                durationHours: hasExpiry ? expiryHours : null,
                repeatEvery: repeatUnit ? (Number(repeatEvery) || 1) : null,
                repeatUnit: repeatUnit || null,
                repeatUntil: repeatUnit && repeatUntil ? new Date(repeatUntil).toISOString() : null,
                discordChannelId: channelId.trim() || null,
                mentionRoleIds,
                externalUrl: externalUrl.trim() || null,
            };

            const res = isEdit && slot
                ? await updateScheduledPoll({ ...payload, slotId: slot.id })
                : await createScheduledPoll(payload);

            if (res.success) {
                toast.success(isEdit ? "Créneau mis à jour" : "Sondage programmé");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const slotFull = !isEdit && slotsLeft <= 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button disabled={slotFull} className="gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold">
                        <Plus className="w-3.5 h-3.5" />
                        Nouveau créneau
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto premium-scrollbar">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Modifier le créneau" : "Programmer un sondage"}</DialogTitle>
                    <DialogDescription>
                        À l&apos;échéance, un sondage identique à ceux du module Sondages est publié
                        automatiquement dans le salon choisi (mêmes options, mêmes boutons de vote).
                    </DialogDescription>
                </DialogHeader>

                {slotFull && (
                    <p className="text-caption text-danger flex items-center gap-2">
                        <TriangleAlert className="w-3.5 h-3.5" />
                        Toutes les places sont prises : publie ou annule un créneau pour en libérer une.
                    </p>
                )}

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-caption font-semibold text-muted-foreground">Question</label>
                            <span className={cn(POLL_SLOT_COUNTER, title.length > POLL_TITLE_MAX_LENGTH - 10 && "text-warning")}>
                                {title.length}/{POLL_TITLE_MAX_LENGTH}
                            </span>
                        </div>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={POLL_TITLE_MAX_LENGTH}
                            placeholder="Ex: Quelle date pour la prochaine sortie de guilde ?"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-caption font-semibold text-muted-foreground">Description</label>
                            <div className="flex items-center gap-1.5">
                                <span className={POLL_SLOT_COUNTER}>
                                    {description.length}/{POLL_DESCRIPTION_MAX_LENGTH}
                                </span>
                                {/* Même picker d'emoji que le module membre (insertion au curseur) :
                                    c'est ce qui rend cette modale aussi vivante sans la barioler. */}
                                <EmojiPicker onSelect={insertEmoji} />
                            </div>
                        </div>
                        <textarea
                            ref={descriptionRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            maxLength={POLL_DESCRIPTION_MAX_LENGTH}
                            placeholder="Contexte, enjeux, ce que la guilde doit décider… (retours à la ligne respectés dans l'embed)"
                            className="w-full rounded-lg bg-surface/60 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-info/50 resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-semibold text-muted-foreground">Thématique</label>
                        {/* Tuiles partagées avec la modale membre : mêmes libellés, même rendu. */}
                        <PollCategoryTiles value={category} onChange={setCategory} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-caption font-semibold text-muted-foreground flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" />
                            Date, heure et minute de publication
                        </label>
                        <Input
                            type="datetime-local"
                            value={scheduledAt}
                            min={bounds.min}
                            max={bounds.max}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="sm:max-w-xs"
                        />
                        <p className="text-caption text-muted-foreground">
                            Au moins {MIN_LEAD_MINUTES} minutes dans le futur, {MAX_HORIZON_DAYS} jours au maximum.
                        </p>
                    </div>

                    {/* Répétition : « tous les N jours / semaines / mois », fin facultative.
                        Une seule occurrence existe à la fois — la suivante est programmée à la
                        publication, donc le plafond de 3 créneaux reste tenu. */}
                    <div className="space-y-2 p-3 rounded-lg bg-surface/40 border border-border">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-caption font-semibold text-muted-foreground">Répétition</span>
                            <select
                                value={repeatUnit}
                                onChange={(e) => setRepeatUnit(e.target.value as "" | ScheduledRepeatUnit)}
                                aria-label="Répétition du sondage programmé"
                                className="h-9 rounded-lg border border-border bg-surface/60 px-2.5 text-xs"
                            >
                                <option value="">Aucune (créneau unique)</option>
                                <option value="DAYS">Tous les… jours</option>
                                <option value="WEEKS">Toutes les… semaines</option>
                                <option value="MONTHS">Tous les… mois</option>
                            </select>
                            {repeatUnit && (
                                <Input
                                    type="number"
                                    min={1}
                                    max={MAX_REPEAT_EVERY}
                                    value={repeatEvery}
                                    onChange={(e) => setRepeatEvery(e.target.value)}
                                    aria-label="Intervalle de répétition"
                                    className="h-9 w-20"
                                />
                            )}
                        </div>

                        {repeatUnit && (
                            <>
                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="space-y-1">
                                        <label className="text-caption text-muted-foreground">Fin (facultative)</label>
                                        <Input
                                            type="datetime-local"
                                            value={repeatUntil}
                                            max={bounds.maxUntil}
                                            onChange={(e) => setRepeatUntil(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    {repeatUntil && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setRepeatUntil("")}
                                            className="text-caption"
                                        >
                                            Sans fin
                                        </Button>
                                    )}
                                </div>
                                <p className="text-caption text-muted-foreground">
                                    {repeatSummary} — la série s&apos;arrête {repeatUntil ? "à la fin choisie" : "quand tu l'annules"}
                                    {repeatUntil ? "" : `, et au plus tard ${MAX_REPEAT_UNTIL_DAYS} jours après le premier créneau`}.
                                </p>
                                {repeatPreview.length > 0 && (
                                    <p className="text-caption text-info">
                                        Prochaines publications : {repeatPreview.map((date) => formatPollEnd(date)?.absolute ?? "").join(" · ")}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-semibold text-muted-foreground">
                            Choix ({filledOptions.length}/{POLL_OPTION_MAX_COUNT})
                        </label>
                        {options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                                {/* Emoji du choix : même geste que le module membre (l'embed
                                    l'utilise comme préfixe du bouton de vote). */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="w-6 text-center text-base leading-none" aria-hidden="true">
                                        {option.emoji || ""}
                                    </span>
                                    <EmojiPicker
                                        onSelect={(emoji) => {
                                            const next = [...options];
                                            next[index] = { ...next[index], emoji };
                                            setOptions(next);
                                        }}
                                    />
                                </div>
                                <Input
                                    value={option.label}
                                    onChange={(e) => {
                                        const next = [...options];
                                        next[index] = { ...next[index], label: e.target.value };
                                        setOptions(next);
                                    }}
                                    placeholder={`Choix ${index + 1}`}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={options.length <= POLL_OPTION_MIN_COUNT}
                                    onClick={() => setOptions(options.filter((_, i) => i !== index))}
                                    aria-label="Retirer ce choix"
                                >
                                    <Trash2 className="w-4 h-4 text-danger" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={options.length >= POLL_OPTION_MAX_COUNT}
                            onClick={() => setOptions([...options, { label: "", emoji: "" }])}
                            className="gap-2"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Ajouter un choix
                        </Button>
                    </div>

                    {/* Réglages du vote : composant PARTAGÉ avec la modale classique
                        (mêmes durées proposées d'un clic, même carte « Lien externe »). */}
                    <div className="space-y-2">
                        <label className="text-caption font-semibold text-muted-foreground">
                            Réglages du vote (appliqués à la publication)
                        </label>
                        <PollVoteSettings
                            allowMultipleVotes={allowMultipleVotes}
                            onAllowMultipleVotesChange={setAllowMultipleVotes}
                            isAnonymous={isAnonymous}
                            onIsAnonymousChange={setIsAnonymous}
                            hasExpiry={hasExpiry}
                            onHasExpiryChange={setHasExpiry}
                            expiryHours={expiryHours}
                            onExpiryHoursChange={setExpiryHours}
                            externalUrl={externalUrl}
                            onExternalUrlChange={setExternalUrl}
                        />
                        <p className="text-caption text-muted-foreground">
                            La durée choisie court à partir de la publication du sondage, jamais de
                            l&apos;enregistrement du créneau.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-caption font-semibold text-muted-foreground">Salon Discord de publication</label>
                        <DiscordChannelPicker
                            guildId={guildId}
                            value={channelId}
                            onChange={setChannelId}
                            allowEmptyLabel="Salon par défaut des paramètres"
                            placeholder={defaultChannelId ? "Salon par défaut (paramètres)" : "Choisir un salon…"}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-semibold text-muted-foreground">Rôles à mentionner à la publication</label>
                        <PingRolesSelector
                            value={mentionRoleIds}
                            onChange={setMentionRoleIds}
                            roles={roles}
                            description="Seuls les rôles autorisés dans les paramètres du module (onglet Sondages → Sondages programmés) sont proposés."
                        />
                    </div>

                    <p className="text-caption text-muted-foreground flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        Si le module est coupé (maintenance plateforme ou verrou de guilde) au moment de
                        l&apos;échéance, le créneau n&apos;est pas publié : il reste en attente et part dès la
                        réactivation.
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                        <Button onClick={handleSubmit} disabled={!canSubmit || isPending || slotFull}>
                            {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Programmer"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
