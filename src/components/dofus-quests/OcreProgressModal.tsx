"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND_ICONS } from "@/lib/source-icons";
import { useOcreWriteQueue } from "@/hooks/use-ocre-write-queue";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { metamobProfileUrl, type OcreMonsterLite } from "@/lib/ocre-soul-stones";
import OcreQuestPanel from "@/components/ocre/OcreQuestPanel";

/**
 * Modale « Mon Ocre » (ouverte depuis le guide) — **coquille** de la surface de guilde.
 *
 * La liste, la recherche, les onglets et le retour d'écriture vivent désormais dans
 * `OcreQuestPanel` (source unique, partagée avec la modale publique). Ici il ne reste que ce
 * qui est propre à un membre : le titre, le lien Metamob et la **file d'écriture de guilde**
 * (`useOcreWriteQueue`, dont l'envoi par défaut est l'action de guilde).
 */

export type { OcreMonsterLite };

export default function OcreProgressModal({
    open,
    onOpenChange,
    monsters,
    bossCount,
    archiCount,
    metamobPseudo,
    guildId,
    requiredCopies = 1,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    monsters: OcreMonsterLite[];
    bossCount?: { gathered?: number; total?: number };
    archiCount?: { gathered?: number; total?: number };
    metamobPseudo?: string | null;
    guildId: string;
    /** Copies exigées par la quête (parallelQuests) : sert au premier « + ». */
    requiredCopies?: number;
}) {
    /**
     * Portée de la DA — **vide hors d'une surface de la DA**. Cette modale est montée par trois
     * écrans (le guide du Rush, `OptimizedGuideClient` et `DofusQuestBanner`) : seule celle du
     * Rush monte le fournisseur, les deux autres gardent l'habillage produit.
     */
    const daScope = daScopeProps(useDaTheme());

    const {
        monsters: list,
        adoptServerList,
        changeQuantity,
        pendingIds,
        busy,
        notice,
    } = useOcreWriteQueue({ guildId, monsters, requiredCopies });

    // Les données serveur font foi dès qu'elles changent (rafraîchissement du guide).
    useEffect(() => {
        adoptServerList(monsters);
    }, [monsters, adoptServerList]);

    const profileUrl = metamobProfileUrl(metamobPseudo);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...daScope}
                overlayClassName="da-modal-scrim"
                className="da-modal da-portal max-w-lg gap-0 p-0 outline-none"
            >
                <DialogHeader className="da-modal-head space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="da-modal-title flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/dofus/icons/archimonster.png" alt="" className="h-4 w-4 object-contain" />
                            Mon Ocre
                        </DialogTitle>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            Metamob · {metamobPseudo || "—"}
                            {profileUrl && (
                                <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Ouvrir mon profil Metamob"
                                    title="Mon profil Metamob"
                                    className="rounded-md p-1 transition-colors hover:bg-surface"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={BRAND_ICONS.metamob.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" />
                                </a>
                            )}
                        </span>
                    </div>

                    <OcreQuestPanel
                        monsters={list}
                        requiredCopies={requiredCopies}
                        bossCount={bossCount}
                        archiCount={archiCount}
                        busy={busy}
                        notice={notice}
                        pendingIds={pendingIds}
                        onStep={(monster, delta) => changeQuantity(monster, delta)}
                        questHref={`/dashboard/${guildId}/quete-ocre`}
                    />
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
