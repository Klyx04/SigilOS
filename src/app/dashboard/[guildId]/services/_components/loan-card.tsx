"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, ArrowRight, Coins, History, Package } from "lucide-react";
import { type LoanWithProfiles } from "@/server/actions/loan-actions";
import { LOAN_TYPE_LABELS, LOAN_STATUS_LABELS } from "@/server/actions/services-constants";
import { markLoanReturned, cancelLoan } from "@/server/actions/loan-actions";
import { ProofThumbnail } from "./proof-thumbnail";
import { ActivityTimeline } from "./activity-timeline";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "border-info/40 bg-info/10 text-info ",
    RETURNED: "border-success/40 bg-success/10 text-success",
    PARTIAL: "border-warning/40 bg-warning/10 text-warning ",
    CANCELLED: "border-border bg-surface text-muted-foreground",
};

interface LoanCardProps {
    loan: LoanWithProfiles;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
}

function getName(p: { pseudoDofus?: string | null; discordNickname?: string | null; user?: { name?: string | null } }) {
    return p.pseudoDofus || p.discordNickname || p.user?.name || "Membre";
}

export function LoanCard({ loan, guildId, currentProfileId, isAdmin }: LoanCardProps) {
    const router = useRouter();
    const [returnLoading, setReturnLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const isLender = loan.lender.id === currentProfileId;
    const isBorrower = loan.borrower.id === currentProfileId;
    const canManage = isLender || isAdmin;
    const isActive = loan.status === "ACTIVE" || loan.status === "PARTIAL";

    const handleReturn = async () => {
        if (!confirm("Marquer ce prêt comme entièrement rendu ?")) return;
        setReturnLoading(true);
        const result = await markLoanReturned(guildId, loan.id, undefined, false);
        if (result.success) {
            toast.success("Prêt marqué comme rendu !");
            router.refresh();
        } else {
            toast.error(result.error || "Erreur.");
        }
        setReturnLoading(false);
    };

    const handleCancel = async () => {
        if (!confirm("Annuler ce prêt ?")) return;
        setCancelLoading(true);
        const result = await cancelLoan(guildId, loan.id);
        if (result.success) {
            toast.success("Prêt annulé.");
            router.refresh();
        } else {
            toast.error(result.error || "Erreur.");
        }
        setCancelLoading(false);
    };

    const lenderName = getName(loan.lender);
    const borrowerName = getName(loan.borrower);

    return (
        <div className={cn(
            "group relative flex flex-col rounded-3xl border transition-all duration-300 overflow-hidden",
            isActive 
                ? "border-border bg-surface/40 hover:bg-surface/60 hover:border-border-strong shadow-xl hover:shadow-2xl" 
                : "border-border opacity-60 bg-background/20"
        )}>
            {/* Background Glow */}
            {isActive && (
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-info/5 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            )}

            <div className="relative p-6 flex flex-col gap-5 h-full z-10">
            {/* Header: Status + Type */}
            <div className="flex items-center justify-between">
                <Badge variant="outline" className={cn(
                    "text-caption font-black uppercase tracking-[0.15em] px-3 py-1 border rounded-full shadow-sm",
                    STATUS_COLORS[loan.status]
                )}>
                    {LOAN_STATUS_LABELS[loan.status]}
                </Badge>
                <span className="text-caption text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">
                    {LOAN_TYPE_LABELS[loan.type]}
                </span>
            </div>

            {/* Description */}
            <h3 className="text-xl font-black text-foreground leading-tight tracking-tight group-hover:text-info transition-colors duration-300 italic">
                &quot;{loan.description}&quot;
            </h3>

            {/* Amount */}
            {/* Amount */}
            {loan.amount && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-black/40 px-4 py-3 shadow-inner">
                    <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center border border-warning/20">
                        <Coins className="h-4 w-4 text-warning shadow-glow" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-foreground text-lg leading-none">{loan.amount}</span>
                        <span className="text-caption text-muted-foreground font-black uppercase tracking-widest mt-0.5">Valeur estimée</span>
                    </div>
                </div>
            )}

            {/* Lender → Borrower */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border relative overflow-hidden group/flow">
                <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-warning/5 opacity-0 group-hover/flow:opacity-100 transition-opacity duration-300" />
                
                <div className="flex flex-col items-center gap-2 flex-1 z-10">
                    <Avatar className="h-10 w-10 rounded-xl border border-success/20 shadow-lg group- transition-transform">
                        <AvatarImage src={loan.lender.user?.image || undefined} />
                        <AvatarFallback className="text-xs bg-success/10 text-success font-black">{lenderName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-caption font-black uppercase tracking-widest text-success">{lenderName}</span>
                </div>

                <div className="flex flex-col items-center gap-1 z-10">
                    <div className="h-px w-8 bg-elevated relative">
                        <ArrowRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover/flow:text-info transition-colors" />
                    </div>
                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">TRANSFERT</span>
                </div>

                <div className="flex flex-col items-center gap-2 flex-1 z-10">
                    <Avatar className="h-10 w-10 rounded-xl border border-warning/20 shadow-lg group- transition-transform">
                        <AvatarImage src={loan.borrower.user?.image || undefined} />
                        <AvatarFallback className="text-xs bg-warning/10 text-warning font-black">{borrowerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-caption font-black uppercase tracking-widest text-warning">{borrowerName}</span>
                </div>
            </div>

            {/* Due date */}
            {loan.dueDate && (
                <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Échéance : {new Date(loan.dueDate).toLocaleDateString("fr-FR")}</span>
                </div>
            )}

            {/* Item lié (Stuff/Ressources) */}
            {loan.linkedItemName && (
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm group/item hover:bg-surface transition-colors">
                    {loan.linkedItemIconUrl ? (
                        <div className="relative h-14 w-14 shrink-0 drop-shadow-2xl group-hover/item:scale-110 transition-transform">
                            <Image src={loan.linkedItemIconUrl} alt={loan.linkedItemName} fill className="object-contain" />
                        </div>
                    ) : (
                        <div className="h-14 w-14 rounded-xl bg-surface flex items-center justify-center border border-border">
                            <Package className="h-7 w-7 text-muted-foreground" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-base font-black text-foreground truncate leading-tight">{loan.linkedItemName}</p>
                        <p className="text-caption text-muted-foreground font-black uppercase tracking-widest mt-1">Item associé</p>
                    </div>
                </div>
            )}

            {/* Proof principale — taille card */}
            {loan.proofUrl && (
                <div className="rounded-lg overflow-hidden border border-border">
                    <ProofThumbnail src={loan.proofUrl} alt="Preuve de prêt" size="card" />
                </div>
            )}

            {/* Proof retour + Timeline */}
            <div className="flex items-center gap-2">
                <ProofThumbnail src={loan.returnProofUrl} alt="Preuve de retour" />
                <div className="flex-1" />
                <ActivityTimeline entityId={loan.id} guildId={guildId} />
            </div>

            {/* Actions */}
            {canManage && isActive && (
                <div className="flex items-center gap-3 pt-5 border-t border-border mt-auto">
                    <Button
                        size="sm"
                        onClick={handleReturn}
                        disabled={returnLoading || cancelLoading}
                        className="h-10 px-6 rounded-xl text-caption font-black uppercase tracking-widest bg-success/20 text-success hover:bg-success/30 border border-success/20  transition-all"
                    >
                        {returnLoading
                            ? <span className="h-4 w-4 rounded-full border-2 border-success border-t-transparent animate-spin mr-2" />
                            : <Check className="h-4 w-4 mr-2" strokeWidth={3} />}
                        Marquer comme rendu
                    </Button>
                    <div className="flex-1" />
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={returnLoading || cancelLoading}
                        className="h-10 w-10 rounded-xl bg-danger/5 hover:bg-danger/15 text-danger/60 hover:text-danger transition-all"
                    >
                        {cancelLoading
                            ? <span className="h-4 w-4 rounded-full border-2 border-border border-t-transparent animate-spin" />
                            : <X className="h-4 w-4" strokeWidth={3} />}
                    </Button>
                </div>
            )}
            </div>
        </div>
    );
}
