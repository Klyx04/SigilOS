"use client";

// AchievementSubmission and UserProfile imports removed to avoid type errors with lagging Prisma client
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Eye, Trophy, Calendar, User, Search, Loader2 } from "lucide-react";
import { validateAchievementSubmission } from "@/server/actions/achievement-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SubmissionCountdown } from "@/components/missions/submission-countdown";

type ExtendedSubmission = any; // Avoid TS issues with generated client

interface AchievementValidationQueueProps {
    submissions: ExtendedSubmission[];
    guildId: string;
}

export function AchievementValidationQueue({ submissions: initialSubmissions, guildId }: AchievementValidationQueueProps) {
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleAction = async (id: string, status: "VALIDATED" | "REJECTED") => {
        startTransition(async () => {
            const res = await validateAchievementSubmission(id, status);
            if (res.success) {
                toast.success(status === "VALIDATED" ? "Points validés !" : "Demande rejetée.");
                setSubmissions(prev => prev.filter(s => s.id !== id));
            } else {
                toast.error(res.error || "Une erreur est survenue.");
            }
        });
    };

    const filteredSubmissions = submissions.filter(s =>
        (s.profile.discordNickname || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.profile.pseudoDofus || "").toLowerCase().includes(search.toLowerCase())
    );

    if (submissions.length === 0) {
        return (
            <Card className="border-dashed border-white/10 bg-black/20 backdrop-blur-md italic text-zinc-500 py-12 flex flex-col items-center justify-center gap-4">
                <Trophy className="w-12 h-12 opacity-10" />
                <p>Aucune demande de points de succès en attente.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                    placeholder="Filtrer par pseudo..."
                    className="pl-9 bg-zinc-950 border-white/5"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredSubmissions.map((s) => (
                    <Card key={s.id} className="overflow-hidden border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors">
                        <div className="flex flex-col md:flex-row">
                            {/* Preview */}
                            <div
                                className="relative w-full md:w-64 h-48 bg-black cursor-zoom-in group"
                                onClick={() => setSelectedImage(s.proofUrl)}
                            >
                                <img
                                    src={s.proofUrl}
                                    className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                                    alt="Preuve"
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                    <Eye className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                                    OCR: {Math.round(s.ocrScore || 0)}%
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 p-5 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-black/40">
                                                {s.profile.user.image ? (
                                                    <img src={s.profile.user.image} className="w-full h-full object-cover" alt="User" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User className="w-5 h-5 text-zinc-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-white tracking-tight">{s.profile.discordNickname || "Membre"}</p>
                                                <p className="text-[10px] text-zinc-500 italic">{s.profile.pseudoDofus || "Sans pseudo Dofus"}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black text-amber-400 leading-none">{s.points.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Points Détectés</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-medium flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(s.createdAt).toLocaleString('fr-FR')}
                                        </div>
                                        <SubmissionCountdown createdAt={new Date(s.createdAt)} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 mt-6">
                                    <Button
                                        onClick={() => handleAction(s.id, "REJECTED")}
                                        disabled={isPending}
                                        variant="outline"
                                        size="sm"
                                        className="bg-red-500/5 hover:bg-red-500/10 text-red-500 border-red-500/20 font-bold"
                                    >
                                        <X className="w-3.5 h-3.5 mr-1.5" />
                                        Rejeter
                                    </Button>
                                    <Button
                                        onClick={() => handleAction(s.id, "VALIDATED")}
                                        disabled={isPending}
                                        size="sm"
                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold"
                                    >
                                        <Check className="w-3.5 h-3.5 mr-1.5" />
                                        Valider
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        className="max-w-full max-h-full object-contain shadow-2xl"
                        alt="Zoom"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            )}

            {isPending && (
                <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
            )}
        </div>
    );
}
