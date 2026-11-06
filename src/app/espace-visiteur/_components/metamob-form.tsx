"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PUBLIC_METAMOB_KEY_MAX, PUBLIC_METAMOB_PSEUDO_MAX } from "@/lib/public-profile-input";
import { updatePublicMetamob } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/**
 * Metamob : pseudo + clé. La clé est **écrite chiffrée** par le hook Prisma et n'est
 * jamais relue par l'écran — seule son existence est affichée.
 */
export function MetamobForm({
    metamobPseudo,
    hasKey,
    verified,
}: {
    metamobPseudo: string | null;
    hasKey: boolean;
    verified: boolean;
}) {
    const router = useRouter();
    const [pseudo, setPseudo] = useState(metamobPseudo ?? "");
    const [apiKey, setApiKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);

        const result = await updatePublicMetamob({
            metamobPseudo: pseudo,
            ...(apiKey.trim().length > 0 ? { apiKey } : {}),
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        setApiKey("");
        toast.success("Informations Metamob enregistrées.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Metamob"
            description="Ton pseudo public et ta clé d'API. La clé reste côté serveur : elle n'est jamais renvoyée à l'écran."
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="metamob-pseudo">Pseudo Metamob</Label>
                    <Input
                        id="metamob-pseudo"
                        value={pseudo}
                        onChange={(event) => setPseudo(event.target.value)}
                        maxLength={PUBLIC_METAMOB_PSEUDO_MAX}
                        autoComplete="off"
                        disabled={saving}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor="metamob-key">Clé d'API</Label>
                        <Badge variant={hasKey ? "secondary" : "outline"}>
                            {hasKey ? "Enregistrée" : "Aucune clé"}
                        </Badge>
                        {verified ? <Badge variant="secondary">Vérifiée</Badge> : null}
                    </div>
                    <Input
                        id="metamob-key"
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        maxLength={PUBLIC_METAMOB_KEY_MAX}
                        autoComplete="new-password"
                        placeholder={hasKey ? "Laisser vide pour conserver la clé actuelle" : "Colle ta clé Metamob"}
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        Laisser vide conserve la clé existante. Une nouvelle clé devra être vérifiée.{" "}
                        <a
                            href="https://www.metamob.fr/settings#api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
                        >
                            Où trouver ma clé API ?
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    </p>
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer Metamob"}
                </Button>
            </form>
        </VisitorSection>
    );
}
