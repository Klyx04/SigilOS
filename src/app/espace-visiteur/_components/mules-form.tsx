"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GameIcon } from "@/components/shared/game-icon";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import type { DeclaredMule } from "@/lib/member-mules";
import { PUBLIC_MULES_MAX } from "@/lib/public-profile-dto";
import { PUBLIC_PSEUDO_MAX } from "@/lib/public-profile-input";
import { describePseudoVerification, type PseudoVerificationOutcome } from "@/lib/pseudo-verification";
import { updatePublicMules, verifyPublicPseudo } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

type MuleDraft = { pseudo: string; classe: string; level: string };

const EMPTY_DRAFT: MuleDraft = { pseudo: "", classe: "", level: "200" };

/**
 * Mules déclarées — même forme que `UserProfile.altPseudos` (`{ pseudo, classe?, level? }`).
 *
 * Le pseudo se vérifie auprès du ladder Ankama avec le **serveur du profil** (le visiteur n'a
 * pas de guilde, mais il a un serveur) : même helper que le profil interne, avec le repli
 * manuel du toggle God. Fail-open : la vérification n'empêche jamais l'ajout.
 */
export function MulesForm({ mules, serverId }: { mules: DeclaredMule[]; serverId: number }) {
    const router = useRouter();
    const [list, setList] = useState<DeclaredMule[]>(mules);
    const [draft, setDraft] = useState<MuleDraft>(EMPTY_DRAFT);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkMessage, setCheckMessage] = useState<PseudoVerificationOutcome | null>(null);

    const handleVerifyDraft = async () => {
        setCheckMessage(null);
        const pseudo = draft.pseudo.trim();
        if (!pseudo) {
            setCheckMessage({ tone: "warning", message: "Renseigne le pseudo de la mule." });
            return;
        }
        setChecking(true);
        const result = await verifyPublicPseudo({ pseudo, dofusServerId: serverId });
        setChecking(false);
        if (!result.success) {
            setCheckMessage({ tone: "warning", message: result.error });
            return;
        }
        setCheckMessage(describePseudoVerification({ found: result.found, manual: result.manual }));
    };

    const addMule = () => {
        setError(null);
        const pseudo = draft.pseudo.trim();
        if (!pseudo) {
            setError("Renseigne le pseudo de la mule.");
            return;
        }
        if (list.length >= PUBLIC_MULES_MAX) {
            setError(`Maximum ${PUBLIC_MULES_MAX} mules.`);
            return;
        }
        if (list.some((mule) => mule.pseudo.toLowerCase() === pseudo.toLowerCase())) {
            setError("Cette mule est déjà dans la liste.");
            return;
        }
        const level = Number(draft.level);
        setList([
            ...list,
            {
                pseudo,
                classe: draft.classe || null,
                level: Number.isInteger(level) && level >= 1 && level <= 200 ? level : null,
            },
        ]);
        setDraft(EMPTY_DRAFT);
    };

    const removeMule = (pseudo: string) => {
        setList(list.filter((mule) => mule.pseudo !== pseudo));
    };

    /**
     * F15 (08/11/2026) — « j'ajoute, j'enregistre, et après refresh il n'y a rien ».
     *
     * Mesure : le brouillon n'était persisté que par « Ajouter ». Un visiteur qui remplissait la
     * ligne puis cliquait « Enregistrer mes mules » envoyait la **liste vide** — toast vert, zéro
     * mule en base, et l'écran se vidait au refresh. L'enregistrement inclut désormais le
     * brouillon en cours : un seul geste suffit, « Ajouter » ne sert plus qu'à en préparer
     * plusieurs.
     */
    const handleSave = async () => {
        setError(null);

        const pendingPseudo = draft.pseudo.trim();
        const next = [...list];
        const alreadyListed = list.some((mule) => mule.pseudo.toLowerCase() === pendingPseudo.toLowerCase());
        if (pendingPseudo && !alreadyListed) {
            if (next.length >= PUBLIC_MULES_MAX) {
                setError(`Maximum ${PUBLIC_MULES_MAX} mules.`);
                return;
            }
            const level = Number(draft.level);
            next.push({
                pseudo: pendingPseudo,
                classe: draft.classe || null,
                level: Number.isInteger(level) && level >= 1 && level <= 200 ? level : null,
            });
        }

        setSaving(true);
        const result = await updatePublicMules(next);
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        setList(next);
        setDraft(EMPTY_DRAFT);
        toast.success("Mules enregistrées.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Mules"
            description={`Tes personnages secondaires, ${PUBLIC_MULES_MAX} au maximum. Ils apparaîtront à côté de ton personnage principal.`}
        >
            <div className="space-y-4">
                {list.length > 0 ? (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                        {list.map((mule) => (
                            <li key={mule.pseudo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{mule.pseudo}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {mule.classe ? getClass(mule.classe)?.name ?? mule.classe : "Classe non renseignée"}
                                        {mule.level ? ` · Niveau ${mule.level}` : ""}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMule(mule.pseudo)}
                                    aria-label={`Retirer ${mule.pseudo}`}
                                >
                                    Retirer
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">Aucune mule déclarée pour l'instant.</p>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
                    <div className="space-y-2">
                        <Label htmlFor="mule-pseudo">Pseudo</Label>
                        <Input
                            id="mule-pseudo"
                            value={draft.pseudo}
                            onChange={(event) => setDraft({ ...draft, pseudo: event.target.value })}
                            maxLength={PUBLIC_PSEUDO_MAX}
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mule-classe">Classe (facultatif)</Label>
                        <Select
                            value={draft.classe}
                            onValueChange={(value) => setDraft({ ...draft, classe: value })}
                        >
                            <SelectTrigger id="mule-classe" className="w-full">
                                <SelectValue placeholder="Classe" />
                            </SelectTrigger>
                            <SelectContent>
                                {DOFUS_CLASSES.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        <span className="flex items-center gap-2">
                                            <GameIcon src={entry.icon} className="size-6" />
                                            {entry.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mule-level">Niveau</Label>
                        <Input
                            id="mule-level"
                            type="number"
                            min={1}
                            max={200}
                            value={draft.level}
                            onChange={(event) => setDraft({ ...draft, level: event.target.value })}
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <Button type="button" variant="ghost" onClick={handleVerifyDraft} disabled={saving || checking}>
                            {checking ? "Vérification…" : "Vérifier"}
                        </Button>
                        <Button type="button" variant="outline" onClick={addMule}>
                            Ajouter
                        </Button>
                    </div>
                </div>

                {checkMessage ? (
                    <p className={checkMessage.tone === "success" ? "text-xs text-success" : "text-xs text-warning"}>
                        {checkMessage.message}
                    </p>
                ) : null}

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer mes mules"}
                </Button>
            </div>
        </VisitorSection>
    );
}
