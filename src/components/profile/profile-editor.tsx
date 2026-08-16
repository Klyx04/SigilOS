"use client";

import { useState, useTransition } from "react";
import { UserProfile } from "@prisma/client";
import { updateUserProfile, verifyDofusPseudo } from "@/server/actions/profile-actions";
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
import { Loader2, Save, User as UserIcon, Search, UserCheck, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDofusPseudo, cn } from "@/lib/utils";

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
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
    // Helper to safely parse JSONB
    const initialJobs = Array.isArray(profile.metiers) ? (profile.metiers as string[]) : [];
    const [jobs, setJobs] = useState<string[]>(initialJobs);

    const handleVerify = async () => {
        if (!pseudo || pseudo.length < 2) return;
        setIsVerifying(true);
        setVerifyStatus("idle");
        try {
            const res = await verifyDofusPseudo(pseudo, guildId);
            if (res.success) {
                setVerifyStatus("success");
                toast.success("Pseudo trouvé sur le ladder !");
            } else {
                setVerifyStatus("error");
                toast.error(res.error || "Pseudo introuvable");
            }
        } catch (e) {
            setVerifyStatus("error");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSave = () => {
        if (!pseudo) {
            toast.error("Le pseudo est obligatoire");
            return;
        }

        // Si le pseudo a changé par rapport à l'original et n'est pas vérifié
        if (pseudo !== (profile.pseudoDofus || "") && verifyStatus !== "success") {
            toast.error("Veuillez vérifier la validité de votre pseudo avant d'enregistrer.");
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
                        <div className="flex gap-2">
                            <div className="relative flex-1 group/input">
                                <Input
                                    value={pseudo}
                                    onChange={(e) => {
                                        setPseudo(formatDofusPseudo(e.target.value));
                                        setVerifyStatus("idle");
                                    }}
                                    placeholder="Ex: Dark-Sasuké"
                                    className={cn(
                                        "bg-zinc-950/50 border-white/10 focus:border-primary/50 transition-all",
                                        verifyStatus === "success" && "border-emerald-500/50 pr-10",
                                        verifyStatus === "error" && "border-rose-500/50 pr-10"
                                    )}
                                />
                                {verifyStatus === "success" && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                                        <UserCheck className="w-4 h-4" />
                                    </div>
                                )}
                                {verifyStatus === "error" && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500">
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                            <Button 
                                variant="outline" 
                                size="icon"
                                onClick={handleVerify}
                                disabled={isVerifying || !pseudo || pseudo.length < 2}
                                className={cn(
                                    "shrink-0 bg-black/20 border-white/10 hover:border-white/20",
                                    verifyStatus === "success" && "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                                )}
                            >
                                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </div>
                        <p className="text-caption leading-relaxed text-muted-foreground ml-1 mt-1">
                            {verifyStatus === "success" ? (
                                <span className="text-emerald-400 font-medium">✅ Pseudo validé sur le ladder officiel.</span>
                            ) : (
                                <>
                                    Le pseudo doit être <strong className="text-white">EXACT</strong> (Majuscules, tirets, etc.) pour que la synchronisation automatique fonctionne.
                                </>
                            )}
                        </p>
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
