"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Sparkles, 
    Sword, 
    Check, 
    AlertTriangle, 
    Loader2, 
    Compass, 
    ArrowRight,
    User
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
                ...(pseudo.trim() !== initialPseudo ? { pseudoDofus: pseudo.trim() } : {})
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

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop (Forced: cannot click outside) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/95 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl glass-premium rounded-3xl border border-border overflow-hidden  bg-background/80 backdrop-blur-2xl"
                    >
                        {/* Decorative background glows */}
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-info/10 rounded-full blur-[100px]" />

                        <div className="relative z-10 p-6 sm:p-10 flex flex-col items-center text-center space-y-6">
                            {/* Step indicators — nombre de points = étapes du flux (pseudo/classe + activités) */}
                            <div className="flex items-center gap-3">
                                {flowSteps.map(s => (
                                    <div key={s} className={cn("w-2 h-2 rounded-full transition-all duration-300", step === s ? "bg-violet-500 scale-125 " : "bg-elevated")} />
                                ))}
                            </div>

                            {step === 1 && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="w-full space-y-6"
                                >
                                    <div className="space-y-2">
                                        <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-info flex items-center justify-center shadow-xl">
                                            <User className="w-8 h-8 text-foreground" />
                                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-warning" />
                                        </div>
                                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic">
                                            Identifie ton <span className="text-violet-400">Personnage</span>
                                        </h2>
                                        <p className="text-muted-foreground text-xs font-semibold leading-relaxed max-w-sm mx-auto">
                                            Renseigne ton pseudo exact en jeu. Le site l'utilisera pour synchroniser tes succès et ton activité sur le Ladder !
                                        </p>
                                    </div>

                                    <form onSubmit={handlePseudoSubmit} className="space-y-4 text-left max-w-md mx-auto">
                                        <div className="space-y-2">
                                            <label className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground pl-1">Pseudo Dofus Exact</label>
                                            <Input
                                                placeholder="Ex: Dark-Iop"
                                                value={pseudo}
                                                onChange={(e) => setPseudo(e.target.value)}
                                                className="bg-black/50 border-border h-12 text-sm font-medium rounded-xl focus-visible:ring-violet-500/30 text-foreground"
                                                disabled={loading}
                                                autoFocus
                                            />
                                        </div>

                                        {error && (
                                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-95 text-foreground gap-2"
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
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div 
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="w-full space-y-6"
                                >
                                    <div className="space-y-2">
                                        <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-info flex items-center justify-center shadow-xl">
                                            <Sword className="w-8 h-8 text-foreground" />
                                        </div>
                                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic">
                                            Choisis ta <span className="text-violet-400">Classe</span>
                                        </h2>
                                        <p className="text-muted-foreground text-xs font-semibold leading-relaxed max-w-sm mx-auto">
                                            Sélectionne la classe de ton personnage principal pour compléter ton badge de guilde.
                                        </p>
                                    </div>

                                    {/* Grid of classes */}
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 w-full text-center">
                                        {DOFUS_CLASSES.map((cls) => {
                                            const isSelected = selectedClass === cls.id;
                                            return (
                                                <button
                                                    key={cls.id}
                                                    type="button"
                                                    onClick={() => setSelectedClass(cls.id)}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-2 rounded-xl border transition-all relative group",
                                                        isSelected 
                                                            ? "bg-violet-500/20 border-violet-500 " 
                                                            : "bg-surface border-border hover:bg-surface hover:border-border-strong"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 relative flex items-center justify-center">
                                                        <img src={cls.icon} alt={cls.name} className="w-8 h-8 object-contain" />
                                                    </div>
                                                    <span className="text-caption font-black uppercase tracking-tight text-muted-foreground mt-1 truncate w-full group-hover:text-foreground transition-colors">{cls.name}</span>
                                                    {isSelected && (
                                                        <div className="absolute -top-1 -right-1 bg-violet-500 rounded-full p-0.5 shadow-md">
                                                            <Check className="w-2.5 h-2.5 text-foreground" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-3 max-w-md mx-auto w-full">
                                        {initialStep === 1 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setStep(1)}
                                                className="h-12 border-border bg-surface hover:bg-surface text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                                disabled={loading}
                                            >
                                                Retour
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={handleClassSubmit}
                                            className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-95 text-foreground gap-2"
                                            disabled={loading || !selectedClass}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Terminer"
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="w-full space-y-6"
                                >
                                    <div className="space-y-2">
                                        <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-success to-teal-600 flex items-center justify-center shadow-xl">
                                            <Compass className="w-8 h-8 text-foreground" />
                                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-warning" />
                                        </div>
                                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic">
                                            Activités <span className="text-success">& Contenu préféré</span>
                                        </h2>
                                        <p className="text-muted-foreground text-xs font-semibold leading-relaxed max-w-sm mx-auto">
                                            Coche au moins une activité pour indiquer tes préférences à la guilde. Tu pourras les modifier plus tard depuis ton profil.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2 max-h-[42vh] overflow-y-auto custom-scrollbar">
                                        {PREFERRED_ACTIVITIES.map(act => {
                                            const isSelected = selectedActivities.includes(act.id);
                                            return (
                                                <button
                                                    key={act.id}
                                                    type="button"
                                                    onClick={() => toggleActivity(act.id)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-150",
                                                        isSelected
                                                            ? act.color
                                                            : "bg-surface border-border hover:bg-surface hover:border-border-strong text-muted-foreground"
                                                    )}
                                                >
                                                    <span className="text-base leading-none">{act.icon}</span>
                                                    <span>{act.label}</span>
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-3 max-w-md mx-auto w-full">
                                        {initialStep !== 3 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setStep(2)}
                                                className="h-12 border-border bg-surface hover:bg-surface text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                                disabled={loading}
                                            >
                                                Retour
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={handleActivitiesSubmit}
                                            className="flex-1 h-12 bg-success hover:bg-success font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95 text-foreground gap-2"
                                            disabled={loading || selectedActivities.length === 0}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Terminer"
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Bottom decorative bar */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-info to-info" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
