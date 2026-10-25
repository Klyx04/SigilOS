"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { muleLevelLabel } from "@/lib/member-mules";
import type { RosterMule } from "@/lib/member-roster";
import { isLadderManualFallbackEnabled, verifyDofusPseudo } from "@/server/actions/profile-actions";

/** Plafond de mules déclarables — même borne que l'éditeur de profil. */
const MAX_MULES = 10;

/** Classe affichée quand l'information manque : une icône lisible, jamais une classe inventée. */
const DEFAULT_CLASS = "cra";

/** Réponse de `verifyDofusPseudo` telle que consommée ici (l'action renvoie une union libre). */
type VerifyResult = {
    success: boolean;
    error?: string;
    data?: { level?: number | null; manualFallback?: boolean };
};

/** Vignette d'icône de classe (asset du jeu) — décorative, le sens est porté par le libellé. */
function ClassIcon({ classeId, className }: { classeId?: string | null; className?: string }) {
    const classe = getClass(classeId || DEFAULT_CLASS);
    if (!classe) return null;
    return (
        <Image
            src={classe.icon}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className={cn("shrink-0 object-contain", className)}
        />
    );
}

/**
 * Sélecteur d'icône de classe : un bouton compact, puis une grille des 19 classes du jeu.
 * Jamais une liste déroulante de noms — l'icône est ce que le staff reconnaît.
 */
function ClassPicker({
    value,
    onChange,
    disabled,
}: {
    value?: string | null;
    onChange: (next: string) => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const current = getClass(value || DEFAULT_CLASS);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    aria-label={`Classe : ${current?.name ?? "non définie"}`}
                    className="h-9 shrink-0 gap-1.5 px-2 text-xs font-normal"
                >
                    <ClassIcon classeId={value} className="h-5 w-5" />
                    <span className="hidden max-w-20 truncate sm:inline">{current?.name ?? "Classe"}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-2">
                <div className="grid grid-cols-5 gap-1">
                    {DOFUS_CLASSES.map((classe) => (
                        <button
                            key={classe.id}
                            type="button"
                            title={classe.name}
                            aria-label={classe.name}
                            aria-pressed={value === classe.id}
                            onClick={() => {
                                onChange(classe.id);
                                setOpen(false);
                            }}
                            className={cn(
                                "relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                                value === classe.id
                                    ? "border-accent-soft-border bg-accent-soft"
                                    : "border-transparent hover:bg-elevated"
                            )}
                        >
                            <ClassIcon classeId={classe.id} className="h-6 w-6" />
                            {value === classe.id && (
                                <Check className="absolute -right-0.5 -top-0.5 h-3 w-3 text-accent" aria-hidden="true" />
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Mules déclarées d'un membre — **une liste, jamais un champ de saisie libre**.
 *
 * Avant : un `<textarea>` « une par ligne » qui perdait la classe et le niveau (le registre les
 * porte depuis toujours : `altPseudos` est un JSON `{ pseudo, classe, level }`), et rien ne
 * vérifiait que le pseudo existait côté jeu.
 * Maintenant : chaque mule est une entrée responsive (icône de classe, pseudo, niveau) et l'ajout
 * passe par la **vérification ladder** (`verifyDofusPseudo`), avec le repli prévu par
 * l'administration : si le God a activé « Fallback Pseudo Manuel », la saisie est acceptée sans
 * vérification — et l'interface le dit, au lieu de faire croire à un contrôle qui n'a pas eu lieu.
 */
export function MemberMulesEditor({
    guildId,
    mules,
    onChange,
    onSave,
    canEdit,
    isPending,
}: {
    guildId: string;
    mules: RosterMule[];
    onChange: (next: RosterMule[]) => void;
    onSave: () => void;
    canEdit: boolean;
    isPending: boolean;
}) {
    const [pseudo, setPseudo] = useState("");
    const [classe, setClasse] = useState(DEFAULT_CLASS);
    const [verifying, setVerifying] = useState(false);
    const [manualFallback, setManualFallback] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Le repli est un réglage **plateforme** (God) : on l'affiche, on ne le devine pas.
    useEffect(() => {
        let active = true;
        isLadderManualFallbackEnabled().then((enabled) => {
            if (active) setManualFallback(enabled);
        });
        return () => {
            active = false;
        };
    }, []);

    async function addMule() {
        const value = pseudo.trim();
        if (value.length < 2) {
            setError("Pseudo trop court.");
            return;
        }
        if (mules.length >= MAX_MULES) {
            setError(`Maximum ${MAX_MULES} mules déclarées.`);
            return;
        }
        if (mules.some((mule) => mule.pseudo.toLowerCase() === value.toLowerCase())) {
            setError("Ce pseudo est déjà déclaré.");
            return;
        }

        setError(null);
        setVerifying(true);
        const result = (await verifyDofusPseudo(value, guildId)) as VerifyResult;
        setVerifying(false);

        if (!result.success) {
            setError(result.error ?? "Pseudo introuvable sur le serveur de la guilde.");
            return;
        }

        const level = result.data?.level;
        onChange([
            ...mules,
            { pseudo: value, classe, level: typeof level === "number" ? level : undefined },
        ]);
        setPseudo("");
        toast.success(
            result.data?.manualFallback
                ? `${value} ajouté — saisie manuelle autorisée par l'administration`
                : `${value} vérifié sur le ladder et ajouté`
        );
    }

    function removeMule(index: number) {
        onChange(mules.filter((_, position) => position !== index));
    }

    function patchClass(index: number, next: string) {
        onChange(mules.map((mule, position) => (position === index ? { ...mule, classe: next } : mule)));
    }


    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">
                    Mules <span className="tabular-nums text-muted-foreground">{mules.length}/{MAX_MULES}</span>
                </Label>
                {manualFallback && (
                    <span className="text-caption text-muted-foreground">
                        Vérification ladder désactivée par l&apos;administration
                    </span>
                )}
            </div>

            {mules.length > 0 ? (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {mules.map((mule, index) => (
                        <li
                            key={`${mule.pseudo}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-border-strong bg-surface p-2"
                        >
                            <ClassIcon classeId={mule.classe} className="h-7 w-7" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground">{mule.pseudo}</p>
                                <p className="text-caption text-muted-foreground">
                                    {getClass(mule.classe || DEFAULT_CLASS)?.name ?? "Classe inconnue"}
                                    {mule.level ? ` · ${muleLevelLabel(mule.level)}` : ""}
                                </p>
                            </div>
                            {canEdit && (
                                <ClassPicker
                                    value={mule.classe}
                                    onChange={(next) => patchClass(index, next)}
                                    disabled={isPending}
                                />
                            )}
                            {canEdit && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-danger"
                                    aria-label={`Retirer ${mule.pseudo}`}
                                    disabled={isPending}
                                    onClick={() => removeMule(index)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="rounded-md border border-border-strong bg-surface p-3 text-xs text-muted-foreground">
                    Aucune mule déclarée.
                </p>
            )}


            {canEdit && (
                <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface/60 p-2">
                    <div className="min-w-40 flex-1 space-y-1.5">
                        <Label htmlFor="member-mule-pseudo" className="text-caption text-muted-foreground">
                            Ajouter une mule
                        </Label>
                        <Input
                            id="member-mule-pseudo"
                            value={pseudo}
                            onChange={(event) => {
                                setPseudo(event.target.value);
                                setError(null);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void addMule();
                                }
                            }}
                            placeholder="Pseudo exact en jeu…"
                            maxLength={30}
                            className="h-9 text-sm"
                            disabled={isPending || verifying}
                        />
                    </div>
                    <ClassPicker value={classe} onChange={setClasse} disabled={isPending || verifying} />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5"
                        onClick={() => void addMule()}
                        disabled={isPending || verifying || pseudo.trim().length < 2}
                    >
                        {verifying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Ajouter
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="text-xs text-danger">
                    {error}
                </p>
            )}

            {canEdit && (
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={isPending}
                    className="w-full gap-2 sm:w-auto"
                >
                    {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Enregistrer les mules
                </Button>
            )}
        </div>
    );
}

