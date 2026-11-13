"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type OnboardingStep = 1 | 2 | 3;

/**
 * Accueil du guide public (V2a-4) — trois étapes, **une seule fois par navigateur**.
 *
 * Cette modale ne saisit rien elle-même : elle **enchaîne** les deux sélecteurs qui existent
 * déjà (`GuestCharacterModal` pour le personnage, `PublicAlignmentModal` pour la cité et
 * l'Ordre) puis rend la main. Un seul état de saisie par donnée — aucun second formulaire à
 * maintenir, et le visiteur retrouve exactement les mêmes gestes que dans les tuiles.
 *
 * Elle n'est jamais forcée : « Passer » ferme et pose le drapeau, la lecture reste libre.
 */
export function PublicOnboardingModal({
    open,
    step,
    locale = "fr",
    onPickCharacter,
    onPickAlignment,
    onNext,
    onFinish,
    onSkip,
    onBack,
}: {
    open: boolean;
    step: OnboardingStep;
    locale?: "fr" | "en";
    onPickCharacter: () => void;
    onPickAlignment: () => void;
    onNext: () => void;
    onFinish: () => void;
    onSkip: () => void;
    onBack: () => void;
}) {
    const en = locale === "en";
    const titles: Record<OnboardingStep, string> = {
        1: en ? "1 · Your character" : "1 · Ton personnage",
        2: en ? "2 · Your alignment" : "2 · Ton alignement",
        3: en ? "3 · Start the rush" : "3 · Lance le rush",
    };
    const bodies: Record<OnboardingStep, string> = {
        1: en
            ? "Pick your character class. Progress is saved for this browser, and in your visitor space once you sign in."
            : "Choisis la classe de ton personnage. La progression est enregistrée pour ce navigateur, et dans ton espace visiteur dès que tu te connectes.",
        2: en
            ? "Bontarian, Neutral or Brakmarian? The city drives the quest route."
            : "Bontarien, Neutre ou Brâkmarien ? La cité pilote la route des quêtes.",
        3: en
            ? "Everything is ready. Open the guide and tick your first step."
            : "Tout est prêt. Ouvre le guide et coche ta première étape.",
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onSkip(); }}>
            <DialogContent className="max-w-md">
                <DialogTitle>{titles[step]}</DialogTitle>
                <DialogDescription>{bodies[step]}</DialogDescription>

                <ol className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground" aria-label={en ? "Steps" : "Étapes"}>
                    {([1, 2, 3] as const).map((value) => (
                        <li
                            key={value}
                            aria-current={value === step ? "step" : undefined}
                            className={
                                value === step
                                    ? "rounded-[4px] border border-accent/60 bg-accent/10 px-2 py-0.5 font-semibold text-foreground"
                                    : "rounded-[4px] border border-border bg-surface px-2 py-0.5"
                            }
                        >
                            {value}
                        </li>
                    ))}
                </ol>

                <footer className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="mr-auto rounded-[4px] px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {en ? "Skip" : "Passer"}
                    </button>
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {en ? "Back" : "Retour"}
                        </button>
                    ) : null}
                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={onPickCharacter}
                            className="rounded-[4px] border border-success/50 bg-success/15 px-2.5 py-1.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/25"
                        >
                            {en ? "Pick my character" : "Choisir mon personnage"}
                        </button>
                    ) : null}
                    {step === 2 ? (
                        <button
                            type="button"
                            onClick={onPickAlignment}
                            className="rounded-[4px] border border-success/50 bg-success/15 px-2.5 py-1.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/25"
                        >
                            {en ? "Pick my alignment" : "Choisir mon alignement"}
                        </button>
                    ) : null}
                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={onNext}
                            className="rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {en ? "Continue" : "Continuer"}
                        </button>
                    ) : null}
                    {step === 3 ? (
                        <button
                            type="button"
                            onClick={onFinish}
                            className="rounded-[4px] border border-success/50 bg-success/15 px-2.5 py-1.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/25"
                        >
                            {en ? "Start the rush" : "Commencer le rush"}
                        </button>
                    ) : null}
                </footer>
            </DialogContent>
        </Dialog>
    );
}