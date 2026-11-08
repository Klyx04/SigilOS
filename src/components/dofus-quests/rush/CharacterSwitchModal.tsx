"use client";

import { UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

export type SwitchableCharacter = {
    pseudo: string;
    classe?: string | null;
};

/**
 * Bascule de personnage du guide public — **compte connecté**.
 *
 * Demande user du 08/11/2026 : « il doit proposer une modale pour changer de personnage et non
 * cette modale de choix classe / serveur / nom — cette modale est destinée au visiteur non
 * connecté ». Il a raison : `GuestCharacterModal` est le formulaire de l'**anonyme**.
 *
 * Pour un compte, le personnage et ses mules vivent déjà en base : la seule chose à faire est de
 * **choisir lequel est actif**. Cette modale ne crée rien et ne saisit rien — elle bascule.
 */
export function CharacterSwitchModal({
    open,
    onClose,
    locale = "fr",
    mainCharacter,
    mules,
    activePseudo,
    onPickMain,
    onPickMule,
}: {
    open: boolean;
    onClose: () => void;
    locale?: "fr" | "en";
    /** Personnage principal du profil (`pseudoDofus` + `classe`). */
    mainCharacter: SwitchableCharacter | null;
    /** Mules déclarées (`PublicProfile.altPseudos`). */
    mules: ReadonlyArray<SwitchableCharacter>;
    /** Pseudo actif sur cette surface (peut être celui d'une mule). */
    activePseudo: string | null;
    onPickMain: () => void;
    onPickMule: (mule: SwitchableCharacter) => void;
}) {
    const en = locale === "en";
    const entries = [
        ...(mainCharacter ? [{ ...mainCharacter, isMain: true }] : []),
        ...mules.map((mule) => ({ ...mule, isMain: false })),
    ];

    /** Le principal est actif quand aucun personnage local ne le remplace. */
    const isActive = (pseudo: string, isMain: boolean) =>
        !activePseudo ? isMain : activePseudo.toLowerCase() === pseudo.toLowerCase();

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0">
                <div className="border-b border-border p-4">
                    <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border border-border bg-surface">
                            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle className="text-sm font-semibold text-foreground">
                                {en ? "Switch character" : "Changer de personnage"}
                            </DialogTitle>
                            <p className="text-[11px] text-muted-foreground">
                                {en
                                    ? "Each character keeps its own progress."
                                    : "Chaque personnage garde sa propre progression."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-h-[60vh] space-y-1.5 overflow-y-auto p-4">
                    {entries.map((entry) => {
                        const active = isActive(entry.pseudo, entry.isMain);
                        const icon = entry.classe ? getClass(entry.classe) : null;
                        return (
                            <button
                                key={entry.pseudo}
                                type="button"
                                aria-pressed={active}
                                onClick={() => (entry.isMain ? onPickMain() : onPickMule(entry))}
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-[4px] border px-2.5 py-2 text-left transition-colors",
                                    active
                                        ? "border-accent bg-accent/10 text-accent"
                                        : "border-border bg-surface text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                                )}
                            >
                                {icon ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={icon.icon} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                                ) : (
                                    <UserRound
                                        className="h-4 w-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                                    {entry.pseudo}
                                </span>
                                {entry.isMain ? (
                                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {en ? "main" : "principal"}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}

                    <p className="pt-1 text-[10px] text-muted-foreground">
                        {en ? "Manage this list in your " : "Gère cette liste dans ton "}
                        <a
                            href="/espace-visiteur/mules"
                            className="font-medium text-foreground underline underline-offset-2"
                        >
                            {en ? "visitor space" : "espace visiteur"}
                        </a>
                        .
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
