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

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    RETURNED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
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
        <div className={`rounded-xl border ${isActive ? "border-white/12 hover:border-cyan-500/25" : "border-white/5 opacity-70"} bg-zinc-900/80 hover:bg-zinc-800/80 p-4 transition-all duration-300 space-y-3 shadow-sm`}>
            {/* Header: Status + Type */}
            <div className="flex items-center justify-between">
                <Badge variant="outline" className={`${STATUS_COLORS[loan.status]} text-[10px] font-black uppercase tracking-wider px-2 py-0.5`}>
                    {LOAN_STATUS_LABELS[loan.status]}
                </Badge>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {LOAN_TYPE_LABELS[loan.type]}
                </span>
            </div>

            {/* Description */}
            <p className="text-base font-black text-white leading-snug">{loan.description}</p>

            {/* Amount */}
            {loan.amount && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                    <Coins className="h-4 w-4 shrink-0" />
                    <span className="font-black text-base">{loan.amount}</span>
                </div>
            )}

            {/* Lender → Borrower */}
            <div className="flex items-center gap-2 py-2">
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 rounded-md border border-white/10">
                        <AvatarImage src={loan.lender.user?.image || undefined} />
                        <AvatarFallback className="text-[9px] bg-zinc-800">{lenderName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-emerald-400">{lenderName}</span>
                </div>
                <ArrowRight className="h-3 w-3 text-zinc-600" />
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 rounded-md border border-white/10">
                        <AvatarImage src={loan.borrower.user?.image || undefined} />
                        <AvatarFallback className="text-[9px] bg-zinc-800">{borrowerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-orange-400">{borrowerName}</span>
                </div>
            </div>

            {/* Due date */}
            {loan.dueDate && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Échéance : {new Date(loan.dueDate).toLocaleDateString("fr-FR")}</span>
                </div>
            )}

            {/* Item lié (Stuff/Ressources) */}
            {loan.linkedItemName && (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    {loan.linkedItemIconUrl ? (
                        <div className="relative h-12 w-12 shrink-0">
                            <Image src={loan.linkedItemIconUrl} alt={loan.linkedItemName} fill className="object-contain" />
                        </div>
                    ) : (
                        <Package className="h-6 w-6 text-zinc-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{loan.linkedItemName}</p>
                        <p className="text-xs text-zinc-500">Item associé</p>
                    </div>
                </div>
            )}

            {/* Proof principale — taille card */}
            {loan.proofUrl && (
                <div className="rounded-lg overflow-hidden border border-white/10">
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
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <Button
                        size="sm"
                        onClick={handleReturn}
                        disabled={returnLoading || cancelLoading}
                        className="h-7 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20"
                    >
                        {returnLoading
                            ? <span className="h-3 w-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                            : <Check className="h-3 w-3 mr-1" />}
                        Rendu
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={returnLoading || cancelLoading}
                        className="h-7 text-xs text-zinc-500 hover:text-rose-400 ml-auto"
                    >
                        {cancelLoading
                            ? <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                            : <X className="h-3 w-3" />}
                    </Button>
                </div>
            )}
        </div>
    );
}
