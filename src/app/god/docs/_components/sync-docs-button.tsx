"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncOfficialDocsAction } from "@/server/actions/doc-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncOfficialDocsButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSync = async () => {
        if (!confirm("Voulez-vous synchroniser les documentations officielles SigilOS depuis le catalogue ?")) return;
        setLoading(true);
        try {
            const res = await syncOfficialDocsAction();
            if (res.success && res.data) {
                toast.success(`Documentation synchronisée : ${res.data.createdCount} créées, ${res.data.updatedCount} mises à jour.`);
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de la synchronisation");
            }
        } catch {
            toast.error("Erreur inattendue");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            onClick={handleSync}
            disabled={loading}
            className="px-6 py-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-all shadow-lg hover:border-white/20"
        >
            <RefreshCw className={`w-5 h-5 mr-2.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Synchronisation..." : "Sync Catalogue Officiel"}
        </Button>
    );
}
