"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Server, ShieldCheck, Loader2, CheckCircle2, ArrowRight, Rocket, Puzzle, BookOpen, Swords, Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { completeMandatoryOnboarding, ensureDashboardAccessRole } from "@/server/actions/admin-actions";
import { updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { updateGuildModules } from "@/server/actions/module-actions";
import { getAdminPresentationData, updateGuildPresentation } from "@/server/actions/presentation-actions";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { MODULE_GROUPS, MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";
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

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_META: Record<Step, { title: string; description: string }> = {
    1: {
        title: "Votre serveur de jeu",
        description: "Sélectionnez le serveur Dofus de votre guilde. Requis pour débloquer l'accès au dashboard.",
    },
    2: {
        title: "Qui peut se connecter ?",
        description: "Choisissez au moins un rôle Discord autorisé à se connecter (jamais @everyone). Sans cela, personne ne peut entrer.",
    },
    3: {
        title: "Salons de notifications",
        description: "Choisissez où SigilOS parle sur Discord. Un seul salon suffit pour démarrer — les autres salons (validations, kamas, bienvenue…) se règlent plus tard dans Paramètres.",
    },
    4: {
        title: "Modules de la guilde",
        description: "Cochez ce dont votre guilde a besoin. Rien n'est définitif : tout s'active et se désactive à la volée plus tard dans Pilotage.",
    },
    5: {
        title: "Présentation express",
        description: "Deux lignes pour donner envie sur la page publique. Facultatif — la page complète se remplit plus tard dans Présentation.",
    },
};

/**
 * Wizard de mise en route (5 étapes) :
 * 1-2 OBLIGATOIRES (serveur de jeu + rôle `dashboard:login`), puis 3 salons,
 * 4 modules et 5 présentation — skippables. Non-fermable tant que 1-2 ne sont
 * pas validées. À la validation, l'écran de succès présente les étapes
 * optionnelles (liens) puis ouvre le dashboard en navigation dure.
 */
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
    // Étape 2 : le rôle créé par SigilOS (au déploiement ou via le bouton ci-dessous)
    // est PRÉ-SÉLECTIONNÉ — l'admin n'a plus qu'à valider, au lieu de tomber sur une
    // liste vide (cul-de-sac « @everyone seul »).
    const [roleId, setRoleId] = useState(() => pickDashboardAccessRolePreselect(roles, guildId)?.id ?? "");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [isPending, startTransition] = useTransition();
    // Rechargement des rôles (cul-de-sac « @everyone seul ») : `router.refresh()` relit les listes
    // servies par le layout (rôles Discord) sans quitter la modale.
    const router = useRouter();
    const [isReloading, startReload] = useTransition();

    // Création du rôle d'accès PAR SigilOS : l'admin ne quitte plus Discord pour
    // fabriquer un rôle à la main. Action serveur idempotente (rôle déjà présent ⇒
    // renvoyé tel quel), réservée aux admins Discord, rate-limitée.
    const [isCreatingRole, startCreateRole] = useTransition();
    const [roleHint, setRoleHint] = useState<string | null>(null);
    const createAccessRole = () => {
        startCreateRole(async () => {
            const res = await ensureDashboardAccessRole(guildId);
            if (res.success) {
                if (res.roleId) setRoleId(res.roleId);
                setRoleHint(
                    `Rôle « ${DASHBOARD_ACCESS_ROLE_NAME} » prêt — il vous a été attribué sur Discord.`,
                );
                // Relit la liste de rôles servie par le layout (rôle tout juste créé).
                router.refresh();
            } else {
                setRoleHint(res.error || "Création impossible — créez le rôle à la main.");
            }
        });
    };
    // Étape 3 — salons (vide = skippé)
    const [lifecycleChannel, setLifecycleChannel] = useState("");
    const [missionChannel, setMissionChannel] = useState("");
    // Étape 4 — modules (tout décoché par défaut, sauf `admin` forcé à l'envoi)
    const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});
    // Étape 5 — présentation express (vide = skippée)
    const [presHistory, setPresHistory] = useState("");
    const [presRecruiting, setPresRecruiting] = useState(false);

    const submit = () => {
        // Garde anti-double-clic : sans elle, deux `completeMandatoryOnboarding`
        // concurrents partent (rate-limit "Too many requests" + états incohérents).
        if (isPending || done) return;
        setError(null);
        if (!serverId || !roleId) {
            setError("Choisissez un serveur puis un rôle pour continuer.");
            return;
        }
        startTransition(async () => {
            const res = await completeMandatoryOnboarding(guildId, serverId, roleId);
            if (res.success) {
                setStep(3);
            } else {
                setError(res.error || "Échec de l'enregistrement.");
            }
        });
    };

    const saveChannels = () => {
        if (isPending) return;
        setError(null);
        // Rien choisi = étape skippée, aucun appel serveur.
        if (!lifecycleChannel && !missionChannel) {
            setStep(4);
            return;
        }
        startTransition(async () => {
            const res = await updateMissionNotifySettings(guildId, {
                channelId: missionChannel || null,
                roleId: null,
                lifecycleNotifyChannelId: lifecycleChannel || null,
            });
            if (res.success) {
                setStep(4);
            } else {
                setError(res.error || "Échec de l'enregistrement des salons.");
            }
        });
    };

    const toggleModule = (key: string) => {
        setSelectedModules((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const selectedCount = Object.values(selectedModules).filter(Boolean).length;

    const saveModules = () => {
        if (isPending) return;
        setError(null);
        startTransition(async () => {
            // État complet exigé par le schéma (tout OFF sauf `admin`,
            // jamais désactivable, + les choix de l'admin).
            const fullState = {} as Record<ModuleKey, boolean>;
            for (const key of Object.keys(DEFAULT_MODULES) as ModuleKey[]) {
                fullState[key] = false;
            }
            fullState.admin = true;
            for (const [key, value] of Object.entries(selectedModules)) {
                if (value) fullState[key as ModuleKey] = true;
            }
            const res = await updateGuildModules(guildId, fullState);
            if (res.success) {
                setStep(5);
            } else {
                setError(res.error || "Échec de l'enregistrement des modules.");
            }
        });
    };

    const savePresentation = () => {
        if (isPending) return;
        setError(null);
        // Rien rempli = étape skippée, aucun appel serveur.
        if (!presHistory.trim() && !presRecruiting) {
            setDone(true);
            return;
        }
        startTransition(async () => {
            const current = await getAdminPresentationData(guildId);
            if (!current.success || !current.data) {
                setError(current.error || "Présentation injoignable.");
                return;
            }
            const res = await updateGuildPresentation(guildId, {
                ...current.data,
                history: presHistory.trim() || current.data.history,
                recruiting: presRecruiting,
            });
            if (res.success) {
                setDone(true);
            } else {
                setError(res.error || "Échec de l'enregistrement de la présentation.");
            }
        });
    };

    const finish = () => {
        // Navigation DURE (pas `router.refresh()` + `router.push()` simultanés :
        // les deux transitions concurrentes pouvaient avorter et laisser la page
        // sur un écran noir/suspendu — seul un F5 réparait). Le rechargement
        // complet purge aussi les états clients (tour, modales, suspense).
        window.location.href = `/dashboard/${guildId}`;
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Configuration obligatoire de la guilde"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full max-w-lg rounded-3xl border border-border bg-surface shadow-2xl p-6 md:p-8 space-y-6">
                {!done ? (
                    <>
                        <div className="space-y-2 text-center">
                            <p className="text-xs font-medium text-muted-foreground">
                                Configuration — étape {step} / 5{step > 2 ? " (optionnel)" : ""}
                            </p>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                {STEP_META[step].title}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {STEP_META[step].description}
                            </p>
                        </div>

                        {/* Indicateur d'étapes */}
                        <div className="flex items-center gap-2" aria-hidden="true">
                            {([1, 2, 3, 4, 5] as Step[]).map((s) => (
                                <div
                                    key={s}
                                    className={cn(
                                        "h-1.5 flex-1 rounded-full transition-colors",
                                        s < step ? "bg-success" : s === step ? "bg-warning" : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>

                        {step === 1 && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {servers.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setServerId(s.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                            serverId === s.id
                                                ? "border-success/50 bg-success/10 text-foreground"
                                                : "border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong"
                                        )}
                                    >
                                        {(() => {
                                            const img = getDofusServerImage(s.id || s.name);
                                            return img ? (
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
                                                <Server className={cn("w-4 h-4 shrink-0", serverId === s.id ? "text-success" : "")} />
                                            );
                                        })()}
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-bold truncate">{s.name}</span>
                                            <span className="block text-caption text-muted-foreground">{s.group}</span>
                                        </span>
                                        {serverId === s.id && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {/* 🚧 Cul-de-sac « un seul rôle = @everyone » (ou rôles managés
                                    uniquement) : la liste est VIDE et « Valider » reste désactivé,
                                    alors que la modale est non fermable et que la gateway redirige
                                    toute autre page ⇒ le owner n'avait AUCUN chemin. On lui donne
                                    les 3 gestes exacts + un rechargement + le lien direct. */}
                                {roles.length === 0 && (
                                    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5">
                                        <p className="text-sm font-bold text-warning">
                                            Aucun rôle éligible sur ce serveur
                                        </p>
                                        {/* Chemin le PLUS COURT : SigilOS crée le rôle et
                                            l'attribue au propriétaire. Le mode manuel
                                            reste disponible juste en dessous. */}
                                        <button
                                            type="button"
                                            onClick={createAccessRole}
                                            disabled={isCreatingRole}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success px-3 py-2.5 text-xs font-black uppercase tracking-wider text-success-foreground transition-colors hover:bg-success/90 disabled:opacity-60"
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
                                                Créez un rôle — par exemple « {DASHBOARD_ACCESS_ROLE_NAME} ». @everyone ne
                                                convient jamais : il ouvrirait le dashboard à tout le serveur.
                                            </li>
                                            <li>Revenez ici et cliquez « Recharger les rôles ».</li>
                                        </ol>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <a
                                                href={`https://discord.com/channels/${guildId}/settings/roles`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                                Ouvrir les rôles Discord
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => startReload(() => router.refresh())}
                                                disabled={isReloading}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-60"
                                            >
                                                <RefreshCw className={cn("h-3.5 w-3.5", isReloading && "animate-spin")} aria-hidden="true" />
                                                Recharger les rôles
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {roleHint && (
                                    <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                                        {roleHint}
                                    </p>
                                )}
                                {roles.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setRoleId(r.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                                            roleId === r.id
                                                ? "border-success/50 bg-success/10 text-foreground"
                                                : "border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong"
                                        )}
                                    >
                                        <ShieldCheck className={cn("w-4 h-4 shrink-0", roleId === r.id ? "text-success" : "")} />
                                        <span className="flex-1 min-w-0 text-sm font-bold truncate">{r.name}</span>
                                        {roleId === r.id && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Cycle de vie (arrivées, départs, bans)
                                    </label>
                                    <DiscordChannelPicker
                                        guildId={guildId}
                                        value={lifecycleChannel}
                                        onChange={setLifecycleChannel}
                                        placeholder="Choisir un salon…"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Missions (publications, validations)
                                    </label>
                                    <DiscordChannelPicker
                                        guildId={guildId}
                                        value={missionChannel}
                                        onChange={setMissionChannel}
                                        placeholder="Choisir un salon…"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    {selectedCount === 0
                                        ? "Aucun module coché — vous pourrez tout activer plus tard dans Pilotage."
                                        : `${selectedCount} module${selectedCount > 1 ? "s" : ""} coché${selectedCount > 1 ? "s" : ""}.`}
                                </p>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                    {MODULE_GROUPS.map((group) => (
                                        <div key={group.label} className="space-y-1.5">
                                            <p className="text-[11px] font-medium text-muted-foreground px-1">
                                                {group.label}
                                            </p>
                                            {group.modules
                                                .filter((mod) => mod.key !== "admin")
                                                .map((mod) => {
                                                    const selected = !!selectedModules[mod.key];
                                                    const asset = MODULE_DOFUS_ASSETS[mod.key];
                                                    const ModIcon = mod.icon;
                                                    return (
                                                        <button
                                                            key={mod.key}
                                                            type="button"
                                                            onClick={() => toggleModule(mod.key)}
                                                            aria-pressed={selected}
                                                            className={cn(
                                                                "w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors",
                                                                selected
                                                                    ? "border-success/50 bg-success/5"
                                                                    : "border-border bg-black/20 hover:border-border-strong"
                                                            )}
                                                        >
                                                            {asset ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={`/assets/dofus/modules/${asset}`}
                                                                    alt=""
                                                                    loading="lazy"
                                                                    draggable={false}
                                                                    className="w-8 h-8 shrink-0 object-contain"
                                                                />
                                                            ) : (
                                                                <ModIcon className="w-5 h-5 shrink-0 text-muted-foreground" />
                                                            )}
                                                            <span className="flex-1 min-w-0">
                                                                <span className={cn(
                                                                    "block text-sm font-semibold truncate",
                                                                    selected ? "text-foreground" : "text-muted-foreground"
                                                                )}>
                                                                    {mod.label}
                                                                </span>
                                                                <span className="block text-[11px] text-muted-foreground leading-snug">
                                                                    {mod.description}
                                                                </span>
                                                            </span>
                                                            <span className={cn(
                                                                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                                                selected ? "bg-success border-success" : "border-border"
                                                            )}>
                                                                {selected && <Check className="w-3 h-3 text-success-foreground" />}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Histoire de la guilde (quelques lignes suffisent)
                                    </label>
                                    <Textarea
                                        value={presHistory}
                                        onChange={(e) => setPresHistory(e.target.value)}
                                        placeholder="Ex : Guilde PvM fondée en 2021 sur Draconiros, on farm les Songes le mercredi…"
                                        rows={4}
                                        maxLength={2000}
                                        className="bg-black/20 border-border rounded-xl text-sm resize-none focus-visible:ring-0 focus-visible:border-border-strong"
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border bg-black/20">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Recrutement ouvert</p>
                                        <p className="text-[11px] text-muted-foreground">La guilde apparaît comme recruteuse sur sa page publique.</p>
                                    </div>
                                    <Switch checked={presRecruiting} onCheckedChange={setPresRecruiting} />
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="text-sm font-bold text-danger bg-danger/10 border border-danger/30 rounded-xl px-4 py-2.5">
                                {error}
                            </p>
                        )}

                        <div className="flex items-center gap-3">
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => { setStep(1); setError(null); }}
                                    disabled={isPending}
                                    className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
                                >
                                    Retour
                                </button>
                            )}
                            {step === 4 && (
                                <button
                                    type="button"
                                    onClick={() => { setStep(3); setError(null); }}
                                    disabled={isPending}
                                    className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
                                >
                                    Retour
                                </button>
                            )}
                            {step === 5 && (
                                <button
                                    type="button"
                                    onClick={() => { setStep(4); setError(null); }}
                                    disabled={isPending}
                                    className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
                                >
                                    Retour
                                </button>
                            )}
                            {step === 1 && (
                                <button
                                    type="button"
                                    onClick={() => { if (serverId) { setStep(2); setError(null); } else setError("Choisissez un serveur pour continuer."); }}
                                    className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    Continuer <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={isPending || !roleId}
                                    className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Activer ma guilde
                                </button>
                            )}
                            {step === 3 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => { setStep(4); setError(null); }}
                                        disabled={isPending}
                                        className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
                                    >
                                        Passer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveChannels}
                                        disabled={isPending}
                                        className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Enregistrer et continuer
                                    </button>
                                </>
                            )}
                            {step === 4 && (
                                <button
                                    type="button"
                                    onClick={saveModules}
                                    disabled={isPending}
                                    className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Enregistrer et continuer
                                </button>
                            )}
                            {step === 5 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => { setDone(true); setError(null); }}
                                        disabled={isPending}
                                        className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
                                    >
                                        Passer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={savePresentation}
                                        disabled={isPending}
                                        className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Enregistrer et terminer
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-2 text-center">
                            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                Guilde activée !
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                L&apos;accès au dashboard est débloqué pour vos membres. Pour aller plus
                                loin (optionnel) :
                            </p>
                        </div>

                        <div className="grid gap-2">
                            {[
                                { icon: Puzzle, label: "Activer des modules", href: `/dashboard/${guildId}/admin/modules` },
                                { icon: BookOpen, label: "Page de présentation", href: `/dashboard/${guildId}/admin/presentation` },
                                { icon: Swords, label: "Premières missions", href: `/dashboard/${guildId}/missions/manage` },
                                { icon: Rocket, label: "Revoir la configuration", href: `/dashboard/${guildId}/admin/getting-started` },
                            ].map((item) => (
                                <a
                                    key={item.href + item.label}
                                    href={item.href}
                                    onClick={finish}
                                    className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong transition-all"
                                >
                                    <item.icon className="w-4 h-4 shrink-0 text-success" />
                                    <span className="text-sm font-bold">{item.label}</span>
                                    <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
                                </a>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={finish}
                            className="w-full h-12 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-semibold text-sm transition-colors"
                        >
                            Ouvrir le dashboard
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
