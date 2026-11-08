"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PUBLIC_METAMOB_KEY_MAX, PUBLIC_METAMOB_PSEUDO_MAX } from "@/lib/public-profile-input";
import { cn } from "@/lib/utils";
import {
    getPublicOcreProgress,
    patchPublicOcreMonster,
    updatePublicMetamob,
    type PublicOcreMonster,
} from "@/server/actions/public-profile-actions";

/**
 * Metamob du guide public — **sans quitter le guide**.
 *
 * Demande user du 08/11/2026 : « le clic sur Metamob dans le rush public connecté […] sinon ça
 * ouvre la modale de setup de son metamob directement sans aller dans son profil ». Le geste
 * menait à `/espace-visiteur/general` ; il ouvre maintenant le formulaire ici.
 *
 * ⚠️ Ce composant est le **voisin** de `PublicRushGuideClient`, pas lui : le verrou
 * `rush-public-parity` interdit `@/server/` **dans le client public**, et il n'est pas affaibli.
 * Un import d'action serveur n'embarque aucun code serveur (Next n'y met qu'une référence POST),
 * et l'action garde sa propre garde de session — le bouton n'existe que pour un compte connecté.
 */
export function PublicMetamobModal({
    open,
    onClose,
    metamobPseudo,
    verified,
}: {
    open: boolean;
    onClose: () => void;
    metamobPseudo: string | null;
    verified: boolean;
}) {
    const router = useRouter();
    const [pseudo, setPseudo] = useState(metamobPseudo ?? "");
    const [apiKey, setApiKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    /**
     * Quête Ocre — « l'objectif de lier son Metamob, c'est surtout pour suivre sa quête dans le
     * rush » (08/11/2026). Lecture à l'ouverture, puis patch monstre par monstre : la valeur
     * affichée est **celle que Metamob renvoie après relecture**, jamais notre optimisme.
     */
    const [quest, setQuest] = useState<{
        total: number;
        captured: number;
        characterName: string | null;
        monsters: PublicOcreMonster[];
    } | null>(null);
    const [questError, setQuestError] = useState<string | null>(null);
    const [questLoading, setQuestLoading] = useState(false);
    const [patchingId, setPatchingId] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !metamobPseudo) return;
        let alive = true;
        setQuestLoading(true);
        setQuestError(null);
        void getPublicOcreProgress()
            .then((result) => {
                if (!alive) return;
                if (!result.success) {
                    setQuest(null);
                    setQuestError(result.error);
                    return;
                }
                setQuest({
                    total: result.total,
                    captured: result.captured,
                    characterName: result.characterName,
                    monsters: result.monsters,
                });
            })
            .finally(() => {
                if (alive) setQuestLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [open, metamobPseudo]);

    const patchMonster = async (monster: PublicOcreMonster, quantity: number) => {
        setPatchingId(monster.id);
        const result = await patchPublicOcreMonster({ monsterId: monster.id, quantity });
        setPatchingId(null);
        if (!result.success) {
            setQuestError(result.error);
            return;
        }
        setQuestError(null);
        // Double cross-check : on affiche la valeur CONFIRMÉE par Metamob, pas `quantity`.
        if (result.monster) {
            const confirmed = result.monster;
            setQuest((current) => {
                if (!current) return current;
                const monsters = current.monsters.map((entry) =>
                    entry.id === confirmed.id ? confirmed : entry
                );
                return {
                    ...current,
                    monsters,
                    captured: monsters.filter((entry) => entry.owned > 0).length,
                };
            });
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);
        const result = await updatePublicMetamob({
            metamobPseudo: pseudo,
            ...(apiKey.trim().length > 0 ? { apiKey } : {}),
        });
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        setApiKey("");
        toast.success("Informations Metamob enregistrées.");
        router.refresh();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0">
                <div className="border-b border-border p-4">
                    <DialogTitle className="text-sm font-semibold text-foreground">Metamob</DialogTitle>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {metamobPseudo
                            ? `Compte lié : ${metamobPseudo}${verified ? " · vérifié" : " · à vérifier"}.`
                            : "Lie ton compte Metamob : le pseudo est vérifié auprès de Metamob avant d'être enregistré."}
                    </p>
                </div>

                {/* Quête Ocre — le motif même de la liaison Metamob en public : la suivre ici,
                    sans repasser par le profil. */}
                {metamobPseudo ? (
                    <div className="space-y-2 border-b border-border p-4">
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Quête Ocre
                            </p>
                            {quest ? (
                                <span className="text-[11px] tabular-nums text-foreground">
                                    {quest.captured} / {quest.total}
                                </span>
                            ) : null}
                        </div>
                        {questLoading ? (
                            <p className="text-[11px] text-muted-foreground">Lecture de ta quête…</p>
                        ) : null}
                        {questError ? <p className="text-[11px] text-warning">{questError}</p> : null}
                        {quest ? (
                            <ul className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                {quest.monsters.map((monster) => {
                                    const caught = monster.owned > 0;
                                    return (
                                        <li
                                            key={monster.id}
                                            className="flex items-center justify-between gap-2 rounded-[4px] border border-border bg-surface px-2 py-1"
                                        >
                                            <span
                                                className={cn(
                                                    "min-w-0 truncate text-[11px]",
                                                    caught ? "text-foreground" : "text-muted-foreground"
                                                )}
                                            >
                                                {monster.name}
                                                <span className="ml-1 text-[10px] opacity-70">
                                                    Niv. {monster.levelMin}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                disabled={patchingId === monster.id}
                                                onClick={() => void patchMonster(monster, caught ? 0 : 1)}
                                                className={cn(
                                                    "shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                                    caught
                                                        ? "border-success/40 bg-success/10 text-success"
                                                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {patchingId === monster.id
                                                    ? "…"
                                                    : caught
                                                      ? "Capturé"
                                                      : "Marquer"}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : null}
                    </div>
                ) : null}

                <form onSubmit={submit} className="space-y-3 p-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="public-metamob-pseudo">Pseudo Metamob</Label>
                        <Input
                            id="public-metamob-pseudo"
                            value={pseudo}
                            onChange={(event) => setPseudo(event.target.value)}
                            maxLength={PUBLIC_METAMOB_PSEUDO_MAX}
                            autoComplete="off"
                            disabled={saving}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="public-metamob-key">Clé d&apos;API (si le profil est privé)</Label>
                        <Input
                            id="public-metamob-key"
                            type="password"
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            maxLength={PUBLIC_METAMOB_KEY_MAX}
                            autoComplete="new-password"
                            placeholder={verified ? "Laisser vide pour conserver la clé actuelle" : "Colle ta clé Metamob"}
                            disabled={saving}
                        />
                    </div>

                    {error ? (
                        <p role="alert" className="text-sm text-danger">
                            {error}
                        </p>
                    ) : null}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                            Fermer
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Enregistrement…" : "Enregistrer"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
