"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

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
import { getStuffGalleryPage, type GalleryBuild } from "@/server/actions/gallery-actions";
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
    const [stuffs, setStuffs] = useState<GalleryBuild[]>([]);
    const [selectedStuffId, setSelectedStuffId] = useState<string>("none");
    const [customStuffName, setCustomStuffName] = useState("");

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
            
            // Load user stuffs for the candidacy modal
            const [stuffRes, userCtx] = await Promise.all([
                getStuffGalleryPage(guildId),
                import("@/server/actions/user-actions").then(m => m.getUserContext(guildId))
            ]);
            
            if (stuffRes.success && stuffRes.data && userCtx.profileId) {
                const myStuffs = stuffRes.data.builds.filter(s => s.author.id === userCtx.profileId);
                setStuffs(myStuffs);
            }
            
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
        const selectedStuff = stuffs.find(s => s.id === selectedStuffId);
        const result = await sendJoinRequest(guildId, { 
            runId, 
            classe: selectedClasse, 
            message: message || undefined,
            linkedStuffId: selectedStuffId === "none" ? null : selectedStuffId,
            linkedStuffName: customStuffName || selectedStuff?.name || null,
            linkedStuffThumbnail: selectedStuff?.previewData?.thumbnail || null,
            linkedStuffUrl: selectedStuff?.url || null
        });
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
        <div className="rounded-lg bg-background border border-info/40 p-4 shadow-purple-900/10">
            {pendingRequest ? (
                <div className="flex flex-col gap-3 items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center border border-warning/40">
                        <Clock className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                        <h4 className="font-bold text-warning">Candidature en attente</h4>
                        <p className="text-xs text-info mt-1">Le meneur de la run a été notifié.</p>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleCancelRequest}
                        disabled={isPending}
                        className="w-full bg-warning/15 hover:bg-warning/15 text-warning mt-2"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                        Annuler la candidature
                    </Button>
                </div>
            ) : canApply ? (
                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full bg-success/15 hover:bg-success/15 text-foreground font-bold h-14 text-lg">
                            <UserPlus className="w-5 h-5 mr-3" />
                            Postuler à cette Run
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-surface border-info/40 text-foreground w-[90vw] max-w-[425px] rounded-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
                        <DialogHeader>
                            <DialogTitle>Candidature Run Songes</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-info">Classe</Label>
                                <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                    <SelectTrigger className="bg-info/10 border-info/40 w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface border-info/40">
                                        {DOFUS_CLASSES.map((classe) => (
                                            <SelectItem key={classe} value={classe} className="text-foreground focus:bg-info/10 text-left">
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
                                <Label className="text-info">Message (optionnel)</Label>
                                <Textarea
                                    placeholder="Ex: Cra opti dispo 21h"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={200}
                                />
                            </div>

                            <div className="space-y-4 border-t border-info/40 pt-4">
                                <Label className="text-info flex items-center gap-2">
                                    🛡️ Relier un Stuff (Optionnel)
                                </Label>
                                
                                <div className="space-y-2">
                                    <Select value={selectedStuffId} onValueChange={setSelectedStuffId}>
                                        <SelectTrigger className="bg-info/10 border-info/40 w-full">
                                            <SelectValue placeholder="Choisir un stuff..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-surface border-info/40">
                                            <SelectItem value="none" className="text-muted-foreground italic">Aucun stuff</SelectItem>
                                            {stuffs.map((stuff) => (
                                                <SelectItem key={stuff.id} value={stuff.id} className="text-foreground focus:bg-info/10">
                                                    <div className="flex items-center gap-2">
                                                        {stuff.previewData?.thumbnail && (
                                                            <img src={stuff.previewData.thumbnail} className="w-6 h-6 rounded object-cover border border-border" alt="" />
                                                        )}
                                                        <span className="truncate max-w-[200px]">{stuff.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedStuffId !== "none" && (
                                    <div className="space-y-2 duration-300">
                                        <Label className="text-xs text-info">Nom personnalisé (optionnel)</Label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Stuff Eau/Air Distant"
                                            value={customStuffName}
                                            onChange={(e) => setCustomStuffName(e.target.value)}
                                            className="w-full bg-info/10 border border-info/40 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info/40"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-success/15 hover:bg-success/15 h-10 mt-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer ma candidature"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            ) : canApplyConditions && !canJoinSonges ? (
                <div className="p-3 rounded-lg bg-danger/15 border border-danger/40 text-danger text-sm text-center">
                    Vous n'avez pas la permission de candidater dans les Songes.
                </div>
            ) : null}
        </div>
    );
}
