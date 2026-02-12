import { Loader2 } from "lucide-react";

export default function DocsLoading() {
    return (
        <div className="flex items-center justify-center min-h-[50vh] w-full text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm font-medium">Chargement de la documentation...</span>
        </div>
    );
}
