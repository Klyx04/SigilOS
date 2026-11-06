"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOFUS_JOBS } from "@/lib/dofus-assets";
import { PUBLIC_PROFESSIONS_MAX } from "@/lib/public-profile-input";
import { cn } from "@/lib/utils";
import { updatePublicProfessions } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/**
 * Métiers déclarés — la source est `PublicProfession` (slugs + niveau), jamais le `Json`
 * `metiers`. Le niveau est ramené dans `1..200` côté action, avec un refus explicite.
 */
export function ProfessionsForm({ professions }: { professions: { id: string; level: number }[] }) {
    const router = useRouter();
    const [levels, setLevels] = useState<Record<string, number>>(() =>
        Object.fromEntries(professions.map((entry) => [entry.id, entry.level]))
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
            description={`Coche tes métiers et leur niveau (${selectedCount} / ${PUBLIC_PROFESSIONS_MAX}). Ils servent au filtre de l'annuaire.`}
        >
            <div className="space-y-5">
                {Object.entries(DOFUS_JOBS).map(([category, jobs]) => (
                    <fieldset key={category} className="space-y-2">
                        <legend className="text-sm font-medium text-foreground">{category}</legend>
                        <div className="flex flex-wrap gap-2">
                            {jobs.map((job) => {
                                const active = job.id in levels;
                                return (
                                    <div
                                        key={job.id}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg border border-border px-2 py-1",
                                            active && "border-primary bg-primary/10"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => toggleJob(job.id)}
                                            disabled={saving}
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {job.name}
                                        </button>
                                        {active ? (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={200}
                                                value={levels[job.id]}
                                                onChange={(event) => setLevel(job.id, event.target.value)}
                                                aria-label={`Niveau ${job.name}`}
                                                className="h-7 w-16 px-2 text-xs"
                                                disabled={saving}
                                            />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </fieldset>
                ))}

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
