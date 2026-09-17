"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Server, ShieldCheck, Loader2, CheckCircle2, ArrowRight, Rocket, Puzzle, BookOpen, Swords } from "lucide-react";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { completeMandatoryOnboarding } from "@/server/actions/admin-actions";

export interface OnboardingServerOption {
    id: string;
    name: string;
    group: string;
}

export interface OnboardingRoleOption {
    id: string;
    name: string;
}

/**
 * Modale BLOQUANTE des 2 étapes obligatoires (serveur de jeu + rôle
 * `dashboard:login`, jamais @everyone). Non-fermable : pas de croix, pas de
 * clic extérieur, pas d'Escape — rendue par le layout tant que
 * `!isOnboardingComplete` (God exempté). À la validation, l'écran de succès
 * présente les étapes optionnelles (2e modale demandée, sans machinerie :
 * juste des liens).
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
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [serverId, setServerId] = useState("");
    const [roleId, setRoleId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [isPending, startTransition] = useTransition();

    const submit = () => {
        setError(null);
        if (!serverId || !roleId) {
            setError("Choisissez un serveur puis un rôle pour continuer.");
            return;
        }
        startTransition(async () => {
            const res = await completeMandatoryOnboarding(guildId, serverId, roleId);
            if (res.success) {
                setDone(true);
            } else {
                setError(res.error || "Échec de l'enregistrement.");
            }
        });
    };

    const finish = () => {
        // Pas de reload() ici : il annulerait la navigation des liens.
        // Le refresh invalide le layout serveur → la modale disparaît.
        router.refresh();
        router.push(`/dashboard/${guildId}`);
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
                            <p className="text-xs font-black uppercase tracking-widest text-warning">
                                Configuration obligatoire — étape {step} / 2
                            </p>
                            <h2 className="text-2xl font-black text-foreground tracking-tight">
                                {step === 1 ? "Votre serveur de jeu" : "Qui peut se connecter ?"}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {step === 1
                                    ? "Sélectionnez le serveur Dofus de votre guilde. Requis pour débloquer l'accès au dashboard."
                                    : "Choisissez au moins un rôle Discord autorisé à se connecter (jamais @everyone). Sans cela, personne ne peut entrer."}
                            </p>
                        </div>

                        {/* Indicateur d'étapes */}
                        <div className="flex items-center gap-2">
                            {[1, 2].map((s) => (
                                <div
                                    key={s}
                                    className={cn(
                                        "h-1.5 flex-1 rounded-full transition-colors",
                                        s < step || (s === 2 && step === 2) ? "bg-success" : s === step ? "bg-warning" : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>

                        {step === 1 ? (
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
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {roles.length === 0 && (
                                    <p className="text-sm text-warning font-medium p-3 rounded-xl border border-warning/30 bg-warning/10">
                                        Aucun rôle éligible trouvé sur le serveur. Créez un rôle Discord puis rechargez.
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
                                    className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground font-bold text-sm transition-colors disabled:opacity-50"
                                >
                                    Retour
                                </button>
                            )}
                            {step === 1 ? (
                                <button
                                    type="button"
                                    onClick={() => { if (serverId) { setStep(2); setError(null); } else setError("Choisissez un serveur pour continuer."); }}
                                    className="flex-1 h-12 rounded-xl bg-success hover:bg-success text-success-foreground font-black text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    Continuer <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={isPending || !roleId}
                                    className="flex-1 h-12 rounded-xl bg-success hover:bg-success text-success-foreground font-black text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Activer ma guilde
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-2 text-center">
                            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                            <h2 className="text-2xl font-black text-foreground tracking-tight">
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
                                { icon: Rocket, label: "Revoir la mise en route", href: `/dashboard/${guildId}/admin/getting-started` },
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
                            className="w-full h-12 rounded-xl bg-success hover:bg-success text-success-foreground font-black text-sm uppercase tracking-wider transition-colors"
                        >
                            Ouvrir le dashboard
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
