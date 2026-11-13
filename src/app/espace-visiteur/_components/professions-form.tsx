"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hammer } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOFUS_JOBS, JOB_CATEGORIES } from "@/lib/dofus-assets";
import { PUBLIC_PROFESSIONS_MAX } from "@/lib/public-profile-input";
import { cn } from "@/lib/utils";
import { updatePublicProfessions } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/**
 * Onglet Métiers — **même lecture que l'onglet « Métiers » du profil de guilde**
 * (`src/components/profile/jobs-grid.tsx`) : un onglet par catégorie, une carte par métier
 * (icône réelle, nom, niveau), l'état actif porté par l'accent `warning`.
 *
 * Différence assumée : pas de bouton « Gérer » (on est déjà dans l'édition) ni de modale.
 * La source reste `PublicProfession` (slugs + niveau), jamais le `Json` `metiers`.
 */

const CATEGORY_TAB_CLASS =
    "h-full rounded-lg text-xs font-semibold tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border data-[state=active]:border-warning/30 data-[state=active]:bg-warning/15 data-[state=active]:text-warning";

const CATEGORIES = Object.values(JOB_CATEGORIES);

export function ProfessionsForm({ professions }: { professions: { id: string; level: number }[] }) {
    const router = useRouter();
    const [levels, setLevels] = useState<Record<string, number>>(() =>
        Object.fromEntries(
            professions.map((entry) => [
                entry.id,
                // Niveau obligatoire (1..200) : une ancienne ligne à 0 est ramenée à 1.
                // Le serveur refuse toujours 0 — l'utilisateur peut ajuster avant d'enregistrer.
                entry.level >= 1 ? entry.level : 1,
            ])
        )
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const selectedCount = Object.keys(levels).length;

    const toggleJob = (jobId: string) => {
        setError(null);
        setLevels((current) => {
            if (jobId in current) {
                const next = { ...current };
                delete next[jobId];
                return next;
            }
            if (Object.keys(current).length >= PUBLIC_PROFESSIONS_MAX) {
                setError(`Maximum ${PUBLIC_PROFESSIONS_MAX} métiers.`);
                return current;
            }
            return { ...current, [jobId]: 200 };
        });
    };

    const setLevel = (jobId: string, value: string) => {
        const parsed = Number(value);
        setLevels((current) => ({
            ...current,
            [jobId]: Number.isInteger(parsed) && parsed >= 1 && parsed <= 200 ? parsed : 1,
        }));
    };

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        const result = await updatePublicProfessions(
            Object.entries(levels).map(([id, level]) => ({ id, level }))
        );
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        toast.success("Métiers enregistrés.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Métiers"
            description={`Déclare tes métiers et leur niveau obligatoire (1 à 200) — ${selectedCount} / ${PUBLIC_PROFESSIONS_MAX}. Ils servent au filtre de l'annuaire.`}
        >
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-warning/30 bg-warning/15">
                        <Hammer className="size-4 text-warning" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                        {selectedCount} métier{selectedCount > 1 ? "s" : ""} déclaré
                        {selectedCount > 1 ? "s" : ""}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                            sur {PUBLIC_PROFESSIONS_MAX}
                        </span>
                    </p>
                </div>

                <Tabs defaultValue={CATEGORIES[0]}>
                    <TabsList className="grid h-11 w-full grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 sm:grid-cols-4">
                        {CATEGORIES.map((category) => (
                            <TabsTrigger key={category} value={category} className={CATEGORY_TAB_CLASS}>
                                {category}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* Toutes les catégories vivent dans **la même cellule** de grille : la hauteur
                        du bloc ne dépend donc plus de l'onglet actif. Mesure du 08/11/2026 —
                        « Élevage » ne déclare qu'**un** métier quand Récolte en a six, Artisanat
                        sept : passer à cet onglet retirait une rangée entière, faisait remonter le
                        bouton « Enregistrer mes métiers » et l'écran avec. Les panneaux inactifs
                        restent montés (`forceMount`) mais en `visibility: hidden` — donc invisibles,
                        hors de l'arbre d'accessibilité, et sans effet sur la hauteur. */}
                    <div className="mt-4 grid">
                    {CATEGORIES.map((category) => (
                        <TabsContent
                            key={category}
                            value={category}
                            forceMount
                            className="col-start-1 row-start-1 focus-visible:outline-none data-[state=inactive]:block data-[state=inactive]:invisible"
                        >
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {DOFUS_JOBS[category].map((job) => {
                                    const active = job.id in levels;
                                    return (
                                        <div
                                            key={job.id}
                                            className={cn(
                                                "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors",
                                                active
                                                    ? "border-warning/40 bg-warning/10"
                                                    : "border-border bg-surface hover:bg-elevated"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => toggleJob(job.id)}
                                                disabled={saving}
                                                className="flex w-full flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                                            >
                                                <GameIcon src={job.icon} className="size-9" />
                                                <span className="text-xs font-semibold leading-tight text-foreground">
                                                    {job.name}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-[11px] font-medium",
                                                        active ? "text-warning" : "text-muted-foreground"
                                                    )}
                                                >
                                                    {active ? `Niv. ${levels[job.id]}` : "Non déclaré"}
                                                </span>
                                            </button>
                                            {active ? (
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={200}
                                                    value={levels[job.id]}
                                                    onChange={(event) => setLevel(job.id, event.target.value)}
                                                    aria-label={`Niveau ${job.name}`}
                                                    className="mt-2 h-7 w-16 px-2 text-center text-xs"
                                                    disabled={saving}
                                                />
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </TabsContent>
                    ))}
                    </div>
                </Tabs>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer mes métiers"}
                </Button>
            </div>
        </VisitorSection>
    );
}
