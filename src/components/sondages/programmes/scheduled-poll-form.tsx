"use client";

/**
 * Sondages **programmés** (module staff) — **formulaire** d'un créneau.
 *
 * Mêmes champs que le module Sondages (question, description, catégorie, choix,
 * votes multiples, anonymat, source externe, salon, pings) : un créneau produit
 * un **sondage normal** à l'échéance, donc l'auteur doit tout pouvoir régler
 * ici. La seule différence de fond : on choisit **quand** publier (date, heure,
 * minute) et **combien de temps** le vote reste ouvert.
 *
 * Bornes : elles viennent toutes de `@/lib/polls/limits` et
 * `@/lib/polls/scheduling` (une seule source, testée) — `min`/`max` du
 * sélecteur comme bornes serveur, jamais des valeurs recopiées à la main.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Info, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
    MAX_DURATION_HOURS,
    MAX_HORIZON_DAYS,
    MIN_DURATION_HOURS,
    MIN_LEAD_MINUTES,
} from "@/lib/polls/scheduling";
import { POLL_CATEGORY_LABELS, POLL_SLOT_COUNTER } from "@/lib/polls/ui";
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
    const [bounds, setBounds] = useState<{ min?: string; max?: string }>({});

    useEffect(() => {
        if (!open) return;
        const now = Date.now();
        setBounds({
            min: toLocalInputValue(new Date(now + MIN_LEAD_MINUTES * 60_000)),
            max: toLocalInputValue(new Date(now + MAX_HORIZON_DAYS * 24 * 60 * 60_000)),
        });
    }, [open]);

    const [title, setTitle] = useState(slot?.title ?? "");
    const [description, setDescription] = useState(slot?.description ?? "");
    const [category, setCategory] = useState(slot?.category ?? "SUGGESTION");
    const [options, setOptions] = useState<string[]>(slot?.options.map((o) => o.label) ?? ["", ""]);
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(slot?.allowMultipleVotes ?? false);
    const [isAnonymous, setIsAnonymous] = useState(slot?.isAnonymous ?? false);
    const [externalUrl, setExternalUrl] = useState(slot?.externalUrl ?? "");
    const [scheduledAt, setScheduledAt] = useState(slot ? toLocalInputValue(new Date(slot.scheduledAt)) : "");
    const [durationHours, setDurationHours] = useState<string>(slot?.durationHours ? String(slot.durationHours) : defaultDurationH ? String(defaultDurationH) : "");
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

    const filledOptions = options.map((label) => label.trim()).filter(Boolean);
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
                options: filledOptions.map((label) => ({ label })),
                allowMultipleVotes,
                isAnonymous,
                scheduledAt: new Date(scheduledAt).toISOString(),
                durationHours: durationHours.trim() ? Number(durationHours) : null,
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
                    <Button disabled={slotFull} className="gap-2 h-10">
                        <Plus className="w-4 h-4" />
                        Nouveau créneau
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            <span className={POLL_SLOT_COUNTER}>
                                {description.length}/{POLL_DESCRIPTION_MAX_LENGTH}
                            </span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            maxLength={POLL_DESCRIPTION_MAX_LENGTH}
                            placeholder="Contexte, enjeux, ce que la guilde doit décider… (retours à la ligne respectés dans l'embed)"
                            className="w-full rounded-lg bg-surface/60 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-info/50 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-caption font-semibold text-muted-foreground">Catégorie</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full h-10 rounded-lg bg-surface/60 border border-border px-3 text-sm"
                            >
                                {Object.entries(POLL_CATEGORY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
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
                            />
                            <p className="text-caption text-muted-foreground">
                                Au moins {MIN_LEAD_MINUTES} minutes dans le futur, {MAX_HORIZON_DAYS} jours au maximum.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-semibold text-muted-foreground">
                            Choix ({filledOptions.length}/{POLL_OPTION_MAX_COUNT})
                        </label>
                        {options.map((label, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={label}
                                    onChange={(e) => {
                                        const next = [...options];
                                        next[index] = e.target.value;
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
                            onClick={() => setOptions([...options, ""])}
                            className="gap-2"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Ajouter un choix
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface/40 border border-border">
                            <span className="text-sm">Votes multiples</span>
                            <Switch checked={allowMultipleVotes} onCheckedChange={setAllowMultipleVotes} />
                        </div>
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface/40 border border-border">
                            <span className="text-sm">Votes anonymes</span>
                            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                        </div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-caption font-semibold text-muted-foreground">
                                Durée du vote une fois publié (heures)
                            </label>
                            <Input
                                type="number"
                                min={MIN_DURATION_HOURS}
                                max={MAX_DURATION_HOURS}
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                                placeholder={defaultDurationH ? `Défaut : ${defaultDurationH} h` : "Vide = sans date de fin"}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-caption font-semibold text-muted-foreground">Source externe (optionnel)</label>
                            <Input
                                type="url"
                                value={externalUrl}
                                onChange={(e) => setExternalUrl(e.target.value)}
                                placeholder="https://…"
                            />
                        </div>
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
