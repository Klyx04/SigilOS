"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setAccountNotificationsEnabled } from "@/server/actions/account-notification-actions";
import { VisitorSection } from "./visitor-section";

/**
 * Opt-out des notifications de **compte** (N2-bis).
 *
 * Une seule préférence, portée par `User.accountNotificationsEnabled` : elle
 * coupe le changelog et les réponses aux signalements. Les notifications déjà
 * reçues restent lisibles dans l'onglet Notifications.
 */
export function AccountNotificationsSettings({ enabled }: { enabled: boolean }) {
    const router = useRouter();
    const [value, setValue] = useState(enabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        setSaving(true);
        const result = await setAccountNotificationsEnabled(value);
        setSaving(false);
        if (!result.success) {
            setError(result.error ?? "Mise à jour impossible.");
            return;
        }
        toast.success("Préférence de notifications enregistrée.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Notifications"
            description="Choisis si tu veux recevoir les notifications de ton compte : changelog et réponses à tes signalements."
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <Label htmlFor="settings-account-notifications">
                            Recevoir les notifications de mon compte
                        </Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Désactiver coupe les nouvelles notifications. Celles déjà reçues restent dans
                            l&apos;onglet Notifications.
                        </p>
                    </div>
                    <Switch
                        id="settings-account-notifications"
                        checked={value}
                        onCheckedChange={setValue}
                        disabled={saving}
                    />
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="button" onClick={save} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer ma préférence"}
                </Button>
            </div>
        </VisitorSection>
    );
}
