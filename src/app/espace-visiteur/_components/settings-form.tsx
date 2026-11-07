"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updatePublicSettings } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/** Les trois consentements restent **séparés** : annuaire et présence temps réel (D-V4 / D9),
 * publication de la progression de rush (D-V21). Aucun n'entraîne les autres. */
export function SettingsForm({
    showOnDirectory,
    showPresence,
    showRushProgress,
}: {
    showOnDirectory: boolean;
    showPresence: boolean;
    showRushProgress: boolean;
}) {
    const router = useRouter();
    const [directory, setDirectory] = useState(showOnDirectory);
    const [presence, setPresence] = useState(showPresence);
    const [rushProgress, setRushProgress] = useState(showRushProgress);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        const result = await updatePublicSettings({
            showOnDirectory: directory,
            showPresence: presence,
            showRushProgress: rushProgress,
        });
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        toast.success("Réglages enregistrés.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Visibilité"
            description="Tu décides, séparément, d'apparaître dans l'annuaire, d'afficher ta présence en ligne et de publier ta progression de rush."
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <Label htmlFor="settings-directory">Figurer dans l'annuaire</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ton pseudo, ta classe et tes Dofus sont visibles par les visiteurs du même serveur.
                        </p>
                    </div>
                    <Switch
                        id="settings-directory"
                        checked={directory}
                        onCheckedChange={setDirectory}
                        disabled={saving}
                    />
                </div>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <Label htmlFor="settings-presence">Afficher ma présence</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Indique aux autres visiteurs que tu es en ligne. Consentement distinct de l'annuaire.
                        </p>
                    </div>
                    <Switch
                        id="settings-presence"
                        checked={presence}
                        onCheckedChange={setPresence}
                        disabled={saving}
                    />
                </div>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <Label htmlFor="settings-rush-progress">Publier ma progression de rush</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Les visiteurs du même serveur voient tes blocs, ta quête en cours et tes
                            donjons cochés, avec le nom de tes personnages. Sans cette case, ta
                            progression reste privée même si tu figures dans l'annuaire.
                        </p>
                    </div>
                    <Switch
                        id="settings-rush-progress"
                        checked={rushProgress}
                        onCheckedChange={setRushProgress}
                        disabled={saving}
                    />
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer mes réglages"}
                </Button>
            </div>
        </VisitorSection>
    );
}