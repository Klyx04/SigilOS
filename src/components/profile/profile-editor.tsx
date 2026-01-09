"use client";

import { useState, useTransition } from "react";
import { UserProfile } from "@prisma/client";
import { updateUserProfile } from "@/server/actions/profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DOFUS_CLASSES, DOFUS_JOBS } from "@/lib/dofus-data";
import { Loader2, Save, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ExtendedProfile extends UserProfile {
    user: { name: string | null; image: string | null };
    xp: number;
    guildatons: number;
}

interface ProfileEditorProps {
    profile: any; // Bypass stale type
    guildId: string;
}

export function ProfileEditor({ profile: rawProfile, guildId }: ProfileEditorProps) {
    const profile = rawProfile as ExtendedProfile;
    const [isPending, startTransition] = useTransition();

    const [pseudo, setPseudo] = useState(profile.pseudoDofus || "");
    const [classe, setClasse] = useState(profile.classe || "");
    // Helper to safely parse JSONB
    const initialJobs = Array.isArray(profile.metiers) ? (profile.metiers as string[]) : [];
    const [jobs, setJobs] = useState<string[]>(initialJobs);

    const handleSave = () => {
        if (!pseudo) {
            toast.error("Le pseudo est obligatoire");
            return;
        }

        startTransition(async () => {
            const result = await updateUserProfile({
                guildId,
                pseudoDofus: pseudo,
                classe: classe || undefined,
                metiers: jobs
            });

            if (result.success) {
                toast.success("Profil mis à jour avec succès");
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
            }
        });
    };

    const jobOptions = DOFUS_JOBS.map(job => ({ label: job, value: job }));

    return (
        <div className="grid gap-6 md:grid-cols-2">

            {/* ID CARD */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm h-fit">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-primary" />
                        Identité Visuelle
                    </CardTitle>
                    <CardDescription>
                        Aperçu de votre carte de membre dans l'annuaire.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6 gap-4">
                    <div className="relative group">
                        <Avatar className="w-32 h-32 border-4 border-white/10 shadow-xl group-hover:border-primary transition-colors">
                            <AvatarImage src={profile.user.image || ""} />
                            <AvatarFallback className="text-4xl bg-zinc-800 text-zinc-400">
                                {profile.user.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        {/* Placeholder for future avatar upload */}
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                            {pseudo || profile.user.name || "Inconnu"}
                        </h3>
                        <p className="text-primary font-medium">{classe || "Classe inconnue"}</p>

                        {/* Stats Badges */}
                        <div className="flex items-center justify-center gap-3 mt-4 text-xs font-mono">
                            <div className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                ✨ {profile.xp} XP
                            </div>
                            <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                🪙 {profile.guildatons} G
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* FORM */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader>
                    <CardTitle>Configuration du Profil</CardTitle>
                    <CardDescription>
                        Ces informations permettent aux autres membres de vous trouver.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="space-y-2">
                        <Label>Pseudo en jeu (Obligatoire)</Label>
                        <Input
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            placeholder="Ex: Dark-Sasuké"
                            className="bg-zinc-950/50 border-white/10 focus:border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground">Utilisé pour la validation des preuves.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Classe</Label>
                        <Select value={classe} onValueChange={setClasse}>
                            <SelectTrigger className="bg-zinc-950/50 border-white/10">
                                <SelectValue placeholder="Sélectionner une classe" />
                            </SelectTrigger>
                            <SelectContent>
                                {DOFUS_CLASSES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Métiers (Niveau 200)</Label>
                        <MultiSelect
                            options={jobOptions}
                            selected={jobs}
                            onChange={setJobs}
                            placeholder="Sélectionner vos métiers"
                        />
                        <p className="text-xs text-muted-foreground">
                            Sélectionnez uniquement vos métiers maîtrisés.
                        </p>
                    </div>

                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 pt-6">
                    <Button variant="ghost" onClick={() => setPseudo(profile.pseudoDofus || "")}>
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={isPending} className="min-w-[140px]">
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sauvegarde...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
