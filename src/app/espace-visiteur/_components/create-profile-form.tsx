"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/shared/game-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPublicProfile } from "@/server/actions/public-profile-actions";
import { PUBLIC_PSEUDO_MAX } from "@/lib/public-profile-input";
import { ServerSelect } from "./server-select";
import { VisitorSection } from "./visitor-section";

/**
 * Écran de **création** du profil public : le serveur est obligatoire (`dofusServerId` est
 * NOT NULL en base — c'est la clé du ladder Ankama et le filtre de l'annuaire).
 *
 * Première arrivée : l'écran **accueille** (ce que l'espace apporte, étape 1/2)
 * au lieu de poser un formulaire nu. Deux ancres `data-tour` portent la visite de
 * création (`visitorOnboarding`) : le serveur et le pseudo.
 */
export function CreateProfileForm({ displayName }: { displayName?: string }) {
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
        <div className="space-y-6">
            <header className="max-w-[62ch]">
                <p className="reg-eyebrow">Bienvenue</p>
                <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    {displayName ? `Bienvenue, ${displayName}.` : "Bienvenue dans ton espace visiteur."}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Ton espace garde ta progression du Rush, tes succès et tes métiers — et te relie aux visiteurs de
                    ton serveur.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                        <GameIcon src="/assets/dofus/game-icons/trophy-1.png" className="h-4 w-4 shrink-0" />
                        Succès et progression sauvegardés d&apos;un appareil à l&apos;autre.
                    </li>
                    <li className="flex items-center gap-2.5">
                        <GameIcon src="/assets/dofus/game-icons/hammer.png" className="h-4 w-4 shrink-0" />
                        Métiers et disponibilités visibles par les visiteurs de ton serveur.
                    </li>
                    <li className="flex items-center gap-2.5">
                        <GameIcon src="/assets/dofus/modules/character.png" className="h-4 w-4 shrink-0" />
                        Un profil public, visible seulement si tu l&apos;autorises.
                    </li>
                </ul>
            </header>

            <VisitorSection
                title="Étape 1 — Ton personnage"
                description="Un serveur et un pseudo Dofus : c'est tout ce qu'il faut pour commencer. Tu pourras tout modifier ensuite, sauf le serveur."
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2" data-tour="visitor-onboarding-server">
                        <Label htmlFor="visitor-server">Serveur Dofus</Label>
                        <ServerSelect value={serverId} onChange={setServerId} disabled={saving} />
                    </div>

                    <div className="space-y-2" data-tour="visitor-onboarding-pseudo">
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

            <p className="max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Ensuite, étape 2 :</span> classe, présentation, mules et
                Metamob, depuis les onglets de ton espace. Tu peux les remplir quand tu veux.
            </p>

            <p className="max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                Tu administres un serveur Discord ?{" "}
                <Link href="/#mise-en-route-titre" className="reg-link">
                    Installer SigilOS
                </Link>
            </p>
        </div>
    );
}
