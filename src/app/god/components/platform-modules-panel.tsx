"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Info, Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MODULE_GROUPS, MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";
import { MAINTENANCE_LABEL, MODULE_NOTICE_MAX_LENGTH } from "@/lib/module-lock";
import type { ModuleKey } from "@/lib/module-types";
import { setPlatformModuleLock } from "@/server/actions/module-actions";
import { GodBadge, GodCard, GodSectionHeader } from "@/app/god/ui";
import { cn } from "@/lib/utils";

/**
 * Vue God « Modules » (A2 · G12) — **coupure globale** d'un module pour TOUTES
 * les guildes, avec message de maintenance affiché sur la carte du module côté
 * guilde. Le verrou plateforme prime sur le verrou de guilde et sur le toggle.
 *
 * Une seule source d'écriture : `setPlatformModuleLock` (Zod, rate-limit 10/min,
 * garde d'état, journal God). Chaque carte expose **une action primaire**.
 */
export type PlatformModuleOverviewView = {
    locks: ModuleKey[];
    notices: Partial<Record<ModuleKey, string>>;
    guildLockCounts: Partial<Record<ModuleKey, number>>;
    updatedAt: string | null;
    updatedBy: string | null;
};

export function PlatformModulesPanel({ overview }: { overview: PlatformModuleOverviewView }) {
    const [locks, setLocks] = useState<ModuleKey[]>(overview.locks);
    const [notices, setNotices] = useState<Partial<Record<ModuleKey, string>>>(overview.notices);
    const [drafts, setDrafts] = useState<Partial<Record<ModuleKey, string>>>({});
    const [pending, setPending] = useState<ModuleKey | null>(null);
    const [isPending, startTransition] = useTransition();

    const modules = MODULE_GROUPS.flatMap((group) => group.modules).filter((mod) => mod.key !== "admin");
    const lockedCount = modules.filter((mod) => locks.includes(mod.key)).length;
    const draftOf = (key: ModuleKey) => drafts[key] ?? notices[key] ?? "";

    function writeState(key: ModuleKey, locked: boolean, notice: string) {
        const previousLocks = locks;
        const previousNotices = notices;
        setLocks((prev) => (locked ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)));
        setNotices((prev) => {
            const next = { ...prev };
            if (locked && notice.trim()) next[key] = notice.trim();
            else delete next[key];
            return next;
        });
        setPending(key);

        startTransition(async () => {
            const result = await setPlatformModuleLock(key, locked, notice.trim() || undefined);
            if (!result.success) {
                setLocks(previousLocks);
                setNotices(previousNotices);
                toast.error(result.error || "Erreur lors de la mise à jour");
            } else {
                setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                toast.success(locked ? `« ${key} » indisponible pour toutes les guildes` : `« ${key} » rétabli pour toutes les guildes`);
            }
            setPending(null);
        });
    }

    return (
        <div className="space-y-8 py-8">
            <div className="flex flex-col gap-4">
                <GodBadge variant={lockedCount > 0 ? "warning" : "success"}>
                    {lockedCount > 0 ? `${lockedCount} module(s) coupé(s) pour la plateforme` : "Tous les modules sont disponibles"}
                </GodBadge>
                <GodSectionHeader
                    title="Modules & maintenance"
                    description="Coupez un module pour TOUTES les guildes (le toggle de chaque guilde est conservé et restauré au déverrouillage) et rédigez le message affiché sur la carte du module."
                />
                {overview.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                        Dernière modification : {new Date(overview.updatedAt).toLocaleString("fr-FR")}
                    </p>
                )}
            </div>

            {MODULE_GROUPS.map((group) => {
                const groupModules = group.modules.filter((mod) => mod.key !== "admin");
                if (groupModules.length === 0) return null;
                return (
                    <div key={group.label} className="space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">{group.label}</h3>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {groupModules.map((mod) => {
                                const key = mod.key;
                                const isLocked = locks.includes(key);
                                const isLoading = pending === key && isPending;
                                const guildCount = overview.guildLockCounts[key] ?? 0;
                                const Icon = mod.icon;
                                const notice = draftOf(key);
                                const dirty = notice.trim() !== (notices[key] ?? "");

                                return (
                                    <GodCard key={key} className={cn("p-5 space-y-4", isLocked && "border-warning/20")}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={cn(
                                                    "h-11 w-11 rounded-xl flex items-center justify-center border shrink-0",
                                                    isLocked ? "bg-warning/10 border-warning/25" : "bg-surface/10 border-border"
                                                )}>
                                                    {MODULE_DOFUS_ASSETS[key] ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={`/assets/dofus/modules/${MODULE_DOFUS_ASSETS[key]}`} alt="" className="w-6 h-6 object-contain" />
                                                    ) : (
                                                        <Icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold text-foreground">{mod.label}</span>
                                                        {isLocked ? (
                                                            <GodBadge variant="warning">{MAINTENANCE_LABEL}</GodBadge>
                                                        ) : (
                                                            <GodBadge variant="success">Disponible</GodBadge>
                                                        )}
                                                        {guildCount > 0 && (
                                                            <span className="text-caption text-muted-foreground">
                                                                verrouillé par le God pour {guildCount} guilde{guildCount > 1 ? "s" : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center shrink-0">
                                                {isLoading ? (
                                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <Switch
                                                        checked={isLocked}
                                                        onCheckedChange={(val) => writeState(key, val, draftOf(key))}
                                                        aria-label={`Couper ${mod.label} pour toutes les guildes`}
                                                        className="data-[state=checked]:bg-warning"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-3 border-t border-border">
                                            <label className="text-caption uppercase tracking-wide text-muted-foreground" htmlFor={`notice-${key}`}>
                                                Message affiché sur la carte
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id={`notice-${key}`}
                                                    value={notice}
                                                    maxLength={MODULE_NOTICE_MAX_LENGTH}
                                                    onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                                                    placeholder={`Défaut : ${MAINTENANCE_LABEL}`}
                                                    className="flex-1 rounded-xl border border-border bg-surface/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/40"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={!isLocked || !dirty || pending === key}
                                                    onClick={() => writeState(key, true, draftOf(key))}
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                                                        !isLocked || !dirty
                                                            ? "border-border text-muted-foreground cursor-not-allowed"
                                                            : "border-warning/30 text-warning hover:bg-warning/10"
                                                    )}
                                                >
                                                    <Save className="w-3.5 h-3.5" /> Enregistrer
                                                </button>
                                            </div>
                                            {!isLocked && (
                                                <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                                                    <Info className="w-3 h-3" /> Le message s&apos;applique avec la coupure du module.
                                                </p>
                                            )}
                                        </div>
                                    </GodCard>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
