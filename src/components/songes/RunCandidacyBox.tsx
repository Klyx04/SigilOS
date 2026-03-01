"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    sendJoinRequest,
    cancelJoinRequest,
    getMyJoinRequestStatus
} from "@/server/actions/songes/dream-run-actions";
import { DOFUS_CLASSES, type DofusClass } from "@/lib/songes/types";
import { ClassIcon } from "@/components/shared/class-icon";

interface RunCandidacyBoxProps {
    guildId: string;
    runId: string;
    status: string;
    membersCount: number;
    isMember: boolean;
    isLeader: boolean;
    canJoinSonges?: boolean;
}

export function RunCandidacyBox({
    guildId,
    runId,
    status,
    membersCount,
    isMember,
    isLeader,
    canJoinSonges = true
}: RunCandidacyBoxProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [pendingRequest, setPendingRequest] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    const canApplyConditions = (status === "RECRUITING" || status === "IN_PROGRESS") &&
        !isMember && !isLeader && membersCount < 4 && !pendingRequest;
    const canApply = canApplyConditions && canJoinSonges;

    useEffect(() => {
        async function checkStatus() {
            if (isMember || isLeader) {
                setPendingRequest(false);
                setInitialLoad(false);
                return;
            }
            const requestStatus = await getMyJoinRequestStatus(guildId, runId);
            setPendingRequest(requestStatus.success && requestStatus.status === "PENDING");
            setInitialLoad(false);
        }
        checkStatus();
    }, [guildId, runId, isMember, isLeader]);

    useEffect(() => {
        if (!pendingRequest || initialLoad) return;

        const interval = setInterval(async () => {
            const result = await getMyJoinRequestStatus(guildId, runId);
            if (result.success && result.status !== "PENDING") {
                setPendingRequest(false);
                router.refresh();

                if (result.status === "REJECTED") {
                    toast.error("Candidature expirée ou refusée.");
                } else if (result.status === "ACCEPTED") {
                    toast.success("Candidature acceptée !");
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [pendingRequest, guildId, runId, router, initialLoad]);

    const handleSendJoinRequest = async () => {
        setLoading(true);
        const result = await sendJoinRequest(guildId, { runId, classe: selectedClasse, message: message || undefined });
        if (result.success) {
            toast.success("Candidature envoyée avec succès !");
            setJoinDialogOpen(false);
            setPendingRequest(true);
            router.refresh();
        } else {
            toast.error(result.error || "Une erreur est survenue");
        }
        setLoading(false);
    };

    const handleCancelRequest = () => {
        startTransition(async () => {
            await cancelJoinRequest(guildId, runId);
            setPendingRequest(false);
            router.refresh();
        });
    };

    if (initialLoad) return null;

    // Si l'utilisateur est membre ou n'a pas de requête en attente et qu'il ne peut même pas postuler dans l'absolu... on n'affiche rien.
    // MAIS si canApplyConditions est true (ie. de la place, bonne phase) ET qu'on a PAS canJoinSonges, on veut afficher la boite rouge.
    if (!pendingRequest && !canApplyConditions) return null;

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4 shadow-lg shadow-purple-900/10">
            {pendingRequest ? (
                <div className="flex flex-col gap-3 items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 animate-pulse">
                        <Clock className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-400">Candidature en attente</h4>
                        <p className="text-xs text-purple-200/70 mt-1">Le meneur de la run a été notifié.</p>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleCancelRequest}
                        disabled={isPending}
                        className="w-full bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 mt-2"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                        Annuler la candidature
                    </Button>
                </div>
            ) : canApply ? (
                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold h-14 text-lg shadow-[0_0_20px_rgba(22,163,74,0.3)]">
                            <UserPlus className="w-5 h-5 mr-3" />
                            Postuler à cette Run
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white w-[90vw] max-w-[425px] rounded-xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
                        <DialogHeader>
                            <DialogTitle>Candidature Run Songes</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-purple-200">Classe</Label>
                                <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                    <SelectTrigger className="bg-purple-900/30 border-purple-500/30 w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                        {DOFUS_CLASSES.map((classe) => (
                                            <SelectItem key={classe} value={classe} className="text-white focus:bg-purple-700/50 text-left">
                                                <div className="flex items-center">
                                                    <ClassIcon classId={classe} size={20} className="mr-2" />
                                                    {classe}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-purple-200">Message (optionnel)</Label>
                                <Textarea
                                    placeholder="Ex: Cra opti dispo 21h"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={200}
                                    className="bg-purple-900/30 border-purple-500/30 text-white min-h-[100px] resize-none w-full break-all whitespace-pre-wrap"
                                />
                                <div className="text-right text-xs text-purple-300/50">
                                    {message.length}/200
                                </div>
                            </div>
                            <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 h-10">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer ma candidature"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            ) : canApplyConditions && !canJoinSonges ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
                    Vous n'avez pas la permission de candidater dans les Songes.
                </div>
            ) : null}
        </div>
    );
}
