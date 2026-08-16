'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Users, User as UserIcon, Loader2 } from "lucide-react";
import { MissionInterest, UserProfile, User } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMissionInterest } from "@/server/actions/mission-actions";
import { toast } from "sonner";

// --- Props ---

interface InterestModalProps {
    isOpen: boolean;
    onClose: () => void;
    missionTitle: string;
    missionId: string;
    interests: (MissionInterest & {
        profile: UserProfile & {
            user: User | null
        }
    })[];
    currentUserId: string;
}

// --- Component ---

export function InterestModal({
    isOpen,
    onClose,
    missionTitle,
    missionId,
    interests,
    currentUserId
}: InterestModalProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const isCurrentUserInterested = interests.some(i => i.profile.userId === currentUserId);

    const handleToggleInterest = () => {
        startTransition(async () => {
            const result = await toggleMissionInterest(missionId);
            if (result.success) {
                toast.success(isCurrentUserInterested ? "Intérêt retiré" : "Intérêt ajouté !");
                router.refresh(); // Force refresh to update the interest list
            } else {
                toast.error(result.error || "Erreur");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Users className="w-5 h-5 text-indigo-400" />
                        Intéressés
                    </DialogTitle>
                    <p className="text-sm text-slate-400 mt-1">
                        {missionTitle}
                    </p>
                </DialogHeader>

                <div className="py-4">
                    {interests.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Personne n'est intéressé pour le moment.</p>
                            <p className="text-xs mt-1">Sois le premier !</p>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-64">
                            <div className="space-y-2 pr-4">
                                {interests.map((interest) => (
                                    <div
                                        key={interest.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                                            interest.profile.userId === currentUserId
                                                ? "bg-indigo-500/10 border-indigo-500/30"
                                                : "bg-slate-800/50 border-slate-700/50"
                                        )}
                                    >
                                        {/* Avatar Placeholder */}
                                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 overflow-hidden">
                                            {interest.profile.user?.image ? (
                                                <img
                                                    src={interest.profile.user.image}
                                                    alt={interest.profile.user.name || "User"}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <UserIcon className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>

                                        {/* User Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white truncate">
                                                    {interest.profile.discordNickname || interest.profile.user?.name || interest.profile.pseudoDofus || "Agent Anonyme"}
                                                </span>
                                                {interest.profile.userId === currentUserId && (
                                                    <span className="text-caption bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                                        Toi
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {interest.profile.classe || "Classe inconnue"}
                                            </div>
                                        </div>

                                        {/* Star indicator */}
                                        <Star className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        className="flex-1 text-slate-400 hover:text-white"
                        onClick={onClose}
                    >
                        Fermer
                    </Button>
                    <Button
                        className={cn(
                            "flex-1 gap-2 transition-all",
                            isCurrentUserInterested
                                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        )}
                        onClick={handleToggleInterest}
                        disabled={isPending}
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Star className={cn(
                                "w-4 h-4",
                                isCurrentUserInterested ? "" : "fill-white"
                            )} />
                        )}
                        {isCurrentUserInterested ? "Retirer" : "Je suis intéressé"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
