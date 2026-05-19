import { getPlatformConfig } from "@/server/actions/changelog-actions";
import { Wrench, Shield, Clock } from "lucide-react";

export const metadata = {
    title: "SigilOS — Maintenance",
    description: "SigilOS est temporairement en maintenance. Nous revenons très vite.",
};

export default async function MaintenancePage() {
    const { config } = await getPlatformConfig();
    const message = config?.maintenanceMessage || "Nous effectuons une mise à jour pour améliorer votre expérience. Nous revenons très vite !";

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
                <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px]" />
                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-2xl w-full text-center">
                {/* Logo + Icon */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.2)] mx-auto">
                        <Wrench className="w-10 h-10 text-indigo-400 animate-[spin_8s_linear_infinite]" />
                    </div>
                    {/* Pulsing ring */}
                    <div className="absolute inset-0 rounded-3xl border border-indigo-500/20 animate-ping" style={{ animationDuration: "3s" }} />
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5" />
                    Maintenance en cours
                </div>

                {/* Title */}
                <div className="space-y-4">
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">
                        Sigil<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">OS</span>
                    </h1>
                    <p className="text-xl font-bold text-zinc-400">
                        En cours de mise à jour
                    </p>
                </div>

                {/* Message */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 backdrop-blur-md w-full">
                    <p className="text-zinc-300 text-base leading-relaxed font-medium">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-widest">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Géré par l&apos;équipe SigilOS</span>
                </div>
            </div>
        </div>
    );
}
