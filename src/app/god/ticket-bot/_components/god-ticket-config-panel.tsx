"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hash, Plus, Save, Settings2, Star, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    loadGodTicketGuildAssetsAction,
    saveGodTicketCategoryAction,
    saveGodTicketConfigAction,
    setGodTicketCategoryEnabledAction,
    type GodTicketChannelOption,
    type GodTicketConfigPanelData,
    type GodTicketRoleOption,
} from "@/server/actions/god-ticket-actions";
import {
    GOD_TICKET_CATEGORY_KEY_PATTERN,
    GOD_TICKET_COLOR_PATTERN,
    type GodTicketCategoryRow,
    type GodTicketConfigView,
} from "@/lib/tickets/god-config";

type CategoryDraft = {
    key: string;
    label: string;
    emoji: string;
    color: string;
    order: number;
    isEnabled: boolean;
};

function validColor(color: string): string {
    return GOD_TICKET_COLOR_PATTERN.test(color) ? color : "#6366f1";
}

export function GodTicketConfigPanel({ initial }: { initial: GodTicketConfigPanelData }) {
    const router = useRouter();
    const [config, setConfig] = useState<GodTicketConfigView>(initial.config);
    const [categories, setCategories] = useState<GodTicketCategoryRow[]>(initial.categories);
    const [channels, setChannels] = useState<GodTicketChannelOption[]>(initial.channels);
    const [roles, setRoles] = useState<GodTicketRoleOption[]>(initial.roles);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const nextOrder = useMemo(
        () => categories.reduce((max, category) => Math.max(max, category.order), 0) + 10,
        [categories]
    );
    const [draft, setDraft] = useState<CategoryDraft>({
        key: "",
        label: "",
        emoji: "🎫",
        color: "#6366f1",
        order: nextOrder,
        isEnabled: true,
    });

    const roleOptions = roles.map((role) => ({ label: role.name, value: role.id }));

    const handleGuildChange = async (value: string) => {
        const guildId = value === "none" ? null : value;
        setConfig((previous) => ({
            ...previous,
            supportGuildId: guildId,
            supportChannelId: null,
            staffRoleIds: [],
            notifyRoleIds: [],
        }));
        setChannels([]);
        setRoles([]);
        if (!guildId) return;

        setAssetsLoading(true);
        try {
            const result = await loadGodTicketGuildAssetsAction(guildId);
            if (result.success) {
                setChannels(result.data.channels);
                setRoles(result.data.roles);
            } else {
                toast.error(result.error);
            }
        } finally {
            setAssetsLoading(false);
        }
    };

    const handleSaveConfig = () => {
        startTransition(async () => {
            const result = await saveGodTicketConfigAction({
                supportGuildId: config.supportGuildId,
                supportChannelId: config.supportChannelId,
                staffRoleIds: config.staffRoleIds,
                notifyRoleIds: config.notifyRoleIds,
                namingPattern: config.namingPattern.trim(),
                closePolicy: config.closePolicy,
                archiveOnClose: config.archiveOnClose,
                csatEnabled: config.csatEnabled,
            });
            if (result.success) {
                toast.success("Réglages du support enregistrés");
                router.refresh();
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleSaveCategory = (category: GodTicketCategoryRow) => {
        startTransition(async () => {
            const result = await saveGodTicketCategoryAction({
                id: category.id,
                key: category.key,
                label: category.label,
                emoji: category.emoji,
                color: category.color,
                order: category.order,
                isEnabled: category.isEnabled,
            });
            if (result.success) {
                setCategories((previous) =>
                    previous.map((item) => (item.id === category.id ? result.data : item))
                );
                toast.success("Catégorie enregistrée");
                router.refresh();
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleToggleCategory = (category: GodTicketCategoryRow, enabled: boolean) => {
        startTransition(async () => {
            const result = await setGodTicketCategoryEnabledAction({ id: category.id, enabled });
            if (result.success) {
                setCategories((previous) =>
                    previous.map((item) =>
                        item.id === category.id ? { ...item, isEnabled: enabled } : item
                    )
                );
                toast.success(enabled ? "Catégorie réactivée" : "Catégorie désactivée");
                router.refresh();
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleCreateCategory = () => {
        if (!GOD_TICKET_CATEGORY_KEY_PATTERN.test(draft.key)) {
            toast.error("Clé : minuscules, chiffres et tirets (2 à 40 caractères)");
            return;
        }
        startTransition(async () => {
            const result = await saveGodTicketCategoryAction(draft);
            if (result.success) {
                setCategories((previous) => [...previous, result.data]);
                setDraft({
                    key: "",
                    label: "",
                    emoji: "🎫",
                    color: "#6366f1",
                    order: result.data.order + 10,
                    isEnabled: true,
                });
                toast.success("Catégorie créée");
                router.refresh();
            } else {
                toast.error(result.error);
            }
        });
    };

    const updateCategory = (id: string, patch: Partial<GodTicketCategoryRow>) => {
        setCategories((previous) =>
            previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
        );
    };

    const isConfigured = Boolean(config.supportGuildId && config.supportChannelId);
    const currentGuildKnown = initial.guilds.some((guild) => guild.id === config.supportGuildId);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <Settings2 className="h-5 w-5 text-info" aria-hidden="true" />
                        Réglages du support God
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Destination, rôles, fermeture et catégories du module support. Aucun identifiant
                        n&apos;est écrit dans le code.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge
                        variant="outline"
                        className={isConfigured ? "border-info/30 bg-info/10 text-info" : "text-muted-foreground"}
                    >
                        {isConfigured ? "Configuré" : "À configurer"}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Star className="h-3 w-3" aria-hidden="true" />
                        {initial.csat.average !== null ? `${initial.csat.average} / 5` : "Pas encore de note"}
                        {initial.csat.count > 0 ? ` (${initial.csat.count})` : ""}
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Hash className="h-4 w-4 text-info" aria-hidden="true" />
                        Destination du support
                    </CardTitle>
                    <CardDescription>
                        Le panneau est publié dans ce salon et les fils privés y naissent. Les
                        identifiants sont revalidés auprès de Discord avant chaque écriture.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="god-ticket-guild">Serveur support</Label>
                            <Select
                                value={config.supportGuildId ?? "none"}
                                onValueChange={handleGuildChange}
                                disabled={assetsLoading || isPending}
                            >
                                <SelectTrigger id="god-ticket-guild">
                                    <SelectValue placeholder="Choisir un serveur" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Aucun (module non destinationné)</SelectItem>
                                    {config.supportGuildId && !currentGuildKnown ? (
                                        <SelectItem value={config.supportGuildId}>
                                            Serveur configuré (indisponible)
                                        </SelectItem>
                                    ) : null}
                                    {initial.guilds.map((guild) => (
                                        <SelectItem key={guild.id} value={guild.id}>
                                            {guild.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="god-ticket-channel">Salon du support</Label>
                            <Select
                                value={config.supportChannelId ?? "none"}
                                onValueChange={(value) =>
                                    setConfig((previous) => ({
                                        ...previous,
                                        supportChannelId: value === "none" ? null : value,
                                    }))
                                }
                                disabled={!config.supportGuildId || assetsLoading || isPending}
                            >
                                <SelectTrigger id="god-ticket-channel">
                                    <SelectValue placeholder="Choisir un salon" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Aucun</SelectItem>
                                    {config.supportChannelId &&
                                    !channels.some((channel) => channel.id === config.supportChannelId) ? (
                                        <SelectItem value={config.supportChannelId}>
                                            Salon configuré (indisponible)
                                        </SelectItem>
                                    ) : null}
                                    {channels.map((channel) => (
                                        <SelectItem key={channel.id} value={channel.id}>
                                            # {channel.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-foreground">Rôles staff</p>
                            <MultiSelect
                                options={roleOptions}
                                selected={config.staffRoleIds}
                                onChange={(selected) =>
                                    setConfig((previous) => ({ ...previous, staffRoleIds: selected }))
                                }
                                placeholder="Aucun rôle staff"
                            />
                            <p className="text-xs text-muted-foreground">
                                Autorisés à fermer un ticket et ajoutés aux destinataires par défaut.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-foreground">Rôles à mentionner</p>
                            <MultiSelect
                                options={roleOptions}
                                selected={config.notifyRoleIds}
                                onChange={(selected) =>
                                    setConfig((previous) => ({ ...previous, notifyRoleIds: selected }))
                                }
                                placeholder="Reprend les rôles staff"
                            />
                            <p className="text-xs text-muted-foreground">
                                Mentionnés à l&apos;ouverture du fil. Vide = rôles staff.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="god-ticket-naming">Nom du fil</Label>
                            <Input
                                id="god-ticket-naming"
                                value={config.namingPattern}
                                maxLength={80}
                                onChange={(event) =>
                                    setConfig((previous) => ({
                                        ...previous,
                                        namingPattern: event.target.value,
                                    }))
                                }
                                placeholder="🎫-{num}-{author}"
                            />
                            <p className="text-xs text-muted-foreground">
                                Jetons remplacés : <code>{"{num}"}</code> et <code>{"{author}"}</code>. 100
                                caractères maximum.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="god-ticket-close-policy">Qui peut fermer ?</Label>
                            <Select
                                value={config.closePolicy}
                                onValueChange={(value) =>
                                    setConfig((previous) => ({
                                        ...previous,
                                        closePolicy: value as GodTicketConfigView["closePolicy"],
                                    }))
                                }
                                disabled={isPending}
                            >
                                <SelectTrigger id="god-ticket-close-policy">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF_OR_CREATOR">Staff ou créateur</SelectItem>
                                    <SelectItem value="STAFF_ONLY">Staff uniquement</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                            <div>
                                <p className="text-sm font-medium text-foreground">Archiver à la fermeture</p>
                                <p className="text-xs text-muted-foreground">
                                    Le fil reste consultable dans les archives Discord.
                                </p>
                            </div>
                            <Switch
                                checked={config.archiveOnClose}
                                onCheckedChange={(checked) =>
                                    setConfig((previous) => ({ ...previous, archiveOnClose: checked }))
                                }
                                aria-label="Archiver le fil à la fermeture"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                            <div>
                                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Star className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                                    Demander une satisfaction
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Message privé au créateur à la fermeture (note de 1 à 5).
                                </p>
                            </div>
                            <Switch
                                checked={config.csatEnabled}
                                onCheckedChange={(checked) =>
                                    setConfig((previous) => ({ ...previous, csatEnabled: checked }))
                                }
                                aria-label="Demander une note de satisfaction"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                            Un salon hors du serveur, un rôle supprimé ou Discord indisponible ⇒ refus,
                            jamais un enregistrement partiel.
                        </p>
                        <Button onClick={handleSaveConfig} disabled={isPending || assetsLoading}>
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Enregistrer
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Ticket className="h-4 w-4 text-info" aria-hidden="true" />
                        Catégories du panneau
                    </CardTitle>
                    <CardDescription>
                        Elles composent le menu « Ouvrir un ticket » et le libellé des fils. Une clé ne
                        change jamais ; une catégorie se désactive, elle ne se supprime pas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {categories.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                            Aucune catégorie enregistrée : la lecture retombe sur les quatre catégories
                            historiques.
                        </p>
                    ) : null}

                    {categories.map((category) => (
                        <div key={category.id} className="rounded-lg border border-border/60 p-3">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_90px_120px_80px_auto] lg:items-end">
                                <div className="space-y-1.5">
                                    <Label htmlFor={`category-label-${category.id}`}>Libellé</Label>
                                    <Input
                                        id={`category-label-${category.id}`}
                                        value={category.label}
                                        maxLength={40}
                                        onChange={(event) =>
                                            updateCategory(category.id, { label: event.target.value })
                                        }
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        <code>{category.key}</code>
                                        {initial.usage[category.key]
                                            ? ` · ${initial.usage[category.key]} ticket(s)`
                                            : " · aucun ticket"}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor={`category-emoji-${category.id}`}>Emoji</Label>
                                    <Input
                                        id={`category-emoji-${category.id}`}
                                        value={category.emoji}
                                        maxLength={8}
                                        onChange={(event) =>
                                            updateCategory(category.id, { emoji: event.target.value })
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor={`category-color-${category.id}`}>Couleur</Label>
                                    <div className="flex items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="h-4 w-4 shrink-0 rounded border border-border"
                                            style={{ backgroundColor: validColor(category.color) }}
                                        />
                                        <Input
                                            id={`category-color-${category.id}`}
                                            value={category.color}
                                            maxLength={7}
                                            onChange={(event) =>
                                                updateCategory(category.id, { color: event.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor={`category-order-${category.id}`}>Ordre</Label>
                                    <Input
                                        id={`category-order-${category.id}`}
                                        type="number"
                                        min={0}
                                        max={999}
                                        value={category.order}
                                        onChange={(event) =>
                                            updateCategory(category.id, {
                                                order: Number(event.target.value) || 0,
                                            })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Switch
                                        checked={category.isEnabled}
                                        onCheckedChange={(checked) =>
                                            handleToggleCategory(category, checked)
                                        }
                                        aria-label={`Activer la catégorie ${category.label}`}
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSaveCategory(category)}
                                        disabled={isPending}
                                    >
                                        Enregistrer
                                    </Button>
                                </div>
                            </div>
                            {category.legacyCategory ? (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                    Formulaire spécialisé historique : {category.legacyCategory}
                                </p>
                            ) : null}
                        </div>
                    ))}

                    <div className="rounded-lg border border-dashed border-border/60 p-3">
                        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Plus className="h-4 w-4 text-info" aria-hidden="true" />
                            Nouvelle catégorie
                        </p>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_120px_80px_auto] lg:items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-key">Clé</Label>
                                <Input
                                    id="new-category-key"
                                    value={draft.key}
                                    maxLength={40}
                                    placeholder="partenariat"
                                    onChange={(event) =>
                                        setDraft((previous) => ({
                                            ...previous,
                                            key: event.target.value.toLowerCase(),
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-label">Libellé</Label>
                                <Input
                                    id="new-category-label"
                                    value={draft.label}
                                    maxLength={40}
                                    placeholder="Partenariat"
                                    onChange={(event) =>
                                        setDraft((previous) => ({
                                            ...previous,
                                            label: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-emoji">Emoji</Label>
                                <Input
                                    id="new-category-emoji"
                                    value={draft.emoji}
                                    maxLength={8}
                                    onChange={(event) =>
                                        setDraft((previous) => ({
                                            ...previous,
                                            emoji: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-color">Couleur</Label>
                                <div className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="h-4 w-4 shrink-0 rounded border border-border"
                                        style={{ backgroundColor: validColor(draft.color) }}
                                    />
                                    <Input
                                        id="new-category-color"
                                        value={draft.color}
                                        maxLength={7}
                                        onChange={(event) =>
                                            setDraft((previous) => ({
                                                ...previous,
                                                color: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-order">Ordre</Label>
                                <Input
                                    id="new-category-order"
                                    type="number"
                                    min={0}
                                    max={999}
                                    value={draft.order}
                                    onChange={(event) =>
                                        setDraft((previous) => ({
                                            ...previous,
                                            order: Number(event.target.value) || 0,
                                        }))
                                    }
                                />
                            </div>

                            <Button onClick={handleCreateCategory} disabled={isPending}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Créer
                            </Button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            La clé est définitive : elle vit dans les boutons Discord déjà publiés. Une
                            catégorie créée ici utilise le formulaire générique (sujet + description).
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

