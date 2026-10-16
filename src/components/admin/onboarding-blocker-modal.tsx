"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    CheckCircle2,
    ArrowRight,
    Rocket,
    Check,
    Copy,
    Sparkles,
    Shield,
    Server,
    ExternalLink,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { completeMandatoryOnboarding, ensureDashboardAccessRole } from "@/server/actions/admin-actions";
import { updateGuildModules } from "@/server/actions/module-actions";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";
import { DEFAULT_MODULES, type ModuleKey } from "@/lib/module-types";
import { DASHBOARD_ACCESS_ROLE_NAME, pickDashboardAccessRolePreselect } from "@/lib/onboarding-gating";

export interface OnboardingServerOption {
    id: string;
    name: string;
    group: string;
}

export interface OnboardingRoleOption {
    id: string;
    name: string;
}

type Step = 1 | 2 | 3;

const STEP_META: Record<Step, { title: string; description: string }> = {
    1: {
        title: "Votre serveur de jeu",
        description: "Sélectionnez le serveur Dofus de votre guilde. Requis pour calibrer les prix, quêtes et l'annuaire.",
    },
    2: {
        title: "Qui peut se connecter ?",
        description: "Choisissez le rôle Discord autorisé à se connecter au tableau de bord (jamais @everyone).",
    },
    3: {
        title: "Modules de départ",
        description: "Sélectionnez les premiers modules à activer pour votre guilde. Vous pourrez tout modifier plus tard.",
    },
};

const SUGGESTED_MODULES: Array<{
    key: ModuleKey;
    label: string;
    description: string;
    dofusAsset: string;
    recommended?: boolean;
}> = [
    {
        key: "missions",
        label: "Missions de Guilde",
        description: "Missions hebdomadaires, validation de preuves et récompenses en guildeatons.",
        dofusAsset: MODULE_DOFUS_ASSETS.missions || "guildatons.png",
        recommended: true,
    },
    {
        key: "songes",
        label: "Songes Infinis",
        description: "Partage d'étages, recherche de coffres et composition d'équipes de rush.",
        dofusAsset: MODULE_DOFUS_ASSETS.songes || "songes_run.png",
        recommended: true,
    },
    {
        key: "ocre",
        label: "Quête Ocre & Archis",
        description: "Synchronisation Metamob, suivi des captures et alertes Kralamoure.",
        dofusAsset: MODULE_DOFUS_ASSETS.ocre || "dofus_ocre.png",
        recommended: true,
    },
    {
        key: "services",
        label: "Services & Métiers",
        description: "Artisans certifiés, commandes d'équipements et livre d'or de guilde.",
        dofusAsset: MODULE_DOFUS_ASSETS.services || "key.png",
    },
    {
        key: "donjons",
        label: "Donjons & Quêtes",
        description: "Organisation de sorties, succès donjons et entraide quêtes.",
        dofusAsset: MODULE_DOFUS_ASSETS.donjons || "dofus.png",
    },
    {
        key: "calendar",
        label: "Calendrier & Événements",
        description: "Planification des sorties de guilde et des soirées communautaires.",
        dofusAsset: MODULE_DOFUS_ASSETS.calendar || "calendar.png",
    },
    {
        key: "presentation",
        label: "Page de Présentation",
        description: "Vitrine publique de votre guilde pour le recrutement extérieur.",
        dofusAsset: MODULE_DOFUS_ASSETS.presentation || "guild.png",
    },
];

export function OnboardingBlockerModal({
    guildId,
    servers,
    roles,
}: {
    guildId: string;
    servers: OnboardingServerOption[];
    roles: OnboardingRoleOption[];
}) {
    const [step, setStep] = useState<Step>(1);
    const [serverId, setServerId] = useState("");
    const [roleId, setRoleId] = useState(() => pickDashboardAccessRolePreselect(roles, guildId)?.id ?? "");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const [isCreatingRole, startCreateRole] = useTransition();
    const [isReloading, startReload] = useTransition();
    const [roleHint, setRoleHint] = useState<string | null>(null);

    const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
        missions: true,
        songes: true,
        ocre: true,
    });

    const createAccessRole = () => {
        startCreateRole(async () => {
            const res = await ensureDashboardAccessRole(guildId);
            if (res.success) {
                if (res.roleId) setRoleId(res.roleId);
                setRoleHint(`Rôle « ${DASHBOARD_ACCESS_ROLE_NAME} » créé et attribué sur Discord.`);
                router.refresh();
            } else {
                setRoleHint(res.error || "Création impossible — assignez un rôle existant.");
            }
        });
    };

    const toggleModule = (key: string) => {
        setSelectedModules((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const submit = () => {
        if (isPending || done) return;
        setError(null);
        if (!serverId || !roleId) {
            setError("Veuillez sélectionner un serveur de jeu et un rôle d'accès valide.");
            return;
        }

        startTransition(async () => {
            const res = await completeMandatoryOnboarding(guildId, serverId, roleId);
            if (!res.success) {
                setError(res.error || "Échec de l'enregistrement de la guilde.");
                return;
            }

            const chosenKeys = Object.entries(selectedModules).filter(([, active]) => active).map(([k]) => k);
            if (chosenKeys.length > 0) {
                const fullState = {} as Record<ModuleKey, boolean>;
                for (const key of Object.keys(DEFAULT_MODULES) as ModuleKey[]) {
                    fullState[key] = false;
                }
                fullState.admin = true;
                for (const key of chosenKeys) {
                    fullState[key as ModuleKey] = true;
                }
                await updateGuildModules(guildId, fullState);
            }

            setDone(true);
        });
    };

    const copyDashboardLink = () => {
        const url = `${window.location.origin}/dashboard/${guildId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            toast.success("Lien copié dans le presse-papier !");
            setTimeout(() => setCopied(false), 2500);
        }).catch(() => {
            toast.error("Impossible de copier automatiquement.");
        });
    };

    const finish = () => {
        window.location.href = `/dashboard/${guildId}`;
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Configuration de la guilde"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 md:p-8 space-y-6">
                {!done ? (
                    <>
                        <div className="space-y-2 text-center">
                            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                Configuration initiale · Étape {step} / 3
                            </p>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                {STEP_META[step].title}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {STEP_META[step].description}
                            </p>
                        </div>

                        {/* Indicateur de progression épuré */}
                        <div className="flex items-center gap-2" aria-hidden="true">
                            {([1, 2, 3] as Step[]).map((s) => (
                                <div
                                    key={s}
                                    className={cn(
                                        "h-1.5 flex-1 rounded-full transition-all duration-300",
                                        s < step ? "bg-success" : s === step ? "bg-amber-500" : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>

                        {/* Étape 1 : Serveur Dofus */}
                        {step === 1 && (
                            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                                {servers.map((s) => {
                                    const img = getDofusServerImage(s.id || s.name);
                                    const isSelected = serverId === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setServerId(s.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                                isSelected
                                                    ? "border-emerald-500/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                                                    : "border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong"
                                            )}
                                        >
                                            {img ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={img}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    draggable={false}
                                                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-black/30"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border">
                                                    <Server className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold truncate">{s.name}</p>
                                                <p className="text-xs text-muted-foreground">{s.group}</p>
                                            </div>
                                            {isSelected && (
                                                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Étape 2 : Qui peut se connecter ? */}
                        {step === 2 && (
                            <div className="space-y-4">
                                {roles.length === 0 ? (
                                    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
                                        <p className="text-sm font-bold text-warning">
                                            Aucun rôle éligible sur ce serveur
                                        </p>
                                        <button
                                            type="button"
                                            onClick={createAccessRole}
                                            disabled={isCreatingRole}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                                        >
                                            {isCreatingRole ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                            ) : (
                                                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                            )}
                                            Créer le rôle « {DASHBOARD_ACCESS_ROLE_NAME} »
                                        </button>
                                        <p className="text-[11px] text-muted-foreground">Sinon, à la main :</p>
                                        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                                            <li>Ouvrez les rôles du serveur (bouton ci-dessous).</li>
                                            <li>
                                                Créez un rôle — par exemple « {DASHBOARD_ACCESS_ROLE_NAME} ». @everyone ne convient jamais : il ouvrirait le dashboard à tout le serveur.
                                            </li>
                                            <li>Revenez ici et cliquez « Recharger les rôles ».</li>
                                        </ol>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <a
                                                href={`https://discord.com/channels/${guildId}/settings/roles`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                Ouvrir Discord
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => startReload(() => router.refresh())}
                                                disabled={isReloading}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                                            >
                                                <RefreshCw className={cn("h-3.5 w-3.5", isReloading && "animate-spin")} aria-hidden="true" />
                                                Recharger les rôles
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                                            {roles.map((r) => {
                                                const isSelected = roleId === r.id;
                                                return (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setRoleId(r.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                                                            isSelected
                                                                ? "border-emerald-500/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                                                                : "border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Shield className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                            <span className="text-sm font-semibold truncate">@{r.name}</span>
                                                        </div>
                                                        {isSelected && (
                                                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">
                                                                ✓
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="rounded-xl border border-border bg-black/20 p-3.5 space-y-2 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Besoin d&apos;un rôle dédié ?</span>
                                                <button
                                                    type="button"
                                                    onClick={createAccessRole}
                                                    disabled={isCreatingRole}
                                                    className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                                                >
                                                    {isCreatingRole ? "Création..." : `Créer le rôle « ${DASHBOARD_ACCESS_ROLE_NAME} »`}
                                                </button>
                                            </div>
                                            {roleHint && (
                                                <p className="text-[11px] text-muted-foreground leading-snug">{roleHint}</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Étape 3 : Modules de départ */}
                        {step === 3 && (
                            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                                {SUGGESTED_MODULES.map((mod) => {
                                    const isSelected = !!selectedModules[mod.key];
                                    return (
                                        <button
                                            key={mod.key}
                                            type="button"
                                            onClick={() => toggleModule(mod.key)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                                isSelected
                                                    ? "border-emerald-500/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                                                    : "border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong"
                                            )}
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden p-1">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`/assets/dofus/modules/${mod.dofusAsset}`}
                                                    alt=""
                                                    className="w-7 h-7 object-contain"
                                                    loading="lazy"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold truncate">{mod.label}</span>
                                                    {mod.recommended && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                            Recommandé
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                                            </div>
                                            <span className={cn(
                                                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                                isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-border text-transparent"
                                            )}>
                                                <Check className="w-3 h-3" />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {error && (
                            <p className="text-xs font-semibold text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-2.5">
                                {error}
                            </p>
                        )}

                        {/* Boutons d'action */}
                        <div className="flex items-center gap-3 pt-2">
                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={() => { setStep((prev) => (prev - 1) as Step); setError(null); }}
                                    disabled={isPending}
                                    className="px-5 h-11 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    Retour
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (step === 1) {
                                            if (!serverId) {
                                                setError("Sélectionnez un serveur Dofus pour continuer.");
                                                return;
                                            }
                                        }
                                        if (step === 2) {
                                            if (!roleId) {
                                                setError("Sélectionnez au moins un rôle Discord.");
                                                return;
                                            }
                                        }
                                        setError(null);
                                        setStep((prev) => (prev + 1) as Step);
                                    }}
                                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    Continuer <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={isPending}
                                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-950/40"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Activation en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Activer et ouvrir le Dashboard
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    /* Écran de confirmation final clair */
                    <div className="space-y-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                Votre guilde est déployée !
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                                La base est active et sécurisée. Vous pouvez désormais partager le tableau de bord avec vos membres.
                            </p>
                        </div>

                        {/* Lien de partage rapide */}
                        <div className="rounded-xl border border-border bg-black/30 p-3.5 space-y-2 text-left">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                Lien direct de votre Guilde
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={typeof window !== "undefined" ? `${window.location.origin}/dashboard/${guildId}` : `/dashboard/${guildId}`}
                                    className="flex-1 min-w-0 bg-transparent border-none text-xs font-mono text-foreground focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={copyDashboardLink}
                                    className="reg-btn reg-btn-gold text-xs px-2.5 py-1 shrink-0 flex items-center gap-1.5"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copied ? "Copié !" : "Copier"}</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={finish}
                            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                        >
                            Accéder au Tableau de Bord <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
