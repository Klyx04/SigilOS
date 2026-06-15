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

interface OnboardingWizardProps {
    guildId: string;
    userName: string;
    show: boolean;
    initialStep?: number;
    initialPseudo?: string;
}

export function OnboardingWizard({ guildId, userName, show, initialStep = 1, initialPseudo = "" }: OnboardingWizardProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(initialStep);
    const [pseudo, setPseudo] = useState(initialPseudo);
    const [selectedClass, setSelectedClass] = useState("");
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
                toast.success("Profil configuré avec succès ! Bienvenue à bord.");
                setIsOpen(false);
                router.push(`/dashboard/${guildId}/profile?tour=1`);
            } else {
                toast.error(res.error || "Une erreur est survenue lors de la sauvegarde.");
            }
        } catch (err) {
            toast.error("Erreur serveur lors de la sauvegarde de la classe.");
        } finally {
            setLoading(false);
        }
    };

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
                        className="relative w-full max-w-xl glass-premium rounded-3xl border border-white/10 overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.25)] bg-zinc-950/80 backdrop-blur-2xl"
                    >
                        {/* Decorative background glows */}
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />

                        <div className="relative z-10 p-6 sm:p-10 flex flex-col items-center text-center space-y-6">
                            {/* Step indicators — 2 dots for full flow, 1 dot for class-only */}
                            <div className="flex items-center gap-3">
                                {initialStep === 1 && (
                                    <div className={cn("w-2 h-2 rounded-full transition-all duration-300", step === 1 ? "bg-violet-500 scale-125 shadow-[0_0_8px_#8b5cf6]" : "bg-white/20")} />
                                )}
                                <div className={cn("w-2 h-2 rounded-full transition-all duration-300", step === 2 ? "bg-violet-500 scale-125 shadow-[0_0_8px_#8b5cf6]" : "bg-white/20")} />
                            </div>

                            {step === 1 && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="w-full space-y-6"
                                >
                                    <div className="space-y-2">
                                        <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl">
                                            <User className="w-8 h-8 text-white" />
                                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">
                                            Identifie ton <span className="text-violet-400">Personnage</span>
                                        </h2>
                                        <p className="text-zinc-400 text-xs font-semibold leading-relaxed max-w-sm mx-auto">
                                            Renseigne ton pseudo exact en jeu. Le site l'utilisera pour synchroniser tes succès et ton activité sur le Ladder !
                                        </p>
                                    </div>

                                    <form onSubmit={handlePseudoSubmit} className="space-y-4 text-left max-w-md mx-auto">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pl-1">Pseudo Dofus Exact</label>
                                            <Input
                                                placeholder="Ex: Dark-Iop"
                                                value={pseudo}
                                                onChange={(e) => setPseudo(e.target.value)}
                                                className="bg-black/50 border-white/10 h-12 text-sm font-medium rounded-xl focus-visible:ring-violet-500/30 text-white"
                                                disabled={loading}
                                                autoFocus
                                            />
                                        </div>

                                        {error && (
                                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-95 text-white gap-2"
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
                                        <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl">
                                            <Sword className="w-8 h-8 text-white" />
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">
                                            Choisis ta <span className="text-violet-400">Classe</span>
                                        </h2>
                                        <p className="text-zinc-400 text-xs font-semibold leading-relaxed max-w-sm mx-auto">
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
                                                            ? "bg-violet-500/20 border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.2)]" 
                                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 relative flex items-center justify-center">
                                                        <img src={cls.icon} alt={cls.name} className="w-8 h-8 object-contain" />
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-tight text-zinc-400 mt-1 truncate w-full group-hover:text-white transition-colors">{cls.name}</span>
                                                    {isSelected && (
                                                        <div className="absolute -top-1 -right-1 bg-violet-500 rounded-full p-0.5 shadow-md">
                                                            <Check className="w-2.5 h-2.5 text-white" />
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
                                                className="h-12 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                                disabled={loading}
                                            >
                                                Retour
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={handleClassSubmit}
                                            className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-95 text-white gap-2"
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
                        </div>

                        {/* Bottom decorative bar */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
