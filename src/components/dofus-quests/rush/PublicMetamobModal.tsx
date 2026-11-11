"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND_ICONS } from "@/lib/source-icons";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { metamobProfileUrl } from "@/lib/ocre-soul-stones";
import { PUBLIC_METAMOB_KEY_MAX, PUBLIC_METAMOB_PSEUDO_MAX } from "@/lib/public-profile-input";
import { useOcreWriteQueue } from "@/hooks/use-ocre-write-queue";
import OcreQuestPanel from "@/components/ocre/OcreQuestPanel";
import type { OcreMonsterLite } from "@/lib/ocre-soul-stones";
import {
    getPublicOcreProgress,
    patchPublicOcreMonster,
    updatePublicMetamob,
    type PublicOcreMonster,
} from "@/server/actions/public-profile-actions";

/**
 * Metamob du guide public — **sans quitter le guide** (demande du 08/11/2026).
 *
 * Trois changements du 08/11 (soir), après retour à l'écran :
 *   • la liste est le **panneau partagé** `OcreQuestPanel` — même recherche, mêmes onglets
 *     Gardiens / Archis, mêmes libellés et même stepper ±1 que le guide interne. La version
 *     « Marquer » n'existe plus ;
 *   • une fois le compte **vérifié**, les champs pseudo/clé sont **repliés** derrière un bouton
 *     « Modifier » : on ne redemande plus un secret à chaque visite ;
 *   • l'écriture passe par la **même file** que l'interne (`useOcreWriteQueue`, envoi injecté =
 *     `patchPublicOcreMonster`) : debounce 650 ms, sérialisée, avec accusé « Enregistré ».
 *
 * ⚠️ Volet `rush-public-parity` : ce composant est le **voisin** de `PublicRushGuideClient`, pas
 * lui — l'import d'action serveur reste confiné ici, comme avant.
 */
export function PublicMetamobModal({
    open,
    onClose,
    metamobPseudo,
    verified,
    portalContainer = null,
}: {
    open: boolean;
    onClose: () => void;
    metamobPseudo: string | null;
    verified: boolean;
    /**
     * V-H — quand la modale est ouverte depuis l'overlay PiP, on porte son portail
     * dans le `body` de la PiP (sinon Radix la rend dans la page hôte, hors overlay).
     */
    portalContainer?: HTMLElement | null;
}) {
    const router = useRouter();
    /**
     * **ISO avec le guide interne** : la modale publique emprunte la même portée de DA que
     * `OcreProgressModal`. `PublicRushGuideClient` monte déjà `DaThemeProvider` : hors de cette
     * surface, `daScopeProps` renvoie un objet vide et l'habillage produit reprend la main.
     */
    const daScope = daScopeProps(useDaTheme());
    const profileUrl = metamobProfileUrl(metamobPseudo);
    const [pseudo, setPseudo] = useState(metamobPseudo ?? "");
    const [apiKey, setApiKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    /** Compte vérifié : le formulaire ne s'ouvre que sur demande explicite. */
    const [editing, setEditing] = useState(!verified);
    const [quest, setQuest] = useState<{
        total: number;
        captured: number;
        characterName: string | null;
        monsters: PublicOcreMonster[];
    } | null>(null);
    const [questError, setQuestError] = useState<string | null>(null);
    const [questLoading, setQuestLoading] = useState(false);

    useEffect(() => {
        if (open) setEditing(!verified);
    }, [open, verified]);

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

    /** Même forme que l'interne : c'est ce qui permet de partager le panneau. */
    const liteMonsters: OcreMonsterLite[] = useMemo(
        () =>
            (quest?.monsters ?? []).map((monster) => ({
                id: monster.id,
                type: monster.type,
                owned: monster.owned,
                nameFr: monster.name,
                ...(monster.imageUrl ? { imageUrl: monster.imageUrl } : {}),
                ...(monster.zone ? { zone: monster.zone } : {}),
                ...(monster.subzone ? { subzone: monster.subzone } : {}),
                // Le panneau n'affiche que `owned` (via `ocreStateLabel`) : l'état brut n'est là
                // que pour satisfaire la forme partagée.
                state: monster.owned > 0 ? "owned" : "missing",
            })),
        [quest]
    );

    const send = useCallback(async (monsterId: number, quantity: number) => {
        const result = await patchPublicOcreMonster({ monsterId, quantity });
        if (!result.success) throw new Error(result.error);
        // Double cross-check : la valeur rendue est celle RELUE chez Metamob.
        return result.monster?.owned;
    }, []);

    const {
        monsters: list,
        adoptServerList,
        changeQuantity,
        pendingIds,
        busy,
        notice,
    } = useOcreWriteQueue({ monsters: liteMonsters, send });

    useEffect(() => {
        adoptServerList(liteMonsters);
    }, [liteMonsters, adoptServerList]);

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
            <DialogContent
                {...daScope}
                overlayClassName="da-modal-scrim"
                portalContainer={portalContainer}
                className="da-modal da-portal max-h-[85svh] w-[min(34rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0 outline-none"
            >
                <DialogHeader className="da-modal-head space-y-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                        <DialogTitle className="da-modal-title flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/dofus/icons/archimonster.png" alt="" className="h-4 w-4 object-contain" />
                            {metamobPseudo ? "Mon Ocre" : "Metamob"}
                        </DialogTitle>
                        <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="min-w-0 truncate">
                                {metamobPseudo
                                    ? `Metamob · ${metamobPseudo}${verified ? "" : " · à vérifier"}`
                                    : "Compte non lié"}
                            </span>
                            {profileUrl && (
                                <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Ouvrir mon profil Metamob"
                                    title="Mon profil Metamob"
                                    className="shrink-0 rounded-md p-1 transition-colors hover:bg-surface"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={BRAND_ICONS.metamob.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" />
                                </a>
                            )}
                            {verified && !editing ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditing(true)}
                                    className="shrink-0 gap-1 px-2 text-[11px]"
                                >
                                    <Pencil className="h-3 w-3" />
                                    Modifier
                                </Button>
                            ) : null}
                        </span>
                    </div>
                </DialogHeader>

                {/* Quête Ocre — même panneau que le guide interne (recherche, filtres, stepper).
                    En édition, la liste laisse la place au formulaire : `.da-modal` est en
                    `overflow: hidden`, un corps plus haut que la fenêtre serait coupé. */}
                {editing ? null : metamobPseudo ? (
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
                        {questLoading ? (
                            <p className="text-xs text-muted-foreground">Lecture de ta quête Metamob…</p>
                        ) : questError ? (
                            <p role="alert" className="text-xs text-danger">
                                {questError}
                            </p>
                        ) : quest ? (
                            <>
                                <p className="text-[11px] text-muted-foreground">
                                    {quest.characterName ? `${quest.characterName} · ` : ""}
                                    {quest.captured}/{quest.total} capturés
                                </p>
                                <OcreQuestPanel
                                    monsters={list}
                                    busy={busy}
                                    notice={notice}
                                    pendingIds={pendingIds}
                                    onStep={(monster, delta) => changeQuantity(monster, delta)}
                                />
                            </>
                        ) : null}
                    </div>
                ) : null}

                {editing ? (
                    <form onSubmit={submit} className="space-y-3 p-3 sm:p-4">
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
                                placeholder={
                                    verified ? "Laisser vide pour conserver la clé actuelle" : "Colle ta clé Metamob"
                                }
                                disabled={saving}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                La clé reste côté serveur (chiffrée) : elle n&apos;est jamais renvoyée à l&apos;écran.
                            </p>
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
                ) : metamobPseudo ? null : (
                    <div className="flex justify-end p-4">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Fermer
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
