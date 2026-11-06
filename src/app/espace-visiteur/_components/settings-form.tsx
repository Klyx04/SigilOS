"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updatePublicSettings } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/** Les deux consentements restent **séparés** : annuaire et présence temps réel (D-V4 / D9). */
export function SettingsForm({
    showOnDirectory,
    showPresence,
}: {
    showOnDirectory: boolean;
    showPresence: boolean;
}) {
    const router = useRouter();
    const [directory, setDirectory] = useState(showOnDirectory);
    const [presence, setPresence] = useState(showPresence);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        const result = await updatePublicSettings({
            showOnDirectory: directory,
            showPresence: presence,
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
            description="Tu décides, séparément, d'apparaître dans l'annuaire et d'afficher ta présence en ligne."
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
