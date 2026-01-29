import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
    return (
        <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="relative h-12 w-12">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-black/50 border border-white/10 backdrop-blur-xl">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                </div>
                <p className="text-zinc-500 font-bold text-sm animate-pulse uppercase tracking-widest">Chargement du module...</p>
            </div>
        </div>
    );
}
