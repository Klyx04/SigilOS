"use client";

import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { deleteDoc } from "@/server/actions/doc-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDocButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cette page ?")) return;
        setLoading(true);
        const res = await deleteDoc(id);
        if (res.success) {
            toast.success("Page supprimée");
            router.refresh();
        } else {
            toast.error("Erreur: " + res.error);
        }
        setLoading(false);
    };

    return (
        <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleDelete}
            disabled={loading}
        >
            <Trash className="w-4 h-4" />
        </Button>
    );
}
