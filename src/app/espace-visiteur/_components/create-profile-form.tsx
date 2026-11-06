"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPublicProfile } from "@/server/actions/public-profile-actions";
import { PUBLIC_PSEUDO_MAX } from "@/lib/public-profile-input";
import { ServerSelect } from "./server-select";
import { VisitorSection } from "./visitor-section";

/**
 * Écran de **création** du profil public : le serveur est obligatoire (`dofusServerId` est
 * NOT NULL en base — c'est la clé du ladder Ankama et le filtre de l'annuaire).
 */
export function CreateProfileForm() {
    const router = useRouter();
    const [serverId, setServerId] = useState("");
    const [pseudo, setPseudo] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const parsedServerId = Number(serverId);
        if (!Number.isInteger(parsedServerId) || parsedServerId <= 0) {
            setError("Choisis ton serveur Dofus — il ne pourra plus être deviné ensuite.");
            return;
        }

        setSaving(true);
        const result = await createPublicProfile({
            dofusServerId: parsedServerId,
            pseudoDofus: pseudo,
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        toast.success("Ton espace visiteur est créé.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Créer ton espace visiteur"
            description="Un serveur, un pseudo Dofus : c'est tout ce qu'il faut pour commencer. Tu pourras tout modifier ensuite."
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="visitor-server">Serveur Dofus</Label>
                    <ServerSelect value={serverId} onChange={setServerId} disabled={saving} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="visitor-pseudo">Pseudo Dofus</Label>
                    <Input
                        id="visitor-pseudo"
                        value={pseudo}
                        onChange={(event) => setPseudo(event.target.value)}
                        maxLength={PUBLIC_PSEUDO_MAX}
                        autoComplete="off"
                        placeholder="Le nom de ton personnage principal"
                        disabled={saving}
                        required
                    />
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="submit" disabled={saving}>
                    {saving ? "Création…" : "Créer mon espace"}
                </Button>
            </form>
        </VisitorSection>
    );
}
