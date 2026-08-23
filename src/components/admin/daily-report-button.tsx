"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendDailySummaryReport } from "@/server/actions/daily-report-actions";

export function DailyReportButton({ guildId }: { guildId: string }) {
    const [isPending, startTransition] = useTransition();
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSendReport = () => {
        startTransition(async () => {
            const res = await sendDailySummaryReport(guildId, true);
            if (res.success) {
                toast.success("Rapport quotidien envoyé !");
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 3000);
            } else {
                toast.error(res.error || "Échec de l'envoi");
            }
        });
    };

    return (
        <Button
            onClick={handleSendReport}
            disabled={isPending}
            className={`
                h-12 w-full rounded-xl font-semibold text-caption transition-colors
                ${isSuccess 
                    ? "bg-success/20 border-success/30 text-success" 
                    : "bg-elevated/50 hover:bg-muted/50 border-border text-muted-foreground"}
            `}
            variant="outline"
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isSuccess ? (
                <Check className="w-4 h-4 mr-2" />
            ) : (
                <Send className="w-4 h-4 mr-2" />
            )}
            {isPending ? "ENVOI..." : isSuccess ? "ENVOYÉ ✅" : "RAPPORT QUOTIDIEN"}
        </Button>
    );
}
