'use client'

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { validateSubmission } from "@/server/actions/mission-actions";
import { Submission, Mission, UserProfile, User } from "@prisma/client";
import { Check, X, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type ExtendedSubmission = Submission & {
    mission: Mission;
    profile: UserProfile & { user: User };
};

export function ValidationQueue({ submissions: initialSubmissions }: { submissions: ExtendedSubmission[] }) {
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleDecision = async (id: string, status: "VALIDATED" | "REJECTED") => {
        setProcessingId(id);
        const result = await validateSubmission(id, status);
        setProcessingId(null);

        if (result.success) {
            toast.success(status === "VALIDATED" ? "Validé avec succès" : "Refusé");
            setSubmissions(prev => prev.filter(s => s.id !== id));
        } else {
            toast.error(result.error || "Erreur action");
        }
    };

    if (submissions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                <Check className="w-12 h-12 mb-4 opacity-20" />
                <p>Aucune soumission en attente.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {submissions.map((item) => (
                <Card key={item.id} className="bg-zinc-900 border-zinc-800 overflow-hidden">
                    {/* Header: User & Mission Info */}
                    <CardHeader className="p-4 bg-zinc-950/50 border-b border-zinc-800/50 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden relative">
                                {item.profile.user.image && (
                                    <Image
                                        src={item.profile.user.image}
                                        alt={item.profile.pseudoDofus || "User"}
                                        fill
                                        className="object-cover"
                                    />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">{item.profile.pseudoDofus || "Membre"}</span>
                                <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{item.mission.category}</Badge>
                    </CardHeader>

                    {/* Content: Proof Image & Mission Title */}
                    <CardContent className="p-4 space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold text-white truncate">{item.mission.title || "Mission"}</h4>
                            <p className="text-xs text-zinc-400">Rang {item.mission.tier}</p>
                        </div>

                        {/* Image Preview */}
                        <div className="relative aspect-video rounded-lg bg-black overflow-hidden border border-zinc-800 group">
                            <Image
                                src={item.proofUrl}
                                alt="Preuve"
                                fill
                                className="object-contain"
                            />
                            <a
                                href={item.proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Ouvrir l'original
                            </a>
                        </div>
                    </CardContent>

                    {/* Footer: Actions */}
                    <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-3">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => handleDecision(item.id, "REJECTED")}
                            disabled={processingId === item.id}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Refuser
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-500 border-0"
                            onClick={() => handleDecision(item.id, "VALIDATED")}
                            disabled={processingId === item.id}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Valider
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
