"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type TourPhase = "profile" | "dashboard" | null;

interface TourStep {
    target: string; // Selector for document.querySelector
    title: string;
    description: string;
    placement: "top" | "bottom" | "left" | "right";
}

interface TourContextType {
    tourPhase: TourPhase;
    currentStep: number;
    totalSteps: number;
    isActive: boolean;
    activeStepData: TourStep | null;
    advance: () => void;
    back: () => void;
    completeTour: () => void;
    startTour: (phase: TourPhase) => void;
    isCelebrationActive: boolean;
    setCelebrationActive: (active: boolean) => void;
}

const PROFILE_STEPS: TourStep[] = [
    {
        target: '[data-tour="profile-header"]',
        title: "Ton profil de guilde",
        description: "C'est ta carte d'identité visible par tous les membres de la guilde.",
        placement: "bottom"
    },
    {
        target: '[data-tour="profile-class"]',
        title: "Vérifie ton pseudo",
        description: "Utilise la 🔍 pour valider que ton pseudo Dofus est bien reconnu et synchronisé avec le Ladder Ankama.",
        placement: "bottom"
    },
    {
        target: '[data-tour="profile-tab-metiers"]',
        title: "Tes métiers",
        description: "Indique tes métiers actifs pour que la guilde sache à qui s'adresser pour des crafts.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-planning"]',
        title: "Tes disponibilités",
        description: "Renseigne tes créneaux horaires pour faciliter l'organisation de runs de donjons ou de songes.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-combat"]',
        title: "Tes builds",
        description: "Ajoute tes liens Dofusbook ou DofusCreator pour partager tes équipements et ta progression.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-intro"]',
        title: "Présente-toi",
        description: "Écris quelques mots sur toi pour que les autres membres de la guilde apprennent à te connaître.",
        placement: "right"
    },
    {
        target: '[data-tour="profile-tab-settings"]',
        title: "Tes préférences",
        description: "Personnalise la réception de tes notifications et la visibilité de ton activité.",
        placement: "right"
    }
];

const DASHBOARD_STEPS: TourStep[] = [
    {
        target: '[data-tour="sidebar-dashboard"]',
        title: "Accueil",
        description: "Retrouve ici ton résumé d'activité, les actualités et les dernières news de la guilde.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-missions"]',
        title: "Missions de guilde",
        description: "Consulte les missions disponibles, soumets tes captures et gagne des points d'XP pour faire progresser la guilde.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-ladder"]',
        title: "Ladder des succès",
        description: "Suis ton score de succès Dofus, synchronisé automatiquement depuis le site officiel Ankama.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-members"]',
        title: "Annuaire",
        description: "Explore les profils de tes camarades de guilde, leurs métiers et leurs personnages.",
        placement: "right"
    },
    {
        target: '[data-tour="sidebar-calendar"]',
        title: "Calendrier",
        description: "Inscris-toi aux événements, sorties et runs organisés par le staff.",
        placement: "right"
    }
];

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children, guildId, modules }: { children: ReactNode; guildId: string; modules?: any }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [tourPhase, setTourPhase] = useState<TourPhase>(null);
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isCelebrationActive, setCelebrationActive] = useState<boolean>(false);

    // Filter dashboard steps dynamically based on active modules
    const steps = tourPhase === "profile" 
        ? PROFILE_STEPS 
        : tourPhase === "dashboard" 
            ? DASHBOARD_STEPS.filter(step => {
                if (step.target.includes("sidebar-missions") && modules && !modules.missions) return false;
                if (step.target.includes("sidebar-ladder") && modules && !modules.ladder) return false;
                if (step.target.includes("sidebar-calendar") && modules && !modules.calendar) return false;
                return true;
            })
            : [];

    const totalSteps = steps.length;
    const activeStepData = steps[currentStep - 1] || null;

    // Helper function to auto-open sections in sidebar based on current target step
    const ensureSidebarSectionOpen = (targetSelector: string) => {
        if (typeof document === "undefined") return;
        // Find parent sections or trigger expanding logic by simulating clicks on collapsible headers if needed
        if (targetSelector.includes("sidebar-missions") || targetSelector.includes("sidebar-ladder")) {
            const btn = document.querySelector('[data-tour-section="progression"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") {
                (btn as HTMLButtonElement).click();
            }
        } else if (targetSelector.includes("sidebar-members") || targetSelector.includes("sidebar-calendar")) {
            const btn = document.querySelector('[data-tour-section="informations"] button');
            if (btn && btn.getAttribute("aria-expanded") !== "true") {
                (btn as HTMLButtonElement).click();
            }
        }
    };

    // Auto-open sections on active step change
    useEffect(() => {
        if (isActive && activeStepData) {
            ensureSidebarSectionOpen(activeStepData.target);
        }
    }, [isActive, activeStepData]);

    // Load initial state / handle redirect parameters
    useEffect(() => {
        const hasDoneTour = localStorage.getItem(`sigilos-tour-done-${guildId}`) === "true";
        if (hasDoneTour) {
            setIsActive(false);
            return;
        }

        const tourParam = searchParams.get("tour");
        const storedPhase = localStorage.getItem(`sigilos-tour-phase-${guildId}`) as TourPhase;
        const storedStep = parseInt(localStorage.getItem(`sigilos-tour-step-${guildId}`) || "1", 10);

        if (tourParam === "1" || (storedPhase === "profile" && pathname.includes("/profile"))) {
            setTourPhase("profile");
            setCurrentStep(tourParam === "1" ? 1 : storedStep);
            setIsActive(true);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "profile");
            if (tourParam === "1") {
                localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
            }
        } else if (tourParam === "2" || (storedPhase === "dashboard" && pathname === `/dashboard/${guildId}`)) {
            setTourPhase("dashboard");
            setCurrentStep(tourParam === "2" ? 1 : storedStep);
            setIsActive(true);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "dashboard");
            if (tourParam === "2") {
                localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
            }
        }
    }, [searchParams, pathname, guildId]);

    // Save step to localStorage when it changes
    useEffect(() => {
        if (isActive && tourPhase) {
            localStorage.setItem(`sigilos-tour-step-${guildId}`, currentStep.toString());
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, tourPhase);
        }
    }, [currentStep, tourPhase, isActive, guildId]);

    const startTour = (phase: TourPhase) => {
        if (!phase) return;
        setTourPhase(phase);
        setCurrentStep(1);
        setIsActive(true);
        localStorage.removeItem(`sigilos-tour-done-${guildId}`);
        localStorage.setItem(`sigilos-tour-phase-${guildId}`, phase);
        localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");

        if (phase === "profile") {
            router.push(`/dashboard/${guildId}/profile?tour=1`);
        } else {
            router.push(`/dashboard/${guildId}?tour=2`);
        }
    };

    const stableAdvance = (current: number, total: number) => {
        if (current < total) return current + 1;
        return current;
    };

    const advance = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(prev => stableAdvance(prev, totalSteps));
        } else {
            // End of current phase
            if (tourPhase === "profile") {
                // Go to dashboard phase
                setTourPhase("dashboard");
                setCurrentStep(1);
                localStorage.setItem(`sigilos-tour-phase-${guildId}`, "dashboard");
                localStorage.setItem(`sigilos-tour-step-${guildId}`, "1");
                router.push(`/dashboard/${guildId}?tour=2`);
            } else if (tourPhase === "dashboard") {
                // End of entire onboarding
                completeTour();
            }
        }
    };

    const back = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        } else if (tourPhase === "dashboard") {
            // Go back to profile phase
            setTourPhase("profile");
            setCurrentStep(PROFILE_STEPS.length);
            localStorage.setItem(`sigilos-tour-phase-${guildId}`, "profile");
            localStorage.setItem(`sigilos-tour-step-${guildId}`, PROFILE_STEPS.length.toString());
            router.push(`/dashboard/${guildId}/profile?tour=1`);
        }
    };

    const completeTour = () => {
        setIsActive(false);
        setTourPhase(null);
        localStorage.setItem(`sigilos-tour-done-${guildId}`, "true");
        localStorage.removeItem(`sigilos-tour-phase-${guildId}`);
        localStorage.removeItem(`sigilos-tour-step-${guildId}`);
        setCelebrationActive(true);
    };

    return (
        <TourContext.Provider
            value={{
                tourPhase,
                currentStep,
                totalSteps,
                isActive,
                activeStepData,
                advance,
                back,
                completeTour,
                startTour,
                isCelebrationActive,
                setCelebrationActive
            }}
        >
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (context === undefined) {
        throw new Error("useTour must be used within a TourProvider");
    }
    return context;
}
