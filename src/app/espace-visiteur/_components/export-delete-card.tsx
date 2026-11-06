"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELETE_CONFIRMATION_WORD } from "@/lib/public-profile-input";
import {
    deletePublicProfile,
    exportPublicProfile,
} from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

/** Export RGPD (JSON borné) et suppression **D-V10** (vie publique seule, ou compte). */
export function ExportDeleteCard() {
    const router = useRouter();
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleExport = async () => {
        setError(null);
        setExporting(true);
        const result = await exportPublicProfile();
        setExporting(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "sigilos-espace-visiteur.json";
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Export téléchargé.");
    };

    const handleDelete = async () => {
        setError(null);
        setDeleting(true);
        const result = await deletePublicProfile({ confirmation });
        setDeleting(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        if (result.scope === "ACCOUNT") {
            toast.success("Ton compte a été supprimé.");
            await signOut({ callbackUrl: "/" });
            return;
        }

        setConfirmation("");
        toast.success("Ta vie publique a été supprimée. Ton compte de guilde est intact.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Tes données"
            description="Exporte ce que tu as déclaré, ou supprime ta vie publique. Aucune donnée personnelle n'est conservée après suppression."
        >
            <div className="space-y-5">
                <div>
                    <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
                        {exporting ? "Préparation…" : "Télécharger mon export"}
                    </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-4">
                    <Label htmlFor="delete-confirmation">
                        Supprimer — écris « {DELETE_CONFIRMATION_WORD} » pour confirmer
                    </Label>
                    <Input
                        id="delete-confirmation"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        autoComplete="off"
                        placeholder={DELETE_CONFIRMATION_WORD}
                        disabled={deleting}
                    />
                    <p className="text-xs text-muted-foreground">
                        Si tu as aussi un profil de guilde, seule ta vie publique est supprimée.
                        Sinon, ton compte est supprimé définitivement.
                    </p>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting || confirmation !== DELETE_CONFIRMATION_WORD}
                    >
                        {deleting ? "Suppression…" : "Supprimer définitivement"}
                    </Button>
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}
            </div>
        </VisitorSection>
    );
}
