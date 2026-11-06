"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/shared/game-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { DECLARED_GUILD_NAME_MAX } from "@/lib/public-profile-rules";
import { PUBLIC_PSEUDO_MAX } from "@/lib/public-profile-input";
import { updatePublicIdentity } from "@/server/actions/public-profile-actions";
import { ServerSelect } from "./server-select";
import { VisitorSection } from "./visitor-section";

/** Identité du visiteur : serveur, pseudo, classe et **nom de guilde déclaré** (aucun logo). */
export function IdentityForm({
    serverId,
    pseudoDofus,
    classe,
    declaredGuildName,
}: {
    serverId: number;
    pseudoDofus: string | null;
    classe: string | null;
    declaredGuildName: string | null;
}) {
    const router = useRouter();
    const [server, setServer] = useState(String(serverId));
    const [pseudo, setPseudo] = useState(pseudoDofus ?? "");
    const [classeValue, setClasseValue] = useState(classe ?? "");
    const [guildName, setGuildName] = useState(declaredGuildName ?? "");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const selectedClass = DOFUS_CLASSES.find((entry) => entry.id === classeValue);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const parsedServerId = Number(server);
        if (!Number.isInteger(parsedServerId) || parsedServerId <= 0) {
            setError("Choisis ton serveur Dofus.");
            return;
        }
        if (!classeValue) {
            setError("Choisis ta classe.");
            return;
        }

        setSaving(true);
        const result = await updatePublicIdentity({
            dofusServerId: parsedServerId,
            pseudoDofus: pseudo,
            classe: classeValue,
            declaredGuildName: guildName.trim().length > 0 ? guildName : null,
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        toast.success("Identité enregistrée.");
        router.refresh();
    };

    return (
        <VisitorSection
            title="Identité"
            description="Ce que verront les autres visiteurs du même serveur. Seul le nom de ta guilde est déclaratif : aucun logo n'est demandé."
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="identity-server">Serveur Dofus</Label>
                        <ServerSelect value={server} onChange={setServer} disabled={saving} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="identity-class">Classe</Label>
                        <Select value={classeValue} onValueChange={setClasseValue} disabled={saving}>
                            <SelectTrigger id="identity-class" className="w-full">
                                <span className="flex items-center gap-2">
                                    {selectedClass ? <GameIcon src={selectedClass.icon} className="h-4 w-4" /> : null}
                                    <SelectValue placeholder="Choisis ta classe" />
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                {DOFUS_CLASSES.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        <span className="flex items-center gap-2">
                                            <GameIcon src={entry.icon} className="h-4 w-4" />
                                            {entry.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="identity-pseudo">Pseudo Dofus</Label>
                    <Input
                        id="identity-pseudo"
                        value={pseudo}
                        onChange={(event) => setPseudo(event.target.value)}
                        maxLength={PUBLIC_PSEUDO_MAX}
                        autoComplete="off"
                        disabled={saving}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="identity-guild">Guilde déclarée (facultatif)</Label>
                    <Input
                        id="identity-guild"
                        value={guildName}
                        onChange={(event) => setGuildName(event.target.value)}
                        maxLength={DECLARED_GUILD_NAME_MAX}
                        autoComplete="off"
                        placeholder="Le nom de ta guilde, sans logo"
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        Lettres uniquement, espaces, apostrophes et tirets. Aucun chiffre, aucun accent.
                    </p>
                </div>

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer mon identité"}
                </Button>
            </form>
        </VisitorSection>
    );
}
