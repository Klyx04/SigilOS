"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PUBLIC_METAMOB_KEY_MAX, PUBLIC_METAMOB_PSEUDO_MAX } from "@/lib/public-profile-input";
import { updatePublicMetamob } from "@/server/actions/public-profile-actions";

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
