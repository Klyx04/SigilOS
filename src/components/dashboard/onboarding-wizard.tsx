"use client";

import { useState, useEffect } from "react";
import {
    Check,
    AlertTriangle,
    Loader2,
    ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { updateUserProfile } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useRouter } from "next/navigation";
import { PREFERRED_ACTIVITIES, type PreferredActivityId } from "@/lib/profile-activities";

interface OnboardingWizardProps {
    guildId: string;
    userName: string;
    show: boolean;
    initialStep?: number;
    initialPseudo?: string;
    /** true = l'étape 3 « Activités & Contenu préféré » est obligatoire (≥1 tag). */
    requireActivities?: boolean;
}

export function OnboardingWizard({ guildId, userName, show, initialStep = 1, initialPseudo = "", requireActivities = false }: OnboardingWizardProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(initialStep);
    const [pseudo, setPseudo] = useState(initialPseudo);
    // Pseudo déjà validé côté serveur : soit l'entrée se fait à l'étape 2+ (pseudo en
    // base), soit l'étape 1 vient de réussir. Dans les deux cas on ne le renvoie PLUS
    // (`updateUserProfile` rejoue sinon la vérification du ladder Ankama — 2ᵉ appel
    // inutile, et une panne du ladder bloquait une étape pourtant déjà validée).
    const [pseudoSaved, setPseudoSaved] = useState(initialStep !== 1);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setIsOpen(true);
        }
    }, [show]);

    const handlePseudoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmed = pseudo.trim();
        if (!trimmed) {
            setError("Le pseudo est obligatoire.");
            return;
        }

        if (trimmed.length < 2 || trimmed.length > 50) {
            setError("Le pseudo doit faire entre 2 et 50 caractères.");
            return;
        }

        // Simple client-side regex check matching UpdateProfileSchema regex
        const pseudoRegex = /^[a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\-\s\[\]]*$/;
        if (!pseudoRegex.test(trimmed)) {
            setError("Le pseudo ne doit contenir que des lettres, espaces, tirets et crochets.");
            return;
        }

        setLoading(true);
        try {
            // Validate the pseudo by trying to write it temporarily or just moving to the next step
            // We actually call updateUserProfile with just the pseudo first
            const res = await updateUserProfile({
                guildId,
                pseudoDofus: trimmed
            });

            if (res.success) {
                // Le pseudo vient d'être validé côté serveur : l'étape 2 ne le renverra pas.
                setPseudoSaved(true);
                setStep(2);
            } else {
                setError(res.error || "Pseudo invalide ou introuvable sur le ladder officiel Ankama.");
            }
        } catch (err: any) {
            setError("Une erreur est survenue lors de la validation du pseudo.");
        } finally {
            setLoading(false);
        }
    };

    const handleClassSubmit = async () => {
        if (!selectedClass) {
            toast.error("Veuillez sélectionner une classe.");
            return;
        }

        setLoading(true);
        try {
            // Only re-submit pseudoDofus if the user typed it during this session (step 1).
            // If we started at step 2 (pseudo already valid in DB), skip it to avoid
            // re-triggering the Ankama ladder check.
            const payload: Parameters<typeof updateUserProfile>[0] = {
                guildId,
                classe: selectedClass,
                ...(pseudoSaved ? {} : { pseudoDofus: pseudo.trim() })
            };
            const res = await updateUserProfile(payload);

            if (res.success) {
                if (requireActivities) {
                    setStep(3);
                } else {
                    toast.success("Profil configuré avec succès ! Bienvenue à bord.");
                    setIsOpen(false);
                    router.push(`/dashboard/${guildId}/profile?tour=1`);
                }
            } else {
                toast.error(res.error || "Une erreur est survenue lors de la sauvegarde.");
            }
        } catch (err) {
            toast.error("Erreur serveur lors de la sauvegarde de la classe.");
        } finally {
            setLoading(false);
        }
    };

    const toggleActivity = (id: string) => {
        setSelectedActivities(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleActivitiesSubmit = async () => {
        if (selectedActivities.length === 0) {
            toast.error("Sélectionnez au moins une activité préférée.");
            return;
        }

        setLoading(true);
        try {
            const res = await updateUserProfile({
                guildId,
                preferredActivities: selectedActivities as PreferredActivityId[],
            });

            if (res.success) {
                toast.success("Profil configuré avec succès ! Bienvenue à bord.");
                setIsOpen(false);
                router.push(`/dashboard/${guildId}/profile?tour=1`);
            } else {
                toast.error(res.error || "Une erreur est survenue lors de la sauvegarde.");
            }
        } catch (err) {
            toast.error("Erreur serveur lors de la sauvegarde des activités.");
        } finally {
            setLoading(false);
        }
    };

    // Étapes réellement parcourues (points d'indicateur) selon le point de départ.
    const flowSteps =
        initialStep === 3
            ? [3]
            : initialStep === 2
                ? requireActivities ? [2, 3] : [2]
                : requireActivities ? [1, 2, 3] : [1, 2];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
            {/* Backdrop (Forced: cannot click outside) */}
            <div className="absolute inset-0 bg-black/95" aria-hidden="true" />

            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface rounded-xl border border-border animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 sm:p-10 space-y-6">
                    {/* Step indicators — nombre de points = étapes du flux (pseudo/classe + activités) */}
                    <div className="flex items-center gap-2" aria-hidden="true">
                        {flowSteps.map(s => (
                            <div key={s} className={cn("h-1 flex-1 rounded-full", step >= s ? "bg-success" : "bg-elevated")} />
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-start gap-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/assets/dofus/modules/character.png"
                                    alt=""
                                    width={56}
                                    height={56}
                                    draggable={false}
                                    className="w-14 h-14 shrink-0 object-contain"
                                />
                                <div className="space-y-1.5 pt-1">
                                    <p className="text-xs font-medium text-muted-foreground">Bienvenue, {userName}</p>
                                    <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                        Identifie ton personnage
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Renseigne ton pseudo exact en jeu. Le site l'utilisera pour synchroniser tes succès et ton activité sur le Ladder !
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handlePseudoSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground pl-1">Pseudo Dofus exact</label>
                                    <Input
                                        placeholder="Ex: Dark-Iop"
                                        value={pseudo}
                                        onChange={(e) => setPseudo(e.target.value)}
                                        className="bg-elevated border-border h-12 text-sm rounded-lg focus-visible:ring-0 focus-visible:border-border-strong text-foreground"
                                        disabled={loading}
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full h-12 text-sm font-semibold rounded-lg gap-2"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Validation avec le Ladder...
                                        </>
                                    ) : (
                                        <>
                                            Continuer
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Personnage principal</p>
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                    Choisis ta classe
                                </h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Sélectionne la classe de ton personnage principal pour compléter ton badge de guilde.
                                </p>
                            </div>

                            {/* Grid of classes — assets réels du jeu */}
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-1 w-full">
                                {DOFUS_CLASSES.map((cls) => {
                                    const isSelected = selectedClass === cls.id;
                                    return (
                                        <button
                                            key={cls.id}
                                            type="button"
                                            onClick={() => setSelectedClass(cls.id)}
                                            aria-pressed={isSelected}
                                            title={cls.name}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-2 rounded-lg border transition-colors relative",
                                                isSelected
                                                    ? "border-success bg-success/5"
                                                    : "border-border hover:border-border-strong"
                                            )}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={cls.icon} alt={cls.name} loading="lazy" className="w-8 h-8 object-contain" />
                                            <span className={cn(
                                                "text-[11px] font-medium mt-1 truncate w-full",
                                                isSelected ? "text-foreground" : "text-muted-foreground"
                                            )}>{cls.name}</span>
                                            {isSelected && (
                                                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-success-foreground" />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 w-full">
                                {initialStep === 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="h-12 rounded-lg text-sm"
                                        disabled={loading}
                                    >
                                        Retour
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    onClick={handleClassSubmit}
                                    className="flex-1 h-12 text-sm font-semibold rounded-lg gap-2"
                                    disabled={loading || !selectedClass}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Terminer"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Tes préférences</p>
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                    Activités et contenu préféré
                                </h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Coche au moins une activité pour indiquer tes préférences à la guilde. Tu pourras les modifier plus tard depuis ton profil.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-[42vh] overflow-y-auto">
                                {PREFERRED_ACTIVITIES.map(act => {
                                    const isSelected = selectedActivities.includes(act.id);
                                    return (
                                        <button
                                            key={act.id}
                                            type="button"
                                            onClick={() => toggleActivity(act.id)}
                                            aria-pressed={isSelected}
                                            className={cn(
                                                "flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-lg border text-xs font-medium transition-colors select-none",
                                                isSelected
                                                    ? "border-success bg-success/5 text-foreground"
                                                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                                            )}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={act.image}
                                                alt=""
                                                width={28}
                                                height={28}
                                                loading="lazy"
                                                draggable={false}
                                                className="w-7 h-7 shrink-0 object-contain"
                                            />
                                            <span>{act.label}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-success shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 w-full">
                                {initialStep !== 3 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(2)}
                                        className="h-12 rounded-lg text-sm"
                                        disabled={loading}
                                    >
                                        Retour
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    onClick={handleActivitiesSubmit}
                                    className="flex-1 h-12 text-sm font-semibold rounded-lg gap-2"
                                    disabled={loading || selectedActivities.length === 0}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Terminer"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
