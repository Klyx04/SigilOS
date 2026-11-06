"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AVAILABLE_ACTIVITIES } from "@/lib/presentation-constants";
import { PUBLIC_INTRODUCTION_MAX, PUBLIC_OBJECTIFS_MAX } from "@/lib/public-profile-input";
import { cn } from "@/lib/utils";
import { updatePublicPresentation } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/** Présentation du visiteur : introduction, objectifs, activités (liste blanche). */
export function PresentationForm({
    introduction,
    objectifs,
    preferredActivities,
}: {
    introduction: string | null;
    objectifs: string | null;
    preferredActivities: string[];
}) {
    const router = useRouter();
    const [intro, setIntro] = useState(introduction ?? "");
    const [goals, setGoals] = useState(objectifs ?? "");
    const [activities, setActivities] = useState<string[]>(preferredActivities);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const toggleActivity = (id: string) => {
        setActivities((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
        );
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);

        const result = await updatePublicPresentation({
            introduction: intro.trim().length > 0 ? intro : null,
            objectifs: goals.trim().length > 0 ? goals : null,
            preferredActivities: activities,
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        toast.success("Présentation enregistrée.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Présentation"
            description="Quelques lignes pour te présenter et dire ce que tu cherches en jeu."
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="presentation-intro">Qui es-tu ?</Label>
                    <Textarea
                        id="presentation-intro"
                        value={intro}
                        onChange={(event) => setIntro(event.target.value)}
                        maxLength={PUBLIC_INTRODUCTION_MAX}
                        rows={4}
                        placeholder="Ton parcours, tes personnages, ce que tu aimes faire…"
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {intro.length} / {PUBLIC_INTRODUCTION_MAX} caractères
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="presentation-goals">Ce que tu cherches</Label>
                    <Textarea
                        id="presentation-goals"
                        value={goals}
                        onChange={(event) => setGoals(event.target.value)}
                        maxLength={PUBLIC_OBJECTIFS_MAX}
                        rows={3}
                        placeholder="Donjons, succès, artisanat, guilde…"
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {goals.length} / {PUBLIC_OBJECTIFS_MAX} caractères
                    </p>
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">Activités préférées</legend>
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ACTIVITIES.map((activity) => {
                            const active = activities.includes(activity.id);
                            return (
                                <button
                                    key={activity.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => toggleActivity(activity.id)}
                                    disabled={saving}
                                    className={cn(
                                        "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        active && "border-primary bg-primary/10 font-medium text-foreground"
                                    )}
                                >
                                    {activity.label}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer ma présentation"}
                </Button>
            </form>
        </VisitorSection>
    );
}
